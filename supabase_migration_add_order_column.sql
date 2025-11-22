-- Adicionar coluna de ordem na tabela de itens do pedido para garantir a sequência correta
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;
