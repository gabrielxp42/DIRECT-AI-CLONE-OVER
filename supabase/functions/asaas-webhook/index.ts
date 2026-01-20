
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("MY_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
    try {
        const body = await req.json();
        const event = body.event;
        const payment = body.payment;

        console.log(`Webhook Asaas Recebido: ${event}`, payment);

        // PAYMENT_CONFIRMED ou PAYMENT_RECEIVED para o primeiro pagamento
        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            const email = payment.customerEmail;
            const externalReference = payment.externalReference || body.subscription?.externalReference;
            const customerId = payment.customer;

            console.log(`Processando pagamento para: ${email || externalReference}`);

            // 1. Tentar buscar por externalReference (mais seguro)
            let profileId = null;
            if (externalReference) {
                const { data } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', externalReference)
                    .single();
                if (data) profileId = data.id;
            }

            // 2. Fallback para busca por email
            if (!profileId && email) {
                const { data } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single();
                if (data) profileId = data.id;
            }

            if (profileId) {
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_tier: 'pro',
                        asaas_customer_id: customerId,
                        asaas_subscription_id: payment.subscription || body.subscription?.id || null
                    })
                    .eq('id', profileId);

                if (error) throw error;
                console.log(`Assinatura ativada com sucesso para o perfil: ${profileId}`);
            } else {
                console.warn(`Aviso: Perfil não encontrado para o pagamento: ${email} / ${externalReference}`);
            }
        }

        // Eventos de Assinatura
        if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
            const subscriptionId = body.subscription?.id;
            if (subscriptionId) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ subscription_status: 'expired' })
                    .eq('asaas_subscription_id', subscriptionId);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });

    } catch (err) {
        console.error(`Erro Webhook Asaas: ${err.message}`);
        return new Response(`Error: ${err.message}`, { status: 400 });
    }
});
