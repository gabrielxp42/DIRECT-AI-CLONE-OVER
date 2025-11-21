-- 1. Adicionar colunas na tabela produtos para vincular ao insumo
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS insumo_id UUID REFERENCES insumos(id),
ADD COLUMN IF NOT EXISTS consumo_insumo FLOAT DEFAULT 0;

-- 2. Função para abater estoque automaticamente
-- Esta função deve ser chamada quando um pedido muda para 'processando' ou 'entregue'
-- Ou pode ser chamada manualmente via API
CREATE OR REPLACE FUNCTION abater_estoque_pedido(p_pedido_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_produto RECORD;
    v_insumo_nome TEXT;
    v_qtd_abatida FLOAT;
    v_log JSONB := '[]'::JSONB;
BEGIN
    -- Loop pelos itens do pedido
    FOR v_item IN 
        SELECT * FROM pedido_items WHERE pedido_id = p_pedido_id
    LOOP
        -- Buscar dados do produto
        SELECT * INTO v_produto FROM produtos WHERE id = v_item.produto_id;
        
        -- Se o produto usa insumo e tem consumo definido
        IF v_produto.insumo_id IS NOT NULL AND v_produto.consumo_insumo > 0 THEN
            v_qtd_abatida := (v_item.quantidade * v_produto.consumo_insumo);
            
            -- Atualizar estoque do insumo
            UPDATE insumos
            SET quantidade_atual = quantidade_atual - v_qtd_abatida
            WHERE id = v_produto.insumo_id
            RETURNING nome INTO v_insumo_nome;
            
            -- Adicionar ao log
            v_log := v_log || jsonb_build_object(
                'produto', v_produto.nome,
                'insumo', v_insumo_nome,
                'qtd_abatida', v_qtd_abatida
            );
        END IF;
    END LOOP;
    
    RETURN v_log;
END;
$$ LANGUAGE plpgsql;
