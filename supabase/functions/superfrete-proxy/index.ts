import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        // 2. Get User Token from Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('superfrete_token, superfrete_sandbox_token, email')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new Error("User profile not found");

        const token = isSandbox ? profile.superfrete_sandbox_token : profile.superfrete_token;
        if (!token) {
            return new Response(JSON.stringify({
                error: true,
                message: `Token do Super Frete (${isSandbox ? 'Sandbox' : 'Produção'}) não configurado no seu perfil.`
            }), { status: 200, headers: corsHeaders });
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
                method = "GET"; // Based on docs summary it might be GET/POST but for link it was POST with orders array
                if (params.orders) {
                    endpoint = "/api/v1/tag/link";
                    method = "POST";
                }
                break;
            default:
                throw new Error("Ação inválida");
        }

        console.log(`[SuperFrete Proxy] Action: ${action} | Sandbox: ${isSandbox} | Endpoint: ${endpoint}`);

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

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status
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
