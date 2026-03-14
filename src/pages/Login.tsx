import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/contexts/SessionProvider'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { APP_VERSION } from '@/utils/version'
import { Loader2, Mail, Lock, AlertCircle, ArrowRight, CheckCircle2, Zap, Truck, Bot, MessageCircle, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ShippingAnimation } from '@/components/marketing/ShippingAnimation'
import { OrderCreationAnimation } from '@/components/marketing/OrderCreationAnimation'

const Login = () => {
  const { session, supabase, isLoading } = useSession();
  const [rememberMe, setRememberMe] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [currentSlide, setCurrentSlide] = useState(0);

  const updates = [
    {
      id: 'whatsapp',
      label: 'Gabi AI + WhatsApp',
      desc: 'Envio automático de links de pagamento e rastreio direto no celular do cliente.',
      icon: <MessageCircle size={24} />,
      color: '#25D366',
      animation: <OrderCreationAnimation />
    },
    {
      id: 'logistics',
      label: 'Logística Automática',
      desc: 'Cotação em tempo real e geração de etiquetas flash integrada com transportadoras.',
      icon: <Truck size={24} />,
      color: '#FFF200',
      animation: <ShippingAnimation />
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % updates.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');


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

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + (mode === 'signup' ? '/checkout' : '/dashboard')
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setAuthError(error.message);
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
    // Se houver hash/query de recuperação ou convite, não redirecionar para dashboard
    const hasAuthParams = 
        window.location.hash.includes('access_token=') || 
        window.location.hash.includes('type=recovery') || 
        window.location.hash.includes('type=invite') ||
        window.location.hash.includes('type=signup') ||
        window.location.search.includes('type=recovery') ||
        window.location.search.includes('type=signup') ||
        window.location.search.includes('token_hash=');

    if (hasAuthParams) {
      console.log('🔑 [Login] Auth/Recovery params detected, skipping dashboard redirect');
      return (
        <div className="flex min-h-[100dvh] w-full bg-[#020817] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFF200]" />
        </div>
      );
    }
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#020817] flex overflow-hidden">

      {/* Visual Side (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/3 relative flex-col items-center justify-center p-12 bg-[#010409] border-r border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#0a0a10,transparent)] opacity-60" />
        <div className="absolute inset-0 bg-[#010409]" />

        {/* Animated Glows */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#25D366]/5 rounded-full blur-[120px]" />

        <div className="relative z-10 w-full max-w-sm space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] border border-white/10">
              <Sparkles className="w-3 h-3 text-primary" />
              Intelligence v2.6
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white leading-[0.9]">
              Novas <span className="text-primary">Automações</span>
            </h1>
          </div>

          <div className="relative h-[480px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: "anticipate" }}
                className="absolute inset-0 space-y-8"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors"
                      style={{ backgroundColor: `${updates[currentSlide].color}20`, color: updates[currentSlide].color }}
                    >
                      {updates[currentSlide].icon}
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                      {updates[currentSlide].label}
                    </h3>
                  </div>
                  <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                    {updates[currentSlide].desc}
                  </p>
                </div>

                <div className="relative rounded-[2rem] bg-black/40 border border-white/5 p-4 shadow-2xl backdrop-blur-sm group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                  {updates[currentSlide].animation}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center gap-2">
            {updates.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  "h-1 transition-all duration-500 rounded-full",
                  currentSlide === i ? "w-8 bg-primary" : "w-4 bg-white/10"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="w-full lg:w-2/3 relative flex items-center justify-center p-4 min-h-screen bg-[#020617] overflow-hidden">
        {/* Mobile-Only Original Background (Zero Changes) */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-[#020817] via-[#051139]/30 to-[#020817] pointer-events-none" />
        <div className="lg:hidden absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFF200]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="lg:hidden absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Desktop-Only Liquid Glass & Grid Background */}
        <div className="hidden lg:block absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 90, 180, 270, 360],
              x: [0, 150, 0, -150, 0],
              y: [0, -80, 0, 80, 0]
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-[#FFF200]/15 rounded-full blur-[160px] opacity-40"
          />
          <motion.div
            animate={{
              scale: [1.3, 1, 1.3],
              rotate: [360, 270, 180, 90, 0],
              x: [0, -120, 0, 120, 0],
              y: [0, 80, 0, -80, 0]
            }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-orange-500/10 rounded-full blur-[140px] opacity-30"
          />
        </div>

        {/* Dynamic Grid Overlay (Desktop Only) */}
        <div className="hidden lg:block absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

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
          <div className="relative group">
            {/* Animated Border/Neon Glow */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-[#FFF200]/0 via-[#FFF200]/40 to-[#FFF200]/0 rounded-[2.5rem] blur-sm group-focus-within:via-[#FFF200]/60 transition-all duration-500" />

            <div className="relative bg-black/60 border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-3xl backdrop-blur-2xl transition-all duration-500">
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off" data-lpignore="true">

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
                    "w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 mt-2",
                    "bg-[#FFF200] text-black hover:bg-[#ffe600]",
                    "shadow-[0_0_30px_-5px_rgba(255,242,0,0.5)] hover:shadow-[#FFF200]/40",
                    "hover:scale-[1.02] active:scale-[0.98]",
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

                {mode !== 'forgot' && (
                  <div className="space-y-6 pt-2">
                    <div className="relative flex items-center py-4">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-4 text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em]">OU</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoogleLogin}
                      className="w-full h-14 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-white font-bold gap-3 transition-all"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      {mode === 'signin' ? 'Entrar com Google' : 'Registrar com Google'}
                    </Button>
                  </div>
                )}

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