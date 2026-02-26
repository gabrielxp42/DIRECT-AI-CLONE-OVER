import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BASE_URL = "https://api.frenet.com.br/v1";
const BASE_URL_HML = "https://api-hml.apifrenet.com.br/v1";

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { action, params, isSandbox = false } = body;
        console.log(`[Frenet Proxy] Action: ${action}`, JSON.stringify({ params, isSandbox }));

        // 1. Authenticate User
        const authHeader = req.headers.get('Authorization')!;
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        // 2. Get User Token and Provider Details
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('frenet_token, frenet_partner_token, email, wallet_balance, frenet_balance, frenet_access_key, frenet_access_password')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");

        let token = profile.frenet_token;
        if (!token) {
            token = Deno.env.get('FRENET_MASTER_TOKEN'); // Fallback to master if admin configured
            if (!token) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Configuração da Frenet não encontrada.",
                    needs_config: true
                }), { status: 401, headers: corsHeaders });
            }
        }

        const baseUrl = isSandbox ? BASE_URL_HML : BASE_URL;
        const userAgent = `DIRECT-AI-GB-1 (v1.0.0; ${profile.email || 'user@directai.com'})`;

        const commonHeaders: Record<string, string> = {
            'token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': userAgent
        };

        if (profile.frenet_partner_token) {
            commonHeaders['x-partner-token'] = profile.frenet_partner_token;
        }

        if (action === 'calculate') {
            // Mapping for Frenet Quote
            const requestBody = {
                SellerCEP: params.seller_cep || params.SellerCEP,
                RecipientCEP: params.recipient_cep || params.RecipientCEP,
                ShipmentInvoiceValue: params.ShipmentInvoiceValue || params.invoice_value || "0",
                ShippingItemArray: params.ShippingItemArray || params.ShipmentItemArray || params.items || [],
                RecipientCountry: "BR"
            };

            console.log("[Frenet Proxy] Requesting /shipping/quote with:", JSON.stringify(requestBody));
            const response = await fetch(`${baseUrl}/shipping/quote`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();
            console.log("[Frenet Proxy] Response from /shipping/quote:", JSON.stringify(result));
            return new Response(JSON.stringify(result), { headers: corsHeaders, status: response.ok ? 200 : 400 });

        } else if (action === 'cart') {
            // In Frenet, we usually purchase directly. 
            // To maintain compatibility with the two-step UI (cart -> checkout),
            // we'll perform the purchase here if it's the final intent, 
            // or just validate if needed.

            const response = await fetch(`${baseUrl}/shipping/purchase`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify(params)
            });

            const result = await response.json();

            // Handle Persistence and Wallet if successful
            if (!result.error && response.ok) {
                const finalPrice = result.Price || params.Price || 0;
                const adminClient = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );

                if (finalPrice > 0) {
                    const currentBalance = profile.frenet_balance || 0;
                    await adminClient
                        .from('profiles')
                        .update({ frenet_balance: currentBalance - finalPrice })
                        .eq('id', user.id);

                    await adminClient
                        .from('logistics_transactions')
                        .insert({
                            user_id: user.id,
                            amount: -finalPrice,
                            type: 'debit',
                            description: `Frenet Purchase (Ref: ${result.ServiceCode || 'N/A'})`,
                            metadata: { action, result, pedido_id: params.pedido_id }
                        });

                    const frenetLabelId = result.ShippingServiceId || result.ServiceCode || `FRN-${Date.now()}`;
                    await adminClient
                        .from('shipping_labels')
                        .insert({
                            user_id: user.id,
                            pedido_id: params.pedido_id || null,
                            external_id: String(frenetLabelId),
                            status: 'released',
                            pdf_url: result.Url || result.Pdf || null,
                            price: finalPrice,
                            tracking_code: result.TrackingNumber || null,
                            recipient_name: params.to?.name || params.recipient_name || null,
                            service_name: params.service_name || result.ServiceDescription || null,
                            provider: 'frenet'
                        });

                    if (params.pedido_id) {
                        await adminClient
                            .from('pedidos')
                            .update({
                                shipping_label_status: 'released',
                                tracking_code: result.TrackingNumber || null,
                                shipping_label_id: String(frenetLabelId)
                            })
                            .eq('id', params.pedido_id);
                    }
                }
            }

            return new Response(JSON.stringify(result), { headers: corsHeaders, status: response.ok ? 200 : 400 });

        } else if (action === 'checkout') {
            // Alias for finalizing or retrieving a previously created 'cart' purchase
            // In the current Frenet flow, 'cart' already buys it. 
            // This handler ensures the frontend doesn't break and can retrieve the PDF if it missed it.
            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const { data: label } = await adminClient
                .from('shipping_labels')
                .select('*')
                .eq('external_id', String(params.id))
                .eq('user_id', user.id)
                .maybeSingle();

            if (label) {
                return new Response(JSON.stringify({
                    success: true,
                    status: 'released',
                    pdf: label.pdf_url,
                    url: label.pdf_url,
                    tracking_code: label.tracking_code,
                    id: label.external_id
                }), { headers: corsHeaders, status: 200 });
            }

            return new Response(JSON.stringify({
                error: true,
                message: "Etiqueta não encontrada ou ainda não emitida."
            }), { headers: corsHeaders, status: 404 });

        } else if (action === 'balance') {
            const response = await fetch(`${baseUrl}/wallet`, {
                method: 'GET',
                headers: commonHeaders
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Dificuldade ao conectar com a carteira Frenet. Verifique suas credenciais.",
                    details: { status: response.status }
                }), { headers: corsHeaders, status: 200 });
            }

            const result = await response.json();
            const balanceToSync = typeof result.Balance === 'number' ? result.Balance : undefined;

            if (response.ok && !result.error && typeof balanceToSync === 'number') {
                const adminClient = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );
                await adminClient
                    .from('profiles')
                    .update({ frenet_balance: balanceToSync })
                    .eq('id', user.id);
            }

            return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });

        } else if (action === 'deposit') {
            const response = await fetch(`${baseUrl}/wallet/deposit`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify({
                    Amount: params.amount,
                    PaymentMethod: params.payment_method || 'PIX'
                })
            });

            const result = await response.json();
            return new Response(JSON.stringify(result), { headers: corsHeaders, status: response.ok ? 200 : 400 });

        } else if (action === 'tracking') {
            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            let serviceCode = params.service_code;
            let trackingNum = params.tracking_num;

            if (params.id && (!serviceCode || !trackingNum)) {
                const { data: label } = await adminClient
                    .from('shipping_labels')
                    .select('external_id, tracking_code, service_name, pdf_url')
                    .eq('id', params.id)
                    .single();

                if (label) {
                    if (label.pdf_url && !params.force_refresh) {
                        return new Response(JSON.stringify({
                            success: true,
                            url: label.pdf_url,
                            pdf: label.pdf_url,
                            tracking_code: label.tracking_code,
                            status: 'released'
                        }), { headers: corsHeaders, status: 200 });
                    }
                    serviceCode = label.external_id;
                    trackingNum = label.tracking_code;
                }
            }

            if (!serviceCode || !trackingNum) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Informações de rastreio não encontradas."
                }), { status: 400, headers: corsHeaders });
            }

            const response = await fetch(`${baseUrl}/shipping/trackinginfo`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify({
                    ShippingServiceCode: serviceCode,
                    TrackingNumber: trackingNum,
                })
            });

            const result = await response.json();
            const lastEvent = result.TrackingEvents?.[0];
            const status = lastEvent?.EventDescription || 'Objeto postado';

            return new Response(JSON.stringify({
                ...result,
                url: result.Url || null,
                pdf: result.Url || null,
                tracking_code: trackingNum,
                normalized_status: status.toLowerCase()
            }), { headers: corsHeaders, status: 200 });

        } else {
            throw new Error(`Ação '${action}' não implementada.`);
        }

    } catch (error: any) {
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no servidor Frenet Proxy"
        }), { status: error.message === "Unauthorized" ? 401 : 400, headers: corsHeaders });
    }
});
