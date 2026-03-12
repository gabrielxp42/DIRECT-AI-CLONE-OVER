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
        let profile: any = null;
        try { payload = JSON.parse(rawBody); } catch (e) { }

        const eventType = payload.event || payload.event_type;
        const instance = payload.instance || payload.instanceId || payload.instance_id;
        const data = payload.data;

        console.log(`[Webhook] Event: ${eventType}, Instance: ${instance}`);

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

        // --- DEBUG LOGGING ---
        if (eventType !== 'WEBHOOK_CONNECTED') {
            await supabaseAdmin.from('system_logs').insert({
                level: 'info',
                category: 'webhook_debug',
                message: `Webhook received: ${eventType} from ${instance}`,
                details: {
                    payload_summary: {
                        event: eventType,
                        instance: instance,
                        has_data: !!data,
                        remoteJid: data?.key?.remoteJid,
                        fromMe: data?.key?.fromMe
                    },
                    full_payload: payload // Cuidado com o tamanho, mas para debug agora é essencial
                }
            });
        }

        if (!payload || !eventType || !instance) {
            return new Response(JSON.stringify({
                status: 'ok',
                message: 'Missing payload, eventType or instance',
                debug: { eventType, instance }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

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
            return new Response(JSON.stringify({
                status: 'ok',
                message: 'Connection update processed',
                debug: { eventType, instance, state }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // --- MESSAGE PROCESSING ---
        if (eventType === 'MESSAGES_UPSERT' || eventType === 'messages.upsert') {
            const fromMe = data.key?.fromMe;
            const remoteJid = data.key?.remoteJid;
            if (!remoteJid) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    message: 'Missing remoteJid',
                    debug: { eventType, instance }
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            let profile: any = null;
            const { data: p } = await supabaseAdmin.from('profiles').select('id, phone, ai_auto_reply_enabled, whatsapp_boss_group_id, operator_phone').eq('whatsapp_instance_id', instance).single();
            profile = p;
            if (!profile) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    message: 'Profile not found',
                    debug: { eventType, instance }
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

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

            // AI Logic: Respond if it's NOT from me AND AI is enabled AND it's the Boss's conversation (private or group)
            const isGroup = remoteJid.includes('@g.us');

            // Identificação do "Patrão" (Gestor/Grupo de Gestão)
            const jidDigits = remoteJid.split('@')[0].replace(/\D/g, '');
            const bossSettingNormalized = profile.whatsapp_boss_group_id?.replace(/\D/g, '') || "";
            const operatorDigits = profile.operator_phone?.replace(/\D/g, '') || "";
            const profilePhoneDigits = profile.phone?.replace(/\D/g, '') || "";

            const isBoss = (bossSettingNormalized && jidDigits.endsWith(bossSettingNormalized.slice(-8))) ||
                (operatorDigits && jidDigits.endsWith(operatorDigits.slice(-8))) ||
                (profilePhoneDigits && jidDigits.endsWith(profilePhoneDigits.slice(-8)));

            const customer_name = isBoss ? "Chefe" : (data.pushName || remoteJid.split('@')[0]);

            console.log(`[Webhook] isBoss: ${isBoss}, jidDigits: ${jidDigits}, target: ${bossSettingNormalized || operatorDigits}`);
            console.log(`[Webhook] AutoReply: ${profile.ai_auto_reply_enabled}, fromMe: ${fromMe}`);

            // GABI responde se: 
            // 1. Não fui eu quem mandou
            // 2. A auto-resposta está ligada OU é o Patrão falando (GABI Executiva)
            if (!fromMe && (profile.ai_auto_reply_enabled || isBoss)) {
                console.log(`[Webhook] TRIGGERING GABI RESPONSE for ${customer_name}...`);

                await supabaseAdmin.functions.invoke('ai-response-generator', {
                    body: {
                        user_id: profile.id,
                        customer_phone: remoteJid,
                        message: msgText,
                        audio_base64: audioBase64,
                        quoted_message: quotedText,
                        db_message_id: insertedMsg?.id,
                        customer_name,
                        is_boss: isBoss,
                        platform: 'whatsapp'
                    }
                });
            } else {
                console.log(`[Webhook] IGNORED. fromMe: ${fromMe}, enabled: ${profile.ai_auto_reply_enabled}, isBoss: ${isBoss}`);
            }
        }

        return new Response(JSON.stringify({
            status: 'ok',
            debug: { eventType, instance, profileId: profile?.id }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error("[Webhook Error]", e);
        return new Response('error', { headers: corsHeaders, status: 500 });
    }
});
