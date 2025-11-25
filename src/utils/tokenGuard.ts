import { supabase } from '@/integrations/supabase/client';

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Verifica se o token está próximo de expirar e faz refresh se necessário
 * Retorna uma Promise que resolve quando o token está válido
 */
export const ensureValidToken = async (): Promise<void> => {
    try {
        // Se já está fazendo refresh, aguardar a Promise existente
        if (isRefreshing && refreshPromise) {
            console.log('[TokenGuard] Refresh já em andamento, aguardando...');
            await refreshPromise;
            return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            console.log('[TokenGuard] No session found');
            return;
        }

        const expiresAt = session.expires_at;
        if (!expiresAt) {
            console.warn('[TokenGuard] No expiration time found');
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;

        // Se o token expira em menos de 2 minutos (120 segundos), fazer refresh IMEDIATO
        if (timeUntilExpiry < 120) {
            console.log(`[TokenGuard] Token expires in ${timeUntilExpiry}s, refreshing NOW...`);

            isRefreshing = true;
            refreshPromise = (async () => {
                try {
                    const { data, error: refreshError } = await supabase.auth.refreshSession();

                    if (refreshError) {
                        console.error('[TokenGuard] Error refreshing token:', refreshError);
                        throw refreshError;
                    }

                    console.log('[TokenGuard] Token refreshed successfully');
                } finally {
                    isRefreshing = false;
                    refreshPromise = null;
                }
            })();

            await refreshPromise;
        }
    } catch (error) {
        console.error('[TokenGuard] Exception:', error);
        isRefreshing = false;
        refreshPromise = null;
    }
};
