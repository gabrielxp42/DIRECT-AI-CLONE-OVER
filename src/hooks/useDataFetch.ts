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
  limit: number,
  filterStatus: string,
  filterDateRange: { from?: Date; to?: Date },
  filterClientId: string | null,
  searchTerm: string // NOVO PARÂMETRO
): Promise<PaginatedPedidosResult> => {
  
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  let query = supabase
    .from('pedidos')
    .select(`
      *,
      clientes (id, nome, telefone, email, endereco),
      pedido_items (*),
      pedido_servicos (*),
      pedido_status_history (*)
    `, { count: 'exact' });

  // 1. Aplicar filtro de Status
  if (filterStatus === 'pendente-pagamento') {
    query = query.not('status', 'in', '("pago", "cancelado", "entregue")');
  } else if (filterStatus !== 'todos') {
    query = query.eq('status', filterStatus);
  }

  // 2. Aplicar filtro de Data
  if (filterDateRange.from) {
    query = query.gte('created_at', filterDateRange.from.toISOString());
  }
  if (filterDateRange.to) {
    const endOfDay = new Date(filterDateRange.to);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte('created_at', endOfDay.toISOString());
  }

  // 3. Aplicar filtro de Cliente (prioritário)
  if (filterClientId) {
    query = query.eq('cliente_id', filterClientId);
  }

  // 4. Aplicar Busca por Termo (se não houver filtro de cliente ativo)
  const trimmedSearchTerm = searchTerm.trim();
  
  if (trimmedSearchTerm && !filterClientId) {
    const isNumeric = !isNaN(Number(trimmedSearchTerm));
    
    if (isNumeric) {
      // Se for numérico, buscamos por order_number (exato) OU observacoes (ilike)
      const orderNumber = Number(trimmedSearchTerm);
      query = query.or(`order_number.eq.${orderNumber},observacoes.ilike.%${trimmedSearchTerm}%`);
      
    } else {
      // Se for texto, tentamos buscar clientes por nome fuzzy
      const { data: fuzzyClients, error: fuzzyError } = await supabase
        .rpc('find_client_by_fuzzy_name', { 
          partial_name: trimmedSearchTerm,
          similarity_threshold: 0.3 
        });

      if (!fuzzyError && fuzzyClients && fuzzyClients.length > 0) {
        const clientIds = fuzzyClients.map((c: { id: string }) => c.id);
        // Se encontrou clientes, filtramos por ID do cliente
        query = query.in('cliente_id', clientIds);
      } else {
        // Se não encontrou clientes, buscamos o termo nas observações
        query = query.ilike('observacoes', `%${trimmedSearchTerm}%`);
      }
    }
  }


  // 5. Aplicar ordenação e paginação
  const { data: pedidosData, error: pedidosError, count } = await query
    .order('order_number', { ascending: false })
    .range(start, end);

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

export const usePaginatedPedidos = (
  page: number, 
  limit: number,
  filterStatus: string,
  filterDateRange: { from?: Date; to?: Date },
  filterClientId: string | null,
  searchTerm: string // NOVO PARÂMETRO
) => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

  // A chave da query agora inclui todos os filtros para garantir que o cache seja invalidado corretamente
  const queryKey = ["pedidos", userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm];

  return useQuery<PaginatedPedidosResult>({
    queryKey: queryKey,
    queryFn: () => fetchPedidos(supabase, userId!, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm),
    enabled: !!supabase && !!userId,
    staleTime: 5 * 60 * 1000, 
  });
};

// Mantendo usePedidos para compatibilidade com Dashboard/Reports, mas renomeando a chave
export const usePedidos = () => {
  const { supabase, session } = useSession();
  const userId = session?.user.id;

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
    queryKey: ["all-pedidos-unpaginated", userId], // Chave alterada para evitar conflito
    queryFn: () => fetchAllPedidos(supabase, userId!),
    enabled: !!supabase && !!userId,
    staleTime: 5 * 60 * 1000, 
  });
};