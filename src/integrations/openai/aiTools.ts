import { supabase } from '@/integrations/supabase/client';
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { removeAccents } from '@/utils/string';

// Função para obter data e hora atual no fuso horário do Rio de Janeiro
export const getCurrentDateTime = () => {
  const now = new Date();
  const TIME_ZONE = 'America/Sao_Paulo';

  // Usar Intl.DateTimeFormat para obter os componentes da data no fuso horário desejado
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'long',
    // month: 'long', // Já obtido no displayDate/monthName
    timeZone: TIME_ZONE,
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let year: number = now.getFullYear(), month: number = now.getMonth() + 1, day: number = now.getDate();
  let hour: number = now.getHours(), minute: number = now.getMinutes(), second: number = now.getSeconds();
  let weekday: string = '', monthName: string = '';

  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value);
    if (part.type === 'month') month = parseInt(part.value);
    if (part.type === 'day') day = parseInt(part.value);
    if (part.type === 'hour') hour = parseInt(part.value);
    if (part.type === 'minute') minute = parseInt(part.value);
    if (part.type === 'second') second = parseInt(part.value);
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'month') monthName = part.value;
  }

  // Reconstruir um objeto Date que representa o momento atual no Rio de Janeiro (localmente)
  // Isso é crucial para que as operações de setHours/setDate funcionem corretamente no contexto do Rio.
  const rioLocalTime = new Date(year, month - 1, day, hour, minute, second);

  // Formatos de exibição
  const displayDate = rioLocalTime.toLocaleDateString('pt-BR', { dateStyle: 'full', timeZone: TIME_ZONE });
  const displayTime = rioLocalTime.toLocaleTimeString('pt-BR', { timeStyle: 'medium', timeZone: TIME_ZONE });

  // Calcular intervalos de data com base em rioLocalTime
  const startOfRioDay = new Date(rioLocalTime);
  startOfRioDay.setHours(0, 0, 0, 0);

  const endOfRioDay = new Date(rioLocalTime);
  endOfRioDay.setHours(23, 59, 59, 999);

  const startOfRioMonth = new Date(rioLocalTime.getFullYear(), rioLocalTime.getMonth(), 1, 0, 0, 0, 0);
  const endOfRioMonth = new Date(rioLocalTime.getFullYear(), rioLocalTime.getMonth() + 1, 0, 23, 59, 59, 999);

  const dayOfWeekIndex = rioLocalTime.getDay(); // 0 para Domingo, 6 para Sábado
  const startOfRioWeek = new Date(rioLocalTime);
  startOfRioWeek.setDate(rioLocalTime.getDate() - dayOfWeekIndex);
  startOfRioWeek.setHours(0, 0, 0, 0);

  const endOfRioWeek = new Date(startOfRioWeek);
  endOfRioWeek.setDate(startOfRioWeek.getDate() + 6);
  endOfRioWeek.setHours(23, 59, 59, 999);

  return {
    fullDate: displayDate,
    dayOfWeek: weekday,
    date: rioLocalTime.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
    time: displayTime,
    timestamp: rioLocalTime.toISOString(), // Isso será UTC, mas derivado corretamente do horário local do Rio
    current: {
      day: day,
      month: month, // Mês 1-indexado
      year: year,
      dayOfWeek: weekday,
      monthName: monthName
    },
    ranges: {
      thisMonth: {
        start: startOfRioMonth.toISOString(),
        end: endOfRioMonth.toISOString(),
        label: `${monthName} de ${year}`
      },
      thisWeek: {
        start: startOfRioWeek.toISOString(),
        end: endOfRioWeek.toISOString(),
        label: `Semana de ${startOfRioWeek.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })} a ${endOfRioWeek.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })}`
      },
      today: {
        start: startOfRioDay.toISOString(),
        end: endOfRioDay.toISOString(),
        label: `Hoje (${displayDate})`
      }
    }
  };
};

// OpenAI Functions format
export const openAIFunctions = [
  {
    name: "get_current_date",
    description: "Obtém a data e hora atual do sistema, sempre no fuso horário de Rio de Janeiro (America/Sao_Paulo). Use esta função quando precisar saber 'que dia é hoje', 'que mês estamos', ou quando o usuário mencionar períodos relativos como 'desse mês', 'desta semana', 'hoje', 'ontem', etc.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_client_orders",
    description: "Obtém TODOS os pedidos de um cliente específico, independente da data. Use esta função quando o usuário pedir 'pedidos do cliente X', 'todos os pedidos do Detto', 'pedidos do cliente Y desse mês', etc. Retorna o NÚMERO do pedido, status, valor total, data de criação e nome do cliente. Usa busca inteligente que encontra clientes mesmo com nomes parciais ou pequenos erros de digitação.",
    parameters: {
      type: "object",
      properties: {
        clientName: {
          type: "string",
          description: "O nome completo ou parcial do cliente. A busca é inteligente e encontra clientes mesmo com pequenos erros de digitação ou nomes incompletos."
        }
      },
      required: ["clientName"]
    }
  },
  {
    name: "get_client_details",
    description: "Obtém os detalhes de um cliente específico, dado o nome do cliente. Usa busca inteligente que encontra clientes mesmo com nomes parciais ou pequenos erros de digitação.",
    parameters: {
      type: "object",
      properties: {
        clientName: {
          type: "string",
          description: "O nome completo ou parcial do cliente. A busca é inteligente e encontra clientes mesmo com pequenos erros de digitação ou nomes incompletos."
        }
      },
      required: ["clientName"]
    }
  },
  {
    name: "get_order_details",
    description: "Obtém os detalhes de um pedido específico, dado o NÚMERO do pedido.",
    parameters: {
      type: "object",
      properties: {
        orderNumber: {
          type: "number",
          description: "O número sequencial do pedido."
        }
      },
      required: ["orderNumber"]
    }
  },
  {
    name: "get_orders_by_status",
    description: "Obtém pedidos filtrando por um ou mais status. Use para perguntas como 'quantos pedidos pendentes?', 'liste os pedidos cancelados', 'quais pedidos não estão pagos?'. Retorna o NÚMERO do pedido, status, valor total, data de criação e nome do cliente.",
    parameters: {
      type: "object",
      properties: {
        statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
          },
          description: "Uma lista de status para INCLUIR nos resultados."
        },
        exclude_statuses: {
            type: "array",
            items: {
              type: "string",
              enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
            },
            description: "Uma lista de status para EXCLUIR dos resultados. Use para perguntas como 'pedidos que não estão pagos'."
        },
        limit: {
            type: "number",
            description: "Número máximo de pedidos a retornar. Padrão é 20."
        },
        includeTotalCount: { // Novo parâmetro
          type: "boolean",
          description: "Se verdadeiro, retorna a contagem total de pedidos que correspondem aos filtros, além dos pedidos listados. Use para perguntas como 'quantos pedidos temos no total?' ou 'quantos pedidos pendentes existem?'"
        }
      }
    }
  },
  {
    name: "list_orders",
    description: "Lista pedidos por filtros de data, sem especificar cliente. Use esta função SOMENTE quando o usuário pedir pedidos por período sem mencionar cliente específico (ex: 'pedidos de hoje', 'pedidos desta semana', 'último pedido', 'quantos pedidos esta semana', 'pedido mais caro'). NÃO use esta função quando o usuário mencionar um cliente específico. Retorna o NÚMERO do pedido, status, valor total, data de criação e nome do cliente.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          format: "date-time",
          description: "Data de início do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T00:00:00.000Z')."
        },
        endDate: {
          type: "string",
          format: "date-time",
          description: "Data de fim do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T23:59:59.999Z')."
        },
        limit: {
          type: "number",
          description: "Número máximo de pedidos a retornar. Padrão é 10."
        },
        orderBy: {
          type: "string",
          enum: ["created_at_asc", "created_at_desc", "valor_total_desc"],
          description: "Campo e direção para ordenar os pedidos. 'created_at_asc' para os mais antigos primeiro, 'created_at_desc' para os mais recentes primeiro, 'valor_total_desc' para os mais caros primeiro. Padrão é 'created_at_desc'."
        },
        includeTotalCount: {
          type: "boolean",
          description: "Se verdadeiro, retorna a contagem total de pedidos que correspondem aos filtros, além dos pedidos listados. Use para perguntas como 'quantos pedidos temos no total?' ou 'quantos pedidos este mês?'"
        },
        allTime: { // NEW PARAMETER
          type: "boolean",
          description: "Se verdadeiro, ignora startDate e endDate e busca pedidos desde o início. Use para perguntas como 'quantos vendemos desde que começamos?'"
        }
      },
      required: []
    }
  },
  {
    name: "list_services", // NEW TOOL
    description: "Lista serviços por filtros de data. Use para perguntas como 'quantos serviços tivemos esta semana?', 'quais serviços foram feitos hoje?'. Retorna o nome do serviço, quantidade, valor unitário, valor total, número do pedido, status do pedido, data do pedido e nome do cliente.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          format: "date-time",
          description: "Data de início do período para filtrar serviços (formato ISO 8601, ex: '2023-10-27T00:00:00.000Z')."
        },
        endDate: {
          type: "string",
          format: "date-time",
          description: "Data de fim do período para filtrar serviços (formato ISO 8601, ex: '2023-10-27T23:59:59.999Z')."
        },
        limit: {
          type: "number",
          description: "Número máximo de serviços a retornar. Padrão é 10."
        },
        orderBy: {
          type: "string",
          enum: ["created_at_asc", "created_at_desc", "valor_total_desc"],
          description: "Campo e direção para ordenar os serviços. 'created_at_asc' para os mais antigos primeiro, 'created_at_desc' para os mais recentes primeiro, 'valor_total_desc' para os mais caros primeiro. Padrão é 'created_at_desc'."
        },
        includeTotalCount: {
          type: "boolean",
          description: "Se verdadeiro, retorna a contagem total de serviços que correspondem aos filtros, além dos serviços listados."
        },
        allTime: { // NEW PARAMETER
          type: "boolean",
          description: "Se verdadeiro, ignora startDate e endDate e busca serviços desde o início."
        }
      },
      required: []
    }
  },
  {
    name: "update_order_status",
    description: "Atualiza o status de um pedido específico. O assistente pode usar esta ferramenta para marcar um pedido como pago, enviado, cancelado, etc. Se o NÚMERO do pedido for desconhecido, o assistente deve primeiro usar a ferramenta 'get_client_orders' para listar os pedidos do cliente e então pedir ao usuário para selecionar o pedido correto.",
    parameters: {
      type: "object",
      properties: {
        orderNumber: {
          type: "number",
          description: "O número sequencial do pedido a ser atualizado."
        },
        newStatus: {
          type: "string",
          enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"],
          description: "O novo status para o pedido."
        },
        observacao: { // Adicionado campo de observação
          type: "string",
          description: "Uma observação opcional sobre a mudança de status (ex: 'Pago 50% do valor', 'Cliente retirou parcialmente')."
        }
      },
      required: ["orderNumber", "newStatus"]
    }
  },
  {
    name: "generate_order_pdf",
    description: "Gera um PDF detalhado para um pedido específico, dado o NÚMERO do pedido.",
    parameters: {
      type: "object",
      properties: {
        orderNumber: {
          type: "number",
          description: "O número sequencial do pedido para o qual o PDF será gerado."
        }
      },
      required: ["orderNumber"]
    }
  },
  {
    name: "generate_multiple_pdfs",
    description: "Gera PDFs para múltiplos pedidos de uma só vez. Use esta função quando o usuário solicitar 'todas as notas', 'todos os PDFs', 'quero os 3 PDFs', ou múltiplos pedidos específicos. SEMPRE use esta função quando o usuário pedir múltiplos PDFs em vez de chamar generate_order_pdf várias vezes.",
    parameters: {
      type: "object",
      properties: {
        orderNumbers: {
          type: "array",
          items: {
            type: "number"
          },
          description: "Array com os NÚMEROS dos pedidos para os quais os PDFs serão gerados."
        }
      },
      required: ["orderNumbers"]
    }
  }
];

// Helper function to find order by number with multiple strategies
const findOrderByNumber = async (orderNumber: number) => {
  console.log(`🔍 [findOrderByNumber] Buscando pedido #${orderNumber}...`);
  
  // Strategy 1: Try RPC function first
  try {
    console.log('📍 [findOrderByNumber] Tentativa 1: Usando função RPC get_order_uuid_by_number');
    const { data: fullOrderId, error: rpcError } = await supabase.rpc('get_order_uuid_by_number', { p_order_number: orderNumber });
    
    if (!rpcError && fullOrderId) {
      console.log(`✅ [findOrderByNumber] RPC encontrou UUID: ${fullOrderId}`);
      return fullOrderId;
    }
    
    if (rpcError) {
      console.log('⚠️ [findOrderByNumber] Erro na função RPC:', rpcError.message);
    } else {
      console.log('❌ [findOrderByNumber] RPC não encontrou o pedido');
    }
  } catch (error) {
    console.log('❌ [findOrderByNumber] Erro ao chamar RPC:', error);
  }

  // Strategy 2: Direct query fallback
  try {
    console.log('📍 [findOrderByNumber] Tentativa 2: Busca direta na tabela pedidos');
    const { data: orders, error: directError } = await supabase
      .from('pedidos')
      .select('id')
      .eq('order_number', orderNumber)
      .limit(1);

    if (!directError && orders && orders.length > 0) {
      console.log(`✅ [findOrderByNumber] Busca direta encontrou UUID: ${orders[0].id}`);
      return orders[0].id;
    }
    
    if (directError) {
      console.log('❌ [findOrderByNumber] Erro na busca direta:', directError.message);
    } else {
      console.log('❌ [findOrderByNumber] Busca direta não encontrou o pedido');
    }
  } catch (error) {
    console.log('❌ [findOrderByNumber] Erro na busca direta:', error);
  }

  console.log('❌ [findOrderByNumber] Nenhuma estratégia encontrou o pedido');
  return null;
};

// Helper function to perform multiple search strategies for clients
const findClientWithMultipleStrategies = async (clientName: string) => {
  console.log(`🔍 [findClient] Buscando cliente: "${clientName}"`);
  
  const originalName = clientName.trim();
  const normalizedClientName = removeAccents(clientName.toLowerCase().trim());

  // Strategy 1: Try fuzzy search function (most flexible if working correctly)
  try {
    console.log('📍 [findClient] Tentativa 1: Busca fuzzy com função do banco (normalized)');
    const { data: fuzzyClients, error: fuzzyError } = await supabase
      .rpc('find_client_by_fuzzy_name', { 
        partial_name: normalizedClientName,
        similarity_threshold: 0.05 
      });

    if (!fuzzyError && fuzzyClients && fuzzyClients.length > 0) {
      console.log(`✅ [findClient] Busca fuzzy encontrou ${fuzzyClients.length} cliente(s):`, fuzzyClients.map(c => c.nome));
      return fuzzyClients;
    }
    if (fuzzyError) {
      console.log(`⚠️ [findClient] Erro na busca fuzzy para "${normalizedClientName}":`, fuzzyError.message);
    }
  } catch (error) {
    console.log(`❌ [findClient] Erro ao chamar RPC find_client_by_fuzzy_name:`, error);
  }

  // Strategy 2: Direct ILIKE search with normalized name (accent-insensitive if DB collation supports, or as a fallback)
  try {
    console.log('📍 [findClient] Tentativa 2: Busca ILIKE com nome normalizado');
    const { data: ilikeNormalizedClients, error: ilikeNormalizedError } = await supabase
      .from('clientes')
      .select('id, nome')
      .ilike('nome', `%${normalizedClientName}%`) 
      .limit(10);

    if (!ilikeNormalizedError && ilikeNormalizedClients && ilikeNormalizedClients.length > 0) {
      console.log(`✅ [findClient] ILIKE normalizado encontrou ${ilikeNormalizedClients.length} cliente(s):`, ilikeNormalizedClients.map(c => c.nome));
      return ilikeNormalizedClients;
    }
  } catch (error) {
    console.log('❌ [findClient] Erro na busca ILIKE normalizada:', error);
  }

  // Strategy 3: Broad search and client-side filtering (guaranteed accent-insensitive)
  // This will be the most reliable for accent issues.
  try {
    console.log(`📍 [findClient] Tentativa 3: Busca ampla e filtragem client-side (garantido sem acentos)`);
    // Fetch a larger set of clients to ensure we get potential matches
    const { data: allClients, error: allClientsError } = await supabase
      .from('clientes')
      .select('id, nome')
      .limit(100); // Fetch up to 100 clients for client-side filtering

    if (!allClientsError && allClients && allClients.length > 0) {
      const filteredClients = allClients.filter(client => 
        removeAccents(client.nome.toLowerCase()).includes(normalizedClientName)
      );
      if (filteredClients.length > 0) {
        console.log(`✅ [findClient] Busca ampla + client-side encontrou ${filteredClients.length} cliente(s):`, filteredClients.map(c => c.nome));
        return filteredClients;
      }
    }
  } catch (error) {
    console.log('❌ [findClient] Erro na busca ampla + client-side:', error);
  }

  // Strategy 4: Original ILIKE search (if normalized didn't work, maybe original has a specific match)
  try {
    console.log('📍 [findClient] Tentativa 4: Busca ILIKE com nome original');
    const { data: ilikeOriginalClients, error: ilikeOriginalError } = await supabase
      .from('clientes')
      .select('id, nome')
      .ilike('nome', `%${originalName}%`)
      .limit(10);

    if (!ilikeOriginalError && ilikeOriginalClients && ilikeOriginalClients.length > 0) {
      console.log(`✅ [findClient] ILIKE original encontrou ${ilikeOriginalClients.length} cliente(s):`, ilikeOriginalClients.map(c => c.nome));
      return ilikeOriginalClients;
    }
  } catch (error) {
    console.log('❌ [findClient] Erro na busca ILIKE original:', error);
  }

  // Strategy 5: Split name parts (less likely to be accent-sensitive, but kept for completeness)
  const nameParts = [
    ...originalName.split(' ').filter(part => part.length > 1),
    ...normalizedClientName.split(' ').filter(part => part.length > 1)
  ];
  const uniqueParts = [...new Set(nameParts)];
  
  if (uniqueParts.length > 0) {
    for (const part of uniqueParts) {
      try {
        console.log(`📍 [findClient] Tentativa por parte do nome: "${part}"`);
        const { data: clients, error: clientError } = await supabase
          .from('clientes')
          .select('id, nome')
          .ilike('nome', `%${part}%`)
          .limit(10);

        if (!clientError && clients && clients.length > 0) {
          console.log(`✅ [findClient] Busca por parte encontrou ${clients.length} cliente(s):`, clients.map(c => c.nome));
          return clients;
        }
      } catch (error) {
        console.log(`❌ [findClient] Erro na busca por parte "${part}":`, error);
      }
    }
  }

  console.log('❌ [findClient] Nenhuma estratégia de busca encontrou resultados');
  return null;
};

// Helper function to fetch complete order data for PDF generation
const fetchCompleteOrderData = async (fullOrderId: string) => {
  console.log(`📋 [fetchCompleteOrderData] Buscando dados completos do pedido: ${fullOrderId}`);
  
  try {
    const { data: orderData, error: fetchError } = await supabase
      .from('pedidos')
      .select(`
        *,
        clientes (
          id,
          nome,
          email,
          telefone,
          endereco
        ),
        pedido_items (
          id,
          produto_nome,
          quantidade,
          preco_unitario,
          observacao,
          produtos (
            id,
            nome
          )
        ),
        pedido_servicos (
          id,
          nome,
          quantidade,
          valor_unitario
        )
      `)
      .eq('id', fullOrderId)
      .single();

    if (fetchError) {
      console.error('❌ [fetchCompleteOrderData] Erro ao buscar dados:', fetchError);
      throw fetchError;
    }

    if (!orderData) {
      console.error('❌ [fetchCompleteOrderData] Nenhum dado encontrado');
      throw new Error('Pedido não encontrado');
    }

    console.log('✅ [fetchCompleteOrderData] Dados completos obtidos com sucesso');
    
    // Transform the data to match the expected format
    const transformedOrder = {
      ...orderData,
      servicos: orderData.pedido_servicos || []
    };

    return transformedOrder;
  } catch (error) {
    console.error('❌ [fetchCompleteOrderData] Erro:', error);
    throw error;
  }
};

// Modified list_orders function
export const list_orders = async (args: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  orderBy?: "created_at_asc" | "created_at_desc" | "valor_total_desc";
  includeTotalCount?: boolean;
  allTime?: boolean; // NEW
}) => {
  let { startDate, endDate, limit = 10, orderBy = 'created_at_desc', includeTotalCount, allTime } = args;
  const TIME_ZONE = 'America/Sao_Paulo';
  const dateInfo = getCurrentDateTime();
  let periodDescription = "em todo o período";

  if (allTime) {
    startDate = undefined;
    endDate = undefined;
    periodDescription = `desde o início`;
  } else if (!startDate && !endDate) {
    // Default to current month if no dates are provided and not allTime
    startDate = dateInfo.ranges.thisMonth.start;
    endDate = dateInfo.ranges.thisMonth.end;
    periodDescription = `neste mês de ${dateInfo.current.monthName} de ${dateInfo.current.year}`;
  } else if (startDate && !endDate) {
    const start = new Date(startDate);
    const startDay = start.getUTCDate();
    const startMonth = start.getUTCMonth();
    const startYear = start.getUTCFullYear();
    const end = new Date(Date.UTC(startYear, startMonth, startDay, 23, 59, 59, 999));
    endDate = end.toISOString();
    periodDescription = `em ${new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })}`;
  } else if (!startDate && endDate) {
    const end = new Date(endDate);
    const endDay = end.getUTCDate();
    const endMonth = end.getUTCMonth();
    const endYear = end.getUTCFullYear();
    const start = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
    startDate = start.toISOString();
    periodDescription = `em ${new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })}`;
  } else if (startDate && endDate) {
    const startDisplayDate = new Date(startDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    const endDisplayDate = new Date(endDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    periodDescription = startDisplayDate === endDisplayDate ? `em ${startDisplayDate}` : `entre ${startDisplayDate} e ${endDisplayDate}`;
  }

  console.log(`📊 [list_orders] Parâmetros da consulta:`, { 
    startDate, 
    endDate, 
    limit, 
    orderBy, 
    includeTotalCount,
    allTime
  });

  let query = supabase
    .from('pedidos')
    .select(`
      id,
      order_number,
      status,
      valor_total,
      created_at,
      clientes (nome)
    `, { count: includeTotalCount ? 'exact' : null });

  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const [orderFieldRaw, orderDirection] = orderBy.split('_');
  let orderField = orderFieldRaw;
  let ascending = orderDirection === 'asc';

  if (orderFieldRaw === 'created') {
    orderField = 'created_at';
  } else if (orderFieldRaw === 'valor' && orderDirection === 'total') {
    orderField = 'valor_total';
    ascending = false;
  }

  query = query.order(orderField, { ascending: ascending });
  
  if (!includeTotalCount && limit && limit > 0) {
    query = query.limit(limit);
  }

  const { data: orders, error, count } = await query;

  if (error) {
    console.error("Erro ao listar pedidos por data:", error);
    throw new Error(`Erro ao listar pedidos por data: ${error.message}`);
  }

  const totalCountMessage = includeTotalCount ? ` (Total de ${count} pedidos encontrados)` : '';

  if (!orders || orders.length === 0) {
    return { message: `❌ Nenhum pedido encontrado ${periodDescription}.${totalCountMessage}` };
  }

  const formattedOrders = orders.map((order, index) => ({
    index: index + 1,
    order_number: order.order_number,
    status: order.status,
    valor_total: order.valor_total,
    created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
    cliente: order.clientes?.nome
  }));

  const totalValue = orders.reduce((sum, order) => sum + order.valor_total, 0);

  return { 
    orders: formattedOrders, 
    summary: {
      count: orders.length,
      totalValue: totalValue,
      period: {
        start: startDate ? new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'início',
        end: endDate ? new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'fim'
      },
      totalMatchingOrders: count
    },
    message: `📊 Encontrados **${orders.length} pedidos** ${periodDescription}.${totalCountMessage}` 
  };
};

// New list_services function with multiple strategies
export const list_services = async (args: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  orderBy?: "created_at_asc" | "created_at_desc" | "valor_total_desc";
  includeTotalCount?: boolean;
  allTime?: boolean;
}) => {
  let { startDate, endDate, limit = 10, orderBy = 'created_at_desc', includeTotalCount, allTime } = args;
  const TIME_ZONE = 'America/Sao_Paulo';
  const dateInfo = getCurrentDateTime();
  let periodDescription = "em todo o período";

  if (allTime) {
    startDate = undefined;
    endDate = undefined;
    periodDescription = `desde o início`;
  } else if (!startDate && !endDate) {
    // Default to current week for services
    startDate = dateInfo.ranges.thisWeek.start;
    endDate = dateInfo.ranges.thisWeek.end;
    periodDescription = `nesta semana`;
  } else if (startDate && !endDate) {
    const start = new Date(startDate);
    const startDay = start.getUTCDate();
    const startMonth = start.getUTCMonth();
    const startYear = start.getUTCFullYear();
    const end = new Date(Date.UTC(startYear, startMonth, startDay, 23, 59, 59, 999));
    endDate = end.toISOString();
    periodDescription = `em ${new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })}`;
  } else if (!startDate && endDate) {
    const end = new Date(endDate);
    const endDay = end.getUTCDate();
    const endMonth = end.getUTCMonth();
    const endYear = end.getUTCFullYear();
    const start = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
    startDate = start.toISOString();
    periodDescription = `em ${new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })}`;
  } else if (startDate && endDate) {
    const startDisplayDate = new Date(startDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    const endDisplayDate = new Date(endDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    periodDescription = startDisplayDate === endDisplayDate ? `em ${startDisplayDate}` : `entre ${startDisplayDate} e ${endDisplayDate}`;
  }

  console.log(`🛠️ [list_services] Parâmetros da consulta:`, { 
    startDate, 
    endDate, 
    limit, 
    orderBy, 
    includeTotalCount,
    allTime
  });

  // Strategy 1: Try pedido_servicos table with JOIN
  try {
    console.log('📍 [list_services] Tentativa 1: Tabela pedido_servicos com JOIN');
    
    let query = supabase
      .from('pedido_servicos')
      .select(`
        id,
        nome,
        quantidade,
        valor_unitario,
        pedidos!inner (
          id,
          order_number,
          status,
          created_at,
          clientes (nome)
        )
      `, { count: includeTotalCount ? 'exact' : null });

    if (startDate) {
      query = query.gte('pedidos.created_at', startDate);
    }
    if (endDate) {
      query = query.lte('pedidos.created_at', endDate);
    }

    query = query.order('pedidos.created_at', { ascending: orderBy === 'created_at_asc' });
    
    if (!includeTotalCount && limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data: services, error, count } = await query;

    if (!error && services) {
      console.log(`✅ [list_services] Estratégia 1 funcionou: ${services.length} serviços encontrados`);
      
      const totalCountMessage = includeTotalCount ? ` (Total de ${count} serviços encontrados)` : '';

      if (services.length === 0) {
        return { message: `❌ Nenhum serviço encontrado ${periodDescription}.${totalCountMessage}` };
      }

      const formattedServices = services.map((service, index) => ({
        index: index + 1,
        service_name: service.nome,
        quantity: service.quantidade,
        unit_value: service.valor_unitario,
        total_value: service.quantidade * service.valor_unitario,
        order_number: service.pedidos?.order_number,
        order_status: service.pedidos?.status,
        order_date: new Date(service.pedidos?.created_at || '').toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
        client_name: service.pedidos?.clientes?.nome
      }));

      const totalRevenue = formattedServices.reduce((sum, service) => sum + service.total_value, 0);

      return { 
        services: formattedServices, 
        summary: {
          count: services.length,
          totalRevenue: totalRevenue,
          period: {
            start: startDate ? new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'início',
            end: endDate ? new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'fim'
          },
          totalMatchingServices: count
        },
        message: `🛠️ Encontrados **${services.length} serviços** ${periodDescription}.${totalCountMessage}` 
      };
    }
    
    console.log('⚠️ [list_services] Estratégia 1 falhou:', error?.message);
  } catch (error) {
    console.log('❌ [list_services] Erro na estratégia 1:', error);
  }

  // Strategy 2: Try alternative approach - get all orders first, then filter services
  try {
    console.log('📍 [list_services] Tentativa 2: Buscar pedidos primeiro, depois serviços');
    
    let ordersQuery = supabase
      .from('pedidos')
      .select(`
        id,
        order_number,
        status,
        created_at,
        clientes (nome)
      `);

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate);
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte('created_at', endDate);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.log('❌ [list_services] Erro ao buscar pedidos:', ordersError.message);
      throw new Error(`Erro ao buscar pedidos: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      return { message: `❌ Nenhum pedido encontrado ${periodDescription}, portanto nenhum serviço.` };
    }

    const orderIds = orders.map(order => order.id);
    
    // Try to get services from pedido_servicos table
    const { data: services, error: servicesError } = await supabase
      .from('pedido_servicos')
      .select('*')
      .in('pedido_id', orderIds);

    if (servicesError) {
      console.log('⚠️ [list_services] Erro na tabela pedido_servicos:', servicesError.message);
      throw new Error(`Erro ao buscar serviços: ${servicesError.message}`);
    }

    if (!services || services.length === 0) {
      return { message: `❌ Nenhum serviço encontrado ${periodDescription}.` };
    }

    console.log(`✅ [list_services] Estratégia 2 funcionou: ${services.length} serviços encontrados`);

    // Map services with order information
    const formattedServices = services.map((service, index) => {
      const relatedOrder = orders.find(order => order.id === service.pedido_id);
      return {
        index: index + 1,
        service_name: service.nome,
        quantity: service.quantidade,
        unit_value: service.valor_unitario,
        total_value: service.quantidade * service.valor_unitario,
        order_number: relatedOrder?.order_number,
        order_status: relatedOrder?.status,
        order_date: relatedOrder ? new Date(relatedOrder.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'N/A',
        client_name: relatedOrder?.clientes?.nome
      };
    });

    const totalRevenue = formattedServices.reduce((sum, service) => sum + service.total_value, 0);

    return { 
      services: formattedServices, 
      summary: {
        count: services.length,
        totalRevenue: totalRevenue,
        period: {
          start: startDate ? new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'início',
          end: endDate ? new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'fim'
        },
        totalMatchingServices: services.length
      },
      message: `🛠️ Encontrados **${services.length} serviços** ${periodDescription}.` 
    };

  } catch (error: any) {
    console.error('❌ [list_services] Todas as estratégias falharam:', error);
    throw new Error(`Erro ao buscar serviços: ${error.message}`);
  }
};

// Update callOpenAIFunction to dispatch to list_services
export const callOpenAIFunction = async (functionCall: { name: string; arguments: any }) => {
  const { name, arguments: args } = functionCall;
  console.log(`🚀 [callOpenAIFunction] Executando: ${name}`, args);

  const TIME_ZONE = 'America/Sao_Paulo'; // Fuso horário de Rio de Janeiro

  if (name === "get_current_date") {
    const dateInfo = getCurrentDateTime();
    return {
      message: `Data e hora atual em Rio de Janeiro: ${dateInfo.fullDate} (${dateInfo.dayOfWeek}), ${dateInfo.time}`,
      current: dateInfo.current,
      ranges: dateInfo.ranges
    };
  }

  if (name === "get_client_orders") {
    const { clientName } = args;
    console.log(`🔍 [get_client_orders] Buscando pedidos para cliente: "${clientName}"`);
    
    const foundClients = await findClientWithMultipleStrategies(clientName);
    
    if (!foundClients || foundClients.length === 0) {
      console.log(`❌ [get_client_orders] Nenhum cliente encontrado para: "${clientName}"`);
      
      // Buscar alguns clientes para sugerir
      try {
        const { data: allClients, error } = await supabase
          .from('clientes')
          .select('nome')
          .limit(10);
        
        const clientList = allClients ? allClients.map(c => c.nome).join(', ') : 'Nenhum cliente encontrado';
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis no sistema:\n${clientList}\n\n💡 Dica: Tente usar o nome completo ou verifique a grafia.`);
      } catch (error: any) {
        console.error(`❌ [get_client_orders] Erro ao buscar lista de clientes:`, error);
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto ou tente usar apenas parte do nome.`);
      }
    }

    console.log(`✅ [get_client_orders] Cliente(s) encontrado(s):`, foundClients.map(c => c.nome));

    const clientIds = foundClients.map(c => c.id);
    const { data: orders, error: orderError } = await supabase
      .from('pedidos')
      .select(`
        id,
        order_number,
        status,
        valor_total,
        created_at,
        clientes (nome)
      `)
      .in('cliente_id', clientIds)
      .order('created_at', { ascending: false });

    if (orderError) {
      console.error("❌ [get_client_orders] Erro ao buscar pedidos do cliente:", orderError);
      throw new Error(orderError.message);
    }

    if (!orders || orders.length === 0) {
      const clientNames = foundClients.map(c => c.nome).join(', ');
      console.log(`❌ [get_client_orders] Nenhum pedido encontrado para: ${clientNames}`);
      return { 
        message: `✅ Cliente encontrado: **${clientNames}**\n\n❌ Porém, este cliente ainda não possui nenhum pedido registrado no sistema.` 
      };
    }

    console.log(`✅ [get_client_orders] Encontrados ${orders.length} pedidos`);

    const formattedOrders = orders.map((order, index) => ({
      index: index + 1,
      order_number: order.order_number,
      status: order.status,
      valor_total: order.valor_total,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
      cliente: order.clientes?.nome
    }));
    
    const totalValue = orders.reduce((sum, order) => sum + order.valor_total, 0);
    const clientNames = foundClients.map(c => c.nome).join(', ');
    
    return { 
      orders: formattedOrders, 
      summary: {
        clientName: clientNames,
        totalOrders: orders.length,
        totalValue: totalValue,
        foundMultipleClients: foundClients.length > 1
      },
      message: `✅ Encontrei **${orders.length} pedido(s)** para o cliente: **${clientNames}**${foundClients.length > 1 ? ' (encontrei múltiplos clientes similares)' : ''}\n\n💰 Valor total: **R$ ${totalValue.toFixed(2)}**`
    };
  }

  if (name === "get_client_details") {
    const { clientName } = args;
    console.log(`🔍 [get_client_details] Buscando detalhes para cliente: "${clientName}"`);
    
    const foundClients = await findClientWithMultipleStrategies(clientName);
    
    if (!foundClients || foundClients.length === 0) {
      console.log(`❌ [get_client_details] Nenhum cliente encontrado para: "${clientName}"`);
      
      try {
        const { data: allClients, error } = await supabase
          .from('clientes')
          .select('nome')
          .limit(10);
        
        const clientList = allClients ? allClients.map(c => c.nome).join(', ') : 'Nenhum cliente encontrado';
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis:\n${clientList}`);
      } catch (error: any) {
        console.error(`❌ [get_client_details] Erro ao buscar lista de clientes:`, error);
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto.`);
      }
    }

    console.log(`✅ [get_client_details] Cliente(s) encontrado(s):`, foundClients.map(c => c.nome));

    const clientId = foundClients[0].id;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error("❌ [get_client_details] Erro ao buscar detalhes completos do cliente:", error);
      throw new Error(error.message);
    }

    const client = data;
    let message = `👤 **Detalhes do cliente: ${client.nome}**`;
    
    if (foundClients.length > 1) {
      const otherClients = foundClients.slice(1).map(c => c.nome).join(', ');
      message += `\n\n🔍 Também encontrei clientes similares: ${otherClients}`;
    }

    return {
      message,
      client: {
        nome: client.nome,
        email: client.email || 'Não informado',
        telefone: client.telefone || 'Não informado',
        endereco: client.endereco || 'Não informado',
        status: client.status,
        valor_metro: client.valor_metro ? `R$ ${client.valor_metro.toFixed(2)}` : 'Não informado'
      }
    };
  }

  if (name === "get_order_details") {
    const { orderNumber } = args;
    
    const fullOrderId = await findOrderByNumber(orderNumber);
    
    if (!fullOrderId) {
      throw new Error(`❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.`);
    }

    try {
      const orderData = await fetchCompleteOrderData(fullOrderId);
      
      const formattedItems = orderData.pedido_items.map((item: any) => ({
        nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        total: item.quantidade * item.preco_unitario,
        observacao: item.observacao || ''
      }));
      
      const formattedServices = orderData.pedido_servicos.map((service: any) => ({
        nome: service.nome,
        quantidade: service.quantidade,
        valor_unitario: service.valor_unitario,
        total: service.quantidade * service.valor_unitario
      }));

      return {
        message: `📋 **Detalhes do pedido #${orderData.order_number}**`,
        order: {
          order_number: orderData.order_number,
          cliente: orderData.clientes?.nome || 'Cliente não encontrado',
          status: orderData.status,
          valor_total: orderData.valor_total,
          data_criacao: new Date(orderData.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
          observacoes: orderData.observacoes || 'Nenhuma observação',
          items: formattedItems,
          servicos: formattedServices
        }
      };
    } catch (error: any) {
      console.error("❌ Erro ao buscar detalhes do pedido:", error);
      throw new Error(`❌ Erro ao buscar detalhes do pedido #${orderNumber}: ${error.message}`);
    }
  }

  if (name === "get_orders_by_status") {
    const { statuses, exclude_statuses, limit = 20, includeTotalCount } = args;

    if ((!statuses || statuses.length === 0) && (!exclude_statuses || exclude_statuses.length === 0) && !includeTotalCount) {
        throw new Error("❌ É necessário especificar quais status incluir ou excluir, ou pedir a contagem total.");
    }

    let query = supabase
      .from('pedidos')
      .select(`
        id,
        order_number,
        status,
        valor_total,
        created_at,
        clientes (nome)
      `, { count: includeTotalCount ? 'exact' : null }); // Adiciona contagem exata se solicitado

    if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
    }

    if (exclude_statuses && exclude_statuses.length > 0) {
        query = query.not('status', 'in', `(${exclude_statuses.map(s => `"${s}"`).join(',')})`);
    }

    query = query.order('created_at', { ascending: false });
    
    // Aplica limite apenas se NÃO for para contar o total E se houver um limite definido e maior que 0
    if (!includeTotalCount && limit && limit > 0) {
      query = query.limit(limit);
    }

    const { data: orders, error, count } = await query;

    if (error) {
        console.error("Erro ao buscar pedidos por status:", error);
        throw new Error(`Erro ao buscar pedidos por status: ${error.message}`);
    }

    const totalCountMessage = includeTotalCount ? ` (Total de ${count} pedidos encontrados)` : '';

    if (!orders || orders.length === 0) {
        return { message: `✅ Nenhum pedido encontrado com os filtros especificados.${totalCountMessage}` };
    }

    const formattedOrders = orders.map((order, index) => ({
        index: index + 1,
        order_number: order.order_number,
        status: order.status,
        valor_total: order.valor_total,
        created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
        cliente: order.clientes?.nome
    }));

    const totalValue = orders.reduce((sum, order) => sum + order.valor_total, 0);

    return {
        orders: formattedOrders,
        summary: {
            count: orders.length,
            totalValue: totalValue,
            totalMatchingOrders: count // Retorna a contagem total de correspondências
        },
        message: `📊 Encontrados **${orders.length} pedidos** com os filtros especificados.${totalCountMessage}`
    };
  }

  if (name === "list_orders") {
    return list_orders(args); // Delegate to the actual function
  }

  if (name === "list_services") { // Handle the new tool
    return list_services(args); // Delegate to the actual function
  }

  if (name === "update_order_status") {
    const { orderNumber, newStatus, observacao } = args; // Adicionado observacao
    
    console.log(`🔄 [update_order_status] Atualizando pedido ${orderNumber} para "${newStatus}" com observação: "${observacao}"`);

    try {
      const fullOrderId = await findOrderByNumber(orderNumber);
      
      if (!fullOrderId) {
        throw new Error(`❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.`);
      }

      console.log(`✅ [update_order_status] UUID encontrado: ${fullOrderId}`);

      // Fetch current status to record in history
      const { data: currentOrder, error: fetchError } = await supabase
        .from('pedidos')
        .select('status')
        .eq('id', fullOrderId)
        .single();

      if (fetchError) {
        console.error("❌ [update_order_status] Erro ao buscar status atual do pedido:", fetchError);
        throw new Error(`❌ Erro ao buscar status atual do pedido #${orderNumber}: ${fetchError.message}.`);
      }

      const statusAnterior = currentOrder?.status || 'desconhecido';

      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
        .eq('id', fullOrderId);

      if (updateError) {
        console.error("❌ [update_order_status] Erro ao atualizar:", updateError);
        throw new Error(`❌ Erro ao atualizar status do pedido #${orderNumber} para "${newStatus}": ${updateError.message}.`);
      }

      // Insert into status history if status changed or observation provided
      if (newStatus !== statusAnterior || observacao) {
        const { error: historyError } = await supabase
          .from('pedido_status_history')
          .insert({
            pedido_id: fullOrderId,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao || null, // Store observation
            user_id: (await supabase.auth.getUser()).data.user?.id || null // Get current user ID
          });

        if (historyError) {
          console.warn('⚠️ [update_order_status] Erro ao salvar histórico de status:', historyError);
        }
      }

      console.log(`✅ [update_order_status] Status atualizado com sucesso!`);
      return { 
        message: `✅ Pedido #${orderNumber} atualizado para **"${newStatus}"** com sucesso!${observacao ? `\n\n📝 Observação: "${observacao}"` : ''}`,
        update: {
          orderNumber: orderNumber,
          newStatus: newStatus,
          observacao: observacao || null,
          timestamp: new Date().toLocaleString('pt-BR', { timeZone: TIME_ZONE })
        }
      };

    } catch (error: any) {
      console.error("❌ [update_order_status] Erro inesperado:", error);
      throw new Error(`❌ Ocorreu um erro inesperado ao tentar atualizar o status do pedido #${orderNumber}: ${error.message || 'Erro desconhecido'}.`);
    }
  }

  if (name === "generate_order_pdf") {
    const { orderNumber } = args;
    
    console.log(`📄 [generate_order_pdf] Gerando PDF para pedido #${orderNumber}`);

    try {
      const fullOrderId = await findOrderByNumber(orderNumber);
      
      if (!fullOrderId) {
        throw new Error(`❌ Pedido #${orderNumber} não encontrado.`);
      }

      console.log(`✅ [generate_order_pdf] Pedido encontrado, buscando dados completos...`);
      
      const orderData = await fetchCompleteOrderData(fullOrderId);
      
      console.log(`📋 [generate_order_pdf] Dados obtidos, gerando PDF...`);
      
      await generateOrderPDF(orderData);
      
      console.log(`✅ [generate_order_pdf] PDF gerado com sucesso!`);
      
      return { 
        message: `✅ PDF do pedido #${orderNumber} gerado com sucesso! 📄\n\nO arquivo foi baixado automaticamente para seu dispositivo.`,
        pdf: {
          orderNumber: orderNumber,
          clientName: orderData.clientes?.nome || 'Cliente não encontrado',
          timestamp: new Date().toLocaleString('pt-BR', { timeZone: TIME_ZONE })
        }
      };
    } catch (error: any) {
      console.error(`❌ [generate_order_pdf] Erro ao gerar PDF para pedido #${orderNumber}:`, error);
      throw new Error(`❌ Erro ao gerar PDF do pedido #${orderNumber}: ${error.message || 'Erro desconhecido'}`);
    }
  }

  if (name === "generate_multiple_pdfs") {
    const { orderNumbers } = args;
    console.log(`📄 [generate_multiple_pdfs] Gerando PDFs para pedidos: ${orderNumbers.join(', ')}`);

    const results = [];
    const errors = [];

    for (const orderNumber of orderNumbers) {
      try {
        console.log(`📄 [generate_multiple_pdfs] Processando pedido #${orderNumber}...`);
        
        const fullOrderId = await findOrderByNumber(orderNumber);

        if (!fullOrderId) {
          errors.push(`❌ Pedido #${orderNumber}: não encontrado`);
          continue;
        }

        const orderData = await fetchCompleteOrderData(fullOrderId);
        await generateOrderPDF(orderData);
        
        results.push(`✅ Pedido #${orderNumber}: PDF gerado`);
        console.log(`✅ [generate_multiple_pdfs] PDF do pedido #${orderNumber} gerado com sucesso`);

        // Small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`❌ [generate_multiple_pdfs] Erro no pedido #${orderNumber}:`, error);
        errors.push(`❌ Pedido #${orderNumber}: erro ao gerar PDF`);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    
    console.log(`📊 [generate_multiple_pdfs] Concluído: ${successCount} sucessos, ${errorCount} erros`);
    
    return { 
      message: `📊 **Geração de PDFs concluída:** ${successCount} sucesso(s), ${errorCount} erro(s)\n\n${results.length > 0 ? `✅ **Sucessos:**\n${results.join('\n')}\n\n` : ''}${errors.length > 0 ? `❌ **Erros:**\n${errors.join('\n')}` : ''}`,
      summary: {
        successCount,
        errorCount,
        results,
        errors,
        timestamp: new Date().toLocaleString('pt-BR', { timeZone: TIME_ZONE })
      }
    };
  }

  console.error(`❌ [callOpenAIFunction] Função desconhecida: ${name}`);
  throw new Error(`❌ Função desconhecida: ${name}`);
};