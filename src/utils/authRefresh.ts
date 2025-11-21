import { supabase } from '@/integrations/supabase/client';

/**
 * Configura um interceptor global para detectar erros 401 (token expirado)
 * e renovar a sessão automaticamente
 */
export function setupAuthRefreshInterceptor() {
    // Interceptar erros do React Query
    window.addEventListener('unhandledrejection', async (event) => {
        const error = event.reason;

        // Detectar erro de JWT expirado
        if (isJWTExpiredError(error)) {
            console.warn('⚠️ [AuthInterceptor] JWT expirado detectado, renovando sessão...');
            event.preventDefault(); // Prevenir erro não tratado

            await handleSessionRefresh();
        }
    });

    console.log('✅ [AuthInterceptor] Interceptor configurado');
}

function isJWTExpiredError(error: any): boolean {
    if (!error) return false;

    const errorStr = JSON.stringify(error).toLowerCase();
    return errorStr.includes('jwt expired') ||
        errorStr.includes('pgrst303') ||
        (error.code === 'PGRST303');
}

async function handleSessionRefresh() {
    try {
        const { data, error } = await supabase.auth.refreshSession();

        if (error || !data.session) {
            console.error('❌ [AuthInterceptor] Falha ao renovar sessão, redirecionando para login...');
            window.location.href = '/login';
            return;
        }

        console.log('✅ [AuthInterceptor] Sessão renovada! Recarregando página...');
        // Aguardar um pouco e recarregar
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (err) {
        console.error('❌ [AuthInterceptor] Erro ao renovar sessão:', err);
        window.location.href = '/login';
    }
}
