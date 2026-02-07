
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { userId, email, name, paymentMethod, creditCard, creditCardHolderInfo, productType } = payload;

        if (!userId || !email) {
            throw new Error("Missing userId or email");
        }

        // --- LÓGICA DE VALORES ---
        const RECURRING_VALUE = 97.00;
        const BOOST_VALUE = 35.00;
        const totalFirstPayment = productType === 'BOOST_BUNDLE' ? (RECURRING_VALUE + BOOST_VALUE) : RECURRING_VALUE;
        const setupFee = productType === 'BOOST_BUNDLE' ? BOOST_VALUE : 0;

        console.log(`Processando checkout: ${email} | Produto: ${productType} | Total Inicial: ${totalFirstPayment} | Recorrente: ${RECURRING_VALUE}`);

        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        // 1. Buscar ou Criar Cliente
        let customerId = "";
        const customerSearchResponse = await fetch(`${ASAAS_API_URL}/customers?email=${email}`, { headers });
        const searchData = await customerSearchResponse.json();

        const realCpf = creditCardHolderInfo?.cpfCnpj?.replace(/\D/g, '') || '00000000000';
        const realPhone = creditCardHolderInfo?.phone?.replace(/\D/g, '');
        const realAddressNumber = creditCardHolderInfo?.addressNumber || '0';
        const realPostalCode = creditCardHolderInfo?.postalCode?.replace(/\D/g, '') || '00000000';

        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
            // Opcional: Atualizar dados cadastrais se necessário
        } else {
            const createCustomerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: name || email.split('@')[0],
                    email: email,
                    cpfCnpj: realCpf,
                    phone: realPhone,
                    addressNumber: realAddressNumber,
                    postalCode: realPostalCode,
                    externalReference: userId
                })
            });
            const newCustomerData = await createCustomerResponse.json();
            if (!createCustomerResponse.ok) throw new Error(newCustomerData.errors?.[0]?.description || "Erro ao criar cliente");
            customerId = newCustomerData.id;
        }

        // 2. Implementar Cobrança (Assinatura - Aceita Cartão ou Pix Automático/Manual)
        let responseData: any = {};
        const isoDate = new Date().toISOString().split('T')[0];

        // Mapeamento de Billing Type
        let billingType = 'PIX';
        if (paymentMethod === 'CREDIT_CARD') billingType = 'CREDIT_CARD';
        if (paymentMethod === 'PIX' || paymentMethod === 'PIX_AUTOMATIC') billingType = 'PIX';

        const subscriptionData: any = {
            customer: customerId,
            billingType: billingType,
            nextDueDate: isoDate,
            value: RECURRING_VALUE,
            cycle: "MONTHLY",
            description: productType === 'BOOST_BUNDLE' ? "Elite Pro + WhatsApp Boost" : "Plano Elite PRO",
            updatePendingPayments: true,
            externalReference: userId,
            ...(setupFee > 0 ? { setupFeeValue: setupFee } : {}),
            ...(paymentMethod === 'CREDIT_CARD' && creditCard ? { creditCard, creditCardHolderInfo } : {})
        };

        const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(subscriptionData)
        });
        const subResult = await subResponse.json();

        if (!subResponse.ok) {
            throw new Error(subResult.errors?.[0]?.description || "Erro ao criar assinatura");
        }

        responseData = {
            success: true,
            subscriptionId: subResult.id,
            status: subResult.status
        };

        // Se for PIX (Manual ou Automático), buscar o QR Code do primeiro pagamento
        if (billingType === 'PIX') {
            // Aguarda um pouco para o Asaas gerar a cobrança inicial
            await new Promise(r => setTimeout(r, 1000));

            const paymentsResponse = await fetch(`${ASAAS_API_URL}/payments?subscription=${subResult.id}`, { headers });
            const paymentsData = await paymentsResponse.json();
            const paymentId = paymentsData.data?.[0]?.id;

            if (paymentId) {
                const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, { headers });
                if (pixResponse.ok) {
                    const pixData = await pixResponse.json();
                    responseData.pix = pixData;
                }
            }
        }

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        console.error(`Checkout Error: ${err.message}`);
        return new Response(
            JSON.stringify({ error: err.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
