/**
 * DESABILITADO - NÃO USAR
 * Este interceptor usava supabase.auth.refreshSession() que trava no PWA
 * Agora usamos tokenRefresh.ts com fetch direto
 */

/**
 * Função desabilitada - não faz nada
 */
export function setupAuthRefreshInterceptor() {
    console.log('⚠️ [AuthInterceptor] DESABILITADO - Usando tokenRefresh.ts com fetch direto');
    // Não faz nada - o refresh é feito pelo tokenRefresh.ts
}
