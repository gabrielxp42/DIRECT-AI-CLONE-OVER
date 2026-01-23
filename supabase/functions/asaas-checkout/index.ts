
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
        const { userId, email, name, paymentMethod, creditCard, creditCardHolderInfo } = payload;

        if (!userId || !email) {
            throw new Error("Missing userId or email");
        }

        // --- SEGURANÇA: LOG FILTRADO ---
        // Nunca logar o payload completo se houver cartão
        console.log(`Processando checkout para: ${email} | Método: ${paymentMethod || 'UNDEFINED'}`);

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
        const subscriptionData: any = {
            customer: customerId,
            billingType: paymentMethod === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX',
            nextDueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
            value: 47.00,
            cycle: "MONTHLY",
            description: "Plano Profissional DTF - Gabi AI",
            updatePendingPayments: true,
            externalReference: userId
        };

        if (paymentMethod === 'CREDIT_CARD' && creditCard) {
            subscriptionData.creditCard = creditCard;
            subscriptionData.creditCardHolderInfo = creditCardHolderInfo;
        }

        const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(subscriptionData)
        });

        const subResult = await subResponse.json();
        if (!subResponse.ok) {
            console.error("Erro Subscrição Asaas:", subResult.errors?.[0]?.description);
            throw new Error(subResult.errors?.[0]?.description || "Erro ao processar assinatura");
        }

        // 3. Buscar PIX se necessário
        let pixData = null;
        if (paymentMethod === 'PIX' || !paymentMethod) {
            const paymentsResponse = await fetch(`${ASAAS_API_URL}/payments?subscription=${subResult.id}`, {
                method: 'GET',
                headers
            });
            const paymentsData = await paymentsResponse.json();
            const paymentId = paymentsData.data?.[0]?.id;

            if (paymentId) {
                const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
                    method: 'GET',
                    headers
                });
                if (pixResponse.ok) {
                    pixData = await pixResponse.json();
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                subscriptionId: subResult.id,
                pix: pixData,
                status: subResult.status
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

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
