
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3"; // MODO SANDBOX

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, email, returnUrl } = await req.json();

        if (!userId || !email) {
            throw new Error("Missing userId or email");
        }

        // 1. Criar ou buscar cliente no Asaas (Simplificado para o link)
        // Para Payment Links, o Asaas pode coletar os dados do cliente no próprio link.
        // Mas vamos criar um link de pagamento fixo para o plano Pro.

        const paymentLinkData = {
            name: "Plano Profissional DTF - Gabi AI",
            description: "Acesso total às ferramentas de IA, gestão de pedidos e estoque.",
            chargeType: "RECURRENT", // Assinatura
            billingType: "UNDEFINED", // Permite Cartão e PIX
            subscriptionCycle: "MONTHLY",
            value: 47.00,
            notificationDisabled: false,
            callback: {
                successUrl: `${returnUrl}?success=true`,
                autoRedirect: true
            }
        };

        console.log("Criando link de pagamento no Asaas...");

        const response = await fetch(`${ASAAS_API_URL}/paymentLinks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY || ''
            },
            body: JSON.stringify(paymentLinkData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro Asaas:", data);
            throw new Error(data.errors?.[0]?.description || "Erro ao criar link no Asaas");
        }

        // Adicionamos o userId no metadado do link não é possível diretamente no objeto de link,
        // mas o webhook receberá o paymentLinkID que vincularemos no banco depois ou usaremos o email.

        return new Response(
            JSON.stringify({ url: data.url, id: data.id }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
