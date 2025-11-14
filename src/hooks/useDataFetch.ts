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
const fetchPedidos = async (supabase: any, userId: string): Promise<Pedido[]> => {
  // Consulta ÚNICA e completa para todos os pedidos
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

  // Mapear e processar os dados (ordenar histórico e pegar última observação)
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

export const usePedidos = () => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  return useQuery<Pedido[]>({
    queryKey: ["pedidos", userId],
    queryFn: () => fetchPedidos(supabase, userId!),
    enabled: !!supabase && !!userId,
    staleTime: 60 * 1000, // 1 minuto de cache para pedidos (mais dinâmico)
  });
};