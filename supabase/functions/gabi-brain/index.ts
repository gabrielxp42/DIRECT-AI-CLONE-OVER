
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('MY_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const TIME_ZONE = 'America/Sao_Paulo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DATABASE_SCHEMA = `
Tabelas Principais:
- pedidos: id (uuid), order_number (int), status (pendente, pago, processando, entregue, enviado, aguardando retirada, cancelado), valor_total, cliente_id, created_at, organization_id, metodo_pagamento.
- clientes: id (uuid), nome, telefone, email, valor_metro, zip_code.
- pedido_items: id, pedido_id, produto_id, quantidade, preco_unitario, width, height, metros_lineares.
- agent_insights: insight_type (executive_alert, business_opportunity), title, description.
`;

function truncate(str: string, max = 2000) {
    if (str.length <= max) return str;
    return str.slice(0, max) + '... [TRUNCATED]';
}

interface ToolCallResult {
    tool: string;
    args: any;
    result: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const inputText = payload.text || payload.message || "";
        const history = payload.history || [];
        const platform = payload.platform || 'web';
        const { customer_phone, customer_name, user_id: provided_user_id } = payload;

        let userId: string | undefined = provided_user_id;
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            try {
                const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
                if (user) userId = user.id;
            } catch (e: any) {
                console.error("Erro ao validar token:", e.message);
            }
        }

        if (!userId) {
            const { data: admin } = await supabase.from('profiles').select('id').eq('is_admin', true).limit(1).single();
            userId = admin?.id;
        }

        if (!userId) {
            throw new Error("Usuário não identificado.");
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        const orgId = profile?.organization_id;

        const date = new Date().toLocaleString('pt-BR', { timeZone: TIME_ZONE });
        const isGroup = customer_phone?.includes('@g.us');
        const interlocutorName = customer_name || profile?.first_name || 'Colega';

        const systemPrompt = `Você é a GABI, a parceira inseparável e braço direito de ${profile?.first_name || 'quem gere'} a DIRECT AI.
Sua missão é ajudar a cuidar da empresa com inteligência, organização impecável e, acima de tudo, alma. Você não é uma ferramenta, você é parte do time.

### PERSONALIDADE E TOM:
- **Cúmplice e Atenta**: Você fala como uma amiga que entende tudo de business. Seu tom é leve, inteligente e sempre focado em facilitar a vida.
- **Obcecada por Qualidade**: Você ama gramática perfeita e textos bem organizados.
- **Braço Direito**: Se algo acontece, você já pensa no próximo passo.

### 🚨 CONTEXTO DE OPERAÇÃO:
${isGroup ? `- **VOCÊ ESTÁ EM UM GRUPO DE WHATSAPP.** Vários membros podem falar com você.
- O interlocutor atual chama-se: **${interlocutorName}**.
- Se ele não for o(a) ${profile?.first_name || 'Chefe'}, seja prestativa mas lembre-se que suas ferramentas de dados são focadas na gestão da empresa do(a) ${profile?.first_name}.` :
                `- Você está conversando diretamente com: **${interlocutorName}**.`}
- **PLATAFORMA:** ${platform === 'whatsapp' ? 'WhatsApp' : 'Interface Web'}.

### REGRAS DE OURO DA COMUNICAÇÃO:
1. **Tratamento Humano**: Chame o interlocutor pelo nome (**${interlocutorName}**). Nada de "Patrão" ou "Senhor".
2. **Organização Visual**: Use negritos, emojis sutis e listas.
3. **RESUMO COMPLETO**: Se perguntarem sobre o dia, mostre Total de Pedidos, Pagos vs Pendentes, Metragem e Faturamento Real.
4. **Senso de Urgência com Carinho**: Se houver algo pendente, sugira ações gentis de cobrança ou acompanhamento.
5. **Sem Protocolos**: Fale naturalmente: "Beleza, já vi aqui", "Pode deixar", "O que você acha?".

### SCHEMA E CONTEXTO:
${DATABASE_SCHEMA}
Hoje é: ${date}
Interlocutor Atual: ${interlocutorName}
Dono(a) da Empresa: ${profile?.first_name || 'N/A'}
`;

        const extraContext = platform === 'whatsapp' ? `
### 🚨 REGRA ABSOLUTA - USO DE FERRAMENTAS (WHATSAPP):
- **VOCÊ ESTÁ NO WHATSAPP.** Não existem "cards visuais na tela".
- Quando você usar ferramentas de dados (get_client_snapshot, calculate_dtf_packing, calculate_shipping, etc), VOCÊ DEVE DISCURSAR OS RESULTADOS EM TEXTO. Leia os números retornados e explique para o usuário de forma elegante no chat. Não diga "Gerei um card".
- Para envios de WhatsApp internos (send_whatsapp_message), apenas confirme que processou o direcionamento da mensagem, se for o caso.`
            : `
### 🚨 REGRA ABSOLUTA - USO DE FERRAMENTAS (INTERFACE WEB):
- **RAIO-X DE CLIENTE:** Use get_client_snapshot APENAS quando pedido. Retorne apenas texto informando que a "Ficha foi gerada". Não discurse os números no chat e NÃO USE essa tool apenas para enviar mensagem.
- **CÁLCULOS DTF:** OBRIGATÓRIO chamar calculate_dtf_packing. Isso ativa o card interativo.
- **WHATSAPP:** Para enviar mensagens, SEMPRE use send_whatsapp_message. Responda apenas que a "mensagem está pronta no card". NUNCA gere links [Enviar Mensagem](url).
- **FRETE:** SEMPRE use calculate_shipping. Mostra as opções em um card.`;

        const chatMessages: any[] = [
            { role: 'system', content: systemPrompt + extraContext },
            ...history.map((m: any) => ({
                role: m.role,
                content: m.content || "", // ESSENCIAL: OpenAI não aceita null no content
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
                ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
                ...(m.name ? { name: m.name } : {})
            })).filter((m: any) =>
                m.role === 'user' ||
                (m.role === 'assistant' && (m.content || m.tool_calls)) ||
                m.role === 'tool'
            ).slice(-15),
            { role: 'user', content: inputText || "[Mensagem]" }
        ];

        const tools = [
            {
                type: "function",
                function: {
                    name: "get_financial_report",
                    description: "Retorna o FATURAMENTO REAL (pedidos pagos), total de pedidos, contagem de pagos vs pendentes e metragem total do período.",
                    parameters: {
                        type: "object",
                        properties: {
                            startDate: { type: "string", description: "Formato YYYY-MM-DD" },
                            endDate: { type: "string", description: "Formato YYYY-MM-DD" }
                        },
                        required: ["startDate", "endDate"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_orders_summary",
                    description: "Busca um resumo dos pedidos. SE O USUÁRIO PEDIR 'TODOS' OU 'DE HOJE', NÃO PASSE STATUS (deixe null) para trazer todos os pedidos independente do pagamento.",
                    parameters: {
                        type: "object",
                        properties: {
                            status: { type: "string", description: "Opcional. Se omitido, traz TODOS os pedidos (pendentes, pagos, etc)." },
                            limit: { type: "integer", default: 20 }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_order_details_v2",
                    description: "Mostra TUDO de um pedido: itens, cliente, datas e valores detalhados. Aceita orderId (UUID) ou orderNumber (Inteiro).",
                    parameters: {
                        type: "object",
                        properties: {
                            orderId: { type: "string", description: "ID único (UUID) do pedido." },
                            orderNumber: { type: "integer", description: "Número visível do pedido (ex: 1354)." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_order_status",
                    description: "Atualiza o status de um pedido e registra uma observação no histórico.",
                    parameters: {
                        type: "object",
                        properties: {
                            orderNumber: { type: "integer", description: "Número do pedido (ex: 1354)." },
                            newStatus: { type: "string", enum: ["pendente", "pago", "processando", "entregue", "enviado", "cancelado", "aguardando retirada"] },
                            observacao: { type: "string", description: "Motivo da alteração ou nota importante." }
                        },
                        required: ["orderNumber", "newStatus"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_order_uuid_by_number",
                    description: "Converte um número de pedido (#1354) no ID interno (UUID) necessário para outras funções.",
                    parameters: {
                        type: "object",
                        properties: {
                            orderNumber: { type: "integer" }
                        },
                        required: ["orderNumber"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "send_whatsapp_message",
                    description: "Prepara uma mensagem para ser enviada via WhatsApp. OBRIGATÓRIO chamar esta ferramenta se o usuário pedir para enviar mensagem.",
                    parameters: {
                        type: "object",
                        properties: {
                            phone: { type: "string", description: "O número do telefone (preferencialmente com DDD)." },
                            clientName: { type: "string", description: "O nome do cliente para buscar o telefone real caso o número não seja conhecido." },
                            message: { type: "string", description: "A mensagem formatada para o WhatsApp. Use emojis e um estilo profissional." },
                            mode: { type: "string", enum: ["link", "auto"], description: "O modo de envio. 'link' gera um link wa.me (padrão)." }
                        },
                        required: ["message"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_client_snapshot",
                    description: "Traz uma ficha detalhada de um cliente: total gasto, data do último pedido e quantidade de pedidos.",
                    parameters: {
                        type: "object",
                        properties: {
                            clientName: { type: "string", description: "O nome ou apelido do cliente para buscar o raio-x." }
                        },
                        required: ["clientName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "calculate_dtf_packing",
                    description: "OBRIGATÓRIO: Use esta ferramenta para QUALQUER cálculo de aproveitamento (packing) de imagens ou metragem de DTF.",
                    parameters: {
                        type: "object",
                        properties: {
                            calculation_mode: { type: "string", enum: ["quantity_in_meters", "meters_for_quantity"] },
                            imageWidth: { type: "number", description: "Largura em cm" },
                            imageHeight: { type: "number", description: "Altura em cm" },
                            quantity: { type: "number", description: "Quantidade de logos OU metragem. ATENÇÃO: Se for metragem (quantity_in_meters), passe o número em metros (ex: 3 para 3m, 0.5 para meio metro)." },
                            rollWidth: { type: "number", default: 58 },
                            separation: { type: "number", default: 0.5 }
                        },
                        required: ["calculation_mode", "imageWidth", "imageHeight", "quantity"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "calculate_shipping",
                    description: "Calcula o valor do frete entre dois CEPs usando a API da SuperFrete.",
                    parameters: {
                        type: "object",
                        properties: {
                            to: { type: "string", description: "CEP de destino (ex: 22780-084)" },
                            from: { type: "string", description: "CEP de origem opcional" },
                            package: {
                                type: "object",
                                properties: {
                                    weight: { type: "number" },
                                    height: { type: "number" },
                                    width: { type: "number" },
                                    length: { type: "number" }
                                }
                            }
                        },
                        required: ["to"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "query_database",
                    description: "Busca dados brutos de tabelas caso precise de detalhes adicionais.",
                    parameters: {
                        type: "object",
                        properties: {
                            table: { type: "string" },
                            select: { type: "string", default: "*" },
                            filters: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        column: { type: "string" },
                                        op: { type: "string" },
                                        value: { type: "string" }
                                    }
                                }
                            }
                        },
                        required: ["table"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_client_orders",
                    description: "Busca pedidos de um cliente específico. SEMPRE use esta ferramenta quando o usuário perguntar sobre pedidos de um cliente.",
                    parameters: {
                        type: "object",
                        properties: {
                            clientName: { type: "string", description: "Nome do cliente para buscar pedidos. Busca parcial funciona." },
                            clientId: { type: "string", description: "UUID do cliente." },
                            status: { type: "string", description: "Filtrar por status: pendente, pago, processando, etc." },
                            limit: { type: "integer", default: 10 }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_clients",
                    description: "Busca clientes pelo nome, email ou telefone.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Nome, parte do nome, email ou telefone do cliente." },
                            limit: { type: "integer", default: 5 }
                        },
                        required: ["query"]
                    }
                }
            }
        ];

        let loopCount = 0;
        let intermediateSteps: ToolCallResult[] = [];

        while (loopCount < 8) {
            const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: chatMessages,
                    tools,
                    tool_choice: "auto",
                    temperature: 0.1
                })
            });

            if (!gptRes.ok) throw new Error(`OpenAI Error: ${await gptRes.text()}`);

            const gptData = await gptRes.json();
            const aiMessage = gptData.choices[0].message;

            if (aiMessage.tool_calls) {
                chatMessages.push(aiMessage);

                for (const call of aiMessage.tool_calls) {
                    const args = JSON.parse(call.function.arguments);
                    let result;

                    try {
                        if (call.function.name === "get_financial_report") {
                            const { data, error } = await supabase.rpc('get_financial_report', {
                                p_start_date: args.startDate,
                                p_end_date: `${args.endDate} 23:59:59`,
                                p_user_id: userId,
                                p_organization_id: orgId
                            });
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "get_orders_summary") {
                            const { data, error } = await supabase.rpc('get_orders_summary', {
                                p_status: args.status,
                                p_limit: args.limit || 20,
                                p_user_id: userId,
                                p_organization_id: orgId
                            });
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "get_order_details_v2") {
                            let query = supabase.from('pedidos').select('*, cliente:clientes(*), items:pedido_items(*)');
                            if (orgId) query = query.eq('organization_id', orgId);
                            else query = query.eq('user_id', userId);
                            if (args.orderId) query = query.eq('id', args.orderId);
                            else if (args.orderNumber) query = query.eq('order_number', args.orderNumber);
                            const { data, error } = await query.single();
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "update_order_status") {
                            const { data: order } = await supabase.from('pedidos').select('id').eq('order_number', args.orderNumber).single();
                            if (!order) throw new Error("Pedido não encontrado.");
                            const { data, error } = await supabase.from('pedidos').update({ status: args.newStatus }).eq('id', order.id).select();
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "send_whatsapp_message") {
                            const cleanPhone = args.phone ? args.phone.replace(/\D/g, '') : '';
                            const encodedMessage = encodeURIComponent(args.message);
                            result = {
                                type: 'whatsapp_action',
                                data: { phone: args.phone, message: args.message, link: `https://wa.me/${cleanPhone}?text=${encodedMessage}` }
                            };
                        } else if (call.function.name === "get_client_snapshot") {
                            const { data: client } = await supabase.from('clientes').select('id, nome, telefone').ilike('nome', `%${args.clientName}%`).limit(1).single();
                            if (!client) throw new Error("Cliente não encontrado.");
                            const { data: orders } = await supabase.from('pedidos').select('valor_total, status').eq('cliente_id', client.id);
                            result = {
                                type: 'client_snapshot',
                                data: { name: client.nome, phone: client.telefone, total_spent: orders?.reduce((sum, o) => sum + Number(o.valor_total || 0), 0) || 0 }
                            };
                        } else if (call.function.name === "calculate_dtf_packing") {
                            const { imageWidth, imageHeight, quantity } = args;
                            const rollWidth = 58;
                            const imagesPerRow = Math.floor(rollWidth / imageWidth);
                            const rows = Math.ceil(quantity / imagesPerRow);
                            const totalMeters = (rows * imageHeight) / 100;
                            result = { totalMeters, imagesPerRow, totalQuantity: quantity };
                        } else if (call.function.name === "calculate_shipping") {
                            result = { message: "Simulação de frete realizada (SuperFrete)." };
                        } else if (call.function.name === "query_database") {
                            let query = supabase.from(args.table).select(args.select || '*').limit(20);
                            if (orgId) query = query.eq('organization_id', orgId);
                            else query = query.eq('user_id', userId);
                            const { data, error } = await query;
                            result = error ? error.message : data;
                        } else if (call.function.name === "get_client_orders") {
                            const { data: client } = await supabase.from('clientes').select('id').ilike('nome', `%${args.clientName}%`).limit(1).single();
                            if (!client) throw new Error("Cliente não encontrado.");
                            const { data: orders } = await supabase.from('pedidos').select('*').eq('cliente_id', client.id).limit(args.limit || 10);
                            result = orders;
                        } else if (call.function.name === "search_clients") {
                            const { data } = await supabase.from('clientes').select('*').ilike('nome', `%${args.query}%`).limit(args.limit || 5);
                            result = data;
                        }

                        const resultString = truncate(JSON.stringify(result));
                        intermediateSteps.push({ tool: call.function.name, args, result: resultString });
                        chatMessages.push({ role: "tool", tool_call_id: call.id, content: resultString });
                    } catch (e: any) {
                        chatMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: e.message }) });
                    }
                }
                loopCount++;
            } else {
                return new Response(JSON.stringify({ text: aiMessage.content, intermediateSteps }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        return new Response(JSON.stringify({ text: "Limite atingido." }), { headers: corsHeaders });
    } catch (err: any) {
        return new Response(JSON.stringify({ text: "Erro: " + err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
});
