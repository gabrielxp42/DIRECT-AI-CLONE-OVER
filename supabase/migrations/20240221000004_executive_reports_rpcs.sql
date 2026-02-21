-- Drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS public.get_financial_report(timestamp with time zone, timestamp with time zone, uuid, uuid);
DROP FUNCTION IF EXISTS public.get_top_clients_by_period(timestamp with time zone, timestamp with time zone, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_daily_revenue_breakdown(timestamp with time zone, timestamp with time zone, uuid, uuid);

-- RPC para Relatório Financeiro Consolidado (GABI AI)
CREATE OR REPLACE FUNCTION public.get_financial_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_receita NUMERIC,
    total_pedidos BIGINT,
    total_metros NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(p.valor_total), 0)::NUMERIC as total_receita,
        COUNT(p.id)::BIGINT as total_pedidos,
        COALESCE(SUM(p.total_metros), 0)::NUMERIC as total_metros
    FROM 
        public.pedidos p
    WHERE 
        p.created_at >= p_start_date
        AND p.created_at <= p_end_date
        AND p.status != 'cancelado'
        AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
        AND (p_organization_id IS NOT NULL OR p.user_id = p_user_id);
END;
$$;

-- RPC para Ranking de Clientes por Período
CREATE OR REPLACE FUNCTION public.get_top_clients_by_period(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    cliente_nome TEXT,
    total_gasto NUMERIC,
    numero_pedidos BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.nome as cliente_nome,
        SUM(p.valor_total)::NUMERIC as total_gasto,
        COUNT(p.id)::BIGINT as numero_pedidos
    FROM 
        public.pedidos p
    JOIN 
        public.clientes c ON p.cliente_id = c.id
    WHERE 
        p.created_at >= p_start_date
        AND p.created_at <= p_end_date
        AND p.status != 'cancelado'
        AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
        AND (p_organization_id IS NOT NULL OR p.user_id = p_user_id)
    GROUP BY 
        c.id, c.nome
    ORDER BY 
        total_gasto DESC
    LIMIT p_limit;
END;
$$;

-- RPC para Detalhamento de Receita Diária
CREATE OR REPLACE FUNCTION public.get_daily_revenue_breakdown(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    dia DATE,
    receita NUMERIC,
    pedidos BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.created_at::DATE as dia,
        SUM(p.valor_total)::NUMERIC as receita,
        COUNT(p.id)::BIGINT as pedidos
    FROM 
        public.pedidos p
    WHERE 
        p.created_at >= p_start_date
        AND p.created_at <= p_end_date
        AND p.status != 'cancelado'
        AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
        AND (p_organization_id IS NOT NULL OR p.user_id = p_user_id)
    GROUP BY 
        dia
    ORDER BY 
        dia ASC;
END;
$$;
