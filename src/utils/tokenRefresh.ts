/**
 * DESABILITADO - NÃO USAR REFRESH AUTOMÁTICO
 * Causa travamentos no PWA
 */

let refreshTimer: NodeJS.Timeout | null = null;

/**
 * DESABILITADO - Não configura refresh automático
 * Para evitar travamentos no PWA
 */
export const setupTokenRefresh = () => {
    console.log('[TokenRefresh] DESABILITADO - Refresh automático não será executado para evitar travamentos no PWA');

    // Limpar qualquer timer existente
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    // NÃO fazer nada - deixar o token expirar naturalmente
    // O usuário precisará fazer login novamente se o token expirar
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
