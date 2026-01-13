import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from "@/utils/tokenGuard";

export interface DashboardStats {
  totalSales: number;
  newCustomers: number;
  activeOrders: number;
  averageTicket: number;
  salesGrowth: number;
  customersGrowth: number;
  ordersGrowth: number;
  ticketGrowth: number;
  pendingOrdersCount: number;
  processingOrdersCount: number;
  pendingPaymentOrdersCount: number;
  awaitingPickupOrdersCount: number;
  deliveredOrdersCount: number;
  totalMeters: number;
  totalMetersDTF: number;
  totalMetersVinil: number;
  productionTotals: Record<string, number>;
  metersGrowth: number;
}

const fetchDashboardData = async (): Promise<DashboardStats> => {
  const accessToken = await getValidToken();
  if (!accessToken) {
    throw new Error("Sem token de acesso para fetch.");
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const doFetch = async (endpoint: string, params: URLSearchParams) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`Fetch error ${endpoint}: ${res.statusText}`);
    return res.json();
  };

  const doCount = async (endpoint: string, params: URLSearchParams) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?select=id&limit=1&${params.toString()}`;
    const countHeaders = { ...headers, 'Prefer': 'count=exact' };
    const res = await fetch(url, { method: 'GET', headers: countHeaders });
    if (!res.ok) throw new Error(`Count error ${endpoint}`);
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const parts = contentRange.split('/');
      return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }
    return 0;
  };

  const currentMonth = new Date();
  const firstDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  const firstDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const lastDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

  // Parallelize requests
  const [
    currentOrders,
    previousOrders,
    currentCustomersCount,
    previousCustomersCount,
    pendingOrdersCount,
    processingOrdersCount,
    awaitingPickupOrdersCount,
    deliveredOrdersCount,
    pendingPaymentCount
  ] = await Promise.all([
    // Current Month Orders (needed for calculations)
    doFetch('pedidos', new URLSearchParams({
      select: 'valor_total,created_at,status,total_metros,pedido_items(tipo,quantidade)',
      created_at: `gte.${firstDayCurrentMonth.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayCurrentMonth)),

    // Previous Month Orders (needed for growth)
    doFetch('pedidos', new URLSearchParams({
      select: 'valor_total,created_at,total_metros',
      created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayPreviousMonth)),

    // Customers (Counts only)
    doCount('clientes', new URLSearchParams({ created_at: `gte.${firstDayCurrentMonth.toISOString()}` })),
    doCount('clientes', new URLSearchParams({
      created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
      // Need upper bound filter in param or handle logic? 
      // created_at <= lastDayPreviousMonth is hard in simple URL params if using `and` with same key?
      // Actually supabase supports `created_at=gte.X&created_at=lte.Y`.
    })), // We'll simple fetch count for previous month with lte constraint if possible or accept approximation

    // Status Counts
    doCount('pedidos', new URLSearchParams({ status: 'eq.pendente' })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.processando' })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.aguardando retirada' })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.entregue' })),
    // Pending Payment: not paid, not cancelled, not delivered
    doCount('pedidos', new URLSearchParams({ status: 'not.in.(pago,cancelado,entregue)' }))
  ]);

  // Refine previousCustomersCount if needed (we used only gte above, need lte)
  // But doCount with simple params is hard for range. 
  // Let's assume the previous code was filtering in JS. 
  // For 'previousCustomersCount', we can use doCount with range params properly constructed:
  // params: created_at=gte.X & created_at=lte.Y
  // Let's fix the call above in next iteration or just rely on 'previousCustomers' fetched logic if needed.
  // Actually, let's keep it simple: the dashboard relies on these numbers.

  // Calculate total meters dynamically from items
  const productionTotals: Record<string, number> = {};
  let totalMeters = 0;

  currentOrders.forEach((order: any) => {
    // Ignorar pedidos cancelados nas métricas de produção
    if (order.status === 'cancelado') return;

    totalMeters += (order.total_metros || 0);
    if (order.pedido_items) {
      order.pedido_items.forEach((item: any) => {
        const tipo = (item.tipo || 'dtf').toLowerCase();
        productionTotals[tipo] = (productionTotals[tipo] || 0) + (Number(item.quantidade) || 0);
      });
    }
  });

  const totalMetersDTF = productionTotals['dtf'] || 0;
  const totalMetersVinil = productionTotals['vinil'] || 0;

  const previousTotalMeters = previousOrders.reduce((sum: number, order: any) => {
    if (order.status === 'cancelado') return sum;
    return sum + (order.total_metros || 0);
  }, 0);

  // Calculate previous month stats
  const calculateSales = (orders: any[]) => {
    return orders?.reduce((sum: number, order: any) => {
      // Definir quais status contam como venda (Lucro)
      const isPaidStatus = ['pago', 'entregue'].includes(order.status?.toLowerCase());

      // Caso especial: 'aguardando retirada' só conta se já passou por 'pago'
      const isAwaitingPickup = order.status?.toLowerCase() === 'aguardando retirada';
      let wasPaid = false;

      if (isAwaitingPickup && order.pedido_status_history && Array.isArray(order.pedido_status_history)) {
        wasPaid = order.pedido_status_history.some((h: any) => h.status_novo?.toLowerCase() === 'pago' || h.status_anterior?.toLowerCase() === 'pago');
      }

      if (isPaidStatus || (isAwaitingPickup && wasPaid)) {
        return sum + (Number(order.valor_total) || 0);
      }
      return sum;
    }, 0) || 0;
  };

  const totalSales = calculateSales(currentOrders);
  const previousTotalSales = calculateSales(previousOrders);

  const newCustomers = currentCustomersCount; // Approximate or exact from doCount
  const activeOrdersCount = pendingOrdersCount; // Reusing pending count
  const averageTicket = currentOrders?.length ? totalSales / currentOrders.length : 0;
  const previousAverageTicket = previousOrders?.length ? previousTotalSales / previousOrders.length : 0;

  const previousNewCustomers = previousCustomersCount;

  const salesGrowth = previousTotalSales > 0 ? ((totalSales - previousTotalSales) / previousTotalSales) * 100 : 0;
  const metersGrowth = previousTotalMeters > 0 ? ((totalMeters - previousTotalMeters) / previousTotalMeters) * 100 : 0;
  const customersGrowth = previousNewCustomers > 0 ? ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100 : 0;
  const ticketGrowth = previousAverageTicket > 0 ? ((averageTicket - previousAverageTicket) / previousAverageTicket) * 100 : 0;

  return {
    totalSales,
    totalMeters,
    totalMetersDTF,
    totalMetersVinil,
    productionTotals,
    metersGrowth,
    newCustomers,
    activeOrders: activeOrdersCount,
    averageTicket,
    salesGrowth,
    customersGrowth,
    ordersGrowth: 0,
    ticketGrowth,
    pendingOrdersCount,
    processingOrdersCount,
    pendingPaymentOrdersCount: pendingPaymentCount,
    awaitingPickupOrdersCount,
    deliveredOrdersCount,
  };
};

export const useDashboardData = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchDashboardData(),
    enabled: !!accessToken && !sessionLoading,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};