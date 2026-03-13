-- 1. Definição do conjunto de status que consomem estoque
-- 'processando', 'enviado', 'entregue', 'pago', 'aguardando retirada'

CREATE OR REPLACE FUNCTION is_inventory_consuming(status_val text) RETURNS boolean AS $$
BEGIN
    RETURN status_val IN ('processando', 'enviado', 'entregue', 'pago', 'aguardando retirada');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Função Robusta para Gerenciamento de Estoque via Trigger
CREATE OR REPLACE FUNCTION handle_inventory_on_status_change() RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    insumo_link RECORD;
    is_old_consuming boolean;
    is_new_consuming boolean;
    quantity_factor float8;
BEGIN
    is_old_consuming := is_inventory_consuming(OLD.status);
    is_new_consuming := is_inventory_consuming(NEW.status);

    -- Se o status não mudou de categoria de consumo, não faz nada
    -- (Ex: de 'processando' para 'pago' já está consumido, não mexe)
    IF is_old_consuming = is_new_consuming THEN
        RETURN NEW;
    END IF;

    -- Se entrou no conjunto de consumo -> Dedução (fator -1)
    -- Se saiu do conjunto de consumo -> Restauração (fator +1)
    IF is_new_consuming THEN
        quantity_factor := -1.0;
    ELSE
        quantity_factor := 1.0;
    END IF;

    -- Loop pelos itens do pedido
    FOR item IN SELECT * FROM pedido_items WHERE pedido_id = NEW.id LOOP
        
        -- A. Tentar buscar insumos vinculados via PRODUTO
        IF item.produto_id IS NOT NULL THEN
            FOR insumo_link IN SELECT * FROM produto_insumos WHERE produto_id = item.produto_id LOOP
                PERFORM update_insumo_quantity_atomic(
                    insumo_link.insumo_id, 
                    (insumo_link.consumo * item.quantidade * quantity_factor),
                    NEW.id,
                    CASE WHEN quantity_factor < 0 THEN 'Dedução automática (Status: ' || NEW.status || ')' ELSE 'Restauração automática (Status: ' || NEW.status || ')' END
                );
            END LOOP;
        END IF;

        -- B. Se não encontrou vínculos no produto, ou idependente disso (dependendo do design),
        -- buscar via TIPO DE PRODUÇÃO (se houver tipo)
        -- Aqui o design atual do app prioriza produto_insumos, se vazio usa tipo_producao_insumos.
        IF NOT EXISTS (SELECT 1 FROM produto_insumos WHERE produto_id = item.produto_id) THEN
            FOR insumo_link IN 
                SELECT tpi.insumo_id, tpi.consumo 
                FROM tipos_producao tp 
                JOIN tipo_producao_insumos tpi ON tp.id = tpi.tipo_producao_id
                WHERE (tp.nome ILIKE item.tipo OR (item.produto_id IS NOT NULL AND tp.nome = (SELECT tipo FROM produtos WHERE id = item.produto_id)))
                AND tp.user_id = NEW.user_id
                AND tp.is_active = true
            LOOP
                PERFORM update_insumo_quantity_atomic(
                    insumo_link.insumo_id, 
                    (insumo_link.consumo * item.quantidade * quantity_factor),
                    NEW.id,
                    CASE WHEN quantity_factor < 0 THEN 'Dedução via Categoria (Status: ' || NEW.status || ')' ELSE 'Restauração via Categoria (Status: ' || NEW.status || ')' END
                );
            END LOOP;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar Trigger
DROP TRIGGER IF EXISTS trigger_deduct_stock ON pedidos;
CREATE TRIGGER trg_inventory_status_change
    AFTER UPDATE ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_inventory_on_status_change();

-- 4. Limpeza de triggers obsoletos se existirem
DROP TRIGGER IF EXISTS on_order_payment_confirmed ON pedidos;
