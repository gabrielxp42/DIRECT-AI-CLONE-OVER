-- ============================================
-- MIGRATION: Add Gabi Profile Fields and DTF settings to Profiles Table
-- Execute this in Supabase SQL Editor
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dtf_roll_width NUMERIC DEFAULT 58.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS origin_zip_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gabi_boss_name TEXT DEFAULT 'Chefe';

-- Add comments
COMMENT ON COLUMN profiles.dtf_roll_width IS 'Largura útil da bobina de DTF em cm';
COMMENT ON COLUMN profiles.origin_zip_code IS 'CEP de origem para cálculo de frete';
COMMENT ON COLUMN profiles.gabi_boss_name IS 'Como a Gabi deve chamar o usuário do sistema';