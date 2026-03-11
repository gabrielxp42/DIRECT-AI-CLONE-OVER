-- Migração para Auditoria de Insumos
-- Criar tabela de logs de inventário
CREATE TABLE IF NOT EXISTS inventory_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
    tipo_movimentacao TEXT NOT NULL CHECK (tipo_movimentacao IN ('entrada', 'saida', 'ajuste', 'estorno', 'deducao')),
    quantidade NUMERIC NOT NULL,
    quantidade_anterior NUMERIC,
    quantidade_atual NUMERIC,
    pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
    user_id UUID,
    organization_id UUID,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE inventory_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (Simplificadas para seguir o padrão do projeto)
CREATE POLICY "Permitir leitura de logs da própria organização" ON inventory_audit_logs
    FOR SELECT USING (
        auth.uid() = user_id OR 
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Permitir inserção de logs" ON inventory_audit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Função para o Trigger de Auditoria Automática
CREATE OR REPLACE FUNCTION log_inventory_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.quantidade_atual <> NEW.quantidade_atual) THEN
            INSERT INTO inventory_audit_logs (
                insumo_id,
                tipo_movimentacao,
                quantidade,
                quantidade_anterior,
                quantidade_atual,
                user_id,
                organization_id,
                observacao
            ) VALUES (
                NEW.id,
                CASE 
                    WHEN NEW.quantidade_atual > OLD.quantidade_atual THEN 'entrada'
                    ELSE 'saida'
                END,
                ABS(NEW.quantidade_atual - OLD.quantidade_atual),
                OLD.quantidade_atual,
                NEW.quantidade_atual,
                NEW.user_id,
                NULL,
                'Atualização automática via sistema'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para capturar mudanças manuais ou via update direto
DROP TRIGGER IF EXISTS trg_log_inventory_change ON insumos;
CREATE TRIGGER trg_log_inventory_change
AFTER UPDATE ON insumos
FOR EACH ROW
EXECUTE FUNCTION log_inventory_change();
