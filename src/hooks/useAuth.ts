import { useSession } from '@/contexts/SessionProvider';

export const useAuth = () => {
    const context = useSession();
    return context;
};
