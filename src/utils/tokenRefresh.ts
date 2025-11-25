import { supabase } from '@/integrations/supabase/client';

let refreshTimer: NodeJS.Timeout | null = null;

/**
 * Configura refresh automático do token antes de expirar
 * Tokens do Supabase expiram em 1 hora por padrão
 */
export const setupTokenRefresh = () => {
    // Limpar timer anterior se existir
    if (refreshTimer) {
        clearTimeout(refreshTimer);
    }

    const refreshToken = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.log('[TokenRefresh] No session found, skipping refresh');
                return;
            }

            // Calcular tempo até expiração
            const expiresAt = session.expires_at;
            if (!expiresAt) {
                console.warn('[TokenRefresh] No expiration time found');
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = expiresAt - now;

            // Se o token expira em menos de 10 minutos (600 segundos), fazer refresh IMEDIATO
            if (timeUntilExpiry < 600) {
                console.log(`[TokenRefresh] Token expires in ${Math.floor(timeUntilExpiry / 60)} minutes, refreshing NOW...`);

                const { data, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError) {
                    console.error('[TokenRefresh] Error refreshing token:', refreshError);
                    // Se falhar, tentar novamente em 1 minuto
                    refreshTimer = setTimeout(refreshToken, 60 * 1000);
                } else {
                    console.log('[TokenRefresh] Token refreshed successfully');
                    // Agendar próximo refresh
                    setupTokenRefresh();
                }
                return;
            }

            // Refresh 5 minutos antes de expirar (300 segundos)
            const refreshIn = Math.max(0, (timeUntilExpiry - 300) * 1000);

            console.log(`[TokenRefresh] Token will be refreshed in ${Math.floor(refreshIn / 1000 / 60)} minutes`);

            // Agendar próximo refresh
            refreshTimer = setTimeout(async () => {
                console.log('[TokenRefresh] Refreshing token...');
                const { data, error: refreshError } = await supabase.auth.refreshSession();

                if (refreshError) {
                    console.error('[TokenRefresh] Error refreshing token:', refreshError);
                    // Se falhar, tentar novamente em 1 minuto
                    refreshTimer = setTimeout(refreshToken, 60 * 1000);
                } else {
                    console.log('[TokenRefresh] Token refreshed successfully');
                    // Agendar próximo refresh
                    setupTokenRefresh();
                }
            }, refreshIn);
        } catch (error) {
            console.error('[TokenRefresh] Exception:', error);
        }
    };

    refreshToken();
};

/**
 * Limpa o timer de refresh (útil para cleanup)
 */
export const clearTokenRefresh = () => {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
};
