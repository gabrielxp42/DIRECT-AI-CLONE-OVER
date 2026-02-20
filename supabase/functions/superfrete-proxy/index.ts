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
                const orderId = params?.orders?.[0] || params?.order_id || params?.id;
                if (!orderId) throw new Error("ID da etiqueta não fornecido");

                const payload = JSON.stringify({ order_id: String(orderId) });
                const base64Payload = btoa(payload);
                const permanentPdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;

                try {
                    const trackResponse = await fetch(`${baseUrl}/api/v0/tracking`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'User-Agent': userAgent,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ orders: [String(orderId)] })
                    });

                    const responseText = await trackResponse.text();

                    if (trackResponse.ok) {
                        let trackData;
                        try {
                            trackData = JSON.parse(responseText);
                        } catch (e) {
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

                        const orderData = trackData[orderId] || trackData[Object.keys(trackData)[0]] || trackData;
                        let foundCode = orderData.tracking || orderData.tracking_code || orderData.tracking_number
                            || orderData.codigo_rastreio || orderData.objeto || orderData.code || null;

                        if (!foundCode) {
                            const stringified = JSON.stringify(trackData);
                            const correiosPattern = /([A-Z]{2,3}\d{8,11}[A-Z]{2})/i;
                            const match = stringified.match(correiosPattern);
                            if (match) {
                                foundCode = match[0].toUpperCase();
                            }
                        }

                        if (foundCode) {
                            return new Response(JSON.stringify({
                                success: true,
                                tracking_code: foundCode,
                                status: orderData.status || null,
                                url: permanentPdfUrl,
                                pdf: permanentPdfUrl,
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

            const trackingCode = checkoutResult.tracking || checkoutResult.tracking_code || null;
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
                    service_name: checkoutResult.service?.name || params.service_name || null
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
