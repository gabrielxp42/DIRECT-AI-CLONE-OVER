
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    console.log("=== VERIFY-SUBSCRIPTION STARTED ===");
    console.log("ENV Check - SUPABASE_URL:", SUPABASE_URL ? "SET" : "MISSING");
    console.log("ENV Check - SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING");
    console.log("ENV Check - ASAAS_API_KEY:", ASAAS_API_KEY ? "SET" : "MISSING");

    try {
        // 1. Validar Auth Header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error("No Authorization header found");
            throw new Error("Missing Authorization header");
        }

        const token = authHeader.replace('Bearer ', '');
        console.log("Token received (first 20 chars):", token.substring(0, 20) + "...");

        // 2. Criar cliente Supabase e validar usuário
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError) {
            console.error("Auth Error:", authError.message);
            throw new Error("Auth failed: " + authError.message);
        }

        if (!user) {
            console.error("No user found for token");
            throw new Error("User not found");
        }

        console.log("User authenticated:", user.id, user.email);

        // 3. Parse body (pode ser vazio ou ter subscriptionId)
        let subscriptionId = null;
        try {
            const body = await req.text();
            if (body) {
                const payload = JSON.parse(body);
                subscriptionId = payload.subscriptionId;
            }
        } catch (parseError) {
            console.log("No body or invalid JSON, proceeding with auto-search");
        }

        console.log("Searching subscription for user:", user.id, "| SubID:", subscriptionId || 'Auto');

        let activeSubscription = null;

        // 4. Buscar no Asaas
        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        if (subscriptionId) {
            console.log("Fetching specific subscription:", subscriptionId);
            const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, { headers });
            const sub = await response.json();
            console.log("Asaas Response (direct):", JSON.stringify(sub));
            if (sub.id && sub.status === 'ACTIVE') {
                activeSubscription = sub;
            }
        } else {
            console.log("Searching by externalReference:", user.id);
            const response = await fetch(`${ASAAS_API_URL}/subscriptions?externalReference=${user.id}&limit=10`, { headers });
            const data = await response.json();
            console.log("Asaas Response (search):", JSON.stringify(data));

            // Procurar primeira subscrição ACTIVE
            if (data.data && data.data.length > 0) {
                activeSubscription = data.data.find((s: any) => s.status === 'ACTIVE');
                if (!activeSubscription) {
                    console.log("Found subscriptions but none are ACTIVE. Statuses:", data.data.map((s: any) => s.status));
                }
            }
        }

        // 5. Atualizar Supabase se ativa
        if (activeSubscription) {
            console.log("Active Subscription Found:", activeSubscription.id, activeSubscription.status);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    subscription_status: 'active',
                    subscription_tier: 'pro',
                    asaas_customer_id: activeSubscription.customer,
                    asaas_subscription_id: activeSubscription.id
                })
                .eq('id', user.id);

            if (updateError) {
                console.error("Supabase Update Error:", updateError.message);
                throw updateError;
            }

            console.log("=== SUCCESS: User upgraded to PRO ===");
            return new Response(
                JSON.stringify({ success: true, status: 'ACTIVE', subscription: activeSubscription }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        } else {
            console.log("=== NO ACTIVE SUBSCRIPTION FOUND ===");
            return new Response(
                JSON.stringify({ success: false, status: 'PENDING_OR_NOT_FOUND', message: "Nenhuma assinatura ativa confirmada ainda." }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }

    } catch (err: any) {
        console.error("=== VERIFY ERROR ===", err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
