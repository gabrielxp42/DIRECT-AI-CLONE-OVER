import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";

export interface CommissionServiceItem {
  service_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

export interface CommissionReport {
  items: CommissionServiceItem[];
  totalCommissionRevenue: number;
  totalServicesCount: number;
}

const fetchCommissionReport = async (
  supabase: any, 
  startDate: string, 
  endDate: string,
  excludedNames: string[]
): Promise<CommissionReport> => {
  
  // --- NOVA LÓGICA: Buscar dados diretamente das tabelas ---
  
  // 1. Buscar todos os serviços e os pedidos relacionados no período
  const { data: servicesData, error } = await supabase
    .from('pedido_servicos')
    .select(`
      nome,
      quantidade,
      valor_unitario,
      pedido_id,
      pedidos!inner (
        created_at
      )
    `)
    .gte('pedidos.created_at', startDate)
    .lte('pedidos.created_at', endDate);

  if (error) throw error;

  // 2. Filtrar serviços excluídos e agrupar/somar no cliente
  const filteredServices = servicesData.filter(service => 
    !excludedNames.some(excludedName => service.nome.toLowerCase().includes(excludedName.toLowerCase()))
  );

  const groupedServices = new Map<string, { total_quantity: number, total_revenue: number, order_ids: Set<string> }>();

  filteredServices.forEach(service => {
    const name = service.nome;
    const quantity = service.quantidade;
    const revenue = service.quantidade * service.valor_unitario;
    const pedidoId = service.pedido_id;

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

  // 3. Formatar o resultado
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
    totalCommissionRevenue,
    totalServicesCount,
  };
};

export const useServiceCommissionReport = (startDate: Date | null, endDate: Date | null, excludedNames: string[] = ['Sedex']) => {
  const { supabase } = useSession();

  const startISO = startDate?.toISOString() || '';
  const endISO = endDate?.toISOString() || '';

  return useQuery<CommissionReport>({
    queryKey: ["service-commission-report", startISO, endISO, excludedNames],
    queryFn: () => fetchCommissionReport(supabase, startISO, endISO, excludedNames),
    enabled: !!supabase && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
};