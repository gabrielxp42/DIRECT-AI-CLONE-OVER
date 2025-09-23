import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { ptBR } from '@/lib/supabase-pt-br'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionProvider'
import { useTheme } from '@/components/ThemeProvider'

const Login = () => {
  const { session, supabase } = useSession();
  const { theme } = useTheme();

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-xl border">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="DIRECT DTF Logo" className="w-20 h-20 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Bem-vindo à DIRECT AI</h1>
          <p className="text-sm text-muted-foreground">Seu assistente de vendas inteligente</p>
        </div>
        
        <div className="space-y-4">
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
        </div>
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          Desenvolvido por Gabriel Lima
        </div>
      </div>
    </div>
  )
}

export default Login;