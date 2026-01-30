-- Adicionar campo de cor primária customizável ao perfil da empresa
-- Isso permite White Label completo: logo + cor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_primary_color TEXT DEFAULT '#FFF200';

COMMENT ON COLUMN profiles.company_primary_color IS 'Cor primária customizada da empresa (hex). Default: amarelo Direct AI';
