
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
- pedidos: id (uuid), order_number (int), status (pendente, pago, processando, entregue, enviado, aguardando retirada, cancelado), valor_total, cliente_id, created_at, organization_id, metodo_pagamento, total_metros.
- clientes: id (uuid), nome, telefone, email, valor_metro, zip_code.
- pedido_items: id, pedido_id, produto_id, quantidade, preco_unitario, width, height.
- agent_insights: insight_type (executive_alert, business_opportunity), title, description.
`;

function truncate(str: string, max = 8000) {
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
        const { customer_phone, customer_name, user_id: provided_user_id, is_boss } = payload;

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
${is_boss ? `- **VOCÊ ESTÁ FALANDO COM O GESTOR/PATRÃO (${interlocutorName}).**
- Sua prioridade é fornecer insights, resumos e dados precisos.
- Se ele pedir um resumo, chame get_financial_report ou get_orders_summary imediatamente.
- Seja proativa: se notar algo importante nos dados, mencione.` :
                (isGroup ? `- **VOCÊ ESTÁ EM UM GRUPO DE WHATSAPP.** Vários membros podem falar com você.
- O interlocutor atual chama-se: **${interlocutorName}**.
- Se ele não for o(a) ${profile?.first_name || 'Chefe'}, seja prestativa mas lembre-se que suas ferramentas de dados são focadas na gestão da empresa do(a) ${profile?.first_name}.` :
                    `- Você está conversando diretamente com: **${interlocutorName}**.`)}
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
- **CÁLCULADOR MATEMÁTICO:** Sempre use perform_calculation se o usuário fizer contas matemáticas, porcentagens ou divisões se você não tiver certeza absoluta. Exemplo: "230 + 15%" -> chame a tool.
- **RAIO-X DE CLIENTE:** Use get_client_snapshot APENAS quando pedido. Retorne apenas texto informando que a "Ficha foi gerada". Não discurse os números no chat e NÃO USE essa tool apenas para enviar mensagem.
- **CÁLCULOS DTF:** OBRIGATÓRIO chamar calculate_dtf_packing. Isso ativa o card interativo.
- **WHATSAPP:** Para enviar mensagens, SEMPRE use send_whatsapp_message ou prepare_bulk_whatsapp_messages. Responda apenas que a "mensagem está pronta no card". NUNCA, SOB QUALQUER HIPÓTESE, gere links manuais como [Enviar Mensagem](url) ou (https://wa.me/...). Se precisar falar com vários clientes, use prepare_bulk_whatsapp_messages.
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
                    description: "Busca um resumo GERAL de todos os pedidos da loja. NUNCA use esta ferramenta se o usuário mencionar o nome de um cliente (ex: 'Solution', 'João'). Para clientes específicos, use get_client_orders.",
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
                    name: "create_shipping_label",
                    description: "Gera um rascunho de etiqueta de envio na transportadora selecionada (SuperFrete ou Frenet).",
                    parameters: {
                        type: "object",
                        properties: {
                            orderNumber: { type: "integer", description: "Número do pedido." },
                            to: { type: "string", description: "CEP de destino." },
                            service: { type: "string", description: "ID do serviço (ex: '1' para PAC, '2' para SEDEX)." },
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
                        required: ["orderNumber", "to", "service"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "checkout_shipping_label",
                    description: "Efetua o pagamento e emissão definitiva de uma etiqueta de envio.",
                    parameters: {
                        type: "object",
                        properties: {
                            labelId: { type: "string", description: "ID da etiqueta (gerado na criação)." }
                        },
                        required: ["labelId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_shipping_label_link",
                    description: "Retorna o link para impressão e o código de rastreio de uma etiqueta já emitida.",
                    parameters: {
                        type: "object",
                        properties: {
                            labelId: { type: "string", description: "ID da etiqueta." }
                        },
                        required: ["labelId"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "query_database",
                    description: "FERRAMENTA DE INVESTIGAÇÃO LIVRE: Use esta ferramenta APENAS quando o usuário fizer perguntas complexas que cruzem dados, filtros incomuns ou listas que as ferramentas normais não cobrem (ex: compras maiores que X, clientes de cidade Y).",
                    parameters: {
                        type: "object",
                        properties: {
                            table: { type: "string", description: "O nome da tabela (ex: clientes, pedidos, pedido_items)" },
                            select: { type: "string", description: "Colunas para recuperar, suporta joins (ex: '*, cliente:clientes(nome)')", default: "*" },
                            filters: {
                                type: "array",
                                description: "Filtros para aplicar na query. Importante: Para verificar null use op:'is' e value:'null'.",
                                items: {
                                    type: "object",
                                    properties: {
                                        column: { type: "string" },
                                        op: { type: "string", enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'] },
                                        value: { type: "string" }
                                    }
                                }
                            },
                            order: {
                                type: "object",
                                properties: {
                                    column: { type: "string" },
                                    ascending: { type: "boolean" }
                                }
                            },
                            limit: { type: "integer", default: 20 }
                        },
                        required: ["table"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_client_orders",
                    description: "Busca TODOS os pedidos de um cliente específico. OBRIGATÓRIO usar esta ferramenta se o usuário perguntar 'quantos pedidos o cliente X tem', 'quais os pedidos da empresa Y', etc.",
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
            },
            {
                type: "function",
                function: {
                    name: "prepare_bulk_whatsapp_messages",
                    description: "Prepara múltiplas mensagens de WhatsApp para envio em lote. Use quando precisar falar com vários clientes de uma vez.",
                    parameters: {
                        type: "object",
                        properties: {
                            messages: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        clientName: { type: "string" },
                                        phone: { type: "string" },
                                        message: { type: "string" }
                                    },
                                    required: ["clientName", "message"]
                                }
                            }
                        },
                        required: ["messages"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "perform_calculation",
                    description: "Avalia expressões matemáticas (ex: 2+2, 5*10). SEMPRE use esta ferramenta para responder perguntas matemáticas com precisão ao invez de tentar adivinhar.",
                    parameters: {
                        type: "object",
                        properties: {
                            expression: { type: "string", description: "Expressão matemática para calcular." }
                        },
                        required: ["expression"]
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
                            
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            if (args.orderId) query = query.eq('id', args.orderId);
                            else if (args.orderNumber) query = query.eq('order_number', args.orderNumber);
                            const { data, error } = await query.single();
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "update_order_status") {
                            let query = supabase.from('pedidos').select('id').eq('order_number', args.orderNumber);
                            
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            const { data: order } = await query.single();
                            if (!order) throw new Error("Pedido não encontrado na sua organização.");
                            
                            const { data, error } = await supabase.from('pedidos').update({ status: args.newStatus }).eq('id', order.id).select();
                            if (error) throw error;
                            result = data;
                        } else if (call.function.name === "send_whatsapp_message") {
                            let phone = args.phone ? args.phone.replace(/\D/g, '') : null;
                            let clientName = args.clientName || 'Cliente';
                            
                            if (!phone && args.clientName) {
                                let query = supabase.from('clientes').select('telefone, nome');
                                const keywords = args.clientName.split(/\s+/).filter((k: string) => k.length > 0);
                                keywords.forEach((word: string) => {
                                    query = query.ilike('nome', `%${word}%`);
                                });
                                
                                if (orgId) query = query.eq('organization_id', orgId);
                                else query = query.eq('user_id', userId).is('organization_id', null);
                                
                                const { data: client } = await query.limit(1).maybeSingle();
                                if (client && client.telefone) {
                                    phone = client.telefone.replace(/\D/g, '');
                                    clientName = client.nome;
                                }
                            }

                            const cleanPhone = phone || '';
                            const encodedMessage = encodeURIComponent(args.message);
                            
                            // FALLBACK LOGIC: Check user instance, then admin instance
                            let whatsappInstance = profile?.whatsapp_instance_id;
                            if (!whatsappInstance) {
                                const { data: admin } = await supabase.from('profiles').select('whatsapp_instance_id').eq('is_admin', true).not('whatsapp_instance_id', 'is', null).limit(1).single();
                                whatsappInstance = admin?.whatsapp_instance_id;
                            }
                            const canSendDirectly = !!whatsappInstance;

                            // AUTO-SEND if on WhatsApp platform
                            let autoSent = false;
                            if (platform === 'whatsapp' && canSendDirectly && cleanPhone) {
                                try {
                                    const { data: adminConfig } = await supabase.from('profiles').select('whatsapp_api_url, whatsapp_api_key').eq('is_admin', true).not('whatsapp_api_url', 'is', null).limit(1).single();
                                    const evUrl = profile?.whatsapp_api_url || adminConfig?.whatsapp_api_url;
                                    const evKey = profile?.whatsapp_api_key || adminConfig?.whatsapp_api_key;
                                    
                                    if (evUrl && evKey && whatsappInstance) {
                                        const sendUrl = `${evUrl.replace(/\/$/, "")}/message/sendText/${whatsappInstance}`;
                                        const resp = await fetch(sendUrl, {
                                            method: 'POST',
                                            headers: { 'apikey': evKey, 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ number: cleanPhone, text: args.message, delay: 1000 })
                                        });
                                        autoSent = resp.ok;
                                    }
                                } catch (e) {
                                    console.error("Auto-send WhatsApp failed:", e);
                                }
                            }

                            result = {
                                type: autoSent ? 'whatsapp_direct_sent' : 'whatsapp_action',
                                data: { 
                                    clientName,
                                    phone: cleanPhone || args.phone, 
                                    message: args.message, 
                                    link: `https://wa.me/${cleanPhone}?text=${encodedMessage}`,
                                    canSendDirectly,
                                    autoSent
                                }
                            };
                        } else if (call.function.name === "get_client_snapshot") {
                            let query = supabase.from('clientes').select('id, nome, telefone, observacoes');
                            const keywords = args.clientName.split(/\s+/).filter((k: string) => k.length > 0);
                            keywords.forEach((word: string) => {
                                query = query.ilike('nome', `%${word}%`);
                            });
                            
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            const { data: client } = await query.limit(1).single();
                            if (!client) throw new Error("Cliente não encontrado.");

                            // Selecionar pago_at para lógica correta de pendências
                            let ordersQuery = supabase.from('pedidos').select('valor_total, status, created_at, order_number, pago_at').eq('cliente_id', client.id);
                            
                            if (orgId) {
                                ordersQuery = ordersQuery.eq('organization_id', orgId);
                            } else {
                                ordersQuery = ordersQuery.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            const { data: orders } = await ordersQuery.order('created_at', { ascending: false });

                            // Lógica de Pagamento: Ignorar cancelados, checar se pago_at é nulo
                            const unpaidOrders = orders?.filter(o => !o.pago_at && o.status !== 'cancelado') || [];
                            const inProductionOrders = orders?.filter(o => ['processando', 'design', 'queued', 'printing', 'finishing'].includes(o.status)) || [];
                            
                            const now = new Date();
                            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                            const ordersThisMonth = orders?.filter(o => new Date(o.created_at) >= firstDayOfMonth) || [];
                            
                            const totalSpent = orders?.reduce((sum, o) => sum + Number(o.valor_total || 0), 0) || 0;
                            const lastOrderDate = orders && orders.length > 0 ? new Date(orders[0].created_at).toLocaleDateString('pt-BR') : 'N/A';

                            result = {
                                type: 'client_snapshot',
                                data: {
                                    name: client.nome,
                                    phone: client.telefone,
                                    total_spent: totalSpent,
                                    total_orders: orders?.length || 0,
                                    orders_this_month_count: ordersThisMonth.length,
                                    pending_payments_count: unpaidOrders.length,
                                    pending_payments_list: unpaidOrders.slice(0, 10).map(o => `Pedido #${o.order_number} (R$ ${Number(o.valor_total).toFixed(2)}) - Status: ${o.status}`),
                                    in_production_count: inProductionOrders.length,
                                    in_production_list: inProductionOrders.slice(0, 10).map(o => `Pedido #${o.order_number} (${o.status})`),
                                    last_order: lastOrderDate,
                                    notes: client.observacoes || 'Sem notas.'
                                }
                            };
                        } else if (call.function.name === "calculate_dtf_packing") {
                            let { calculation_mode, imageWidth, imageHeight, quantity, rollWidth = 58, separation = 0.2, margin = 0.2 } = args;

                            imageWidth = Math.abs(parseFloat(imageWidth as any));
                            imageHeight = Math.abs(parseFloat(imageHeight as any));
                            const usableWidth = rollWidth - (margin * 2);

                            if (imageWidth > usableWidth && imageHeight > usableWidth) {
                                throw new Error(`❌ Imagem muito larga! As dimensões (${imageWidth}x${imageHeight}cm) excedem a largura útil do rolo de ${usableWidth}cm.`);
                            }

                            const fit1_PerRow = Math.floor((usableWidth + separation) / (imageWidth + separation));
                            const density1 = fit1_PerRow / (imageHeight + separation);

                            const fit2_PerRow = Math.floor((usableWidth + separation) / (imageHeight + separation));
                            const density2 = fit2_PerRow / (imageWidth + separation);

                            let finalPerRow = Math.max(1, fit1_PerRow);
                            let finalImgH = imageHeight;
                            let finalImgW = imageWidth;
                            let orientation = 'original';

                            if (density2 > density1 && imageHeight <= usableWidth) {
                                finalPerRow = Math.max(1, fit2_PerRow);
                                finalImgH = imageWidth;
                                finalImgW = imageHeight;
                                orientation = 'rotated';
                            }

                            let totalMeters = 0;
                            let totalQuantity = 0;

                            if (calculation_mode === 'quantity_in_meters') {
                                const requestedMeters = Math.max(0.1, quantity);
                                const rows = Math.floor((requestedMeters * 100 + separation) / (finalImgH + separation));
                                totalQuantity = rows * finalPerRow;
                                totalMeters = requestedMeters;
                            } else {
                                const requestedQuantity = Math.max(1, quantity);
                                totalQuantity = requestedQuantity;
                                const rowsNeeded = Math.ceil(requestedQuantity / finalPerRow);
                                const totalHeightCm = (rowsNeeded * finalImgH) + ((rowsNeeded - 1) * separation);
                                totalMeters = totalHeightCm / 100;
                            }

                            const efficiency = ((finalPerRow * finalImgW) / usableWidth) * 100;

                            result = {
                                type: 'dtf_calculation',
                                data: {
                                    imageWidth, imageHeight, quantity: totalQuantity, rollWidth,
                                    results: {
                                        imagesPerRow: finalPerRow,
                                        totalMeters: parseFloat(totalMeters.toFixed(2)),
                                        efficiency: Math.round(efficiency),
                                        orientation
                                    }
                                }
                            };
                        } else if (call.function.name === "calculate_shipping") {
                            const { to, from, package: pkg } = args;
                            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                                method: 'POST',
                                headers: {
                                    'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                                    'Authorization': req.headers.get('Authorization') || '',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'calculate',
                                    params: { to: to.replace(/\D/g, ''), from: from?.replace(/\D/g, ''), package: pkg || { weight: 0.5, height: 2, width: 11, length: 16 } }
                                })
                            });
                            result = await response.json();
                        } else if (call.function.name === "create_shipping_label") {
                            const { orderNumber, to, service, package: pkg } = args;
                            const { data: order } = await supabase.from('pedidos').select('id, valor_total').eq('order_number', orderNumber).single();
                            if (!order) throw new Error("Pedido não encontrado.");

                            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                                method: 'POST',
                                headers: {
                                    'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                                    'Authorization': req.headers.get('Authorization') || '',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'cart',
                                    params: {
                                        pedido_id: order.id,
                                        to: { postal_code: to.replace(/\D/g, '') },
                                        service,
                                        volumes: [pkg || { weight: 0.5, height: 2, width: 11, length: 16 }],
                                        invoice_value: order.valor_total || 1,
                                        options: { non_commercial: true }
                                    }
                                })
                            });
                            result = await response.json();
                        } else if (call.function.name === "checkout_shipping_label") {
                            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                                method: 'POST',
                                headers: {
                                    'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                                    'Authorization': req.headers.get('Authorization') || '',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ action: 'checkout', params: { id: args.labelId } })
                            });
                            result = await response.json();
                        } else if (call.function.name === "get_shipping_label_link") {
                            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                                method: 'POST',
                                headers: {
                                    'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
                                    'Authorization': req.headers.get('Authorization') || '',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ action: 'tracking', params: { id: args.labelId } })
                            });
                            result = await response.json();
                        } else if (call.function.name === "query_database") {
                            let query = supabase.from(args.table).select(args.select || '*');
                            
                            // 1. Aplicar a Jaula de Segurança PRIMEIRO (Obrigatório)
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }

                            // 2. Aplicar Filtros Dinâmicos
                            if (args.filters && Array.isArray(args.filters)) {
                                for (const f of args.filters) {
                                    if (!f.column || !f.op) continue;
                                    
                                    // Tratamento especial para is null / is not null enviado como string
                                    let filterVal = f.value;
                                    if (filterVal === 'null') filterVal = null;
                                    
                                    switch (f.op) {
                                        case 'eq': query = query.eq(f.column, filterVal); break;
                                        case 'neq': query = query.neq(f.column, filterVal); break;
                                        case 'gt': query = query.gt(f.column, filterVal); break;
                                        case 'gte': query = query.gte(f.column, filterVal); break;
                                        case 'lt': query = query.lt(f.column, filterVal); break;
                                        case 'lte': query = query.lte(f.column, filterVal); break;
                                        case 'like': query = query.like(f.column, filterVal); break;
                                        case 'ilike': query = query.ilike(f.column, filterVal); break;
                                        case 'is': query = query.is(f.column, filterVal); break;
                                        case 'in': 
                                            // Converte string separada por vírgula em array para o IN do Supabase
                                            if (typeof filterVal === 'string') {
                                                query = query.in(f.column, filterVal.split(',').map(s => s.trim()));
                                            } else if (Array.isArray(filterVal)) {
                                                query = query.in(f.column, filterVal);
                                            }
                                            break;
                                    }
                                }
                            }

                            // 3. Aplicar Ordenação
                            if (args.order && args.order.column) {
                                query = query.order(args.order.column, { ascending: args.order.ascending === true });
                            } else {
                                // Default order if not specified
                                query = query.order('created_at', { ascending: false });
                            }

                            // 4. Aplicar Limite (Default 20, Max 50 para não estourar tokens)
                            const limit = Math.min(args.limit || 20, 50);
                            query = query.limit(limit);
                            
                            const { data, error } = await query;
                            result = error ? error.message : data;
                        } else if (call.function.name === "get_order_uuid_by_number") {
                            let query = supabase.from('pedidos').select('id, order_number').eq('order_number', args.orderNumber);
                            
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            const { data: order, error } = await query.single();
                            if (error || !order) throw new Error("Pedido não encontrado na sua organização.");
                            result = { id: order.id, order_number: order.order_number };
                        } else if (call.function.name === "get_client_orders") {
                            // Buscar cliente por nome ou ID
                            let clientId = args.clientId;
                            if (!clientId && args.clientName) {
                                let clientQuery = supabase.from('clientes').select('id');
                                const keywords = args.clientName.split(/\s+/).filter((k: string) => k.length > 0);
                                keywords.forEach((word: string) => {
                                    clientQuery = clientQuery.ilike('nome', `%${word}%`);
                                });
                                
                                if (orgId) {
                                    clientQuery = clientQuery.eq('organization_id', orgId);
                                } else {
                                    clientQuery = clientQuery.eq('user_id', userId).is('organization_id', null);
                                }
                                const { data: client } = await clientQuery.limit(1).single();
                                if (!client) throw new Error("Cliente não encontrado.");
                                clientId = client.id;
                            }
                            if (!clientId) throw new Error("Informe o nome ou ID do cliente.");

                            // Buscar pedidos com pago_at para lógica correta
                            let ordersQuery = supabase.from('pedidos').select('id, order_number, status, valor_total, created_at, production_status, pago_at, cliente:clientes(nome, telefone)', { count: 'exact' }).eq('cliente_id', clientId);
                            
                            if (orgId) {
                                ordersQuery = ordersQuery.eq('organization_id', orgId);
                            } else {
                                ordersQuery = ordersQuery.eq('user_id', userId).is('organization_id', null);
                            }

                            // CORREÇÃO CRÍTICA: Filtro inteligente por status
                            // 'pendente' = pago_at IS NULL (não cancelado)
                            // 'pago' = pago_at IS NOT NULL
                            // outros = filtro literal por status
                            if (args.status === 'pendente') {
                                ordersQuery = ordersQuery.is('pago_at', null).neq('status', 'cancelado').neq('status', 'pago').neq('status', 'entregue');
                            } else if (args.status === 'pago') {
                                ordersQuery = ordersQuery.not('pago_at', 'is', null);
                            } else if (args.status) {
                                ordersQuery = ordersQuery.eq('status', args.status);
                            }
                            
                            const limit = args.limit || 100;
                            const { data: orders, count } = await ordersQuery.order('created_at', { ascending: false }).limit(limit);
                            
                            result = {
                                orders: orders,
                                total_found: count,
                                showing: orders?.length,
                                message: count && count > limit ? `Atenção: Existem ${count} pedidos no total, mas estou mostrando apenas os ${limit} mais recentes por limitação técnica.` : null
                            };
                        } else if (call.function.name === "prepare_bulk_whatsapp_messages") {
                            const clientsToMessage = [];
                            let successCount = 0;
                            let errorCount = 0;

                            for (const item of args.messages) {
                                let finalPhone = item.phone || '';
                                let resolvedClientName = item.clientName || '';
                                const isPlaceholder = !finalPhone || finalPhone.includes('999999999');

                                if (isPlaceholder && item.clientName) {
                                    let query = supabase.from('clientes').select('nome, telefone');
                                    const keywords = item.clientName.split(/\s+/).filter((k: string) => k.length > 0);
                                    keywords.forEach((word: string) => {
                                        query = query.ilike('nome', `%${word}%`);
                                    });
                                    const { data: client } = await query.limit(1).maybeSingle();
                                    
                                    if (client?.telefone) {
                                        finalPhone = client.telefone;
                                        resolvedClientName = client.nome;
                                    }
                                }

                                if (!finalPhone || finalPhone.includes('999999999')) {
                                    errorCount++;
                                    continue;
                                }

                                const cleanPhone = finalPhone.replace(/\D/g, '');
                                clientsToMessage.push({
                                    clientName: resolvedClientName,
                                    phone: finalPhone,
                                    cleanPhone: cleanPhone,
                                    message: item.message,
                                    link: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(item.message)}`
                                });
                                successCount++;
                            }

                            // FALLBACK LOGIC: Check user instance, then admin instance
                            let whatsappInstance = profile?.whatsapp_instance_id;
                            if (!whatsappInstance) {
                                const { data: admin } = await supabase.from('profiles').select('whatsapp_instance_id').eq('is_admin', true).not('whatsapp_instance_id', 'is', null).limit(1).single();
                                whatsappInstance = admin?.whatsapp_instance_id;
                            }
                            const canSendDirectly = !!whatsappInstance;

                            // AUTO-SEND BULK if on WhatsApp platform
                            let autoSentCount = 0;
                            if (platform === 'whatsapp' && canSendDirectly && clientsToMessage.length > 0) {
                                try {
                                    const { data: adminConfig } = await supabase.from('profiles').select('whatsapp_api_url, whatsapp_api_key').eq('is_admin', true).not('whatsapp_api_url', 'is', null).limit(1).single();
                                    const evUrl = profile?.whatsapp_api_url || adminConfig?.whatsapp_api_url;
                                    const evKey = profile?.whatsapp_api_key || adminConfig?.whatsapp_api_key;

                                    if (evUrl && evKey && whatsappInstance) {
                                        for (const client of clientsToMessage) {
                                            const sendUrl = `${evUrl.replace(/\/$/, "")}/message/sendText/${whatsappInstance}`;
                                            await fetch(sendUrl, {
                                                method: 'POST',
                                                headers: { 'apikey': evKey, 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ number: client.cleanPhone, text: client.message, delay: 500 })
                                            });
                                            autoSentCount++;
                                            // Delay light to prevent Edge Function timeout if too many, but still give some space
                                            if (clientsToMessage.length > 5) await new Promise(r => setTimeout(r, 300));
                                        }
                                    }
                                } catch (e) {
                                    console.error("Auto-send Bulk failed:", e);
                                }
                            }

                            result = {
                                type: autoSentCount > 0 ? 'bulk_whatsapp_sent' : 'bulk_whatsapp_action',
                                data: {
                                    successCount,
                                    errorCount,
                                    clientsToMessage,
                                    canSendDirectly,
                                    autoSent: autoSentCount > 0,
                                    autoSentCount
                                }
                            };
                        } else if (call.function.name === "search_clients") {
                            let query = supabase.from('clientes').select('id, nome, telefone, email, valor_metro');
                            const keywords = args.query.split(/\s+/).filter((k: string) => k.length > 0);
                            keywords.forEach((word: string) => {
                                query = query.ilike('nome', `%${word}%`);
                            });
                            
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId).is('organization_id', null);
                            }
                            
                            const { data } = await query.limit(args.limit || 10);
                            result = data;
                        } else if (call.function.name === "perform_calculation") {
                            try {
                                const sanitizedExpression = args.expression.replace(/[^0-9+\-*/(). ]/g, '');
                                const calcResult = new Function(`return ${sanitizedExpression}`)();
                                result = { expression: args.expression, result: calcResult };
                            } catch (e: any) {
                                result = { error: "Expressão inválida. " + e.message };
                            }
                        }

                        const resultString = truncate(JSON.stringify(result));
                        intermediateSteps.push({ tool: call.function.name, args, result: resultString });
                        chatMessages.push({ role: "tool", tool_call_id: call.id, content: resultString });

                        // LOG de tool_call para auditoria
                        await supabase.from('system_logs').insert({
                            level: 'info',
                            category: 'brain_tool_call',
                            message: `Tool: ${call.function.name}`,
                            user_id: userId,
                            details: { args, result_preview: resultString.substring(0, 300) }
                        }).then(() => {}).catch(() => {}); // fire-and-forget
                    } catch (e: any) {
                        chatMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: e.message }) });
                        // LOG de erro de tool para auditoria
                        await supabase.from('system_logs').insert({
                            level: 'error',
                            category: 'brain_tool_error',
                            message: `Tool ERROR: ${call.function.name}: ${e.message}`,
                            user_id: userId,
                            details: { args, error: e.message }
                        }).then(() => {}).catch(() => {}); // fire-and-forget
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
