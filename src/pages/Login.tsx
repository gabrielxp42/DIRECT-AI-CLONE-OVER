import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionProvider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_VERSION } from '@/utils/version'
import { Loader2, Mail, Lock, AlertCircle, ArrowRight, CheckCircle2, Zap, Truck, Bot, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ShippingAnimation } from '@/components/marketing/ShippingAnimation'

const Login = () => {
  const { session, supabase, isLoading } = useSession();
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

  // Logo and Name branding (fallback to cache for White Label persistence)
  const cachedLogo = typeof localStorage !== 'undefined' ? localStorage.getItem('cached_company_logo') : null;
  const cachedName = typeof localStorage !== 'undefined' ? localStorage.getItem('cached_company_name') : null;
  const logoUrl = cachedLogo || "/logo.png";
  const companyName = cachedName || "Direct AI";

  useEffect(() => {
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

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full bg-[#020817] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#FFF200]" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#020817] flex overflow-hidden">

      {/* LEFT SIDE: Marketing & Animations (Desktop Only - or Top on Mobile) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-center p-12 overflow-hidden bg-zinc-950 border-r border-white/5">
        {/* Background Effects */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#FFF200]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-orange-500/5 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-xl mx-auto space-y-10">

          {/* Main Copy */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#FFF200] text-xs font-black uppercase tracking-wider">
              <Zap className="w-3 h-3 fill-current" />
              Nova Era da Logística
            </div>
            <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
              Automação Logística <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFF200] to-orange-400">
                Neural & Inteligente.
              </span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-sm">
              Deixe a <span className="text-[#FFF200] font-bold">Gabi AI</span> calcular fretes, gerar etiquetas e enviar rastreios pelo WhatsApp. Tudo automático.
            </p>
          </div>

          {/* Animation Demo */}
          <div className="w-full transform hover:scale-[1.02] transition-transform duration-500">
            <ShippingAnimation />
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
              <Truck className="w-6 h-6 text-orange-400 mb-2" />
              <h3 className="text-white font-bold text-sm">Envio Instantâneo</h3>
              <p className="text-zinc-500 text-xs">Cotação e etiqueta em 1 clique.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
              <Bot className="w-6 h-6 text-[#FFF200] mb-2" />
              <h3 className="text-white font-bold text-sm">Gabi AI</h3>
              <p className="text-zinc-500 text-xs">Sua gerente de logística 24/7.</p>
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE: Login Form */}
      <div className="w-full lg:w-1/2 relative flex items-center justify-center p-4">
        {/* Mobile Background (Subtle) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#020817] via-[#051139]/20 to-[#020817] pointer-events-none lg:hidden" />

        <div className="relative z-10 w-full max-w-[420px] space-y-8">

          {/* Header (Mobile Logo) */}
          <div className="text-center space-y-4">
            <div className="inline-flex lg:hidden p-4 rounded-3xl bg-white/5 border border-white/10 mb-2 shadow-xl shadow-[#FFF200]/10 ring-1 ring-white/5 mx-auto">
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain drop-shadow-md" />
            </div>

            <div className="space-y-2">
              {/* Desktop Logo (Text) */}
              <div className="hidden lg:flex items-center justify-center gap-3 mb-6">
                <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain" />
                <span className="text-2xl font-bold text-white tracking-tight">{companyName}</span>
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'signin' && 'Bem-vindo de volta'}
                {mode === 'signup' && 'Crie sua conta'}
                {mode === 'forgot' && 'Recuperar senha'}
              </h2>
              <p className="text-zinc-400">
                Acesse sua conta para gerenciar seus pedidos.
              </p>
            </div>
          </div>

          {/* Glass Card for Form */}
          <div className="lg:bg-transparent lg:border-none lg:shadow-none bg-black/40 border border-white/10 rounded-3xl p-6 lg:p-0 shadow-2xl backdrop-blur-xl lg:backdrop-blur-none transition-all">
            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off" data-lpignore="true">

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">E-mail</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 transition-all rounded-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-400 text-xs uppercase font-bold tracking-wider ml-1">Senha</Label>
                      {mode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-[#FFF200] text-xs font-bold hover:underline"
                        >
                          Esqueceu?
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500 group-focus-within:text-[#FFF200] transition-colors" />
                      <Input
                        type="password"
                        autoComplete={mode === 'signup' ? "new-password" : "current-password"}
                        placeholder="••••••••"
                        className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:bg-black/50 focus:border-[#FFF200]/50 transition-all rounded-xl"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                  <div className="flex flex-col gap-1">
                    <span>{authError}</span>
                    {authError.includes('Email not confirmed') && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={resending}
                        className="text-[#FFF200] text-xs font-bold text-left hover:underline"
                      >
                        {resending ? 'Reenviando...' : 'Reenviar confirmação'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-[#FFF200]/10 border border-[#FFF200]/20 text-[#FFF200] text-sm flex items-start gap-3 animate-in slide-in-from-top-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FFF200]" />
                  <div className="flex flex-col gap-1">
                    <span className="font-bold">Sucesso!</span>
                    <span>{successMsg}</span>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full h-12 rounded-xl font-bold text-base transition-all duration-300 mt-2",
                  "bg-[#FFF200] text-black hover:bg-[#ffe600]",
                  "shadow-[0_0_20px_-5px_rgba(255,242,0,0.3)] hover:scale-[1.02] active:scale-[0.98]",
                  "border-0"
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'signin' && 'ENTRAR NA CONTA'}
                    {mode === 'signup' && 'CRIAR CONTA GRÁTIS'}
                    {mode === 'forgot' && 'ENVIAR LINK DE RECUPERAÇÃO'}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <div className="text-center">
                {mode === 'signin' ? (
                  <p className="text-zinc-500 text-sm">
                    Não tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="text-white hover:text-[#FFF200] font-bold transition-colors hover:underline"
                    >
                      Criar agora
                    </button>
                  </p>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    Já tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signin')}
                      className="text-white hover:text-[#FFF200] font-bold transition-colors hover:underline"
                    >
                      Faça login
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>

          <div className="text-center pt-8">
            <span className="text-[10px] text-zinc-700 font-bold tracking-[0.3em] uppercase">
              {companyName} &bull; {APP_VERSION}
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Login;