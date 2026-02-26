import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BASE_URL_PROD = "https://api.superfrete.com";
const BASE_URL_SANDBOX = "https://sandbox.superfrete.com";

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { action, params, isSandbox = false } = body;

        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        // 2. Get User Token and Wallet from Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('superfrete_token, superfrete_sandbox_token, email, wallet_balance')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");

        let token = isSandbox ? profile.superfrete_sandbox_token : profile.superfrete_token;
        let isMasterAccount = false;

        if (!token) {
            token = Deno.env.get('SUPERFRETE_MASTER_TOKEN');
            isMasterAccount = true;

            if (!token) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Logística indisponível. Token não configurado."
                }), { status: 200, headers: corsHeaders });
            }
        }

        const baseUrl = isSandbox ? BASE_URL_SANDBOX : BASE_URL_PROD;
        const userAgent = `DIRECT-AI-GB-1 (v1.0.0; ${profile.email || 'user@directai.com'})`;

        let endpoint = "";
        let method = "POST";
        let requestParams = typeof params === 'object' ? { ...params } : params;

        switch (action) {
            case 'calculate':
                endpoint = "/api/v0/calculator";
                // Superfrete expects package: { ... } but the UI sends params: { ... } or package: { ... }
                // Let's normalize it here to be safe
                const calcPackage = params.package || params.params || params;
                requestParams = {
                    from: params.from || { postal_code: params.originCEP },
                    to: params.to || { postal_code: params.destinationCEP },
                    package: calcPackage,
                    services: params.services || "1,2,17"
                };
                console.log("[Superfrete Proxy] Normalized Calculate Payload:", JSON.stringify(requestParams));
                break;
            case 'cart':
                endpoint = "/api/v0/cart";
                break;
            case 'checkout':
                endpoint = "/api/v0/checkout";
                if (typeof params === 'object') {
                    const orderId = params.id || (Array.isArray(params.orders) ? params.orders[0] : params.id);
                    requestParams = { orders: [orderId] };
                }
                break;
            case 'tracking': {
                let orderId = params?.orders?.[0] || params?.order_id || params?.id;

                // Se o ID parecer um UUID (ID do banco), buscar o external_id correspondente
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (orderId && uuidPattern.test(orderId)) {
                    console.log(`[Superfrete Tracking] Resolvendo UUID ${orderId} para external_id...`);
                    const adminClient = createClient(
                        Deno.env.get('SUPABASE_URL') ?? '',
                        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                    );
                    const { data: label } = await adminClient
                        .from('shipping_labels')
                        .select('external_id')
                        .eq('id', orderId)
                        .single();

                    if (label?.external_id) {
                        console.log(`[Superfrete Tracking] Resolved UUID to external_id: ${label.external_id}`);
                        orderId = label.external_id;
                    }
                }

                if (!orderId) throw new Error("ID da etiqueta não fornecido ou não encontrado");

                const payload = JSON.stringify({ order_id: String(orderId) });
                const base64Payload = btoa(payload);
                const permanentPdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;

                const trackUrl = `${baseUrl}/api/v0/order/info/${orderId}`;
                console.log(`[Superfrete Tracking] Calling: ${trackUrl}`);

                try {
                    const trackResponse = await fetch(trackUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'User-Agent': userAgent,
                            'Accept': 'application/json'
                        }
                    });

                    let responseText = await trackResponse.text();
                    console.log(`[Superfrete Tracking] Response Status: ${trackResponse.status}`);

                    if (trackResponse.ok) {
                        let trackData;
                        try {
                            trackData = JSON.parse(responseText);
                        } catch (e) {
                            // MODO GUERREIRO: Tentar extrair do HTML/Texto se falhar o JSON
                            const correiosMatch = responseText.match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                            const adiMatch = responseText.match(/(ADI\d{8,12}[A-Z]{0,2})/i);
                            const foundCode = correiosMatch?.[0] || adiMatch?.[0];

                            if (foundCode) {
                                return new Response(JSON.stringify({
                                    success: true,
                                    tracking_code: foundCode.toUpperCase(),
                                    message: "Extraído via fallback de texto",
                                    url: permanentPdfUrl,
                                }), {
                                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                    status: 200
                                });
                            }

                            return new Response(JSON.stringify({
                                error: true,
                                message: `A API do parceiro retornou um formato inesperado (${trackResponse.status}).`,
                                details: responseText.substring(0, 100),
                                url: permanentPdfUrl,
                            }), {
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                status: 200
                            });
                        }

                        // Tentar extrair o código de várias formas
                        let foundCode = null;
                        let orderData = trackData;

                        console.log(`[Superfrete Tracking] Processando resposta para ${orderId}`);

                        // 1. Tentar busca direta por ID
                        if (trackData[orderId]) {
                            orderData = trackData[orderId];
                        }
                        // 2. Se for um array (v0 às vezes retorna array de objetos)
                        else if (Array.isArray(trackData)) {
                            const match = trackData.find(item => String(item.order_id || item.id || item.tag) === String(orderId));
                            orderData = match || trackData[0];
                        }
                        // 3. Busca recursiva básica / Iterativa por chaves
                        else if (typeof trackData === 'object' && trackData !== null) {
                            // Se o orderId estiver em algum lugar como valor de uma chave 'id' ou 'order_id'
                            const keys = Object.keys(trackData);
                            for (const key of keys) {
                                const val = trackData[key];
                                if (val && typeof val === 'object') {
                                    if (String(val.order_id || val.id || val.tag) === String(orderId)) {
                                        orderData = val;
                                        break;
                                    }
                                }
                            }
                        }

                        // Função auxiliar para pegar código de um objeto
                        const extractFromObj = (obj: any) => {
                            if (!obj) return null;
                            const code = obj.tracking || obj.tracking_code || obj.tracking_number
                                || obj.codigo_rastreio || obj.objeto || obj.code || null;

                            if (typeof code === 'string') return code;
                            if (typeof code === 'object' && code !== null) {
                                return code.code || code.tracking_code || code.number || null;
                            }
                            return null;
                        };

                        foundCode = extractFromObj(orderData);

                        // 4. Fallback final: Se ainda não achou, varrer TODO o JSON por um padrão de Correios
                        if (!foundCode || typeof foundCode !== 'string' || foundCode.length < 5) {
                            const stringified = JSON.stringify(trackData);
                            // Padrão Correios: 2 letras + 9 dígitos + 2 letras
                            const correiosPattern = /([A-Z]{2}\d{9}[A-Z]{2})/i;
                            // Padrão Superfrete ADI: ADI + dígitos + letras
                            const adiPattern = /(ADI\d{8,12}[A-Z]{0,2})/i;

                            const coreiosMatch = stringified.match(correiosPattern);
                            if (coreiosMatch) {
                                foundCode = coreiosMatch[0].toUpperCase();
                                console.log(`[Superfrete Tracking] Código Correios extraído: ${foundCode}`);
                            } else {
                                const adiMatch = stringified.match(adiPattern);
                                if (adiMatch) {
                                    foundCode = adiMatch[0].toUpperCase();
                                    console.log(`[Superfrete Tracking] Código ADI extraído: ${foundCode}`);
                                }
                            }
                        }

                        const finalStatus = orderData?.status || orderData?.status_description || orderData?.tracking_status || null;
                        console.log(`[Superfrete Tracking] ID: ${orderId}, Status Extraído: ${finalStatus}, Código: ${foundCode}`);

                        if (foundCode && typeof foundCode === 'string') {
                            return new Response(JSON.stringify({
                                success: true,
                                tracking_code: foundCode,
                                status: finalStatus,
                                url: permanentPdfUrl,
                                pdf: permanentPdfUrl,
                                raw_status: orderData?.status || null, // Debug
                                raw_description: orderData?.status_description || null, // Debug
                                raw: trackData
                            }), {
                                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                                status: 200
                            });
                        }

                        return new Response(JSON.stringify({
                            error: true,
                            message: "Rastreio ainda não disponível na SuperFrete.",
                            debug_raw: JSON.stringify(trackData).substring(0, 500),
                            url: permanentPdfUrl,
                        }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                            status: 200
                        });
                    }

                    return new Response(JSON.stringify({
                        error: true,
                        message: `A API de rastreio respondeu com erro ${trackResponse.status}.`,
                        details: responseText.substring(0, 200),
                        url: permanentPdfUrl,
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200
                    });

                } catch (e: any) {
                    return new Response(JSON.stringify({
                        error: true,
                        message: `Falha na comunicação com o servidor de rastreio: ${e.message}`,
                        url: permanentPdfUrl,
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200
                    });
                }
            }
            default:
                throw new Error("Ação inválida");
        }

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': userAgent,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: method === 'GET' ? undefined : JSON.stringify(requestParams)
        });

        const responseText = await response.text();
        let result: any = {};
        if (responseText && responseText.trim().length > 0) {
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                result = { error: true, message: "Resposta da API inválida (não JSON)", details: responseText.substring(0, 100) };
            }
        }

        console.log(`[superfrete-proxy] Action: ${action}, Status: ${response.status}, IsArray: ${Array.isArray(result)}, Keys: ${typeof result === 'object' ? Object.keys(result).join(',') : 'N/A'}`);
        if (action === 'calculate') {
            console.log("[superfrete-proxy] Calculate response:", JSON.stringify(result).substring(0, 500));
        }

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: true,
                message: result.message || `Erro ${response.status} na API do parceiro`,
                details: result
            }), { status: 200, headers: corsHeaders });
        }

        // Handle Persistence for Checkout
        if (isMasterAccount && action === 'checkout' && !result.error) {
            const checkoutResult = Array.isArray(result) ? result[0] : result;
            const finalPrice = checkoutResult.price || params.price || 0;
            const tagId = checkoutResult.tag || checkoutResult.id || (Array.isArray(params.orders) ? params.orders[0] : params.id);

            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            if (finalPrice > 0) {
                const currentBalance = profile.wallet_balance || 0;
                await adminClient
                    .from('profiles')
                    .update({ wallet_balance: currentBalance - finalPrice })
                    .eq('id', user.id);

                await adminClient
                    .from('logistics_transactions')
                    .insert({
                        user_id: user.id,
                        amount: -finalPrice,
                        type: 'debit',
                        description: `Etiqueta Super Frete (Ref: ${tagId})`,
                        metadata: { action, result_id: tagId, pedido_id: params.pedido_id }
                    });
            }

            // Tentar extrair o código de rastreio de forma robusta
            let trackingCode = checkoutResult.tracking || checkoutResult.tracking_code || null;
            if (typeof trackingCode === 'object' && trackingCode !== null) {
                trackingCode = trackingCode.code || trackingCode.tracking_code || trackingCode.number || null;
            }

            // Fallback se não achou nos campos padrão
            if (!trackingCode || (typeof trackingCode === 'string' && trackingCode.length < 5)) {
                const stringified = JSON.stringify(checkoutResult);
                const correiosMatch = stringified.match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                if (correiosMatch) {
                    trackingCode = correiosMatch[0].toUpperCase();
                } else {
                    const adiMatch = stringified.match(/(ADI\d{8,12}[A-Z]{0,2})/i);
                    if (adiMatch) trackingCode = adiMatch[0].toUpperCase();
                }
            }
            const sfOrderId = checkoutResult.order_id || checkoutResult.id || tagId;
            let pdfUrl = checkoutResult.pdf || checkoutResult.url;

            if (!pdfUrl && sfOrderId) {
                const payload = JSON.stringify({ order_id: String(sfOrderId) });
                const base64Payload = btoa(payload);
                pdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;
            }

            await adminClient
                .from('shipping_labels')
                .insert({
                    user_id: user.id,
                    pedido_id: params.pedido_id || null,
                    external_id: String(sfOrderId),
                    status: 'released',
                    pdf_url: pdfUrl || null,
                    price: finalPrice,
                    tracking_code: trackingCode,
                    recipient_name: checkoutResult.to?.name || params.recipient_name || null,
                    service_name: checkoutResult.service?.name || params.service_name || null,
                    provider: 'superfrete'
                });

            if (params.pedido_id) {
                await adminClient
                    .from('pedidos')
                    .update({
                        shipping_label_status: 'released',
                        tracking_code: trackingCode
                    })
                    .eq('id', params.pedido_id);
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no servidor"
        }), { status: 200, headers: corsHeaders });
    }
});
