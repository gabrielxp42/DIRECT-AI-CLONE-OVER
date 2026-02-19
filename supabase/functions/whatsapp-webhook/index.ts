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
        const rawBody = await req.text();
        let payload: any = {};
        try {
            payload = JSON.parse(rawBody);
        } catch (e) {
            console.error("Failed to parse JSON:", rawBody);
        }

        // Initialize Supabase Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // DEBUG: LOG EVERYTHING IMMEDIATELY
        try {
            await supabaseAdmin.from('webhook_logs').insert({
                payload: payload,
                instance_id: payload.instance || 'unknown',
                event_type: payload.event || payload.event_type || 'unknown',
                status: 'raw_received'
            });
        } catch (err) {
            console.error("Initial logging error:", err);
        }

        const eventType = payload.event || payload.event_type;
        const instance = payload.instance || payload.instanceId;
        const data = payload.data;

        // Basic Validation
        if (!payload || !eventType) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'no_event' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Only process message events (MESSAGES_UPSERT is the main one)
        const isUpsert = eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert';
        if (!isUpsert) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'wrong_event_type', received: eventType }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!instance || !data) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'invalid_payload', has_instance: !!instance, has_data: !!data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`[Webhook] Processing ${eventType} for instance: ${instance}`);

        // Search for user profile linked to this instance
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, ai_auto_reply_enabled, whatsapp_instance_id, whatsapp_boss_group_id')
            .eq('whatsapp_instance_id', instance)
            .limit(1);

        if (profileError) {
            console.error(`[Webhook] DB Query Error:`, profileError);
        }

        const profile = profiles?.[0];

        if (!profile) {
            console.warn(`[Webhook] No profile found for instance: ${instance}`);
            return new Response(JSON.stringify({
                status: 'error',
                reason: 'instance_not_linked',
                instance_received: instance
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        console.log(`[Webhook] Found profile: ${profile.id} for instance: ${instance}`);

        const msgData = data;
        const messageType = msgData.messageType || 'conversation';
        const fromMe = msgData.key?.fromMe;
        const remoteJid = msgData.key?.remoteJid;
        const pushName = msgData.pushName;

        // --- DETECT IF BOSS ---
        let isBoss = false;
        if (remoteJid && profile.whatsapp_boss_group_id) {
            const cleanRemote = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
            const cleanBoss = profile.whatsapp_boss_group_id.replace('@s.whatsapp.net', '').replace('@g.us', '');

            // Robust comparison: check if cleanRemote ends with cleanBoss or vice versa
            // This handles cases like 5521... vs 21...
            if (remoteJid === profile.whatsapp_boss_group_id ||
                cleanRemote === cleanBoss ||
                cleanRemote.endsWith(cleanBoss) ||
                cleanBoss.endsWith(cleanRemote)) {
                isBoss = true;
                console.log(`[Webhook] 👑 BOSS DETECTED: ${remoteJid}`);
            }
        }

        // --- 2. EXTRACT CONTENT (Text or Audio) ---
        let messageText = '';
        let audioBase64 = payload.base64 || '';
        let audioMimetype = 'audio/ogg'; // Default
        const messageObj = msgData.message;

        if (messageObj) {
            if (messageObj.conversation) {
                messageText = messageObj.conversation;
            } else if (messageObj.extendedTextMessage?.text) {
                messageText = messageObj.extendedTextMessage.text;
            } else if (messageObj.imageMessage?.caption) {
                messageText = messageObj.imageMessage.caption;
            } else if (messageObj.videoMessage?.caption) {
                messageText = messageObj.videoMessage.caption;
            } else if (messageObj.audioMessage || messageType === 'audioMessage') {
                console.log("[Webhook] Audio message detected");
                // Evolution API has base64 at msgData.message.base64 or payload.base64
                // OR it might be in msgData.message.audioMessage.base64
                audioBase64 = audioBase64 || messageObj.base64 || messageObj.audioMessage?.base64;
                audioMimetype = messageObj.audioMessage?.mimetype || 'audio/ogg';
                messageText = ""; // Leave empty for generator to know it's PURE audio
            } else if (typeof messageObj === 'string') {
                messageText = messageObj;
            }
        }

        // If no content and no audio, ignore
        if (!messageText && !audioBase64) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'empty_content' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 3. GET CONVERSATION HISTORY ---
        let formattedHistory = '';
        try {
            const { data: history } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('message, direction, client_name')
                .eq('user_id', profile.id)
                .eq('phone', remoteJid ? remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') : 'unknown')
                .order('created_at', { ascending: false })
                .limit(10);

            if (history && history.length > 0) {
                formattedHistory = history
                    .reverse()
                    .map((m: any) => `${m.direction === 'sent' ? 'Gabi' : (m.client_name || 'Cliente')}: ${m.message}`)
                    .join('\n');
            }
        } catch (err) {
            console.error("[Webhook] History retrieval error:", err);
        }

        // --- 4. INSERT INTO DATABASE (Incoming Message) ---
        const { data: insertedMsg, error: insertError } = await supabaseAdmin
            .from('whatsapp_messages')
            .insert({
                user_id: profile.id,
                phone: remoteJid ? remoteJid.split('@')[0] : 'unknown',
                message: messageText || (audioBase64 ? "[Mensagem de Voz]" : "[Mídia]"),
                direction: fromMe ? 'sent' : 'received',
                status: 'delivered',
                client_name: pushName || null,
                analyzed: false
            })
            .select('id')
            .single();

        if (insertError) {
            console.error(`[Webhook] DB Insert Error: ${insertError.message}`);
        }

        // --- 5. TRIGGER AI RESPONSE IF ENABLED ---
        const shouldReply = profile.ai_auto_reply_enabled || isBoss;

        if (shouldReply && !fromMe && remoteJid) {
            console.log(`[Webhook] Triggering AI Response. isBoss: ${isBoss}, hasAudio: ${!!audioBase64}`);

            const AI_FUNCTION_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-response-generator`;

            const aiTask = fetch(AI_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: profile.id,
                    message: messageText,
                    audio_base64: audioBase64,
                    audio_mimetype: audioMimetype,
                    db_message_id: insertedMsg?.id, // Passing ID to allow transcription update
                    customer_phone: remoteJid ? remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '') : 'unknown',
                    customer_name: pushName || 'Cliente',
                    previous_history: formattedHistory,
                    is_boss: isBoss
                })
            })
                .then(res => {
                    if (!res.ok) return res.text().then(t => console.error(`[Webhook] AI Error ${res.status}:`, t));
                    return res.json().then(j => console.log(`[Webhook] AI Task Started:`, j));
                })
                .catch(e => console.error("[Webhook] AI Trigger Exception:", e));

            // Use EdgeRuntime.waitUntil 
            // @ts-ignore
            if (typeof EdgeRuntime !== 'undefined') {
                // @ts-ignore
                EdgeRuntime.waitUntil(aiTask);
            }
        }

        return new Response(JSON.stringify({ status: 'success', message_id: msgData.key?.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(`[Webhook] Critical Error: ${error.message}`);
        return new Response(JSON.stringify({ error: true, message: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
