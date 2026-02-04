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
        // IMPORTANT: We use limit(1) to avoid errors if multiple users use the same instance name
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, ai_auto_reply_enabled, whatsapp_instance_id')
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

        // Log the success to webhook_logs for debug
        try {
            await supabaseAdmin.from('webhook_logs').insert({
                payload: payload,
                instance_id: instance,
                event_type: eventType,
                status: 'matched',
                user_id: profile.id
            });
        } catch (err) {
            console.error("Match logging error:", err);
        }

        const msgData = data;
        const messageType = msgData.messageType || 'conversation';
        const fromMe = msgData.key?.fromMe;
        const remoteJid = msgData.key?.remoteJid;
        const pushName = msgData.pushName;

        // Extract Text Content - be VERY robust here
        let messageText = '';
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
            } else if (typeof messageObj === 'string') {
                messageText = messageObj;
            }
        }

        if (!messageText) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'empty_text' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Insert into whatsapp_messages
        const { error: insertError } = await supabaseAdmin
            .from('whatsapp_messages')
            .insert({
                user_id: profile.id,
                phone: remoteJid ? remoteJid.split('@')[0] : 'unknown',
                message: messageText,
                direction: fromMe ? 'sent' : 'received',
                status: 'delivered',
                client_name: pushName || null,
                analyzed: false
            });

        if (insertError) {
            console.error(`[Webhook] DB Insert Error: ${insertError.message}`);
            throw insertError;
        }

        // TRIGGER AI RESPONSE IF ENABLED
        if (profile.ai_auto_reply_enabled && !fromMe && messageText && messageText.length < 500 && remoteJid) {
            console.log(`[Webhook] Triggering AI Response for ${remoteJid}`);

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
                    customer_phone: remoteJid.split('@')[0],
                    customer_name: pushName || 'Cliente',
                    previous_history: ''
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
