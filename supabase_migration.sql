-- Criar tabela para histórico de mudanças de status dos pedidos
CREATE TABLE IF NOT EXISTS pedido_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    status_anterior TEXT NOT NULL,
    status_novo TEXT NOT NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pedido_status_history_pedido_id ON pedido_status_history(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_status_history_created_at ON pedido_status_history(created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE pedido_status_history ENABLE ROW LEVEL SECURITY;

-- Política para permitir que usuários vejam apenas seus próprios registros
CREATE POLICY "Users can view their own status history" ON pedido_status_history
    FOR SELECT USING (user_id = auth.uid());

-- Política para permitir que usuários insiram registros
CREATE POLICY "Users can insert their own status history" ON pedido_status_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Função para automaticamente registrar mudanças de status
CREATE OR REPLACE FUNCTION log_pedido_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Só registra se o status realmente mudou
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO pedido_status_history (
            pedido_id,
            status_anterior,
            status_novo,
            user_id
        ) VALUES (
            NEW.id,
            COALESCE(OLD.status, 'novo'),
            NEW.status,
            NEW.user_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para automaticamente registrar mudanças de status
DROP TRIGGER IF EXISTS trigger_log_pedido_status_change ON pedidos;
CREATE TRIGGER trigger_log_pedido_status_change
    AFTER UPDATE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION log_pedido_status_change();

-- Habilitar extensões para busca fuzzy e remoção de acentos
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;