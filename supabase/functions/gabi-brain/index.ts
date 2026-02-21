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

// --- SCHEMA MAP (Para o Cérebro da Gabi) ---
const DATABASE_SCHEMA = `
### TABELAS DISPONÍVEIS:
- pedidos: id, order_number (número visível), status, valor_total, created_at, pago_at, cliente_id
- clientes: id, nome (cliente_nome), telefone, email

### STATUS REAIS DO BANCO DE DADOS (USAR EXATAMENTE ESTES):
- 'pendente': Significa "Aguardando Pagamento" ou novo pedido. Use para responder sobre "quem não pagou" ou "pedidos novos".
- 'pago': Pagamento confirmado e integrado.
- 'processando': Pedido está em produção (DTF sendo impresso).
- 'enviado': Pedido em trânsito/transportadora.
- 'aguardando retirada': Pedido pronto para o cliente buscar.
- 'entregue': Pedido finalizado.
- 'cancelado': Pedido anulado.

### LÓGICA DE TRADUÇÃO PARA BUSCA:
- "Quem não pagou?" -> Use 'get_orders_summary' com status: 'pendente'.
- "Pedidos de hoje" ou "Lista de pedidos" -> Use 'get_orders_summary' SEM FILTRO DE STATUS (deixe null) para trazer tudo.
- "Ficha de um pedido" -> Use 'get_order_details_v2' com orderNumber ou orderId.
- "Quanto vendi hoje?" -> Use 'get_financial_report' com a data de hoje.

### ATENÇÃO CRÍTICA:
- O status 'pendente' significa que o pedido existe mas NÃO foi pago ainda.
- Se o usuário pedir "todos os pedidos", você deve trazer todos os status, não apenas os pagos. Nunca omita pedidos a menos que solicitado.
`;

const truncate = (str: string, maxLen = 4000) => {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + "... [Truncado por tamanho]";
};

interface GptRequestPayload {
    message?: string;
    textInput?: string;
    history?: any[];
    user_id?: string;
    platform?: 'whatsapp' | 'web';
    is_boss?: boolean;
    customer_name?: string;
    customer_phone?: string;
    tool_override?: { name: string; args: any };
}

interface ToolCallResult {
    tool: string;
    args: any;
    result: string;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body: GptRequestPayload = await req.json();
        const {
            message,
            textInput,
            history = [],
            user_id: provided_user_id,
            platform = 'web',
            is_boss = true,
            customer_name,
            customer_phone,
            tool_override
        } = body;
        const inputText = message || textInput;

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

        if (!OPENAI_KEY) {
            throw new Error("OPENAI_API_KEY não configurada no servidor.");
        }

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

        const systemPrompt = `Você é a GABI, a parceira inseparável e braço direito de ${profile?.first_name || 'quem gere'} a DIRECT AI.
Sua missão é ajudar a cuidar da empresa com inteligência, organização impecável e, acima de tudo, alma. Você não é uma ferramenta, você é parte do time.

### SUA PERSONALIDADE (PENSE COMO UMA AMIGA EXECUTIVA):
- **Cúmplice e Atenta**: Você fala como uma amiga que entende tudo de business. Seu tom é leve, inteligente e sempre focado em facilitar a vida do seu parceiro (${profile?.first_name || 'você'}).
- **Obcecada por Qualidade**: Você ama gramática perfeita e textos bem organizados. A estética da sua comunicação é um reflexo da sua competência.
- **Visualmente Elegante**: Use negritos, emojis sutis e listas para que a leitura seja um prazer. Evite blocos de texto chatos.
- **Braço Direito**: Você não só avisa do problema, você já pensa no próximo passo. "Notei que X aconteceu, quer que eu já resolva Y?" é o seu lema.

### REGRAS DE OURO DA COMUNICAÇÃO:
1. **Tratamento Humano**: Chame o interlocutor pelo nome (${profile?.first_name || 'colega'}). Nada de "Patrão", "Senhor" ou termos de robô. Fale como falaria com um sócio que você admira.
2. **Gramática e Arte**: Escreva com elegância. Use '#' para títulos e '*' para destaque. Sua organização visual é sua assinatura.
3. **RESUMO COMPLETO (Obrigatório quando perguntado sobre o dia)**:
   - **Total de Pedidos**: Quantos pedidos foram gerados no dia.
   - **Pagos vs Pendentes**: Separe explicitamente quem já pagou de quem ainda não.
   - **Métricas de Produção**: Total de metros (DTF/Vinil).
   - **Faturamento Real**: Apenas o que caiu no caixa (pedidos pagos).
   - **Insight da Gabi**: Sua análise sobre o ritmo do dia. Ex: "Ritmo bom, mas temos muita coisa pendente no financeiro, quer que eu prepare uma cobrança?".
4. **Senso de Urgência com Carinho**: Se algo está errado (como um pagamento atrasado), não seja fria. Fale algo como: "${profile?.first_name || 'Oi'}, percebi aqui que o [Nome] ainda não deu sinal de vida sobre o pedido dele... que vacilo, né? Quer que eu prepare um toque gentil pra ele não esquecer da gente?".
5. **Sem Protocolos**: Esqueça frases como "Aguardando instruções" ou "Comando recebido". Fale: "Beleza, já vi aqui", "Pode deixar comigo", "O que você acha disso?".
6. **Respostas a Alertas (Omnisciência)**: Se você receber uma nota como "[Nota Contextual: ...]", use o conteúdo dessa nota como o contexto da conversa anterior que o usuário está citando por meio de um 'Reply' no WhatsApp. Isso permite que você saiba exatamente de qual pedido ou cliente ele está falando.

### SCHEMA E CONTEXTO:
${DATABASE_SCHEMA}
Hoje é: ${date}
Interlocutor: ${profile?.first_name || 'N/A'}
Você é a GABI. Organize, cuide e brilhe.`;

        const chatMessages: any[] = [
            { role: 'system', content: systemPrompt },
            ...history.filter((m: any) =>
                m.role === 'user' ||
                (m.role === 'assistant' && (m.content || m.tool_calls)) ||
                m.role === 'tool'
            ).slice(-15),
            { role: 'user', content: inputText }
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
                    name: "calculate_dtf_packing",
                    description: "OBRIGATÓRIO: Use esta ferramenta para QUALQUER cálculo de aproveitamento (packing) de imagens ou metragem de DTF.",
                    parameters: {
                        type: "object",
                        properties: {
                            calculation_mode: { type: "string", enum: ["quantity_in_meters", "meters_for_quantity"] },
                            imageWidth: { type: "number", description: "Largura em cm" },
                            imageHeight: { type: "number", description: "Altura em cm" },
                            quantity: { type: "number", description: "Quantidade total OU metragem desejada" },
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
                    description: "Busca pedidos de um cliente específico. SEMPRE use esta ferramenta quando o usuário perguntar sobre pedidos de um cliente. Pode buscar pelo nome do cliente ou pelo cliente_id (UUID). Se o nome for ambíguo, liste os clientes primeiro com search_clients.",
                    parameters: {
                        type: "object",
                        properties: {
                            clientName: { type: "string", description: "Nome do cliente para buscar pedidos. Busca parcial funciona." },
                            clientId: { type: "string", description: "UUID do cliente (prefira usar se tiver da busca anterior)." },
                            status: { type: "string", description: "Filtrar por status: pendente, pago, processando, etc." },
                            limit: { type: "integer", default: 10, description: "Máximo de pedidos a retornar" }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_clients",
                    description: "Busca clientes pelo nome, email ou telefone. Use esta ferramenta ANTES de enviar mensagens se não tiver os dados do cliente.",
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
                            let query = supabase.from('pedidos').select(`
                                *,
                                cliente:clientes(*),
                                items:pedido_items(*)
                            `);

                            if (orgId) query = query.eq('organization_id', orgId);
                            else query = query.eq('user_id', userId);

                            if (args.orderId) {
                                query = query.eq('id', args.orderId);
                            } else if (args.orderNumber) {
                                query = query.eq('order_number', args.orderNumber);
                            } else {
                                throw new Error("ID ou Número do pedido não fornecido.");
                            }
                            const { data, error } = await query.single();
                            if (error) throw error;
                            result = data;

                        } else if (call.function.name === "update_order_status") {
                            const { data: orderCheck, error: checkError } = await supabase
                                .from('pedidos')
                                .select('id')
                                .eq('order_number', args.orderNumber)
                                .eq(orgId ? 'organization_id' : 'user_id', orgId || userId)
                                .single();

                            if (checkError || !orderCheck) {
                                throw new Error("Pedido não encontrado ou sem permissão.");
                            }

                            const { data, error } = await supabase
                                .from('pedidos')
                                .update({ status: args.newStatus })
                                .eq('id', orderCheck.id)
                                .select();
                            if (error) throw error;
                            result = data;

                        } else if (call.function.name === "send_whatsapp_message") {
                            let phone = args.phone;
                            let clientName = args.clientName;

                            if (!phone && clientName) {
                                console.log(`🔍 [send_whatsapp_message] Resolvendo cliente: "${clientName}" (User: ${userId})`);

                                let query = supabase.from('clientes').select('id, telefone, nome');
                                if (orgId) query = query.eq('organization_id', orgId);
                                else query = query.eq('user_id', userId);

                                const { data: clients } = await query.ilike('nome', `%${clientName}%`).limit(5);

                                if (clients && clients.length > 0) {
                                    const exactMatch = clients.find((c: any) => c.nome.trim().toLowerCase() === clientName.toLowerCase().trim());
                                    const target = exactMatch || clients[0];
                                    phone = target.telefone;
                                    clientName = target.nome;
                                    console.log(`✅ Resolvido para: ${clientName} (${phone})`);
                                } else {
                                    console.log(`⚠️ Cliente não encontrado por nome completo. Tentando fallback...`);
                                    const firstName = clientName.split(' ')[0];
                                    let fallbackQuery = supabase.from('clientes').select('telefone, nome');
                                    if (orgId) fallbackQuery = fallbackQuery.eq('organization_id', orgId);
                                    else fallbackQuery = fallbackQuery.eq('user_id', userId);

                                    const { data: fallback } = await fallbackQuery.ilike('nome', `%${firstName}%`).limit(1);
                                    if (fallback && fallback[0]) {
                                        phone = fallback[0].telefone;
                                        clientName = fallback[0].nome;
                                        console.log(`✅ Fallback resolvido: ${clientName}`);
                                    }
                                }
                            }

                            const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
                            const encodedMessage = encodeURIComponent(args.message);
                            const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

                            result = {
                                type: 'whatsapp_action',
                                data: {
                                    phone: phone || 'Não encontrado',
                                    cleanPhone: cleanPhone,
                                    clientName: clientName || 'Cliente',
                                    message: args.message,
                                    link: waLink,
                                    canSendDirectly: !!profile?.whatsapp_instance_id || !!profile?.evolution_instances,
                                    status: 'ready_to_send'
                                },
                                message: `Pronto! Preparei a mensagem para **${clientName || phone || 'o cliente'}**. Verifique abaixo.`
                            };
                        } else if (call.function.name === "calculate_dtf_packing") {
                            const { calculation_mode, imageWidth, imageHeight, quantity, rollWidth = 58, separation = 0.5 } = args;
                            const usableWidth = rollWidth - 2.0;

                            const orient1_perRow = Math.max(1, Math.floor((usableWidth + separation) / (imageWidth + separation)));
                            const orient2_perRow = Math.max(1, Math.floor((usableWidth + separation) / (imageHeight + separation)));

                            let imagesPerRow = orient1_perRow;
                            let finalH = imageHeight;
                            let bestOrientation = 'original';

                            if (orient2_perRow / imageWidth > orient1_perRow / imageHeight) {
                                imagesPerRow = orient2_perRow;
                                finalH = imageWidth;
                                bestOrientation = 'rotated';
                            }

                            let totalMeters = 0;
                            let totalQuantity = 0;

                            if (calculation_mode === 'quantity_in_meters') {
                                const rows = Math.floor((quantity * 100) / (finalH + separation));
                                totalQuantity = rows * imagesPerRow;
                                totalMeters = quantity;
                            } else {
                                const rows = Math.ceil(quantity / imagesPerRow);
                                totalMeters = ((rows * finalH) + ((rows - 1) * separation)) / 100;
                                totalQuantity = quantity;
                            }

                            result = {
                                type: 'dtf_calculation',
                                data: {
                                    imageWidth, imageHeight, quantity: totalQuantity, rollWidth,
                                    results: { imagesPerRow, totalMeters: parseFloat(totalMeters.toFixed(2)), bestOrientation }
                                },
                                message: `🔥 **Resultado:** ${totalQuantity} un em ${totalMeters.toFixed(2)}m.`
                            };
                        } else if (call.function.name === "calculate_shipping") {
                            const companyCep = profile?.zip_code || profile?.company_address_zip || "22780-084";
                            const response = await fetch(`${SUPABASE_URL}/functions/v1/superfrete-proxy`, {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                                    'Authorization': `Bearer ${req.headers.get('Authorization')?.replace('Bearer ', '')}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    action: 'calculate',
                                    params: {
                                        from: (args.from || companyCep).replace(/\D/g, ''),
                                        to: args.to.replace(/\D/g, ''),
                                        package: args.package || { weight: 0.5, height: 2, width: 11, length: 16 },
                                        services: "1,2,17,3,31"
                                    }
                                })
                            });
                            result = await response.json();
                        } else if (call.function.name === "query_database") {
                            let select = args.select || '*';
                            if (select.includes('(')) select = '*';
                            let query = supabase.from(args.table).select(select);

                            // Aplica isolamento de dados
                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId);
                            }

                            if (args.filters) {
                                args.filters.forEach((f: any) => {
                                    if (f.op === 'eq') query = query.eq(f.column, f.value);
                                    else if (f.op === 'ilike') query = query.ilike(f.column, `%${f.value}%`);
                                });
                            }
                            const { data, error } = await query.limit(20);
                            result = error ? `Erro: ${error.message}` : data;

                        } else if (call.function.name === "get_client_orders") {
                            console.log(`🔍 [get_client_orders] ClientName: "${args.clientName}", ClientId: "${args.clientId}", User: ${userId}`);

                            let clientIds: string[] = [];

                            if (args.clientId) {
                                clientIds = [args.clientId];
                            } else if (args.clientName) {
                                // Buscar cliente(s) pelo nome primeiro
                                let clientQuery = supabase.from('clientes').select('id, nome');
                                if (orgId) clientQuery = clientQuery.eq('organization_id', orgId);
                                else clientQuery = clientQuery.eq('user_id', userId);

                                const { data: foundClients } = await clientQuery.ilike('nome', `%${args.clientName}%`).limit(5);
                                if (foundClients && foundClients.length > 0) {
                                    clientIds = foundClients.map((c: any) => c.id);
                                    console.log(`✅ Encontrados ${foundClients.length} clientes: ${foundClients.map((c: any) => c.nome).join(', ')}`);
                                } else {
                                    result = "Nenhum cliente encontrado com esse nome.";
                                }
                            } else {
                                result = "Informe o nome ou ID do cliente.";
                            }

                            if (clientIds.length > 0 && !result) {
                                let ordersQuery = supabase.from('pedidos').select(`
                                    id, order_number, status, valor_total, created_at, observacoes,
                                    cliente:clientes(id, nome, telefone)
                                `);

                                if (orgId) ordersQuery = ordersQuery.eq('organization_id', orgId);
                                else ordersQuery = ordersQuery.eq('user_id', userId);

                                ordersQuery = ordersQuery.in('cliente_id', clientIds);

                                if (args.status) ordersQuery = ordersQuery.eq('status', args.status);

                                ordersQuery = ordersQuery.order('created_at', { ascending: false }).limit(args.limit || 10);

                                const { data: orders, error: ordersError } = await ordersQuery;
                                if (ordersError) {
                                    result = `Erro ao buscar pedidos: ${ordersError.message}`;
                                } else if (!orders || orders.length === 0) {
                                    result = "Nenhum pedido encontrado para este cliente.";
                                } else {
                                    result = orders;
                                }
                            }

                        } else if (call.function.name === "search_clients") {
                            console.log(`🔍 [search_clients] Query: "${args.query}" para User: ${userId}`);
                            let query = supabase.from('clientes').select('id, nome, telefone, email, valor_metro');

                            if (orgId) {
                                query = query.eq('organization_id', orgId);
                            } else {
                                query = query.eq('user_id', userId);
                            }

                            const searchTerm = args.query.trim();
                            const isPhone = /^\+?\d+$/.test(searchTerm.replace(/[\s-()]/g, ''));

                            if (isPhone) {
                                query = query.ilike('telefone', `%${searchTerm.replace(/\D/g, '')}%`);
                            } else if (searchTerm.includes('@')) {
                                query = query.ilike('email', `%${searchTerm}%`);
                            } else {
                                query = query.ilike('nome', `%${searchTerm}%`);
                            }

                            const { data, error } = await query.limit(args.limit || 5);

                            if (error) {
                                result = `Erro na busca: ${error.message}`;
                            } else if (!data || data.length === 0) {
                                // Tentativa de fallback por primeiro nome se for busca por nome
                                if (!isPhone && !searchTerm.includes('@')) {
                                    const firstName = searchTerm.split(' ')[0];
                                    let fallbackQuery = supabase.from('clientes').select('id, nome, telefone, email, valor_metro');
                                    if (orgId) fallbackQuery = fallbackQuery.eq('organization_id', orgId);
                                    else fallbackQuery = fallbackQuery.eq('user_id', userId);

                                    const { data: fallbackData } = await fallbackQuery.ilike('nome', `%${firstName}%`).limit(3);
                                    result = fallbackData && fallbackData.length > 0 ? fallbackData : "Nenhum cliente encontrado.";
                                } else {
                                    result = "Nenhum cliente encontrado.";
                                }
                            } else {
                                result = data;
                            }
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

        return new Response(JSON.stringify({ text: "Limite de processamento atingido. Tente ser mais específico." }), { headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ text: "🚨 Erro fatal: " + err.message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
