-- RPC para listar pedidos com detalhes simplificados para a IA
CREATE OR REPLACE FUNCTION public.get_orders_summary(
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_user_id UUID DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    order_number INTEGER,
    cliente_nome TEXT,
    valor_total NUMERIC,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.order_number,
        c.nome as cliente_nome,
        p.valor_total,
        p.status,
        p.created_at
    FROM 
        public.pedidos p
    LEFT JOIN 
        public.clientes c ON p.cliente_id = c.id
    WHERE 
        (p_status IS NULL OR p.status = p_status)
        AND (p_user_id IS NULL OR p.user_id = p_user_id)
        AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
    ORDER BY 
        p.created_at DESC
    LIMIT p_limit;
END;
$$;

-- RPC para buscar detalhes completos de um pedido específico
CREATE OR REPLACE FUNCTION public.get_order_details_v2(
    p_order_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'pedido', p.*,
        'cliente', c.*,
        'items', (SELECT json_agg(i.*) FROM pedido_items i WHERE i.pedido_id = p.id)
    ) INTO result
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.id = p_order_id;
    
    RETURN result;
END;
$$;
