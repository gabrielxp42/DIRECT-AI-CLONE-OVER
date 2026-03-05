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
        const { userId, email, name, paymentMethod, creditCard, creditCardHolderInfo, productType, amount, cpfCnpj, provider } = payload;

        if (!userId || !email) {
            throw new Error("Missing userId or email");
        }

        // --- SEGURANÇA: VALIDAR JWT ---
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }
        const token = authHeader.replace('Bearer ', '');
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            throw new Error("Invalid or expired session");
        }

        if (user.id !== userId) {
            console.error(`SECURITY VIOLATION attempt from ${user.id} to user ${userId}`);
            throw new Error("Não autorizado: ID do usuário não corresponde ao token");
        }
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('partner_code, cpf_cnpj')
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

        let selectedPrice = amount || PLAN_PRICES[productType as keyof typeof PLAN_PRICES] || PLAN_PRICES['PRO'];

        // Aplicar 15% de desconto se tiver cupom e não for recarga
        if (hasDiscount && productType !== 'REFILL') {
            console.log(`Aplicando 15% de desconto para o código: ${profile?.partner_code}`);
            selectedPrice = Number((selectedPrice * 0.85).toFixed(2));
        }

        const totalFirstPayment = selectedPrice;
        const setupFee = 0; // Taxa única removida em favor de planos mensais

        // Determinar se o desconto deve ser fixo ou via objeto de desconto (1 ciclo)
        const isPermanentDiscount = email.toLowerCase() === 'jnnnior@gmail.com';

        // Valor da assinatura para o Asaas (recorrente)
        // Se for permanente, o 'value' já é o com desconto. 
        // Se for 1 ciclo, o 'value' deve ser o cheio, e o desconto vai no objeto 'discount'.
        let subscriptionValue = selectedPrice;
        let discountObj = null;

        if (hasDiscount && !isPermanentDiscount && productType !== 'REFILL') {
            // Reverter selectedPrice para o valor cheio para a recorrência
            subscriptionValue = amount || PLAN_PRICES[productType as keyof typeof PLAN_PRICES] || PLAN_PRICES['PRO'];
            discountObj = {
                type: 'PERCENTAGE',
                value: 15,
                dueDateLimitDays: 0,
                cycles: 1
            };
        }

        console.log(`Processando checkout: ${email} | Produto: ${productType} | Cupom: ${hasDiscount ? profile?.partner_code : 'Nenhum'} | Total Inicial: ${totalFirstPayment} | Recorrente: ${productType === 'REFILL' ? 'N/A' : subscriptionValue} | Desconto 1 Mês: ${!!discountObj}`);

        const headers = {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY || ''
        };

        // --- GESTÃO DE CPF/CNPJ ---
        // Priorizar: 1. Enviado no payload (formulário), 2. Salvo no Perfil, 3. Info do Cartão
        let finalCpf = cpfCnpj?.replace(/\D/g, '') ||
            profile?.cpf_cnpj?.replace(/\D/g, '') ||
            creditCardHolderInfo?.cpfCnpj?.replace(/\D/g, '');

        if (!finalCpf && (paymentMethod === 'PIX' || paymentMethod === 'PIX_AUTOMATIC')) {
            throw new Error("CPF/CNPJ é obrigatório para pagamentos via PIX");
        }

        // Se recebemos um CPF novo e o perfil não tinha, salvar
        if (finalCpf && !profile?.cpf_cnpj) {
            console.log(`Salvando CPF/CNPJ ${finalCpf} no perfil de ${userId}`);
            await supabaseAdmin
                .from('profiles')
                .update({ cpf_cnpj: finalCpf })
                .eq('id', userId);
        }

        const realCpf = finalCpf || '00000000000';
        const realPhone = creditCardHolderInfo?.phone?.replace(/\D/g, '');
        const realAddressNumber = creditCardHolderInfo?.addressNumber || '0';
        const realPostalCode = creditCardHolderInfo?.postalCode?.replace(/\D/g, '') || '00000000';

        // 1. Buscar ou Criar Cliente
        let customerId = "";
        const customerSearchResponse = await fetch(`${ASAAS_API_URL}/customers?email=${email}`, { headers });
        const searchData = await customerSearchResponse.json();

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

        // 2. Implementar Cobrança
        let responseData: any = {};
        const isoDate = new Date().toISOString().split('T')[0];

        // Mapeamento de Billing Type
        let billingType = 'PIX';
        if (paymentMethod === 'CREDIT_CARD') billingType = 'CREDIT_CARD';
        if (paymentMethod === 'PIX' || paymentMethod === 'PIX_AUTOMATIC') billingType = 'PIX';

        if (productType === 'REFILL' || productType === 'AI_RECHARGE') {
            // Pagamento Avulso para Recarga
            const isAI = productType === 'AI_RECHARGE';
            const creditCount = payload.credits || amount; // Fallback para amount se credits não enviado

            const description = isAI
                ? `Recarga Avulsa: ${creditCount} Créditos AI`
                : `Recarga de Créditos Logística (${provider === 'frenet' ? 'Frenet' : 'SuperFrete'})`;

            const externalReference = isAI
                ? `AI_RECHARGE:${userId}:${creditCount}:${Date.now()}` // Added timestamp for uniqueness
                : `REFILL:${userId}${provider ? `:${provider}` : ''}:${Date.now()}`;


            const paymentData: any = {
                customer: customerId,
                billingType: billingType,
                value: selectedPrice,
                dueDate: isoDate,
                description,
                externalReference,
                ...(paymentMethod === 'CREDIT_CARD' && creditCard ? { creditCard, creditCardHolderInfo } : {})
            };

            const payResponse = await fetch(`${ASAAS_API_URL}/payments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(paymentData)
            });
            const payResult = await payResponse.json();

            if (!payResponse.ok) {
                throw new Error(payResult.errors?.[0]?.description || `Erro ao criar cobrança de ${isAI ? 'créditos AI' : 'recarga logística'}`);
            }

            responseData = {
                success: true,
                paymentId: payResult.id,
                status: payResult.status,
                invoiceUrl: payResult.invoiceUrl
            };

            // Se for PIX, buscar o QR Code
            if (billingType === 'PIX') {
                const pixResponse = await fetch(`${ASAAS_API_URL}/payments/${payResult.id}/pixQrCode`, { headers });
                if (pixResponse.ok) {
                    const pixData = await pixResponse.json();
                    responseData.pix = pixData;
                }
            }
        } else {
            // Assinatura (Fluxo normal)
            const subscriptionData: any = {
                customer: customerId,
                billingType: billingType,
                nextDueDate: isoDate,
                value: subscriptionValue,
                cycle: "MONTHLY",
                description: productType === 'PRO_MAX' ? "Plano DTF PRO MAX" : "Plano DTF PRO",
                updatePendingPayments: true,
                externalReference: userId,
                ...(discountObj ? { discount: discountObj } : {}),
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

            // Se for PIX, buscar o QR Code do primeiro pagamento
            if (billingType === 'PIX') {
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
