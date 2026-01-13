-- ============================================
-- MIGRATION: Add Company Profile Fields to Profiles Table
-- Execute this in Supabase SQL Editor
-- ============================================

-- Add company profile fields to existing profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'Minha Empresa';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_slogan TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_whatsapp TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_neighborhood TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_zip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_address_complement TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_pix_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_pix_key_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

-- Add comments to document the purpose
COMMENT ON COLUMN profiles.company_name IS 'Nome da empresa do usuário';
COMMENT ON COLUMN profiles.company_logo_url IS 'URL da logo no Supabase Storage';
COMMENT ON COLUMN profiles.company_pix_key IS 'Chave PIX para recebimentos';
COMMENT ON COLUMN profiles.company_pix_key_type IS 'Tipo da chave PIX: cpf, cnpj, email, phone, random';

-- ============================================
-- STORAGE BUCKET: Create bucket for company logos
-- Execute this separately in Storage section or via SQL
-- ============================================

-- Create storage bucket for company logos (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload their logo" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to update their own logos
CREATE POLICY "Users can update their logo" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own logos
CREATE POLICY "Users can delete their logo" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to logos
CREATE POLICY "Public can view logos" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'company-logos');
