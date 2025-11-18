import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";

export interface DashboardStats {
  totalSales: number;
  newCustomers: number;
  activeOrders: number;
  averageTicket: number;
  salesGrowth: number;
  customersGrowth: number;
  ordersGrowth: number;
  ticketGrowth: number;
  pendingOrdersCount: number; // Novo
  processingOrdersCount: number; // Novo
  pendingPaymentOrdersCount: number; // Novo
  awaitingPickupOrdersCount: number; // Novo
  deliveredOrdersCount: number; // Novo
  totalMeters: number; // NOVO
  metersGrowth: number; // NOVO
}

// Tipo de retorno da função RPC get_total_meters_by_period
interface MetersReportResult {
  total_meters: number;
  total_orders: number;
}

export const useDashboardData = () => {
  const { supabase } = useSession();

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase client is not available");

      // Get current month data
      const currentMonth = new Date();
      const firstDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDayCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Get previous month data for comparison
      const firstDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const lastDayPreviousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

      // Fetch current month orders
      const { data: currentOrders, error: currentOrdersError } = await supabase
        .from("pedidos")
        .select("valor_total, created_at, status")
        .gte("created_at", firstDayCurrentMonth.toISOString())
        .lte("created_at", lastDayCurrentMonth.toISOString());

      if (currentOrdersError) throw new Error(currentOrdersError.message);

      // Fetch previous month orders
      const { data: previousOrders, error: previousOrdersError } = await supabase
        .from("pedidos")
        .select("valor_total, created_at")
        .gte("created_at", firstDayPreviousMonth.toISOString())
        .lte("created_at", lastDayPreviousMonth.toISOString());

      if (previousOrdersError) throw new Error(previousOrdersError.message);

      // Fetch current month customers
      const { data: currentCustomers, error: currentCustomersError } = await supabase
        .from("clientes")
        .select("id, created_at")
        .gte("created_at", firstDayCurrentMonth.toISOString());

      if (currentCustomersError) throw new Error(currentCustomersError.message);

      // Fetch previous month customers
      const { data: previousCustomers, error: previousCustomersError } = await supabase
        .from("clientes")
        .select("id, created_at")
        .gte("created_at", firstDayPreviousMonth.toISOString())
        .lte("created_at", lastDayPreviousMonth.toISOString());

      if (previousCustomersError) throw new Error(previousCustomersError.message);

      // Fetch all orders for status counts (explicitly selecting columns)
      const { data: allOrders, error: allOrdersError } = await supabase
        .from("pedidos")
        .select("id, status"); // Seleção explícita

      if (allOrdersError) throw new Error(allOrdersError.message);
      
      // --- NOVO: Buscar total de metros separadamente via RPC ---
      const { data: currentMetersData, error: currentMetersError } = await supabase.rpc('get_total_meters_by_period', {
        p_start_date: firstDayCurrentMonth.toISOString(),
        p_end_date: lastDayCurrentMonth.toISOString()
      }).single();
      
      if (currentMetersError) {
        console.error("Erro ao buscar metros atuais:", currentMetersError);
        // Lançar o erro para que o useQuery falhe e o erro seja exibido
        throw new Error(`Falha na RPC de metros atuais: ${currentMetersError.message}`);
      }

      const { data: previousMetersData, error: previousMetersError } = await supabase.rpc('get_total_meters_by_period', {
        p_start_date: firstDayPreviousMonth.toISOString(),
        p_end_date: lastDayPreviousMonth.toISOString()
      }).single();
      
      if (previousMetersError) {
        console.error("Erro ao buscar metros anteriores:", previousMetersError);
        // Lançar o erro para que o useQuery falhe e o erro seja exibido
        throw new Error(`Falha na RPC de metros anteriores: ${previousMetersError.message}`);
      }
      
      const totalMeters = (currentMetersData as MetersReportResult)?.total_meters || 0;
      const previousTotalMeters = (previousMetersData as MetersReportResult)?.total_meters || 0;
      // ---------------------------------------------------------

      // Calculate current month stats
      const totalSales = currentOrders?.reduce((sum, order) => sum + order.valor_total, 0) || 0;
      const newCustomers = currentCustomers?.length || 0;
      const activeOrdersCount = allOrders?.filter(order => order.status === 'pendente').length || 0; // Usar allOrders para 'pendente'
      const averageTicket = currentOrders?.length ? totalSales / currentOrders.length : 0;

      // Calculate previous month stats for growth comparison
      const previousTotalSales = previousOrders?.reduce((sum, order) => sum + order.valor_total, 0) || 0;
      const previousNewCustomers = previousCustomers?.length || 0;
      const previousAverageTicket = previousOrders?.length ? previousTotalSales / previousOrders.length : 0;

      // Calculate growth percentages
      const salesGrowth = previousTotalSales > 0 ? ((totalSales - previousTotalSales) / previousTotalSales) * 100 : 0;
      const metersGrowth = previousTotalMeters > 0 ? ((totalMeters - previousTotalMeters) / previousTotalMeters) * 100 : 0; // USANDO RPC
      const customersGrowth = previousNewCustomers > 0 ? ((newCustomers - previousNewCustomers) / previousNewCustomers) * 100 : 0;
      const ticketGrowth = previousAverageTicket > 0 ? ((averageTicket - previousAverageTicket) / previousAverageTicket) * 100 : 0;

      // Calculate specific status counts
      const pendingOrdersCount = allOrders?.filter(order => order.status === 'pendente').length || 0;
      const processingOrdersCount = allOrders?.filter(order => order.status === 'processando').length || 0;
      const pendingPaymentOrdersCount = allOrders?.filter(order => 
        order.status !== 'pago' && order.status !== 'cancelado' && order.status !== 'entregue'
      ).length || 0;
      const awaitingPickupOrdersCount = allOrders?.filter(order => order.status === 'aguardando retirada').length || 0;
      const deliveredOrdersCount = allOrders?.filter(order => order.status === 'entregue').length || 0;


      return {
        totalSales,
        totalMeters, // NOVO
        metersGrowth, // NOVO
        newCustomers,
        activeOrders: activeOrdersCount,
        averageTicket,
        salesGrowth,
        customersGrowth,
        ordersGrowth: 0, // We don't have historical active orders data
        ticketGrowth,
        pendingOrdersCount,
        processingOrdersCount,
        pendingPaymentOrdersCount,
        awaitingPickupOrdersCount,
        deliveredOrdersCount,
      };
    },
    enabled: !!supabase && typeof supabase.from === 'function', // Adicionado verificação de função
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};