
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
    try {
        const body = await req.json();
        const event = body.event;
        const payment = body.payment;

        console.log(`Webhook Asaas Recebido: ${event}`, payment);

        // Mapeamento de eventos do Asaas
        // PAYMENT_CONFIRMED ou PAYMENT_RECEIVED para o primeiro pagamento
        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            const email = payment.customerEmail;

            if (email) {
                // Buscar perfil pelo email
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .single();

                if (profile) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            subscription_status: 'active',
                            subscription_tier: 'pro',
                            asaas_customer_id: payment.customer,
                            asaas_subscription_id: payment.subscription || null
                        })
                        .eq('id', profile.id);

                    console.log(`Assinatura ativada para: ${email}`);
                }
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
