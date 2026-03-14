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
    if (!isLoading) {
      console.warn('🛡️ [ProtectedRoute] No session and not loading. Redirecting to /login from:', window.location.pathname);
      return <Navigate to="/login" replace />;
    } else {
      console.log('🛡️ [ProtectedRoute] No session but state is LOADING. Still showing LoadingScreen...');
      return <LoadingScreen />;
    }
  }

  console.log('🛡️ [ProtectedRoute] Session valid, permitting access');
  return <Outlet />;
};

export default ProtectedRoute;