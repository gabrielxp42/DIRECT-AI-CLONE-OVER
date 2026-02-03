import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { removeAccents } from '@/utils/string';
import { isEligibleForPlusMode } from '@/hooks/useIsPlusMode';

// Tipos de dados para resultados de consultas Supabase com JOINs
interface ClientName {
  nome: string;
}

interface OrderWithClient {
  id: string;
  order_number: number;
  status: string;
  valor_total: number;
  total_metros: number;
  total_metros_dtf: number;
  total_metros_vinil: number;
  created_at: string;
  clientes: ClientName | null;
}

interface ServiceWithOrder {
  id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number;
  pedido_id: string;
  pedidos: {
    id: string;
    order_number: number;
    status: string;
    created_at: string;
    clientes: ClientName | null;
  } | null;
}

interface MetersReportResult {
  total_meters: number;
  total_meters_dtf: number;
  total_meters_vinil: number;
  total_orders: number;
}

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
  const rioLocalTime = new Date(year, month - 1, day, hour, minute, second);

  // Formatos de exibição
  const displayDate = rioLocalTime.toLocaleDateString('pt-BR', { dateStyle: 'full', timeZone: TIME_ZONE });
  const displayTime = rioLocalTime.toLocaleTimeString('pt-BR', { timeStyle: 'medium', timeZone: TIME_ZONE });

  // --- CÁLCULO DA SEMANA DE TRABALHO (TERÇA A SÁBADO) ---
  // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  const WORK_WEEK_START_DAY_INDEX = 2; // Terça
  const WORK_WEEK_END_DAY_INDEX = 6; // Sábado
  const dayOfWeekIndex = rioLocalTime.getDay();

  let daysToStartOfWeek;
  if (dayOfWeekIndex >= WORK_WEEK_START_DAY_INDEX && dayOfWeekIndex <= WORK_WEEK_END_DAY_INDEX) {
    // Se for Terça a Sábado, subtrai para chegar na Terça
    daysToStartOfWeek = dayOfWeekIndex - WORK_WEEK_START_DAY_INDEX;
  } else if (dayOfWeekIndex === 0) { // Domingo
    daysToStartOfWeek = 5; // 5 dias para trás (Domingo -> Sábado -> Sexta -> Quinta -> Quarta -> Terça)
  } else { // Segunda (dayOfWeekIndex === 1)
    daysToStartOfWeek = 6; // 6 dias para trás (Segunda -> Domingo -> Sábado -> ... -> Terça)
  }

  const startOfWorkWeek = new Date(rioLocalTime);
  startOfWorkWeek.setDate(rioLocalTime.getDate() - daysToStartOfWeek);
  startOfWorkWeek.setHours(0, 0, 0, 0);

  const endOfWorkWeek = new Date(startOfWorkWeek);
  endOfWorkWeek.setDate(startOfWorkWeek.getDate() + (WORK_WEEK_END_DAY_INDEX - WORK_WEEK_START_DAY_INDEX));
  endOfWorkWeek.setHours(23, 59, 59, 999);

  // --- CÁLCULO DE OUTROS RANGES ---
  const startOfRioDay = new Date(rioLocalTime);
  startOfRioDay.setHours(0, 0, 0, 0);

  const endOfRioDay = new Date(rioLocalTime);
  endOfRioDay.setHours(23, 59, 59, 999);

  const startOfRioMonth = new Date(rioLocalTime.getFullYear(), rioLocalTime.getMonth(), 1, 0, 0, 0, 0);
  const endOfRioMonth = new Date(rioLocalTime.getFullYear(), rioLocalTime.getMonth() + 1, 0, 23, 59, 59, 999);


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
      thisWorkWeek: { // NOVO RANGE
        start: startOfWorkWeek.toISOString(),
        end: endOfWorkWeek.toISOString(),
        label: `Semana de Trabalho (${startOfWorkWeek.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })} a ${endOfWorkWeek.toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })})`
      },
      today: {
        start: startOfRioDay.toISOString(),
        end: endOfRioDay.toISOString(),
        label: `Hoje (${displayDate})`
      }
    }
  };
};

// Função para realizar cálculos matemáticos
const perform_calculation = (args: { expression: string }) => {
  try {
    // Usar a função Function para avaliar a expressão de forma segura
    // Nota: Isso é seguro em um ambiente de Edge Function ou em um contexto controlado como este.
    // Em um ambiente de navegador, é importante garantir que a expressão seja apenas matemática.
    const result = new Function('return ' + args.expression)();

    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error("Resultado não é um número válido.");
    }

    const formattedResult = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(result);

    return {
      result: result,
      formattedResult: formattedResult,
      message: `O resultado do cálculo '${args.expression}' é: ${formattedResult}`
    };
  } catch (e: any) {
    return {
      error: true,
      message: `Erro ao calcular a expressão '${args.expression}': ${e.message}`
    };
  }
};

// Função para atualizar o branding do site (Gabi Designer)
const update_branding = async (args: { primary_color?: string; company_name?: string; logo_url?: string }) => {
  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("Não foi possível obter o ID do usuário.");
    const userData = await response.json();
    const userId = userData.id;

    const updates: any = {};
    if (args.primary_color) updates.company_primary_color = args.primary_color;
    if (args.company_name) updates.company_name = args.company_name;
    if (args.logo_url) updates.company_logo_url = args.logo_url;

    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Erro ao atualizar perfil: ${errorText}`);
    }

    return {
      success: true,
      message: `✨ **Branding atualizado com sucesso!** O site refletirá as mudanças em instantes.`
    };
  } catch (e: any) {
    return { error: true, message: `Erro ao atualizar branding: ${e.message}` };
  }
};

// Função para enviar mensagem de WhatsApp (Link wa.me ou Evolution API)
const send_whatsapp_message = async (args: { phone?: string; message: string; clientName?: string; mode?: 'link' | 'auto' }) => {
  let finalPhone = args.phone || '';
  let resolvedClientName = args.clientName || '';

  // 1. Validar se o telefone é um placeholder (999999999) ou está vazio
  const isPlaceholder = finalPhone.includes('999999999') || !finalPhone;

  // 2. Se for placeholder ou tiver nome do cliente, tentar buscar o telefone REAL no banco
  if ((isPlaceholder || args.clientName)) {
    console.log(`🔍 [send_whatsapp_message] Telefone suspeito ou nome fornecido. Buscando dados reais para: ${args.clientName || args.phone}`);
    const searchTerm = args.clientName || args.phone || '';
    const foundClients = await findClientWithMultipleStrategies(searchTerm);

    if (foundClients && foundClients.length > 0) {
      const client = foundClients[0] as any;
      if (client.telefone) {
        finalPhone = client.telefone;
        resolvedClientName = client.nome;
        console.log(`✅ [send_whatsapp_message] Telefone real encontrado para ${resolvedClientName}: ${finalPhone}`);
      }
    }
  }

  if (!finalPhone || finalPhone.includes('999999999')) {
    return {
      error: true,
      message: `❌ Não consegui encontrar o telefone real de "${args.clientName || args.phone || 'Hudson'}". Por favor, me informe o número ou verifique o cadastro do cliente.`
    };
  }

  // Limpar telefone (apenas números)
  const cleanPhone = finalPhone.replace(/\D/g, '');

  // --- LÓGICA DE ELEGIBILIDADE USANDO HELPER CENTRALIZADO ---
  let canSendDirectly = false;
  let isPlus = false;

  try {
    const token = await getValidToken();
    if (token) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          const status = isEligibleForPlusMode(profile);
          isPlus = status.isPlus;
          canSendDirectly = status.canSendDirectly;
        }
      }
    }
  } catch (err) {
    console.warn("Erro ao verificar elegibilidade de envio direto:", err);
  }

  // Se o modo for explicitamente 'link', forçamos false
  if (args.mode === 'link') canSendDirectly = false;

  const encodedMessage = encodeURIComponent(args.message);
  const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return {
    type: 'whatsapp_action', // Mantemos este tipo para renderizar o balão verde
    data: {
      phone: finalPhone,
      cleanPhone: cleanPhone, // Necessário para o envio direto posterior
      clientName: resolvedClientName,
      message: args.message,
      link: waLink,
      canSendDirectly: canSendDirectly, // Flag para o frontend saber se mostra botão de envio direto ou link
      isPlus: isPlus, // Flag para UI saber se deve mostrar estilo Gabi ou padrão
      status: 'ready_to_send'
    },
    // Mensagem de texto amigável caso a UI não renderize o card
    message: `Pronto! Preparei a mensagem para **${resolvedClientName || finalPhone}**. Verifique abaixo e clique em enviar.`
  };

};

// Função para resetar a memória do usuário
const reset_user_memory = async (args: { confirmation: string }) => {
  if (args.confirmation !== 'confirmar') {
    return {
      error: true,
      message: "Erro: Você precisa digitar 'confirmar' exatamente para resetar a memória."
    };
  }

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("Usuário não autenticado.");
    const userData = await response.json();

    // Deletar memórias via RPC ou DELETE direto
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/agent_memory?user_id=eq.${userData.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!deleteResponse.ok) throw new Error("Erro ao deletar memórias do banco.");

    return {
      success: true,
      message: "🧠 **Memória resetada com sucesso!** A partir de agora, começarei a aprender sobre você do zero."
    };
  } catch (e: any) {
    return { error: true, message: `Erro ao resetar memória: ${e.message}` };
  }
};

// Função para obter o ranking dos clientes
export const get_top_clients = async (args: { top_n?: number }) => {
  const { top_n = 5 } = args;
  const TIME_ZONE = 'America/Sao_Paulo';

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_top_clients`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ top_n: top_n })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP: ${response.status} ${errorText}`);
    }

    const topClients = await response.json();

    if (!topClients || topClients.length === 0) {
      return { message: "❌ Não foi possível encontrar dados de ranking de clientes. Verifique se há pedidos registrados." };
    }

    const formattedClients = (topClients as any[]).map((client, index) => ({
      rank: index + 1,
      client_name: client.client_name,
      total_orders: client.total_orders,
      total_spent: client.total_spent,
      total_spent_formatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.total_spent)
    }));

    const message = `🏆 **Top ${formattedClients.length} Clientes por Pedidos:**\n\n` +
      formattedClients.map(c =>
        `#${c.rank}: **${c.client_name}** - ${c.total_orders} pedidos, total de ${c.total_spent_formatted}`
      ).join('\n');

    return {
      clients: formattedClients,
      summary: {
        top_client_name: formattedClients[0].client_name,
        top_client_orders: formattedClients[0].total_orders,
        top_client_spent: formattedClients[0].total_spent
      },
      message: message
    };

  } catch (error: any) {
    console.error("Erro ao buscar top clientes:", error);
    throw new Error(`❌ Erro ao buscar ranking de clientes: ${error.message}`);
  }
};

// NOVO: Função para obter o total de metros lineares por período
export const get_total_meters_by_period = async (args: {
  startDate?: string;
  endDate?: string;
  allTime?: boolean;
}) => {
  let { startDate, endDate, allTime } = args;
  const TIME_ZONE = 'America/Sao_Paulo';
  const dateInfo = getCurrentDateTime();
  let periodDescription = "em todo o período";

  if (allTime) {
    // Para 'allTime', usamos uma data muito antiga como início
    startDate = '2000-01-01T00:00:00.000Z';
    endDate = new Date().toISOString();
    periodDescription = `desde o início`;
  } else if (!startDate && !endDate) {
    // Default para o mês atual
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

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_total_meters_by_period`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation' // Ensure we get the result back
      },
      body: JSON.stringify({
        p_start_date: startDate,
        p_end_date: endDate
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // RPC returns a single object if it returns a composite type, or a scalar
    // Assuming it returns a single row with total_meters and total_orders
    const result = (Array.isArray(data) ? data[0] : data) as MetersReportResult;

    const totalMeters = result?.total_meters || 0;
    const totalMetersDTF = result?.total_meters_dtf || 0;
    const totalMetersVinil = result?.total_meters_vinil || 0;
    const totalOrders = result?.total_orders || 0;

    if (totalOrders === 0) {
      return { message: `❌ Nenhum pedido encontrado ${periodDescription}. Total de metros: 0 ML.` };
    }

    return {
      total_meters: totalMeters,
      total_meters_dtf: totalMetersDTF,
      total_meters_vinil: totalMetersVinil,
      total_orders: totalOrders,
      message: `📏 **Total de Metros Lineares** ${periodDescription}:\n\n- Total: **${totalMeters.toFixed(2)} ML**\n- 🖨️ DTF: **${totalMetersDTF.toFixed(2)} ML**\n- ✂️ Vinil: **${totalMetersVinil.toFixed(2)} ML**\n\n(Encontrados em ${totalOrders} pedidos)`
    };

  } catch (error: any) {
    console.error("Erro ao buscar total de metros:", error);
    throw new Error(`❌ Erro ao buscar total de metros: ${error.message}`);
  }
};


// OpenAI Functions format
export const openAIFunctions = [
  {
    name: "get_current_date",
    description: "Obtém a data e hora atual do sistema, sempre no fuso horário de Rio de Janeiro (America/Sao_Paulo). Use esta função quando precisar saber 'que dia é hoje', 'que mês estamos', ou quando o usuário mencionar períodos relativos como 'desse mês', 'desta semana', 'hoje', 'ontem', etc. O campo 'ranges.thisWorkWeek' retorna o intervalo de Terça a Sábado, que é a semana de trabalho da empresa.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "perform_calculation",
    description: "Realiza operações matemáticas precisas. Use esta ferramenta SEMPRE que precisar somar, subtrair, multiplicar, dividir ou calcular porcentagens. Ex: '1000 * 0.10' para 10% de 1000. Use os valores numéricos exatos fornecidos pelas outras ferramentas.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "A expressão matemática a ser avaliada, usando operadores padrão (+, -, *, /). Ex: '15000 * 0.10' ou '100 + 50'."
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "get_top_clients",
    description: "Obtém o ranking dos clientes que mais fizeram pedidos ou gastaram. Use esta função para responder perguntas como 'qual cliente mais pede?', 'quem é o top cliente?', 'liste os 5 melhores clientes'.",
    parameters: {
      type: "object",
      properties: {
        top_n: {
          type: "number",
          description: "O número de clientes a retornar no ranking. Padrão é 5."
        }
      },
      required: []
    }
  },
  {
    name: "get_total_meters_by_period",
    description: "Calcula o total de metros lineares (ML) vendidos em um período específico, com divisão entre DTF e Vinil. Use para perguntas como 'quantos metros rodamos hoje?', 'total de ML deste mês', 'quanto foi DTF hoje?'.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          format: "date-time",
          description: "Data de início do período para filtrar (formato ISO 8601)."
        },
        endDate: {
          type: "string",
          format: "date-time",
          description: "Data de fim do período para filtrar (formato ISO 8601)."
        },
        allTime: {
          type: "boolean",
          description: "Se verdadeiro, ignora startDate e endDate e busca o total de metros desde o início."
        }
      },
      required: []
    }
  },
  {
    name: "get_client_orders",
    description: "Obtém TODOS os pedidos de um cliente específico, independente da data. Use esta função quando o usuário pedir 'pedidos do cliente X', 'todos os pedidos do Detto', 'pedidos do cliente Y desse mês', etc. Retorna o NÚMERO do pedido, status, valor total, total de metros (geral, DTF e Vinil), data de criação e nome do cliente. Usa busca inteligente que encontra clientes mesmo com nomes parciais ou pequenos erros de digitação.",
    parameters: {
      type: "object",
      properties: {
        clientName: {
          type: "string",
          description: "O nome completo ou parcial do cliente. A busca é inteligente e encontra clientes mesmo com nomes parciais ou pequenos erros de digitação."
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
          description: "O nome completo ou parcial do cliente. A busca é inteligente e encontra clientes mesmo com nomes parciais ou pequenos erros de digitação."
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
    description: "Obtém pedidos filtrando por um ou mais status. Use para perguntas como 'quantos pedidos pendentes?', 'liste os pedidos cancelados', 'quais pedidos não estão pagos?'. Retorna o NÚMERO do pedido, status, valor total, total de metros (geral, DTF e Vinil), data de criação e nome do cliente.",
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
    description: "Lista pedidos por filtros de data, sem especificar cliente. Use esta função SOMENTE quando o usuário pedir pedidos por período sem mencionar cliente específico (ex: 'pedidos de hoje', 'pedidos desta semana', 'último pedido', 'quantos pedidos esta semana', 'pedido mais caro'). NÃO use esta função quando o usuário mencionar um cliente específico. Retorna o NÚMERO do pedido, status, valor total, total de metros (geral, DTF e Vinil), data de criação e nome do cliente.",
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
          description: "Campo e direção para ordenar os pedidos. 'created_at_asc' para os mais antigos primeiro, 'created_at_desc' para os mais recentes primeiro, 'valor_total_desc' para os mais caros primeiro. Padrão é 'created_at_at_desc'."
        },
        includeTotalCount: {
          type: "boolean",
          description: "Se verdadeiro, retorna a contagem total de pedidos que correspondem aos filtros, além dos pedidos listados. Use para perguntas como 'quantos pedidos temos no total?' ou 'quantos pedidos este mês?'"
        },
        allTime: {
          type: "boolean",
          description: "Se verdadeiro, ignora startDate e endDate e busca pedidos desde o início."
        },
        statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
          },
          description: "Uma lista de status para INCLUIR nos resultados (ex: ['pago'])."
        },
        exclude_statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
          },
          description: "Uma lista de status para EXCLUIR dos resultados."
        }
      },
      required: []
    }
  },
  {
    name: "list_services", // NEW TOOL
    description: "Lista serviços por filtros de data e status. Use para perguntas como 'quantos serviços tivemos esta semana?', 'quais serviços foram feitos hoje?'. Retorna o nome do serviço, quantidade, valor unitário, valor total, número do pedido, status do pedido, data do pedido e nome do cliente. **IMPORTANTE:** Quando o usuário perguntar sobre 'esta semana' ou 'semana passada', use o intervalo 'ranges.thisWorkWeek' ou calcule o intervalo de Terça a Sábado.",
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
        statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
          },
          description: "Uma lista de status de pedido para INCLUIR nos resultados."
        },
        exclude_statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["pendente", "processando", "enviado", "entregue", "cancelado", "pago", "aguardando retirada"]
          },
          description: "Uma lista de status de pedido para EXCLUIR dos resultados."
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
          description: "Uma observação opcional sobre a mudança de status (ex: 'Pago 50% do valor', 'Cliente retirou parcialmente', etc.)."
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
  },
  {
    name: "calculate_dtf_packing",
    description: "OBRIGATÓRIO: Use esta ferramenta para QUALQUER cálculo de aproveitamento (packing) de imagens ou metragem de DTF. IMPORTANTE: Esta ferramenta ativa o componente visual interativo e o botão de 'Ver Preview' na interface. Mesmo que você saiba o resultado matemático, você DEVE chamá-la para que o usuário possa ver o preview visual. Use para perguntas como 'quantas cabem', 'quantos metros consome', 'orçamento de X unidades'.",
    parameters: {
      type: "object",
      properties: {
        calculation_mode: {
          type: "string",
          enum: ["quantity_in_meters", "meters_for_quantity"],
          description: "O que o usuário quer saber? 'quantity_in_meters' para saber quantas cabem em X metros (ex: 'quantas cabem em 1m?'). 'meters_for_quantity' para saber quantos metros consome X unidades (ex: 'quantos metros para 1000 logos?')."
        },
        imageWidth: {
          type: "number",
          description: "Largura da imagem individual em centímetros (cm)."
        },
        imageHeight: {
          type: "number",
          description: "Altura da imagem individual em centímetros (cm)."
        },
        quantity: {
          type: "number",
          description: "Quantidade total de imagens/logos desejada (se o modo for 'meters_for_quantity') OU a metragem do rolo em METROS (se o modo for 'quantity_in_meters')."
        },
        rollWidth: {
          type: "number",
          description: "Largura do rolo de filme (ex: 58 ou 100). Valor padrão é 58.",
          default: 58
        },
        separation: {
          type: "number",
          description: "Espaçamento entre as imagens em centímetros. Valor padrão é 0.5.",
          default: 0.5
        },
        margin: {
          type: "number",
          description: "Margem de segurança nas laterais do rolo em centímetros. Valor padrão é 1.0.",
          default: 1.0
        }
      },
      required: ["calculation_mode", "imageWidth", "imageHeight", "quantity"]
    }
  },
  {
    name: "update_branding",
    description: "Altera as cores, nome ou logo do sistema. Use quando o usuário pedir 'mude as cores', 'troque o logo', 'altere o nome da empresa'. A cor deve ser em formato Hex (ex: #FF0000).",
    parameters: {
      type: "object",
      properties: {
        primary_color: { type: "string", description: "Cor primária em formato Hex (ex: #6c5ce7)" },
        company_name: { type: "string", description: "Novo nome da empresa" },
        logo_url: { type: "string", description: "URL da nova imagem de logo" }
      }
    }
  },
  {
    name: "send_whatsapp_message",
    description: "Prepara uma mensagem para ser enviada via WhatsApp. Se você não tiver o telefone real, informe o nome do cliente no parâmetro clientName que eu buscarei o número no banco de dados automaticamente.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "O número do telefone (preferencialmente com DDD). Se for placeholder (9999), deixe vazio e use clientName."
        },
        clientName: {
          type: "string",
          description: "O nome do cliente para buscar o telefone real caso o número não seja conhecido."
        },
        message: {
          type: "string",
          description: "A mensagem formatada para o WhatsApp. Use emojis e um estilo profissional."
        },
        mode: {
          type: "string",
          enum: ["link", "auto"],
          description: "O modo de envio. 'link' gera um link wa.me (padrão)."
        }
      },
      required: ["message"]
    }
  },
  {
    name: "reset_user_memory",
    description: "Apaga todo o histórico de aprendizado e preferências da Gabi sobre o usuário atual. EXIGE confirmação textual 'confirmar'.",
    parameters: {
      type: "object",
      properties: {
        confirmation: { type: "string", description: "Deve ser exatamente 'confirmar' para funcionar." }
      },
      required: ["confirmation"]
    }
  }
];

// Helper function to find order by number with multiple strategies
const findOrderByNumber = async (orderNumber: number) => {
  console.log(`🔍 [findOrderByNumber] Buscando pedido #${orderNumber}...`);

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=id&order_number=eq.${orderNumber}&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ [findOrderByNumber] Erro HTTP: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      console.log(`✅ [findOrderByNumber] Busca direta encontrou UUID: ${data[0].id}`);
      return data[0].id;
    }

    console.log('❌ [findOrderByNumber] Busca direta não encontrou o pedido');
    return null;
  } catch (error) {
    console.log('❌ [findOrderByNumber] Erro na busca direta:', error);
    return null;
  }
};

// Helper function to perform multiple search strategies for clients
const findClientWithMultipleStrategies = async (clientName: string) => {
  console.log(`🔍 [findClient] Buscando cliente: "${clientName}"`);

  const originalName = clientName.trim();
  const normalizedClientName = removeAccents(clientName.toLowerCase().trim());

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Strategy 1: Try fuzzy search function (most flexible if working correctly)
    try {
      console.log('📍 [findClient] Tentativa 1: Busca fuzzy com função do banco (normalized)');
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_client_by_fuzzy_name`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          partial_name: normalizedClientName,
          similarity_threshold: 0.05
        })
      });

      if (response.ok) {
        const fuzzyClients = await response.json();
        if (fuzzyClients && fuzzyClients.length > 0) {
          console.log(`✅ [findClient] Busca fuzzy encontrou ${fuzzyClients.length} cliente(s):`, fuzzyClients.map((c: any) => c.nome));
          return fuzzyClients;
        }
      }
    } catch (error) {
      console.log(`❌ [findClient] Erro ao chamar RPC find_client_by_fuzzy_name:`, error);
    }

    // Strategy 2: Direct ILIKE search with normalized name
    try {
      console.log('📍 [findClient] Tentativa 2: Busca ILIKE com nome normalizado');
      const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=id,nome&nome=ilike.*${encodeURIComponent(normalizedClientName)}*&limit=10`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const ilikeNormalizedClients = await response.json();
        if (ilikeNormalizedClients && ilikeNormalizedClients.length > 0) {
          console.log(`✅ [findClient] ILIKE normalizado encontrou ${ilikeNormalizedClients.length} cliente(s):`, ilikeNormalizedClients.map((c: any) => c.nome));
          return ilikeNormalizedClients;
        }
      }
    } catch (error) {
      console.log('❌ [findClient] Erro na busca ILIKE normalizada:', error);
    }

    // Strategy 3: Broad search and client-side filtering
    try {
      console.log(`📍 [findClient] Tentativa 3: Busca ampla e filtragem client-side`);
      const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=id,nome&limit=100`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        const allClients = await response.json();
        if (allClients && allClients.length > 0) {
          const filteredClients = (allClients as any[]).filter(client =>
            removeAccents(client.nome.toLowerCase()).includes(normalizedClientName)
          );
          if (filteredClients.length > 0) {
            console.log(`✅ [findClient] Busca ampla + client-side encontrou ${filteredClients.length} cliente(s):`, filteredClients.map((c: any) => c.nome));
            return filteredClients;
          }
        }
      }
    } catch (error) {
      console.log('❌ [findClient] Erro na busca ampla + client-side:', error);
    }

    // Strategy 4: Original ILIKE search
    const nameParts = [
      ...originalName.split(' ').filter(part => part.length > 1),
      ...normalizedClientName.split(' ').filter(part => part.length > 1)
    ];
    const uniqueParts = [...new Set(nameParts)];

    if (uniqueParts.length > 0) {
      for (const part of uniqueParts) {
        try {
          console.log(`📍 [findClient] Tentativa por parte do nome: "${part}"`);
          const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=id,nome&nome=ilike.*${encodeURIComponent(part)}*&limit=10`, {
            method: 'GET',
            headers: headers
          });

          if (response.ok) {
            const clients = await response.json();
            if (clients && clients.length > 0) {
              console.log(`✅ [findClient] Busca por parte encontrou ${clients.length} cliente(s):`, clients.map((c: any) => c.nome));
              return clients;
            }
          }
        } catch (error) {
          console.log(`❌ [findClient] Erro na busca por parte "${part}":`, error);
        }
      }
    }

    console.log('❌ [findClient] Nenhuma estratégia de busca encontrou resultados');
    return null;

  } catch (error) {
    console.log('❌ [findClient] Erro geral:', error);
    return null;
  }
};

// Helper to get company info for PDF from profile
const getCompanyInfo = async () => {
  try {
    const token = await getValidToken();
    if (!token) return undefined;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return undefined;
    const userData = await response.json();
    const userId = userData.id;

    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*&id=eq.${userId}&limit=1`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!profileResponse.ok) return undefined;
    const profiles = await profileResponse.json();
    if (!profiles || profiles.length === 0) return undefined;

    const profile = profiles[0];

    // Construct full address
    const address_full = [
      profile.company_address_street,
      profile.company_address_number,
      profile.company_address_neighborhood,
      profile.company_address_city,
      profile.company_address_state
    ].filter(Boolean).join(', ');

    return {
      company_name: profile.company_name || 'Minha Empresa',
      phone: profile.company_whatsapp || profile.company_phone || '',
      email: profile.company_email || '',
      address_full: address_full || '',
      pix_key: profile.company_pix_key || '',
      logo_url: profile.company_logo_url || '/logo.png'
    };
  } catch (error) {
    console.warn('⚠️ Erro ao buscar informações da empresa para PDF:', error);
    return undefined;
  }
};

// Helper function to fetch complete order data for PDF generation
const fetchCompleteOrderData = async (fullOrderId: string) => {
  console.log(`📋 [fetchCompleteOrderData] Buscando dados completos do pedido: ${fullOrderId}`);

  try {
    const token = await getValidToken();
    if (!token) throw new Error("Token inválido");

    const selectQuery = `*,clientes(id,nome,email,telefone,endereco),pedido_items(id,produto_nome,quantidade,preco_unitario,observacao,produtos(id,nome)),pedido_servicos(id,nome,quantidade,valor_unitario)`;

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=${selectQuery}&id=eq.${fullOrderId}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.error('❌ [fetchCompleteOrderData] Nenhum dado encontrado');
      throw new Error('Pedido não encontrado');
    }

    const orderData = data[0];

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
  allTime?: boolean;
  statuses?: string[];
  exclude_statuses?: string[];
}) => {
  let { startDate, endDate, limit = 10, orderBy = 'created_at_desc', includeTotalCount, allTime, statuses, exclude_statuses } = args;
  const TIME_ZONE = 'America/Sao_Paulo';
  const dateInfo = getCurrentDateTime();
  let periodDescription = "em todo o período";

  console.log(`📊 [list_orders] Args recebidos:`, args); // Log received args
  console.log(`📊 [list_orders] Current date info (thisMonth):`, dateInfo.ranges.thisMonth); // Log current month info

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

  console.log(`📊 [list_orders] Datas finais para consulta:`, { startDate, endDate }); // Log final dates

  try {
    console.log('🔄 [list_orders] Obtendo token...');
    const token = await getValidToken();
    console.log('✅ [list_orders] Token obtido:', token ? 'Sim' : 'Não');
    if (!token) {
      throw new Error("Não foi possível obter um token de autenticação válido.");
    }

    const queryParams = new URLSearchParams();
    queryParams.append('select', 'id,order_number,status,valor_total,total_metros,total_metros_dtf,total_metros_vinil,created_at,clientes(nome),pedido_status_history(*)');

    if (startDate) {
      queryParams.append('created_at', `gte.${startDate}`);
    }
    if (endDate) {
      queryParams.append('created_at', `lte.${endDate}`);
    }

    if (statuses && statuses.length > 0) {
      const statusList = statuses.map(s => `"${s}"`).join(',');
      queryParams.append('status', `in.(${statusList})`);
    }

    if (exclude_statuses && exclude_statuses.length > 0) {
      const statusList = exclude_statuses.map(s => `"${s}"`).join(',');
      queryParams.append('status', `not.in.(${statusList})`);
    }

    let orderField: string = 'created_at';
    let ascending: boolean = false;

    switch (orderBy) {
      case 'created_at_asc': orderField = 'created_at'; ascending = true; break;
      case 'created_at_desc': orderField = 'created_at'; ascending = false; break;
      case 'valor_total_desc': orderField = 'valor_total'; ascending = false; break;
      default: orderField = 'created_at'; ascending = false; break;
    }

    queryParams.append('order', `${orderField}.${ascending ? 'asc' : 'desc'}`);

    if (!includeTotalCount && limit && limit > 0) {
      queryParams.append('limit', limit.toString());
    }

    const headers: HeadersInit = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    if (includeTotalCount) {
      headers['Prefer'] = 'count=exact';
    }

    console.log('🌐 [list_orders] Fazendo requisição fetch para:', `${SUPABASE_URL}/rest/v1/pedidos?${queryParams.toString()}`);
    console.log('🔑 [list_orders] Headers:', headers);

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?${queryParams.toString()}`, {
      method: 'GET',
      headers: headers
    });

    console.log('📡 [list_orders] Resposta recebida. Status:', response.status, 'OK:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
    }

    console.log('📦 [list_orders] Parseando JSON da resposta...');
    const orders = await response.json();
    console.log('✅ [list_orders] JSON parseado. Pedidos encontrados:', orders?.length || 0);

    let count = orders.length;
    const contentRange = response.headers.get('Content-Range');
    if (contentRange && contentRange.includes('/')) {
      const total = contentRange.split('/')[1];
      if (total !== '*') {
        count = parseInt(total, 10);
      }
    }

    const totalCountMessage = includeTotalCount ? ` (Total de ${count} pedidos encontrados)` : '';

    if (!orders || orders.length === 0) {
      return { message: `❌ Nenhum pedido encontrado ${periodDescription}.${totalCountMessage}` };
    }

    // FIX 1: Casting para OrderWithClient[]
    const formattedOrders = (orders as unknown as OrderWithClient[]).map((order, index) => ({
      index: index + 1,
      order_number: order.order_number,
      status: order.status,
      valor_total: order.valor_total,
      total_metros: order.total_metros,
      total_metros_dtf: order.total_metros_dtf,
      total_metros_vinil: order.total_metros_vinil,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
      cliente: order.clientes?.nome
    }));

    // FIX 2, 3: Casting para OrderWithClient[]
    // Calcule o valor total seguindo a lógica estrita do dashboard:
    // Apenas 'pago', 'entregue' OU 'aguardando retirada' (se já passou por pago)
    const paidOrders = (orders as any[]).filter(o => {
      const status = o.status?.toLowerCase();
      const isPaidStatus = ['pago', 'entregue'].includes(status);
      const isAwaitingPickup = status === 'aguardando retirada';
      let wasPaid = false;

      if (isAwaitingPickup && o.pedido_status_history && Array.isArray(o.pedido_status_history)) {
        wasPaid = o.pedido_status_history.some((h: any) =>
          h.status_novo?.toLowerCase() === 'pago' || h.status_anterior?.toLowerCase() === 'pago'
        );
      }

      return isPaidStatus || (isAwaitingPickup && wasPaid);
    });

    const totalValue = paidOrders.reduce((sum, order) => sum + order.valor_total, 0);
    const totalMetros = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros || 0), 0);
    const totalMetrosDTF = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_dtf || 0), 0);
    const totalMetrosVinil = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_vinil || 0), 0);

    const totalValueFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(totalValue);

    console.log('🎉 [list_orders] Preparando retorno com', orders.length, 'pedidos');

    const result = {
      orders: formattedOrders,
      summary: {
        count: orders.length,
        totalValue: totalValue,
        totalMetros: totalMetros,
        totalMetrosDTF: totalMetrosDTF,
        totalMetrosVinil: totalMetrosVinil,
        period: {
          start: startDate ? new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'início',
          end: endDate ? new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'fim'
        },
        totalMatchingOrders: count
      },
      message: `📊 Encontrados **${orders.length} pedidos** ${periodDescription}.${totalCountMessage}\n💰 Receita total: **${totalValueFormatted}**\n📏 Total de Metros: **${totalMetros.toFixed(2)} ML** (🖨️ ${totalMetrosDTF.toFixed(2)}m DTF | ✂️ ${totalMetrosVinil.toFixed(2)}m Vinil)`
    };

    console.log('✨ [list_orders] Retornando resultado:', result);
    return result;
  } catch (error: any) {
    console.error("Erro ao listar pedidos por data:", error);
    throw new Error(`Erro ao listar pedidos por data: ${error.message}`);
  }
};

// New list_services function with multiple strategies
export const list_services = async (args: {
  startDate?: string;
  endDate?: string;
  statuses?: string[]; // NEW
  exclude_statuses?: string[]; // NEW
  limit?: number;
  orderBy?: "created_at_asc" | "created_at_desc" | "valor_total_desc";
  includeTotalCount?: boolean;
  allTime?: boolean;
}) => {

  let { startDate, endDate, statuses, exclude_statuses, limit = 10, orderBy = 'created_at_desc', includeTotalCount, allTime } = args;
  const TIME_ZONE = 'America/Sao_Paulo';
  const dateInfo = getCurrentDateTime();
  let periodDescription = "em todo o período";

  console.log(`🛠️ [list_services] Args recebidos:`, args); // Log received args
  console.log(`🛠️ [list_services] Current date info (thisWorkWeek):`, dateInfo.ranges.thisWorkWeek); // Log current work week info

  if (allTime) {
    startDate = undefined;
    endDate = undefined;
    periodDescription = `desde o início`;
  } else if (!startDate && !endDate) {
    // Default to current work week for services
    startDate = dateInfo.ranges.thisWorkWeek.start;
    endDate = dateInfo.ranges.thisWorkWeek.end;
    periodDescription = `nesta semana de trabalho (${new Date(startDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })} a ${new Date(endDate).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE })})`;
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

  console.log(`🛠️ [list_services] Datas finais para consulta:`, { startDate, endDate }); // Log final dates

  let orderField: string;
  let ascending: boolean;

  switch (orderBy) {
    case 'created_at_asc':
      orderField = 'created_at';
      ascending = true;
      break;
    case 'created_at_desc':
      orderField = 'created_at';
      ascending = false;
      break;
    case 'valor_total_desc':
      orderField = 'valor_total';
      ascending = false;
      break;
    default: // Default to created_at_desc
      orderField = 'created_at';
      ascending = false;
      break;
  }

  // Strategy 1: Try pedido_servicos table with JOIN via Fetch
  try {
    console.log('📍 [list_services] Tentativa 1: Tabela pedido_servicos com JOIN (via Fetch)');

    const token = await getValidToken();
    if (!token) {
      throw new Error("Não foi possível obter um token de autenticação válido.");
    }

    const queryParams = new URLSearchParams();
    queryParams.append('select', 'id,nome,quantidade,valor_unitario,pedido_id,pedidos!inner(id,order_number,status,created_at,clientes(nome))');

    if (startDate) {
      queryParams.append('pedidos.created_at', `gte.${startDate}`);
    }
    if (endDate) {
      queryParams.append('pedidos.created_at', `lte.${endDate}`);
    }

    if (statuses && statuses.length > 0) {
      const statusList = statuses.map(s => `"${s}"`).join(',');
      queryParams.append('pedidos.status', `in.(${statusList})`);
    }

    if (exclude_statuses && exclude_statuses.length > 0) {
      const statusList = exclude_statuses.map(s => `"${s}"`).join(',');
      queryParams.append('pedidos.status', `not.in.(${statusList})`);
    }

    if (statuses && statuses.length > 0) {
      const statusList = statuses.map(s => `"${s}"`).join(',');
      queryParams.append('pedidos.status', `in.(${statusList})`);
    }
    if (exclude_statuses && exclude_statuses.length > 0) {
      const statusList = exclude_statuses.map(s => `"${s}"`).join(',');
      queryParams.append('pedidos.status', `not.in.(${statusList})`);
    }

    if (!includeTotalCount && limit && limit > 0) {
      queryParams.append('limit', limit.toString());
    }

    const headers: HeadersInit = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    if (includeTotalCount) {
      headers['Prefer'] = 'count=exact';
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pedido_servicos?${queryParams.toString()}`, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
    }

    const services = await response.json();

    let count = services.length;
    const contentRange = response.headers.get('Content-Range');
    if (contentRange && contentRange.includes('/')) {
      const total = contentRange.split('/')[1];
      if (total !== '*') {
        count = parseInt(total, 10);
      }
    }

    console.log(`✅ [list_services] Estratégia 1 funcionou: ${services.length} serviços encontrados`);

    const totalCountMessage = includeTotalCount ? ` (Total de ${count} serviços encontrados)` : '';

    if (services.length === 0) {
      return { message: `❌ Nenhum serviço encontrado ${periodDescription}.${totalCountMessage}` };
    }

    // FIX 4: Casting para ServiceWithOrder[]
    let formattedServices = (services as any[]).map((service, index) => ({
      index: index + 1,
      service_name: service.nome,
      quantity: Number(service.quantidade), // ADDED COERCION
      unit_value: Number(service.valor_unitario), // ADDED COERCION
      total_value: Number(service.quantidade) * Number(service.valor_unitario), // ADDED COERCION
      order_number: service.pedidos?.order_number,
      order_status: service.pedidos?.status,
      order_date: service.pedidos ? new Date(service.pedidos.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }) : 'N/A',
      client_name: service.pedidos?.clientes?.nome
    }));

    // Apply client-side sorting for Strategy 1
    if (orderField === 'created_at') {
      formattedServices.sort((a, b) => {
        const dateA = new Date(a.order_date.split('/').reverse().join('-')).getTime(); // Convert dd/MM/yyyy to yyyy-MM-dd for Date object
        const dateB = new Date(b.order_date.split('/').reverse().join('-')).getTime();
        return ascending ? dateA - dateB : dateB - dateA;
      });
    } else if (orderField === 'valor_total') {
      formattedServices.sort((a, b) => ascending ? a.total_value - b.total_value : b.total_value - a.total_value);
    }

    const totalRevenue = formattedServices.reduce((sum, service) => sum + service.total_value, 0);
    const totalRevenueFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(totalRevenue);

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
      message: `🛠️ Encontrados **${services.length} serviços** ${periodDescription}.\n💰 Receita total: **${totalRevenueFormatted}**`
    };

  } catch (error: any) {
    console.log('❌ [list_services] Erro na estratégia 1:', error);
    throw new Error(`Erro ao buscar serviços: ${error.message}`);
  }
};

// Helper function to fetch complete order data for PDF generation (kept for completeness)
// ... (fetchCompleteOrderData is defined above)

export const callOpenAIFunction = async (functionCall: { name: string; arguments: any }) => {
  console.log(`🎯 [callOpenAIFunction] INÍCIO - Função chamada:`, functionCall.name);
  console.log(`📋 [callOpenAIFunction] Argumentos recebidos:`, functionCall.arguments);

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

  if (name === "perform_calculation") {
    return perform_calculation(args);
  }

  if (name === "get_top_clients") {
    return get_top_clients(args);
  }

  if (name === "update_branding") {
    return update_branding(args);
  }

  if (name === "send_whatsapp_message") {
    // Passar o argumento 'mode' explicitamente
    return send_whatsapp_message({
      ...args,
      mode: args.mode as 'link' | 'auto' // Garantir tipagem
    });
  }

  if (name === "reset_user_memory") {
    return reset_user_memory(args);
  }

  if (name === "get_total_meters_by_period") {
    return get_total_meters_by_period(args);
  }

  if (name === "get_client_orders") {
    const { clientName } = args;
    console.log(`🔍 [get_client_orders] Buscando pedidos para cliente: "${clientName}"`);

    const foundClients = await findClientWithMultipleStrategies(clientName);

    if (!foundClients || foundClients.length === 0) {
      console.log(`❌ [get_client_orders] Nenhum cliente encontrado para: "${clientName}"`);

      // Buscar alguns clientes para sugerir
      try {
        const token = await getValidToken();
        if (token) {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=nome&limit=10`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const allClients = await response.json();
            const clientList = (allClients as ClientName[]).map(c => c.nome).join(', ');
            return {
              orders: [],
              summary: {
                clientName: clientName,
                totalOrders: 0,
                totalValue: 0,
                totalMetros: 0,
                foundMultipleClients: false
              },
              message: `❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis no sistema:\n${clientList}\n\n💡 Dica: Tente usar o nome completo ou verifique a grafia.`
            };
          }
        }
        return {
          orders: [],
          summary: {
            clientName: clientName,
            totalOrders: 0,
            totalValue: 0,
            totalMetros: 0,
            foundMultipleClients: false
          },
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}".`
        };
      } catch (error: any) {
        console.error(`❌ [get_client_orders] Erro ao buscar lista de clientes:`, error);
        return {
          orders: [],
          summary: {
            clientName: clientName,
            totalOrders: 0,
            totalValue: 0,
            totalMetros: 0,
            foundMultipleClients: false
          },
          message: `❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto ou tente usar apenas parte do nome.`
        };
      }
    }

    console.log(`✅ [get_client_orders] Cliente(s) encontrado(s):`, foundClients.map((c: any) => c.nome));

    // SE encontrar múltiplos clientes, vamos ser mais rígidos para evitar ALUCINAÇÃO
    // Se o nome for uma correspondência exata de um deles, pegamos apenas esse.
    // Caso contrário, informamos ao assistente os múltiplos nomes para ele pedir clarificação.

    let targetClient = foundClients[0];
    const exactMatch = foundClients.find((c: any) => c.nome.toLowerCase() === clientName.toLowerCase().trim());

    if (exactMatch) {
      targetClient = exactMatch;
      console.log(`🎯 [get_client_orders] Encontrada correspondência EXATA: ${targetClient.nome}`);
    } else if (foundClients.length > 1) {
      console.log(`⚠️ [get_client_orders] Múltiplos clientes encontrados, retornando lista para clarificação.`);
      const clientNames = foundClients.map((c: any) => c.nome).join(', ');
      return {
        orders: [],
        summary: {
          foundMultipleClients: true,
          clientOptions: foundClients.map((c: any) => ({ id: c.id, nome: c.nome }))
        },
        message: `🔍 Encontrei mais de um cliente com o nome parecido: **${clientNames}**.\n\n❓ **Por favor, me diga exatamente qual deles você quer consultar?**`
      };
    }

    const clientId = targetClient.id;

    try {
      const token = await getValidToken();
      if (!token) throw new Error("Token inválido");

      const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=id,order_number,status,valor_total,total_metros,total_metros_dtf,total_metros_vinil,created_at,clientes(nome)&cliente_id=eq.${clientId}&order=created_at.desc`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP: ${response.status} ${errorText}`);
      }

      const orders = await response.json();

      if (!orders || orders.length === 0) {
        console.log(`❌ [get_client_orders] Nenhum pedido encontrado para: ${targetClient.nome}`);
        return {
          message: `✅ Cliente encontrado: **${targetClient.nome}**\n\n❌ Porém, este cliente ainda não possui nenhum pedido registrado no sistema.`
        };
      }

      console.log(`✅ [get_client_orders] Encontrados ${orders.length} pedidos para ${targetClient.nome}`);

      const formattedOrders = (orders as unknown as OrderWithClient[]).map((order, index) => ({
        index: index + 1,
        order_number: order.order_number,
        status: order.status,
        valor_total: order.valor_total,
        total_metros: order.total_metros,
        total_metros_dtf: order.total_metros_dtf,
        total_metros_vinil: order.total_metros_vinil,
        created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
        cliente: order.clientes?.nome
      }));

      const totalValue = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + order.valor_total, 0);
      const totalMetros = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros || 0), 0);
      const totalMetrosDTF = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_dtf || 0), 0);
      const totalMetrosVinil = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_vinil || 0), 0);

      return {
        orders: formattedOrders,
        summary: {
          clientName: targetClient.nome,
          totalOrders: orders.length,
          totalValue: totalValue,
          totalMetros: totalMetros,
          totalMetrosDTF: totalMetrosDTF,
          totalMetrosVinil: totalMetrosVinil,
          foundMultipleClients: false
        },
        message: `✅ Encontrei **${orders.length} pedido(s)** para o cliente: **${targetClient.nome}**\n\n💰 Valor total: **R$ ${totalValue.toFixed(2)}**\n📏 Total de Metros: **${totalMetros.toFixed(2)} ML** (🖨️ ${totalMetrosDTF.toFixed(2)}m DTF | ✂️ ${totalMetrosVinil.toFixed(2)}m Vinil)`
      };

    } catch (orderError: any) {
      console.error("❌ [get_client_orders] Erro ao buscar pedidos do cliente:", orderError);
      throw new Error(orderError.message);
    }
  }

  if (name === "get_client_details") {
    const { clientName } = args;
    console.log(`🔍 [get_client_details] Buscando detalhes para cliente: "${clientName}"`);

    const foundClients = await findClientWithMultipleStrategies(clientName);

    if (!foundClients || foundClients.length === 0) {
      console.log(`❌ [get_client_details] Nenhum cliente encontrado para: "${clientName}"`);

      try {
        const token = await getValidToken();
        if (token) {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=nome&limit=10`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const allClients = await response.json();
            const clientList = (allClients as ClientName[]).map(c => c.nome).join(', ');
            throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}".\n\n📋 Alguns clientes disponíveis:\n${clientList}`);
          }
        }
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}".`);
      } catch (error: any) {
        console.error(`❌ [get_client_details] Erro ao buscar lista de clientes:`, error);
        throw new Error(`❌ Não encontrei nenhum cliente com o nome "${clientName}". Verifique se o nome está correto.`);
      }
    }

    console.log(`✅ [get_client_details] Cliente(s) encontrado(s):`, foundClients.map((c: any) => c.nome));

    const clientId = (foundClients as any[])[0].id;

    try {
      const token = await getValidToken();
      if (!token) throw new Error("Token inválido");

      const response = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&id=eq.${clientId}&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pgrst.object+json' // Request single object
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP: ${response.status} ${errorText}`);
      }

      const client = await response.json();

      let message = `👤 **Detalhes do cliente: ${client.nome}**`;

      if (foundClients.length > 1) {
        const otherClients = foundClients.slice(1).map((c: any) => c.nome).join(', ');
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
    } catch (error: any) {
      console.error("❌ [get_client_details] Erro ao buscar detalhes completos do cliente:", error);
      throw new Error(error.message);
    }
  }

  if (name === "get_order_details") {
    const { orderNumber } = args;

    const fullOrderId = await findOrderByNumber(orderNumber);

    if (!fullOrderId) {
      throw new Error(`❌ Pedido #${orderNumber} não encontrado. Por favor, verifique o número do pedido.`);
    }

    try {
      const orderData = await fetchCompleteOrderData(fullOrderId);

      const formattedItems = (orderData as any).pedido_items.map((item: any) => ({
        nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        total: item.quantidade * item.preco_unitario,
        observacao: item.observacao || ''
      }));

      const formattedServices = (orderData as any).pedido_servicos.map((service: any) => ({
        nome: service.nome,
        quantidade: service.quantidade,
        valor_unitario: service.valor_unitario,
        total: service.quantidade * service.valor_unitario
      }));

      return {
        message: `📋 **Detalhes do pedido #${(orderData as any).order_number}**`,
        order: {
          order_number: (orderData as any).order_number,
          cliente: (orderData as any).clientes?.nome || 'Cliente não encontrado',
          status: (orderData as any).status,
          valor_total: (orderData as any).valor_total,
          total_metros: (orderData as any).total_metros,
          total_metros_dtf: (orderData as any).total_metros_dtf,
          total_metros_vinil: (orderData as any).total_metros_vinil,
          data_criacao: new Date((orderData as any).created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
          observacoes: (orderData as any).observacoes || 'Nenhuma observação',
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

    try {
      const token = await getValidToken();
      if (!token) throw new Error("Token inválido");

      const queryParams = new URLSearchParams();
      queryParams.append('select', 'id,order_number,status,valor_total,total_metros,total_metros_dtf,total_metros_vinil,created_at,clientes(nome)');

      if (statuses && statuses.length > 0) {
        const statusList = statuses.map(s => `"${s}"`).join(',');
        queryParams.append('status', `in.(${statusList})`);
      }

      if (exclude_statuses && exclude_statuses.length > 0) {
        const statusList = exclude_statuses.map(s => `"${s}"`).join(',');
        queryParams.append('status', `not.in.(${statusList})`);
      }

      queryParams.append('order', 'created_at.desc');

      if (!includeTotalCount && limit && limit > 0) {
        queryParams.append('limit', limit.toString());
      }

      const headers: HeadersInit = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (includeTotalCount) {
        headers['Prefer'] = 'count=exact';
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?${queryParams.toString()}`, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na requisição: ${response.status} ${errorText}`);
      }

      const orders = await response.json();

      let count = orders.length;
      const contentRange = response.headers.get('Content-Range');
      if (contentRange && contentRange.includes('/')) {
        const total = contentRange.split('/')[1];
        if (total !== '*') {
          count = parseInt(total, 10);
        }
      }

      const totalCountMessage = includeTotalCount ? ` (Total de ${count} pedidos encontrados)` : '';

      if (!orders || orders.length === 0) {
        return { message: `✅ Nenhum pedido encontrado com os filtros especificados.${totalCountMessage}` };
      }

      // FIX 9: Casting para OrderWithClient[]
      const formattedOrders = (orders as unknown as OrderWithClient[]).map((order, index) => ({
        index: index + 1,
        order_number: order.order_number,
        status: order.status,
        valor_total: order.valor_total,
        total_metros: order.total_metros,
        total_metros_dtf: order.total_metros_dtf,
        total_metros_vinil: order.total_metros_vinil,
        created_at: new Date(order.created_at).toLocaleDateString('pt-BR', { timeZone: TIME_ZONE }),
        cliente: order.clientes?.nome
      }));

      // FIX 10, 11: Casting para OrderWithClient[]
      const totalValue = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + order.valor_total, 0);
      const totalMetros = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros || 0), 0);
      const totalMetrosDTF = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_dtf || 0), 0);
      const totalMetrosVinil = (orders as unknown as OrderWithClient[]).reduce((sum, order) => sum + (order.total_metros_vinil || 0), 0);

      return {
        orders: formattedOrders,
        summary: {
          count: orders.length,
          totalValue: totalValue,
          totalMetros: totalMetros,
          totalMatchingOrders: count // Retorna a contagem total de correspondências
        },
        message: `📊 Encontrados **${orders.length} pedidos** com os filtros especificados.${totalCountMessage}`
      };
    } catch (error: any) {
      console.error("Erro ao buscar pedidos por status:", error);
      throw new Error(`Erro ao buscar pedidos por status: ${error.message}`);
    }
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

      const token = await getValidToken();
      if (!token) throw new Error("Token inválido");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch current status to record in history
      const responseStatus = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=status&id=eq.${fullOrderId}`, {
        method: 'GET',
        headers: { ...headers, 'Accept': 'application/vnd.pgrst.object+json' }
      });

      if (!responseStatus.ok) {
        const errorText = await responseStatus.text();
        console.error("❌ [update_order_status] Erro ao buscar status atual do pedido:", errorText);
        throw new Error(`❌ Erro ao buscar status atual do pedido #${orderNumber}: ${responseStatus.status}.`);
      }

      const currentOrder = await responseStatus.json();
      const statusAnterior = currentOrder?.status || 'desconhecido';

      // Update status
      const responseUpdate = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?id=eq.${fullOrderId}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!responseUpdate.ok) {
        const errorText = await responseUpdate.text();
        console.error("❌ [update_order_status] Erro ao atualizar:", errorText);
        throw new Error(`❌ Erro ao atualizar status do pedido #${orderNumber} para "${newStatus}": ${responseUpdate.status}.`);
      }

      // Insert into status history if status changed or observation provided
      if (newStatus !== statusAnterior || observacao) {
        // Get user ID (optional, might fail if session issue, but we try)
        let userId = null;
        try {
          const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: headers
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            userId = userData.id;
          }
        } catch (e) { console.warn('Could not get user ID for history'); }

        const responseHistory = await fetch(`${SUPABASE_URL}/rest/v1/pedido_status_history`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            pedido_id: fullOrderId,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao || null,
            user_id: userId
          })
        });

        if (!responseHistory.ok) {
          console.warn('⚠️ [update_order_status] Erro ao salvar histórico de status:', await responseHistory.text());
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

      // Buscar informações da empresa para o PDF
      const companyInfo = await getCompanyInfo();

      // Ação padrão para a IA é 'save' (download)
      await generateOrderPDF(orderData as any, 'save', undefined, companyInfo);

      console.log(`✅ [generate_order_pdf] PDF gerado com sucesso!`);

      return {
        message: `✅ PDF do pedido #${orderNumber} gerado com sucesso! 📄\n\nO arquivo foi baixado automaticamente para seu dispositivo.`,
        pdf: {
          orderNumber: orderNumber,
          clientName: (orderData as any).clientes?.nome || 'Cliente não encontrado',
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
        // Buscar informações da empresa para o PDF (uma única vez por batch se possível, mas aqui por item para segurança)
        const companyInfo = await getCompanyInfo();

        // Ação padrão para a IA é 'save' (download)
        await generateOrderPDF(orderData as any, 'save', undefined, companyInfo);

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
      message: `📊 **Geração de PDFs concluída:** ${successCount} sucesso(s), ${errorCount} erro(s)}\n\n${results.length > 0 ? `✅ **Sucessos:**\n${results.join('\n')}\n\n` : ''}${errors.length > 0 ? `❌ **Erros:**\n${errors.join('\n')}` : ''}`,
      summary: {
        successCount,
        errorCount,
        results,
        errors,
        timestamp: new Date().toLocaleString('pt-BR', { timeZone: TIME_ZONE })
      }
    };
  }

  if (name === "calculate_dtf_packing") {
    let { calculation_mode, imageWidth, imageHeight, quantity, rollWidth = 58, separation = 0.5, margin = 1.0 } = args;

    try {
      // 1. Garantir que as dimensões são números válidos e maiores que zero
      imageWidth = Math.abs(parseFloat(imageWidth as any));
      imageHeight = Math.abs(parseFloat(imageHeight as any));
      const usableWidth = rollWidth - (margin * 2);

      if (imageWidth > usableWidth && imageHeight > usableWidth) {
        throw new Error(`❌ Imagem muito larga! As dimensões (${imageWidth}x${imageHeight}cm) excedem a largura útil do rolo de ${usableWidth}cm.`);
      }

      // 2. Tentar as duas orientações para ver qual cabe mais na largura
      const orient1_imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / (imageWidth + separation))); // Added Math.max(1) to always fit at least one if it fits width

      // Orientação Rotacionada
      const orient2_imagesPerRow = Math.max(1, Math.floor((usableWidth + separation) / (imageHeight + separation)));

      let finalImagesPerRow = orient1_imagesPerRow;
      let finalImgH = imageHeight;
      let finalImgW = imageWidth;
      let bestOrientation = 'original';

      // Verificar rotação apenas se a imagem rodada couber no papel
      // Se width > usableWidth, nem tenta. Mas já checamos isso acima para ambos.
      // O que precisamos ver é: qual rende mais por METRO (menor altura vertical gasta por linha) ?
      // Per row A vs Per row B.

      // Logic Simplification:
      // Option A (Original): Width used: imageWidth. Height used: imageHeight.
      // Option B (Rotated): Width used: imageHeight. Height used: imageWidth.

      // Per Row A: floor(usable / W_A)
      // Per Row B: floor(usable / W_B)

      // Total Density A = PerRowA / H_A
      // Total Density B = PerRowB / H_B

      const densityA = orient1_imagesPerRow / (imageHeight + separation);
      const densityB = orient2_imagesPerRow / (imageWidth + separation); // Rotated height is Width

      if (densityB > densityA) {
        if (imageHeight <= usableWidth) { // Can only rotate if height fits in width
          finalImagesPerRow = orient2_imagesPerRow;
          finalImgH = imageWidth;
          finalImgW = imageHeight;
          bestOrientation = 'rotated';
          console.log(`🔄 [calculate_dtf_packing] Rotacionando logo para melhor encaixe: ${finalImgW}x${finalImgH}`);
        }
      }

      if (finalImagesPerRow <= 0) {
        throw new Error(`❌ A logo é maior que a largura útil (${usableWidth}cm).`);
      }

      let totalMeters = 0;
      let totalQuantity = 0;

      // 3. SELECTION MODE based on 'calculation_mode' parameter (or inference fallback)
      // If user didn't supply mode (legacy/mistake), try to infer from quantity magnitude?
      // No, let's trust the input or default to meters_for_quantity.

      // If mode is 'quantity_in_meters', input 'quantity' IS the meterage.
      if (calculation_mode === 'quantity_in_meters') {
        const requestedMeters = quantity;
        const availableHeightCm = (requestedMeters * 100);
        // Rows fitting in this height
        const rows = Math.floor(availableHeightCm / (finalImgH + separation));
        totalQuantity = Math.max(0, rows * finalImagesPerRow);
        totalMeters = requestedMeters;
      } else {
        // Default: 'meters_for_quantity'
        const requestedQuantity = quantity;
        totalQuantity = requestedQuantity;
        const rowsNeeded = Math.ceil(requestedQuantity / finalImagesPerRow);
        const totalHeightCm = (rowsNeeded * finalImgH) + ((rowsNeeded - 1) * separation);
        totalMeters = Math.max(0.1, totalHeightCm / 100);
      }

      const efficiency = ((finalImagesPerRow * finalImgW) / usableWidth) * 100;
      const imagesPerMeter = Math.floor((100 + separation) / (finalImgH + separation)) * finalImagesPerRow;

      const message = calculation_mode === 'quantity_in_meters'
        ? `🔥 **Resultado:** Em **${totalMeters}m** lineares cabem aproximadamente **${totalQuantity}** unidades!\n\n` +
        `ℹ️ *Detalhes: ${finalImagesPerRow} por linha • ${Math.floor(imagesPerMeter)} un/m*`
        : `🔥 **Resultado:** Para **${totalQuantity}** unidades, você vai precisar de **${totalMeters.toFixed(2)}m** lineares.\n\n` +
        `ℹ️ *Detalhes: ${finalImagesPerRow} por linha • Aproveitamento ${efficiency.toFixed(1)}%*`;

      return {
        type: 'dtf_calculation',
        data: {
          imageWidth,
          imageHeight,
          quantity: totalQuantity,
          rollWidth,
          results: {
            imagesPerRow: finalImagesPerRow,
            totalMeters: parseFloat(totalMeters.toFixed(2)),
            imagesPerMeter: Math.floor(imagesPerMeter),
            efficiency: Math.round(efficiency),
            bestOrientation
          }
        },
        message
      };
    } catch (error: any) {
      console.error("❌ Erro no cálculo de packing:", error);
      throw new Error(error.message || "Erro ao calcular aproveitamento DTF.");
    }
  }

  console.error(`❌ [callOpenAIFunction] Função desconhecida: ${name}`);
  throw new Error(`❌ Função desconhecida: ${name}`);
};