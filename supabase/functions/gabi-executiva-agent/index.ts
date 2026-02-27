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
            return new Response(JSON.stringify({ skipped: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userId = record.user_id;
        const message = record.description;

        if (!userId || !message) {
            return new Response(JSON.stringify({ error: true, message: "Missing required fields" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Supabase Client with Service Role (Admin)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Get User Profile and Boss Config
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: true, message: "Profile not found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!profile.whatsapp_boss_notifications_enabled) {
            return new Response(JSON.stringify({ sent: false, reason: "Notifications disabled" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let bossTarget = profile.whatsapp_boss_group_id;
        if (!bossTarget) {
            return new Response(JSON.stringify({ sent: false, reason: "No target config" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Target Formatting Logic
        if (!bossTarget.includes('@')) {
            const digits = bossTarget.replace(/\D/g, '');
            if (bossTarget.length > 15 || bossTarget.includes('-')) {
                bossTarget = `${bossTarget}@g.us`;
            } else if (digits.length >= 10) {
                bossTarget = digits.startsWith('55') ? digits : '55' + digits;
            } else {
                bossTarget = `${bossTarget}@g.us`;
            }
        }
        console.log(`[Executive Agent] Target formatted: ${bossTarget}`);

        // 3. Get Evolution API Config from Admin Profile
        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .not('whatsapp_api_url', 'is', null)
            .not('whatsapp_api_key', 'is', null)
            .limit(1)
            .single();

        const EVOLUTION_URL = adminProfile?.whatsapp_api_url?.replace(/\/$/, "");
        const EVOLUTION_KEY = adminProfile?.whatsapp_api_key;
        const INSTANCE = profile.whatsapp_instance_id;

        if (!EVOLUTION_URL || !EVOLUTION_KEY || !INSTANCE) {
            return new Response(JSON.stringify({ error: true, message: "Missing API config or instance" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 4. Humanize Message via Gabi Brain
        let finalMessage = message;
        if (record.title === 'RESUMO_PENDENCIAS') {
            try {
                const brainRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/gabi-brain`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Gabi, formate esse aviso para o Gabriel: ${message}`,
                        platform: 'whatsapp',
                        is_boss: true,
                        user_id: userId
                    })
                });
                if (brainRes.ok) {
                    const brainData = await brainRes.json();
                    finalMessage = brainData.content || brainData.text || finalMessage;
                }
            } catch (e) {
                console.error("[Executive Agent] Humanization failed, using original.");
            }
        }

        if (!finalMessage.includes('Gabi')) {
            finalMessage = `🎩 *Gabi*\n\n${finalMessage}`;
        }

        // 5. Send to Evolution API
        try {
            const payload = {
                number: bossTarget,
                text: finalMessage,
                delay: 1200,
                linkPreview: false
            };

            const sendUrl = `${EVOLUTION_URL}/message/sendText/${INSTANCE}`;
            console.log(`[Executive Agent] Sending to ${sendUrl}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const sendResponse = await fetch(sendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                body: JSON.stringify(payload),
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));

            const responseText = await sendResponse.text();
            let sendResult: any;
            try { sendResult = JSON.parse(responseText); } catch { sendResult = { raw: responseText }; }

            // 6. Log to CRM (whatsapp_messages)
            const logPhone = bossTarget.split('@')[0];
            const { error: logError } = await supabase.from('whatsapp_messages').insert({
                user_id: userId,
                phone: logPhone,
                message: sendResponse.ok ? finalMessage : `[ERRO] ${finalMessage}`,
                direction: 'sent',
                status: sendResponse.ok ? 'delivered' : 'failed',
                analyzed: true,
                analysis_result: {
                    source: "gabi-executiva",
                    version: "2.3",
                    success: sendResponse.ok,
                    api_status: sendResponse.status,
                    api_response: sendResult
                },
                external_id: sendResult.key?.id || sendResult.messageId || null
            });

            if (logError) console.error("[Executive Agent] CRM Logging failed:", logError.message);

            return new Response(JSON.stringify({
                success: sendResponse.ok,
                messageId: sendResult.key?.id || sendResult.messageId,
                apiResponse: sendResult,
                logError: logError?.message
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        } catch (fetchErr: any) {
            console.error("[Executive Agent] API Fetch failed:", fetchErr.message);
            return new Response(JSON.stringify({ error: true, message: "Fetch failed", detail: fetchErr.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    } catch (globalErr: any) {
        console.error("[Executive Agent] Global Exception:", globalErr.message);
        return new Response(JSON.stringify({ error: true, message: globalErr.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }
});
