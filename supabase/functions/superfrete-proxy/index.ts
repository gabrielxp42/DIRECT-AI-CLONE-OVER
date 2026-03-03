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
    // 0. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                ...corsHeaders,
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // Helper para facilitar o retorno com CORS
    const respond = (data: any, status = 200) => {
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    };

    try {
        const body = await req.json().catch(() => ({}));
        const { action, params, isSandbox = false } = body;

        console.log(`[SuperFrete Proxy] ${action.toUpperCase()} started`, { isSandbox, paramsKeys: params ? Object.keys(params) : 'none' });

        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error("[SuperFrete Proxy] Auth Error:", userError);
            throw new Error("Unauthorized");
        }

        // 2. Get User Token and Wallet from Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('superfrete_token, superfrete_sandbox_token, email, wallet_balance')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error("[SuperFrete Proxy] Profile Error:", profileError);
            throw new Error("User profile not found");
        }

        let token = isSandbox ? profile.superfrete_sandbox_token : profile.superfrete_token;
        let isMasterAccount = false;

        if (!token) {
            token = Deno.env.get('SUPERFRETE_MASTER_TOKEN');
            isMasterAccount = true;

            if (!token) {
                console.warn("[SuperFrete Proxy] No token provided by user and no MASTER_TOKEN found in env.");
                return new Response(JSON.stringify({
                    error: true,
                    message: "Logística indisponível. Token não configurado no servidor.",
                    needs_config: true
                }), { status: 200, headers: corsHeaders });
            }
        }

        const baseUrl = isSandbox ? BASE_URL_SANDBOX : BASE_URL_PROD;
        const userAgent = `DIRECT-AI-GB-1 (v1.0.1; ${profile.email || 'user@directai.com'})`;

        let endpoint = "";
        let method = "POST";
        let requestParams = typeof params === 'object' ? { ...params } : params;

        switch (action) {
            case 'calculate':
                endpoint = "/api/v0/calculator";
                const calcPackage = params.package || params.params || params;
                requestParams = {
                    from: params.from || { postal_code: params.originCEP },
                    to: params.to || { postal_code: params.destinationCEP },
                    package: calcPackage,
                    services: params.services || "1,2,17"
                };
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

                // Trata strings 'undefined' ou nulas vindas do frontend
                if (!orderId || orderId === 'undefined' || orderId === 'null') {
                    // Se não temos o ID externo, tentamos buscar no banco pelo pedido_id
                    const pedidoId = params.pedido_id;
                    if (pedidoId) {
                        const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                        const { data: label } = await adminClient.from('shipping_labels').select('external_id').eq('pedido_id', pedidoId).single();
                        if (label?.external_id) orderId = label.external_id;
                    }
                }

                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (orderId && uuidPattern.test(orderId)) {
                    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    const { data: label } = await adminClient.from('shipping_labels').select('external_id').eq('id', orderId).single();
                    if (label?.external_id) orderId = label.external_id;
                }

                if (!orderId || orderId === 'undefined') {
                    // Tenta uma última busca pelo pedido_id se disponível
                    const pedidoIdFallback = params?.pedido_id;
                    if (pedidoIdFallback) {
                        const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                        const { data: label } = await adminClient.from('shipping_labels').select('external_id').eq('pedido_id', pedidoIdFallback).single();
                        if (label?.external_id) orderId = label.external_id;
                    }
                }

                if (!orderId || orderId === 'undefined' || orderId === 'null') {
                    throw new Error("ID da etiqueta SuperFrete (external_id) não encontrado.");
                }
                endpoint = `/api/v0/order/info/${orderId}`;
                method = "GET";
                break;
            }
            default:
                throw new Error(`Ação '${action}' inválida`);
        }

        console.log(`[SuperFrete Proxy] Fetching ${baseUrl}${endpoint}`, { method });

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
                result = { error: true, message: "Resposta da API não é um JSON válido", details: responseText.substring(0, 200) };
            }
        }

        console.log(`[SuperFrete Proxy] API Status: ${response.status}`, { resultType: Array.isArray(result) ? 'array' : typeof result });

        if (!response.ok) {
            console.error("[SuperFrete Proxy] API Error Response:", result);
            return new Response(JSON.stringify({
                error: true,
                message: result.message || `Erro ${response.status} na API do parceiro`,
                details: result,
                status: response.status
            }), { status: 200, headers: corsHeaders });
        }

        // Handle Persistence for Checkout, Cart and Tracking
        if ((action === 'checkout' || action === 'cart' || action === 'tracking') && !result.error) {
            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const dataToProcess = Array.isArray(result) ? result[0] : result;
            const sfOrderId = dataToProcess.order_id || dataToProcess.id || (Array.isArray(params.orders) ? params.orders[0] : params.id);
            const finalPrice = dataToProcess.price || params.price || 0;

            // 1. Handle Balance Deduction (ONLY for Master Account during Checkout)
            if (isMasterAccount && action === 'checkout' && finalPrice > 0) {
                const currentBalance = profile.wallet_balance || 0;
                await adminClient.from('profiles').update({ wallet_balance: currentBalance - finalPrice }).eq('id', user.id);
                await adminClient.from('logistics_transactions').insert({
                    user_id: user.id,
                    amount: -finalPrice,
                    type: 'debit',
                    description: `Etiqueta Super Frete (Ref: ${sfOrderId})`,
                    metadata: { action, result_id: sfOrderId, pedido_id: params.pedido_id }
                });
            }

            // 2. Extract Tracking and PDF
            let trackingCode = dataToProcess.tracking || dataToProcess.tracking_code || dataToProcess.tracking_number || null;
            if (typeof trackingCode === 'object' && trackingCode !== null) {
                trackingCode = trackingCode.code || trackingCode.tracking_code || trackingCode.number || null;
            }

            if (!trackingCode) {
                const correiosMatch = JSON.stringify(dataToProcess).match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                if (correiosMatch) trackingCode = correiosMatch[0].toUpperCase();
            }

            let pdfUrl = dataToProcess.pdf || dataToProcess.url;
            if (!pdfUrl && sfOrderId && (action === 'checkout' || action === 'tracking')) {
                const b64 = btoa(JSON.stringify({ order_id: String(sfOrderId) }));
                pdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${b64}?format=A4`;
            }

            // 3. Upsert Shipping Label
            // Status mapping: released, printed, posted, transit, delivered, cancelled
            let labelStatus = dataToProcess.status || 'pending';
            if (action === 'checkout') labelStatus = 'released';
            if (labelStatus === 'Aguardando impressão' || labelStatus === 'Paga') labelStatus = 'released';

            const { data: upsertData, error: upsertError } = await adminClient.from('shipping_labels').upsert({
                user_id: user.id,
                pedido_id: params.pedido_id || null,
                external_id: String(sfOrderId),
                status: labelStatus,
                pdf_url: pdfUrl || null,
                price: finalPrice,
                tracking_code: trackingCode,
                recipient_name: dataToProcess.to?.name || params.recipient_name || dataToProcess.recipient?.name || null,
                service_name: dataToProcess.service?.name || params.service_name || null,
                provider: 'superfrete'
            }, { onConflict: 'external_id' }).select();

            if (upsertError) {
                console.error("[SuperFrete Proxy] Upsert Error:", upsertError);
            }

            // 4. Update Pedido Reference
            let pedidoToUpdate = params.pedido_id;
            if (!pedidoToUpdate && sfOrderId) {
                const { data: existingLabel } = await adminClient.from('shipping_labels').select('pedido_id').eq('external_id', String(sfOrderId)).single();
                if (existingLabel?.pedido_id) pedidoToUpdate = existingLabel.pedido_id;
            }

            if (pedidoToUpdate) {
                await adminClient.from('pedidos').update({
                    shipping_label_id: String(sfOrderId),
                    shipping_label_status: labelStatus,
                    tracking_code: trackingCode || null
                }).eq('id', pedidoToUpdate);
            }

            // Normalize result for Frontend
            if (typeof result === 'object' && !Array.isArray(result)) {
                result.tracking_code = trackingCode;
                result.status = labelStatus;
                result.pdf = pdfUrl;
                result.success = true;
            }
        }

        return respond(result);

    } catch (error: any) {
        console.error("[SuperFrete Proxy] Internal Error:", error);
        return respond({
            error: true,
            message: error.message || "Erro interno no proxy SuperFrete",
            type: "proxy_error"
        }, 200); // Retornamos 200 com flag de error para evitar preflight failure em alguns browsers
    }
});
