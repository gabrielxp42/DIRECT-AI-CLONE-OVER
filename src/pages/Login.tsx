import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { ptBR } from '@/lib/supabase-pt-br'
import { Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useSession } from '@/contexts/SessionProvider'
import { useTheme } from '@/components/ThemeProvider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_VERSION } from '@/utils/version'

const Login = () => {
  const { session, supabase } = useSession();
  const { theme } = useTheme();
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza o estado inicial do checkbox com o sessionStorage
    const useSession = sessionStorage.getItem('supabase-use-session-storage') === 'true';
    setRememberMe(!useSession);
  }, []);

  useEffect(() => {
    // Validar se o cliente Supabase está disponível
    if (!supabase || typeof supabase.from !== 'function') {
      setAuthError('Erro ao inicializar conexão com o servidor. Por favor, recarregue a página.');
      console.error('Supabase client is not properly initialized in Login component');
    } else {
      setAuthError(null);
    }
  }, [supabase]);

  if (session) {
    return <Navigate to="/" replace />
  }

  const handleRememberMeChange = (checked: boolean | 'indeterminate') => {
    const isChecked = checked as boolean;
    setRememberMe(isChecked);
    if (isChecked) {
      // Usa localStorage (comportamento padrão do client)
      sessionStorage.removeItem('supabase-use-session-storage');
    } else {
      // Usa sessionStorage
      sessionStorage.setItem('supabase-use-session-storage', 'true');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-xl border">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="DIRECT DTF Logo" className="w-20 h-20 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo à DIRECT AI</h1>
          <p className="text-sm text-muted-foreground">Seu assistente de vendas inteligente</p>
        </div>
        
        <div className="space-y-4">
          {authError && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md border border-red-200 dark:border-red-800">
              {authError}
            </div>
          )}
          {supabase && typeof supabase.from === 'function' ? (
            <Auth
              supabaseClient={supabase}
              appearance={{ 
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: 'hsl(var(--primary))',
                      brandAccent: 'hsl(var(--primary))',
                      brandButtonText: 'hsl(var(--primary-foreground))',
                    }
                  }
                }
              }}
              localization={{ variables: ptBR }}
              providers={[]}
              theme={theme === 'dark' ? 'dark' : 'light' as const}
            />
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              <p>Carregando componente de autenticação...</p>
            </div>
          )}
          
          <div className="flex items-center space-x-2 pt-4 border-t">
            <Checkbox 
              id="remember-me" 
              checked={rememberMe}
              onCheckedChange={handleRememberMeChange}
            />
            <Label 
              htmlFor="remember-me" 
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Lembrar de mim
            </Label>
          </div>
          
          <div className="text-xs text-muted-foreground text-center">
            {rememberMe ? (
              <p>Sua sessão será mantida após fechar o navegador.</p>
            ) : (
              <p>Você será desconectado ao fechar o navegador.</p>
            )}
          </div>
        </div>
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Desenvolvido por Gabriel Lima
          <span className="block mt-1 text-[0.65rem] opacity-70">Versão: {APP_VERSION}</span>
        </div>
      </div>
    </div>
  )
}

export default Login;