import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Cliente } from "@/types/cliente";
import { Pedido } from "@/types/pedido";
import { Produto } from "@/types/produto";

// --- Fetch Clientes ---
const fetchClientes = async (supabase: any, userId: string): Promise<Cliente[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Cliente[];
};

export const useClientes = () => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  return useQuery<Cliente[]>({
    queryKey: ["clientes", userId],
    queryFn: () => fetchClientes(supabase, userId!),
    enabled: !!supabase && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
};

// --- Fetch Produtos ---
const fetchProdutos = async (supabase: any, userId: string): Promise<Produto[]> => {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Produto[];
};

export const useProdutos = () => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  return useQuery<Produto[]>({
    queryKey: ["produtos", userId],
    queryFn: () => fetchProdutos(supabase, userId!),
    enabled: !!supabase && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });
};

// --- Fetch Pedidos (Completo) ---
interface PaginatedPedidosResult {
  pedidos: Pedido[];
  totalCount: number;
}

const fetchPedidos = async (
  supabase: any, 
  userId: string, 
  page: number, 
  limit: number
): Promise<PaginatedPedidosResult> => {
  
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // Consulta ÚNICA e completa para a página atual
  const { data: pedidosData, error: pedidosError, count } = await supabase
    .from('pedidos')
    .select(`
      *,
      clientes (id, nome, telefone, email, endereco),
      pedido_items (*),
      pedido_servicos (*),
      pedido_status_history (*)
    `, { count: 'exact' }) // Solicita a contagem total
    .order('order_number', { ascending: false })
    .range(start, end); // Aplica a paginação

  if (pedidosError) throw pedidosError;

  // Mapear e processar os dados (ordenar histórico e pegar última observação)
  const pedidosCompletos = pedidosData?.map(pedido => {
    // Ordenação do histórico: mais recente primeiro
    const orderedHistory = (pedido.pedido_status_history || []).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Última observação do histórico
    const latestObservation = orderedHistory.length > 0 ? orderedHistory[0].observacao : null;
    
    return {
      ...pedido,
      pedido_items: pedido.pedido_items || [],
      servicos: pedido.pedido_servicos || [],
      status_history: orderedHistory,
      latest_status_observation: latestObservation,
    };
  }) || [];

  return {
    pedidos: pedidosCompletos as Pedido[],
    totalCount: count || 0,
  };
};

export const usePaginatedPedidos = (page: number, limit: number) => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  return useQuery<PaginatedPedidosResult>({
    queryKey: ["pedidos", userId, page, limit],
    queryFn: () => fetchPedidos(supabase, userId!, page, limit),
    enabled: !!supabase && !!userId,
    // Aumentando o staleTime para 5 minutos para reduzir re-fetches desnecessários
    staleTime: 5 * 60 * 1000, 
  });
};

// Exportando usePedidos antigo para compatibilidade, mas ele não deve ser usado para a lista principal
export const usePedidos = () => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  // Esta função agora busca TODOS os pedidos sem paginação.
  // É mantida para compatibilidade com outros componentes que precisam de todos os dados (ex: Dashboard/Reports)
  const fetchAllPedidos = async (supabase: any, userId: string): Promise<Pedido[]> => {
    const { data: pedidosData, error: pedidosError } = await supabase
      .from('pedidos')
      .select(`
        *,
        clientes (id, nome, telefone, email, endereco),
        pedido_items (*),
        pedido_servicos (*),
        pedido_status_history (*)
      `)
      .order('order_number', { ascending: false });

    if (pedidosError) throw pedidosError;

    const pedidosCompletos = pedidosData?.map(pedido => {
      const orderedHistory = (pedido.pedido_status_history || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestObservation = orderedHistory.length > 0 ? orderedHistory[0].observacao : null;
      
      return {
        ...pedido,
        pedido_items: pedido.pedido_items || [],
        servicos: pedido.pedido_servicos || [],
        status_history: orderedHistory,
        latest_status_observation: latestObservation,
      };
    }) || [];

    return pedidosCompletos as Pedido[];
  };

  return useQuery<Pedido[]>({
    queryKey: ["all-pedidos", userId],
    queryFn: () => fetchAllPedidos(supabase, userId!),
    enabled: !!supabase && !!userId,
    staleTime: 5 * 60 * 1000, 
  });
};