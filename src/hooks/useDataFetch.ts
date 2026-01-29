import { useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { Cliente } from "@/types/cliente";
import { Produto } from "@/types/produto";
import { Pedido } from "@/types/pedido";
import { Insumo } from "@/types/insumo";
import { TipoProducao } from "@/types/producao";
import { SupabaseClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from '@/utils/tokenGuard';
import { removeAccents } from "@/utils/string";
import { ServiceShortcut, NewServiceShortcut } from "@/types/servico";

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
    throw new Error(`Supabase fetch error(${endpoint}): ${res.status} ${res.statusText} - ${text} `);
  }
  return res.json();
};

// --- Fetch Clientes ---
const fetchClientes = async (token: string, userId?: string): Promise<Cliente[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
  });
  if (userId) {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<Cliente>(token, "clientes", params);
};

export const useClientes = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;

  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<Cliente[]>({
    queryKey: ["clientes", userId],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Access token missing.");
      }
      return fetchClientes(accessToken, userId);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
    retry: 3, // Retry 3 vezes se JWT expirar
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

// --- Fetch Produtos ---
const fetchProdutos = async (token: string, userId?: string): Promise<Produto[]> => {
  const params = new URLSearchParams({
    select: "*,produto_insumos(*,insumos(nome,unidade))",
    order: "created_at.desc",
  });
  if (userId) {
    params.append("user_id", `eq.${userId}`);
  }
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
      return fetchProdutos(accessToken, session?.user?.id);
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
      console.error(`[fetchPedidos] ${context}: supabaseRef não é um objeto: `, typeof supabaseRef);
      throw new Error(`Supabase client is not an object at ${context}.`);
    }
    if (typeof supabaseRef.from !== 'function') {
      console.error(`[fetchPedidos] ${context}: supabaseRef.from não é uma função: `, typeof supabaseRef.from);
      console.error(`[fetchPedidos] ${context}: supabaseRef keys: `, Object.keys(supabaseRef || {}));
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
  clientes(id, nome, telefone, email, endereco),
  pedido_items(*),
  pedido_servicos(*),
  pedido_status_history(*)
    `, { count: 'exact' })
      .eq('user_id', userId);

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

    // 3. Aplicar filtro de Cliente (prioritário - menu dropdown)
    console.log('[fetchPedidos] Aplicando filtros de cliente...');
    if (filterClientId) {
      query = query.eq('cliente_id', filterClientId);
    }

    // 4. Aplicar Busca por Termo (Barra de Busca)
    const trimmedSearchTerm = searchTerm.trim();

    if (trimmedSearchTerm && !filterClientId) {
      const isNumeric = !isNaN(Number(trimmedSearchTerm));

      if (isNumeric) {
        // Se for numérico, buscamos por order_number (prioridade máxima) OU observacoes/valores
        // Isso é rápido e direto
        const orderNumber = Number(trimmedSearchTerm);
        query = query.or(`order_number.eq.${orderNumber},observacoes.ilike.%${trimmedSearchTerm}%`);
      } else {
        // --- LÓGICA DE BUSCA DE CLIENTE ROBUSTA ---
        // 1. Buscamos TODOS os IDs de clientes que batem com o nome/email/telefone
        // Usamos uma query separada leve (só retorna IDs) para não pesar
        console.log(`[fetchPedidos] Iniciando busca profunda por: "${trimmedSearchTerm}"`);

        try {
          // Normalizar termo para "like" (sem acentos seria ideal no banco, mas aqui garantimos o ilike)
          // A estratégia "or" busca em várius campos do cliente
          const { data: foundClients, error: clientSearchError } = await supabaseRef
            .from('clientes')
            .select('id, nome, email, telefone')
            .or(`nome.ilike.%${trimmedSearchTerm}%,email.ilike.%${trimmedSearchTerm}%,telefone.ilike.%${trimmedSearchTerm}%`)
            .limit(100); // Limite de segurança aumentado para 100 resultados de clientes parecidos

          if (clientSearchError) {
            console.error('[fetchPedidos] Erro ao buscar clientes:', clientSearchError);
            // Fallback: busca só nas observações do pedido
            query = query.ilike('observacoes', `%${trimmedSearchTerm}%`);
          } else if (foundClients && foundClients.length > 0) {
            const clientIds = foundClients.map(c => c.id);
            console.log(`[fetchPedidos] Encontrados ${clientIds.length} clientes. IDs:`, clientIds);

            // Construir filtro OR: (cliente_id IN (...) OR observacao ILIKE term)
            // PostgREST syntax para OR complexo com IN e ILIKE juntos é chata.
            // Estratégia mais segura: cliente_id.in.(ids)
            // Se quiser buscar TAMBÉM em observação, teríamos que usar o filtro raw 'or', mas isso sobrescreve filtros anteriores.
            // Para manter a segurança dos filtros de data/status, vamos focar nos clientes encontrados PRIMEIRO.

            query = query.in('cliente_id', clientIds);
          } else {
            console.log('[fetchPedidos] Nenhum cliente encontrado. Buscando apenas em observações.');
            query = query.ilike('observacoes', `%${trimmedSearchTerm}%`);
          }
        } catch (err) {
          console.error('[fetchPedidos] Falha catastrófica na busca de clientes:', err);
          // Fallback seguro
          query = query.ilike('observacoes', `%${trimmedSearchTerm}%`);
        }
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
        queryParams.append('user_id', `eq.${userId}`);
        queryParams.append('order', 'order_number.desc');
        queryParams.append('limit', String(limit));
        queryParams.append('offset', String(start));

        // Filtros
        if (filterStatus === 'pendente-pagamento') {
          queryParams.append('status', 'not.in.("pago","cancelado","entregue")');
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
            queryParams.append('or', `order_number.eq.${trimmedSearchTerm},observacoes.ilike.%${trimmedSearchTerm}%`);
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
                    console.log(`✅[fetchPedidos] Busca encontrou ${clientIds.length} cliente(s) para: "${trimmedSearchTerm}"`);
                    // Adicionar filtro de cliente_id usando operador 'in' do PostgREST
                    queryParams.append('cliente_id', `in.(${clientIds.join(',')})`);
                  } else {
                    console.log('[fetchPedidos] Nenhum ID de cliente válido encontrado, buscando em observações');
                    queryParams.append('observacoes', `ilike.%${trimmedSearchTerm}%`);
                  }
                } else {
                  console.log('[fetchPedidos] Nenhum cliente encontrado, buscando em observações');
                  queryParams.append('observacoes', `ilike.%${trimmedSearchTerm}%`);
                }
              } else {
                console.warn('[fetchPedidos] Erro ao buscar clientes, usando busca em observações');
                queryParams.append('observacoes', `ilike.%${trimmedSearchTerm}%`);
              }
            } catch (searchError: any) {
              console.error("❌ [fetchPedidos] Erro ao buscar clientes:", searchError);
              // Fallback: buscar nas observações
              queryParams.append('observacoes', `ilike.%${trimmedSearchTerm}%`);
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
            throw new Error(`JWT_EXPIRED: ${errorText} `);
          }
          throw new Error(`Erro no fetch direto: ${response.status} ${response.statusText} - ${errorText} `);
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
      }
    }

    validateSupabase('antes de executar query final');

    if (!query) {
      console.error('[fetchPedidos] Query builder é undefined antes de executar!');
      throw new Error("Query builder is undefined.");
    }

    console.log('[fetchPedidos] Executando query final...');

    const queryPromise = query
      .order('order_number', { ascending: false })
      .range(start, end);

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

    if (pedidosError) {
      console.error('[fetchPedidos] Erro ao executar query:', pedidosError);
      throw pedidosError;
    }

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

    return {
      pedidos: pedidosCompletos as Pedido[],
      totalCount: count || 0,
    };
  } catch (error: any) {
    console.error('[fetchPedidos] ERRO FATAL na função fetchPedidos:', error);
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
  const accessToken = session?.access_token;

  const supabaseRef = useRef(supabase);

  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  const isSupabaseValid = supabase && typeof supabase === 'object' && typeof supabase.from === 'function';
  const isEnabled = !sessionLoading && isSupabaseValid && !!userId;

  const queryKey = ["pedidos", userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId];

  return useQuery<PaginatedPedidosResult>({
    queryKey: queryKey,
    queryFn: async () => {
      const currentSupabase = supabaseRef.current;

      if (!currentSupabase || typeof currentSupabase.from !== 'function' || !userId) {
        throw new Error("Invalid Supabase client or missing User ID.");
      }

      return await fetchPedidos(currentSupabase, userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId, accessToken);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

export const usePedidos = () => {
  const { supabase, session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id;

  const supabaseRef = useRef(supabase);
  useEffect(() => {
    supabaseRef.current = supabase;
  }, [supabase]);

  const fetchAllPedidos = async (supabase: SupabaseClient, userId: string): Promise<Pedido[]> => {
    const currentSupabase = supabaseRef.current || supabase;

    if (!currentSupabase || typeof currentSupabase.from !== 'function') {
      throw new Error("Supabase client is not properly initialized.");
    }

    const { data: pedidosData, error: pedidosError } = await currentSupabase
      .from('pedidos')
      .select(`
  *,
  clientes(id, nome, telefone, email, endereco),
  pedido_items(*),
  pedido_servicos(*),
  pedido_status_history(*)
    `)
      .eq('user_id', userId)
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

  const isSupabaseValid = supabase && typeof supabase === 'object' && typeof supabase.from === 'function';
  const isEnabled = !sessionLoading && isSupabaseValid && !!userId;

  return useQuery<Pedido[]>({
    queryKey: ["all-pedidos-unpaginated", userId],
    queryFn: () => {
      const currentSupabase = supabaseRef.current;
      if (!isSupabaseValid || !currentSupabase || !userId) {
        throw new Error("Supabase client or User ID is invalid.");
      }
      return fetchAllPedidos(currentSupabase, userId);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
  });
};

// --- Fetch Tipos de Producao ---
const fetchTiposProducao = async (token: string, userId?: string): Promise<TipoProducao[]> => {
  const params = new URLSearchParams({
    select: "*,tipo_producao_insumos(*,insumos(nome,unidade))",
    order: "order_index.asc,nome.asc",
  });
  if (userId) {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<TipoProducao>(token, "tipos_producao", params);
};

export const useTiposProducao = () => {
  const { supabase, session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;

  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<TipoProducao[]>({
    queryKey: ["tipos_producao", session?.user?.id],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Access token missing.");
      }
      return fetchTiposProducao(accessToken, session?.user?.id);
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    retry: 3,
  });
};

export const useAddTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: async (newTipo: Omit<TipoProducao, "id" | "user_id" | "created_at">) => {
      if (!accessToken || !session?.user?.id) throw new Error("Autenticação necessária");
      if (!supabase) throw new Error("Cliente Supabase não inicializado");

      const { data, error } = await supabase
        .from("tipos_producao")
        .insert([{
          ...newTipo,
          user_id: session.user.id,
          organization_id: profile?.organization_id
        }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_producao"] });
    },
  });
};

export const useUpdateTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<TipoProducao> & { id: string }) => {
      if (!accessToken) throw new Error("Autenticação necessária");
      if (!supabase) throw new Error("Cliente Supabase não inicializado");

      const { data, error } = await supabase
        .from("tipos_producao")
        .update({
          ...updateData,
          organization_id: profile?.organization_id
        })
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_producao"] });
    },
  });
};

export const useDeleteTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase, session } = useSession();
  const accessToken = session?.access_token;

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) throw new Error("Autenticação necessária");
      if (!supabase) throw new Error("Cliente Supabase não inicializado");

      const { error } = await supabase
        .from("tipos_producao")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_producao"] });
    },
  });
};

export const useAddTipoProducaoInsumo = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();

  return useMutation({
    mutationFn: async (newLink: { tipo_producao_id: string; insumo_id: string; consumo: number }) => {
      if (!supabase || !session?.user?.id) throw new Error("Não autenticado");

      const { data, error } = await supabase
        .from("tipo_producao_insumos")
        .insert([{
          ...newLink,
          user_id: session.user.id,
          organization_id: profile?.organization_id
        }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_producao"] });
    },
  });
};

export const useDeleteTipoProducaoInsumo = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase não disponível");
      const { error } = await supabase
        .from("tipo_producao_insumos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos_producao"] });
    },
  });
};

// --- Fetch Service Shortcuts ---
const fetchServiceShortcuts = async (token: string, userId?: string): Promise<ServiceShortcut[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "is_pinned.desc,usage_count.desc,nome.asc",
  });
  if (userId) {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<ServiceShortcut>(token, "service_shortcuts", params);
};

export const useServiceShortcuts = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;

  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<ServiceShortcut[]>({
    queryKey: ["service_shortcuts", userId],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Access token missing.");
      }
      return fetchServiceShortcuts(accessToken, userId);
    },
    enabled: isEnabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
  });
};

export const useAddServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase, session } = useSession();

  return useMutation({
    mutationFn: async (newShortcut: NewServiceShortcut) => {
      if (!session?.user?.id || !supabase) throw new Error("Autenticação necessária");

      const { data, error } = await supabase
        .from("service_shortcuts")
        .insert([{
          ...newShortcut,
          user_id: session.user.id
        }])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] });
    },
  });
};

export const useUpdateServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<ServiceShortcut> & { id: string }) => {
      const { data, error } = await supabase
        .from("service_shortcuts")
        .update(updateData)
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] });
    },
  });
};

export const useDeleteServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_shortcuts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] });
    },
  });
};

export const useIncrementServiceUsage = () => {
  const queryClient = useQueryClient();
  const { supabase, session } = useSession();

  return useMutation({
    mutationFn: async ({ nome, valor }: { nome: string, valor: number }) => {
      if (!session?.user?.id || !supabase) return;

      // Buscar se já existe
      const { data: existing } = await supabase
        .from("service_shortcuts")
        .select("id, usage_count")
        .eq("nome", nome)
        .eq("user_id", session.user.id)
        .single();

      if (existing) {
        // Incrementar
        await supabase
          .from("service_shortcuts")
          .update({
            usage_count: (existing.usage_count || 0) + 1,
            last_used: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // Criar novo sugerido
        await supabase
          .from("service_shortcuts")
          .insert([{
            nome,
            valor,
            user_id: session.user.id,
            usage_count: 1,
            last_used: new Date().toISOString()
          }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] });
    },
  });
};

// --- Fetch Insumos ---
const fetchInsumos = async (token: string, userId?: string): Promise<Insumo[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "nome.asc",
  });
  if (userId) {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<Insumo>(token, "insumos", params);
};

export const useInsumos = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const isEnabled = !sessionLoading && !!accessToken;

  return useQuery<Insumo[]>({
    queryKey: ["insumos"],
    queryFn: () => {
      if (!accessToken) throw new Error("Access token missing.");
      return fetchInsumos(accessToken, session?.user?.id);
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
};

// --- Inventory Management Logic ---

/**
 * Verifica se um status de pedido deve consumir estoque.
 */
export const isInventoryConsumingStatus = (status: string): boolean => {
  const consumingStatuses = [
    'processando',
    'enviado',
    'entregue',
    'pago',
    'aguardando retirada'
  ];
  return consumingStatuses.includes(status.toLowerCase());
};

/**
 * Deduz insumos do estoque baseados nos itens de um pedido.
 */
export const deductInsumosFromPedido = async (pedido: Pedido) => {
  if (!supabase) return;

  try {
    console.log(`[Inventory] Iniciando abate de insumos para pedido #${pedido.order_number}`);

    const items = pedido.pedido_items || [];
    if (items.length === 0) return;

    for (const item of items) {
      const temp_insumos: { insumo_id: string; consumo: number }[] = [];
      let resolvedTipo = item.tipo;

      // 1. Tentar buscar insumos diretos se houver produto_id
      if (item.produto_id) {
        const { data: produtoData } = await supabase
          .from('produtos')
          .select(`
            id,
            tipo,
            user_id,
            produto_insumos (
              insumo_id,
              consumo
            )
          `)
          .eq('id', item.produto_id)
          .single();

        if (produtoData) {
          const direct_insumos = (produtoData as any).produto_insumos || [];
          temp_insumos.push(...direct_insumos);
          if (produtoData.tipo) resolvedTipo = produtoData.tipo;
        }
      }

      // 2. Buscar insumos baseados no tipo de produção (independente de ter produto_id ou não)
      if (resolvedTipo) {
        console.log(`[Inventory] Item ${item.produto_nome}: Resolvido tipo "${resolvedTipo}". Buscando configurações...`);

        let query = supabase
          .from('tipos_producao')
          .select('id')
          .ilike('nome', resolvedTipo)
          .eq('is_active', true);

        // Se o pedido tem organização, busca nela. Se não, busca pelo usuário do pedido.
        if (pedido.organization_id) {
          query = query.eq('organization_id', pedido.organization_id);
        } else {
          query = query.eq('user_id', pedido.user_id);
        }

        const { data: tipoData, error: tError } = await query.maybeSingle();

        if (tError) {
          console.error(`[Inventory] Erro ao buscar tipo ${resolvedTipo}:`, tError);
        }

        if (tipoData) {
          console.log(`[Inventory] Tipo "${resolvedTipo}" encontrado (ID: ${tipoData.id}). Buscando insumos globais...`);
          const { data: type_insumos } = await supabase
            .from('tipo_producao_insumos')
            .select('insumo_id, consumo')
            .eq('tipo_producao_id', tipoData.id);

          if (type_insumos && type_insumos.length > 0) {
            console.log(`[Inventory] Encontrados ${type_insumos.length} insumos globais para ${resolvedTipo}.`);
            temp_insumos.push(...type_insumos);
          } else {
            console.log(`[Inventory] Nenhum insumo global configurado para o tipo ${resolvedTipo}.`);
          }
        } else {
          console.warn(`[Inventory] Tipo de produção "${resolvedTipo}" não encontrado para este usuário/organização.`);
        }
      }

      if (temp_insumos.length === 0) continue;

      // Agrupar insumos repetidos
      const grouped_insumos = temp_insumos.reduce((acc, curr) => {
        const existing = acc.find(i => i.insumo_id === curr.insumo_id);
        if (existing) {
          existing.consumo += Number(curr.consumo);
        } else {
          acc.push({ ...curr, consumo: Number(curr.consumo) });
        }
        return acc;
      }, [] as { insumo_id: string; consumo: number }[]);

      // 3. Processar deduções
      for (const pi of grouped_insumos) {
        if (!pi.insumo_id || !pi.consumo) continue;

        const { data: insumo, error: iError } = await supabase
          .from('insumos')
          .select('id, nome, quantidade_atual')
          .eq('id', pi.insumo_id)
          .single();

        if (iError || !insumo) continue;

        const totalConsumo = Number(pi.consumo) * Number(item.quantidade);

        // Tentativa de Atualização Atômica (Big Tech Style 🛡️)
        // Isso previne que dois usuários sobrescrevam o estoque um do outro
        const { error: rpcError } = await supabase.rpc('update_insumo_quantity_atomic', {
          p_insumo_id: insumo.id,
          p_quantity_change: -totalConsumo // Negativo para deduzir
        });

        if (rpcError) {
          console.warn('[Inventory] Função atômica não encontrada ou erro. Usando método fallback (Legado)...', rpcError.message);
          // Fallback: Método antigo (Ler -> Calcular -> Salvar)
          // Risco: Race conditions se houver concorrência alta, mas funciona se o RPC não existir
          const novaQuantidade = (insumo.quantidade_atual || 0) - totalConsumo;
          await supabase
            .from('insumos')
            .update({ quantidade_atual: novaQuantidade })
            .eq('id', insumo.id);
        } else {
          console.log(`[Inventory] Atomic Update: Item ${item.produto_nome} | Deduzido ${totalConsumo.toFixed(4)} de ${insumo.nome}`);
        }
      }
    }
    console.log('✅ [Inventory] Abate concluído.');
  } catch (error) {
    console.error('❌ [Inventory] Erro no abate:', error);
  }
};

/**
 * Restaura insumos ao estoque (estorno) baseados nos itens de um pedido.
 * Útil ao excluir ou cancelar um pedido pago.
 */
export const restoreInsumosFromPedido = async (pedido: Pedido) => {
  if (!supabase) return;

  try {
    console.log(`[Inventory] Restaurando insumos para pedido #${pedido.order_number}`);

    const items = pedido.pedido_items || [];
    if (items.length === 0) return;

    for (const item of items) {
      const temp_insumos: { insumo_id: string; consumo: number }[] = [];
      let resolvedTipo = item.tipo;

      // 1. Tentar buscar insumos diretos 
      if (item.produto_id) {
        const { data: produtoData } = await supabase
          .from('produtos')
          .select(`
            id,
            tipo,
            user_id,
            produto_insumos (
              insumo_id,
              consumo
            )
          `)
          .eq('id', item.produto_id)
          .single();

        if (produtoData) {
          const direct_insumos = (produtoData as any).produto_insumos || [];
          temp_insumos.push(...direct_insumos);
          if (produtoData.tipo) resolvedTipo = produtoData.tipo;
        }
      }

      // 2. Buscar insumos baseados no tipo de produção
      if (resolvedTipo) {
        let query = supabase
          .from('tipos_producao')
          .select('id')
          .ilike('nome', resolvedTipo)
          .eq('is_active', true);

        if (pedido.organization_id) {
          query = query.eq('organization_id', pedido.organization_id);
        } else {
          query = query.eq('user_id', pedido.user_id);
        }

        const { data: tipoData } = await query.maybeSingle();

        if (tipoData) {
          const { data: type_insumos } = await supabase
            .from('tipo_producao_insumos')
            .select('insumo_id, consumo')
            .eq('tipo_producao_id', tipoData.id);

          if (type_insumos) {
            temp_insumos.push(...type_insumos);
          }
        }
      }

      if (temp_insumos.length === 0) continue;

      // Agrupar insumos repetidos
      const grouped_insumos = temp_insumos.reduce((acc, curr) => {
        const existing = acc.find(i => i.insumo_id === curr.insumo_id);
        if (existing) {
          existing.consumo += Number(curr.consumo);
        } else {
          acc.push({ ...curr, consumo: Number(curr.consumo) });
        }
        return acc;
      }, [] as { insumo_id: string; consumo: number }[]);

      // 3. Processar restaurações
      for (const pi of grouped_insumos) {
        if (!pi.insumo_id || !pi.consumo) continue;

        const { data: insumo, error: iError } = await supabase
          .from('insumos')
          .select('id, nome, quantidade_atual')
          .eq('id', pi.insumo_id)
          .single();

        if (iError || !insumo) continue;

        const totalRestauro = Number(pi.consumo) * Number(item.quantidade);
        const novaQuantidade = (insumo.quantidade_atual || 0) + totalRestauro;

        await supabase
          .from('insumos')
          .update({ quantidade_atual: novaQuantidade })
          .eq('id', insumo.id);

        console.log(`[Inventory] Estorno: ${item.produto_nome} | Restaurado ${totalRestauro.toFixed(4)} de ${insumo.nome}`);
      }
    }
    console.log('✅ [Inventory] Restauração concluída.');
  } catch (error) {
    console.error('❌ [Inventory] Erro na restauração:', error);
  }
};

// --- Fetch Transportadoras ---
export const useTransportadoras = () => {
  const { supabase, session, isLoading: sessionLoading } = useSession();
  const userId = session?.user?.id;

  return useQuery<{ id: string; nome: string }[]>({
    queryKey: ["transportadoras", userId],
    queryFn: async () => {
      if (!supabase || !userId) throw new Error("Supabase ou userId não disponível");
      const { data, error } = await supabase
        .from("transportadoras")
        .select("id, nome")
        .eq("user_id", userId)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !sessionLoading && !!supabase && !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSaveTransportadora = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();

  return useMutation({
    mutationFn: async (nome: string) => {
      if (!supabase || !session?.user?.id) throw new Error("Supabase ou sessão não disponível");

      // Verificar se já existe
      const { data: existing } = await supabase
        .from("transportadoras")
        .select("id")
        .eq("nome", nome)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (existing) return existing;

      // Inserir nova
      const { data, error } = await supabase
        .from("transportadoras")
        .insert([{ nome, user_id: session.user.id, organization_id: profile?.organization_id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportadoras"] });
    },
  });
};
