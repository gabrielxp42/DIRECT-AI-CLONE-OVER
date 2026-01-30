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

const fetchClientes = async (token: string, userId: string, organizationId: string | null): Promise<Cliente[]> => {
  const params = new URLSearchParams({ select: "*", order: "created_at.desc" });
  if (organizationId) {
    params.append("organization_id", `eq.${organizationId}`);
  } else {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<Cliente>(token, "clientes", params);
};

export const useClientes = () => {
  const { session, organizationId, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const isEnabled = !sessionLoading && !!accessToken && !!userId;

  return useQuery<Cliente[]>({
    queryKey: ["clientes", organizationId || userId],
    queryFn: () => {
      if (!accessToken || !userId) throw new Error("Authentication missing.");
      return fetchClientes(accessToken, userId, organizationId);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
  });
};

const fetchProdutos = async (token: string, userId: string, organizationId: string | null): Promise<Produto[]> => {
  const params = new URLSearchParams({ select: "*,produto_insumos(*,insumos(nome,unidade))", order: "created_at.desc" });
  if (organizationId) {
    params.append("organization_id", `eq.${organizationId}`);
  } else {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<Produto>(token, "produtos", params);
};

export const useProdutos = () => {
  const { session, organizationId, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const isEnabled = !sessionLoading && !!accessToken && !!userId;

  return useQuery<Produto[]>({
    queryKey: ["produtos", organizationId || userId],
    queryFn: () => {
      if (!accessToken || !userId) throw new Error("Authentication missing.");
      return fetchProdutos(accessToken, userId, organizationId);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: true,
  });
};

interface PaginatedPedidosResult {
  pedidos: Pedido[];
  totalCount: number;
}

const fetchPedidos = async (
  supabase: SupabaseClient,
  userId: string,
  page: number,
  limit: number,
  filterStatus: string,
  filterDateRange: { from?: Date; to?: Date },
  filterClientId: string | null,
  searchTerm: string,
  organizationId: string | null,
  accessToken?: string
): Promise<PaginatedPedidosResult> => {
  const start = (page - 1) * limit;
  const trimmedSearchTerm = searchTerm.trim();

  const validToken = await getValidToken();
  const effectiveToken = validToken || accessToken;

  if (effectiveToken) {
    try {
      const baseUrl = `${SUPABASE_URL}/rest/v1/pedidos`;
      const selectQuery = `*,clientes(id,nome,telefone,email,endereco),pedido_items(*),pedido_servicos(*),pedido_status_history(*)`;
      let queryParams = new URLSearchParams();
      queryParams.append('select', selectQuery);

      // Filtro de contexto: Organização ou Usuário
      if (organizationId) {
        queryParams.append('organization_id', `eq.${organizationId}`);
      } else {
        queryParams.append('user_id', `eq.${userId}`);
      }

      queryParams.append('order', 'order_number.desc');
      queryParams.append('limit', String(limit));
      queryParams.append('offset', String(start));

      if (filterStatus === 'pendente-pagamento') {
        queryParams.append('status', 'not.in.(pago,cancelado,entregue)');
      } else if (filterStatus !== 'todos') {
        queryParams.append('status', `eq.${filterStatus}`);
      }

      if (filterDateRange?.from) queryParams.append('created_at', `gte.${filterDateRange.from.toISOString()}`);
      if (filterDateRange?.to) {
        const d = new Date(filterDateRange.to);
        d.setHours(23, 59, 59, 999);
        queryParams.append('created_at', `lte.${d.toISOString()}`);
      }

      if (filterClientId) {
        queryParams.append('cliente_id', `eq.${filterClientId}`);
      } else if (trimmedSearchTerm) {
        const isNumeric = !isNaN(Number(trimmedSearchTerm));
        if (isNumeric) {
          queryParams.append('or', `(order_number.eq.${trimmedSearchTerm},observacoes.ilike.*${trimmedSearchTerm}*)`);
        } else {
          try {
            const term = encodeURIComponent(trimmedSearchTerm);
            // Busca de clientes usando wildcards standard do PostgREST (*) e priorizando organização
            const contextFilter = organizationId ? `organization_id=eq.${organizationId}` : `user_id=eq.${userId}`;
            const clientsUrl = `${SUPABASE_URL}/rest/v1/clientes?select=id,nome,email,telefone&${contextFilter}&or=(nome.ilike.*${term}*,email.ilike.*${term}*,telefone.ilike.*${term}*)&limit=1000`;

            console.log('[fetchPedidos] Pesquisando clientes:', clientsUrl);

            const cRes = await fetch(clientsUrl, {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${effectiveToken}`
              }
            });

            if (cRes.ok) {
              const found = await cRes.json();
              console.log(`[fetchPedidos] ${found.length} clientes encontrados.`);

              const normSearch = removeAccents(trimmedSearchTerm.toLowerCase());
              const matches = found.filter((c: any) =>
                removeAccents((c.nome || '').toLowerCase()).includes(normSearch) ||
                (c.email || '').toLowerCase().includes(normSearch) ||
                (c.telefone || '').includes(trimmedSearchTerm)
              );

              const final = matches.length > 0 ? matches : found;
              if (final.length > 0) {
                const ids = final.map((c: any) => c.id).join(',');
                queryParams.append('cliente_id', `in.(${ids})`);
              } else {
                queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
              }
            } else {
              console.warn('[fetchPedidos] Falha ao buscar clientes:', cRes.status);
              queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
            }
          } catch (e) {
            console.error('[fetchPedidos] Erro na busca de clientes:', e);
            queryParams.append('observacoes', `ilike.*${trimmedSearchTerm}*`);
          }
        }
      }

      console.log('[fetchPedidos] URL Final:', `${baseUrl}?${queryParams.toString()}`);

      const res = await fetch(`${baseUrl}?${queryParams.toString()}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${effectiveToken}`, Prefer: 'count=exact' }
      });

      if (res.ok) {
        const data = await res.json();
        const cr = res.headers.get('content-range');
        const count = cr ? parseInt(cr.split('/')[1]) : data.length;

        const ped = data.map((p: any) => ({
          ...p,
          pedido_items: (p.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
          servicos: p.pedido_servicos || [],
          status_history: (p.pedido_status_history || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        }));
        return { pedidos: ped as Pedido[], totalCount: count || 0 };
      } else {
        const errTxt = await res.text();
        console.error('[fetchPedidos] Erro na resposta do servidor:', res.status, errTxt);
      }
    } catch (e) {
      console.error('[fetchPedidos] Falha catastrófica no direct fetch:', e);
    }
  }

  // Fallback: Supabase-JS
  console.log('[fetchPedidos] Usando fallback Supabase-JS');
  let query = supabase
    .from('pedidos')
    .select('*,clientes(id,nome,telefone,email,endereco),pedido_items(*),pedido_servicos(*),pedido_status_history(*)', { count: 'exact' });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else {
    query = query.eq('user_id', userId);
  }

  query = query.order('order_number', { ascending: false }).range(start, start + limit - 1);

  if (filterStatus === 'pendente-pagamento') {
    query = query.not('status', 'in', '(pago,cancelado,entregue)');
  } else if (filterStatus !== 'todos') {
    query = query.eq('status', filterStatus);
  }

  if (filterDateRange?.from) query = query.gte('created_at', filterDateRange.from.toISOString());
  if (filterDateRange?.to) {
    const d = new Date(filterDateRange.to);
    d.setHours(23, 59, 59, 999);
    query = query.lte('created_at', d.toISOString());
  }

  if (filterClientId) {
    query = query.eq('cliente_id', filterClientId);
  } else if (trimmedSearchTerm) {
    if (!isNaN(Number(trimmedSearchTerm))) {
      query = query.or(`order_number.eq.${Number(trimmedSearchTerm)},observacoes.ilike.%${trimmedSearchTerm}%`);
    } else {
      let clientQ = supabase.from('clientes').select('id');
      if (organizationId) clientQ = clientQ.eq('organization_id', organizationId);
      else clientQ = clientQ.eq('user_id', userId);

      const { data: cls } = await clientQ.or(`nome.ilike.%${trimmedSearchTerm}%,email.ilike.%${trimmedSearchTerm}%`).limit(100);

      if (cls && cls.length > 0) {
        query = query.in('cliente_id', cls.map(c => c.id));
      } else {
        query = query.ilike('observacoes', `%${trimmedSearchTerm}%`);
      }
    }
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const ped = (data || []).map(p => ({
    ...p,
    pedido_items: (p.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
    servicos: p.pedido_servicos || [],
    status_history: (p.pedido_status_history || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }));

  return { pedidos: ped as Pedido[], totalCount: count || 0 };
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

  return useQuery<PaginatedPedidosResult>({
    queryKey: ["pedidos", userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId],
    queryFn: async () => {
      if (!userId) throw new Error("Invalid session");
      return await fetchPedidos(supabase, userId, page, limit, filterStatus, filterDateRange, filterClientId, searchTerm, organizationId, accessToken);
    },
    enabled: !sessionLoading && !!userId && !!supabase,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const usePedidos = () => {
  const { supabase, session, organizationId, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id;

  const fetchAllPedidos = async (userId: string): Promise<Pedido[]> => {
    let query = supabase
      .from('pedidos')
      .select('*,clientes(id,nome,telefone,email,endereco),pedido_items(*),pedido_servicos(*),pedido_status_history(*)');

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('order_number', { ascending: false });

    if (error) throw error;
    return (data || []).map(p => ({
      ...p,
      pedido_items: (p.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)),
      servicos: p.pedido_servicos || [],
      status_history: (p.pedido_status_history || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    })) as Pedido[];
  };

  return useQuery<Pedido[]>({
    queryKey: ["all-pedidos-unpaginated", organizationId || userId],
    queryFn: () => fetchAllPedidos(userId!),
    enabled: !sessionLoading && !!userId && !!supabase,
    staleTime: 0,
  });
};

// --- Fetch Tipos de Producao ---
const fetchTiposProducao = async (token: string, userId: string, organizationId: string | null): Promise<TipoProducao[]> => {
  const params = new URLSearchParams({
    select: "*,tipo_producao_insumos(*,insumos(nome,unidade))",
    order: "order_index.asc,nome.asc",
  });
  if (organizationId) {
    params.append("organization_id", `eq.${organizationId}`);
  } else {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<TipoProducao>(token, "tipos_producao", params);
};

export const useTiposProducao = () => {
  const { session, organizationId, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const isEnabled = !sessionLoading && !!accessToken && !!userId;

  return useQuery<TipoProducao[]>({
    queryKey: ["tipos_producao", organizationId || userId],
    queryFn: () => {
      if (!accessToken || !userId) throw new Error("Authentication missing.");
      return fetchTiposProducao(accessToken, userId, organizationId);
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });
};

export const useAddTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();

  return useMutation({
    mutationFn: async (newTipo: Omit<TipoProducao, "id" | "user_id" | "created_at">) => {
      if (!session?.user?.id || !supabase) throw new Error("Autenticação necessária");
      const { data, error } = await supabase
        .from("tipos_producao")
        .insert([{ ...newTipo, user_id: session.user.id, organization_id: profile?.organization_id }])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos_producao"] }),
  });
};

export const useUpdateTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase, profile } = useSession();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<TipoProducao> & { id: string }) => {
      if (!supabase) throw new Error("Cliente Supabase não inicializado");
      const { data, error } = await supabase
        .from("tipos_producao")
        .update({ ...updateData, organization_id: profile?.organization_id })
        .eq("id", id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos_producao"] }),
  });
};

export const useDeleteTipoProducao = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Cliente Supabase não inicializado");
      const { error } = await supabase.from("tipos_producao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos_producao"] }),
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
        .insert([{ ...newLink, user_id: session.user.id, organization_id: profile?.organization_id }])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos_producao"] }),
  });
};

export const useDeleteTipoProducaoInsumo = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase não disponível");
      const { error } = await supabase.from("tipo_producao_insumos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos_producao"] }),
  });
};

const fetchServiceShortcuts = async (token: string, userId: string, organizationId: string | null): Promise<ServiceShortcut[]> => {
  const params = new URLSearchParams({
    select: "*",
    order: "is_pinned.desc,usage_count.desc,nome.asc",
  });
  if (organizationId) {
    params.append("organization_id", `eq.${organizationId}`);
  } else {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<ServiceShortcut>(token, "service_shortcuts", params);
};

export const useServiceShortcuts = () => {
  const { session, organizationId, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const isEnabled = !sessionLoading && !!accessToken && !!userId;

  return useQuery<ServiceShortcut[]>({
    queryKey: ["service_shortcuts", organizationId || userId],
    queryFn: () => {
      if (!accessToken || !userId) throw new Error("Authentication missing.");
      return fetchServiceShortcuts(accessToken, userId, organizationId);
    },
    enabled: isEnabled,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: true,
  });
};

export const useAddServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();

  return useMutation({
    mutationFn: async (newShortcut: NewServiceShortcut) => {
      if (!session?.user?.id || !supabase) throw new Error("Autenticação necessária");
      const { data, error } = await supabase
        .from("service_shortcuts")
        .insert([{ ...newShortcut, user_id: session.user.id, organization_id: profile?.organization_id }])
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] }),
  });
};

export const useUpdateServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<ServiceShortcut> & { id: string }) => {
      if (!supabase) throw new Error("Supabase missing");
      const { data, error } = await supabase
        .from("service_shortcuts")
        .update(updateData)
        .eq("id", id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] }),
  });
};

export const useDeleteServiceShortcut = () => {
  const queryClient = useQueryClient();
  const { supabase } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase missing");
      const { error } = await supabase.from("service_shortcuts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] }),
  });
};

export const useIncrementServiceUsage = () => {
  const queryClient = useQueryClient();
  const { supabase, session, profile } = useSession();

  return useMutation({
    mutationFn: async ({ nome, valor }: { nome: string, valor: number }) => {
      if (!session?.user?.id || !supabase) return;

      let query = supabase
        .from("service_shortcuts")
        .select("id, usage_count")
        .eq("nome", nome);

      if (profile?.organization_id) {
        query = query.eq('organization_id', profile.organization_id);
      } else {
        query = query.eq('user_id', session.user.id);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        await supabase
          .from("service_shortcuts")
          .update({
            usage_count: (existing.usage_count || 0) + 1,
            last_used: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("service_shortcuts")
          .insert([{
            nome,
            valor,
            user_id: session.user.id,
            organization_id: profile?.organization_id,
            usage_count: 1,
            last_used: new Date().toISOString()
          }]);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service_shortcuts"] }),
  });
};

const fetchInsumos = async (token: string, userId: string, organizationId: string | null): Promise<Insumo[]> => {
  const params = new URLSearchParams({ select: "*", order: "nome.asc" });
  if (organizationId) {
    params.append("organization_id", `eq.${organizationId}`);
  } else {
    params.append("user_id", `eq.${userId}`);
  }
  return fetchTable<Insumo>(token, "insumos", params);
};

export const useInsumos = () => {
  const { session, organizationId, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  const isEnabled = !sessionLoading && !!accessToken && !!userId;

  return useQuery<Insumo[]>({
    queryKey: ["insumos", organizationId || userId],
    queryFn: () => {
      if (!accessToken || !userId) throw new Error("Authentication missing.");
      return fetchInsumos(accessToken, userId, organizationId);
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  });
};

export const isInventoryConsumingStatus = (status: string): boolean => {
  const consumingStatuses = ['processando', 'enviado', 'entregue', 'pago', 'aguardando retirada'];
  return consumingStatuses.includes(status.toLowerCase());
};

export const deductInsumosFromPedido = async (pedido: Pedido) => {
  if (!supabase) return;
  try {
    const items = pedido.pedido_items || [];
    if (items.length === 0) return;
    for (const item of items) {
      const temp_insumos: { insumo_id: string; consumo: number }[] = [];
      let resolvedTipo = item.tipo;

      if (item.produto_id) {
        const { data: prod } = await supabase.from('produtos').select('id, tipo, produto_insumos(insumo_id, consumo)').eq('id', item.produto_id).single();
        if (prod) {
          temp_insumos.push(...((prod as any).produto_insumos || []));
          if (prod.tipo) resolvedTipo = prod.tipo;
        }
      }

      if (resolvedTipo) {
        let q = supabase.from('tipos_producao').select('id').ilike('nome', resolvedTipo).eq('is_active', true);
        if (pedido.organization_id) q = q.eq('organization_id', pedido.organization_id);
        else q = q.eq('user_id', pedido.user_id);
        const { data: tipo } = await q.maybeSingle();
        if (tipo) {
          const { data: ti } = await supabase.from('tipo_producao_insumos').select('insumo_id, consumo').eq('tipo_producao_id', tipo.id);
          if (ti) temp_insumos.push(...ti);
        }
      }

      if (temp_insumos.length === 0) continue;
      const grouped = temp_insumos.reduce((acc, curr) => {
        const ex = acc.find(i => i.insumo_id === curr.insumo_id);
        if (ex) ex.consumo += Number(curr.consumo);
        else acc.push({ ...curr, consumo: Number(curr.consumo) });
        return acc;
      }, [] as { insumo_id: string; consumo: number }[]);

      for (const pi of grouped) {
        const { data: ins } = await supabase.from('insumos').select('id, quantidade_atual').eq('id', pi.insumo_id).single();
        if (!ins) continue;
        const total = Number(pi.consumo) * Number(item.quantidade);
        const { error: rpcErr } = await supabase.rpc('update_insumo_quantity_atomic', { p_insumo_id: ins.id, p_quantity_change: -total });
        if (rpcErr) {
          await supabase.from('insumos').update({ quantidade_atual: (ins.quantidade_atual || 0) - total }).eq('id', ins.id);
        }
      }
    }
  } catch (err) { console.error('[Inventory] Erro no abate:', err); }
};

export const restoreInsumosFromPedido = async (pedido: Pedido) => {
  if (!supabase) return;
  try {
    const items = pedido.pedido_items || [];
    for (const item of items) {
      const temp_insumos: { insumo_id: string; consumo: number }[] = [];
      let resolvedTipo = item.tipo;
      if (item.produto_id) {
        const { data: prod } = await supabase.from('produtos').select('id, tipo, produto_insumos(insumo_id, consumo)').eq('id', item.produto_id).single();
        if (prod) {
          temp_insumos.push(...((prod as any).produto_insumos || []));
          if (prod.tipo) resolvedTipo = prod.tipo;
        }
      }
      if (resolvedTipo) {
        let q = supabase.from('tipos_producao').select('id').ilike('nome', resolvedTipo).eq('is_active', true);
        if (pedido.organization_id) q = q.eq('organization_id', pedido.organization_id);
        else q = q.eq('user_id', pedido.user_id);
        const { data: tipo } = await q.maybeSingle();
        if (tipo) {
          const { data: ti } = await supabase.from('tipo_producao_insumos').select('insumo_id, consumo').eq('tipo_producao_id', tipo.id);
          if (ti) temp_insumos.push(...ti);
        }
      }
      if (temp_insumos.length === 0) continue;
      const grouped = temp_insumos.reduce((acc, curr) => {
        const ex = acc.find(i => i.insumo_id === curr.insumo_id);
        if (ex) ex.consumo += Number(curr.consumo);
        else acc.push({ ...curr, consumo: Number(curr.consumo) });
        return acc;
      }, [] as { insumo_id: string; consumo: number }[]);
      for (const pi of grouped) {
        const { data: ins } = await supabase.from('insumos').select('id, quantidade_atual').eq('id', pi.insumo_id).single();
        if (!ins) continue;
        const total = Number(pi.consumo) * Number(item.quantidade);
        await supabase.from('insumos').update({ quantidade_atual: (ins.quantidade_atual || 0) + total }).eq('id', ins.id);
      }
    }
  } catch (err) { console.error('[Inventory] Erro no estorno:', err); }
};

export const useTransportadoras = () => {
  const { supabase, session, organizationId, isLoading: sessionLoading } = useSession();
  const userId = session?.user?.id;
  return useQuery<{ id: string; nome: string }[]>({
    queryKey: ["transportadoras", organizationId || userId],
    queryFn: async () => {
      if (!supabase || !userId) throw new Error("Supabase missing");
      let query = supabase.from("transportadoras").select("id, nome");

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order("nome", { ascending: true });
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
      if (!supabase || !session?.user?.id) throw new Error("Supabase missing");

      let query = supabase.from("transportadoras").select("id").eq("nome", nome);
      if (profile?.organization_id) {
        query = query.eq('organization_id', profile.organization_id);
      } else {
        query = query.eq('user_id', session.user.id);
      }

      const { data: existing } = await query.maybeSingle();
      if (existing) return existing;

      const { data, error } = await supabase
        .from("transportadoras")
        .insert([{
          nome,
          user_id: session.user.id,
          organization_id: profile?.organization_id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transportadoras"] }),
  });
};
