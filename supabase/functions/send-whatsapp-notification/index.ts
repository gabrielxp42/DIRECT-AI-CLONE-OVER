import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- UTILS ---

// Safe fetch with timeout
const fetchWithTimeout = async (url: string, options: any, timeout = 20000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
};

// Safe JSON parse — handles HTML error pages (502, 503 from nginx)
const safeJsonParse = async (resp: Response): Promise<any> => {
    const text = await resp.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error(`[Gabi] Non-JSON response (${resp.status}):`, text.substring(0, 200));
        return { error: true, message: `Servidor retornou erro ${resp.status}. Tente novamente em alguns segundos.`, _rawStatus: resp.status };
    }
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

// --- MAIN SERVE ---

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { orderId, status: requestedStatus, trackingCode } = await req.json();

        console.log("[Gabi] Received request for notification:", { orderId, requestedStatus });

        if (!orderId) throw new Error("Missing orderId");

        // 1. Get Order with Details
        const { data: order, error: orderError } = await supabase
            .from('pedidos')
            .select('*, clientes(*), pedido_items(*, produtos(*)), pedido_servicos(*)')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error("[Gabi] Order fetch error:", orderError?.message);
            throw new Error(`Order not found. ID: ${JSON.stringify(orderId)}. DB Error: ${orderError?.message || 'None'}`);
        }

        console.log("[Gabi] Order found:", order.order_number, "Status:", order.status);

        const statusToSend = requestedStatus || order.status;
        const clientName = order.clientes?.nome || "Cliente";
        const clientPhone = order.clientes?.telefone || "";

        if (!clientPhone) {
            console.log("[Gabi] No phone number for client. Skipping.");
            return new Response(JSON.stringify({ skipped: true, reason: "No phone" }), { headers: corsHeaders });
        }

        // Sanitizar telefone
        let phone = clientPhone.replace(/\D/g, "");
        if (phone.length === 11 && !phone.startsWith("55")) phone = "55" + phone;
        if (phone.length === 10 && !phone.startsWith("55")) phone = "55" + phone;

        // 2. Get Merchant Profile
        const { data: merchant, error: merchantError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', order.user_id)
            .single();

        if (merchantError || !merchant) {
            console.error("[Gabi] Merchant fetch error:", merchantError?.message);
            throw new Error("Merchant profile not found");
        }

        // --- TRAVA DE SEGURANÇA PLUS MODE ---
        const isPlusActive = merchant.is_whatsapp_plus_active || merchant.is_admin || merchant.subscription_tier === 'expert';
        if (!isPlusActive) {
            console.log(`[Gabi] Merchant ${merchant.id} sem WhatsApp Plus ativo. Abortando envio.`);
            return new Response(JSON.stringify({ skipped: true, reason: "Plus Mode not active" }), { headers: corsHeaders });
        }

        if (!merchant.whatsapp_instance_id) {
            console.error("[Gabi] Merchant missing instance ID");
            return new Response(JSON.stringify({ error: "Missing WhatsApp Instance ID" }), { status: 400, headers: corsHeaders });
        }

        // 3. Get Template and Replace Variables
        const template = merchant.gabi_templates?.[statusToSend];
        if (!template) {
            console.log(`[Gabi] No template found for status: ${statusToSend}`);
            return new Response(JSON.stringify({ skipped: true, reason: "No template" }), { headers: corsHeaders });
        }

        // Pre-formatar itens
        const itemsList = order.pedido_items?.map((item: any) => {
            const isLinear = item.tipo === 'dtf' || item.tipo === 'vinil';
            const unitSingular = isLinear ? 'metro' : 'unid.';
            const itemTotal = Number(item.preco_unitario || 0) * Number(item.quantidade || 0);
            const unitStr = formatCurrency(item.preco_unitario || 0);
            const totalStr = formatCurrency(itemTotal);
            return `• ${item.quantidade}x ${item.produtos?.nome || item.produto_nome || "Item"} (${unitStr}/${unitSingular}) - ${totalStr}`;
        }).join('\n') || "";

        // Adicionar serviços se houver
        let servicosStr = "";
        const servicos = order.pedido_servicos || [];
        if (servicos.length > 0) {
            servicosStr += `\n*SERVIÇOS EXTRAS*\n`;
            servicos.forEach((s: any) => {
                const lineTotal = formatCurrency(Number(s.valor_unitario) * Number(s.quantidade));
                servicosStr += `${s.nome} (${s.quantidade}x) - ${lineTotal}\n`;
            });
        }

        const subtotalProdutos = Number(order.subtotal_produtos || 0);
        const subtotalServicos = Number(order.subtotal_servicos || 0);
        const subtotal = subtotalProdutos + subtotalServicos;
        const frete = (order.tipo_entrega === 'frete' ? Number(order.valor_frete || 0) : 0);
        const descontoValor = Number(order.desconto_valor || 0);
        const descontoPercentual = Number(order.desconto_percentual || 0);
        const descontoPercentualCalculado = subtotal * (descontoPercentual / 100);
        const valorTotalCalculado = Math.max(0, subtotal + frete - descontoValor - descontoPercentualCalculado);

        const companyAddress = merchant.company_address_street
            ? `${merchant.company_address_street}, ${merchant.company_address_number}${merchant.company_address_city ? ` - ${merchant.company_address_city}` : ''}`
            : "";

        let entregaStr = "";
        if (order.tipo_entrega === 'frete') {
            if (order.valor_frete && Number(order.valor_frete) > 0) entregaStr += `FRETE: ${formatCurrency(order.valor_frete)}\n`;
            if (order.transportadora) entregaStr += `TRANSPORTADORA: ${order.transportadora.toUpperCase()}\n`;
            if (trackingCode || order.tracking_code) entregaStr += `RASTREIO: ${trackingCode || order.tracking_code}\n`;
        } else if (order.tipo_entrega === 'retirada') {
            entregaStr = "RETIRADA NO LOCAL";
        }

        const statusStr = statusToSend === 'pago' ? 'PAGO' : 'NÃO PAGO';

        const finalMessage = template
            .replace(/{{cliente}}/g, clientName)
            .replace(/{{order_number}}/g, (order.order_number || 0).toString())
            .replace(/{{tracking_code}}/g, trackingCode || order.tracking_code || "")
            .replace(/{{tracking}}/g, trackingCode || order.tracking_code || "")
            .replace(/{{total}}/g, formatCurrency(valorTotalCalculado))
            .replace(/{{subtotal}}/g, formatCurrency(subtotal))
            .replace(/{{frete_valor}}/g, formatCurrency(frete))
            .replace(/{{desconto}}/g, formatCurrency(descontoValor + descontoPercentualCalculado))
            .replace(/{{transportadora}}/g, order.transportadora || "")
            .replace(/{{endereco_empresa}}/g, companyAddress || "")
            .replace(/{{horario_empresa}}/g, merchant.company_business_hours || "08:00 às 18:00")
            .replace(/{{itens}}/g, itemsList || "Nenhum item")
            .replace(/{{servicos}}/g, servicosStr)
            .replace(/{{entrega_info}}/g, entregaStr)
            .replace(/{{status}}/g, statusStr);

        // 4. Get Admin Config for Evolution API
        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('whatsapp_api_url, whatsapp_api_key')
            .eq('is_admin', true)
            .limit(1)
            .single();

        if (!adminProfile?.whatsapp_api_url) {
            throw new Error("System WhatsApp API not configured");
        }

        const evoUrl = adminProfile.whatsapp_api_url.replace(/\/$/, "");
        const evoKey = adminProfile.whatsapp_api_key;
        const instanceId = merchant.whatsapp_instance_id;

        // 5. Send Message using Robust Logic
        const sendUrl = `${evoUrl}/message/sendText/${instanceId}`;
        const payload = {
            number: phone,
            text: finalMessage,
            linkPreview: false,
            delay: 1500
        };

        console.log(`[Gabi] Sending status notification for ${order.order_number} to ${phone}`);

        let response = await fetchWithTimeout(sendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evoKey },
            body: JSON.stringify(payload)
        }, 20000);

        let result = await safeJsonParse(response);

        // FALLBACK: Retry with + prefix if failed
        if (!response.ok || result.error) {
            console.log("[Gabi] First attempt failed, trying with + prefix...");
            payload.number = "+" + phone;
            response = await fetchWithTimeout(sendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": evoKey },
                body: JSON.stringify(payload)
            }, 20000);
            result = await safeJsonParse(response);
        }

        if (!response.ok) throw new Error(`Evolution API Error (${response.status}): ${JSON.stringify(result)}`);

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("[Gabi] Critical Notification Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
