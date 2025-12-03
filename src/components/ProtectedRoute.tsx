import { useSession } from '@/contexts/SessionProvider';
import { Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';

const ProtectedRoute = () => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;