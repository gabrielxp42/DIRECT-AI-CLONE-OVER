import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    Loader2, Mail, Lock, ArrowRight, CheckCircle2, AlertCircle,
    User, CreditCard as CreditCardIcon, Sparkles, Shield, Zap, Check,
    Crown, TrendingUp, Printer, Users, Target, Bot, Clock, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/utils/version';
import { motion, AnimatePresence } from 'framer-motion';

// --- DATA: Benefícios (Copiado de SubscriptionModal) ---
const benefits = [
    {
        icon: Bot,
        badge: "✨ EXCLUSIVO",
        badgeColor: "bg-[#FFF200] text-black border-[#FFF200]",
        title: "Seu Gerente 24h",
        description: "Pergunte sobre seu lucro. O Gabriel responde na hora.",
        colSpan: "col-span-full md:col-span-1",
        isPrimary: true
    },
    {
        icon: Target,
        badge: "NOVO • IA",
        badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
        title: "Recupere Vendas",
        description: "O Gabriel avisa quais clientes sumiram.",
        colSpan: "col-span-full md:col-span-1",
        isPrimary: false
    },
    {
        icon: TrendingUp,
        badge: "CLAREZA",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        title: "Adeus Planilhas",
        description: "Controle financeiro automático.",
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Printer,
        badge: "PARA DTF",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        title: "Metros e Rolos",
        description: "Controle de estoque real.",
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Zap,
        badge: "TEMPO",
        badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        title: "Pedido em 30s",
        description: "Venda rápida no balcão.",
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Users,
        badge: "MEMÓRIA",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        title: "Histórico Total",
        description: "Tudo sobre seus clientes.",
        colSpan: "col-span-1",
        isPrimary: false
    }
];

const Checkout = () => {
    const navigate = useNavigate();
    const { session, supabase } = useSession();

    // Step: 1 = Registro/Login, 2 = Pagamento, 3 = Sucesso
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auth Form State
    const isSuccess = step === 3;
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    const [paymentData, setPaymentData] = useState<{ url?: string; pix?: { encodedImage: string; payload: string }; subscriptionId?: string } | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [cardData, setCardData] = useState({
        holderName: '',
        number: '',
        expiry: '',
        cvv: ''
    });

    // Auto-polling for PIX payment status
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (paymentMethod === 'PIX' && paymentData?.pix && !isSuccess) {
            // Polling a cada 3 segundos
            intervalId = setInterval(async () => {
                // Verificação silenciosa (sem toast de loading)
                if (!session?.access_token) return;

                try {
                    const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/verify-subscription', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ subscriptionId: paymentData.subscriptionId })
                    });

                    const data = await response.json();

                    if (data.success && data.status === 'ACTIVE') {
                        toast.success("Pagamento Confirmado Automaticamente!");
                        clearInterval(intervalId);
                        setStep(3);
                    }
                } catch (err) {
                    console.error("Polling error", err);
                    // Não mostra erro pro usuário pra não poluir
                }
            }, 3000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [paymentMethod, paymentData, isSuccess, session]);

    // --- AUTH LOGIC ---
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptedTerms) return setError('Você precisa aceitar os Termos de Uso.');
        setLoading(true);
        setError(null);
        try {
            const { error: signUpError, data } = await supabase.auth.signUp({
                email, password, options: { emailRedirectTo: window.location.origin + '/checkout' }
            });
            if (signUpError) throw signUpError;

            // Auto-login fallback logic
            if (data.session) {
                setStep(2); return;
            }
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                setError('Conta criada! Verifique seu email e faça login.'); return;
            }
            setStep(2);
        } catch (err: any) {
            let msg = err.message;
            if (msg.includes('already registered')) msg = 'E-mail já cadastrado. Faça login.';
            if (msg.includes('Password should be')) msg = 'Senha deve ter pelo menos 6 caracteres.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            setStep(2);
        } catch (err: any) {
            setError('E-mail ou senha incorretos.');
        } finally {
            setLoading(false);
        }
    };

    // --- PAYMENT LOGIC ---
    const formatCardNumber = (v: string) => v.replace(/\D/g, '').substring(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
    const formatExpiry = (v: string) => {
        const val = v.replace(/\D/g, '').substring(0, 4);
        return val.length >= 3 ? `${val.substring(0, 2)}/${val.substring(2, 4)}` : val;
    };

    const handleProcessPayment = async () => {
        if (!session?.user) return toast.error("Sessão expirada. Faça login novamente.");

        if (paymentMethod === 'CREDIT_CARD') {
            if (!cardData.holderName || !cardData.number || !cardData.expiry || !cardData.cvv) {
                return toast.error("Preencha todos os dados do cartão.");
            }
        }

        try {
            setIsProcessingPayment(true);
            const loadingMsg = paymentMethod === 'PIX' ? "Gerando QR Code Pix..." : "Processando transação segura...";
            toast.loading(loadingMsg, { id: 'checkout-loader' });

            const [expiryMonth, expiryYear] = cardData.expiry.split('/');

            const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/asaas-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    userId: session.user.id,
                    email: session.user.email,
                    name: cardData.holderName || session.user.user_metadata?.full_name,
                    paymentMethod,
                    creditCard: paymentMethod === 'CREDIT_CARD' ? {
                        holderName: cardData.holderName,
                        number: cardData.number.replace(/\s+/g, ''),
                        expiryMonth,
                        expiryYear: '20' + expiryYear,
                        ccv: cardData.cvv
                    } : undefined,
                    creditCardHolderInfo: paymentMethod === 'CREDIT_CARD' ? {
                        name: cardData.holderName,
                        email: session.user.email,
                        cpfCnpj: '00000000000', postalCode: '00000000', addressNumber: '0', phone: '00000000000'
                    } : undefined
                })
            });

            const data = await response.json();
            toast.dismiss('checkout-loader');

            if (data.success) {
                setPaymentData(data);
                if (paymentMethod === 'CREDIT_CARD') {
                    // Cartão aprovado direto ou com link
                    setStep(3); // Sucesso direto
                }
                // PIX fica na mesma tela mostrando QR Code, estado paymentData?.pix controla visualização
            } else {
                throw new Error(data.error || "Falha ao processar pagamento.");
            }
        } catch (error: any) {
            console.error(error);
            toast.dismiss('checkout-loader');
            toast.error(error.message || "Erro de processamento.");
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleVerifyPayment = async () => {
        if (!session?.access_token) return;
        try {
            setIsVerifying(true);
            toast.loading("Consultando banco...", { id: 'verify-loader' });

            const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/verify-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ subscriptionId: paymentData?.subscriptionId })
            });

            const data = await response.json();
            toast.dismiss('verify-loader');

            if (data.success && data.status === 'ACTIVE') {
                toast.success("Pagamento Confirmado! Bem-vindo à Elite.");
                // Em vez de só navegar, setStep(3) para mostrar tela de sucesso
                // Mas se já está no step 3 (confirmação manual), recarrega
                if (step === 3) {
                    navigate('/'); // Ou reload
                } else {
                    setStep(3);
                }
            } else {
                toast.info("Pagamento ainda em processamento...");
            }
        } catch (error) {
            toast.error("Erro ao verificar status.");
        } finally {
            setIsVerifying(false);
        }
    };

    const steps = [
        { number: 1, label: 'Criar Conta', icon: User },
        { number: 2, label: 'Pagamento', icon: CreditCardIcon },
        { number: 3, label: 'Acesso', icon: Sparkles },
    ];

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#0a0a0a] relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-black"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] opacity-20"></div>

            {/* Main Container - Split View */}
            <div className="relative z-10 w-full max-w-6xl min-h-[600px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* LEFT COLUMN: Benefits & Persuasion */}
                <div className="md:w-5/12 lg:w-4/12 bg-[#09090b] border-r border-white/5 p-8 flex flex-col relative overflow-hidden group/sidebar">
                    {/* Background Glow */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#FFF200]/5 to-transparent pointer-events-none" />

                    <div className="relative z-10 mb-8">
                        <div className="inline-flex items-center gap-2 bg-[#FFF200]/10 border border-[#FFF200]/20 rounded-full px-3 py-1 mb-6">
                            <Crown className="w-3.5 h-3.5 text-[#FFF200]" />
                            <span className="text-[10px] font-bold text-[#FFF200] uppercase tracking-wider">Sistema Elite DTF</span>
                        </div>

                        <h1 className="text-3xl lg:text-4xl font-black text-white italic uppercase leading-[0.9] tracking-tighter mb-4">
                            PARE DE <br />
                            PERDER <br />
                            <span className="text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.4)]">DINHEIRO</span>
                        </h1>
                        <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-white/30 text-lg line-through font-bold">R$ 97</span>
                            <span className="text-4xl font-black text-white italic tracking-tighter">R$ 47</span>
                        </div>
                        <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 inline-block px-2 py-1 rounded">7 dias de garantia total</p>
                    </div>

                    {/* Benefits Grid (Compact) */}
                    <div className="flex-1 space-y-3 relative z-10 overflow-y-auto no-scrollbar pr-2">
                        {benefits.filter(b => b.isPrimary || !b.isPrimary).slice(0, 4).map((b, i) => (
                            <div key={i} className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all",
                                b.isPrimary ? "bg-[#FFF200]/10 border-[#FFF200]/20" : "bg-white/5 border-white/5"
                            )}>
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", b.isPrimary ? "bg-[#FFF200] text-black" : "bg-white/10 text-white/50")}>
                                    <b.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className={cn("text-xs font-black uppercase italic", b.isPrimary ? "text-white" : "text-white/80")}>{b.title}</h4>
                                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{b.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT COLUMN: Action & Forms */}
                <div className="flex-1 bg-black/20 p-6 md:p-10 flex flex-col justify-center relative">

                    {/* Stepper (Compact) */}
                    <div className="absolute top-6 left-0 w-full flex justify-center gap-2 pointer-events-none opacity-50">
                        {steps.map((s, idx) => (
                            <div key={s.number} className="flex items-center">
                                <div className={cn("w-2 h-2 rounded-full transition-colors", step >= s.number ? "bg-[#FFF200]" : "bg-white/10")} />
                                {idx < steps.length - 1 && <div className={cn("w-8 h-px mx-1", step > s.number ? "bg-[#FFF200]" : "bg-white/10")} />}
                            </div>
                        ))}
                    </div>

                    <div className="max-w-md mx-auto w-full mt-8">
                        {step === 1 && (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold text-white mb-2">{isLoginMode ? 'Entrar na conta' : 'Crie sua conta'}</h2>
                                    <p className="text-zinc-500 text-sm">Para liberar seu acesso ao painel</p>
                                </div>
                                <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-4">
                                    <div className="relative"><Mail className="absolute left-4 top-3.5 h-5 w-5 text-zinc-600" /><Input type="email" placeholder="Seu e-mail" value={email} onChange={e => setEmail(e.target.value)} className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl" required /></div>
                                    <div className="relative"><Lock className="absolute left-4 top-3.5 h-5 w-5 text-zinc-600" /><Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl" required /></div>
                                    {!isLoginMode && (
                                        <div className="flex items-center gap-2 px-1">
                                            <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(c) => setAcceptedTerms(c as boolean)} className="data-[state=checked]:bg-[#FFF200] data-[state=checked]:text-black border-zinc-600" />
                                            <Label htmlFor="terms" className="text-xs text-zinc-500">Aceito os termos de uso e privacidade</Label>
                                        </div>
                                    )}
                                    {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4" />{error}</div>}
                                    <Button type="submit" disabled={loading} className="w-full h-12 bg-[#FFF200] text-black font-bold rounded-xl hover:bg-[#ffe600]">{loading ? <Loader2 className="animate-spin" /> : (isLoginMode ? 'Entrar' : 'Criar e Continuar')}</Button>
                                </form>
                                <div className="text-center">
                                    <button type="button" onClick={() => setIsLoginMode(!isLoginMode)} className="text-xs text-zinc-500 hover:text-[#FFF200] transition-colors">
                                        {isLoginMode ? 'Não tem conta? Criar agora' : 'Já tem conta? Fazer login'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex flex-col">
                                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-6 text-center">Finalizar Pagamento</h2>

                                {/* Payment Method Selector */}
                                <div className="flex gap-4 mb-6">
                                    <button onClick={() => setPaymentMethod('PIX')} className={cn("flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2", paymentMethod === 'PIX' ? "border-[#FFF200] bg-[#FFF200]/10" : "border-white/5 bg-white/5 hover:border-white/20")}>
                                        <Zap className={cn("w-5 h-5", paymentMethod === 'PIX' ? "text-[#FFF200]" : "text-white/20")} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">PIX</span>
                                    </button>
                                    <button onClick={() => setPaymentMethod('CREDIT_CARD')} className={cn("flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2", paymentMethod === 'CREDIT_CARD' ? "border-[#FFF200] bg-[#FFF200]/10" : "border-white/5 bg-white/5 hover:border-white/20")}>
                                        <CreditCardIcon className={cn("w-5 h-5", paymentMethod === 'CREDIT_CARD' ? "text-[#FFF200]" : "text-white/20")} />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Cartão</span>
                                    </button>
                                </div>

                                <div className="flex-1">
                                    {paymentMethod === 'PIX' ? (
                                        <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                                            {!paymentData?.pix ? (
                                                <div className="py-8 space-y-4">
                                                    {isProcessingPayment ? (
                                                        <>
                                                            <div className="w-12 h-12 rounded-full border-2 border-[#FFF200] border-t-transparent animate-spin mx-auto" />
                                                            <p className="text-xs text-white/50 uppercase font-bold">Gerando QR Code...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                                                                <Zap className="w-6 h-6 text-[#FFF200]" />
                                                            </div>
                                                            <p className="text-xs text-white/50 uppercase font-bold max-w-[200px] mx-auto">Clique abaixo para gerar seu código PIX seguro</p>
                                                            <Button onClick={handleProcessPayment} className="w-full bg-[#FFF200] text-black font-bold h-10 text-xs uppercase shadow-[0_0_20px_rgba(255,242,0,0.2)] hover:bg-[#ffe600] transition-transform hover:scale-105">
                                                                Gerar QR Code PIX
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-4 animate-in fade-in zoom-in">
                                                    <div className="bg-white p-2 rounded-xl mx-auto w-48 h-48 flex items-center justify-center">
                                                        <img src={`data:image/png;base64,${paymentData.pix.encodedImage}`} alt="QR Pix" className="w-full h-full" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-[#FFF200] font-bold uppercase animate-pulse">Aguardando Pagamento...</p>
                                                        <p className="text-[10px] text-white/40">O sistema libera seu acesso automaticamente.</p>
                                                    </div>
                                                    <div className="flex gap-2 w-full">
                                                        <Button onClick={() => { navigator.clipboard.writeText(paymentData.pix?.payload || ""); toast.success("Copiado!"); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10">
                                                            <Copy className="w-4 h-4 mr-2" /> Copiar Código
                                                        </Button>
                                                        <Button onClick={handleVerifyPayment} disabled={isVerifying} className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20">
                                                            {isVerifying ? <Loader2 className="animate-spin w-4 h-4" /> : "Já paguei"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                                            <Input placeholder="NOME NO CARTÃO" value={cardData.holderName} onChange={e => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })} className="bg-black/20 border-white/10 h-10 text-xs" />
                                            <div className="relative"><Input placeholder="0000 0000 0000 0000" value={cardData.number} onChange={e => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })} className="bg-black/20 border-white/10 h-10 text-xs" /><CreditCardIcon className="absolute right-3 top-2.5 w-4 h-4 text-white/20" /></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Input placeholder="MM/AA" value={cardData.expiry} onChange={e => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })} className="bg-black/20 border-white/10 h-10 text-xs" />
                                                <Input placeholder="CVV" maxLength={4} value={cardData.cvv} onChange={e => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '') })} className="bg-black/20 border-white/10 h-10 text-xs" />
                                            </div>
                                            <Button onClick={handleProcessPayment} disabled={isProcessingPayment} className="w-full bg-[#FFF200] text-black font-black uppercase h-12 shadow-lg hover:scale-[1.02] transition-transform">
                                                {isProcessingPayment ? <Loader2 className="animate-spin" /> : "Pagar R$ 47,00"}
                                            </Button>
                                            <p className="text-[9px] text-center text-white/30 flex items-center justify-center gap-1"><Shield className="w-3 h-3" /> Checkout 100% Seguro</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-10">
                                <div className="w-24 h-24 bg-[#FFF200] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_-10px_rgba(255,242,0,0.5)]">
                                    <Check className="w-10 h-10 text-black" strokeWidth={3} />
                                </div>
                                <h2 className="text-4xl font-black italic text-[#FFF200] uppercase tracking-tighter mb-4">Bem-vindo à Elite!</h2>
                                <p className="text-white/60 mb-8 max-w-xs mx-auto text-sm">Seu pagamento foi recebido. Você já pode acessar todas as ferramentas exclusivas.</p>
                                <Button onClick={() => navigate('/')} className="w-full h-14 bg-white text-black font-black uppercase text-lg rounded-xl shadow-xl hover:bg-gray-200">
                                    <Sparkles className="w-5 h-5 mr-2 text-[#FFF200] fill-current" /> Acessar Painel
                                </Button>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Footer (Mobile only visible part if needed, handled by main layout container) */}
            </div>

            <p className="absolute bottom-4 text-[10px] text-white/10 font-bold tracking-[0.3em] uppercase">Direct AI • {APP_VERSION}</p>
        </div>
    );
};

export default Checkout;
