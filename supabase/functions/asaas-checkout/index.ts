// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Configuração do Supabase
const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configurações do Asaas
let ASAAS_API_KEY = Deno.env.get('VITE_ASAAS_API_KEY') || Deno.env.get('ASAAS_API_KEY');
const ASAAS_BASE_URL = Deno.env.get('ASAAS_URL') || 'https://www.asaas.com/api/v3';

// Remover aspas extras se existirem (comum ao copiar de .env incorreto)
if (ASAAS_API_KEY) {
  ASAAS_API_KEY = ASAAS_API_KEY.replace(/^["']|["']$/g, '');
}

interface CheckoutData {
  planId: string;
  userId?: string; // Novo campo
  customerData: {
    name: string;
    email: string;
    cpfCnpj: string;
    mobilePhone: string;
  };
  billingType: string;
  remoteIp: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    phone: string;
    mobilePhone: string;
  };
}

Deno.serve(async (req: Request) => {
  // Configurar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando processamento do checkout Asaas...');

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar se a API key do Asaas está configurada
    if (!ASAAS_API_KEY) {
      console.error('❌ ASAAS_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'Configuração do Asaas não encontrada' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const checkoutData: CheckoutData = await req.json();
    console.log('📋 Dados recebidos:', JSON.stringify(checkoutData, null, 2));

    // Validar dados obrigatórios
    if (!checkoutData.customerData?.email || !checkoutData.customerData?.name) {
      return new Response(
        JSON.stringify({ error: 'Dados do cliente incompletos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Primeiro, criar ou buscar o cliente no Asaas
    let customerId: string;
    
    try {
      // Buscar cliente existente
      const searchResponse = await fetch(
        `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(checkoutData.customerData.email)}`,
        {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const searchResult = await searchResponse.json();
      
      if (searchResult.data && searchResult.data.length > 0) {
        customerId = searchResult.data[0].id;
        console.log('👤 Cliente existente encontrado:', customerId);
      } else {
        // Criar novo cliente
        const customerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
          method: 'POST',
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: checkoutData.customerData.name,
            email: checkoutData.customerData.email,
            cpfCnpj: checkoutData.customerData.cpfCnpj,
            mobilePhone: checkoutData.customerData.mobilePhone
          })
        });

        const customerResult = await customerResponse.json();
        
        if (!customerResponse.ok) {
          console.error('❌ Erro ao criar cliente:', JSON.stringify(customerResult, null, 2));
          return new Response(
            JSON.stringify({ 
              error: 'Erro ao criar cliente no Asaas',
              details: customerResult.errors || customerResult // Tenta pegar errors array direto se existir
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        customerId = customerResult.id;
        console.log('👤 Novo cliente criado:', customerId);
      }
    } catch (error) {
      console.error('❌ Erro ao processar cliente:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar dados do cliente' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Buscar dados do plano no Supabase
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', checkoutData.planId)
      .single();

    if (planError || !planData) {
      console.error('❌ Erro ao buscar plano:', planError);
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📋 Plano encontrado:', planData.name, '- R$', planData.amount);

    // Mapear frequência do plano para ciclo do Asaas
    const getCycle = (frequencyType: string) => {
      switch (frequencyType) {
        case 'monthly': return 'MONTHLY';
        case 'yearly': return 'YEARLY';
        case 'weekly': return 'WEEKLY';
        default: return 'MONTHLY';
      }
    };

    // Calcular valor com desconto para cartão de crédito
    let finalValue = parseFloat(planData.amount);
    if (checkoutData.billingType === 'CREDIT_CARD') {
      finalValue = finalValue * 0.9; // 10% de desconto
      console.log('💳 Aplicando 10% de desconto para cartão de crédito. Valor final:', finalValue);
    }

    // Ajustar data para fuso horário de Brasília (UTC-3) para garantir cobrança no mesmo dia
    const now = new Date();
    now.setHours(now.getHours() - 3);
    const today = now.toISOString().split('T')[0];

    // --- PROTEÇÃO CONTRA DUPLICIDADE ---
    // Verificar se já existe assinatura ativa ou criada recentemente (últimos 5 min) para este cliente e plano
    try {
      console.log('🔍 Verificando duplicidade de assinatura...');
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const subscriptionsResponse = await fetch(
        `${ASAAS_BASE_URL}/subscriptions?customer=${customerId}&externalReference=${checkoutData.planId}&status=ACTIVE,PENDING&limit=1`,
        {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const subscriptionsResult = await subscriptionsResponse.json();
      
      if (subscriptionsResult.data && subscriptionsResult.data.length > 0) {
        const existingSub = subscriptionsResult.data[0];
        const existingDate = new Date(existingSub.dateCreated);
        
        // Se a assinatura for muito recente (menos de 5 min) e estiver ATIVA ou PENDENTE
        if (existingDate > new Date(Date.now() - 5 * 60 * 1000)) {
           console.warn('⚠️ Assinatura duplicada detectada (criada < 5 min atrás):', existingSub.id);
            
           // Retornar a assinatura existente como se fosse uma nova, para evitar erro no frontend
           // mas buscar o pagamento dela
            
            let pixQrCode = null;
            let paymentId = null;
            let paymentObj = null;

            try {
              console.log('🔍 Buscando pagamentos da assinatura EXISTENTE...');
              const paymentsResponse = await fetch(`${ASAAS_BASE_URL}/subscriptions/${existingSub.id}/payments`, {
                headers: {
                  'access_token': ASAAS_API_KEY,
                  'Content-Type': 'application/json'
                }
              });
              
              const paymentsResult = await paymentsResponse.json();
              
              if (paymentsResult.data && paymentsResult.data.length > 0) {
                const firstPayment = paymentsResult.data[0];
                paymentId = firstPayment.id;
                paymentObj = firstPayment;
                
                if (checkoutData.billingType === 'PIX') {
                  const qrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, {
                    headers: {
                      'access_token': ASAAS_API_KEY,
                      'Content-Type': 'application/json'
                    }
                  });
                  const qrCodeResult = await qrCodeResponse.json();
                  if (qrCodeResult.encodedImage || qrCodeResult.payload) {
                    pixQrCode = qrCodeResult;
                  }
                }
              }
            } catch (err) {
               console.error('Erro ao recuperar pagamento existente:', err);
            }

           return new Response(
            JSON.stringify({
              success: true,
              subscription: existingSub,
              customerId: customerId,
              planData: planData,
              pixQrCode,
              paymentId,
              payment: paymentObj,
              isDuplicate: true // Flag informativa
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    } catch (error) {
      console.error('⚠️ Erro na verificação de duplicidade:', error);
      // Não bloquear o fluxo principal se a verificação falhar
    }
    // -----------------------------------

    // Criar a assinatura
    const subscriptionData: any = {
      customer: customerId,
      billingType: checkoutData.billingType,
      value: finalValue,
      nextDueDate: today, // Cobrança imediata (ajustado para BRT)
      cycle: getCycle(planData.frequency_type || 'monthly'),
      description: `Assinatura ${planData.name}`,
      // Formato PLAN_ID::USER_ID para o webhook identificar o usuário logado
      externalReference: checkoutData.userId 
        ? `${checkoutData.planId}::${checkoutData.userId}`
        : checkoutData.planId
    };

    // Adicionar dados do cartão de crédito se necessário
    if (checkoutData.billingType === 'CREDIT_CARD' && checkoutData.creditCard) {
      subscriptionData.creditCard = checkoutData.creditCard;
      subscriptionData.creditCardHolderInfo = checkoutData.creditCardHolderInfo;
      
      // Adicionar remoteIp se disponível
      if (checkoutData.remoteIp) {
        subscriptionData.remoteIp = checkoutData.remoteIp;
      }
    }

    console.log('🔄 Criando assinatura no Asaas...');
    const subscriptionResponse = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    const subscriptionResult = await subscriptionResponse.json();

    if (!subscriptionResponse.ok) {
      console.error('❌ Erro ao criar assinatura:', subscriptionResult);
      
      // Tratamento específico para erros de cartão de crédito
      let errorMessage = 'Erro ao processar pagamento';
      let errorDetails = subscriptionResult;
      
      if (subscriptionResult.errors) {
        const errors = subscriptionResult.errors;
        
        // Verificar erros específicos de cartão
        if (errors.some((err: any) => err.code === 'invalid_credit_card_number')) {
          errorMessage = 'Número do cartão de crédito inválido';
        } else if (errors.some((err: any) => err.code === 'invalid_credit_card_expiry_date')) {
          errorMessage = 'Data de validade do cartão inválida';
        } else if (errors.some((err: any) => err.code === 'invalid_credit_card_ccv')) {
          errorMessage = 'Código de segurança (CCV) inválido';
        } else if (errors.some((err: any) => err.code === 'credit_card_declined')) {
          errorMessage = 'Cartão de crédito recusado pela operadora';
        } else if (errors.some((err: any) => err.code === 'insufficient_funds')) {
          errorMessage = 'Cartão sem limite suficiente';
        } else if (errors.some((err: any) => err.description)) {
          errorMessage = errors[0].description;
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorDetails
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Assinatura criada com sucesso:', subscriptionResult.id);

    // Buscar o pagamento gerado (tanto para PIX quanto para Cartão) para retornar status real
    let pixQrCode = null;
    let paymentId = null;
    let paymentObj = null;

    try {
      console.log('🔍 Buscando pagamentos da assinatura...');
      // Buscar pagamentos da assinatura
      const paymentsResponse = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subscriptionResult.id}/payments`, {
        headers: {
          'access_token': ASAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      const paymentsResult = await paymentsResponse.json();
      
      if (paymentsResult.data && paymentsResult.data.length > 0) {
        // Pegar o primeiro pagamento pendente
        const firstPayment = paymentsResult.data[0];
        paymentId = firstPayment.id;
        paymentObj = firstPayment;
        
        console.log('💰 Pagamento encontrado:', paymentId, 'Status:', firstPayment.status);
        
        // Se for PIX, gerar QR Code
        if (checkoutData.billingType === 'PIX') {
          // Gerar QR Code para o pagamento
          const qrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`, {
            headers: {
              'access_token': ASAAS_API_KEY,
              'Content-Type': 'application/json'
            }
          });
          
          const qrCodeResult = await qrCodeResponse.json();
          if (qrCodeResult.encodedImage || qrCodeResult.payload) {
            pixQrCode = qrCodeResult;
            console.log('✅ QR Code PIX gerado com sucesso');
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar pagamentos/QR Code:', error);
      // Não falhar o request principal, mas logar o erro
    }

    // Salvar dados da assinatura no Supabase
    try {
      const { error: insertError } = await supabase
        .from('asaas_subscriptions')
        .insert({
          subscription_id: subscriptionResult.id,
          customer_id: customerId,
          plan_id: checkoutData.planId,
          status: subscriptionResult.status,
          value: parseFloat(planData.amount),
          cycle: subscriptionResult.cycle,
          next_due_date: subscriptionResult.nextDueDate,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('⚠️ Erro ao salvar assinatura no Supabase:', insertError);
      } else {
        console.log('💾 Assinatura salva no Supabase');
      }
    } catch (error) {
      console.error('⚠️ Erro ao salvar no Supabase:', error);
    }

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        subscription: subscriptionResult,
        customerId: customerId,
        planData: planData,
        pixQrCode, // Adicionar QR Code ao retorno
        paymentId,
        payment: paymentObj // Retornar objeto completo do pagamento
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro interno:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
