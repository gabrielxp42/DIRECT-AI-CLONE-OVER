-- ============================================
-- MIGRATION: Add detailed shipping fields to Clientes
-- ============================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado TEXT;
