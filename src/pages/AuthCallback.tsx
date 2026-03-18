import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase Auth Listener (no SessionProvider) deve lidar com a sessão
    // Assim que tivermos um usuário, redirecionamos.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('✅ [AuthCallback] Sessão detectada, redirecionando...');
        // Tentar recuperar a URL de destino salva (se houver) ou ir para dashboard
        const next = localStorage.getItem('auth_redirect') || '/dashboard';
        localStorage.removeItem('auth_redirect');
        navigate(next);
      } else {
        // Se não houver sessão imediata, aguardar o listener do onAuthStateChange
        // que está no SessionProvider. Mas como fallback, podemos tentar getSession novamente após um tempo
        // ou deixar o usuário aqui com um loading.
        // O SessionProvider geralmente redireciona se estiver logado, mas como essa rota é pública,
        // precisamos forçar a verificação.
        
        // Listener para mudança de estado
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            console.log('✅ [AuthCallback] Evento SIGNED_IN recebido.');
            const next = localStorage.getItem('auth_redirect') || '/dashboard';
            localStorage.removeItem('auth_redirect');
            navigate(next);
          }
        });

        return () => subscription.unsubscribe();
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Finalizando autenticação...</p>
    </div>
  );
}
