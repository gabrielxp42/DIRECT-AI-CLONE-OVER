import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TIME_ZONE = 'America/Sao_Paulo';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- UTILS ---

function removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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

    const dayStr = getPart('day') || '1';
    const monthStr = getPart('month') || '1';
    const yearStr = getPart('year') || '2024';
    const hour = getPart('hour');
    const minute = getPart('minute');
    const weekday = getPart('weekday');

    const day = parseInt(dayStr);
    const month = parseInt(monthStr);
    const year = parseInt(yearStr);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthName = monthNames[month - 1];

    const startOfRioMonth = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
    const endOfRioMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    return {
        fullDate: `${dayStr}/${monthStr}/${yearStr}`,
        time: `${hour}:${minute}`,
        dayOfWeek: weekday,
        current: { day, month, year, monthName },
        ranges: {
            thisMonth: { start: startOfRioMonth, end: endOfRioMonth }
        }
    };
}

// --- HELPER FUNCTIONS ---
async function findOrderByNumber(supabase: any, orderNumber: number, userId: string, orgId: string | null) {
    console.log(`🔍 [findOrderByNumber] Buscando pedido #${orderNumber}...`);
    try {
        let query = supabase.from('pedidos').select('id');
        if (orgId) query = query.eq('organization_id', orgId);
        else query = query.eq('user_id', userId);

        const { data, error } = await query.eq('order_number', orderNumber).limit(1).maybeSingle();
        if (error) throw error;
        return data?.id || null;
    } catch (error) {
        console.error('❌ [findOrderByNumber] Erro:', error);
        return null;
    }
}

async function findClientWithMultipleStrategies(supabase: any, clientName: string, userId: string, orgId: string | null) {
    let cleanedName = clientName
        .replace(/^(\d+[\d.]*[°ºa-z]?\s*)/i, '')
        .replace(/^cliente:\s*/i, '')
        .trim();

    if (!cleanedName) return null;

    const normalizedClientName = removeAccents(cleanedName.toLowerCase().trim());

    try {
        // Strategy 1: Fuzzy search function
        const { data: fuzzyClients } = await supabase.rpc('find_client_by_fuzzy_name', {
            partial_name: normalizedClientName,
            similarity_threshold: 0.1,
            p_organization_id: orgId
        });

        if (fuzzyClients?.length) return fuzzyClients;

        // Strategy 2: ILIKE search
        let query = supabase.from('clientes').select('id, nome, organization_id, observacoes, telefone, email, cep');
        if (orgId) query = query.eq('organization_id', orgId);
        else query = query.eq('user_id', userId);

        const { data: ilikeClients } = await query.ilike('nome', `%${normalizedClientName}%`).limit(10);
        if (ilikeClients?.length) return ilikeClients;

        // Strategy 3: Broad search and manual filter
        let broadQuery = supabase.from('clientes').select('id, nome, organization_id, observacoes, telefone, email, cep');
        if (orgId) broadQuery = broadQuery.eq('organization_id', orgId);
        else broadQuery = broadQuery.eq('user_id', userId);

        const { data: allClients } = await broadQuery.limit(100);
        if (allClients?.length) {
            const filtered = allClients.filter((client: any) =>
                removeAccents(client.nome.toLowerCase()).includes(normalizedClientName)
            );
            if (filtered.length) return filtered;
        }

        return null;
    } catch (error) {
        console.error('❌ [findClient] Erro:', error);
        return null;
    }
}

async function get_gabi_templates(supabase: any, userId: string) {
    const { data, error } = await supabase.from('profiles').select('gabi_templates').eq('id', userId).single();
    if (error) return { error: error.message };
    return { success: true, templates: data?.gabi_templates || {} };
}



// --- TOOL DEFINITIONS ---
const openAIFunctions = [
    {
        name: "get_current_date",
        description: "Obtém a data e hora atual do sistema em Rio de Janeiro. Use para perguntas temporais.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "perform_calculation",
        description: "Realiza operações matemáticas simples (+, -, *, /).",
        parameters: {
            type: "object",
            properties: {
                expression: { type: "string", description: "Expressão matemática (ex: '100 * 0.85')" }
            },
            required: ["expression"]
        }
    },
    {
        name: "list_orders",
        description: "Lista pedidos recentes por período ou status. Use para 'pedidos de hoje', 'pedidos desta semana'.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                limit: { type: "number", default: 10 },
                statuses: { type: "array", items: { type: "string" } },
                includeTotalCount: { type: "boolean" }
            }
        }
    },
    {
        name: "get_client_orders",
        description: "Busca todos os pedidos de um cliente específico pelo nome ou parte do nome.",
        parameters: {
            type: "object",
            properties: {
                clientName: { type: "string", description: "Nome do cliente" }
            },
            required: ["clientName"]
        }
    },
    {
        name: "get_client_details",
        description: "Obtém os detalhes de um cliente, incluindo a 'Memória da Gabi' (observações importantes).",
        parameters: {
            type: "object",
            properties: {
                clientName: { type: "string" }
            },
            required: ["clientName"]
        }
    },
    {
        name: "get_order_details",
        description: "Obtém detalhes completos de um pedido pelo seu NÚMERO sequencial.",
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
        description: "Cálculo de aproveitamento de imagens para DTF. Retorna metragem recomendada.",
        parameters: {
            type: "object",
            properties: {
                calculation_mode: { type: "string", enum: ["quantity_in_meters", "meters_for_quantity"] },
                imageWidth: { type: "number", description: "Largura em cm" },
                imageHeight: { type: "number", description: "Altura em cm" },
                quantity: { type: "number" },
                rollWidth: { type: "number", default: 58 }
            },
            required: ["calculation_mode", "imageWidth", "imageHeight", "quantity"]
        }
    },
    {
        name: "create_order",
        description: "Cria um NOVO pedido. EXIGE itens, serviços e valor total. SEMPRE peça confirmação textual do usuário antes de criar de fato.",
        parameters: {
            type: "object",
            properties: {
                clientName: { type: "string" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            product_name: { type: "string" },
                            quantity: { type: "number" },
                            price_unit: { type: "number" },
                            observacao: { type: "string" }
                        },
                        required: ["product_name", "quantity", "price_unit"]
                    }
                },
                servicos: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            nome: { type: "string" },
                            quantity: { type: "number" },
                            price_unit: { type: "number" }
                        },
                        required: ["nome", "quantity", "price_unit"]
                    }
                },
                valor_total: { type: "number" },
                observacoes: { type: "string" }
            },
            required: ["clientName", "items", "servicos", "valor_total"]
        }
    },
    {
        name: "list_services",
        description: "Lista serviços realizados por período.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                limit: { type: "number", default: 10 }
            }
        }
    },
    {
        name: "update_order_status",
        description: "Atualiza o status de um pedido (ex: pago, enviado, entregue).",
        parameters: {
            type: "object",
            properties: {
                orderNumber: { type: "number" },
                newStatus: { type: "string", enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"] },
                observacao: { type: "string" }
            },
            required: ["orderNumber", "newStatus"]
        }
    },
    {
        name: "update_client_details",
        description: "Atualiza informações (como observações/memória) de um cliente.",
        parameters: {
            type: "object",
            properties: {
                clientName: { type: "string" },
                observacoes: { type: "string" },
                telefone: { type: "string" },
                email: { type: "string" }
            },
            required: ["clientName"]
        }
    },
    {
        name: "send_whatsapp_message",
        description: "Prepara ou envia uma mensagem de WhatsApp para um cliente.",
        parameters: {
            type: "object",
            properties: {
                phone: { type: "string" },
                clientName: { type: "string" },
                message: { type: "string" }
            },
            required: ["message"]
        }
    },
    {
        name: "get_top_clients",
        description: "Lista os clientes que mais geraram receita em um período.",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", default: 5 },
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" }
            }
        }
    },
    {
        name: "get_total_meters_by_period",
        description: "Totaliza metragem de DTF/Vinil por período.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" }
            }
        }
    }
];


// --- TOOL IMPLEMENTATIONS ---
async function executeTool(name: string, args: any, supabase: any, userId: string, orgId: string | null) {
    console.log(`🎯 [Tool Execution] ${name}`, args);

    const commonFilter = orgId ? { organization_id: orgId } : { user_id: userId };

    try {
        switch (name) {
            case "get_current_date": {
                const dateInfo = getCurrentDateTime();
                return {
                    message: `Hoje é ${dateInfo.dayOfWeek}, ${dateInfo.fullDate} às ${dateInfo.time}.`,
                    dateInfo
                };
            }

            case "perform_calculation": {
                try {
                    const result = (new Function(`return (${args.expression})`))();
                    const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(result);
                    return { result, formatted, message: `O resultado é ${formatted}` };
                } catch {
                    return { error: "Erro no cálculo matemático." };
                }
            }

            case "list_orders": {
                const { startDate, endDate, limit = 10, statuses, includeTotalCount } = args;
                let query = supabase.from('pedidos').select('order_number, status, valor_total, total_meters, created_at, clientes(nome)', { count: includeTotalCount ? 'exact' : null });

                if (orgId) query = query.eq('organization_id', orgId);
                else query = query.eq('user_id', userId);

                if (startDate) query = query.gte('created_at', startDate);
                if (endDate) query = query.lte('created_at', endDate);
                if (statuses?.length) query = query.in('status', statuses);

                const { data, error, count } = await query.order('created_at', { ascending: false }).limit(limit);
                if (error) return { error: error.message };

                return {
                    orders: data,
                    count: count !== null ? count : data?.length,
                    message: `Encontrei ${data?.length} pedidos.`
                };
            }

            case "get_client_orders": {
                const { clientName } = args;
                const found = await findClientWithMultipleStrategies(supabase, clientName, userId, orgId);
                if (!found?.length) return { message: "Cliente não encontrado." };
                if (found.length > 1) return { message: `Encontrei vários clientes. Qual deseja? ${found.map((c: any) => c.nome).join(', ')}`, clients: found };

                const { data: orders } = await supabase.from('pedidos')
                    .select('order_number, status, valor_total, created_at')
                    .eq('cliente_id', found[0].id)
                    .order('created_at', { ascending: false });

                return { client: found[0].nome, orders: orders || [] };
            }

            case "get_client_details": {
                const found = await findClientWithMultipleStrategies(supabase, args.clientName, userId, orgId);
                if (!found?.length) return { message: "Cliente não encontrado." };
                return { success: true, client: found[0] };
            }

            case "get_order_details": {
                const { data, error } = await supabase.from('pedidos')
                    .select('*, clientes(nome), pedido_items(*), pedido_servicos(*)')
                    .eq('order_number', args.orderNumber)
                    .single();
                return error ? { error: "Pedido não encontrado." } : data;
            }

            case "calculate_dtf_packing": {
                const { calculation_mode, imageWidth, imageHeight, quantity, rollWidth = 58 } = args;
                const usableWidth = rollWidth - 2;
                const gap = 0.5;
                const perRow = Math.floor((usableWidth + gap) / (imageWidth + gap));

                if (calculation_mode === "quantity_in_meters") {
                    const rows = Math.floor((quantity * 100) / (imageHeight + gap));
                    const total = rows * perRow;
                    return { total_images: total, meters: quantity, per_row: perRow, type: 'dtf_calculation' };
                } else {
                    const rows = Math.ceil(quantity / perRow);
                    const meters = (rows * (imageHeight + gap)) / 100;
                    return { total_images: quantity, meters: parseFloat(meters.toFixed(2)), per_row: perRow, type: 'dtf_calculation' };
                }
            }

            case "create_order": {
                const { clientName, items, servicos, valor_total, observacoes } = args;
                const found = await findClientWithMultipleStrategies(supabase, clientName, userId, orgId);
                if (!found?.length) return { error: `Cliente "${clientName}" não encontrado.` };
                const client = found[0];

                // 1. Criar pedido
                const { data: order, error: orderErr } = await supabase.from('pedidos').insert({
                    cliente_id: client.id,
                    organization_id: orgId || null,
                    user_id: userId,
                    valor_total,
                    status: 'aguardando',
                    observacoes: observacoes || ''
                }).select().single();

                if (orderErr) return { error: orderErr.message };

                // 2. Itens
                if (items?.length) {
                    await supabase.from('pedido_items').insert(items.map((i: any) => ({
                        pedido_id: order.id,
                        produto_nome: i.product_name,
                        quantidade: i.quantity,
                        preco_unitario: i.price_unit,
                        observacao: i.observacao || ''
                    })));
                }

                // 3. Serviços
                if (servicos?.length) {
                    await supabase.from('pedido_servicos').insert(servicos.map((s: any) => ({
                        pedido_id: order.id,
                        nome: s.nome,
                        quantidade: s.quantity,
                        valor_unitario: s.price_unit
                    })));
                }

                // 4. Histórico
                await supabase.from('pedido_status_history').insert({
                    pedido_id: order.id,
                    status_novo: 'aguardando',
                    observacao: 'Criado via Gabi Brain',
                    user_id: userId
                });

                return {
                    success: true,
                    order_number: order.order_number,
                    message: `✅ Pedido #${order.order_number} criado para ${client.nome}!`
                };
            }

            case "list_services": {
                const { startDate, endDate, limit = 10 } = args;
                let query = supabase.from('pedido_servicos').select('*, pedidos!inner(order_number, created_at, organization_id)');

                if (orgId) query = query.eq('pedidos.organization_id', orgId);
                else query = query.eq('pedidos.user_id', userId);

                if (startDate) query = query.gte('pedidos.created_at', startDate);
                if (endDate) query = query.lte('pedidos.created_at', endDate);

                const { data, error } = await query.limit(limit);
                return error ? { error: error.message } : { services: data };
            }

            case "update_order_status": {
                const { orderNumber, newStatus, observacao } = args;
                const orderId = await findOrderByNumber(supabase, orderNumber, userId, orgId);
                if (!orderId) return { error: "Pedido não encontrado." };

                const { data: oldOrder } = await supabase.from('pedidos').select('status').eq('id', orderId).single();
                const { error } = await supabase.from('pedidos').update({ status: newStatus }).eq('id', orderId);

                if (error) return { error: error.message };

                await supabase.from('pedido_status_history').insert({
                    pedido_id: orderId,
                    status_anterior: oldOrder?.status,
                    status_novo: newStatus,
                    observacao: observacao || 'Atualizado via Gabi Brain',
                    user_id: userId
                });

                return { success: true, message: `Pedido #${orderNumber} atualizado para ${newStatus}.` };
            }

            case "update_client_details": {
                const { clientName, ...updates } = args;
                const found = await findClientWithMultipleStrategies(supabase, clientName, userId, orgId);
                if (!found?.length) return { error: "Cliente não encontrado." };

                const { error } = await supabase.from('clientes').update(updates).eq('id', found[0].id);
                return error ? { error: error.message } : { success: true, message: "Dados do cliente atualizados!" };
            }

            case "get_top_clients": {
                const { data, error } = await supabase.rpc('get_top_clients', {
                    top_n: args.limit || 5,
                    p_organization_id: orgId
                });
                return error ? { error: error.message } : { top_clients: data };
            }

            case "get_total_meters_by_period": {
                const { data, error } = await supabase.rpc('get_total_meters_by_period', {
                    p_start_date: args.startDate,
                    p_end_date: args.endDate,
                    p_organization_id: orgId
                });
                return error ? { error: error.message } : { data };
            }

            case "get_orders_by_status": {
                const { statuses, exclude_statuses, limit = 20, includeTotalCount } = args;
                let query = supabase.from('pedidos').select('order_number, status, valor_total, created_at, clientes(nome)', { count: includeTotalCount ? 'exact' : null });

                if (orgId) query = query.eq('organization_id', orgId);
                else query = query.eq('user_id', userId);

                if (statuses?.length) query = query.in('status', statuses);
                if (exclude_statuses?.length) query = query.not('status', 'in', `(${exclude_statuses.join(',')})`);

                const { data, error, count } = await query.order('created_at', { ascending: false }).limit(limit);
                if (error) return { error: error.message };

                return {
                    orders: data,
                    count: count !== null ? count : data?.length,
                    message: `Encontrei ${data?.length} pedidos com os status solicitados.`
                };
            }

            case "query_database": {
                const { table, select = '*', filters, order, limit = 10 } = args;
                let query = supabase.from(table).select(select);

                if (orgId) query = query.eq('organization_id', orgId);
                else query = query.eq('user_id', userId);

                if (filters) {
                    Object.entries(filters).forEach(([col, val]: [string, any]) => {
                        const [op, ...rest] = val.split('.');
                        const value = rest.join('.');
                        if (op === 'eq') query = query.eq(col, value);
                        else if (op === 'ilike') query = query.ilike(col, `%${value}%`);
                        else if (op === 'gte') query = query.gte(col, value);
                        else if (op === 'lte') query = query.lte(col, value);
                    });
                }

                if (order) {
                    const [col, dir] = order.split('.');
                    query = query.order(col, { ascending: dir === 'asc' });
                }

                const { data, error } = await query.limit(limit);
                if (error) return { error: error.message };
                return { results: data, message: `Encontrei ${data?.length} registros em ${table}.` };
            }

            case "calculate_shipping":
            case "create_shipping_label":
            case "checkout_shipping_label":
            case "get_shipping_label_link": {
                // Pass back to SuperFrete Edge Function
                const actionMap: any = {
                    "calculate_shipping": "calculate",
                    "create_shipping_label": "cart",
                    "checkout_shipping_label": "checkout",
                    "get_shipping_label_link": "tracking"
                };

                const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: actionMap[name],
                        params: args
                    })
                });

                return await response.json();
            }

            case "generate_order_pdf": {
                const orderId = await findOrderByNumber(supabase, args.orderNumber, userId, orgId);
                if (!orderId) return { error: "Pedido não encontrado." };
                return {
                    success: true,
                    type: 'pdf_action',
                    data: { orderNumber: args.orderNumber, orderId },
                    message: `📄 Gerando PDF do pedido #${args.orderNumber}...`
                };
            }

            case "get_gabi_templates": {
                const { data: profile } = await supabase.from('profiles').select('gabi_templates').eq('id', userId).single();
                return { success: true, templates: profile?.gabi_templates || {} };
            }

            case "reset_user_memory": {
                if (args.confirmation !== 'confirmar') return { error: "Confirmação inválida." };
                await supabase.from('agent_memory').delete().eq('user_id', userId);
                return { success: true, message: "Memória resetada com sucesso!" };
            }

            default:
                return { error: "Ação não implementada no servidor." };
        }
    } catch (err: any) {
        return { error: `Erro na execução da ferramenta: ${err.message}` };
    }
}



// --- MAIN HANDLER ---
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { message, audio_base64, audio_mimetype, history = [], platform = 'web', customer_phone, is_boss = false, user_id: provided_user_id } = payload;

        // Supabase Client
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

        // Resolver User
        let userId = provided_user_id;
        if (!userId) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader) {
                const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
                userId = user?.id;
            }
        }

        if (!userId) {
            // Fallback para usuário admin se vier de automação externa sem token (WhatsApp)
            // Nota: Em produção, isso deve ser mais seguro.
            const { data: adminProfile } = await supabase.from('profiles').select('id').eq('is_admin', true).limit(1).single();
            userId = adminProfile?.id;
        }

        if (!userId) throw new Error("Usuário não identificado.");

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        const orgId = profile?.organization_id;

        const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

        // 1. Transcrição (se houver áudio)
        let textInput = message || "";
        if (audio_base64) {
            const binary = atob(audio_base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

            const formData = new FormData();
            formData.append('file', new Blob([bytes], { type: audio_mimetype || 'audio/ogg' }), 'audio.ogg');
            formData.append('model', 'whisper-1');

            const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
                body: formData
            });
            if (whisperRes.ok) {
                const { text } = await whisperRes.json();
                textInput = text;
            }
        }

        // 2. Contexto
        const dateInfo = getCurrentDateTime();
        const systemPrompt = `Você é a Gabi, a inteligência central da DIRECT AI (empresa de DTF e personalização).
Hoja: ${dateInfo.dayOfWeek}, ${dateInfo.fullDate} (${dateInfo.time}).
Empresa: ${profile?.company_name || 'DIRECT AI'}.

REGRAS RÍGIDAS:
- NUNCA invente dados. Use ferramentas para consultar.
- Leia valores EXATOS (R$ 10,50).
- No WhatsApp, seja BREVE (máx 3 frases). Use o modo 🎩 para o patrão.
- Se preparar uma mensagem de WhatsApp, use 'send_whatsapp_message'.

PERSONA: Premium, ágil e focada em resultados.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: textInput }
        ];

        // 3. ReAct Loop
        let finalContent = "";
        let toolResults: any[] = [];
        let iterations = 0;

        while (iterations < 5) {
            const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages,
                    functions: openAIFunctions,
                    function_call: "auto"
                })
            });

            const gptData = await gptRes.json();
            const choice = gptData.choices[0].message;

            if (choice.function_call) {
                const { name, arguments: argsStr } = choice.function_call;
                const args = JSON.parse(argsStr);

                messages.push(choice);
                try {
                    const result = await executeTool(name, args, supabase, userId, orgId);
                    messages.push({ role: 'function', name, content: JSON.stringify(result) });
                    toolResults.push({ name, result });
                } catch (toolError) {
                    messages.push({ role: 'function', name, content: JSON.stringify({ error: toolError.message }) });
                }
                iterations++;
            } else {
                finalContent = choice.content;
                break;
            }
        }

        // 4. Integração de Envio (se for WhatsApp)
        if (platform === 'whatsapp' && customer_phone && finalContent) {
            // Enviar via Evolution API
            const { data: admin } = await supabase.from('profiles').select('whatsapp_api_url, whatsapp_api_key').eq('is_admin', true).single();
            if (admin && profile?.whatsapp_instance_id) {
                const baseUrl = admin.whatsapp_api_url.replace(/\/$/, "");
                await fetch(`${baseUrl}/message/sendText/${profile.whatsapp_instance_id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': admin.whatsapp_api_key },
                    body: JSON.stringify({ number: customer_phone, text: finalContent, linkPreview: false })
                });
            }
        }

        return new Response(JSON.stringify({
            content: finalContent,
            toolResults,
            transcription: audio_base64 ? textInput : null
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[Fatal Error]", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
