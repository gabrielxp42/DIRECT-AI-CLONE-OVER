import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

        // --- BUSCAR PERFIL PARA VERIFICAR CUPOM ---
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('partner_code')
            .eq('id', userId)
            .single();

        const validUniversalCodes = ['DTFAGUDOS'];
        let hasDiscount = false;

        if (profile?.partner_code) {
            const normalizedCode = profile.partner_code.toUpperCase();
            if (validUniversalCodes.includes(normalizedCode)) {
                hasDiscount = true;
            } else {
                // Check if it's a valid internal affiliate
                const { data: affiliate } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('affiliate_code', normalizedCode)
                    .eq('is_affiliate', true)
                    .single();

                if (affiliate) {
                    hasDiscount = true;
                }
            }
        }

        // --- LÓGICA DE VALORES ---
        const PLAN_PRICES = {
            'PRO': 97.00,
            'PRO_MAX': 137.00
        };

        let selectedPrice = PLAN_PRICES[productType as keyof typeof PLAN_PRICES] || PLAN_PRICES['PRO'];

        // Aplicar 15% de desconto se tiver cupom
        if (hasDiscount) {
            console.log(`Aplicando 15% de desconto para o código: ${profile?.partner_code}`);
            selectedPrice = Number((selectedPrice * 0.85).toFixed(2));
        }

        const totalFirstPayment = selectedPrice;
        const setupFee = 0; // Taxa única removida em favor de planos mensais

        console.log(`Processando checkout: ${email} | Produto: ${productType} | Cupom: ${hasDiscount ? profile?.partner_code : 'Nenhum'} | Total Inicial: ${totalFirstPayment} | Recorrente: ${selectedPrice}`);

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
            value: selectedPrice,
            cycle: "MONTHLY",
            description: productType === 'PRO_MAX' ? "Plano DTF PRO MAX" : "Plano DTF PRO",
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
