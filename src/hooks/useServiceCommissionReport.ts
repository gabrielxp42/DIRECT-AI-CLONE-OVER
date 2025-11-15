import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { PedidoStatus } from "@/types/pedido";

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
  order_date: string;
  client_name: string;
}

export interface CommissionReport {
  items: CommissionServiceItem[];
  detailedItems: DetailedServiceItem[]; // Novo campo para detalhes
  totalCommissionRevenue: number;
  totalServicesCount: number;
}

const fetchCommissionReport = async (
  supabase: any, 
  startDate: string, 
  endDate: string,
  excludedNames: string[],
  requiredStatus: PedidoStatus[] | 'all'
): Promise<CommissionReport> => {
  
  // 1. Buscar todos os serviços e os pedidos relacionados no período
  let query = supabase
    .from('pedido_servicos')
    .select(`
      id,
      nome,
      quantidade,
      valor_unitario,
      pedido_id,
      pedidos!inner (
        order_number,
        created_at,
        status,
        clientes (nome)
      )
    `)
    .gte('pedidos.created_at', startDate)
    .lte('pedidos.created_at', endDate);

  // Aplicar filtro de status se não for 'all'
  if (requiredStatus !== 'all' && requiredStatus.length > 0) {
    query = query.in('pedidos.status', requiredStatus);
  }

  const { data: servicesData, error } = await query;

  if (error) throw error;

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
  const { supabase } = useSession();

  const startISO = startDate?.toISOString() || '';
  const endISO = endDate?.toISOString() || '';
  const statusKey = Array.isArray(requiredStatus) ? requiredStatus.join(',') : requiredStatus;

  return useQuery<CommissionReport>({
    queryKey: ["service-commission-report", startISO, endISO, statusKey, excludedNames],
    queryFn: () => fetchCommissionReport(supabase, startISO, endISO, excludedNames, requiredStatus),
    enabled: !!supabase && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
};