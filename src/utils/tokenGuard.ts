/**
 * VERSÃO SIMPLIFICADA - SEM SUPABASE CLIENT
 * Apenas verifica se há token no localStorage
 * NÃO faz refresh automático para evitar travamentos no PWA
 */

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

/**
 * Verifica se o token existe no localStorage
 * NÃO faz refresh para evitar travamentos
 */
export const ensureValidToken = async (): Promise<void> => {
    try {
        // Verificar se há sessão no localStorage
        const authData = localStorage.getItem('sb-yfxzjvkjqfxhqxqzxqxq-auth-token');

        if (!authData) {
            console.log('[TokenGuard] No session in localStorage');
            return;
        }

        // Parse da sessão
        let session;
        try {
            const parsed = JSON.parse(authData);
            session = parsed;
        } catch (e) {
            console.warn('[TokenGuard] Failed to parse session from localStorage');
            return;
        }

        // Verificar se tem access_token
        if (!session?.access_token) {
            console.log('[TokenGuard] No access token in session');
            return;
        }

        // Verificar expiração
        const expiresAt = session.expires_at;
        if (!expiresAt) {
            console.warn('[TokenGuard] No expiration time found');
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;

        // Se o token já expirou, apenas logar (não fazer refresh para evitar travamento)
        if (timeUntilExpiry < 0) {
            console.warn('[TokenGuard] Token expired. User needs to login again.');
            return;
        }

        // Se o token expira em menos de 5 minutos, apenas logar warning
        if (timeUntilExpiry < 300) {
            console.warn(`[TokenGuard] Token expires in ${Math.floor(timeUntilExpiry / 60)} minutes`);
        }

        // NÃO fazer refresh automático - deixar o usuário relogar se necessário
        // Isso evita travamentos no PWA

    } catch (error) {
        console.error('[TokenGuard] Exception:', error);
        isRefreshing = false;
        refreshPromise = null;
    }
};
