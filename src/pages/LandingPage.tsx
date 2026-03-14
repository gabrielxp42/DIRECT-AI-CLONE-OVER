import { useEffect } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const { session, isLoading } = useSession();
    const navigate = useNavigate();
    const queryParams = window.location.search;
    const iframeSrc = `/landing-page/index.html${queryParams}`;

    useEffect(() => {
        console.log('🏠 [LandingPage] Auth Check:', { hasSession: !!session, isLoading });

        // Redirecionar se já estiver logado
        if (!isLoading && session) {
            // Se houver hash/query de autenticação/recuperação, deixar o SessionProvider/AuthConfirm/App lidar
            const hasAuthParams = 
                window.location.hash.includes('type=recovery') || 
                window.location.hash.includes('access_token=') ||
                window.location.hash.includes('type=invite') ||
                window.location.search.includes('type=recovery') ||
                window.location.search.includes('token_hash=');

            if (hasAuthParams) {
                console.log('🔑 [LandingPage] Auth/Recovery params detected, skipping dashboard redirect');
                return;
            }

            console.log('🏠 [LandingPage] User is authenticated, redirecting to /dashboard');
            navigate('/dashboard', { replace: true });
        }

        document.title = "Direct AI - Sua Gráfica no Piloto Automático";
    }, [session, isLoading, navigate]);

    // O retorno da div com iframe só será exibido enquanto não estiver redirecionando
    // ou se o usuário não estiver logado.
    if (!isLoading && session) {
        console.log('🏠 [LandingPage] Blocking render during redirect');
        return null;
    }

    return (
        <div className="fixed inset-0 w-full h-full bg-[#020617] z-[9999]">
            <iframe
                src={iframeSrc}
                className="w-full h-full border-none"
                title="Direct AI Landing Page"
            />
        </div>
    );
}
