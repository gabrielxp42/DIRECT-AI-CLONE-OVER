import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Cliente } from "@/types/cliente";
import { Pedido } from "@/types/pedido";
import { Produto } from "@/types/produto";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from '@/utils/tokenGuard';
import { removeAccents } from "@/utils/string";

const buildHeaders = (token: string) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Prefer: "count=exact",
});

const fetchTable = async <T>(token: string, endpoint: string, params: URLSearchParams): Promise<T[]> => {
  // Garantir que o token está válido antes de fazer a requisição
  const validToken = await getValidToken();
  const effectiveToken = validToken || token;

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
  const res = await fetch(url, { headers: buildHeaders(effectiveToken) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch error (${endpoint}): ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
};

// --- Fetch Clientes ---
const fetchClientes = async (token: string): Promise<Cliente[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  return fetchTable<Cliente>(token, "clientes", params);
};

export const useClientes = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;

  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<Cliente[]>({
    queryKey: ["clientes"],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Access token missing.");
      }
      return fetchClientes(accessToken);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
    retry: 3, // Retry 3 vezes se JWT expirar
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

// --- Fetch Produtos ---
const fetchProdutos = async (token: string): Promise<Produto[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  return fetchTable<Produto>(token, "produtos", params);
};

export const useProdutos = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;

  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<Produto[]>({
    queryKey: ["produtos"],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Access token missing.");
      }
      return fetchProdutos(accessToken);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// --- Fetch Pedidos (Completo) ---
interface PaginatedPedidosResult {
  pedidos: Pedido[];
  totalCount: number;
}

const fetchPedidos = async (
  supabase: SupabaseClient, // Garantindo que é SupabaseClient
  userId: string,
  page: number,
  limit: number,
  filterStatus: string,
  filterDateRange: { from?: Date; to?: Date },
  filterClientId: string | null,
  searchTerm: string,
  organizationId: string | null,
  accessToken?: string // Novo parâmetro opcional
): Promise<PaginatedPedidosResult> => {

  // CRÍTICO: Capturar a referência do supabase no início para evitar problemas de closure
  // Isso garante que mesmo se o contexto React mudar, ainda temos a referência correta
  const supabaseRef = supabase;

  // Função helper para validar supabase usando a referência capturada
  const validateSupabase = (context: string) => {
    if (!supabaseRef) {
      console.error(`[fetchPedidos] ${context}: supabaseRef é undefined!`);
      throw new Error(`Supabase client is undefined at ${context}.`);
    }
    if (typeof supabaseRef !== 'object') {
      console.error(`[fetchPedidos] ${context}: supabaseRef não é um objeto:`, typeof supabaseRef);
      throw new Error(`Supabase client is not an object at ${context}.`);
    }
    if (typeof supabaseRef.from !== 'function') {
      console.error(`[fetchPedidos] ${context}: supabaseRef.from não é uma função:`, typeof supabaseRef.from);
      console.error(`[fetchPedidos] ${context}: supabaseRef keys:`, Object.keys(supabaseRef || {}));
      throw new Error(`Supabase client is missing 'from' method at ${context}.`);
    }
  };

  try {
    // VALIDAÇÃO CRÍTICA: Se o cliente Supabase não estiver aqui, algo deu errado no hook chamador.
    validateSupabase('início da função');

    // Validação adicional: garantir que supabase.rpc existe (pode não existir se a função não estiver disponível)
    const hasRPC = supabaseRef && typeof supabaseRef.rpc === 'function';

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Log de debug
    console.log('[fetchPedidos] Iniciando busca com:', {
      hasSupabase: !!supabaseRef,
      isObject: typeof supabaseRef === 'object',
      hasFrom: typeof supabaseRef?.from === 'function',
      hasRPC,
      userId,
      page,
      limit,
      searchTerm,
      filterClientId,
    });

    // Re-validar antes de criar a query
    validateSupabase('antes de criar query');
    console.log('[fetchPedidos] Criando query builder...');

    let query = supabaseRef
      .from('pedidos')
      .select(`
        *,
        clientes (id, nome, telefone, email, endereco),
        pedido_items (*),
        pedido_servicos (*),
        pedido_status_history (*)
      `, { count: 'exact' });

    console.log('[fetchPedidos] Query builder criado com sucesso');

    // 1. Aplicar filtro de Status
    console.log('[fetchPedidos] Aplicando filtros de status...');
    if (filterStatus === 'pendente-pagamento') {
      query = query.not('status', 'in', '("pago", "cancelado", "entregue")');
    } else if (filterStatus !== 'todos') {
      query = query.eq('status', filterStatus);
    }

    // 2. Aplicar filtro de Data
    console.log('[fetchPedidos] Aplicando filtros de data...', filterDateRange);
    if (filterDateRange?.from) {
      query = query.gte('created_at', filterDateRange.from.toISOString());
    }
    if (filterDateRange?.to) {
      const endOfDay = new Date(filterDateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endOfDay.toISOString());
    }

    console.log('[fetchPedidos] Filtros de data aplicados. Próximo: filtros de cliente.');

    // 3. Aplicar filtro de Cliente (prioritário)
    console.log('[fetchPedidos] Aplicando filtros de cliente...');
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
        // Se for texto, a busca de clientes será feita no bloco de fetch direto abaixo
        // Por enquanto, apenas logamos que será processado no fetch direto
        console.log('[fetchPedidos] Busca de texto será processada no fetch direto:', trimmedSearchTerm);
      }
    }

    // CRÍTICO: Obter token válido ANTES de qualquer requisição
    const validToken = await getValidToken();
    const effectiveToken = validToken || accessToken;

    if (!effectiveToken) {
      console.warn('⚠️ [fetchPedidos] Sem token de acesso válido. Tentando método padrão (pode falhar).');
    } else {
      try {
        // Construir URL para fetch direto (PostgREST syntax)
        const baseUrl = `${SUPABASE_URL}/rest/v1/pedidos`;
        const selectQuery = `*,clientes(id,nome,telefone,email,endereco),pedido_items(*),pedido_servicos(*),pedido_status_history(*)`;

        let queryParams = new URLSearchParams();
        queryParams.append('select', selectQuery);
        queryParams.append('order', 'order_number.desc');
        queryParams.append('limit', String(limit));
        queryParams.append('offset', String(start));

        // Adicionar contagem total
        // Nota: PostgREST usa header Prefer: count=exact para retornar contagem no header Content-Range

        // Filtros
        if (filterStatus === 'pendente-pagamento') {
          queryParams.append('status', 'not.in.("pago","cancelado","entregue")'); // Correção sintaxe PostgREST
        } else if (filterStatus !== 'todos') {
          queryParams.append('status', `eq.${filterStatus}`);
        }

        if (filterDateRange?.from) {
          queryParams.append('created_at', `gte.${filterDateRange.from.toISOString()}`);
        }
        if (filterDateRange?.to) {
          const endOfDay = new Date(filterDateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          queryParams.append('created_at', `lte.${endOfDay.toISOString()}`);
        }

        if (filterClientId) {
          queryParams.append('cliente_id', `eq.${filterClientId}`);
        }

        // Busca por termo com busca inteligente de clientes
        if (trimmedSearchTerm && !filterClientId) {
          const isNumeric = !isNaN(Number(trimmedSearchTerm));
          if (isNumeric) {
            queryParams.append('or', `order_number.eq.${trimmedSearchTerm},observacoes.ilike.*${trimmedSearchTerm}*`);
          } else {
            // Buscar clientes usando fetch direto com normalização de acentos
            try {
              console.log('[fetchPedidos] Buscando clientes para:', trimmedSearchTerm);
              const clientesUrl = `${SUPABASE_URL}/rest/v1/clientes?select=id,nome,telefone,email&limit=500`;
              const clientesResponse = await fetch(clientesUrl, {
                method: 'GET',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${effectiveToken}`,
                  'Content-Type': 'application/json'
                }
              });

              if (clientesResponse.ok) {
                const allClientes = await clientesResponse.json();

                // Normalizar termo de busca
                const normalizedSearch = removeAccents(trimmedSearchTerm.toLowerCase());

                // Filtrar clientes client-side com normalização de acentos
                const matchingClientes = allClientes.filter((cliente: any) => {
                  if (!cliente) return false;

                  // Busca no nome (normalizado, sem acentos)
                  const normalizedNome = removeAccents((cliente.nome || '').toLowerCase());
                  const nomeMatch = normalizedNome.includes(normalizedSearch) ||
                    (cliente.nome || '').toLowerCase().includes(trimmedSearchTerm.toLowerCase());

                  // Busca no telefone
                  const telefoneMatch = cliente.telefone ?
                    cliente.telefone.includes(trimmedSearchTerm) : false;

                  // Busca no email
                  const emailMatch = cliente.email ?
                    cliente.email.toLowerCase().includes(trimmedSearchTerm.toLowerCase()) : false;

                  return nomeMatch || telefoneMatch || emailMatch;
                });

                if (matchingClientes.length > 0) {
                  const clientIds = matchingClientes
                    .map((c: any) => c.id)
                    .filter((id: any) => id && typeof id === 'string');

                  if (clientIds.length > 0) {
                    console.log(`✅ [fetchPedidos] Busca encontrou ${clientIds.length} cliente(s) para: "${trimmedSearchTerm}"`);
                    // Adicionar filtro de cliente_id usando operador 'in' do PostgREST
                    queryParams.append('cliente_id', `in.(${clientIds.join(',')})`);
                  } else {
                    console.log('[fetchPedidos] Nenhum ID de cliente válido encontrado, buscando em observações');
                    queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
                  }
                } else {
                  console.log('[fetchPedidos] Nenhum cliente encontrado, buscando em observações');
                  queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
                }
              } else {
                console.warn('[fetchPedidos] Erro ao buscar clientes, usando busca em observações');
                queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
              }
            } catch (searchError: any) {
              console.error("❌ [fetchPedidos] Erro ao buscar clientes:", searchError);
              // Fallback: buscar nas observações
              queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
            }
          }
        }

        const makeFetch = async (token: string) => {
          return fetch(`${baseUrl}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Prefer': 'count=exact'
            }
          });
        };

        let response = await makeFetch(effectiveToken);

        // Se der 401, tentar pegar novo token válido (com refresh se necessário)
        if (response.status === 401) {
          console.warn('[fetchPedidos] Token expirado (401). Tentando obter token válido...');

          const newToken = await getValidToken();

          if (newToken) {
            console.log('[fetchPedidos] Novo token obtido. Retentando fetch...');
            response = await makeFetch(newToken);
          } else {
            console.error('[fetchPedidos] Falha ao obter novo token do localStorage');
          }
        }

        if (!response.ok) {
          const errorText = await response.text();
          // Se ainda for 401, lançar erro específico para o React Query tentar de novo (se retry estiver ativado)
          if (response.status === 401) {
            throw new Error(`JWT_EXPIRED: ${errorText}`);
          }
          throw new Error(`Erro no fetch direto: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        // Ler count do header
        const contentRange = response.headers.get('content-range');
        const totalCount = contentRange ? parseInt(contentRange.split('/')[1]) : data.length;

        console.log('[fetchPedidos] Fetch direto retornou:', data.length, 'registros. Total:', totalCount);

        // Mapeamento de dados
        const pedidosCompletos = data.map((pedido: any) => {
          const orderedHistory = (pedido.pedido_status_history || []).sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const latestObservation = orderedHistory.length > 0 ? orderedHistory[0].observacao : null;

          return {
            ...pedido,
            pedido_items: (pedido.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
            servicos: pedido.pedido_servicos || [],
            status_history: orderedHistory,
            latest_status_observation: latestObservation,
          };
        });

        return {
          pedidos: pedidosCompletos as Pedido[],
          totalCount: totalCount || 0,
        };

      } catch (fetchError: any) {
        console.error('[fetchPedidos] Erro no fetch direto:', fetchError);
        // Se for erro de JWT, propagar para o React Query fazer retry
        if (fetchError.message && fetchError.message.includes('JWT_EXPIRED')) {
          throw fetchError;
        }
        // Caso contrário, apenas logar e deixar cair no fallback (embora o fallback provavelmente falhe também se for auth)
      }
    }

    // Re-validar supabase antes de executar a query final
    validateSupabase('antes de executar query final');

    // Verificar se o query builder ainda está válido
    if (!query) {
      console.error('[fetchPedidos] Query builder é undefined antes de executar!');
      throw new Error("Query builder is undefined.");
    }

    // 5. Aplicar ordenação e paginação
    console.log('[fetchPedidos] Executando query final...');

    // TESTE DE REDE DIRETO (Diagnóstico)
    try {
      console.log('[fetchPedidos] DEBUG: Tentando fetch direto com token do contexto...');
      const token = accessToken;

      console.log('[fetchPedidos] Testando fetch direto...', { hasToken: !!token });

      if (token) {
        // URL direta para a tabela de pedidos
        const testUrl = `${SUPABASE_URL}/rest/v1/pedidos?select=count&limit=1`;
        console.log('[fetchPedidos] DEBUG: Fetching:', testUrl);

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('[fetchPedidos] Teste fetch direto status:', response.status);
        if (!response.ok) {
          const text = await response.text();
          console.error('[fetchPedidos] Teste fetch direto falhou:', text);
        } else {
          const json = await response.json();
          console.log('[fetchPedidos] Teste fetch direto SUCESSO:', json);
        }
      } else {
        console.warn('[fetchPedidos] Sem token para teste direto.');
      }
    } catch (e) {
      console.error('[fetchPedidos] Teste fetch direto EXCEPTION:', e);
    }

    // Adicionar timeout para evitar travamento infinito
    const queryPromise = query
      .order('order_number', { ascending: false })
      .range(start, end);

    // Race com timeout de 10 segundos
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout na query do Supabase")), 10000)
    );

    let result: any;
    try {
      result = await Promise.race([queryPromise, timeoutPromise]);
    } catch (raceError: any) {
      console.error('[fetchPedidos] Erro de timeout ou execução:', raceError);
      throw raceError;
    }

    const { data: pedidosData, error: pedidosError, count } = result;

    console.log('[fetchPedidos] Query final retornou:', {
      sucesso: !pedidosError,
      registros: pedidosData?.length,
      count: count,
      erro: pedidosError?.message
    });

    if (pedidosError) {
      console.error('[fetchPedidos] Erro ao executar query:', pedidosError);
      throw pedidosError;
    }

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
        pedido_items: (pedido.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
        servicos: pedido.pedido_servicos || [],
        status_history: orderedHistory,
        latest_status_observation: latestObservation,
      };
    }) || [];

    return {
      pedidos: pedidosCompletos as Pedido[],
      totalCount: count || 0,
    };
  } catch (error: any) {
    console.error('[fetchPedidos] ERRO FATAL na função fetchPedidos:', {
      message: error?.message,
      stack: error?.stack,
      error: error,
      supabaseAtError: {
        exists: !!supabaseRef,
        type: typeof supabaseRef,
        hasFrom: typeof supabaseRef?.from === 'function',
      }
    });
    throw error;
  }
};

export const usePaginatedPedidos = (
  page: number,
  limit: number,
  filterStatus: string,
  filterDateRange: { from?: Date; to?: Date },
  filterClientId: string | null,
  searchTerm: string
) => {
  const { supabase, session, organizationId, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id;
  const accessToken = session?.access_token; // Pegar token do contexto

  // CRÍTICO: Usar useRef para manter a referência estável do supabase
  // Isso evita que o supabase mude durante a execução assíncrona
  const supabaseRef = useRef(supabase);

  // Atualizar a referência sempre que o supabase mudar
  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  // Validação crítica ANTES de criar a query
  // IMPORTANTE: Aguardar sessão carregar antes de executar
  const isSupabaseValid = supabase && typeof supabase === 'object' && typeof supabase.from === 'function';
  const isEnabled = !sessionLoading && isSupabaseValid && !!userId;

  // A chave da query agora inclui todos os filtros para garantir que o cache seja invalidado corretamente
  const queryKey = ["pedidos", userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId];

  return useQuery<PaginatedPedidosResult>({
    queryKey: queryKey,
    queryFn: async () => {
      // Usar a referência estável do supabase
      const currentSupabase = supabaseRef.current;

      // Re-validar dentro da queryFn ANTES de qualquer operação
      console.log('[usePaginatedPedidos] queryFn executando, validando supabase...', {
        hasSupabase: !!currentSupabase,
        isObject: typeof currentSupabase === 'object',
        hasFrom: typeof currentSupabase?.from === 'function',
        userId,
        sessionLoading,
      });

      // Verificação dupla para garantir segurança
      if (!currentSupabase) {
        console.error('[usePaginatedPedidos] currentSupabase é undefined na queryFn!');
        throw new Error("Supabase client is undefined.");
      }

      if (typeof currentSupabase !== 'object') {
        console.error('[usePaginatedPedidos] currentSupabase não é objeto na queryFn:', typeof currentSupabase);
        throw new Error("Supabase client is not an object.");
      }

      if (typeof currentSupabase.from !== 'function') {
        console.error('[usePaginatedPedidos] currentSupabase.from não é função na queryFn:', typeof currentSupabase.from);
        console.error('[usePaginatedPedidos] currentSupabase keys:', Object.keys(currentSupabase || {}));
        throw new Error("Supabase client is missing 'from' method.");
      }

      if (!userId) {
        console.error('[usePaginatedPedidos] userId é undefined na queryFn!');
        throw new Error("User ID is missing.");
      }

      // Agora podemos chamar fetchPedidos com segurança usando a referência estável
      return await fetchPedidos(currentSupabase, userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId, accessToken);
    },
    enabled: isEnabled, // Usar a validação pré-calculada
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
    retry: 3, // Tentar novamente 3 vezes se falhar (útil para expiração de token)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

// Mantendo usePedidos para compatibilidade com Dashboard/Reports, mas renomeando a chave
export const usePedidos = () => {
  const { supabase, session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id;

  // CRÍTICO: Usar useRef para manter a referência estável do supabase
  const supabaseRef = useRef(supabase);
  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  const fetchAllPedidos = async (supabase: SupabaseClient, userId: string): Promise<Pedido[]> => {
    // Usar a referência estável se o argumento falhar
    const currentSupabase = supabaseRef.current || supabase;

    // VALIDAÇÃO CRÍTICA
    if (!currentSupabase || typeof currentSupabase.from !== 'function') {
      throw new Error("Supabase client is not properly initialized or available (missing 'from' function).");
    }

    const { data: pedidosData, error: pedidosError } = await currentSupabase
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
        pedido_items: (pedido.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
        servicos: pedido.pedido_servicos || [],
        status_history: orderedHistory,
        latest_status_observation: latestObservation,
      };
    }) || [];

    return pedidosCompletos as Pedido[];
  };

  // Validação crítica: só executar se sessão não estiver carregando E supabase estiver válido
  const isSupabaseValid = supabase && typeof supabase === 'object' && typeof supabase.from === 'function';
  const isEnabled = !sessionLoading && isSupabaseValid && !!userId;

  return useQuery<Pedido[]>({
    queryKey: ["all-pedidos-unpaginated", userId], // Chave alterada para evitar conflito
    queryFn: () => {
      const currentSupabase = supabaseRef.current; // Usar a referência estável

      if (!isSupabaseValid || !currentSupabase) {
        throw new Error("Supabase client is not properly initialized.");
      }
      if (!userId) {
        throw new Error("User ID is missing.");
      }
      return fetchAllPedidos(currentSupabase, userId);
    },
    enabled: isEnabled, // Aguardar sessão carregar antes de executar
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
  });
};