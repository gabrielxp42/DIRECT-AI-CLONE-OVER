import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionProvider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_VERSION } from '@/utils/version'
import { Loader2, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const Login = () => {
  const { session, supabase } = useSession();
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Sincroniza o estado inicial do checkbox com o sessionStorage
    const useSession = sessionStorage.getItem('supabase-use-session-storage') === 'true';
    setRememberMe(!useSession);
  }, []);

  const handleRememberMeChange = (checked: boolean | 'indeterminate') => {
    const isChecked = checked as boolean;
    setRememberMe(isChecked);
    if (isChecked) {
      sessionStorage.removeItem('supabase-use-session-storage');
    } else {
      sessionStorage.setItem('supabase-use-session-storage', 'true');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setAuthError('Verifique seu e-mail para confirmar o cadastro!');
        setLoading(false);
        return; // Don't clear loading immediately if success message is shown
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        setAuthError('Instruções enviadas para seu e-mail!');
        setLoading(false);
        return;
      }
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes('Invalid login')) msg = 'E-mail ou senha incorretos.';
      if (msg.includes('Email not confirmed')) msg = 'E-mail não confirmado.';
      if (msg.includes('Password should be')) msg = 'A senha deve ter pelo menos 6 caracteres.';
      setAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 md:p-4 relative overflow-hidden bg-[#0a0a0a]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a00] to-[#0f0f00] animate-gradient-xy opacity-80"></div>

      {/* Decorative Orbs (Brand Yellow/Gold Theme) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFF200]/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,242,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,242,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-20"></div>

      {/* Glass Card - Dark Theme - MAXIMIZED SCALE */}
      <div className="w-full max-w-[500px] relative z-10 backdrop-blur-xl bg-black/40 border border-white/10 rounded-[2.5rem] shadow-2xl p-6 md:p-12 animate-in fade-in zoom-in duration-500 ring-1 ring-white/5 mx-auto">

        {/* Header */}
        <div className="text-center space-y-6 mb-8 md:mb-12">
          <div className="inline-flex p-6 rounded-[2.5rem] bg-white/5 border border-white/10 mb-2 shadow-xl shadow-[#FFF200]/10 ring-1 ring-white/5">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain drop-shadow-md" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Direct AI</h1>
            <p className="text-lg md:text-xl text-zinc-400 font-medium">
              {mode === 'signin' && 'Bem-vindo de volta'}
              {mode === 'signup' && 'Crie sua conta'}
              {mode === 'forgot' && 'Recuperar senha'}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="relative group">
                <Mail className="absolute left-6 top-[1.2rem] h-6 w-6 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                <Input
                  type="email"
                  placeholder="Seu e-mail"
                  className="pl-16 h-16 text-lg bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-3xl shadow-inner"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <div className="relative group">
                  <Lock className="absolute left-6 top-[1.2rem] h-6 w-6 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    className="pl-16 h-16 text-lg bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-3xl shadow-inner"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {authError && (
            <div className="p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-200 text-base flex items-start gap-4 animate-in slide-in-from-top-2">
              <AlertCircle className="h-6 w-6 shrink-0 text-red-400 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {mode === 'signin' && (
            <div className="flex items-center justify-between text-base px-2">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={handleRememberMeChange}
                  className="h-6 w-6 border-zinc-600 data-[state=checked]:bg-[#FFF200] data-[state=checked]:text-black data-[state=checked]:border-[#FFF200] rounded-lg"
                />
                <Label htmlFor="remember-me" className="text-zinc-400 cursor-pointer font-medium hover:text-white transition-colors text-base">
                  Lembrar
                </Label>
              </div>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[#FFF200] hover:text-[#FFF200]/80 transition-colors font-medium hover:underline decoration-2 underline-offset-4"
              >
                Esqueceu?
              </button>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-16 rounded-3xl font-extrabold text-xl transition-all duration-300",
              "bg-[#FFF200] text-black hover:bg-[#ffe600]",
              "shadow-[0_0_30px_-5px_rgba(255,242,0,0.3)] hover:shadow-[0_0_40px_-5px_rgba(255,242,0,0.5)] hover:scale-[1.02] active:scale-[0.98]",
              "border-0"
            )}
          >
            {loading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <span className="flex items-center gap-3">
                {mode === 'signin' && 'ENTRAR'}
                {mode === 'signup' && 'CRIAR CONTA'}
                {mode === 'forgot' && 'ENVIAR LINK'}
                <ArrowRight className="h-6 w-6" />
              </span>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-12 text-center text-lg">
          {mode === 'signin' ? (
            <p className="text-zinc-500">
              Não tem uma conta?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-white hover:text-[#FFF200] font-bold transition-colors hover:underline decoration-2 underline-offset-4"
              >
                Criar agora
              </button>
            </p>
          ) : (
            <p className="text-zinc-500">
              Já tem uma conta?{' '}
              <button
                onClick={() => setMode('signin')}
                className="text-white hover:text-[#FFF200] font-bold transition-colors hover:underline decoration-2 underline-offset-4"
              >
                Faça login
              </button>
            </p>
          )}
        </div>

        <div className="mt-12 text-center border-t border-white/5 pt-8">
          <span className="text-xs text-zinc-600 font-bold tracking-[0.3em] uppercase">
            Direct AI &bull; {APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  )
}

export default Login;