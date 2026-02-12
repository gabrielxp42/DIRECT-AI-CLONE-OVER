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

        switch (action) {
            case 'calculate':
                endpoint = "/api/v0/calculator";
                break;
            case 'cart':
                endpoint = "/api/v0/cart";
                break;
            case 'checkout':
                endpoint = "/api/v1/checkout";
                break;
            case 'tracking':
                endpoint = "/api/v1/tag/pedido";
                method = "GET";
                if (params?.orders) {
                    endpoint = "/api/v1/tag/link";
                    method = "POST";
                }
                break;
            default:
                throw new Error("Ação inválida");
        }

        console.log(`[SuperFrete Proxy] Action: ${action} | Master: ${isMasterAccount} | Endpoint: ${endpoint}`);

        console.log(`[SuperFrete Proxy] Outgoing Request: ${method} ${baseUrl}${endpoint}`);
        if (method !== 'GET') console.log(`[SuperFrete Proxy] Body:`, JSON.stringify(params, null, 2));

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'User-Agent': userAgent,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: method === 'GET' ? undefined : JSON.stringify(params)
        });

        const result = await response.json();

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

        // 4. Handle Wallet Debit (if success and using Master Account)
        let finalPrice = 0;
        if (isMasterAccount && action === 'checkout' && response.ok && !result.error) {
            // Price usually comes in the result of checkout or was in params
            finalPrice = result.price || params.price || 0;

            if (finalPrice > 0) {
                const adminClient = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );

                // Update balance
                const { error: updateError } = await adminClient
                    .from('profiles')
                    .update({ wallet_balance: (profile.wallet_balance || 0) - finalPrice })
                    .eq('id', user.id);

                if (updateError) console.error("Error updating wallet balance:", updateError);

                // Log transaction
                await adminClient
                    .from('logistics_transactions')
                    .insert({
                        user_id: user.id,
                        amount: -finalPrice,
                        type: 'debit',
                        description: `Emissão de etiqueta Super Frete (Ref: ${result.tag || result.id || 'N/A'})`,
                        metadata: { action, result_id: result.id || result.tag }
                    });

                // Persist Label
                await adminClient
                    .from('shipping_labels')
                    .insert({
                        user_id: user.id,
                        external_id: result.tag || result.id || String(Date.now()),
                        status: 'released',
                        pdf_url: result.pdf,
                        price: finalPrice,
                        tracking_code: result.tracking,
                        origin_zip: params.from,
                        destination_zip: params.to
                    });
            }
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: finalPrice > 0 ? 200 : response.status // Ensure 200 for wallet errors managed here
        });

    } catch (error: any) {
        console.error("[SuperFrete Proxy] Critical Error:", error);
        return new Response(JSON.stringify({
            error: true,
            message: error.message
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
