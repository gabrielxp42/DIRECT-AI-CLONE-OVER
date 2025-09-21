import { supabase } from '@/integrations/supabase/client'; // Importa o cliente Supabase existente
import { generateOrderPDF } from '@/utils/pdfGenerator'; // Import the PDF generator utility
import { removeAccents } from '@/utils/string'; // Importar a nova função

// Define the tools (functions) that Gemini can call
export const tools = [
  {
    function_declarations: [
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
            orderNumber: { // Alterado para orderNumber
              type: "number",
              description: "O número sequencial do pedido."
            }
          },
          required: ["orderNumber"]
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
              format: "date-time", // Sugere formato ISO 8601
              description: "Data de início do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T00:00:00.000Z'). Se omitido, assume o início do mês atual no fuso horário de Rio de Janeiro."
            },
            endDate: {
              type: "string",
              format: "date-time", // Sugere formato ISO 8601
              description: "Data de fim do período para filtrar pedidos (formato ISO 8601, ex: '2023-10-27T23:59:59.999Z'). Se omitido, assume o final do mês atual no fuso horário de Rio de Janeiro."
            },
            limit: {
              type: "number",
              description: "Número máximo de pedidos a retornar. Padrão é 100. Se o usuário indicar que há mais pedidos, o assistente deve aumentar este limite."
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
            orderNumber: { // Alterado para orderNumber
              type: "number",
              description: "O número sequencial do pedido a ser atualizado."
            },
            newStatus: {
              type: "string",
              enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"], // Adicionei 'aguardando retirada' como um status válido
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
            orderNumber: { // Alterado para orderNumber
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
            orderNumbers: { // Alterado para orderNumbers
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
    ]
  }
];

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

// Implementations of the tool functions
export const callTool = async (functionCall: any) => {
  const { name, args } = functionCall;
  console.log(`🚀 Executando ferramenta: ${name} com argumentos:`, args);

  const TIME_ZONE = 'America/Sao_Paulo'; // Fuso horário de Rio de Janeiro

  if (name === "get_current_date") {
    const now = new Date();

    // Obter componentes de data/hora no fuso horário do Rio
    const rioDateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: TIME_ZONE,
      hour12: false,
    };
    const rioDateTimeFormatter = new Intl.DateTimeFormat('en-US', rioDateOptions);
    const rioParts = rioDateTimeFormatter.formatToParts(now);

    let rioYear: number, rioMonth: number, rioDay: number, rioHour: number, rioMinute: number, rioSecond: number;
    for (const part of rioParts) {
      if (part.type === 'year') rioYear = parseInt(part.value);
      if (part.type === 'month') rioMonth = parseInt(part.value);
      if (part.type === 'day') rioDay = parseInt(part.value);
      if (part.type === 'hour') rioHour = parseInt(part.value);
      if (part.type === 'minute') rioMinute = parseInt(part.value);
      if (part.type === 'second') rioSecond = parseInt(part.value);
    }

    // Criar um objeto Date que representa o momento atual no Rio, mas como UTC
    const rioNow = new Date(Date.UTC(rioYear!, rioMonth! - 1, rioDay!, rioHour!, rioMinute!, rioSecond!));

    // Calcular ranges baseados em rioNow (UTC ajustado para Rio)
    const startOfRioDay = new Date(Date.UTC(rioYear!, rioMonth! - 1, rioDay!, 0, 0, 0, 0));
    const endOfRioDay = new Date(Date.UTC(rioYear!, rioMonth! - 1, rioDay!, 23, 59, 59, 999));

    const startOfRioMonth = new Date(Date.UTC(rioYear!, rioMonth! - 1, 1, 0, 0, 0, 0));
    const endOfRioMonth = new Date(Date.UTC(rioYear!, rioMonth!, 0, 23, 59, 59, 999)); // Último dia do mês atual

    // Para semana, precisamos do dia da semana no fuso horário do Rio
    const rioWeekdayIndex = new Intl.DateTimeFormat('en-US', { weekday: 'numeric', timeZone: TIME_ZONE }).format(now); // 1 para domingo, 7 para sábado
    const daysToSubtract = parseInt(rioWeekdayIndex) % 7; // Ajusta para 0=domingo, 1=segunda...
    
    const startOfRioWeek = new Date(startOfRioDay);
    startOfRioWeek.setUTCDate(startOfRioDay.getUTCDate() - daysToSubtract); // Ajusta para o domingo da semana atual

    const endOfRioWeek = new Date(startOfRioWeek);
    endOfRioWeek.setUTCDate(startOfRioWeek.getUTCDate() + 6); // Ajusta para o sábado da semana atual
    endOfRioWeek.setUTCHours(23, 59, 59, 999);

    // Formatar para exibição no fuso horário do Rio
    const displayDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: TIME_ZONE }).format(now);
    const displayTime = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium', timeZone: TIME_ZONE }).format(now);
    const displayMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: TIME_ZONE }).format(now);
    const displayWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: TIME_ZONE }).format(now);

    return {
      message: `Data e hora atual em Rio de Janeiro: ${displayDate} (${displayWeekday}), ${displayTime}`,
      current: {
        date: displayDate,
        time: displayTime,
        iso: rioNow.toISOString(), // ISO string do momento atual no Rio
        day: rioDay,
        month: rioMonth,
        year: rioYear,
        dayOfWeek: displayWeekday,
        monthName: displayMonthName
      },
      ranges: {
        thisMonth: {
          start: startOfRioMonth.toISOString(),
          end: endOfRioMonth.toISOString(),
          label: `${displayMonthName} de ${rioYear}`
        },
        thisWeek: {
          start: startOfRioWeek.toISOString(),
          end: endOfRioWeek.toISOString(),
          label: `Semana de ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE }).format(startOfRioWeek)} a ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE }).format(endOfRioWeek)}`
        },
        today: {
          start: startOfRioDay.toISOString(),
          end: endOfRioDay.toISOString(),
          label: `Hoje (${displayDate})`
        }
      }
    };
  }

  if (name === "get_client_orders") {
    const { clientName } = args;
    
    const foundClients = await findClientWithMultipleStrategies(clientName);
    
    if (!foundClients || foundClients.length === 0) {
      // Let's also try to list some clients to help debug
      try {
        const { data: allClients, error } = await supabase
          .from('clientes')
          .select('nome')
          .limit(10);
        
        const clientList = allClients ? allClients.map(c => c.nome).join(', ') : 'Nenhum cliente encontrado';
        return { 
          message: `Nenhum cliente encontrado com o nome "${clientName}". Alguns clientes disponíveis: ${clientList}. Tente usar o nome completo ou uma parte maior do nome.` 
        };
      } catch (error) {
        return { 
          message: `Nenhum cliente encontrado com o nome "${clientName}". Verifique se o nome está correto ou tente usar apenas parte do nome.` 
        };
      }
    }

    // Use os clientes encontrados
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
      console.error("❌ Erro ao buscar pedidos do cliente:", orderError);
      return { error: orderError.message };
    }

    if (!orders || orders.length === 0) {
      const clientNames = foundClients.map(c => c.nome).join(', ');
      return { message: `Nenhum pedido encontrado para o(s) cliente(s): ${clientNames}.` };
    }

    // Format the output for the model
    const formattedOrders = orders.map(order => ({
      order_number: order.order_number, // Usando order_number
      status: order.status,
      valor_total: order.valor_total,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
      cliente: order.clientes?.nome
    }));
    
    const clientNames = foundClients.map(c => c.nome).join(', ');
    return { 
      orders: formattedOrders, 
      message: `Pedidos encontrados para: ${clientNames}. ${foundClients.length > 1 ? 'Encontrei múltiplos clientes similares.' : ''}` 
    };
  }

  if (name === "get_client_details") {
    const { clientName } = args;
    
    const foundClients = await findClientWithMultipleStrategies(clientName);
    
    if (!foundClients || foundClients.length === 0) {
      // Let's also try to list some clients to help debug
      try {
        const { data: allClients, error } = await supabase
          .from('clientes')
          .select('nome')
          .limit(10);
        
        const clientList = allClients ? allClients.map(c => c.nome).join(', ') : 'Nenhum cliente encontrado';
        return { 
          message: `Nenhum cliente encontrado com o nome "${clientName}". Alguns clientes disponíveis: ${clientList}. Tente usar o nome completo ou uma parte maior do nome.` 
        };
      } catch (error) {
        return { 
          message: `Nenhum cliente encontrado com o nome "${clientName}". Verifique se o nome está correto ou tente usar apenas parte do nome.` 
        };
      }
    }

    // Se encontrou múltiplos clientes, pega o primeiro (most similar)
    const clientId = foundClients[0].id;
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error("❌ Erro ao buscar detalhes completos do cliente:", error);
      return { error: error.message };
    }

    const client = data;
    let message = `Detalhes do cliente ${client.nome}:`;
    
    if (foundClients.length > 1) {
      const otherClients = foundClients.slice(1).map(c => c.nome).join(', ');
      message += ` (Também encontrei clientes similares: ${otherClients})`;
    }

    return {
      message,
      nome: client.nome,
      email: client.email || 'N/A',
      telefone: client.telefone || 'N/A',
      endereco: client.endereco || 'N/A',
      status: client.status,
      valor_metro: client.valor_metro ? `R$ ${client.valor_metro.toFixed(2)}` : 'N/A'
    };
  }

  if (name === "get_order_details") {
    const { orderNumber } = args; // Alterado para orderNumber
    
    // Buscar o UUID completo usando o novo RPC
    const { data: fullOrderId, error: rpcError } = await supabase.rpc('get_order_uuid_by_number', { p_order_number: orderNumber });

    if (rpcError) {
      console.error("Erro ao buscar UUID do pedido por número:", rpcError);
      return { message: `❌ Erro ao buscar pedido #${orderNumber}: ${rpcError.message}. Por favor, verifique o número do pedido.` };
    }
    if (!fullOrderId) {
      return { message: `❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.` };
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        order_number,
        status,
        valor_total,
        created_at,
        observacoes,
        clientes (id, nome, email, telefone),
        pedido_items (id, produto_nome, quantidade, preco_unitario),
        pedido_servicos (id, nome, quantidade, valor_unitario)
      `)
      .eq('id', fullOrderId) // Usar o UUID completo
      .single();

    if (error) {
      console.error("Erro ao buscar detalhes do pedido:", error);
      return { error: error.message };
    }
    if (!data) { // data pode ser null se single() não encontrar
      return { message: `❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.` };
    }
    const order = data;
    const formattedItems = order.pedido_items.map((item: any) => ({
      nome: item.produto_nome,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      total: item.quantidade * item.preco_unitario
    }));
    const formattedServices = order.pedido_servicos.map((service: any) => ({
      nome: service.nome,
      quantidade: service.quantidade,
      valor_unitario: service.valor_unitario,
      total: service.quantidade * service.valor_unitario
    }));

    return {
      message: `Detalhes do pedido #${order.order_number}:`, // Usando order_number
      cliente: order.clientes?.nome || 'N/A',
      status: order.status,
      valor_total: order.valor_total,
      data_criacao: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
      observacoes: order.observacoes || 'N/A',
      items: formattedItems,
      servicos: formattedServices
    };
  }

  if (name === "list_orders") {
    let { startDate, endDate, limit = 100, orderBy = 'created_at_desc' } = args;

    // Se não houver datas, define para o mês atual no fuso horário do Rio
    if (!startDate && !endDate) {
      const now = new Date();
      const rioDateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: TIME_ZONE, hour12: false };
      const rioDateTimeFormatter = new Intl.DateTimeFormat('en-US', rioDateOptions);
      const rioParts = rioDateTimeFormatter.formatToParts(now);
      let rioYear: number, rioMonth: number;
      for (const part of rioParts) {
        if (part.type === 'year') rioYear = parseInt(part.value);
        if (part.type === 'month') rioMonth = parseInt(part.value);
      }
      const startOfMonth = new Date(Date.UTC(rioYear!, rioMonth! - 1, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(rioYear!, rioMonth!, 0, 23, 59, 59, 999));
      startDate = startOfMonth.toISOString();
      endDate = endOfMonth.toISOString();
    } else if (startDate && !endDate) {
      // Se apenas startDate, define endDate para o final do dia no fuso horário do Rio
      const start = new Date(startDate);
      const rioDateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: TIME_ZONE, hour12: false };
      const rioDateTimeFormatter = new Intl.DateTimeFormat('en-US', rioDateOptions);
      const startParts = rioDateTimeFormatter.formatToParts(start);
      let startYear: number, startMonth: number, startDay: number;
      for (const part of startParts) {
        if (part.type === 'year') startYear = parseInt(part.value);
        if (part.type === 'month') startMonth = parseInt(part.value);
        if (part.type === 'day') startDay = parseInt(part.value);
      }
      const end = new Date(Date.UTC(startYear!, startMonth! - 1, startDay!, 23, 59, 59, 999));
      endDate = end.toISOString();
    } else if (!startDate && endDate) {
      // Se apenas endDate, define startDate para o início do dia no fuso horário do Rio
      const end = new Date(endDate);
      const rioDateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: TIME_ZONE, hour12: false };
      const rioDateTimeFormatter = new Intl.DateTimeFormat('en-US', rioDateOptions);
      const endParts = rioDateTimeFormatter.formatToParts(end);
      let endYear: number, endMonth: number, endDay: number;
      for (const part of endParts) {
        if (part.type === 'year') endYear = parseInt(part.value);
        if (part.type === 'month') endMonth = parseInt(part.value);
        if (part.type === 'day') endDay = parseInt(part.value);
      }
      const start = new Date(Date.UTC(endYear!, endMonth! - 1, endDay!, 0, 0, 0, 0));
      startDate = start.toISOString();
    }

    console.log(`[list_orders] Buscando pedidos de ${startDate} até ${endDate} com ordenação: ${orderBy}`);

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

    // Map 'created' to 'created_at' to handle potential AI model variations
    if (orderFieldRaw === 'created') {
      orderField = 'created_at';
    } else if (orderFieldRaw === 'valor' && orderDirection === 'total') { // Handle 'valor_total_desc'
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

    const startDisplayDate = new Date(startDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    const endDisplayDate = new Date(endDate!).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE });
    const periodDescription = startDisplayDate === endDisplayDate ? `em ${startDisplayDate}` : `entre ${startDisplayDate} e ${endDisplayDate}`;


    if (!orders || orders.length === 0) {
      return { message: `❌ Nenhum pedido encontrado ${periodDescription}.` };
    }

    const formattedOrders = orders.map(order => ({
      order_number: order.order_number, // Usando order_number
      status: order.status,
      valor_total: order.valor_total,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
      cliente: order.clientes?.nome
    }));

    return { orders: formattedOrders, count: orders.length, message: `Foram encontrados ${orders.length} pedidos ${periodDescription}.` };
  }

  if (name === "update_order_status") {
    const { orderNumber, newStatus, observacao } = args; // Adicionado observacao
    
    console.log(`🔄 Tentando atualizar status do pedido ${orderNumber} para "${newStatus}" com observação: "${observacao}"`);

    try {
      console.log(`🔍 Buscando UUID completo para o pedido ${orderNumber}...`);
      const { data: fullOrderId, error: rpcError } = await supabase.rpc('get_order_uuid_by_number', { p_order_number: orderNumber });

      if (rpcError) {
        console.error("❌ Erro na função RPC get_order_uuid_by_number:", rpcError);
        return { 
          message: `❌ Erro ao buscar pedido #${orderNumber}: ${rpcError.message}. Por favor, verifique o número do pedido.`
        };
      }
      
      if (!fullOrderId) {
        console.log(`❌ Nenhum pedido encontrado com número ${orderNumber}`);
        return { message: `❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.` };
      }

      console.log(`✅ UUID completo encontrado: ${fullOrderId}`);

      // Fetch current status to record in history
      const { data: currentOrder, error: fetchError } = await supabase
        .from('pedidos')
        .select('status')
        .eq('id', fullOrderId)
        .single();

      if (fetchError) {
        console.error("❌ Erro ao buscar status atual do pedido:", fetchError);
        return { message: `❌ Erro ao buscar status atual do pedido #${orderNumber}: ${fetchError.message}.` };
      }

      const statusAnterior = currentOrder?.status || 'desconhecido';

      console.log(`🔄 Atualizando status para "${newStatus}"...`);
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
        .eq('id', fullOrderId);

      if (updateError) {
        console.error("❌ Erro ao atualizar status do pedido:", updateError);
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
          console.warn('⚠️ Erro ao salvar histórico de status:', historyError);
        }
      }

      console.log(`✅ Status atualizado com sucesso!`);
      return { message: `✅ Status do pedido #${orderNumber} atualizado para "${newStatus}" com sucesso.${observacao ? ` Observação: "${observacao}"` : ''}` };

    } catch (error: any) {
      console.error("❌ Erro inesperado ao atualizar status:", error);
      return { 
        message: `❌ Ocorreu um erro inesperado ao tentar atualizar o status do pedido #${orderNumber}: ${error.message || 'Erro desconhecido'}.`
      };
    }
  }

  if (name === "generate_order_pdf") {
    const { orderNumber } = args; // Alterado para orderNumber

    // First, find the full order ID from the order number
    const { data: fullOrderId, error: rpcError } = await supabase.rpc('get_order_uuid_by_number', { p_order_number: orderNumber });

    if (rpcError) {
      console.error("Erro ao buscar pedido para geração de PDF via RPC:", rpcError);
      return { error: `❌ Erro ao buscar pedido: ${rpcError.message}` };
    }
    if (!fullOrderId) {
      return { message: `❌ Pedido #${orderNumber} não encontrado.` };
    }

    // Fetch the complete order details using the full ID
    const { data: orderData, error: fetchError } = await supabase
      .from('pedidos')
      .select(`
        *, 
        clientes(nome), 
        pedido_items(*, produtos(nome)),
        pedido_servicos(*)
      `)
      .eq('id', fullOrderId)
      .single();

    if (fetchError) {
      console.error("Erro ao buscar detalhes completos do pedido para PDF:", fetchError);
      return { error: `❌ Erro ao buscar detalhes: ${fetchError.message}` };
    }
    if (!orderData) {
      return { message: `❌ Detalhes do pedido #${orderNumber} não encontrados.` };
    }

    // Transform the data to match the Pedido type expected by generateOrderPDF
    const pedido = {
      ...orderData,
      servicos: orderData.pedido_servicos || []
    };

    try {
      await generateOrderPDF(pedido);
      return { message: `✅ PDF do pedido #${orderNumber} gerado com sucesso.` };
    } catch (pdfError: any) {
      console.error("Erro ao gerar PDF:", pdfError);
      return { error: `❌ Erro ao gerar PDF: ${pdfError.message || 'Erro desconhecido'}` };
    }
  }

  if (name === "generate_multiple_pdfs") {
    const { orderNumbers } = args; // Alterado para orderNumbers
    console.log(`🚀 Gerando múltiplos PDFs para os pedidos: ${orderNumbers.join(', ')}`);

    const results = [];
    const errors = [];

    for (const orderNumber of orderNumbers) { // Iterar sobre orderNumbers
      try {
        const { data: fullOrderId, error: rpcError } = await supabase.rpc('get_order_uuid_by_number', { p_order_number: orderNumber });

        if (rpcError || !fullOrderId) {
          errors.push(`❌ Pedido #${orderNumber}: não encontrado`);
          continue;
        }

        const { data: orderData, error: fetchError } = await supabase
          .from('pedidos')
          .select(`
            *, 
            clientes(nome), 
            pedido_items(*, produtos(nome)),
            pedido_servicos(*)
          `)
          .eq('id', fullOrderId)
          .single();

        if (fetchError || !orderData) {
          errors.push(`❌ Pedido #${orderNumber}: erro ao buscar detalhes`);
          continue;
        }

        const pedido = {
          ...orderData,
          servicos: orderData.pedido_servicos || []
        };

        await generateOrderPDF(pedido);
        results.push(`✅ Pedido #${orderNumber}: PDF gerado`);

        // Add a small delay between PDF generations to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (pdfError: any) {
        console.error(`Erro ao gerar PDF para pedido ${orderNumber}:`, pdfError);
        errors.push(`❌ Pedido #${orderNumber}: erro ao gerar PDF - ${pdfError.message || 'Erro desconhecido'}`);
      }
    }

    const successCount = results.length;
    const errorCount = errors.length;
    
    let message = `Geração de PDFs concluída: ${successCount} sucesso(s), ${errorCount} erro(s).`;
    
    if (results.length > 0) {
      message += `\n\nPDFs gerados com sucesso:\n${results.join('\n')}`;
    }
    
    if (errors.length > 0) {
      message += `\n\nErros encontrados:\n${errors.join('\n')}`;
    }

    return { 
      message,
      successCount,
      errorCount,
      results,
      errors
    };
  }

  console.error(`Função desconhecida tentou ser chamada: ${name}`);
  return { message: `❌ Função desconhecida: ${name}` };
};