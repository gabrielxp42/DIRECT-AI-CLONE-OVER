import { supabase } from '@/integrations/supabase/client';
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { removeAccents } from '@/utils/string';

// OpenAI Functions format
export const openAIFunctions = [
  {
    name: "get_current_date",
    description: "Obtém a data e hora atual do sistema. Use esta função quando precisar saber 'que dia é hoje', 'que mês estamos', ou quando o usuário mencionar períodos relativos como 'desse mês', 'desta semana', 'hoje', 'ontem', etc.",
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
        }
      }
    }
  },
  {
    name: "list_orders",
    description: "Lista pedidos APENAS por filtros de data, sem especificar cliente. Use esta função SOMENTE quando o usuário pedir pedidos por período sem mencionar cliente específico (ex: 'pedidos de hoje', 'pedidos desta semana', 'último pedido', 'quantos pedidos esta semana', 'pedido mais caro'). NÃO use esta função quando o usuário mencionar um cliente específico. Retorna o NÚMERO do pedido, status, valor total, data de criação e nome do cliente.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          format: "date-time",
          description: "Data de início do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T00:00:00.000Z'). Se omitido, assume o início do mês atual."
        },
        endDate: {
          type: "string",
          format: "date-time",
          description: "Data de fim do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T23:59:59.999Z'). Se omitido, assume o final do mês atual."
        },
        limit: {
          type: "number",
          description: "Número máximo de pedidos a retornar. Padrão é 10."
        },
        orderBy: {
          type: "string",
          enum: ["created_at_asc", "created_at_desc", "valor_total_desc"],
          description: "Campo e direção para ordenar os pedidos. 'created_at_asc' para os mais antigos primeiro, 'created_at_desc' para os mais recentes primeiro, 'valor_total_desc' para os mais caros primeiro. Padrão é 'created_at_desc'."
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

// Function implementations
export const callOpenAIFunction = async (functionCall: { name: string; arguments: any }) => {
  const { name, arguments: args } = functionCall;
  console.log(`🚀 [callOpenAIFunction] Executando: ${name}`, args);

  if (name === "get_current_date") {
    const now = new Date();
    const currentDate = {
      date: now.toLocaleDateString('pt-BR'),
      time: now.toLocaleTimeString('pt-BR'),
      iso: now.toISOString(),
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      dayOfWeek: now.toLocaleDateString('pt-BR', { weekday: 'long' }),
      monthName: now.toLocaleDateString('pt-BR', { month: 'long' })
    };

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    startOfMonth.setHours(0, 0, 0, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return {
      message: `Data atual: ${currentDate.date} (${currentDate.dayOfWeek}), ${currentDate.time}`,
      current: currentDate,
      ranges: {
        thisMonth: {
          start: startOfMonth.toISOString(),
          end: endOfMonth.toISOString(),
          label: `${currentDate.monthName} de ${currentDate.year}`
        },
        thisWeek: {
          start: startOfWeek.toISOString(),
          end: endOfWeek.toISOString(),
          label: `Semana de ${startOfWeek.toLocaleDateString('pt-BR')} a ${endOfWeek.toLocaleDateString('pt-BR')}`
        },
        today: {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString(),
          label: `Hoje (${currentDate.date})`
        }
      }
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
        return { 
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis no sistema:\n${clientList}\n\n💡 Dica: Tente usar o nome completo ou verifique a grafia.` 
        };
      } catch (error) {
        console.error(`❌ [get_client_orders] Erro ao buscar lista de clientes:`, error);
        return { 
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto ou tente usar apenas parte do nome.` 
        };
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
      return { error: orderError.message };
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
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR'),
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
        return { 
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis:\n${clientList}` 
        };
      } catch (error) {
        console.error(`❌ [get_client_details] Erro ao buscar lista de clientes:`, error);
        return { 
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto.` 
        };
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
      return { error: error.message };
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
      return { message: `❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.` };
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
          data_criacao: new Date(orderData.created_at).toLocaleDateString('pt-BR'),
          observacoes: orderData.observacoes || 'Nenhuma observação',
          items: formattedItems,
          servicos: formattedServices
        }
      };
    } catch (error: any) {
      console.error("❌ Erro ao buscar detalhes do pedido:", error);
      return { message: `❌ Erro ao buscar detalhes do pedido #${orderNumber}: ${error.message}` };
    }
  }

  if (name === "get_orders_by_status") {
    const { statuses, exclude_statuses, limit = 20 } = args;

    if ((!statuses || statuses.length === 0) && (!exclude_statuses || exclude_statuses.length === 0)) {
        return { message: "❌ É necessário especificar quais status incluir ou excluir." };
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
      `);

    if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
    }

    if (exclude_statuses && exclude_statuses.length > 0) {
        query = query.not('status', 'in', `(${exclude_statuses.map(s => `"${s}"`).join(',')})`);
    }

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data: orders, error } = await query;

    if (error) {
        console.error("Erro ao buscar pedidos por status:", error);
        return { error: error.message };
    }

    if (!orders || orders.length === 0) {
        return { message: `✅ Nenhum pedido encontrado com os filtros especificados.` };
    }

    const formattedOrders = orders.map((order, index) => ({
        index: index + 1,
        order_number: order.order_number,
        status: order.status,
        valor_total: order.valor_total,
        created_at: new Date(order.created_at).toLocaleDateString('pt-BR'),
        cliente: order.clientes?.nome
    }));

    const totalValue = orders.reduce((sum, order) => sum + order.valor_total, 0);

    return {
        orders: formattedOrders,
        summary: {
            count: orders.length,
            totalValue: totalValue,
        },
        message: `📊 Encontrados **${orders.length} pedidos** com os filtros especificados.`
    };
  }

  if (name === "list_orders") {
    let { startDate, endDate, limit = 10, orderBy = 'created_at_desc' } = args;

    if (!startDate && !endDate) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startOfMonth.setHours(0, 0, 0, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      startDate = startOfMonth.toISOString();
      endDate = endOfMonth.toISOString();
    } else if (startDate && !endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (!startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      startDate = start.toISOString();
      endDate = end.toISOString();
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
      `);

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
    query = query.limit(limit);

    const { data: orders, error } = await query;

    if (error) {
      console.error("Erro ao listar pedidos por data:", error);
      return { error: error.message };
    }

    const startDisplayDate = new Date(startDate).toLocaleDateString('pt-BR');
    const endDisplayDate = new Date(endDate).toLocaleDateString('pt-BR');
    const periodDescription = startDisplayDate === endDisplayDate ? `em ${startDisplayDate}` : `entre ${startDisplayDate} e ${endDisplayDate}`;

    if (!orders || orders.length === 0) {
      return { message: `❌ Nenhum pedido encontrado ${periodDescription}.` };
    }

    const formattedOrders = orders.map((order, index) => ({
      index: index + 1,
      order_number: order.order_number,
      status: order.status,
      valor_total: order.valor_total,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR'),
      cliente: order.clientes?.nome
    }));

    const totalValue = orders.reduce((sum, order) => sum + order.valor_total, 0);

    return { 
      orders: formattedOrders, 
      summary: {
        count: orders.length,
        totalValue: totalValue,
        period: {
          start: startDisplayDate,
          end: endDisplayDate
        }
      },
      message: `📊 Encontrados **${orders.length} pedidos** ${periodDescription}.` 
    };
  }

  if (name === "update_order_status") {
    const { orderNumber, newStatus, observacao } = args; // Adicionado observacao
    
    console.log(`🔄 [update_order_status] Atualizando pedido ${orderNumber} para "${newStatus}" com observação: "${observacao}"`);

    try {
      const fullOrderId = await findOrderByNumber(orderNumber);
      
      if (!fullOrderId) {
        return { message: `❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.` };
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
        return { message: `❌ Erro ao buscar status atual do pedido #${orderNumber}: ${fetchError.message}.` };
      }

      const statusAnterior = currentOrder?.status || 'desconhecido';

      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
        .eq('id', fullOrderId);

      if (updateError) {
        console.error("❌ [update_order_status] Erro ao atualizar:", updateError);
        return { 
          message: `❌ Erro ao atualizar status do pedido #${orderNumber} para "${newStatus}": ${updateError.message}.`
        };
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
          timestamp: new Date().toLocaleString('pt-BR')
        }
      };

    } catch (error: any) {
      console.error("❌ [update_order_status] Erro inesperado:", error);
      return { 
        message: `❌ Ocorreu um erro inesperado ao tentar atualizar o status do pedido #${orderNumber}: ${error.message || 'Erro desconhecido'}.`
      };
    }
  }

  if (name === "generate_order_pdf") {
    const { orderNumber } = args;
    
    console.log(`📄 [generate_order_pdf] Gerando PDF para pedido #${orderNumber}`);

    try {
      const fullOrderId = await findOrderByNumber(orderNumber);
      
      if (!fullOrderId) {
        return { message: `❌ Pedido #${orderNumber} não encontrado.` };
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
          timestamp: new Date().toLocaleString('pt-BR')
        }
      };
    } catch (error: any) {
      console.error(`❌ [generate_order_pdf] Erro ao gerar PDF para pedido #${orderNumber}:`, error);
      return { 
        message: `❌ Erro ao gerar PDF do pedido #${orderNumber}: ${error.message || 'Erro desconhecido'}` 
      };
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
        timestamp: new Date().toLocaleString('pt-BR')
      }
    };
  }

  console.error(`❌ [callOpenAIFunction] Função desconhecida: ${name}`);
  return { message: `❌ Função desconhecida: ${name}` };
};