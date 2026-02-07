
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";
// MODO PRODUÇÃO

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

        // --- PREÇOS E DESCRIÇÕES ---
        let value = 97.00;
        let description = "Plano Profissional DTF - Gabi AI";

        if (productType === 'BOOST') {
            value = 27.00;
            description = "Boost WhatsApp Plus - Gabi AI";
        }

        // --- SEGURANÇA: LOG FILTRADO ---
        // Nunca logar o payload completo se houver cartão
        console.log(`Processando checkout para: ${email} | Produto: ${productType || 'PRO'} | Valor: ${value}`);

        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        // 1. Buscar ou Criar Cliente
        let customerId = "";
        const customerSearchResponse = await fetch(`${ASAAS_API_URL}/customers?email=${email}`, {
            method: 'GET',
            headers
        });
        const searchData = await customerSearchResponse.json();

        // Determines if we have real data to use
        const realCpf = creditCardHolderInfo?.cpfCnpj?.replace(/\D/g, '') || '00000000000'; // Default placeholder if missing, but ideally passed from frontend

        const realPhone = creditCardHolderInfo?.phone && creditCardHolderInfo.phone !== '00000000000'
            ? creditCardHolderInfo.phone
            : undefined;

        const realAddressNumber = creditCardHolderInfo?.addressNumber !== '0'
            ? creditCardHolderInfo?.addressNumber
            : undefined;

        const realPostalCode = creditCardHolderInfo?.postalCode !== '00000000'
            ? creditCardHolderInfo?.postalCode
            : undefined;

        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
            // Update customer with real data if provided, otherwise keep/update with generated for Sandbox
            if (paymentMethod === 'CREDIT_CARD') {
                await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        cpfCnpj: realCpf,
                        phone: realPhone,
                        addressNumber: realAddressNumber,
                        postalCode: realPostalCode
                    })
                });
            }
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

        // 2. Criar Assinatura
        // 2. Lógica de Cobrança (Assinatura vs Pagamento Único)
        let responseData: any = {};
        const dueDate = new Date(Date.now()); // Vence hoje
        const isoDate = dueDate.toISOString().split('T')[0];

        // Caso 1: Bundle (Pro + Boost) = R$ 132,00 (Cobrança Única "Setup Fee" + 1º Mês)
        // O sistema depois deve criar a assinatura recorrente de R$ 97 via webhook ou job, ou o cliente assina mês que vem.
        // Para simplificar, cobramos R$ 132 agora como Pagamento Único.
        if (productType === 'BOOST_BUNDLE') {
            value = 132.00;
            description = "Plano Elite Pro + WhatsApp Boost (Acesso Imediato)";

            const paymentBody = {
                customer: customerId,
                billingType: paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
                dueDate: isoDate,
                value: value,
                description: description,
                externalReference: userId,
                ...(paymentMethod === 'CREDIT_CARD' && creditCard ? { creditCard, creditCardHolderInfo } : {})
            };

            const payResponse = await fetch(`${ASAAS_API_URL}/payments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(paymentBody)
            });
            const payResult = await payResponse.json();
            if (!payResponse.ok) throw new Error(payResult.errors?.[0]?.description || "Erro ao criar cobrança Bundle");

            responseData = {
                success: true,
                paymentId: payResult.id, // Retornamos paymentId em vez de subscriptionId
                status: payResult.status
            };

            // Se for PIX, já buscar o QR Code
            if (paymentMethod === 'PIX') {
                const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${payResult.id}/pixQrCode`, { headers });
                if (pixResponse.ok) responseData.pix = await pixResponse.json();
            }
        }
        // Caso 2: Boost Only (Upgrade) = R$ 35,00 (Pagamento Único)
        else if (productType === 'BOOST_ONLY') {
            // ... Lógica similar ao Bundle, mas valor 35
            // Implementar se necessário, por enquanto fcamos no bundle
        }
        // Caso 3: Padrão PRO = R$ 97,00 (Assinatura Mensal)
        else {
            const subscriptionData: any = {
                customer: customerId,
                billingType: paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
                nextDueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 dias pra pagar
                value: 97.00,
                cycle: "MONTHLY",
                description: "Assinatura Plano PRO - Mensal",
                updatePendingPayments: true,
                externalReference: userId,
                ...(paymentMethod === 'CREDIT_CARD' && creditCard ? { creditCard, creditCardHolderInfo } : {})
            };

            const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(subscriptionData)
            });
            const subResult = await subResponse.json();
            if (!subResponse.ok) throw new Error(subResult.errors?.[0]?.description || "Erro ao criar assinatura");

            responseData = {
                success: true,
                subscriptionId: subResult.id,
                status: subResult.status
            };

            // Buscar PIX da primeira cobrança da assinatura
            if (paymentMethod === 'PIX') {
                const paymentsResponse = await fetch(`${ASAAS_API_URL}/payments?subscription=${subResult.id}`, { headers });
                const paymentsData = await paymentsResponse.json();
                const paymentId = paymentsData.data?.[0]?.id;
                if (paymentId) {
                    const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, { headers });
                    if (pixResponse.ok) responseData.pix = await pixResponse.json();
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
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
