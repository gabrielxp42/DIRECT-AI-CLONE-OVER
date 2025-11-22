import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

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
  metersGrowth: number;
}

const fetchDashboardData = async (accessToken: string): Promise<DashboardStats> => {
  if (!accessToken) {
    throw new Error("Sem token de acesso para fetch.");
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // Helper para fetch
  const doFetch = async (endpoint: string, params: URLSearchParams) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`Fetch error ${endpoint}: ${res.statusText}`);
    return res.json();
  };

  // Get current month data
  const currentMonth = new Date();
  const firstDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get previous month data for comparison
  const firstDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const lastDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

  // Fetch current month orders (incluindo total_metros)
  const currentOrders = await doFetch('pedidos', new URLSearchParams({
    select: 'valor_total,created_at,status,total_metros',
    created_at: `gte.${firstDayCurrentMonth.toISOString()}`,
  })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayCurrentMonth));

  // Fetch previous month orders (incluindo total_metros)
  const previousOrders = await doFetch('pedidos', new URLSearchParams({
    select: 'valor_total,created_at,total_metros',
    created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
  })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayPreviousMonth));

  // Fetch current month customers
  const currentCustomers = await doFetch('clientes', new URLSearchParams({
    select: 'id,created_at',
    created_at: `gte.${firstDayCurrentMonth.toISOString()}`,
  }));

  // Fetch previous month customers
  const previousCustomers = await doFetch('clientes', new URLSearchParams({
    select: 'id,created_at',
    created_at: `gte.${firstDayPreviousMonth.toISOString()}`,
  })).then(data => data.filter((d: any) => new Date(d.created_at) <= lastDayPreviousMonth));

  // Fetch all orders for status counts
  const allOrders = await doFetch('pedidos', new URLSearchParams({
    select: 'id,status'
  }));

  // Calculate total meters (same logic as Reports.tsx)
  const totalMeters = currentOrders.reduce((sum: number, order: any) => sum + (order.total_metros || 0), 0);
  const previousTotalMeters = previousOrders.reduce((sum: number, order: any) => sum + (order.total_metros || 0), 0);

  // Calculate current month stats
  const totalSales = currentOrders?.reduce((sum: number, order: any) => sum + order.valor_total, 0) || 0;
  const newCustomers = currentCustomers?.length || 0;
  const activeOrdersCount = allOrders?.filter((order: any) => order.status === 'pendente').length || 0;
  const averageTicket = currentOrders?.length ? totalSales / currentOrders.length : 0;

  // Calculate previous month stats for growth comparison
  const previousTotalSales = previousOrders?.reduce((sum: number, order: any) => sum + order.valor_total, 0) || 0;
  const previousNewCustomers = previousCustomers?.length || 0;
  const previousAverageTicket = previousOrders?.length ? previousTotalSales / previousOrders.length : 0;

  // Calculate growth percentages
  const salesGrowth = previousTotalSales > 0 ? ((totalSales - previousTotalSales) / previousTotalSales) * 100 : 0;
  const metersGrowth = previousTotalMeters > 0 ? ((totalMeters - previousTotalMeters) / previousTotalMeters) * 100 : 0;
  const customersGrowth = previousNewCustomers > 0 ? ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100 : 0;
  const ticketGrowth = previousAverageTicket > 0 ? ((averageTicket - previousAverageTicket) / previousAverageTicket) * 100 : 0;

  // Calculate specific status counts
  const pendingOrdersCount = allOrders?.filter((order: any) => order.status === 'pendente').length || 0;
  const processingOrdersCount = allOrders?.filter((order: any) => order.status === 'processando').length || 0;
  const pendingPaymentOrdersCount = allOrders?.filter((order: any) =>
    order.status !== 'pago' && order.status !== 'cancelado' && order.status !== 'entregue'
  ).length || 0;
  const awaitingPickupOrdersCount = allOrders?.filter((order: any) => order.status === 'aguardando retirada').length || 0;
  const deliveredOrdersCount = allOrders?.filter((order: any) => order.status === 'entregue').length || 0;

  return {
    totalSales,
    totalMeters,
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
    pendingPaymentOrdersCount,
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
    queryFn: () => fetchDashboardData(accessToken!),
    enabled: isEnabled,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};