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
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (orderId && uuidPattern.test(orderId)) {
                    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    const { data: label } = await adminClient.from('shipping_labels').select('external_id').eq('id', orderId).single();
                    if (label?.external_id) orderId = label.external_id;
                }
                if (!orderId) throw new Error("ID da etiqueta não fornecido");
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
                await adminClient.from('profiles').update({ wallet_balance: currentBalance - finalPrice }).eq('id', user.id);
                await adminClient.from('logistics_transactions').insert({
                    user_id: user.id,
                    amount: -finalPrice,
                    type: 'debit',
                    description: `Etiqueta Super Frete (Ref: ${tagId})`,
                    metadata: { action, result_id: tagId, pedido_id: params.pedido_id }
                });
            }

            // Tracking logic extracted
            let trackingCode = checkoutResult.tracking || checkoutResult.tracking_code || null;
            if (typeof trackingCode === 'object' && trackingCode !== null) trackingCode = trackingCode.code || trackingCode.tracking_code || null;
            if (!trackingCode) {
                const correiosMatch = JSON.stringify(checkoutResult).match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                if (correiosMatch) trackingCode = correiosMatch[0].toUpperCase();
            }

            const sfOrderId = checkoutResult.order_id || checkoutResult.id || tagId;
            let pdfUrl = checkoutResult.pdf || checkoutResult.url;
            if (!pdfUrl && sfOrderId) {
                const b64 = btoa(JSON.stringify({ order_id: String(sfOrderId) }));
                pdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${b64}?format=A4`;
            }

            await adminClient.from('shipping_labels').insert({
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
                await adminClient.from('pedidos').update({
                    shipping_label_status: 'released',
                    tracking_code: trackingCode
                }).eq('id', params.pedido_id);
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error("[SuperFrete Proxy] Internal Error:", error);
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no proxy SuperFrete"
        }), { status: 200, headers: corsHeaders });
    }
});
