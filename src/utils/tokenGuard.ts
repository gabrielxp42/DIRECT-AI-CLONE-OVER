import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

/**
 * Obtém um token válido, fazendo refresh se necessário
 * Usa APENAS fetch direto e localStorage
 */
export const getValidToken = async (): Promise<string | null> => {
    try {
        // 1. Pegar sessão do localStorage
        const authKey = Object.keys(localStorage).find(key => key.includes('auth-token'));
        if (!authKey) {
            console.warn('[TokenGuard] No auth key found');
            return null;
        }

        const authData = localStorage.getItem(authKey);
        if (!authData) {
            console.warn('[TokenGuard] No auth data found');
            return null;
        }

        let session;
        try {
            session = JSON.parse(authData);
        } catch (e) {
            console.error('[TokenGuard] Failed to parse session');
            return null;
        }

        if (!session?.access_token) {
            console.warn('[TokenGuard] No access token');
            return null;
        }

        // 2. Verificar expiração (com buffer de 2 minutos)
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at || 0;

        // Se ainda é válido por mais de 2 minutos, retorna o atual
        if (expiresAt > now + 120) {
            return session.access_token;
        }

        console.log('[TokenGuard] Token expired or expiring soon. Refreshing via fetch...');

        // 3. Fazer refresh se necessário
        const refreshToken = session.refresh_token;
        if (!refreshToken) {
            console.warn('[TokenGuard] No refresh token available');
            return null;
        }

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
            console.error('[TokenGuard] Refresh failed:', response.status, errorText);
            return null;
        }

        const data = await response.json();

        // 4. Atualizar localStorage
        const newSession = {
            ...session,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: now + data.expires_in,
            expires_in: data.expires_in,
            user: data.user || session.user
        };

        localStorage.setItem(authKey, JSON.stringify(newSession));
        console.log('✅ [TokenGuard] Token refreshed successfully');

        return data.access_token;

    } catch (error) {
        console.error('[TokenGuard] Error getting valid token:', error);
        return null;
    }
};

/**
 * Mantido para compatibilidade, mas agora apenas chama getValidToken
 */
export const ensureValidToken = async (): Promise<void> => {
    await getValidToken();
};
