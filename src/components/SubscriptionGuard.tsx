import { useSession } from '@/contexts/SessionProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';

const SubscriptionGuard = () => {
    const { session, profile, isLoading } = useSession();
    const sub = useSubscription();

    // Se a sessão ainda está carregando, mostramos o loading
    if (isLoading) {
        return <LoadingScreen />;
    }

    // Se não houver sessão, redirecionamos para o login
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    // Regras de Autorização:
    // 1. Administradores têm acesso total
    // 2. Planos Ativos têm acesso total
    // 3. Usuários em Trial (teste) que NÃO expiraram têm acesso
    const isAuthorized = profile?.is_admin || sub.isActive || (sub.isTrial && !sub.isExpired);

    if (!isAuthorized) {
        console.warn('🚫 [SubscriptionGuard] Acesso negado: Assinatura inativa ou expirada. Redirecionando para checkout.');
        return <Navigate to="/checkout" replace />;
    }

    return <Outlet />;
};

export default SubscriptionGuard;
