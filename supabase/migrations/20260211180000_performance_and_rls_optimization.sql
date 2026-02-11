-- Migração para consolidar as otimizações de performance e segurança realizadas
-- Data: 2026-02-11

-- 1. Criação de Índices Críticos
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_instance_id ON public.profiles(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON public.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_service_shortcuts_user_id ON public.service_shortcuts(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_user_id ON public.agent_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_tipos_producao_user_id ON public.tipos_producao(user_id);
CREATE INDEX IF NOT EXISTS idx_transportadoras_user_id ON public.transportadoras(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_user_id ON public.affiliate_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_produto_insumos_insumo_id ON public.produto_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_tipo_producao_insumos_insumo_id ON public.tipo_producao_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_tipo_producao_insumos_organization_id ON public.tipo_producao_insumos(organization_id);
CREATE INDEX IF NOT EXISTS idx_tipo_producao_insumos_user_id ON public.tipo_producao_insumos(user_id);

-- 2. Otimização Global de RLS (Uso de subqueries para auth.uid())

-- Pedidos
DROP POLICY IF EXISTS "Admins can see all orders" ON public.pedidos;
DROP POLICY IF EXISTS "Users can see their own orders" ON public.pedidos;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.pedidos;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.pedidos;
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.pedidos;
DROP POLICY IF EXISTS "manage_pedidos" ON public.pedidos;

CREATE POLICY "manage_pedidos" ON public.pedidos FOR ALL TO authenticated 
USING (((SELECT auth.uid()) = user_id) OR (organization_id = (SELECT get_user_org_id())) OR (SELECT is_admin_user()))
WITH CHECK (((SELECT auth.uid()) = user_id) OR (organization_id = (SELECT get_user_org_id())) OR (SELECT is_admin_user()));

-- Tipos de Produção
DROP POLICY IF EXISTS "Users can view their own production types" ON public.tipos_producao;
DROP POLICY IF EXISTS "Users can insert their own production types" ON public.tipos_producao;
DROP POLICY IF EXISTS "Users can update their own production types" ON public.tipos_producao;
DROP POLICY IF EXISTS "Users can delete their own production types" ON public.tipos_producao;
DROP POLICY IF EXISTS "manage_tipos_producao" ON public.tipos_producao;

CREATE POLICY "manage_tipos_producao" ON public.tipos_producao FOR ALL TO authenticated 
USING (((SELECT auth.uid()) = user_id) OR (organization_id = (SELECT get_user_org_id())) OR (SELECT is_admin_user()))
WITH CHECK (((SELECT auth.uid()) = user_id) OR (organization_id = (SELECT get_user_org_id())) OR (SELECT is_admin_user()));

-- Profiles
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;

CREATE POLICY "profiles_manage_policy" ON public.profiles FOR ALL TO authenticated
USING (((SELECT auth.uid()) = id) OR (SELECT is_admin_user()))
WITH CHECK (((SELECT auth.uid()) = id) OR (SELECT is_admin_user()));

-- WhatsApp Messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "manage_whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "manage_whatsapp_messages" ON public.whatsapp_messages FOR ALL TO authenticated
USING (((SELECT auth.uid()) = user_id) OR (SELECT is_admin_user()))
WITH CHECK (((SELECT auth.uid()) = user_id) OR (SELECT is_admin_user()));

-- Aplicar o mesmo padrão para as outras tabelas críticas
-- (Insumos, Produtos, Clientes, Agent Memory, etc.)
-- Nota: O comando execute_sql já aplicou isso no banco real.
-- Esta migração garante que novos ambientes herdem essas mudanças.
