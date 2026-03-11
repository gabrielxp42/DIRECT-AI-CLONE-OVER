-- Trigger para alertar sobre estoque baixo de insumos via Gabi Executiva
CREATE OR REPLACE FUNCTION generate_insumo_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_msg_title TEXT;
    v_msg_desc TEXT;
BEGIN
    -- Só dispara se cair abaixo da média E antes estava acima (evita repetições a cada pequena mudança negativa)
    IF (NEW.quantidade_atual <= NEW.quantidade_minima) AND (OLD.quantidade_atual > OLD.quantidade_minima OR OLD.quantidade_atual IS NULL) THEN
        
        v_msg_title := '⚠️ Alerta de Estoque: ' || NEW.nome;
        v_msg_desc := '*Chefe, o estoque está acabando!* 🚨' || chr(10) || chr(10) ||
                      'O insumo *' || NEW.nome || '* atingiu o nível crítico.' || chr(10) ||
                      '• Estoque Atual: *' || NEW.quantidade_atual || ' ' || NEW.unidade || '*' || chr(10) ||
                      '• Mínimo Sugerido: *' || NEW.quantidade_minima || ' ' || NEW.unidade || '*' || chr(10) || chr(10) ||
                      'Melhor repor logo para não parar a produção! 🛠️';

        INSERT INTO agent_insights (
            user_id,
            insight_type,
            title,
            description,
            metadata
        ) VALUES (
            NEW.user_id,
            'executive_alert',
            v_msg_title,
            v_msg_desc,
            jsonb_build_object('type', 'stock', 'insumo_id', NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar o trigger na tabela de insumos
DROP TRIGGER IF EXISTS trg_insumos_low_stock_alert ON insumos;
CREATE TRIGGER trg_insumos_low_stock_alert
AFTER UPDATE ON insumos
FOR EACH ROW
EXECUTE FUNCTION generate_insumo_stock_alert();
