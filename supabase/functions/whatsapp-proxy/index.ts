import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json().catch(() => ({}));
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        // Busca um admin que tenha as configurações da Evolution API preenchidas
        const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .not('whatsapp_api_url', 'is', null)
            .not('whatsapp_api_key', 'is', null)
            .limit(1)
            .maybeSingle();

        if (!adminProfile?.whatsapp_api_url || !adminProfile?.whatsapp_api_key) {
            console.error("[Proxy] Configurações da Evolution API não encontradas em nenhum admin.");
            throw new Error("Sistema WhatsApp não configurado. O administrador precisa configurar a URL e API Key nas Configurações.");
        }

        const EVOLUTION_URL = adminProfile.whatsapp_api_url.replace(/\/$/, "");
        const EVOLUTION_KEY = adminProfile.whatsapp_api_key;

        const fetchWithTimeout = async (res: string, opt: RequestInit = {}, t = 15000) => {
            const ctrl = new AbortController();
            const id = setTimeout(() => ctrl.abort(), t);
            try { return await fetch(res, { ...opt, signal: ctrl.signal }); }
            finally { clearTimeout(id); }
        };

        const safeJson = async (r: Response) => {
            const t = await r.text();
            try { return JSON.parse(t); } catch { return { error: true }; }
        };

        const sanitize = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");

        let result: any = {};

        if (body.action === 'create') {
            const instanceId = sanitize(body.instanceName || `gabi_${user.id.substring(0, 8)}`);
            const force = body.force === true;

            // --- DEEP CLEAN BEFORE CREATE ---
            await fetchWithTimeout(`${EVOLUTION_URL}/instance/logout/${instanceId}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_KEY } }).catch(() => { });
            await fetchWithTimeout(`${EVOLUTION_URL}/instance/delete/${instanceId}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_KEY } }).catch(() => { });
            if (force) await new Promise(r => setTimeout(r, 2000));

            // --- CREATE WITH EVERYTHING EMBEDDED (NO LATER REBOOTS) ---
            const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
            const createBody = {
                instanceName: instanceId,
                token: user.id.replace(/-/g, ""),
                qrcode: true,
                integration: "WHATSAPP-BAILEYS",
                webhook: {
                    url: webhookUrl,
                    byEvents: true,
                    base64: false,
                    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "CHATS_SET", "CONTACTS_SET"]
                }
            };

            console.log(`[Proxy] Creating instance: ${instanceId}`);

            let resp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                body: JSON.stringify(createBody)
            });

            let data = await safeJson(resp);

            if (resp.status === 403 || resp.status === 409 || data.error) {
                console.log(`[Proxy] Instance might exist (${resp.status}), checking state before connect...`);
                // Primeiro vê se já está conectada
                const stateResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, { headers: { 'apikey': EVOLUTION_KEY } }).catch(() => null);
                const stateData = stateResp?.ok ? await stateResp.json() : null;
                const rawState = stateData?.instance?.state || stateData?.instance?.status;

                if (rawState === 'open' || rawState === 'CONNECTED') {
                    console.log(`[Proxy] Instance ${instanceId} is already OPEN.`);
                    result = { instance: { state: 'open' }, status: 'connected' };
                } else {
                    console.log(`[Proxy] Instance ${instanceId} is NOT open (${rawState}), attempting /connect...`);
                    const conn = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connect/${instanceId}`, { headers: { 'apikey': EVOLUTION_KEY } });
                    data = await safeJson(conn);
                    result = data;
                }
            } else {
                result = data;
            }

            // Normalize base64 QR (Evolution v2 structure)
            const b64 = result.qrcode?.base64 || result.base64 || result.code;
            if (b64) {
                result.qrcode = {
                    base64: b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`,
                    count: 1
                };
            }

            const isConnected = (result.status === 'connected' || result.instance?.state === 'open' || result.instance?.status === 'open');
            await supabaseAdmin.from('profiles').update({
                whatsapp_instance_id: instanceId,
                whatsapp_status: isConnected ? 'connected' : 'connecting',
                whatsapp_qr_cache: result.qrcode?.base64 || null
            }).eq('id', user.id);

        } else if (body.action === 'update-status') {
            const { data: profile } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id, whatsapp_qr_cache').eq('id', user.id).single();
            if (profile?.whatsapp_instance_id) {
                const instanceId = profile.whatsapp_instance_id;
                const stateResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, { headers: { 'apikey': EVOLUTION_KEY } }, 6000).catch(() => null);

                if (!stateResp || !stateResp.ok) {
                    result = { connected: false, state: 'not_found' };
                } else {
                    const stateData = await stateResp.json();
                    const rawState = stateData.instance?.state || stateData.instance?.status;

                    if (rawState === 'open' || rawState === 'CONNECTED') {
                        await supabaseAdmin.from('profiles').update({ whatsapp_status: 'connected', whatsapp_qr_cache: null }).eq('id', user.id);
                        result = { connected: true, state: 'open' };
                    } else if (rawState === 'connecting' || rawState === 'CONNECTING') {
                        // MANTÉM O HANDSHAKE: Não chama /connect. Apenas retorna o cache.
                        result = { connected: false, state: 'connecting', qrcode: profile.whatsapp_qr_cache };
                    } else {
                        // Apenas se estiver 'close', tenta gerar um novo QR
                        const connResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connect/${instanceId}`, { headers: { 'apikey': EVOLUTION_KEY } }, 8000).catch(() => null);
                        if (connResp) {
                            const connData = await safeJson(connResp);
                            const qr = connData.qrcode?.base64 || connData.base64;
                            if (qr) {
                                const b64 = qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
                                await supabaseAdmin.from('profiles').update({ whatsapp_qr_cache: b64 }).eq('id', user.id);
                                result = { connected: false, state: 'connecting', qrcode: b64 };
                            }
                        }
                    }
                }
            }
        } else if (body.action === 'delete') {
            const { data: p } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id').eq('id', user.id).single();
            if (p?.whatsapp_instance_id) {
                console.log(`[Proxy] Deep cleaning instance: ${p.whatsapp_instance_id}`);
                // v2: Tenta logout e depois delete
                await fetchWithTimeout(`${EVOLUTION_URL}/instance/logout/${p.whatsapp_instance_id}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_KEY } }).catch(() => { });
                await fetchWithTimeout(`${EVOLUTION_URL}/instance/delete/${p.whatsapp_instance_id}`, { method: 'DELETE', headers: { 'apikey': EVOLUTION_KEY } }).catch(() => { });

                await supabaseAdmin.from('profiles').update({
                    whatsapp_instance_id: null,
                    whatsapp_status: 'disconnected',
                    whatsapp_qr_cache: null
                }).eq('id', user.id);
            }
            result = { success: true };
        } else if (body.action === 'send-text') {
            const { data: p } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id').eq('id', user.id).single();
            let instanceId = p?.whatsapp_instance_id;

            if (!instanceId) {
                // Fallback to Admin instance
                const { data: admin } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id').eq('is_admin', true).not('whatsapp_instance_id', 'is', null).limit(1).single();
                instanceId = admin?.whatsapp_instance_id;
            }

            if (!instanceId) throw new Error("Nenhuma instância WhatsApp (própria ou admin) encontrada");

            const resp = await fetchWithTimeout(`${EVOLUTION_URL}/message/sendText/${instanceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                body: JSON.stringify({
                    number: body.phone,
                    text: body.message,
                    delay: 1200,
                    linkPreview: false
                })
            });
            result = await safeJson(resp);
            console.log(`[Proxy] Text sent to ${body.phone} via ${instanceId}, status: ${resp.status}`);
        } else if (body.action === 'send-media') {
            const { data: p } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id').eq('id', user.id).single();
            let instanceId = p?.whatsapp_instance_id;

            if (!instanceId) {
                // Fallback to Admin instance
                const { data: admin } = await supabaseAdmin.from('profiles').select('whatsapp_instance_id').eq('is_admin', true).not('whatsapp_instance_id', 'is', null).limit(1).single();
                instanceId = admin?.whatsapp_instance_id;
            }

            if (!instanceId) throw new Error("Nenhuma instância WhatsApp (própria ou admin) encontrada");

            const mediaPayload: any = {
                number: body.phone,
                mediatype: body.mediaType || 'image',
                caption: body.message || '',
                delay: 1500
            };

            // Prefere base64 se disponível para evitar depender de URLs externas/temporárias
            if (body.mediaBase64) {
                mediaPayload.media = body.mediaBase64;
            } else if (body.mediaUrl) {
                mediaPayload.media = body.mediaUrl;
            }

            if (body.mediaName) {
                mediaPayload.fileName = body.mediaName;
            }

            const resp = await fetchWithTimeout(`${EVOLUTION_URL}/message/sendMedia/${instanceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                body: JSON.stringify(mediaPayload)
            });
            result = await safeJson(resp);
            console.log(`[Proxy] Media sent to ${body.phone} via ${instanceId}, status: ${resp.status}`);
        } else {
            console.warn(`[Proxy] Unknown action: ${body.action}`);
            result = { error: true, message: `Ação desconhecida: ${body.action}` };
        }

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
