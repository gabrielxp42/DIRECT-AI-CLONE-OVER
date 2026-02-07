
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

    try {
        // 1. Validar Auth Header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing Authorization header");

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) throw new Error("Auth failed or user not found");

        console.log("User authenticated:", user.id);

        // 2. Parse body
        let subscriptionId = null;
        let paymentId = null;
        let authorizationId = null;

        try {
            const body = await req.text();
            if (body) {
                const payload = JSON.parse(body);
                subscriptionId = payload.subscriptionId;
                paymentId = payload.paymentId;
                authorizationId = payload.authorizationId;
            }
        } catch (parseError) {
            console.log("No body or invalid JSON");
        }

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
        if (!paymentConfirmed && subscriptionId) {
            console.log("Fetching payments for specific subscription:", subscriptionId);
            const response = await fetch(`${ASAAS_API_URL}/payments?subscription=${subscriptionId}`, { headers });
            const pData = await response.json();

            if (pData.data && pData.data.length > 0) {
                const confirmedPayment = pData.data.find((p: any) =>
                    p.status === 'RECEIVED' || p.status === 'CONFIRMED'
                );

                if (confirmedPayment) {
                    paymentConfirmed = true;
                    isBundlePayment = confirmedPayment.description?.includes("Boost") || confirmedPayment.description?.includes("Bundle");
                }
            }

            const subResp = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, { headers });
            if (subResp.ok) activeSubscription = await subResp.json();
        }

        // CASE C: Authorization ID (Pix Automático)
        if (!paymentConfirmed && authorizationId) {
            console.log("Verifying Authorization ID:", authorizationId);
            const authResponse = await fetch(`${ASAAS_API_URL}/pix/automatic/authorizations/${authorizationId}`, { headers });
            const authData = await authResponse.json();

            if (authData.status === 'ACTIVE' || authData.status === 'APPROVED') {
                paymentConfirmed = true;
                const pResp = await fetch(`${ASAAS_API_URL}/payments?customer=${authData.customer}&externalReference=${user.id}&limit=5`, { headers });
                const pData = await pResp.json();
                const confirmedP = pData.data?.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
                if (confirmedP) {
                    isBundlePayment = confirmedP.description?.includes("Boost") || confirmedP.description?.includes("Bundle");
                }

                activeSubscription = {
                    id: authData.id,
                    customer: authData.customer,
                    status: authData.status,
                    nextDueDate: authData.nextDueDate || authData.startDate
                };
            }
        }

        // Fallback: Busca por externalReference
        if (!paymentConfirmed) {
            const payResponse = await fetch(`${ASAAS_API_URL}/payments?externalReference=${user.id}&limit=5`, { headers });
            const payData = await payResponse.json();
            const confirmedPay = payData.data?.find((p: any) => p.status === 'RECEIVED' || p.status === 'CONFIRMED');

            if (confirmedPay) {
                paymentConfirmed = true;
                isBundlePayment = confirmedPay.description?.includes("Boost") || confirmedPay.description?.includes("Bundle");
            } else {
                const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions?externalReference=${user.id}&limit=5`, { headers });
                const subData = await subResponse.json();
                if (subData.data && subData.data.length > 0) {
                    for (const sub of subData.data) {
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
        }

        // 5. Atualizar Supabase
        if (paymentConfirmed) {
            let isExpired = false;
            let nextDueDate = null;

            if (activeSubscription) {
                nextDueDate = activeSubscription.nextDueDate || activeSubscription.dueDate;
                if (nextDueDate) {
                    const today = new Date();
                    const nextDate = new Date(nextDueDate);
                    const toleranceDate = new Date(nextDate);
                    toleranceDate.setDate(toleranceDate.getDate() + 3);
                    isExpired = today > toleranceDate && (activeSubscription.status === 'OVERDUE' || activeSubscription.status === 'EXPIRED');
                }
            }

            let updateData: any = {
                subscription_status: isExpired ? 'expired' : 'active',
                subscription_tier: 'pro',
                last_payment_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (isBundlePayment) updateData.is_whatsapp_plus_active = true;
            if (nextDueDate) updateData.next_due_date = nextDueDate;
            if (activeSubscription?.customer) updateData.asaas_customer_id = activeSubscription.customer;
            if (subscriptionId) updateData.asaas_subscription_id = subscriptionId;
            if (authorizationId) updateData.asaas_subscription_id = authorizationId;

            await supabase.from('profiles').update(updateData).eq('id', user.id);

            return new Response(JSON.stringify({
                success: true,
                status: updateData.subscription_status.toUpperCase(),
                subscriptionId: subscriptionId || authorizationId || activeSubscription?.id,
                nextDueDate: nextDueDate
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        } else {
            return new Response(JSON.stringify({ success: false, status: 'PENDING' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
});
