import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        console.log("[Executive Agent] Payload received:", JSON.stringify(payload));

        const { record, type, table } = payload;

        // 1. Filter: Only handle INSERT on agent_insights with type executive_alert
        if (table !== 'agent_insights' || type !== 'INSERT' || record?.insight_type !== 'executive_alert') {
            console.log(`[Executive Agent] Skipping: table=${table}, type=${type}, insight_type=${record?.insight_type}`);
            return new Response(JSON.stringify({ skipped: true, reason: "Not an executive alert" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userId = record.user_id;
        const message = record.description;

        if (!userId || !message) {
            console.error("[Executive Agent] Error: Missing user_id or description");
            return new Response(JSON.stringify({ error: true, message: "Missing user_id or description" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Supabase Client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Get User Boss Config
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            console.error(`[Executive Agent] Profile Error:`, profileError);
            return new Response(JSON.stringify({ error: true, message: "Profile not found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`[Executive Agent] Profile found for ${profile.email}. Enabled: ${profile.whatsapp_boss_notifications_enabled}`);

        if (!profile.whatsapp_boss_notifications_enabled) {
            console.log(`[Executive Agent] Notifications disabled for user ${userId}`);
            return new Response(JSON.stringify({ sent: false, reason: "Disabled" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let bossTarget = profile.whatsapp_boss_group_id;
        if (!bossTarget) {
            console.warn(`[Executive Agent] No boss target configured`);
            return new Response(JSON.stringify({ sent: false, reason: "No target config" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Format target: handle Brazilian numbers and suffixes
        console.log(`[Executive Agent] Raw target: ${bossTarget}`);
        if (!bossTarget.includes('@')) {
            // Remove any non-digits
            const digits = bossTarget.replace(/\D/g, '');

            // If it's a Brazilian number (10 or 11 digits) without country code, add it
            if (digits.length === 10 || digits.length === 11) {
                bossTarget = digits.startsWith('55') ? digits : '55' + digits;
            } else {
                bossTarget = digits;
            }

            // Groups usually have '-' or are very long
            if (bossTarget.includes('-') || (bossTarget.length > 15 && !bossTarget.startsWith('55'))) {
                bossTarget = `${bossTarget}@g.us`;
                console.log(`[Executive Agent] Detected GROUP target: ${bossTarget}`);
            } else {
                // For phone numbers, Evolution API often prefers just digits or digits@s.whatsapp.net
                // Based on ai-response-generator, we'll try just digits
                console.log(`[Executive Agent] Detected PHONE target: ${bossTarget}`);
            }
        }
        console.log(`[Executive Agent] Final target: ${bossTarget}`);

        // 3. Get Evolution API Config from Admin
        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .single();

        if (!adminProfile?.whatsapp_api_url || !adminProfile?.whatsapp_api_key) {
            console.error("[Executive Agent] Admin Evolution API config missing");
            return new Response(JSON.stringify({ error: true, message: "Admin Evolution API config missing" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const EVOLUTION_URL = adminProfile.whatsapp_api_url.replace(/\/$/, "");
        const EVOLUTION_KEY = adminProfile.whatsapp_api_key;
        const INSTANCE = profile.whatsapp_instance_id;

        if (!INSTANCE) {
            console.error("[Executive Agent] Instance ID missing for user");
            return new Response(JSON.stringify({ error: true, message: "Instance ID missing" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 4. Humanize: Send ALL data to Gabi Brain for ONE natural message
        let finalMessage = message;

        if (record.title === 'RESUMO_PENDENCIAS' && record.data?.debtors) {
            const debtors = record.data.debtors;
            const total = record.data.total || debtors.length;
            console.log(`[Executive Agent] Consolidating ${total} debtors into ONE human message`);

            // Build a natural list for the LLM
            const debtorList = debtors.map((d: any) =>
                `- ${d.cliente}: pedido #${d.pedido}, R$ ${d.valor}, há ${d.dias} dias`
            ).join('\n');

            const prompt = `Você é a Gabi. Mande UMA ÚNICA mensagem pro Gabriel no WhatsApp avisando sobre essas pendências de pagamento.

Dados:
${debtorList}

REGRAS IMPORTANTES:
- Fale como uma amiga e parceira de negócios, NUNCA como um robô.
- Cite os nomes dos clientes naturalmente, como se estivesse conversando. Ex: "o Kevin, o Henrique e o João ainda não pagaram..."
- Mencione os valores e números de pedido de forma organizada mas natural.
- No final, pergunte se ele quer que você cobre algum deles, e se sim, qual.
- Use emojis com moderação. Seja elegante e organizada.
- NÃO use frases como "ALERTA DE PENDÊNCIA" ou "⚠️". Isso é coisa de robô.
- A mensagem deve parecer que veio de uma pessoa real que se importa.`;

            try {
                const brainRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gabi-brain`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: prompt,
                        platform: 'whatsapp',
                        is_boss: true,
                        user_id: userId
                    })
                });

                if (brainRes.ok) {
                    const brainData = await brainRes.json();
                    if (brainData.content || brainData.text) {
                        finalMessage = brainData.content || brainData.text;
                        console.log("[Executive Agent] Humanization successful!");
                    } else {
                        console.warn("[Executive Agent] Brain returned empty, using fallback");
                    }
                } else {
                    console.error(`[Executive Agent] Brain error: ${brainRes.status}`);
                }
            } catch (err: any) {
                console.error("[Executive Agent] Humanization exception:", err.message);
            }
        }

        // Clean header — only add if brain didn't already include one
        if (!finalMessage.includes('Gabi')) {
            finalMessage = `🎩 *Gabi*\n\n${finalMessage}`;
        }

        console.log(`[Executive Agent] Sending to ${bossTarget} via ${INSTANCE}`);

        // 5. Send Message
        try {
            const sendUrl = `${EVOLUTION_URL}/message/sendText/${INSTANCE}`;

            // Custom fetch with timeout to avoid 504 Supabase Timeout (150s)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s limit

            const sendResponse = await fetch(sendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_KEY
                },
                body: JSON.stringify({
                    number: bossTarget,
                    text: finalMessage,
                    linkPreview: false
                }),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));

            const sendResult = await sendResponse.json();
            console.log(`[Executive Agent] Evolution API Response status=${sendResponse.status}:`, JSON.stringify(sendResult));

            if (!sendResponse.ok) {
                return new Response(JSON.stringify({ error: true, detail: sendResult, source: "Evolution API" }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // 6. LOG TO HISTORY (Omniscient Gabi)
            // We save this to whatsapp_messages so the brain has context in future chats
            console.log(`[Executive Agent] Logging message to history for context...`);
            const cleanPhone = bossTarget.split('@')[0]; // Store just the digits/id
            await supabase.from('whatsapp_messages').insert({
                user_id: userId,
                phone: cleanPhone,
                message: finalMessage,
                direction: 'sent',
                status: 'delivered',
                analyzed: true,
                analysis_result: { source: "gabi-executiva", version: "1.0" },
                external_id: sendResult.key?.id || sendResult.messageId || null
            });

            return new Response(JSON.stringify({ success: true, messageId: sendResult.key?.id || sendResult.messageId }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } catch (fetchError: any) {
            console.error("[Executive Agent] Fetch execution error:", fetchError.message);
            return new Response(JSON.stringify({ error: true, message: "Fetch failed", detail: fetchError.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

    } catch (error: any) {
        console.error("[Executive Agent] Global Exception:", error.message);
        return new Response(JSON.stringify({ error: true, message: error.message, stack: error.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 // Returning 200 for easier debugging
        });
    }
});
