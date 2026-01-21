import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { PedidoStatus } from "@/types/pedido";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from '@/utils/tokenGuard';

export interface CommissionServiceItem {
  service_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

export interface DetailedServiceItem {
  id: string;
  service_name: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  order_number: number;
  order_status: PedidoStatus;
  order_date: string; // Data de criação ISO
  order_date_formatted: string; // Data formatada para exibição
  client_name: string;
}

export interface CommissionReport {
  items: CommissionServiceItem[];
  detailedItems: DetailedServiceItem[]; // Novo campo para detalhes
  totalCommissionRevenue: number;
  totalServicesCount: number;
}

const fetchCommissionReport = async (
  startDate: string,
  endDate: string,
  excludedNames: string[],
  requiredStatus: PedidoStatus[] | 'all',
  userId?: string
): Promise<CommissionReport> => {

  const accessToken = await getValidToken();
  if (!accessToken) {
    throw new Error("Sem token de acesso para fetch.");
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Buscar todos os serviços e os pedidos relacionados no período
  // PostgREST syntax para join: select=*,pedidos!inner(order_number,created_at,status,clientes(nome))
  // Para filtros em tabelas relacionadas, usar a sintaxe: tabela_relacionada.campo=operador.valor
  let queryParams = new URLSearchParams();
  const selectParam = 'id,nome,quantidade,valor_unitario,pedido_id,pedidos!inner(order_number,created_at,status,clientes(nome))';
  queryParams.append('select', selectParam);

  // Filtros na tabela relacionada pedidos
  queryParams.append('pedidos.created_at', `gte.${startDate}`);
  queryParams.append('pedidos.created_at', `lte.${endDate}`);

  if (userId) {
    queryParams.append('pedidos.user_id', `eq.${userId}`);
  }

  // Aplicar filtro de status se não for 'all'
  if (requiredStatus !== 'all' && requiredStatus.length > 0) {
    // PostgREST usa in() para arrays: pedidos.status=in.(status1,status2)
    queryParams.append('pedidos.status', `in.(${requiredStatus.join(',')})`);
  }

  const url = `${SUPABASE_URL}/rest/v1/pedido_servicos?${queryParams.toString()}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro ao buscar serviços: ${response.statusText} - ${errorText}`);
  }

  const servicesData = await response.json();

  // 2. Filtrar serviços excluídos e agrupar/somar no cliente
  const filteredServices = servicesData.filter(service =>
    !excludedNames.some(excludedName => service.nome.toLowerCase().includes(excludedName.toLowerCase()))
  );

  const groupedServices = new Map<string, { total_quantity: number, total_revenue: number, order_ids: Set<string> }>();
  const detailedItems: DetailedServiceItem[] = [];

  filteredServices.forEach(service => {
    const name = service.nome;
    const quantity = service.quantidade;
    const revenue = service.quantidade * service.valor_unitario;
    const pedidoId = service.pedido_id;
    const order = service.pedidos;

    // 2a. Construir a lista detalhada
    detailedItems.push({
      id: service.id,
      service_name: name,
      quantity: quantity,
      unit_value: service.valor_unitario,
      total_value: revenue,
      order_number: order.order_number,
      order_status: order.status as PedidoStatus,
      order_date: order.created_at,
      order_date_formatted: format(new Date(order.created_at), 'dd/MM/yy', { locale: ptBR }), // Adicionando data formatada
      client_name: order.clientes?.nome || 'N/A',
    });

    // 2b. Agrupar para o resumo
    if (!groupedServices.has(name)) {
      groupedServices.set(name, {
        total_quantity: 0,
        total_revenue: 0,
        order_ids: new Set<string>(),
      });
    }

    const group = groupedServices.get(name)!;
    group.total_quantity += quantity;
    group.total_revenue += revenue;
    group.order_ids.add(pedidoId);
  });

  // 3. Formatar o resultado resumido
  const items: CommissionServiceItem[] = Array.from(groupedServices.entries())
    .map(([service_name, data]) => ({
      service_name,
      total_quantity: data.total_quantity,
      total_revenue: data.total_revenue,
      order_count: data.order_ids.size,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  const totalCommissionRevenue = items.reduce((sum, item) => sum + item.total_revenue, 0);
  const totalServicesCount = items.reduce((sum, item) => sum + item.total_quantity, 0);

  return {
    items,
    detailedItems,
    totalCommissionRevenue,
    totalServicesCount,
  };
};

export const useServiceCommissionReport = (
  startDate: Date | null,
  endDate: Date | null,
  requiredStatus: PedidoStatus[] | 'all', // Novo parâmetro
  excludedNames: string[] = ['Sedex']
) => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;

  const startISO = startDate?.toISOString() || '';
  const endISO = endDate?.toISOString() || '';
  const statusKey = Array.isArray(requiredStatus) ? requiredStatus.join(',') : requiredStatus;

  // Validação crítica: só executar se sessão não estiver carregando E token estiver disponível
  const isEnabled = !sessionLoading && !!accessToken && !!startDate && !!endDate;

  return useQuery<CommissionReport>({
    queryKey: ["service-commission-report", startISO, endISO, statusKey, excludedNames, session?.user?.id],
    queryFn: () => {
      return fetchCommissionReport(startISO, endISO, excludedNames, requiredStatus, session?.user?.id);
    },
    enabled: isEnabled, // Aguardar sessão carregar antes de executar
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
  });
};