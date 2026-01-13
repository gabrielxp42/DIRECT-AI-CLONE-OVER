-- Securing the 'plans' table
-- Vulnerability: Currently 'plans' has rowsecurity = false (Open to world potentially)
-- Impact: Hackers could modify plan prices or names to confuse users.

-- 1. Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy: Everyone can READ plans (public pricing table)
-- We use 'true' to allow anyone to see the plans, or 'auth.role() = "authenticated"' if it's private.
-- Let's make it public so the landing page can potentially fetch it too.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.plans;
CREATE POLICY "Enable read access for all users" ON public.plans
FOR SELECT
USING (true);

-- 3. Create Policy: ONLY Service Role (Admin/Backend) can MODIFY
-- We effectively DO NOT create a policy for INSERT/UPDATE/DELETE for 'public' or 'authenticated' roles.
-- By default, if no allowed policy exists, the action is denied.
-- The 'service_role' bypasses RLS automatically, so no policy needed for it explicitly, 
-- BUT explicit deny for others is the default behavior of RLS.

-- Confirmation
SELECT 'Tabela plans blindada com sucesso.' as result;
