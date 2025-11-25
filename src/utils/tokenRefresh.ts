/**
 * REFRESH DE TOKEN USANDO FETCH DIRETO
 * Não usa Supabase Client para evitar travamentos no PWA
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

let refreshTimer: NodeJS.Timeout | null = null;
let isRefreshing = false;

/**
 * Faz refresh do token usando APENAS fetch direto
 */
const refreshTokenWithFetch = async (): Promise<boolean> => {
    try {
        // Pegar refresh_token do localStorage
        const authKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
        if (!authKey) {
            console.log('[TokenRefresh] No auth key found in localStorage');
            return false;
        }

        const authData = localStorage.getItem(authKey);
        if (!authData) {
            console.log('[TokenRefresh] No auth data found');
            return false;
        }

        let session;
        try {
            session = JSON.parse(authData);
        } catch (e) {
            console.error('[TokenRefresh] Failed to parse auth data');
            return false;
        }

        const refreshToken = session?.refresh_token;
        if (!refreshToken) {
            console.log('[TokenRefresh] No refresh token found');
            return false;
        }

        console.log('[TokenRefresh] Refreshing token using fetch...');

        // Fazer refresh usando fetch direto ao endpoint do Supabase
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TokenRefresh] Refresh failed:', response.status, errorText);
            return false;
        }

        const data = await response.json();

        // Atualizar localStorage com nova sessão
        const newSession = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            expires_in: data.expires_in,
            token_type: data.token_type,
            user: data.user
        };

        localStorage.setItem(authKey, JSON.stringify(newSession));
        console.log('✅ [TokenRefresh] Token refreshed successfully using fetch');
        return true;

    } catch (error) {
        console.error('[TokenRefresh] Exception during refresh:', error);
        return false;
    }
};

/**
 * Configura refresh automático do token
 */
export const setupTokenRefresh = () => {
    console.log('[TokenRefresh] Setting up automatic token refresh using fetch');

    // Limpar timer anterior se existir
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    const scheduleRefresh = async () => {
        try {
            // Pegar sessão do localStorage
            const authKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
            if (!authKey) {
                console.log('[TokenRefresh] No session found, skipping refresh');
                return;
            }

            const authData = localStorage.getItem(authKey);
            if (!authData) {
                console.log('[TokenRefresh] No auth data found');
                return;
            }

            let session;
            try {
                session = JSON.parse(authData);
            } catch (e) {
                console.warn('[TokenRefresh] Failed to parse session');
                return;
            }

            const expiresAt = session?.expires_at;
            if (!expiresAt) {
                console.warn('[TokenRefresh] No expiration time found');
                return;
            }

            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = expiresAt - now;

            // Se o token expira em menos de 10 minutos, fazer refresh IMEDIATO
            if (timeUntilExpiry < 600) {
                console.log(`[TokenRefresh] Token expires in ${Math.floor(timeUntilExpiry / 60)} minutes, refreshing NOW...`);

                if (!isRefreshing) {
                    isRefreshing = true;
                    const success = await refreshTokenWithFetch();
                    isRefreshing = false;

                    if (success) {
                        // Agendar próximo refresh
                        setupTokenRefresh();
                    } else {
                        // Se falhar, tentar novamente em 1 minuto
                        console.warn('[TokenRefresh] Refresh failed, retrying in 1 minute...');
                        refreshTimer = setTimeout(scheduleRefresh, 60 * 1000);
                    }
                }
                return;
            }

            // Refresh 5 minutos antes de expirar (300 segundos)
            const refreshIn = Math.max(0, (timeUntilExpiry - 300) * 1000);

            console.log(`[TokenRefresh] Token will be refreshed in ${Math.floor(refreshIn / 1000 / 60)} minutes`);

            // Agendar próximo refresh
            refreshTimer = setTimeout(async () => {
                console.log('[TokenRefresh] Executing scheduled refresh...');

                if (!isRefreshing) {
                    isRefreshing = true;
                    const success = await refreshTokenWithFetch();
                    isRefreshing = false;

                    if (success) {
                        // Agendar próximo refresh
                        setupTokenRefresh();
                    } else {
                        // Se falhar, tentar novamente em 1 minuto
                        console.warn('[TokenRefresh] Refresh failed, retrying in 1 minute...');
                        refreshTimer = setTimeout(scheduleRefresh, 60 * 1000);
                    }
                }
            }, refreshIn);

        } catch (error) {
            console.error('[TokenRefresh] Exception in scheduleRefresh:', error);
        }
    };

    scheduleRefresh();
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
