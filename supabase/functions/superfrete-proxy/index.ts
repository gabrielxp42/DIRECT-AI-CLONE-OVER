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
            // Fallback to Master Token (Production Only for now)
            token = Deno.env.get('SUPERFRETE_MASTER_TOKEN');
            isMasterAccount = true;

            if (!token) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Logística indisponível. Sua conta não possui token configurado e nenhum token mestre foi encontrado."
                }), { status: 200, headers: corsHeaders });
            }
        }

        // 3. Balance Check for Purchases (if using Master Account)
        if (isMasterAccount && action === 'checkout') {
            const estimatedPrice = params.price || 0;
            if (estimatedPrice > (profile.wallet_balance || 0)) {
                return new Response(JSON.stringify({
                    error: true,
                    message: `Saldo insuficiente. Você tem R$ ${profile.wallet_balance.toFixed(2)}, mas a etiqueta custa R$ ${estimatedPrice.toFixed(2)}.`
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
                // SuperFrete v0 checkout expects an array of IDs in the 'orders' field
                if (typeof params === 'object') {
                    // Supporting both 'id' and 'orders' for flexibility
                    const orderId = params.id || (Array.isArray(params.orders) ? params.orders[0] : params.orders);
                    requestParams = { orders: [orderId] };
                }
                break;
            case 'tracking': {
                // Construct permanent PDF URL using SuperFrete's base64 format
                // The format is: https://etiqueta.superfrete.com/_etiqueta/pdf/{base64({"order_id":"<id>"})}?format=A4
                const orderId = params?.orders?.[0] || params?.order_id || params?.id;
                if (!orderId) throw new Error("ID da etiqueta não fornecido");

                // Try to construct the URL directly (much more reliable than API)
                const payload = JSON.stringify({ order_id: orderId });
                // Use btoa equivalent for Deno
                const base64Payload = btoa(payload);
                const permanentPdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;

                console.log(`[SuperFrete Proxy] Constructed permanent PDF URL for order ${orderId}: ${permanentPdfUrl}`);

                return new Response(JSON.stringify({
                    url: permanentPdfUrl,
                    pdf: permanentPdfUrl,
                    order_id: orderId
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200
                });
            }
            default:
                throw new Error("Ação inválida");
        }

        console.log(`[SuperFrete Proxy] Action: ${action} | Master: ${isMasterAccount} | Endpoint: ${endpoint}`);
        console.log(`[SuperFrete Proxy] Outgoing Request: ${method} ${baseUrl}${endpoint}`);
        if (method !== 'GET') console.log(`[SuperFrete Proxy] Body:`, JSON.stringify(requestParams, null, 2));

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
        const snippet = responseText.substring(0, 150).replace(/\s+/g, ' ').trim();
        console.log(`[SuperFrete Proxy] Raw response (${response.status}): ${snippet}`);

        let result: any = {};
        if (responseText && responseText.trim().length > 0) {
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error(`[SuperFrete Proxy] Failed to parse JSON response. raw response first 500 chars: ${responseText.substring(0, 500)}`);

                // Case: HTML returned
                if (responseText.toLowerCase().includes('<!doctype html>') || responseText.toLowerCase().includes('<html')) {
                    return new Response(JSON.stringify({
                        error: true,
                        message: `A API do parceiro retornou uma página HTML em vez de dados (Status ${response.status}). Possível erro de endpoint ou manutenção.`,
                        details: `Snippet: ${snippet}...`,
                        tip: "Tente novamente em instantes. Se o erro persistir, o endpoint de checkout pode ter mudado."
                    }), {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({
                    error: true,
                    message: `Resposta inválida da API do parceiro (${response.status}): ${snippet}...`,
                    details: responseText.substring(0, 100),
                    tip: "A API do parceiro retornou um formato não esperado."
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } else if (response.ok) {
            // Handle 204 or empty success responses
            result = { success: true, status: 'ok' };
        }

        if (!response.ok) {
            console.error(`[SuperFrete Proxy] API Error (${response.status}):`, result);
            return new Response(JSON.stringify({
                error: true,
                message: result.message || result.error_message || `Erro do Super Frete (${response.status})`,
                details: result
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        // 4. Handle Wallet Debit & Persistence (if success and using Master Account)
        if (isMasterAccount && action === 'checkout' && !result.error) {
            // result can be an array or object depending on version
            const checkoutResult = Array.isArray(result) ? result[0] : result;
            const finalPrice = checkoutResult.price || params.price || 0;
            const tagId = checkoutResult.tag || checkoutResult.id || (Array.isArray(params.orders) ? params.orders[0] : params.id);

            console.log(`[SuperFrete Proxy] Persistence - Tag: ${tagId} | Price: ${finalPrice}`);

            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            // Update balance if there's a price
            if (finalPrice > 0) {
                const currentBalance = profile.wallet_balance || 0;
                await adminClient
                    .from('profiles')
                    .update({ wallet_balance: currentBalance - finalPrice })
                    .eq('id', user.id);

                // Log transaction
                await adminClient
                    .from('logistics_transactions')
                    .insert({
                        user_id: user.id,
                        amount: -finalPrice,
                        type: 'debit',
                        description: `Emissão de etiqueta Super Frete (Ref: ${tagId})`,
                        metadata: { action, result_id: tagId, pedido_id: params.pedido_id }
                    });
            }

            // Extract all data from checkout result - SuperFrete uses various field names
            const trackingCode = checkoutResult.tracking || checkoutResult.tracking_code
                || checkoutResult.tracking_number || checkoutResult.codigo_rastreio || null;

            // Recipient name: try checkout result first, then params
            const recipientName = checkoutResult.to?.name || checkoutResult.recipient?.name
                || checkoutResult.destinatario?.nome || checkoutResult.name
                || params.recipient_name || params.to?.name || null;

            // Service name: SEDEX, PAC, etc.
            const serviceName = checkoutResult.service?.name || checkoutResult.service_name
                || checkoutResult.service || checkoutResult.tipo_servico
                || params.service_name || null;

            // Use the order_id (alphanumeric) for PDF — NOT the numeric tag
            const sfOrderId = checkoutResult.order_id || checkoutResult.id || tagId;

            console.log(`[SuperFrete Proxy] Extracted: tracking=${trackingCode}, recipient=${recipientName}, service=${serviceName}, orderId=${sfOrderId}`);
            console.log(`[SuperFrete Proxy] Checkout result keys:`, Object.keys(checkoutResult));
            console.log(`[SuperFrete Proxy] Checkout result (full):`, JSON.stringify(checkoutResult).substring(0, 1000));

            let pdfUrl = checkoutResult.pdf || checkoutResult.url;

            // If no PDF URL from checkout, construct permanent URL using base64 format
            if (!pdfUrl && sfOrderId) {
                const payload = JSON.stringify({ order_id: String(sfOrderId) });
                const base64Payload = btoa(payload);
                pdfUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;
                console.log(`[SuperFrete Proxy] Constructed permanent PDF URL: ${pdfUrl}`);
            }

            // Persist Label with all extracted info
            const { error: insertError } = await adminClient
                .from('shipping_labels')
                .insert({
                    user_id: user.id,
                    pedido_id: params.pedido_id || null,
                    external_id: String(sfOrderId || tagId),
                    status: 'released',
                    pdf_url: pdfUrl || null,
                    price: finalPrice,
                    tracking_code: trackingCode,
                    origin_zip: checkoutResult.from?.postal_code || params.from || null,
                    destination_zip: checkoutResult.to?.postal_code || params.to || null,
                    recipient_name: recipientName,
                    service_name: serviceName
                });

            if (insertError) console.error("[SuperFrete Proxy] Error persisting label:", insertError);

            // Update pedido if ID is present
            if (params.pedido_id) {
                await adminClient
                    .from('pedidos')
                    .update({
                        shipping_label_status: 'released',
                        tracking_code: trackingCode
                    })
                    .eq('id', params.pedido_id);
            }

            // Ensure the result sent back to client has the PDF URL
            if (pdfUrl && !result.pdf && !result.url) {
                if (Array.isArray(result)) {
                    result[0].pdf = pdfUrl;
                } else {
                    result.pdf = pdfUrl;
                }
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error("[SuperFrete Proxy] Critical Error:", error);
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no servidor"
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
