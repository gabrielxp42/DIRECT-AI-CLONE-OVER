
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";
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

        // 4. Buscar e Validar Pagamentos
        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        let paymentConfirmed = false;
        let activeSubscription = null;

        if (subscriptionId) {
            console.log("Fetching payments for specific subscription:", subscriptionId);
            // Buscamos os pagamentos vinculados a esta assinatura
            const response = await fetch(`${ASAAS_API_URL}/payments?subscription=${subscriptionId}`, { headers });
            const pData = await response.json();

            if (pData.data && pData.data.length > 0) {
                // Verificamos se algum pagamento da assinatura foi RECEBIDO ou CONFIRMADO
                const confirmedPayment = pData.data.find((p: any) =>
                    p.status === 'RECEIVED' || p.status === 'CONFIRMED'
                );

                if (confirmedPayment) {
                    paymentConfirmed = true;
                    // Se for assinatura, o checkout-asaas já deve ter salvado o ID do cliente no Asaas
                    // mas podemos pegar do pagamento se necessário.
                }
                console.log(`Payment Status for Sub ${subscriptionId}:`, paymentConfirmed ? "CONFIRMED" : "PENDING");
            }
        } else {
            console.log("Searching by externalReference:", user.id);
            // Fallback: Busca por externalReference em todas as assinaturas
            const response = await fetch(`${ASAAS_API_URL}/subscriptions?externalReference=${user.id}&limit=5`, { headers });
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                for (const sub of data.data) {
                    const pResp = await fetch(`${ASAAS_API_URL}/payments?subscription=${sub.id}`, { headers });
                    const pData = await pResp.json();
                    if (pData.data && pData.data.some((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED')) {
                        paymentConfirmed = true;
                        activeSubscription = sub;
                        break;
                    }
                }
            }
        }

        // 5. Atualizar Supabase se pagamento confirmado
        if (paymentConfirmed) {
            console.log("Confirmed Payment Found. Upgrading user...");

            const updateData: any = {
                subscription_status: 'active',
                subscription_tier: 'pro'
            };

            if (activeSubscription?.customer) updateData.asaas_customer_id = activeSubscription.customer;
            if (subscriptionId || activeSubscription?.id) updateData.asaas_subscription_id = subscriptionId || activeSubscription?.id;

            const { error: updateError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id);

            if (updateError) {
                console.error("Supabase Update Error:", updateError.message);
                throw updateError;
            }

            console.log("=== SUCCESS: User upgraded to PRO (Verified by Payment) ===");
            return new Response(
                JSON.stringify({ success: true, status: 'RECEIVED', subscriptionId: subscriptionId || activeSubscription?.id }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        } else {
            console.log("=== NO CONFIRMED PAYMENT FOUND YET ===");
            return new Response(
                JSON.stringify({ success: false, status: 'PENDING', message: "Pagamento ainda não confirmado pelo banco." }),
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
