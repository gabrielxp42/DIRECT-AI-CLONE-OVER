
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
