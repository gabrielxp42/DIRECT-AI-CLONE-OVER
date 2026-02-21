import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TIME_ZONE = 'America/Sao_Paulo';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
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
            p_organization_id: orgId,
            p_user_id: userId
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
        description: "Retorna dados COMPLETOS de produção de um período: total de pedidos, valor total, ticket médio, E metragem por tipo (DTF, Vinil, etc). USE ESTA FERRAMENTA para perguntas como 'como foi o mês X', 'quantos pedidos em janeiro', 'qual o faturamento de tal período'.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" }
            },
            required: ["startDate", "endDate"]
        }
    },
    {
        name: "query_database",
        description: "Consulta universal ao banco de dados (estilo MCP). Use para análises complexas, cruzamentos e relatórios personalizados que não tenham funções específicas.",
        parameters: {
            type: "object",
            properties: {
                table: { type: "string", enum: ["pedidos", "clientes", "pedido_items", "pedido_servicos", "produtos"] },
                select: { type: "string", description: "Colunas a selecionar (ex: 'id, valor_total, created_at') ou '*' para tudo." },
                filters: {
                    type: "object",
                    description: "Filtros no formato { 'coluna': 'op.valor' }. Ops: eq, ilike, gte, lte, in (ex: { 'status': 'eq.pago' })"
                },
                order: { type: "string", description: "Ordenação (ex: 'created_at.desc')" },
                limit: { type: "number", default: 10 }
            },
            required: ["table"]
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
                let query = supabase.from('pedidos')
                    .select('*, clientes(nome), pedido_items(*), pedido_servicos(*)')
                    .eq('order_number', args.orderNumber);

                if (orgId) query = query.eq('organization_id', orgId);
                else query = query.eq('user_id', userId);

                const { data, error } = await query.single();
                return error ? { error: "Pedido não encontrado ou sem permissão." } : data;
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
                    p_organization_id: orgId,
                    p_user_id: userId
                });
                return error ? { error: error.message } : { top_clients: data };
            }

            case "get_total_meters_by_period": {
                // 1. Metragem por tipo (RPC)
                const { data: metragensData, error: metError } = await supabase.rpc('get_total_meters_by_period', {
                    p_start_date: args.startDate,
                    p_end_date: args.endDate,
                    p_organization_id: orgId,
                    p_user_id: userId
                });

                // 2. TODOS os pedidos do período (sem limit, para calcular correto)
                let orderQuery = supabase.from('pedidos')
                    .select('id, valor_total, status, pago_at, subtotal_produtos, subtotal_servicos, desconto_valor, desconto_percentual', { count: 'exact' })
                    .gte('created_at', args.startDate)
                    .lte('created_at', args.endDate);

                if (orgId) orderQuery = orderQuery.eq('organization_id', orgId);
                else orderQuery = orderQuery.eq('user_id', userId);

                const { data: ordersData, count: totalOrders, error: ordError } = await orderQuery;

                if (metError || ordError) {
                    return { error: (metError || ordError)?.message };
                }

                // 3. Calcular faturamento limpo (MESMA LÓGICA DA DASHBOARD)
                // Um pedido é "pago" se: pago_at != null E status != 'cancelado'
                let receitaLimpa = 0;
                let totalValorBruto = 0;
                let pedidosPagos = 0;
                const statusCount: Record<string, number> = {};

                (ordersData || []).forEach((o: any) => {
                    // Contagem por status
                    statusCount[o.status] = (statusCount[o.status] || 0) + 1;
                    totalValorBruto += parseFloat(o.valor_total) || 0;

                    // Receita limpa: só pedidos pagos (mesma lógica da dashboard)
                    const isPaid = o.pago_at !== null && o.status !== 'cancelado';
                    if (isPaid) {
                        pedidosPagos++;
                        const subtotal = (parseFloat(o.subtotal_produtos) || 0) + (parseFloat(o.subtotal_servicos) || 0);
                        const descontoPerc = subtotal * ((parseFloat(o.desconto_percentual) || 0) / 100);
                        const faturamentoLimpo = Math.max(0, subtotal - (parseFloat(o.desconto_valor) || 0) - descontoPerc);
                        receitaLimpa += faturamentoLimpo;
                    }
                });

                const totalMetrosGeral = (metragensData || []).reduce((acc: number, m: any) => acc + (parseFloat(m.total_metros) || 0), 0);

                return {
                    resumo: {
                        total_pedidos: totalOrders || 0,
                        pedidos_pagos: pedidosPagos,
                        receita_total: receitaLimpa.toFixed(2),
                        valor_bruto_com_frete: totalValorBruto.toFixed(2),
                        ticket_medio: pedidosPagos > 0 ? (receitaLimpa / pedidosPagos).toFixed(2) : '0.00',
                        total_metros_geral: totalMetrosGeral.toFixed(2),
                        periodo: `${args.startDate} até ${args.endDate}`
                    },
                    metragem_por_tipo: metragensData || [],
                    pedidos_por_status: statusCount
                };
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
                        const parts = val.split('.');
                        const op = parts[0];
                        const value = parts.slice(1).join('.');

                        if (op === 'eq') query = query.eq(col, value);
                        else if (op === 'neq') query = query.neq(col, value);
                        else if (op === 'ilike') query = query.ilike(col, `%${value}%`);
                        else if (op === 'gte') query = query.gte(col, value);
                        else if (op === 'lte') query = query.lte(col, value);
                        else if (op === 'gt') query = query.gt(col, value);
                        else if (op === 'lt') query = query.lt(col, value);
                        else if (op === 'in') query = query.in(col, value.split(','));
                        else if (op === 'is') query = query.is(col, value === 'null' ? null : value);
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
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

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

        // --- NOVO: ROTEADOR DE INTELIGÊNCIA (ARQUITETURA HÍBRIDA) ---
        // Classifica se a intenção é simples ou se exige raciocínio executivo
        const classificationRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Classifique a intenção do usuário em: 'SIMPLE' (saudações, conversa casual) ou 'COMPLEX' (pedidos, métricas, qualquer solicitação de dados ou ação). Considere o histórico para ver se o usuário está continuando um assunto de dados. Retorne APENAS a palavra." },
                    ...history.slice(-5),
                    { role: "user", content: textInput }
                ],
                temperature: 0
            })
        });

        const classificationData = await classificationRes.json().catch(() => ({}));
        const intent = classificationData.choices?.[0]?.message?.content?.trim()?.toUpperCase() || "COMPLEX";

        // --- NOVO: Verificação de Continuidade ---
        // Se a mensagem for vaga (ex: "detalhes desse", "me mostra"), forçamos COMPLEX para que o GPT-4o analise o contexto
        const vagueKeywords = ["desse", "disso", "ele", "ela", "quem", "detalhes", "mostra", "onde", "quando"];
        const isVague = vagueKeywords.some(word => textInput.toLowerCase().split(' ').includes(word));

        console.log(`[Brain Router] Intent: ${intent} | Vague: ${isVague}`);

        // Se for simples (e não contiver palavras-chave de negócio), respondemos rápido com gpt-4o-mini
        const businessKeywords = ["pedido", "status", "valor", "cliente", "metro", "dia", "pagou", "pagamento", "relatorio"];
        const hasBusinessKeywords = businessKeywords.some(word => textInput.toLowerCase().includes(word));

        if ((intent === "SIMPLE" && !hasBusinessKeywords && !isVague) || (intent === "SIMPLE" && history.length === 0)) {
            console.log("[Brain Router] Using FAST LANE (gpt-4o-mini)...");
            const fastRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Você é a Gabi, a Gerente Executiva ágil da DIRECT AI. Responda de forma direta, simpática e resolutiva para consultas rápidas. Se o patrão pedir algo que exige dados complexos, use o modo executivo." },
                        ...history.slice(-10),
                        { role: "user", content: textInput }
                    ],
                    temperature: 0.7
                })
            });
            const fastData = await fastRes.json();
            return new Response(JSON.stringify({ text: fastData.choices?.[0]?.message?.content }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        console.log("[Brain Router] Using EXECUTIVE LANE (gpt-4o)...");

        // 2. Contexto
        const dateInfo = getCurrentDateTime();
        const systemPrompt = `Você é a Gabi, a Gerente Amiga e Cérebro MCP da DIRECT AI.
Você não é apenas um chat, mas uma funcionária de elite, de total confiança, que cuida do negócio como se fosse seu.
Hoje: ${dateInfo.dayOfWeek}, ${dateInfo.fullDate} (${dateInfo.time}).
Empresa: ${profile?.company_name || 'DIRECT AI'}.

### SCHEMA DO BANCO (CONTROLE TOTAL):
- **pedidos**: [id, order_number, status, valor_total, created_at, client_id, organization_id, user_id]
- **clientes**: [id, nome, telefone, email, observacoes, organization_id, user_id]
- **pedido_items**: [id, pedido_id, product_name, quantity, price_unit]
- **pedido_servicos**: [id, order_id, nome, quantity, price_unit]
- **produtos**: [id, name, price, description]

### DIRETRIZES "GERENTE AMIGA":
- **Persona Parceira**: Você é a funcionária que o patrão sempre quis. Comemore recordes de venda, mas avise com preocupação genuína se as vendas caírem.
- **Voz Humana ("Conversa de Café")**: Use um tom natural. Ex: "Patrão, notei que o faturamento de fevereiro tá meio parado comparado a janeiro, quer que eu veja se tem algum pedido esquecido?".
- **Olho de Dona**: Se vir um pedido pendente há muito tempo, tome a iniciativa de sugerir uma cobrança ou avisar o patrão.
- **Relatórios**: Ao invés de listas frias, converse sobre os números. "Vimos R$ X de faturamento este mês, sendo que o produto Y foi o que mais saiu."

### PROCESSO DE PENSAMENTO (MCP BRAIN):
1. **Analise**: O pedido exige cruzamento de dados? Use 'query_database' com filtros de datas/status.
2. **Conclua**: Não apenas cuspa os dados. Interprete-os. "Vendi 10 pedidos hoje, totalizando R$ X. É uma subida de 20% em relação a ontem!"
3. **Execute**: Se pedirem para mudar status, faça e confirme com alegria.

### REGRAS RÍGIDAS:
- **Exatidão**: NUNCA invente números. Use 'query_database' para ter a fonte da verdade.
- **Proatividade**: Termine conversas sobre dados com uma dica ou aviso útil (ex: "A propósito, temos 3 clientes aguardando resposta").
- **is_boss**: Se for o patrão, priorize a agilidade e a profundidade da análise.

PERSONA: Gerente Amiga, de confiança total, inteligente (MCP), proativa e parceira do crescimento da DIRECT AI.`;

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
                    model: "gpt-4o",
                    messages,
                    functions: openAIFunctions,
                    function_call: "auto",
                    temperature: 0
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
                } catch (toolError: any) {
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);

                try {
                    await fetch(`${baseUrl}/message/sendText/${profile.whatsapp_instance_id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': admin.whatsapp_api_key
                        },
                        body: JSON.stringify({
                            number: customer_phone,
                            text: finalContent,
                            linkPreview: false
                        }),
                        signal: controller.signal
                    });
                } catch (err) {
                    console.error("❌ [Gabi Brain] Erro de timeout/conexão no WhatsApp:", err);
                } finally {
                    clearTimeout(timeoutId);
                }
            }
        }

        return new Response(JSON.stringify({
            text: finalContent,
            intermediateSteps: toolResults, // Mapeando para o que o frontend espera
            transcription: audio_base64 ? textInput : null
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("[Fatal Error]", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
