import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Pedido } from "@/types/pedido";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from '@/utils/tokenGuard';

interface ClientMetrics {
  totalSpent: number;
  totalOrdersCount: number;
  totalMeters: number; // NOVO: Total de metros lineares
  lastOrderDate: string | null;
  lastOrders: Pedido[];
}

const fetchClientMetrics = async (clientId: string): Promise<ClientMetrics> => {
  const accessToken = await getValidToken();
  if (!accessToken) {
    throw new Error("Sem token de acesso para fetch.");
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Buscar todos os pedidos do cliente para calcular métricas
  const url = `${SUPABASE_URL}/rest/v1/pedidos?select=valor_total,created_at,status,order_number,id,cliente_id,total_metros&cliente_id=eq.${clientId}&order=created_at.desc`;

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`Erro ao buscar pedidos do cliente: ${response.statusText}`);
  }

  const allOrders = await response.json();

  const totalSpent = allOrders?.reduce((sum, order) => sum + order.valor_total, 0) || 0;
  const totalOrdersCount = allOrders?.length || 0;
  const totalMeters = allOrders?.reduce((sum, order) => sum + (order.total_metros || 0), 0) || 0; // Cálculo do total de metros
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
    total_metros: order.total_metros || 0, // Usando o valor real
  })) as Pedido[] || [];

  return {
    totalSpent,
    totalOrdersCount,
    totalMeters, // Retornando o novo campo
    lastOrderDate,
    lastOrders,
  };
};

export const useClientMetrics = (clientId: string | null) => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;

  // Validação crítica: só executar se sessão não estiver carregando E token estiver disponível
  const isEnabled = !sessionLoading && !!accessToken && !!clientId;

  return useQuery<ClientMetrics>({
    queryKey: ["client-metrics", clientId],
    queryFn: () => {
      if (!clientId) {
        throw new Error("Client ID is missing.");
      }
      return fetchClientMetrics(clientId);
    },
    enabled: isEnabled, // Aguardar sessão carregar antes de executar
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
  });
};