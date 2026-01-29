import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionProvider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_VERSION } from '@/utils/version'
import { Loader2, Mail, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const Login = () => {
  const { session, supabase } = useSession();
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
    setSuccessMsg(null);
    if (mode === 'signup' && !acceptedTerms) {
      setAuthError('Você precisa aceitar os Termos de Uso.');
      setLoading(false);
      return;
    }

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
        setSuccessMsg('Verifique seu e-mail para confirmar o cadastro!');
        setLoading(false);
        return;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        setSuccessMsg('Instruções enviadas para seu e-mail!');
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

  const handleResendConfirmation = async () => {
    if (!email) {
      setAuthError('Por favor, informe seu e-mail.');
      return;
    }
    setResending(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      setSuccessMsg('E-mail de confirmação reenviado!');
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setResending(false);
    }
  };

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-[#0a0a0a]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a00] to-[#0f0f00] animate-gradient-xy opacity-80"></div>

      {/* Decorative Orbs (Brand Yellow/Gold Theme) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFF200]/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,242,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,242,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-20"></div>

      {/* Content Wrapper with Safe Area Padding */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">

        {/* Glass Card - Dark Theme - SCALED FOR COMPACTNESS ON DESKTOP / FULL ON MOBILE */}
        <div className="w-full max-w-[400px] md:max-w-[420px] backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl md:rounded-[2rem] shadow-2xl p-6 md:p-10 animate-in fade-in zoom-in duration-500 ring-1 ring-white/5 mx-auto">

          {/* Header */}
          <div className="text-center space-y-4 mb-6 md:mb-8">
            <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 mb-2 shadow-xl shadow-[#FFF200]/10 ring-1 ring-white/5">
              <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain drop-shadow-md" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-3xl font-bold text-white tracking-tight">Direct AI</h1>
              <p className="text-base md:text-base text-zinc-400 font-medium">
                {mode === 'signin' && 'Bem-vindo de volta'}
                {mode === 'signup' && 'Crie sua conta'}
                {mode === 'forgot' && 'Recuperar senha'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
            <div className="space-y-4 md:space-y-4">
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-5 top-[1.1rem] h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                  <Input
                    type="email"
                    placeholder="Seu e-mail"
                    className="pl-14 h-14 md:h-14 text-base bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-2xl shadow-inner"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <div className="relative group">
                    <Lock className="absolute left-5 top-[1.1rem] h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                    <Input
                      type="password"
                      placeholder="Sua senha"
                      className="pl-14 h-14 md:h-14 text-base bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 focus:ring-4 focus:ring-[#FFF200]/10 transition-all rounded-2xl shadow-inner"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {authError && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-start gap-4 animate-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span>{authError}</span>
                  {authError.includes('Email not confirmed') && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resending}
                      className="text-[#FFF200] text-xs font-bold text-left hover:underline"
                    >
                      {resending ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-2xl bg-[#FFF200]/10 border border-[#FFF200]/20 text-[#FFF200] text-sm flex items-start gap-4 animate-in slide-in-from-top-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FFF200] mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-bold">Sucesso!</span>
                  <span>{successMsg}</span>
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex items-center justify-between text-base px-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={handleRememberMeChange}
                    className="h-5 w-5 border-zinc-600 data-[state=checked]:bg-[#FFF200] data-[state=checked]:text-black data-[state=checked]:border-[#FFF200] rounded-md"
                  />
                  <Label htmlFor="remember-me" className="text-zinc-400 cursor-pointer font-medium hover:text-white transition-colors text-sm">
                    Lembrar
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[#FFF200] hover:text-[#FFF200]/80 transition-colors font-medium hover:underline decoration-2 underline-offset-4 text-sm"
                >
                  Esqueceu?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-14 rounded-2xl font-extrabold text-lg transition-all duration-300",
                "bg-[#FFF200] text-black hover:bg-[#ffe600]",
                "shadow-[0_0_20px_-5px_rgba(255,242,0,0.3)] hover:shadow-[0_0_30px_-5px_rgba(255,242,0,0.5)] hover:scale-[1.02] active:scale-[0.98]",
                "border-0"
              )}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'signin' && 'ENTRAR'}
                  {mode === 'signup' && 'CRIAR CONTA'}
                  {mode === 'forgot' && 'ENVIAR LINK'}
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>

            {mode === 'signup' && (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 px-2">
                  <Checkbox
                    id="accept-terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                    className="mt-1 h-5 w-5 border-zinc-600 data-[state=checked]:bg-[#FFF200] data-[state=checked]:text-black data-[state=checked]:border-[#FFF200] rounded-md"
                  />
                  <Label htmlFor="accept-terms" className="text-zinc-500 text-xs leading-relaxed cursor-pointer">
                    Eu li e aceito os{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#FFF200] underline underline-offset-4 transition-colors">Termos de Uso</a>
                    {' '}e a{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#FFF200] underline underline-offset-4 transition-colors">Política de Privacidade</a> da Direct AI.
                  </Label>
                </div>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-base">
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

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <span className="text-[10px] text-zinc-600 font-bold tracking-[0.3em] uppercase">
              Direct AI &bull; {APP_VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login;