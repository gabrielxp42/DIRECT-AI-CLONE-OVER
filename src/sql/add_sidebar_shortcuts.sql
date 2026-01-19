-- ============================================
-- MIGRATION: Add Sidebar Shortcuts to Profiles Table
-- Execute this in Supabase SQL Editor
-- ============================================

-- Add sidebar_shortcuts column to profiles table
-- Default shortcuts: calculator, new_pedido, talk_gabi, new_cliente
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS sidebar_shortcuts JSONB 
DEFAULT '["calculator", "new_pedido", "talk_gabi", "new_cliente"]'::jsonb;

-- Update existing profiles that have null sidebar_shortcuts
UPDATE profiles 
SET sidebar_shortcuts = '["calculator", "new_pedido", "talk_gabi", "new_cliente"]'::jsonb
WHERE sidebar_shortcuts IS NULL;

-- Add description for the column
COMMENT ON COLUMN profiles.sidebar_shortcuts IS 'Lista de IDs de ferramentas fixadas no sidebar do usuário';
