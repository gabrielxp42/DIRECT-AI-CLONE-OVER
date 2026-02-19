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
        const url = new URL(req.url);
        const action = url.pathname.split('/').pop() || 'status'; // default action
        const body = await req.json().catch(() => ({}));

        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        // 2. Get Global Config (Admin)
        // We use Service Role Key to bypass RLS and read admin config secure logic
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: adminProfile, error: adminError } = await supabaseAdmin
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .neq('whatsapp_api_url', null)
            .limit(1)
            .single();

        if (adminError || !adminProfile) throw new Error("System WhatsApp API not configured");

        // 3. Valida Plus Mode do usuário solicitante
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('is_whatsapp_plus_active, is_admin, subscription_tier')
            .eq('id', user.id)
            .single();

        const isPlusActive = userProfile?.is_whatsapp_plus_active || userProfile?.is_admin || userProfile?.subscription_tier === 'expert';

        if (!isPlusActive && body.action !== 'status') {
            return new Response(JSON.stringify({
                error: true,
                message: "WhatsApp Plus não está ativo no seu plano. Faça o upgrade para usar esta função.",
                isPlusRequired: true
            }), { status: 200, headers: corsHeaders });
        }

        const EVOLUTION_URL = adminProfile.whatsapp_api_url.replace(/\/$/, ""); // Remove trailing slash
        const EVOLUTION_KEY = adminProfile.whatsapp_api_key;

        // Custom fetch wrapper with timeout
        const fetchWithTimeout = async (resource: string, options: RequestInit = {}, timeout = 50000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(resource, {
                    ...options,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(id);
            }
        };

        // Safe JSON parse — handles HTML error pages (502, 503 from nginx)
        const safeJsonParse = async (resp: Response): Promise<any> => {
            const text = await resp.text();
            try {
                return JSON.parse(text);
            } catch {
                console.error(`[Proxy] Non-JSON response (${resp.status}):`, text.substring(0, 200));
                return { error: true, message: `Servidor retornou erro ${resp.status}. Tente novamente em alguns segundos.`, _rawStatus: resp.status };
            }
        };

        const sanitizeInstanceName = (name: string) => {
            return name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove accents
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_") // Only a-z, 0-9 and _
                .replace(/^_+|_+$/g, ""); // Remove trailing/leading underscores
        };

        let result;

        // 3. Handle Actions
        if (body.action === 'create') {
            const rawInstanceId = body.instanceName || `user_${user.id.substring(0, 8)}`;
            const instanceId = sanitizeInstanceName(rawInstanceId);
            const forceReset = body.force === true;
            console.log(`Proxied Create Request for ${instanceId} (v2) | Force: ${forceReset}`);

            try {
                // Se for forceReset, tenta deletar antes de criar
                if (forceReset) {
                    console.log(`[Proxy] Force reset requested for ${instanceId}. Deleting...`);
                    try {
                        // Tentar logout e delete (fail-soft se a instância não existir)
                        await fetchWithTimeout(`${EVOLUTION_URL}/instance/logout/${instanceId}`, {
                            method: 'DELETE',
                            headers: { 'apikey': EVOLUTION_KEY }
                        }, 5000).catch(() => { });
                        await fetchWithTimeout(`${EVOLUTION_URL}/instance/delete/${instanceId}`, {
                            method: 'DELETE',
                            headers: { 'apikey': EVOLUTION_KEY }
                        }, 5000).catch(() => { });
                    } catch (e) {
                        console.warn("[Proxy] Pre-creation delete failed:", e);
                    }

                    // Limpa o banco para garantir que o polling entenda que resetou
                    await supabaseAdmin
                        .from('profiles')
                        .update({ whatsapp_status: 'disconnected', whatsapp_instance_id: null })
                        .eq('id', user.id);
                }

                // Primeiro, verifica se já existe e qual o status (se não for force)
                let checkData: any = {};
                if (!forceReset) {
                    const checkResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, {
                        headers: { 'apikey': EVOLUTION_KEY }
                    });
                    if (checkResp.ok) {
                        checkData = await checkResp.json();
                    }
                }

                // Shared Webhook Configuration Logic
                const configureWebhook = async () => {
                    try {
                        const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
                        console.log(`[Proxy] Configuring Webhook for ${instanceId} -> ${WEBHOOK_URL}`);

                        await fetchWithTimeout(`${EVOLUTION_URL}/webhook/set/${instanceId}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': EVOLUTION_KEY
                            },
                            body: JSON.stringify({
                                webhook: {
                                    enabled: true,
                                    url: WEBHOOK_URL,
                                    webhookByEvents: true,
                                    events: ["MESSAGES_UPSERT"]
                                }
                            })
                        });
                    } catch (webhookErr) {
                        console.error("[Proxy] Warning: Failed to set webhook:", webhookErr);
                    }
                };

                if (!forceReset && checkData.instance?.state === 'open') {
                    // Instance exists and is open
                    // FORCE WEBHOOK CONFIGURATION (To update URL or Enable it)
                    await configureWebhook();

                    // Update DB and return
                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            whatsapp_instance_id: instanceId,
                            whatsapp_instance_token: user.id.replace(/-/g, ""),
                            whatsapp_status: 'connected'
                        })
                        .eq('id', user.id);

                    result = { instance: { state: 'open' }, status: 'connected' };
                } else {
                    // Create new instance
                    const createResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': EVOLUTION_KEY
                        },
                        body: JSON.stringify({
                            instanceName: instanceId,
                            token: user.id.replace(/-/g, ""),
                            qrcode: true,
                            integration: "WHATSAPP-BAILEYS"
                        })
                    });

                    const createData = await safeJsonParse(createResp);

                    // Detectar se a instância já existe (Evolution v2 retorna 403, 409, ou mensagem com "already")
                    const errorStr = typeof createData.error === 'string' ? createData.error : (typeof createData.message === 'string' ? createData.message : '');
                    const alreadyExists = createResp.status === 403 || createResp.status === 409 || errorStr.toLowerCase().includes('already');

                    if (alreadyExists) {
                        // Fallback: Tentativa de conexão para instâncias existentes
                        console.log(`[Proxy] Instance ${instanceId} already exists. Trying connect...`);
                        const connectResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connect/${instanceId}`, {
                            headers: { 'apikey': EVOLUTION_KEY }
                        });
                        result = await safeJsonParse(connectResp);
                        // Normalizar: se o base64 estiver na raiz, mover para qrcode.base64
                        if (result.base64 && !result.qrcode?.base64) {
                            result.qrcode = { base64: result.base64, count: 1 };
                        }
                    } else if (!createResp.ok) {
                        // Error handling
                        console.error("Evolution v2 Error Details:", JSON.stringify(createData));
                        result = {
                            error: true,
                            message: typeof createData.message === 'string' ? createData.message : (typeof createData.error === 'string' ? createData.error : JSON.stringify(createData)),
                            details: createData
                        };
                    } else {
                        result = createData;

                        // SE gerou sem QR (count: 0) ou sem base64, força connect com retries
                        if ((result.qrcode && result.qrcode.count === 0) || !result.qrcode?.base64) {
                            console.log(`[Proxy] QR Code empty or count 0 for ${instanceId}. Retrying connect...`);

                            // Retry connect até 3x com delay entre tentativas
                            for (let attempt = 1; attempt <= 3; attempt++) {
                                // Aguarda um pouco para a Evolution processar
                                await new Promise(resolve => setTimeout(resolve, 2000));

                                console.log(`[Proxy] Connect attempt ${attempt}/3 for ${instanceId}...`);
                                try {
                                    const wakeResp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connect/${instanceId}`, {
                                        headers: { 'apikey': EVOLUTION_KEY }
                                    });
                                    const wakeData = await safeJsonParse(wakeResp);
                                    console.log(`[Proxy] Connect attempt ${attempt} result:`, JSON.stringify(wakeData).substring(0, 200));

                                    if (wakeData.base64 || wakeData.qrcode?.base64) {
                                        // Sucesso! QR Code retornado
                                        result = wakeData;
                                        // Normalizar: se o base64 estiver na raiz, mover para qrcode.base64
                                        if (wakeData.base64 && !result.qrcode?.base64) {
                                            result.qrcode = { base64: wakeData.base64, count: 1 };
                                        }
                                        console.log(`[Proxy] QR Code obtained on attempt ${attempt}!`);
                                        break;
                                    }
                                } catch (connectErr) {
                                    console.warn(`[Proxy] Connect attempt ${attempt} failed:`, connectErr);
                                }
                            }
                        }
                    }

                    // Configure Webhook for new instance
                    await configureWebhook();

                    // Se gerou QR ou conectou, marca como 'connecting' inicialmente (ou connected se open)
                    const finalStatus = (result.instance?.state === 'open' || result.instance?.status === 'open') ? 'connected' : 'connecting';

                    if (result.instance?.instanceName || result.qrcode) {
                        await supabaseAdmin
                            .from('profiles')
                            .update({
                                whatsapp_instance_id: instanceId,
                                whatsapp_instance_token: user.id.replace(/-/g, ""),
                                whatsapp_status: finalStatus
                            })
                            .eq('id', user.id);
                    }
                }
            } catch (err: any) {
                console.error("Critical Failure in createInstance proxy:", err);
                result = { error: true, message: "Exceção ao criar instância", details: err.message };
            }

        } else if (body.action === 'update-status') {
            // Nova ação para o frontend pollar e atualizar o banco quando o usuário escanear

            // 1. Tenta pegar o ID real do banco primeiro para evitar erros de nomenclatura
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('whatsapp_instance_id')
                .eq('id', user.id)
                .single();

            const rawInstanceId = body.instanceName || profile?.whatsapp_instance_id || `user_${user.id.substring(0, 8)}`;
            const instanceId = sanitizeInstanceName(rawInstanceId);
            console.log(`Checking status for instance: ${instanceId}`);

            try {
                const resp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, {
                    headers: { 'apikey': EVOLUTION_KEY }
                });

                if (!resp.ok) {
                    // Se a instância não existe na Evolution, retorna desconectado
                    result = { connected: false, state: 'not_found' };
                    // Sincroniza banco
                    await supabaseAdmin
                        .from('profiles')
                        .update({ whatsapp_status: 'disconnected' })
                        .eq('id', user.id);
                } else {
                    const data = await resp.json();
                    const isOpen = data.instance?.state === 'open';

                    // SEMPRE sincroniza o status com o banco para evitar "falsos conectados"
                    const currentStatus = isOpen ? 'connected' : 'connecting';
                    await supabaseAdmin
                        .from('profiles')
                        .update({ whatsapp_status: currentStatus })
                        .eq('id', user.id);

                    result = { state: data.instance?.state, connected: isOpen };
                }
            } catch (err: any) {
                result = { error: true, message: err.message };
            }

        } else if (body.action === 'delete') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('whatsapp_instance_id')
                .eq('id', user.id)
                .single();

            if (profile?.whatsapp_instance_id) {
                try {
                    // Na v2, logout e delete usam os mesmos endpoints
                    await fetchWithTimeout(`${EVOLUTION_URL}/instance/logout/${profile.whatsapp_instance_id}`, {
                        method: 'DELETE',
                        headers: { 'apikey': EVOLUTION_KEY }
                    }, 5000).catch(() => { });

                    await fetchWithTimeout(`${EVOLUTION_URL}/instance/delete/${profile.whatsapp_instance_id}`, {
                        method: 'DELETE',
                        headers: { 'apikey': EVOLUTION_KEY }
                    }, 5000).catch(() => { });

                    // Espera a Evolution limpar a sessão para evitar "count: 0" na recriação
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (e) {
                    console.error("Delete failed:", e);
                }

                await supabaseAdmin
                    .from('profiles')
                    .update({
                        whatsapp_instance_id: null,
                        whatsapp_instance_token: null,
                        whatsapp_status: 'disconnected'
                    })
                    .eq('id', user.id);
            }
            result = { success: true };

        } else if (body.action === 'send-text') {
            // Nova ação para envio direto via Gabi AI
            const { phone, message } = body;

            if (!phone || !message) {
                return new Response(JSON.stringify({ error: true, message: "Telefone e mensagem são obrigatórios" }), { status: 400, headers: corsHeaders });
            }

            // Validar se o usuário tem instância conectada
            const { data: senderProfile } = await supabaseAdmin
                .from('profiles')
                .select('whatsapp_instance_id, whatsapp_status')
                .eq('id', user.id)
                .single();

            if (!senderProfile || senderProfile.whatsapp_status === 'disconnected' || !senderProfile.whatsapp_instance_id) {
                return new Response(JSON.stringify({ error: true, message: "Instância não conectada" }), { status: 400, headers: corsHeaders });
            }

            try {
                // Sanitizar e formatar o telefone (Pattern do send-whatsapp-notification)
                let cleanPhone = phone.replace(/\D/g, "");
                if (cleanPhone.length === 11 && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
                if (cleanPhone.length === 10 && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

                const sendUrl = `${EVOLUTION_URL}/message/sendText/${senderProfile.whatsapp_instance_id}`;
                console.log(`[Proxy] Sending text to ${cleanPhone} via ${senderProfile.whatsapp_instance_id}`);

                const resp = await fetchWithTimeout(sendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_KEY
                    },
                    body: JSON.stringify({
                        number: cleanPhone,
                        text: message,
                        linkPreview: false
                    })
                }, 50000);

                const data = await safeJsonParse(resp);

                if (resp.ok && !data.error) {
                    result = { success: true, data };
                } else {
                    console.error("Evolution Send Error:", data);

                    // FALLBACK: Tenta com o + se falhou sem
                    if (resp.status === 400 || (data.message && data.message.includes("number"))) {
                        console.log("[Proxy] Text retry with + prefix...");
                        const retryResp = await fetchWithTimeout(sendUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                            body: JSON.stringify({
                                number: "+" + cleanPhone,
                                text: message,
                                linkPreview: false
                            })
                        }, 50000);
                        const retryData = await safeJsonParse(retryResp);
                        if (retryResp.ok && !retryData.error) {
                            return new Response(JSON.stringify({ success: true, data: retryData }), { headers: corsHeaders });
                        }
                    }

                    let detailedError = data?.response?.message || data?.message || "Erro ao enviar mensagem";
                    result = { error: true, message: `Evolution: ${detailedError}`, details: data };
                }
            } catch (err: any) {
                console.error("Proxy Send Exception:", err);
                result = { error: true, message: err.message };
                console.error("Proxy Send Exception:", err);
                result = { error: true, message: err.message };
            }

        } else if (body.action === 'send-media') {
            // Nova ação para envio de mídia (PDF, Imagem)
            const { phone, message, mediaBase64, mediaName, mediaType, mimetype, mediatype } = body;

            if (!phone || (!mediaBase64 && !body.mediaUrl)) {
                return new Response(JSON.stringify({ error: true, message: "Telefone e mídia são obrigatórios" }), { status: 400, headers: corsHeaders });
            }

            const { data: senderProfile } = await supabaseAdmin
                .from('profiles')
                .select('whatsapp_instance_id, whatsapp_status')
                .eq('id', user.id)
                .single();

            if (!senderProfile || senderProfile.whatsapp_status === 'disconnected' || !senderProfile.whatsapp_instance_id) {
                return new Response(JSON.stringify({ error: true, message: "Instância não conectada" }), { status: 400, headers: corsHeaders });
            }

            try {
                let cleanPhone = phone.replace(/\D/g, "");
                // Garante o 55 se o número tiver 10 ou 11 dígitos
                if (cleanPhone.length === 11 && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
                if (cleanPhone.length === 10 && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;

                // Adiciona o '+' visto no n8n do usuário para máxima compatibilidade
                const phoneWithPlus = cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone;

                // Decisão do endpoint
                // O endpoint sendDocument retornou 404, então vamos forçar sendMedia
                const isDoc = (mediaType === 'document' || mediatype === 'document' || (mediaName && mediaName.endsWith('.pdf')));
                const endpoint = 'sendMedia';
                const sendUrl = `${EVOLUTION_URL}/message/${endpoint}/${senderProfile.whatsapp_instance_id}`;

                // Garantir que o nome do arquivo SEMPRE exista (obrigatório para Base64)
                const finalFileName = mediaName || `documento_${Date.now()}.pdf`;
                console.log(`[Proxy] Sending ${isDoc ? 'document' : 'media'} to ${phoneWithPlus} via ${endpoint} | FileName: ${finalFileName}`);

                // ESTRATÉGIA v44: Raw Base64 (Sem Prefixo)
                // O erro "Owned media must be a url or base64" sugere que o endpoint rejeita Data URIs.
                // Vamos enviar apenas o conteúdo Base64 puro.

                let mediaContent = "";
                if (mediaBase64 || body.mediaUrl) {
                    // PRIORIDADE 1: URL (Mais leve para a Edge Function e mais estável na Evolution)
                    if (body.mediaUrl) {
                        mediaContent = body.mediaUrl;
                        console.log(`[Proxy] v45: Using Media URL: ${body.mediaUrl}`);
                    } else if (mediaBase64) {
                        // PRIORIDADE 2: Base64 (Remover prefixo se houver)
                        mediaContent = mediaBase64.includes('base64,') ? mediaBase64.split('base64,')[1] : mediaBase64;
                        console.log(`[Proxy] v45: Using Base64. Length: ${mediaContent.length}`);
                    }
                }

                if (!mediaContent) {
                    return new Response(JSON.stringify({ error: true, message: "Mídia obrigatória (Base64 ou URL)" }), { status: 400, headers: corsHeaders });
                }

                // PAYLOAD v46: Compatibilidade Total (Envia os dois padroes: Camel + Lower)
                // Algumas versoes da v2 exigem "mediatype" (lower), outras "mediaType" (camel)
                let payload: any = {
                    number: cleanPhone,
                    mediaType: isDoc ? "document" : (mediaType || mediatype || "image"),
                    mediatype: isDoc ? "document" : (mediaType || mediatype || "image"), // Fallback duplicado
                    mimeType: mimetype || "application/pdf",
                    mimetype: mimetype || "application/pdf", // Fallback duplicado
                    caption: message || "",
                    media: mediaContent,
                    fileName: finalFileName,
                    delay: 1200
                };

                console.log(`[Proxy] v46 Payload prepared for ${finalFileName} to ${cleanPhone}`);

                const resp = await fetchWithTimeout(sendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                    body: JSON.stringify(payload)
                }, 50000);

                const data = await safeJsonParse(resp);
                console.log(`[Proxy] Evolution Response status=${resp.status}`, data);

                if (resp.ok && !data.error) {
                    result = { success: true, data };
                } else {
                    console.error("Evolution Send Media Error:", data);

                    // FALLBACK: Se falhou sem o +, tenta com o + (Algumas instâncias v2 exigem)
                    if (resp.status === 400 || (data.message && data.message.includes("number"))) {
                        console.log("[Proxy] Retrying with + prefix...");
                        payload.number = "+" + cleanPhone;
                        const retryResp = await fetchWithTimeout(sendUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                            body: JSON.stringify(payload)
                        }, 50000);
                        const retryData = await safeJsonParse(retryResp);
                        if (retryResp.ok && !retryData.error) {
                            return new Response(JSON.stringify({ success: true, data: retryData }), { headers: corsHeaders });
                        }
                    }

                    // Se falhou tudo, retorna o erro amigável
                    let detailedError = data?.response?.message || data?.message || "Erro no envio de mídia";
                    if (detailedError.includes("Connection Closed") || detailedError.includes("not open")) {
                        detailedError = "Sua conexão com o WhatsApp caiu. Por favor, reconecte.";
                    }
                    result = { error: true, message: `Evolution: ${detailedError}`, details: data };
                }
            } catch (err: any) {
                console.error("Proxy Send Media Exception:", err);
                result = { error: true, message: `Exception: ${err.message}` };
            }

        } else if (body.action === 'check-connection') {
            console.log("Checking connection to Evolution API v2...");
            try {
                // Na v2.x, o endpoint mais comum para listar todas as instâncias é /instance/fetchInstances
                const resp = await fetchWithTimeout(`${EVOLUTION_URL}/instance/fetchInstances`, {
                    headers: { 'apikey': EVOLUTION_KEY }
                });

                if (resp.ok) {
                    const data = await resp.json();
                    result = { status: 'ok', data };
                } else {
                    const text = await resp.text();
                    let details;
                    try { details = JSON.parse(text); } catch { details = text; }
                    result = { status: 'error', message: `Evolution API: ${resp.status}`, details };
                }
            } catch (err: any) {
                result = { status: 'error', message: "Falha na rede/DNS", details: err.message };
            }

        } else if (body.action === 'configure-webhook') {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('whatsapp_instance_id')
                .eq('id', user.id)
                .single();

            const instanceId = body.instanceName || profile?.whatsapp_instance_id;
            if (!instanceId) throw new Error("Instance ID not found");

            const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
            console.log(`[Proxy] FORCE Configuring Webhook for ${instanceId} -> ${WEBHOOK_URL}`);

            // Evolution v2 often uses this structure for /webhook/set/{instanceId}
            const payload = {
                webhook: {
                    enabled: true,
                    url: WEBHOOK_URL,
                    webhookByEvents: false,
                    events: ["MESSAGES_UPSERT"]
                }
            };

            console.log(`[Proxy] Sending payload to Evolution: ${JSON.stringify(payload)}`);

            const resp = await fetchWithTimeout(`${EVOLUTION_URL}/webhook/set/${instanceId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_KEY
                },
                body: JSON.stringify(payload)
            });

            const data = await resp.json();
            if (!resp.ok) {
                result = { error: true, message: "Failed to configure webhook", details: data };
            } else {
                result = { success: true, data };
            }

        } else if (body.action === 'status') {
            result = { status: 'ok' };
        } else {
            result = { error: true, message: "Ação inválida: " + body.action };
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("CRITICAL_PROXY_ERROR:", error);
        return new Response(JSON.stringify({
            error: true,
            message: "Erro Crítico no Proxy",
            details: error.message
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
