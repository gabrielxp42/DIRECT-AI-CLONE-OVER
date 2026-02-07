
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

        // 3. Parse body (pode ser vazio ou ter subscriptionId / paymentId)
        let subscriptionId = null;
        let paymentId = null;
        try {
            const body = await req.text();
            if (body) {
                const payload = JSON.parse(body);
                subscriptionId = payload.subscriptionId;
                paymentId = payload.paymentId;
            }
        } catch (parseError) {
            console.log("No body or invalid JSON, proceeding with auto-search");
        }

        console.log("Searching for user:", user.id, "| SubID:", subscriptionId, "| PaymentID:", paymentId);

        // 4. Buscar e Validar Pagamentos
        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        let paymentConfirmed = false;
        let activeSubscription = null;
        let isBundlePayment = false;

        // CASE A: Payment ID (Bundle / One-time)
        if (paymentId) {
            console.log("Verifying specific Payment ID:", paymentId);
            const response = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, { headers });
            const pData = await response.json();

            if (pData.status === 'RECEIVED' || pData.status === 'CONFIRMED') {
                paymentConfirmed = true;
                isBundlePayment = pData.description?.includes("Boost") || pData.description?.includes("Bundle");
            }
        }

        // CASE B: Subscription ID
        else if (subscriptionId) {
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
            // Fallback: Busca por externalReference (TENTATIVA 1: Payments - Bundles Recent)
            console.log("Auto-search: Checking recent payments for user:", user.id);
            const payResponse = await fetch(`${ASAAS_API_URL}/payments?externalReference=${user.id}&limit=5`, { headers });
            const payData = await payResponse.json();

            const confirmedPay = payData.data?.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
            if (confirmedPay) {
                paymentConfirmed = true;
                isBundlePayment = confirmedPay.description?.includes("Boost") || confirmedPay.description?.includes("Bundle");
                console.log("Auto-search Found CONFIRMED Payment:", confirmedPay.id);
            } else {
                console.log("Auto-search: Checking subscriptions...");
                // Fallback 2: Subscriptions
                const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions?externalReference=${user.id}&limit=5`, { headers });
                const subData = await subResponse.json();
                // Aqui a lógica ficaria mais complexa, idealmente confiamos no ID passado pelo front na maioria dos casos
            }
        }

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

        // 5. Atualizar Supabase com inteligência de validade
        if (paymentConfirmed) {
        console.log("Confirmed Payment Found. Updating Status...");

        let isExpired = false;
        let nextDueDate = null;

        if (activeSubscription) {
            nextDueDate = new Date(activeSubscription.nextDueDate || activeSubscription.dueDate);
            const today = new Date();
            const toleranceDate = new Date(nextDueDate);
            toleranceDate.setDate(toleranceDate.getDate() + 3);
            isExpired = today > toleranceDate && (activeSubscription.status === 'OVERDUE' || activeSubscription.status === 'EXPIRED');
        }

        let updateData: any = {};

        if (isBundlePayment) {
            console.log("Detected BUNDLE/BOOST Payment.");
            // Bundle = Acesso Pro + WhatsApp Boost
            updateData = {
                subscription_status: 'active', // Ganha acesso imediato
                subscription_tier: 'pro',
                is_whatsapp_plus_active: true, // Ganha o boost vitalício
                last_payment_date: new Date().toISOString(),
                // next_due_date: nextDueDate // Talvez não tenhamos nextDueDate se for one-time, mas o sistema pode gerar assinatura depois
            };
        } else {
            console.log("Detected Standard Pro Plan Payment.");
            updateData = {
                subscription_status: isExpired ? 'expired' : 'active',
                subscription_tier: 'pro',
                is_whatsapp_plus_active: false, // Se pagou só o plano, não ganha boost (ou mantém o que tinha? Idealmente false se não tiver flag)
                // Melhor não mexer no is_whatsapp_plus_active se for false, para não remover se ele comprou separado
                // Mas como o bundle é "tudo", vamos assumir que se ele paga 97 ele quer renovar o pro.
                last_payment_date: new Date().toISOString(),
                next_due_date: activeSubscription?.nextDueDate
            };
        }

        if (activeSubscription?.customer) updateData.asaas_customer_id = activeSubscription.customer;
        if (subscriptionId) updateData.asaas_subscription_id = subscriptionId;

        const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id);

        if (updateError) {
            console.error("Supabase Update Error:", updateError.message);
            throw updateError;
        }

        console.log(`=== SUCCESS: Status Updated to ACTIVE ===`);

        return new Response(
            JSON.stringify({
                success: true,
                status: 'ACTIVE',
                subscriptionId: subscriptionId || activeSubscription?.id,
                nextDueDate: activeSubscription?.nextDueDate
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }
} else {
    // Caso não ache pagamento confirmado, marca como expired se tinha status active antes
    console.log("No confirmed payment found.");

    // Opcional: Se já tinha status active, podemos mudar para expired aqui se quisermos ser rigorosos,
    // mas melhor deixar o 'expired' vir apenas se confirmamos que a assinatura existe e está OVERDUE.

    return new Response(
        JSON.stringify({ success: false, status: 'PENDING', message: "Pagamento ainda não confirmado ou inexistente." }),
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
