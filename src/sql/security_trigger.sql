-- Trigger de Segurança para Tabela Profiles
-- Objetivo: Impedir que usuários normais alterem campos sensíveis como 'is_admin' ou 'subscription_status'.
-- Isso protege o sistema mesmo se o hacker manipular o frontend.

-- 1. Função que verifica as permissões antes do UPDATE
CREATE OR REPLACE FUNCTION public.prevent_sensitive_updates()
RETURNS trigger AS $$
BEGIN
  -- Se a role for 'service_role', permite tudo (é o nosso backend/webhook que tem a chave secreta)
  IF (auth.role() = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- BLOQUEIO DE CAMPOS SENSÍVEIS --
  
  -- 1. Status de Admin
  -- Hackers tentam enviar { is_admin: true }
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
    -- Força o valor antigo, ignorando a tentativa de hack silenciosamente OU pode lançar erro.
    -- Vamos lançar erro para ficar claro nos logs de ataque.
    RAISE EXCEPTION 'Acesso Negado: Você não tem permissão para alterar seu nível de acesso.';
  END IF;

  -- 2. Status da Assinatura
  -- Hackers tentam enviar { subscription_status: 'active' } para ter acesso gratis
  IF (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status) THEN
    RAISE EXCEPTION 'Acesso Negado: Status de assinatura gerenciado apenas pelo sistema de pagamentos.';
  END IF;

   -- 3. Plano
  IF (NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier) THEN
    RAISE EXCEPTION 'Acesso Negado: Plano de assinatura gerenciado apenas pelo sistema de pagamentos.';
  END IF;
  
  -- 4. ID do Cliente Stripe
  IF (NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Campo protegido pelo sistema.';
  END IF;

  -- 5. Data de Início do Trial (para evitar reset infinito de trial)
  IF (NEW.trial_start_date IS DISTINCT FROM OLD.trial_start_date) THEN
    RAISE EXCEPTION 'Acesso Negado: Não é permitido alterar a data de início do período de teste.';
  END IF;

  -- Se passou por tudo, permite a atualização dos outros campos (nome, telefone, empresa, etc.)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Aplica a Trigger na tabela
DROP TRIGGER IF EXISTS check_sensitive_updates ON public.profiles;

CREATE TRIGGER check_sensitive_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sensitive_updates();

-- Confirmação
SELECT 'Trigger de segurança aplicada com sucesso.' as result;
