-- Script para adicionar a coluna wasabi_url na tabela pedido_items
-- e resolver o erro "Could not find the 'level' column of 'system_logs'"

-- 1. Adicionar wasabi_url nos itens do pedido
ALTER TABLE pedido_items 
ADD COLUMN IF NOT EXISTS wasabi_url TEXT;

-- 2. Garantir que a tabela system_logs tenha a estrutura correta (com level)
-- Primeiro verificamos se a tabela existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs') THEN
        CREATE TABLE system_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            level TEXT NOT NULL DEFAULT 'info',
            event_type TEXT NOT NULL,
            user_id UUID,
            details JSONB
        );
    ELSE
        -- Se existe, adicionamos a coluna level caso não exista
        ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'info';
        ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
        ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS details JSONB;
    END IF;
END $$;

-- Limpar o cache de schema do PostgREST para o Supabase reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';
