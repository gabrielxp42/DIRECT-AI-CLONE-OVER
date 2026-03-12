
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_WEBHOOK_SECRET = Deno.env.get("ASAAS_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Função auxiliar para enviar e-mail ao Administrador via Resend
async function sendAdminEmail(subject: string, htmlContent: string) {
    try {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
            console.error("[ADMIN EMAIL] Erro: RESEND_API_KEY não configurada.");
            return;
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: 'Direct AI <contato@iadirect.com.br>',
                to: ['gabrielxp45@gmail.com'],
                subject: subject,
                html: htmlContent
            })
        });

        if (!res.ok) {
            const error = await res.json();
            console.error("[ADMIN EMAIL] Erro ao enviar para Resend:", error);
        } else {
            console.log(`[ADMIN EMAIL] Notificação enviada para gabrielxp45@gmail.com: ${subject}`);
        }
    } catch (e) {
        console.error("[ADMIN EMAIL] Erro na função sendAdminEmail:", e.message);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const asaasToken = req.headers.get('asaas-access-token');
        const productionToken = "Gabriel7511@";

        if (asaasToken !== productionToken && (ASAAS_WEBHOOK_SECRET && asaasToken !== ASAAS_WEBHOOK_SECRET)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const payload = await req.json();
        const { event, payment } = payload;

        console.log(`ASAAS WEBHOOK: Event=${event} | PaymentId=${payment?.id}`);

        const isAuthEvent = event.startsWith('PIX_AUTOMATIC_RECURRING_AUTHORIZATION') || event.startsWith('PIX_AUTOMATIC_AUTHORIZATION');
        const isPaymentEvent = event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED' || event === 'PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED';

        if (isAuthEvent || isPaymentEvent) {
            const asaasObject = isAuthEvent ? payload.pixAutomaticAuthorization : payment;
            const externalReference = asaasObject?.externalReference || payload.subscription?.externalReference || payload.pixAutomaticAuthorization?.externalReference;
            const customerId = asaasObject?.customer || payload.pixAutomaticAuthorization?.customer;

            if (externalReference) {
                // --- LÓGICA DE RECARGA DE CRÉDITOS ---
                if (externalReference.startsWith('REFILL:')) {
                    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
                        const referenceParts = externalReference.split(':');
                        const userId = referenceParts[1];
                        const provider = referenceParts[2] || 'superfrete';
                        const amount = payment?.value || 0;

                        console.log(`RECARGA DETECTADA: User=${userId} | Provider=${provider} | Valor=${amount} | Pagamento=${payment?.id}`);

                        // Usar RPC para garantir Atomicidade e Idempotência (Trava de pagamento duplicado)
                        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('process_wallet_recharge', {
                            p_user_id: userId,
                            p_amount: amount,
                            p_asaas_payment_id: payment?.id,
                            p_description: `Recarga via Asaas (${provider === 'frenet' ? 'Frenet' : 'SuperFrete'})`,
                            p_provider: provider
                        });

                        if (rpcError) {
                            console.error(`Erro ao processar recarga via RPC: ${rpcError.message}`);
                            throw rpcError;
                        }

                        if (rpcResult.success) {
                            console.log(`Recarga concluída com sucesso para ${userId}. Novo saldo: ${rpcResult.new_balance}`);
                            
                            // Notificar BOSS via E-mail
                            const { data: userProfile } = await supabaseAdmin.from('profiles').select('company_name, email').eq('id', userId).single();
                            const userName = userProfile?.company_name || userProfile?.email || userId;
                            const currencyValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
                            
                            await sendAdminEmail(
                                `💰 RECARGA DE LOGÍSTICA: ${userName}`,
                                `
                                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h2 style="color: #10b981;">💰 Recarga de Logística Realizada</h2>
                                    <p><strong>Usuário:</strong> ${userName} (${userProfile?.email || 'N/A'})</p>
                                    <p><strong>Provedor:</strong> ${provider === 'frenet' ? 'Frenet' : 'SuperFrete'}</p>
                                    <p><strong>Valor:</strong> ${currencyValue}</p>
                                    <p><strong>Status:</strong> Saldo atualizado no sistema.</p>
                                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                                    <small style="color: #666;">Notificação automática Direct AI</small>
                                </div>
                                `
                            );
                        } else {
                            console.log(`Recarga ignorada ou falhou: ${rpcResult.message} (${rpcResult.reason})`);
                        }
                    }
                    return new Response(JSON.stringify({ success: true, type: 'refill' }), { headers: corsHeaders, status: 200 });
                }

                if (externalReference.startsWith('AI_RECHARGE:')) {
                    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
                        const referenceParts = externalReference.split(':');
                        const userId = referenceParts[1];
                        const amountStr = referenceParts[2];
                        const amount = parseInt(amountStr || "0");

                        console.log(`RECARGA AI DETECTADA: User=${userId} | Créditos=${amount} | Pagamento=${payment?.id}`);

                        const { error: rpcError } = await supabaseAdmin.rpc('add_ai_credits', {
                            p_user_id: userId,
                            p_amount: amount,
                            p_payment_id: payment?.id
                        });

                        if (rpcError) {
                            console.error(`Erro ao processar recarga AI via RPC: ${rpcError.message}`);
                            throw rpcError;
                        }

                        console.log(`Recarga AI concluída com sucesso para ${userId}.`);

                        // Notificar BOSS via E-mail
                        const { data: userProfile } = await supabaseAdmin.from('profiles').select('company_name, email').eq('id', userId).single();
                        const userName = userProfile?.company_name || userProfile?.email || userId;
                        
                        await sendAdminEmail(
                            `💎 RECARGA DE CRÉDITOS AI: ${userName}`,
                            `
                            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                <h2 style="color: #8b5cf6;">💎 Recarga de Créditos AI</h2>
                                <p><strong>Usuário:</strong> ${userName} (${userProfile?.email || 'N/A'})</p>
                                <p><strong>Quantidade:</strong> ${amount} Créditos</p>
                                <p><strong>Status:</strong> Liberado instantaneamente.</p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                                <small style="color: #666;">Notificação automática Direct AI</small>
                            </div>
                            `
                        );
                    }
                    return new Response(JSON.stringify({ success: true, type: 'ai_recharge' }), { headers: corsHeaders, status: 200 });
                }

                // --- LÓGICA DE ASSINATURA (FLUXO ORIGINAL) ---
                const updatePayload: any = {
                    subscription_status: 'active',
                    asaas_customer_id: customerId,
                    updated_at: new Date().toISOString(),
                };

                // Detecção de Bundle/Tier pelo campo description
                const desc = (asaasObject?.description || payment?.description || payload.subscription?.description || "").toUpperCase();
                const isProMax = desc.includes("PRO MAX") || desc.includes("BOOST") || desc.includes("BUNDLE");
                const isElite = desc.includes("ELITE");

                if (isElite) {
                    updatePayload.subscription_tier = 'elite';
                } else if (isProMax) {
                    updatePayload.subscription_tier = 'pro_max';
                } else {
                    updatePayload.subscription_tier = 'pro';
                }

                // Regra Fev/2026: WhatsApp Plus é EXCLUSIVO de Pro Max e Elite.
                // Códigos de parceiro dão desconto mas NÃO liberam esse recurso no plano Pro.
                if (isProMax || isElite) {
                    updatePayload.is_whatsapp_plus_active = true;
                    console.log(`WhatsApp Plus ativado para ${externalReference} via Tier ${updatePayload.subscription_tier}`);
                } else {
                    updatePayload.is_whatsapp_plus_active = false;
                    console.log(`WhatsApp Plus desativado para ${externalReference} (Plano PRO)`);
                }

                if (isAuthEvent) {
                    updatePayload.asaas_subscription_id = asaasObject.id;
                    if (asaasObject.nextDueDate) {
                        updatePayload.next_billing_date = new Date(asaasObject.nextDueDate).toISOString();
                    }
                } else if (payment?.subscription) {
                    updatePayload.asaas_subscription_id = payment.subscription;
                    if (payment.dueDate) {
                        const nextDate = new Date(payment.dueDate);
                        nextDate.setMonth(nextDate.getMonth() + 1);
                        updatePayload.next_billing_date = nextDate.toISOString();
                    }
                }

                await supabaseAdmin.from('profiles').update(updatePayload).eq('id', externalReference);
                console.log(`Profile ${externalReference} ativado via ${event}`);

                // --- CONCEDER CRÉDITOS MENSAIS (150) ---
                // Se for confirmação de pagamento de assinatura (ou autorização PIX)
                if (isAuthEvent || (isPaymentEvent && payment?.subscription)) {
                    const paymentId = isAuthEvent ? `AUTH_${asaasObject.id}` : payment.id;
                    console.log(`Concedendo 150 créditos mensais para ${externalReference}. Pagamento: ${paymentId}`);

                    await supabaseAdmin.rpc('add_ai_credits', {
                        p_user_id: externalReference,
                        p_amount: 150,
                        p_payment_id: paymentId,
                        p_description: 'Créditos Mensais do Plano'
                    });
                }
            }
        }

        if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED' || event === 'PIX_AUTOMATIC_AUTHORIZATION_CANCELED' || event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_REFUNDED') {
            const obj = payload.subscription || payload.pixAutomaticAuthorization || payment;
            const externalReference = obj?.externalReference;

            if (externalReference) {
                await supabaseAdmin.from('profiles').update({
                    subscription_status: 'expired',
                    updated_at: new Date().toISOString(),
                }).eq('id', externalReference);
                console.log(`Profile ${externalReference} desativado via ${event}`);
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });

    } catch (err: any) {
        console.error("Webhook Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 400 });
    }
});
