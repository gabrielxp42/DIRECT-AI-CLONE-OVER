import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_WEBHOOK_SECRET = Deno.env.get("ASAAS_WEBHOOK_SECRET");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    console.log("=== ASAAS WEBHOOK RECEIVED ===");

    try {
        // 1. Validar Webhook Token (Segurança Crítica)
        const asaasToken = req.headers.get('asaas-access-token');
        const productionToken = "Gabriel7511@";

        if (asaasToken !== productionToken && (ASAAS_WEBHOOK_SECRET && asaasToken !== ASAAS_WEBHOOK_SECRET)) {
            console.error("Token de segurança inválido!");
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const payload = await req.json();
        const { event, payment } = payload;
        console.log("Event Type:", event);
        console.log("Payment ID:", payment?.id);
        console.log("External Reference:", payment?.externalReference);

        // PAYMENT_CONFIRMED ou PAYMENT_RECEIVED para o primeiro pagamento
        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            const externalReference = payment.externalReference || payload.subscription?.externalReference;
            const customerId = payment.customer;

            console.log(`Processando pagamento para: ${payment.customerEmail || externalReference}`);

            if (externalReference) {
                const { error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_tier: 'pro',
                        asaas_customer_id: customerId,
                        asaas_subscription_id: payment.subscription || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', externalReference);

                if (updateError) {
                    console.error("Erro ao atualizar profile por ID:", updateError);
                } else {
                    console.log("Profile atualizado com sucesso por ID");
                }
            }
        }

        // SUBSCRIPTION_DELETED ou SUBSCRIPTION_INACTIVATED
        if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
            const subscriptionId = payload.subscription?.id;
            const externalReference = payload.subscription?.externalReference;

            console.log(`Cancelando assinatura: ${subscriptionId} para: ${externalReference}`);

            if (externalReference) {
                const { error: deactivateError } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'expired',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', externalReference);

                if (deactivateError) {
                    console.error("Erro ao desativar profile:", deactivateError);
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        console.error("Webhook Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
