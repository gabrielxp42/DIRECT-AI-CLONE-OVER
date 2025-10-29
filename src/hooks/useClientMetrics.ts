import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Pedido } from "@/types/pedido";

interface ClientMetrics {
  totalSpent: number;
  totalOrdersCount: number;
  lastOrderDate: string | null;
  lastOrders: Pedido[];
}

const fetchClientMetrics = async (supabase: any, clientId: string): Promise<ClientMetrics> => {
  // 1. Buscar todos os pedidos do cliente para calcular métricas
  const { data: allOrders, error: ordersError } = await supabase
    .from('pedidos')
    .select('valor_total, created_at, status, order_number, id, cliente_id')
    .eq('cliente_id', clientId)
    .order('created_at', { ascending: false });

  if (ordersError) throw ordersError;

  const totalSpent = allOrders?.reduce((sum, order) => sum + order.valor_total, 0) || 0;
  const totalOrdersCount = allOrders?.length || 0;
  const lastOrderDate = allOrders?.[0]?.created_at || null;

  // 2. Limitar aos 5 últimos pedidos para exibição
  const lastOrders = allOrders?.slice(0, 5).map(order => ({
    ...order,
    // Adicionar propriedades de relacionamento vazias para satisfazer o tipo Pedido
    clientes: { nome: '', id: order.cliente_id, status: 'ativo' }, 
    pedido_items: [],
    servicos: [],
    subtotal_produtos: 0,
    subtotal_servicos: 0,
    desconto_valor: 0,
    desconto_percentual: 0,
    observacoes: null,
    user_id: '',
  })) as Pedido[] || [];

  return {
    totalSpent,
    totalOrdersCount,
    lastOrderDate,
    lastOrders,
  };
};

export const useClientMetrics = (clientId: string | null) => {
  const { supabase } = useSession();

  return useQuery<ClientMetrics>({
    queryKey: ["client-metrics", clientId],
    queryFn: () => fetchClientMetrics(supabase, clientId!),
    enabled: !!supabase && !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
};