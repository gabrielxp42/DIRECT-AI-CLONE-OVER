import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const rawBody = await req.text();
        let payload: any = {};
        try { payload = JSON.parse(rawBody); } catch (e) { }

        const eventType = payload.event || payload.event_type;
        const instance = payload.instance || payload.instanceId;
        const data = payload.data;

        if (!payload || !eventType || !instance) return new Response('ok', { headers: corsHeaders });

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

        // --- OPTIMIZED CONNECTION UPDATES ---
        if (eventType === 'CONNECTION_UPDATE' || eventType === 'connection.update') {
            const state = data?.state || data?.status;

            // IGNORE 'connecting' FLOOD: Only process major state changes to save resources
            if (state === 'open' || state === 'connected') {
                await supabaseAdmin.from('profiles').update({ whatsapp_status: 'connected', whatsapp_qr_cache: null }).eq('whatsapp_instance_id', instance);
                console.log(`[Webhook] ${instance} is OPEN.`);
            } else if (state === 'close' || state === 'removed' || state === 'refused') {
                await supabaseAdmin.from('profiles').update({ whatsapp_status: 'disconnected', whatsapp_qr_cache: null }).eq('whatsapp_instance_id', instance);
                console.log(`[Webhook] ${instance} is DISCONNECTED.`);
            }
            return new Response('ok', { headers: corsHeaders });
        }

        // --- MESSAGE PROCESSING ---
        if (eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert') {
            const fromMe = data.key?.fromMe;
            const remoteJid = data.key?.remoteJid;
            if (!remoteJid) return new Response('ok', { headers: corsHeaders });

            const { data: profile } = await supabaseAdmin.from('profiles').select('id, ai_auto_reply_enabled, whatsapp_boss_group_id').eq('whatsapp_instance_id', instance).single();
            if (!profile) return new Response('ok', { headers: corsHeaders });

            // Extract content
            let msgText = data.message?.conversation || data.message?.extendedTextMessage?.text || data.message?.imageMessage?.caption || "";
            const audioBase64 = payload.base64 || data.message?.audioMessage?.base64 || "";

            // Save to DB
            const { data: insertedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: profile.id,
                phone: remoteJid.split('@')[0],
                message: msgText || (audioBase64 ? "[Mensagem de Voz]" : "[Mídia]"),
                direction: fromMe ? 'sent' : 'received',
                status: 'delivered',
                client_name: data.pushName || null
            }).select('id').single();

            // AI Logic
            if (!fromMe && (profile.ai_auto_reply_enabled)) {
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-response-generator`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: profile.id,
                        message: msgText,
                        audio_base64: audioBase64,
                        db_message_id: insertedMsg?.id,
                        customer_phone: remoteJid.replace(/@.+/, ''),
                        customer_name: data.pushName || 'Cliente'
                    })
                }).catch(() => { });
            }
        }

        return new Response('ok', { headers: corsHeaders });
    } catch (e) {
        return new Response('error', { headers: corsHeaders, status: 500 });
    }
});
