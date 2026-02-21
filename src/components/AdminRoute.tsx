import { useSession } from '@/contexts/SessionProvider';
import { Navigate } from 'react-router-dom';
import LoadingScreen from '@/components/LoadingScreen';

// This component acts as a high-level guard.
// However, the REAL SECURITY is in the Database Policies (RLS).
// Even if a hacker bypasses this React component, the database will reject their requests.

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, profile, isLoading } = useSession();

    if (isLoading) {
        return <LoadingScreen />;
    }

    // Double check: Must be authenticated AND have is_admin flag
    if (!session || !profile?.is_admin) {
        // Redirect suspicious attempts to home or login logic
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default AdminRoute;
