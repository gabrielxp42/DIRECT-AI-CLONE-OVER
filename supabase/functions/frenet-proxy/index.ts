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
            .select('frenet_token, frenet_partner_token, email, wallet_balance, frenet_access_key, frenet_access_password')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");

        let token = profile.frenet_token;
        if (!token) {
            token = Deno.env.get('FRENET_MASTER_TOKEN'); // Fallback to master if admin configured
            if (!token) {
                // Return a structured error so the frontend knows to ask for credentials
                return new Response(JSON.stringify({
                    error: true,
                    message: "Configuração da Frenet não encontrada.",
                    needs_config: true
                }), { status: 200, headers: corsHeaders });
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
                ShipmentInvoiceValue: params.ShipmentInvoiceValue || params.invoice_value || "100",
                ShippingItemArray: params.items || params.ShippingItemArray || params.ShipmentItemArray || [],
                RecipientCountry: "BR"
            };

            console.log("[frenet-proxy] Calculate request:", JSON.stringify(requestBody));

            const response = await fetch(`${baseUrl}/shipping/quote`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();
            console.log("[frenet-proxy] Calculate response status:", response.status);
            console.log("[frenet-proxy] Calculate response:", JSON.stringify(result).substring(0, 500));
            return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });

        } else if (action === 'cart') {
            // Frenet order creation usually involves a specific endpoint for purchasing or creating shipping orders
            // Note: Different partners use different Frenet endpoints (some use /shipping/order)
            // We use the standard shipping purchase logic.
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

                    // 4. Persistence: Create record in shipping_labels
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

                    // 5. Update Pedido if linked
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

            return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });

        } else if (action === 'balance') {
            const response = await fetch(`${baseUrl}/wallet`, {
                headers: commonHeaders
            });
            const result = await response.json();

            // Sync balance with profiles table for local UI speed
            // Using AvailableAmount because it's the real spendable balance
            const balanceToSync = typeof result.AvailableAmount === 'number' ? result.AvailableAmount : result.Amount;

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

            return new Response(JSON.stringify({
                ...result,
                Balance: balanceToSync // Keep Balance field for frontend compatibility if needed
            }), { headers: corsHeaders, status: 200 });

        } else if (action === 'deposit') {
            // params: { amount: number, payment_method: 'PIX' | 'BOLETO' }
            const response = await fetch(`${baseUrl}/wallet/deposit`, {
                method: 'POST',
                headers: commonHeaders,
                body: JSON.stringify({
                    Amount: params.amount,
                    PaymentMethod: params.payment_method || 'PIX'
                })
            });

            const result = await response.json();
            return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });

        } else if (action === 'tracking') {
            const adminClient = createClient(
                Deno.env.get('SUPABASE_URL') ?? '',
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            let serviceCode = params.service_code;
            let trackingNum = params.tracking_num;

            // If only id is provided, fetch from DB
            if (params.id && (!serviceCode || !trackingNum)) {
                const { data: label } = await adminClient
                    .from('shipping_labels')
                    .select('external_id, tracking_code, service_name, pdf_url')
                    .eq('id', params.id)
                    .single();

                if (label) {
                    // Frenet specifically needs service code for tracking info in some cases, 
                    // but often the PDF URL is already enough. 
                    // If we have pdf_url, we can return it directly.
                    if (label.pdf_url) {
                        return new Response(JSON.stringify({
                            success: true,
                            url: label.pdf_url,
                            pdf: label.pdf_url,
                            tracking_code: label.tracking_code
                        }), { headers: corsHeaders, status: 200 });
                    }
                    serviceCode = label.external_id;
                    trackingNum = label.tracking_code;
                }
            }

            if (!serviceCode || !trackingNum) {
                return new Response(JSON.stringify({
                    error: true,
                    message: "Informações de rastreio (ServiceCode/TrackingNumber) não encontradas."
                }), { status: 200, headers: corsHeaders });
            }

            const response = await fetch(`${baseUrl}/tracking/trackinginfo`, {
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
            throw new Error(`Ação '${action}' não implementada para Frenet.`);
        }

    } catch (error: any) {
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no servidor Frenet Proxy"
        }), { status: 200, headers: corsHeaders });
    }
});
