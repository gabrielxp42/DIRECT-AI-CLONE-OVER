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

            // REPLIES/QUOTED MESSAGES SUPPORT (Omniscient Gabi)
            let quotedText = "";
            const contextInfo = data.message?.extendedTextMessage?.contextInfo;
            if (contextInfo?.quotedMessage) {
                const qm = contextInfo.quotedMessage;
                quotedText = qm.conversation || qm.extendedTextMessage?.text || "[Mídia/Voz]";
                console.log(`[Webhook] User is replying to: "${quotedText.substring(0, 50)}..."`);
            }

            // Save to DB
            const { data: insertedMsg } = await supabaseAdmin.from('whatsapp_messages').insert({
                user_id: profile.id,
                phone: remoteJid.split('@')[0],
                message: msgText || (audioBase64 ? "[Mensagem de Voz]" : "[Mídia]"),
                direction: fromMe ? 'sent' : 'received',
                status: 'delivered',
                client_name: data.pushName || null,
                external_id: data.key?.id || null
            }).select('id').single();

            // AI Logic: ONLY respond if it's NOT from me AND AI is enabled AND it's the Boss's number
            const customerPhone = remoteJid.split('@')[0];
            const isBoss = (profile.whatsapp_boss_group_id && profile.whatsapp_boss_group_id.includes(customerPhone));

            if (!fromMe && profile.ai_auto_reply_enabled && isBoss) {
                console.log(`[Webhook] AI trigger for BOSS ${customerPhone}`);
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-response-generator`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: profile.id,
                        message: msgText,
                        audio_base64: audioBase64,
                        quoted_message: quotedText, // Pass along for context
                        db_message_id: insertedMsg?.id,
                        customer_phone: customerPhone,
                        customer_name: data.pushName || 'Boss',
                        is_boss: true
                    })
                }).catch((err) => { console.error("[Webhook] AI fetch failed:", err); });
            } else if (!fromMe && !isBoss) {
                console.log(`[Webhook] Message from customer (${customerPhone}) ignored for AI logic.`);
            }
        }

        return new Response('ok', { headers: corsHeaders });
    } catch (e) {
        return new Response('error', { headers: corsHeaders, status: 500 });
    }
});
