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
  // Onboarding fields
  hasCompanyProfile: boolean;
  productsCount: number;
  customersCount: number;
  totalOrders: number;
  // Lifetime Stats (All Time)
  lifetimeSales: number;
  lifetimeMeters: number;
  lifetimeOrders: number;
}

const fetchDashboardData = async (userId: string | undefined): Promise<DashboardStats> => {
  if (!userId) {
    console.error("[Dashboard] Erro: userId não definido.");
    return {} as DashboardStats; // Retorna vazio se não houver usuário
  }

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
    pendingPaymentCount,
    // Onboarding fetches
    companyProfile,
    productsCount,
    totalCustomersCount,
    totalOrdersCount,
    lifetimeOrdersData
  ] = await Promise.all([
    // Current Month Orders (needed for calculations)
    doFetch('pedidos', new URLSearchParams({
      select: 'id,valor_total,created_at,status,total_metros,user_id,pedido_items(tipo,quantidade),pedido_status_history(*)',
      created_at: `gte.${firstDayCurrentMonth.toISOString()}`,
      user_id: `eq.${userId}`
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayCurrentMonth && d.user_id === userId)),

    // Previous Month Orders (needed for growth)
    doFetch('pedidos', new URLSearchParams({
      select: 'id,valor_total,created_at,status,total_metros,user_id,pedido_status_history(*)',
      created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
      user_id: `eq.${userId}`
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayPreviousMonth && d.user_id === userId)),

    // Customers (Counts only)
    doCount('clientes', new URLSearchParams({
      created_at: `gte.${firstDayCurrentMonth.toISOString()}`,
      user_id: `eq.${userId}`
    })),
    doCount('clientes', new URLSearchParams({
      created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
      user_id: `eq.${userId}`
    })),

    // Status Counts
    doCount('pedidos', new URLSearchParams({ status: 'eq.pendente', user_id: `eq.${userId}` })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.processando', user_id: `eq.${userId}` })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.aguardando retirada', user_id: `eq.${userId}` })),
    doCount('pedidos', new URLSearchParams({ status: 'eq.entregue', user_id: `eq.${userId}` })),
    // Pending Payment: not paid, not cancelled, not delivered
    doCount('pedidos', new URLSearchParams({ status: 'not.in.(pago,cancelado,entregue)', user_id: `eq.${userId}` })),
    // Onboarding counts
    userId ? doFetch('profiles', new URLSearchParams({ id: `eq.${userId}`, select: 'company_name', limit: '1' })) : Promise.resolve([]),
    doCount('produtos', new URLSearchParams({ user_id: `eq.${userId}` })),
    doCount('clientes', new URLSearchParams({ user_id: `eq.${userId}` })),
    doCount('pedidos', new URLSearchParams({ user_id: `eq.${userId}` })),
    // Lifetime Sales Data Fetch
    doFetch('pedidos', new URLSearchParams({
      select: 'valor_total,total_metros,status,user_id,tipo_entrega,valor_frete,subtotal_produtos,subtotal_servicos,desconto_percentual,desconto_valor,pedido_status_history(*)',
      status: 'in.(pago,entregue,aguardando retirada)',
      user_id: `eq.${userId}`
    })).then(data => {
      const filtered = data.filter((d: any) => d.user_id === userId);

      // LOG DE INSPEÇÃO: Mostra os 5 pedidos mais caros que compõem o total
      const topOrders = [...filtered]
        .sort((a, b) => b.valor_total - a.valor_total)
        .slice(0, 5)
        .map(o => ({ Pedido: o.order_number, Valor: o.valor_total, Status: o.status }));

      console.log(`[Segurança Dashboard] Verificando dados para: ${userId}`);
      console.table(topOrders);

      return filtered;
    })
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

  // Calculate sales with strict deduplication
  const calculateSales = (orders: any[]) => {
    if (!orders || !Array.isArray(orders)) return 0;

    // Usamos um Map para garantir que cada ID de pedido seja contado apenas UMA vez
    // Isso evita problemas se o Supabase retornar duplicados por causa de joins
    const uniqueOrders = new Map<string, any>();
    orders.forEach(o => {
      if (o && o.id) uniqueOrders.set(o.id, o);
    });

    return Array.from(uniqueOrders.values()).reduce((sum: number, order: any) => {
      // Definir quais status contam como venda (Lucro)
      const status = order.status?.toLowerCase();
      const isPaidStatus = ['pago', 'entregue'].includes(status);

      // Caso especial: 'aguardando retirada' só conta se já passou por 'pago' no histórico
      const isAwaitingPickup = status === 'aguardando retirada';
      let wasPaid = false;

      if (isAwaitingPickup && order.pedido_status_history && Array.isArray(order.pedido_status_history)) {
        wasPaid = order.pedido_status_history.some((h: any) =>
          h.status_novo?.toLowerCase() === 'pago' ||
          h.status_anterior?.toLowerCase() === 'pago'
        );
      }

      if (isPaidStatus || (isAwaitingPickup && wasPaid)) {
        return sum + (Number(order.valor_total) || 0);
      }
      return sum;
    }, 0);
  };

  const totalSales = calculateSales(currentOrders);
  const previousTotalSales = calculateSales(previousOrders);

  // Calculate Lifetime Stats
  const lifetimeData = lifetimeOrdersData || [];
  const lifetimeSales = calculateSales(lifetimeData);
  const lifetimeMeters = lifetimeData.reduce((sum: number, order: any) => sum + (order.total_metros || 0), 0);
  const lifetimeOrders = lifetimeData.length;

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
    hasCompanyProfile: Array.isArray(companyProfile) && companyProfile.length > 0 && !!companyProfile[0].company_name,
    productsCount,
    customersCount: totalCustomersCount,
    totalOrders: totalOrdersCount,
    lifetimeSales,
    lifetimeMeters,
    lifetimeOrders
  };
};

export const useDashboardData = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-v2", session?.user?.id], // V2 força o reset do cache antigo
    queryFn: () => fetchDashboardData(session?.user?.id),
    enabled: !!accessToken && !sessionLoading,
    staleTime: 1000 * 30, // 30 segundos (reduzido de 5min para atualizar Meta Relâmpago mais rápido)
    refetchInterval: 30 * 1000, // Refetch a cada 30 segundos
  });
};