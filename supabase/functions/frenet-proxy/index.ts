import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BASE_URL = "https://api.frenet.com.br";
const BASE_URL_HML = "https://api-hml.apifrenet.com.br";

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing Authorization header");

        const requestText = await req.text();
        console.log(`[Frenet Proxy] Raw Request: ${requestText.substring(0, 100)}`);

        let body: any = {};
        try {
            body = JSON.parse(requestText);
        } catch (e) {
            console.error("[Frenet Proxy] Failed to parse request body:", requestText);
            throw new Error("Invalid request body (JSON expected)");
        }

        const { action, params, isSandbox = false } = body;

        console.log(`[Frenet Proxy] ${action || 'UNKNOWN'} started`, { isSandbox });

        // 1. Authenticate User
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error("[Frenet Proxy] Auth Error:", userError);
            throw new Error("Unauthorized");
        }

        // 2. Get User Token and Profile Details
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('frenet_token, frenet_partner_token, email, wallet_balance, frenet_balance')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error("[Frenet Proxy] Profile Error:", profileError);
            throw new Error("User profile not found");
        }

        let token = profile.frenet_token;
        if (!token) {
            token = Deno.env.get('FRENET_MASTER_TOKEN');
            if (!token) {
                console.warn("[Frenet Proxy] No token provided by user and no MASTER_TOKEN found in env.");
                return new Response(JSON.stringify({
                    error: true,
                    message: "Logística Frenet não configurada adequadamente no servidor.",
                    needs_config: true
                }), { status: 200, headers: corsHeaders });
            }
        }

        const baseUrl = isSandbox ? BASE_URL_HML : BASE_URL;
        const userAgent = `DIRECT-AI-GB-1 (v1.0.3; ${profile.email || 'user@directai.com'})`;

        const commonHeaders: Record<string, string> = {
            'token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': userAgent
        };

        if (profile.frenet_partner_token) {
            commonHeaders['x-partner-token'] = profile.frenet_partner_token;
        }

        switch (action) {
            case 'calculate': {
                const requestBody = {
                    SellerCEP: params?.seller_cep || params?.SellerCEP || "04571010",
                    RecipientCEP: params?.recipient_cep || params?.RecipientCEP,
                    ShipmentInvoiceValue: params?.invoice_value || params?.ShipmentInvoiceValue || 0,
                    ShippingItemArray: params?.ShippingItemArray || params?.ShipmentItemArray || params?.items || [],
                    RecipientCountry: params?.recipient_country || params?.RecipientCountry || "BR"
                };

                const quoteUrl = `${baseUrl}/shipping/quote`;
                console.log("[Frenet Proxy] Quote Payload sending to:", quoteUrl);

                const response = await fetch(quoteUrl, {
                    method: 'POST',
                    headers: commonHeaders,
                    body: JSON.stringify(requestBody)
                });

                const responseText = await response.text();
                console.log(`[Frenet Proxy] Quote Status: ${response.status}`);

                let result: any;
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    console.error("[Frenet Proxy] Frenet returned NON-JSON:", responseText.substring(0, 500));
                    return new Response(JSON.stringify({
                        error: true,
                        message: "A Frenet retornou uma resposta inesperada (HTML). Verifique se o Token é válido para esta URL.",
                        details: responseText.substring(0, 200)
                    }), { status: 200, headers: corsHeaders });
                }

                if (!response.ok || (result && result.Message && !result.ShippingSevicesArray)) {
                    console.error("[Frenet Proxy] Quote Error Response:", result);
                    return new Response(JSON.stringify({
                        error: true,
                        message: result.Message || `Erro ${response.status} na Frenet`,
                        details: result
                    }), { status: 200, headers: corsHeaders });
                }

                return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });
            }

            case 'cart':
            case 'purchase': {
                // Compatibility mapping for existing UI
                const requestBody = params.RecipientCEP ? params : {
                    ServiceCode: params.service,
                    RecipientName: params.recipient_name || params.to?.name,
                    RecipientEmail: params.to?.email || "contato@directai.com",
                    RecipientPhone: params.to?.phone || "11999999999",
                    RecipientCEP: params.to?.postal_code || params.RecipientCEP,
                    RecipientAddress: params.to?.address || params.RecipientAddress,
                    RecipientNumber: params.to?.number || params.RecipientNumber || "S/N",
                    RecipientComplement: params.to?.complement || params.RecipientComplement || "",
                    RecipientDistrict: params.to?.district || params.RecipientDistrict,
                    RecipientCity: params.to?.city || params.RecipientCity,
                    RecipientState: params.to?.state_abbr || params.RecipientState,
                    RecipientCountry: "BR",
                    ShipmentInvoiceValue: params.invoice_value || params.ShipmentInvoiceValue || 0,
                    ShippingItemArray: (params.volumes || params.items || []).map((v: any) => ({
                        Weight: v.Weight || v.weight || 1,
                        Height: v.Height || v.height || 10,
                        Width: v.Width || v.width || 10,
                        Length: v.Length || v.length || 10,
                        Quantity: 1
                    }))
                };

                console.log("[Frenet Proxy] Purchase/Cart Payload:", JSON.stringify(requestBody));

                const response = await fetch(`${baseUrl}/shipping/purchase`, {
                    method: 'POST',
                    headers: commonHeaders,
                    body: JSON.stringify(requestBody)
                });

                const result = await response.json().catch(() => ({ error: true, message: "Resposta da API não é um JSON válido" }));
                console.log(`[Frenet Proxy] Purchase Status: ${response.status}`);

                if (!response.ok || result.error) {
                    console.error("[Frenet Proxy] Purchase Error:", result);
                    return new Response(JSON.stringify({
                        error: true,
                        message: result.Message || "Erro ao gerar etiqueta no Frenet",
                        details: result
                    }), { status: 200, headers: corsHeaders });
                }

                // Handle Persistence and Wallet locally
                const price = result.ShippingPrice || result.Price || 0;
                const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

                if (price > 0) {
                    const currentBalance = profile.frenet_balance || 0;
                    await adminClient.from('profiles').update({ frenet_balance: currentBalance - price }).eq('id', user.id);
                    await adminClient.from('logistics_transactions').insert({
                        user_id: user.id,
                        amount: -price,
                        type: 'debit',
                        description: `Etiqueta Frenet (Serviço: ${result.ServiceDescription || params.service_name})`,
                        metadata: { action, result, pedido_id: params.pedido_id }
                    });
                }

                const labelId = result.ShippingServiceId || result.ServiceCode || `FRN-${Date.now()}`;
                await adminClient.from('shipping_labels').insert({
                    user_id: user.id,
                    pedido_id: params.pedido_id || null,
                    external_id: String(labelId),
                    status: 'released',
                    pdf_url: result.Url || result.Pdf || null,
                    price: price,
                    tracking_code: result.TrackingNumber || null,
                    recipient_name: requestBody.RecipientName,
                    service_name: result.ServiceDescription || params.service_name,
                    provider: 'frenet'
                });

                if (params.pedido_id) {
                    await adminClient.from('pedidos').update({
                        shipping_label_status: 'released',
                        tracking_code: result.TrackingNumber || null,
                        shipping_label_id: String(labelId)
                    }).eq('id', params.pedido_id);
                }

                return new Response(JSON.stringify({
                    ...result,
                    id: labelId,
                    status: 'released',
                    pdf: result.Url || result.Pdf,
                    tracking_code: result.TrackingNumber
                }), { headers: corsHeaders, status: 200 });
            }

            case 'checkout': {
                // Checkout in Frenet is usually handled by 'purchase'. 
                // We'll search for the label in the database first.
                const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
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

                // If not found, returning error
                return new Response(JSON.stringify({
                    error: true,
                    message: "Etiqueta não encontrada no histórico local."
                }), { headers: corsHeaders, status: 200 });
            }

            case 'balance': {
                const response = await fetch(`${baseUrl}/wallet`, {
                    method: 'GET',
                    headers: commonHeaders
                });

                const result = await response.json().catch(() => ({}));
                console.log(`[Frenet Proxy] Balance Status: ${response.status}`);

                if (response.ok && typeof result.Balance === 'number') {
                    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    await adminClient.from('profiles').update({ frenet_balance: result.Balance }).eq('id', user.id);
                    return new Response(JSON.stringify(result), { headers: corsHeaders, status: 200 });
                }

                return new Response(JSON.stringify({ balance: profile.frenet_balance || 0 }), { headers: corsHeaders, status: 200 });
            }

            case 'tracking': {
                // Frenet Tracking Info
                let serviceCode = params.service_code || params.id;
                let trackingNum = params.tracking_num || params.tracking_code;

                if (!serviceCode || !trackingNum) {
                    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    const { data: label } = await adminClient
                        .from('shipping_labels')
                        .select('external_id, tracking_code, pdf_url')
                        .eq('id', params.id)
                        .maybeSingle();

                    if (label) {
                        serviceCode = label.external_id;
                        trackingNum = label.tracking_code;
                    }
                }

                if (!serviceCode || !trackingNum) {
                    throw new Error("Informações de rastreio não encontradas.");
                }

                const response = await fetch(`${baseUrl}/shipping/trackinginfo`, {
                    method: 'POST',
                    headers: commonHeaders,
                    body: JSON.stringify({
                        ShippingServiceCode: serviceCode,
                        TrackingNumber: trackingNum,
                    })
                });

                const result = await response.json().catch(() => ({}));
                return new Response(JSON.stringify({
                    ...result,
                    tracking_code: trackingNum,
                    status: result.TrackingEvents?.[0]?.EventDescription || 'Objeto postado'
                }), { headers: corsHeaders, status: 200 });
            }

            default:
                throw new Error(`Ação '${action}' inválida`);
        }

    } catch (error: any) {
        console.error("[Frenet Proxy] Internal Error:", error);
        return new Response(JSON.stringify({
            error: true,
            message: error.message || "Erro interno no proxy Frenet"
        }), { status: 200, headers: corsHeaders });
    }
});
