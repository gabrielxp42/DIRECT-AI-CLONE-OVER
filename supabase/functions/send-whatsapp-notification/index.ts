import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { orderId } = await req.json();

        if (!orderId) throw new Error("Missing orderId");

        // 1. Get Order
        const { data: order, error: orderError } = await supabase
            .from('pedidos')
            .select('*, clientes(*)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) throw new Error("Order not found");

        const clientName = order.clientes?.nome || "Cliente";
        const clientPhone = order.clientes?.telefone || "";

        if (!clientPhone) return new Response(JSON.stringify({ skipped: true, reason: "No phone" }), { headers: corsHeaders });

        // Sanitizar telefone (apenas números)
        let phone = clientPhone.replace(/\D/g, "");
        // Se não tiver 55, adicionar (assumindo BR)
        if (phone.length === 11 && !phone.startsWith("55")) phone = "55" + phone;
        if (phone.length === 10 && !phone.startsWith("55")) phone = "55" + phone;

        // 2. Get Merchant Profile (Operator)
        const { data: merchant, error: merchantError } = await supabase
            .from('profiles')
            .select('whatsapp_instance_id, whatsapp_instance_token, whatsapp_status')
            .eq('id', order.user_id)
            .single();

        if (merchantError || !merchant) throw new Error("Merchant profile not found");

        // Se estiver desconectado de vez, aí sim paramos
        if (merchant.whatsapp_status === 'disconnected' || !merchant.whatsapp_instance_id) {
            return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { status: 400, headers: corsHeaders });
        }

        // 3. Get Admin Config for Evolution API URL/Key
        const { data: adminProfile, error: adminError } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .neq('whatsapp_api_url', null)
            .limit(1)
            .single();

        if (adminError || !adminProfile) throw new Error("System WhatsApp API not configured");

        const evoUrl = adminProfile.whatsapp_api_url.replace(/\/$/, "");
        const evoKey = adminProfile.whatsapp_api_key;
        const instanceId = merchant.whatsapp_instance_id;

        // 4. Send Message
        const message = `Olá ${clientName}! 👋\n\nSeu pedido *#${order.order_number}* está pronto para retirada! 🎉\n\nPode vir buscar quando quiser. Se tiver dúvidas, é só responder aqui.`;

        // Na v2, o endpoint de texto é /message/sendText/{instance}
        const sendUrl = `${evoUrl}/message/sendText/${instanceId}`;
        console.log(`Attempting send to ${phone} via ${sendUrl}`);

        const response = await fetch(sendUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": evoKey
            },
            body: JSON.stringify({
                number: phone,
                text: message,
                linkPreview: false
            })
        });

        const result = await response.json();
        console.log("v2 Send Response:", result);

        if (!response.ok) {
            throw new Error(`Evolution v2 Error (${response.status}): ${JSON.stringify(result)}`);
        }

        return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (error: any) {
        console.error("Critical Send Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
