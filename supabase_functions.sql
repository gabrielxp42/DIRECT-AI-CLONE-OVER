-- Função para encontrar cliente por nome fuzzy usando pg_trgm e unaccent
CREATE OR REPLACE FUNCTION find_client_by_fuzzy_name(
    partial_name TEXT,
    similarity_threshold REAL DEFAULT 0.2
)
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.nome
    FROM clientes c
    WHERE similarity(lower(unaccent(c.nome)), lower(unaccent(partial_name))) >= similarity_threshold
    ORDER BY similarity(lower(unaccent(c.nome)), lower(unaccent(partial_name))) DESC
    LIMIT 5;
END;
$$;

-- Função para obter o UUID completo de um pedido dado o seu número sequencial
CREATE OR REPLACE FUNCTION get_order_uuid_by_number(
    p_order_number INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    order_uuid UUID;
BEGIN
    SELECT id INTO order_uuid
    FROM pedidos
    WHERE order_number = p_order_number
    LIMIT 1;

    RETURN order_uuid;
END;
$$;

-- Função para calcular o total de metros lineares por período
CREATE OR REPLACE FUNCTION get_total_meters_by_period(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_meters NUMERIC,
    total_orders INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(p.total_metros), 0)::NUMERIC as total_meters,
        COUNT(p.id)::INTEGER as total_orders
    FROM pedidos p
    WHERE p.created_at >= p_start_date
      AND p.created_at <= p_end_date
      AND p.status != 'cancelado';
END;
$$;