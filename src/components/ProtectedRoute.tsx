import { useSession } from '@/contexts/SessionProvider';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';

const ProtectedRoute = () => {
  const { session, isLoading } = useSession();

  console.log('🛡️ [ProtectedRoute] Rendering...', {
    path: window.location.pathname,
    hasSession: !!session,
    isLoading
  });

  if (isLoading) {
    console.log('🛡️ [ProtectedRoute] Still loading, showing LoadingScreen');
    return <LoadingScreen />;
  }

  if (!session) {
    console.warn('🛡️ [ProtectedRoute] No session found, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('🛡️ [ProtectedRoute] Session valid, permitting access');
  return <Outlet />;
};

export default ProtectedRoute;