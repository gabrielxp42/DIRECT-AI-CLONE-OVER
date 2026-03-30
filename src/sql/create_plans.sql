-- Criar tabela de planos se não existir
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL,
    stripe_price_id TEXT UNIQUE, -- Usado como plan_key no sistema (ex: PRO, PRO_MAX, DIRECT_AI_MONTHLY)
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir Planos do DTF Factory
INSERT INTO public.plans (name, description, price, stripe_price_id, features)
VALUES 
('DTF Factory Pro Mensal', 'Acesso completo ao DTF Factory com renovação mensal', 97.00, 'PRO', '["Montador Inteligente", "Upscaler 8x", "Galeria em Nuvem"]'::jsonb),
('DTF Factory Pro Anual', 'Acesso completo ao DTF Factory com renovação anual (Desconto aplicado)', 931.20, 'PRO_YEARLY', '["Montador Inteligente", "Upscaler 8x", "Galeria em Nuvem", "Suporte Prioritário"]'::jsonb)
ON CONFLICT (stripe_price_id) DO UPDATE 
SET price = EXCLUDED.price, name = EXCLUDED.name;

-- Inserir Planos do Direct AI
INSERT INTO public.plans (name, description, price, stripe_price_id, features)
VALUES 
('Direct AI Mensal', 'Geração ilimitada de artes AI, Assistente Gabi, automação de WhatsApp', 47.00, 'DIRECT_AI_MONTHLY', '["Geração AI Ilimitada", "Gabi Assistente", "Automação WhatsApp"]'::jsonb),
('Direct AI Anual', 'Geração ilimitada de artes AI, Assistente Gabi, automação de WhatsApp (2 meses grátis)', 470.00, 'DIRECT_AI_YEARLY', '["Geração AI Ilimitada", "Gabi Assistente", "Automação WhatsApp", "Suporte Prioritário"]'::jsonb)
ON CONFLICT (stripe_price_id) DO UPDATE 
SET price = EXCLUDED.price, name = EXCLUDED.name;

-- Habilitar leitura pública para a tabela de planos
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planos são visíveis para todos" 
ON public.plans FOR SELECT 
USING (true);