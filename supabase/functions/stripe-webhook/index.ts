
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY") || "", {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
    // CORS Handling (Permite que o browser fale com a função em localhost para testes)
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        })
    }

    // 1. Log de Entrada
    console.log("Webhook recebeu requisição: " + req.method);

    // Parse Body for Signature Check
    try {
        const signature = req.headers.get("Stripe-Signature");
        // Permitir testes manuais (ping) sem assinatura SE for explicitamente um teste
        const bodyText = await req.text();
        let event;

        if (!signature) {
            // Se for um ping de teste do console do navegador, responda OK
            try {
                const json = JSON.parse(bodyText);
                if (json.test_ping) {
                    return new Response("Webhook is ALIVE and reachable!", {
                        status: 200,
                        headers: { 'Access-Control-Allow-Origin': '*' }
                    });
                }
            } catch (e) {
                // Not JSON ignore
            }

            console.error("Erro: Header Stripe-Signature ausente e não é ping.");
            return new Response("Missing signature", { status: 400 });
        }

        // 2. Verificação de Chaves Reais
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
        if (!webhookSecret) {
            console.error("Erro Crítico: STRIPE_WEBHOOK_SECRET não configurado no Supabase.");
            return new Response("Configuração Incompleta no Servidor", { status: 500 });
        }

        event = await stripe.webhooks.constructEventAsync(
            bodyText,
            signature,
            webhookSecret,
            undefined,
            cryptoProvider
        );

        // 3. Processamento do Evento
        console.log(`Evento Recebido: ${event.type}`);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userId = session.client_reference_id;
            const customerEmail = session.customer_details?.email;

            console.log(`Dados do Checkout -> UserID: ${userId}, Email: ${customerEmail}, CustomerID: ${session.customer}`);

            if (userId) {
                const supabaseAdmin = createClient(
                    Deno.env.get("SUPABASE_URL") ?? "",
                    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
                );

                // Tenta atualizar e LOGA o resultado
                const { data, error } = await supabaseAdmin
                    .from('profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_tier: 'pro',
                        trial_start_date: new Date().toISOString(),
                        stripe_customer_id: session.customer as string
                    })
                    .eq('id', userId)
                    .select();

                if (error) {
                    console.error('ERRO AO ATUALIZAR BANCO:', error);
                    return new Response("Database Error", { status: 500 });
                }

                console.log('Sucesso! Perfil Atualizado:', data);
            } else {
                console.warn('ALERTA: Checkout sem client_reference_id (ID do usuário). O link foi gerado corretamente?');
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error(`Erro Geral no Webhook: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
});
