
import { useSession } from '@/contexts/SessionProvider';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SubscriptionGuard = () => {
    const { session, isLoading } = useSession();
    const [isChecking, setIsChecking] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!session?.user) {
                setIsChecking(false);
                return;
            }

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_status')
                    .eq('id', session.user.id)
                    .single();

                // Permite Acesso se for 'active' ou 'trialing'
                // Se for null, 'expired', 'canceled' -> Redireciona
                if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } catch (error) {
                console.error('Error checking subscription:', error);
                setIsAuthorized(false);
            } finally {
                setIsChecking(false);
            }
        };

        if (!isLoading) {
            checkSubscription();
        }
    }, [session, isLoading]);

    if (isLoading || isChecking) {
        return <LoadingScreen />;
    }

    if (!isAuthorized) {
        return <Navigate to="/checkout" replace />;
    }

    return <Outlet />;
};

export default SubscriptionGuard;
