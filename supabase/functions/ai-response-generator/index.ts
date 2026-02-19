import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- UTILS ---
const TIME_ZONE = 'America/Sao_Paulo';

function getCurrentDateTime() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long'
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const weekday = getPart('weekday');

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthName = monthNames[parseInt(month!) - 1];

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    return {
        fullDate: `${day}/${month}/${year}`,
        time: `${hour}:${minute}`,
        dayOfWeek: weekday,
        current: { day, month, year, monthName },
        ranges: {
            thisMonth: { start: startOfMonth, end: endOfMonth }
        }
    };
}

// --- TOOL DEFINITIONS ---
const openAIFunctions = [
    {
        name: "get_current_date",
        description: "Obtém a data e hora atual do sistema em Rio de Janeiro.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "perform_calculation",
        description: "Realiza operações matemáticas simples (+, -, *, /).",
        parameters: {
            type: "object",
            properties: {
                expression: { type: "string", description: "Expressão matemática (ex: '100 * 0.15')" }
            },
            required: ["expression"]
        }
    },
    {
        name: "list_orders",
        description: "Lista pedidos recentes por período ou status.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                limit: { type: "number", default: 10 },
                statuses: { type: "array", items: { type: "string" } }
            }
        }
    },
    {
        name: "get_client_orders",
        description: "Busca todos os pedidos de um cliente específico pelo nome.",
        parameters: {
            type: "object",
            properties: {
                clientName: { type: "string", description: "Nome completo ou parcial do cliente" }
            },
            required: ["clientName"]
        }
    },
    {
        name: "get_order_details",
        description: "Obtém detalhes completos de um pedido pelo seu NÚMERO.",
        parameters: {
            type: "object",
            properties: {
                orderNumber: { type: "number" }
            },
            required: ["orderNumber"]
        }
    },
    {
        name: "calculate_dtf_packing",
        description: "Cálculo de aproveitamento de imagens (packing) em rolos de DTF.",
        parameters: {
            type: "object",
            properties: {
                calculation_mode: { type: "string", enum: ["quantity_in_meters", "meters_for_quantity"] },
                imageWidth: { type: "number", description: "Largura em cm" },
                imageHeight: { type: "number", description: "Altura em cm" },
                quantity: { type: "number", description: "Qtd unidades OU Metragem" },
                rollWidth: { type: "number", default: 58 }
            },
            required: ["calculation_mode", "imageWidth", "imageHeight", "quantity"]
        }
    },
    {
        name: "get_total_meters_by_period",
        description: "Total de metros rodados em um período.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" }
            }
        }
    }
];

// --- TOOL IMPLEMENTATIONS (Server-Side) ---
const org_id = profile.organization_id; // Keep it as it is in the profile (can be null)

// --- TOOL IMPLEMENTATIONS (Server-Side) ---
async function executeTool(name: string, args: any, supabase: any, user_id: string, org_id: string | null) {
    console.log(`🎯 [Tool Execution] ${name}`, args);

    switch (name) {
        case "get_current_date": {
            const dateInfo = getCurrentDateTime();
            return {
                message: `Data/Hora: ${dateInfo.fullDate} (${dateInfo.dayOfWeek}), ${dateInfo.time}`,
                current: dateInfo.current
            };
        }

        case "perform_calculation": {
            try {
                const result = Function(`"use strict"; return (${args.expression})`)();
                return { result, message: `O resultado de ${args.expression} é ${result}` };
            } catch (e) {
                return { error: "Erro no cálculo" };
            }
        }

        case "list_orders": {
            const { startDate, endDate, limit = 10, statuses } = args;
            let query = supabase.from('pedidos').select('order_number, status, valor_total, created_at, clientes(nome)');

            if (org_id) {
                query = query.eq('organization_id', org_id);
            } else {
                query = query.eq('user_id', user_id);
            }

            query = query.order('created_at', { ascending: false }).limit(limit);
            if (startDate) query = query.gte('created_at', startDate);
            if (endDate) query = query.lte('created_at', endDate);
            if (statuses && statuses.length > 0) query = query.in('status', statuses);

            const { data, error } = await query;
            if (error) console.error(`[Tool Error] list_orders:`, error);
            return { orders: data || [], count: data?.length || 0 };
        }

        case "get_client_orders": {
            const { clientName } = args;
            let clientQuery = supabase.from('clientes').select('id, nome');
            if (org_id) {
                clientQuery = clientQuery.eq('organization_id', org_id);
            } else {
                clientQuery = clientQuery.eq('user_id', user_id);
            }
            const { data: clients } = await clientQuery.ilike('nome', `%${clientName}%`).limit(5);

            if (!clients || clients.length === 0) return { message: `Cliente "${clientName}" não encontrado.` };
            if (clients.length > 1) return { message: `Encontrei vários clientes com esse nome: ${clients.map((c: any) => c.nome).join(', ')}. Qual deles?` };

            let orderQuery = supabase.from('pedidos').select('order_number, status, valor_total, created_at').eq('cliente_id', clients[0].id);
            if (org_id) {
                orderQuery = orderQuery.eq('organization_id', org_id);
            } else {
                orderQuery = orderQuery.eq('user_id', user_id);
            }
            const { data: orders } = await orderQuery.order('created_at', { ascending: false });

            return { client: clients[0].nome, orders: orders || [], count: orders?.length || 0 };
        }

        case "get_order_details": {
            const { orderNumber } = args;
            let query = supabase.from('pedidos').select('*, clientes(nome), pedido_items(*), pedido_servicos(*)').eq('order_number', orderNumber);
            if (org_id) {
                query = query.eq('organization_id', org_id);
            } else {
                query = query.eq('user_id', user_id);
            }
            const { data: order } = await query.single();

            if (!order) return { error: `Pedido #${orderNumber} não encontrado.` };
            return order;
        }

        case "get_total_meters_by_period": {
            const { startDate, endDate } = args;
            const { data, error } = await supabase.rpc('get_total_meters_by_period', {
                p_start_date: startDate || getCurrentDateTime().ranges.thisMonth.start,
                p_end_date: endDate || getCurrentDateTime().ranges.thisMonth.end,
                p_organization_id: org_id
            });
            if (error) console.error(`[Tool Error] get_total_meters:`, error);
            return data || { total_meters: 0, total_orders: 0 };
        }

        case "calculate_dtf_packing": {
            const { calculation_mode, imageWidth, imageHeight, quantity, rollWidth = 58 } = args;
            const usableWidth = rollWidth - 2;
            const separation = 0.5;
            const imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / (imageWidth + separation)));

            if (calculation_mode === 'quantity_in_meters') {
                const requestedMeters = quantity;
                const rows = Math.floor((requestedMeters * 100) / (imageHeight + separation));
                const totalQuantity = rows * imagesPerRow;
                return { totalQuantity, totalMeters: requestedMeters, imagesPerRow, message: `Em ${requestedMeters}m cabem ${totalQuantity} unidades.` };
            } else {
                const requestedQuantity = quantity;
                const rowsNeeded = Math.ceil(requestedQuantity / imagesPerRow);
                const totalMeters = (rowsNeeded * (imageHeight + separation)) / 100;
                return { totalQuantity: requestedQuantity, totalMeters: parseFloat(totalMeters.toFixed(2)), imagesPerRow, message: `Para ${requestedQuantity} unidades você precisa de ${totalMeters.toFixed(2)}m.` };
            }
        }

        default:
            return { error: "Função não disponível no servidor." };
    }
}

// 2. Handle Audio (Whisper)
let textMessage = message || "";
if (audio_base64) {
    console.log(`[Generator] Audio detected. Transcribing...`);
    const binaryString = atob(audio_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const mimeType = (audio_mimetype || "audio/ogg").split(';')[0].trim();
    const extension = mimeType.includes('ogg') ? 'ogg' : 'mp4';

    const formData = new FormData();
    formData.append('file', new Blob([bytes], { type: mimeType }), `audio.${extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
        body: formData,
    });

    if (whisperRes.ok) {
        const whisperData = await whisperRes.json();
        textMessage = whisperData.text || "";
        if (db_message_id) await supabase.from('whatsapp_messages').update({ message: `🎤 ${textMessage}` }).eq('id', db_message_id);
    }
}

// 3. Construct Context & Prompt
const dateInfo = getCurrentDateTime();
const coreInstructions = `Você é a Gabi, a inteligência central da DIRECT AI.
Hoja é ${dateInfo.fullDate} (${dateInfo.dayOfWeek}), hora atual: ${dateInfo.time}.

REGRAS: 
- NUNCA invente dados. Use as ferramentas para consultar o banco de dados.
- Seja BREVE no WhatsApp (máximo 3 frases).
- Se for o patrão (MODO EXECUTIVA 🎩), seja estratégica e use o emoji 🎩.
- Se for cliente, seja vendedora e prestativa.

REACT LOOP:
Se você precisar de informações (pedidos, cálculos, metros), CHAME AS FERRAMENTAS. Combine o pensamento com a ação.`;

let personaPrompt = is_boss
    ? `[MODO: GABI EXECUTIVA 🎩] Falando com o Dono da empresa "${profile.company_name}".`
    : `[MODO: ATENDIMENTO] Falando com o cliente "${customer_name || 'Cliente'}".`;

// Load Knowledge/Memories
const { data: memories } = await supabase.from('agent_memory').select('content, memory_type').eq('user_id', user_id).limit(10);
const memorySection = memories?.length ? `\nMEMÓRIAS:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}` : '';

const messages: any[] = [
    { role: "system", content: `${coreInstructions}\n\n${personaPrompt}${memorySection}` }
];

if (previous_history) messages.push({ role: "system", content: `Histórico recente:\n${previous_history}` });
messages.push({ role: "user", content: textMessage });

// 4. ReAct Loop Execution
let finalResponse = "";
let iterations = 0;
const MAX_ITERATIONS = 5;

while (iterations < MAX_ITERATIONS) {
    console.log(`[ReAct] Iteration ${iterations + 1}`);

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            functions: openAIFunctions,
            function_call: "auto",
            temperature: 0.7
        }),
    });

    const gptData = await gptRes.json();
    const choice = gptData.choices[0];
    const gptMsg = choice.message;

    if (gptMsg.function_call) {
        const { name, arguments: argsJson } = gptMsg.function_call;
        const args = JSON.parse(argsJson);

        messages.push(gptMsg); // Add assistant message with function call

        const result = await executeTool(name, args, supabase, user_id, org_id);

        messages.push({
            role: "function",
            name: name,
            content: JSON.stringify(result)
        });

        iterations++;
    } else {
        finalResponse = gptMsg.content;
        break;
    }
}

if (!finalResponse) finalResponse = "Desculpe, tive um problema ao processar seu pedido. Pode repetir?";

// 5. Send via Evolution API
const { data: admin } = await supabase.from('profiles').select('whatsapp_api_url, whatsapp_api_key').eq('is_admin', true).single();
if (admin && profile.whatsapp_instance_id) {
    const baseUrl = admin.whatsapp_api_url.replace(/\/$/, "");
    await fetch(`${baseUrl}/message/sendText/${profile.whatsapp_instance_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': admin.whatsapp_api_key },
        body: JSON.stringify({ number: customer_phone, text: finalResponse, linkPreview: false })
    });
}

// 6. Log & Respond
await supabase.from('whatsapp_messages').insert({
    user_id, phone: customer_phone, message: finalResponse, direction: 'sent', analyzed: true,
    analysis_result: { source: 'ai_unified_brain', iterations }
});

return new Response(JSON.stringify({ response: finalResponse }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

    } catch (error: any) {
    console.error("[Fatal Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
}
});
