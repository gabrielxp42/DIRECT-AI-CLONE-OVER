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

        let result;

        // 3. Handle Actions
        if (body.action === 'create') {
            const instanceId = body.instanceName || `user_${user.id.substring(0, 8)}`;
            console.log(`Proxied Create Request for ${instanceId} (v2)`);

            try {
                // Primeiro, verifica se já existe e qual o status
                const checkResp = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, {
                    headers: { 'apikey': EVOLUTION_KEY }
                });
                const checkData = await checkResp.json();

                // Shared Webhook Configuration Logic
                const configureWebhook = async () => {
                    try {
                        const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
                        console.log(`[Proxy] Configuring Webhook for ${instanceId} -> ${WEBHOOK_URL}`);

                        await fetch(`${EVOLUTION_URL}/webhook/set/${instanceId}`, {
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

                if (checkData.instance?.state === 'open') {
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
                    const createResp = await fetch(`${EVOLUTION_URL}/instance/create`, {
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

                    const createData = await createResp.json();

                    if (createResp.status === 403 || (createData.error && createData.error.includes("already exists"))) {
                        // ....
                        // Existing connection logic fallback
                        const connectResp = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceId}`, {
                            headers: { 'apikey': EVOLUTION_KEY }
                        });
                        result = await connectResp.json();
                    } else if (!createResp.ok) {
                        // Error handling
                        console.error("Evolution v2 Error Details:", createData);
                        result = {
                            error: true,
                            message: createData.message || "Erro na Evolution API v2",
                            details: createData
                        };
                    } else {
                        result = createData;
                    }

                    // Configure Webhook for new instance
                    await configureWebhook();


                    // AUTO-CONFIGURE WEBHOOK
                    // Ensure the instance sends messages to our Supabase Webhook
                    try {
                        const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;
                        console.log(`[Proxy] Configuring Webhook for ${instanceId} -> ${WEBHOOK_URL}`);

                        await fetch(`${EVOLUTION_URL}/webhook/set/${instanceId}`, {
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
                        // Don't fail the whole request just because of webhook (fail-soft)
                    }

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

            const instanceId = body.instanceName || profile?.whatsapp_instance_id || `user_${user.id.substring(0, 8)}`;
            console.log(`Checking status for instance: ${instanceId}`);

            try {
                const resp = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceId}`, {
                    headers: { 'apikey': EVOLUTION_KEY }
                });

                if (!resp.ok) {
                    // Se a instância não existe na Evolution, retorna desconectado
                    result = { connected: false, state: 'not_found' };
                } else {
                    const data = await resp.json();
                    const isOpen = data.instance?.state === 'open';

                    if (isOpen) {
                        await supabaseAdmin
                            .from('profiles')
                            .update({ whatsapp_status: 'connected' })
                            .eq('id', user.id);
                    }
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
                    await fetch(`${EVOLUTION_URL}/instance/logout/${profile.whatsapp_instance_id}`, {
                        method: 'DELETE',
                        headers: { 'apikey': EVOLUTION_KEY }
                    });
                    await fetch(`${EVOLUTION_URL}/instance/delete/${profile.whatsapp_instance_id}`, {
                        method: 'DELETE',
                        headers: { 'apikey': EVOLUTION_KEY }
                    });
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

                const resp = await fetch(sendUrl, {
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
                });

                const data = await resp.json();

                if (resp.ok) {
                    result = { success: true, data };
                } else {
                    console.error("Evolution Send Error:", data);
                    result = { error: true, message: "Erro ao enviar mensagem", details: data };
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

                if (mediaBase64) {
                    // Remover prefixo se houver
                    mediaContent = mediaBase64.includes('base64,') ? mediaBase64.split('base64,')[1] : mediaBase64;
                    console.log(`[Proxy] v44: Using Frontend Base64 (Raw). Length: ${mediaContent.length}`);
                } else if (body.mediaUrl) {
                    mediaContent = body.mediaUrl;
                    console.log(`[Proxy] v44: Fallback to URL string: ${body.mediaUrl}`);
                }

                if (!mediaContent) {
                    return new Response(JSON.stringify({ error: true, message: "Mídia obrigatória (Base64 ou URL)" }), { status: 400, headers: corsHeaders });
                }

                let payload: any = {
                    number: phoneWithPlus,
                    mediatype: "document",
                    mimetype: "application/pdf",
                    caption: message || "",
                    media: mediaContent,
                    fileName: finalFileName
                };

                console.log(`[Proxy] v44 Payload prepared for ${finalFileName}`);

                const resp = await fetch(sendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
                    body: JSON.stringify(payload)
                });

                const data = await resp.json();
                console.log(`[Proxy] Evolution Response status=${resp.status}`);

                if (resp.ok && !data.error) {
                    result = { success: true, data };
                } else {
                    console.error("Evolution Send Media Error:", data);
                    // Retornar a mensagem de erro REAL da evolution para facilitar o debug no frontend
                    const detailedError = data?.response?.message || data?.message || "Erro no envio de mídia";
                    result = {
                        error: true,
                        message: `Evolution: ${detailedError}`,
                        details: data
                    };
                }
            } catch (err: any) {
                console.error("Proxy Send Media Exception:", err);
                result = { error: true, message: `Exception: ${err.message}` };
            }

        } else if (body.action === 'check-connection') {
            console.log("Checking connection to Evolution API v2...");
            try {
                // Na v2.x, o endpoint mais comum para listar todas as instâncias é /instance/fetchInstances
                const resp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
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

            const resp = await fetch(`${EVOLUTION_URL}/webhook/set/${instanceId}`, {
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
