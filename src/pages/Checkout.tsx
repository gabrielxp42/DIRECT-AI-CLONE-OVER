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
    Crown, TrendingUp, Printer, Users, Target, Bot, Clock, Copy,
    Ruler, DollarSign
} from 'lucide-react';

const WhatsAppLogo = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        className={className}
        fill="currentColor"
    >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.551 4.171 1.597 6.02L0 24l6.191-1.623c1.78.97 3.791 1.482 5.835 1.483h.005c6.612 0 11.976-5.363 11.979-11.969 0-3.202-1.246-6.212-3.51-8.473z" />
    </svg>
);
import { toast } from 'sonner';
import { APP_VERSION } from '@/utils/version';
import { motion, AnimatePresence } from 'framer-motion';

// --- DATA: Benefícios (Copiado de SubscriptionModal) ---
const benefits = [
    {
        icon: Ruler,
        badge: "PARA DTF",
        badgeColor: "bg-[#FFF200] text-black border-[#FFF200]",
        title: "Economia de Filme",
        description: "Calculadora ultra-precisa que evita desperdício de material.",
        colSpan: "col-span-full md:col-span-1",
        isPrimary: true
    },
    {
        icon: DollarSign,
        badge: "LUCRO",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        title: "Lucro no Bolso",
        description: "Acompanhe seu rendimento por metro rodado em tempo real.",
        colSpan: "col-span-full md:col-span-1",
        isPrimary: false
    },
    {
        icon: TrendingUp,
        badge: "GESTÃO",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        title: "Adeus Planilhas",
        description: "Gestão financeira automática desenhada para gráficas.",
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Printer,
        badge: "ESTOQUE",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        title: "Metros e Rolos",
        description: "Controle de estoque real de filmes e insumos.",
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
    const paymentFormRef = React.useRef<HTMLDivElement>(null);

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
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD' | 'PIX_AUTOMATIC'>('PIX_AUTOMATIC');
    const [paymentData, setPaymentData] = useState<{ url?: string; pix?: { encodedImage: string; payload: string }; subscriptionId?: string } | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [cardData, setCardData] = useState({
        holderName: '',
        number: '',
        expiry: '',
        cvv: ''
    });
    const [clientInfo, setClientInfo] = useState({ cpfCnpj: '', postalCode: '', addressNumber: '', phone: '' });
    const [productType, setProductType] = useState<'PRO' | 'BOOST_BUNDLE'>('PRO');
    const [partnerCode, setPartnerCode] = useState('');
    const [isApplyingCode, setIsApplyingCode] = useState(false);
    const [isBoostUnlocked, setIsBoostUnlocked] = useState(false);

    // Auto-polling for PIX payment status
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (paymentMethod === 'PIX_AUTOMATIC' && paymentData?.pix && !isSuccess) {
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
                        body: JSON.stringify({
                            subscriptionId: paymentData.subscriptionId,
                            authorizationId: (paymentData as any).authorizationId
                        })
                    });

                    const data = await response.json();

                    if (data.success && (data.status === 'ACTIVE' || data.status === 'RECEIVED' || data.status === 'CONFIRMED')) {
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

    // Detect if user is already logged in
    useEffect(() => {
        if (session?.user) {
            setStep(2);
        }
    }, [session]);

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

    const formatCPFCNPJ = (v: string) => {
        const val = v.replace(/\D/g, '');
        if (val.length <= 11) {
            return val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, '$1.$2.$3-$4').substring(0, 14);
        }
        return val.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, '$1.$2.$3/$4-$5').substring(0, 18);
    };

    const isValidCPF = (cpf: string) => {
        if (!cpf) return false;
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
        let add = 0;
        for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
        let rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;
        add = 0;
        for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
        rev = 11 - (add % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(10))) return false;
        return true;
    };

    const isValidCNPJ = (cnpj: string) => {
        if (!cnpj) return false;
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;
        let length = cnpj.length - 2;
        let numbers = cnpj.substring(0, length);
        let digits = cnpj.substring(length);
        let sum = 0;
        let pos = length - 7;
        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }
        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(0))) return false;
        length = length + 1;
        numbers = cnpj.substring(0, length);
        sum = 0;
        pos = length - 7;
        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }
        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(1))) return false;
        return true;
    };

    const handleProcessPayment = async () => {
        if (!session?.user) return toast.error("Sessão expirada. Faça login novamente.");

        if (paymentMethod === 'CREDIT_CARD') {
            if (!cardData.holderName || !cardData.number || !cardData.expiry || !cardData.cvv) {
                return toast.error("Preencha todos os dados do cartão.");
            }
        }

        const rawCpf = clientInfo.cpfCnpj.replace(/\D/g, '');
        if (rawCpf.length < 11 || rawCpf.length > 14) {
            return toast.error("O CPF ou CNPJ informado é inválido. Ele deve ter 11 ou 14 números.");
        }

        try {
            setIsProcessingPayment(true);
            const loadingMsg = paymentMethod === 'PIX_AUTOMATIC' ? "Gerando QR Code Pix..." : "Processando transação segura...";
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
                    creditCardHolderInfo: {
                        name: cardData.holderName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                        email: session.user.email,
                        cpfCnpj: clientInfo.cpfCnpj.replace(/\D/g, ''),
                        postalCode: clientInfo.postalCode.replace(/\D/g, '') || '00000000',
                        addressNumber: clientInfo.addressNumber || '0',
                        phone: clientInfo.phone.replace(/\D/g, '') || '00000000000'
                    },
                    productType
                })
            });

            const data = await response.json();
            toast.dismiss('checkout-loader');

            if (data.success) {
                setPaymentData(data);
                if (paymentMethod === 'CREDIT_CARD') {
                    // Cartão aprovado no Asaas, agora forçamos a atualização no Supabase via verify-subscription
                    await handleVerifyPayment();
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
                body: JSON.stringify({
                    subscriptionId: paymentData?.subscriptionId,
                    authorizationId: (paymentData as any)?.authorizationId
                })
            });

            const data = await response.json();
            toast.dismiss('verify-loader');

            if (data.success && (data.status === 'ACTIVE' || data.status === 'RECEIVED' || data.status === 'CONFIRMED')) {
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

    const handleApplyPartnerCode = async () => {
        if (!partnerCode || !session?.user) return;
        setIsApplyingCode(true);
        try {
            // Chamada segura para Edge Function (Anti-Hacker)
            const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/apply-partner-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ code: partnerCode })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            setIsBoostUnlocked(true);
            toast.success("Código de Parceiro Aplicado! WhatsApp Plus Desbloqueado ⚡");
            if (productType === 'BOOST_BUNDLE') setProductType('PRO'); // Volta para o pro se estava no boost
        } catch (err: any) {
            toast.error("Erro ao aplicar código: " + err.message);
        } finally {
            setIsApplyingCode(false);
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
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 w-full max-w-6xl min-h-[500px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row shadow-2xl"
            >

                {/* LEFT COLUMN: Benefits & Persuasion */}
                <div className="md:w-5/12 lg:w-4/12 bg-[#09090b] border-r border-white/5 p-6 flex flex-col relative overflow-hidden group/sidebar">
                    {/* Background Glow */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#FFF200]/5 to-transparent pointer-events-none" />

                    <div className="relative z-10 mb-6">
                        <div className="inline-flex items-center gap-2 bg-[#FFF200]/10 border border-[#FFF200]/20 rounded-full px-3 py-1 mb-4">
                            <Crown className="w-3.5 h-3.5 text-[#FFF200]" />
                            <span className="text-[10px] font-bold text-[#FFF200] uppercase tracking-wider">Sistema Elite DTF</span>
                        </div>

                        <h1 className="text-2xl lg:text-3xl font-black text-white italic uppercase leading-[0.9] tracking-tighter mb-4">
                            PARE DE <br />
                            PERDER <br />
                            <span className="text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.6)]">DINHEIRO</span>
                        </h1>
                        <div className="flex items-baseline gap-3 mb-2">
                            <span className="text-white/30 text-lg line-through font-bold">R$ 147</span>
                            <div className="relative group/price">
                                <div className="absolute -inset-2 bg-[#FFF200]/20 blur-xl rounded-full opacity-0 group-hover/price:opacity-100 transition-opacity" />
                                <span className="text-4xl font-black text-white italic tracking-tighter relative z-10">
                                    R$ {productType === 'BOOST_BUNDLE' ? '132' : '97'}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 inline-block px-2 py-0.5 rounded border border-emerald-500/20">7 dias de garantia total</p>
                    </div>

                    {/* Benefits Grid (Compact) */}
                    <div className="flex-1 space-y-2 relative z-10 overflow-y-auto no-scrollbar pr-2">
                        {benefits.slice(0, 4).map((b, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={cn(
                                    "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all duration-300",
                                    b.isPrimary ? "bg-[#FFF200]/10 border-[#FFF200]/30 shadow-[0_0_15px_rgba(255,242,0,0.05)]" : "bg-white/5 border-white/5"
                                )}
                            >
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", b.isPrimary ? "bg-[#FFF200] text-black" : "bg-white/10 text-white/70")}>
                                    <b.icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h4 className={cn("text-[10px] font-black uppercase italic tracking-tight", b.isPrimary ? "text-white" : "text-white/80")}>{b.title}</h4>
                                    <p className="text-[9px] text-white/40 leading-tight mt-0.5 font-medium">{b.description}</p>
                                </div>
                            </motion.div>
                        ))}

                        {/* WHATSAPP PACK PREVIEW (Left Column Persuasion) */}
                        <AnimatePresence>
                            {(productType === 'BOOST_BUNDLE' || isBoostUnlocked) && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="pt-2 border-t border-emerald-500/20"
                                >
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <WhatsAppLogo className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">WhatsApp Plus Ativado</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Bot className="w-3 h-3 text-white/40 mt-0.5" />
                                            <p className="text-[9px] text-white/60 leading-tight font-medium">Gabi IA treinada para vender e cobrar sozinha.</p>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Target className="w-3 h-3 text-white/40 mt-0.5" />
                                            <p className="text-[9px] text-white/60 leading-tight font-medium">Recuperação de carrinhos abandonados.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-4 text-center">Finalizar Pagamento</h2>


                                {/* Seleção de Produtos - Premium Side-by-Side */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    {/* PLANO PRINCIPAL */}
                                    <div className="p-4 rounded-2xl border border-[#FFF200] bg-[#FFF200]/10 flex flex-col justify-between group/plan shadow-[0_0_20px_rgba(255,242,0,0.1)]">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Crown className="w-4 h-4 text-[#FFF200]" />
                                                <p className="text-[11px] font-black text-white uppercase tracking-wider">Assinatura Elite PRO</p>
                                            </div>
                                            <p className="text-[9px] text-white/40 uppercase font-black tracking-tight mb-2">Sistema Completo</p>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-white italic">R$ 97</span>
                                            <span className="text-[9px] text-[#FFF200] font-black uppercase tracking-tighter">/ Mensal</span>
                                        </div>
                                    </div>

                                    {/* DIRECT WHATSAPP PLUS (VENDEDOR CABULOSO) */}
                                    <div
                                        onClick={() => !isBoostUnlocked && setProductType(productType === 'PRO' ? 'BOOST_BUNDLE' : 'PRO')}
                                        className={cn(
                                            "relative overflow-hidden p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group/wa",
                                            (productType === 'BOOST_BUNDLE' || isBoostUnlocked)
                                                ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                                : "border-white/10 bg-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-widest animate-pulse">
                                            Pague uma vez
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <WhatsAppLogo className={cn("w-4 h-4", (productType === 'BOOST_BUNDLE' || isBoostUnlocked) ? "text-emerald-500" : "text-white/20")} />
                                                <p className="text-[11px] font-black text-white uppercase tracking-wider">Direct WhatsApp Plus</p>
                                            </div>
                                            <p className="text-[9px] text-emerald-400/60 uppercase font-black tracking-tight mb-2">Vendedor Automático + Gabi IA</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-baseline gap-1">
                                                <span className={cn("text-xl font-black italic", (productType === 'BOOST_BUNDLE' || isBoostUnlocked) ? "text-emerald-400" : "text-white/20")}>+ R$ 35</span>
                                                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-tighter bg-emerald-500/10 px-1.5 py-0.5 rounded">Taxa Única</span>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                                                (productType === 'BOOST_BUNDLE' || isBoostUnlocked) ? "bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "border-white/20"
                                            )}>
                                                {(productType === 'BOOST_BUNDLE' || isBoostUnlocked) && <Check className="w-3 h-3 text-black" strokeWidth={5} />}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Partner Code (Contextual - Logo abaixo dos planos) */}
                                {!isBoostUnlocked && (
                                    <div className="mb-4 flex gap-2">
                                        <Input
                                            placeholder="CÓDIGO DE PARCEIRO"
                                            value={partnerCode}
                                            onChange={e => setPartnerCode(e.target.value)}
                                            className="bg-white/5 border-white/10 h-8 text-[9px] uppercase font-black placeholder:text-white/20"
                                        />
                                        <Button
                                            onClick={handleApplyPartnerCode}
                                            disabled={!partnerCode || isApplyingCode}
                                            variant="secondary"
                                            className="h-8 px-3 text-[9px] font-black uppercase bg-white/10 hover:bg-white/20 text-white border-none"
                                        >
                                            {isApplyingCode ? <Loader2 size={10} className="animate-spin" /> : "APLICAR"}
                                        </Button>
                                    </div>
                                )}


                                {/* Benefícios Detalhados e Persuasivos (Restaurados no Estilo Premium) */}
                                <AnimatePresence>
                                    {(productType === 'BOOST_BUNDLE' || isBoostUnlocked) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="grid grid-cols-1 gap-2 mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                                </div>
                                                <p className="text-[10px] text-white/80 leading-tight">
                                                    <span className="text-emerald-400 font-black uppercase italic text-[8px] mr-1">Gabi IA 24h:</span>
                                                    Ela cobra clientes e responde dúvidas no WhatsApp por você. Sem folga.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                                                </div>
                                                <p className="text-[10px] text-white/80 leading-tight">
                                                    <span className="text-blue-400 font-black uppercase italic text-[8px] mr-1">Avisos Automáticos:</span>
                                                    Um clique no sistema e seu cliente recebe: "Seu pedido está pronto!" no celular.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 border border-yellow-500/20">
                                                    <Target className="w-3.5 h-3.5 text-yellow-500" />
                                                </div>
                                                <p className="text-[10px] text-white/80 leading-tight">
                                                    <span className="text-yellow-500 font-black uppercase italic text-[8px] mr-1">Recuperação Extra:</span>
                                                    Resgata pedidos parados chamando o cliente de volta com ofertas automáticas.
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Payment Method Selector (Sempre Visível) */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <button
                                        onClick={() => {
                                            setPaymentMethod('PIX_AUTOMATIC');
                                            requestAnimationFrame(() => paymentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                                        }}
                                        className={cn(
                                            "p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 relative group/paybtn",
                                            paymentMethod === 'PIX_AUTOMATIC' ? "border-[#FFF200] bg-[#FFF200]/10 shadow-[0_0_15px_rgba(255,242,0,0.1)]" : "border-white/5 bg-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className="absolute top-0 right-0 bg-[#FFF200] text-black text-[6px] font-black px-1 rounded-bl-lg uppercase">RECOMENDADO</div>
                                        <Zap className={cn("w-4 h-4 transition-transform duration-300 group-hover/paybtn:scale-110", paymentMethod === 'PIX_AUTOMATIC' ? "text-[#FFF200]" : "text-white/20")} />
                                        <span className="text-[9px] font-black uppercase text-white leading-none tracking-tighter">Pix Automático</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setPaymentMethod('CREDIT_CARD');
                                            requestAnimationFrame(() => paymentFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                                        }}
                                        className={cn(
                                            "p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 group/paybtn",
                                            paymentMethod === 'CREDIT_CARD' ? "border-[#FFF200] bg-[#FFF200]/10 shadow-[0_0_15px_rgba(255,242,0,0.1)]" : "border-white/5 bg-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <CreditCardIcon className={cn("w-4 h-4 transition-transform duration-300 group-hover/paybtn:scale-110", paymentMethod === 'CREDIT_CARD' ? "text-[#FFF200]" : "text-white/20")} />
                                        <span className="text-[9px] font-black uppercase text-white leading-none tracking-tighter">Cartão de Crédito</span>
                                    </button>
                                </div>



                                <div ref={paymentFormRef} className="flex-1 flex flex-col justify-start pt-4 scroll-mt-32">
                                    {paymentData?.pix ? (
                                        /* --- QR CODE DISPLAY (Shared for any Pix method) --- */
                                        <div className="flex flex-col items-center p-6 bg-white/5 rounded-2xl border border-white/10 text-center animate-in fade-in zoom-in duration-500">
                                            <div className="bg-white p-2 rounded-xl mx-auto w-48 h-48 flex items-center justify-center mb-4">
                                                <img src={`data:image/png;base64,${paymentData.pix.encodedImage}`} alt="QR Pix" className="w-full h-full" />
                                            </div>
                                            <div className="space-y-1 mb-6">
                                                <p className="text-xs text-white/40 uppercase font-black">Total a pagar</p>
                                                <p className="text-3xl font-black italic text-[#FFF200] tracking-tighter">R$ {productType === 'BOOST_BUNDLE' ? '132,00' : '97,00'}</p>
                                                <div className="h-4" />
                                                <p className="text-xs text-[#FFF200] font-bold uppercase animate-pulse">Aguardando Pagamento...</p>
                                                <p className="text-[10px] text-white/40">O sistema libera seu acesso automaticamente.</p>
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                <Button
                                                    onClick={() => { navigator.clipboard.writeText(paymentData.pix?.payload || ""); toast.success("Copiado!"); }}
                                                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/10 h-11 text-xs uppercase font-bold"
                                                >
                                                    <Copy className="w-4 h-4 mr-2" /> Copiar Código
                                                </Button>
                                                <Button
                                                    onClick={handleVerifyPayment}
                                                    disabled={isVerifying}
                                                    className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20 h-11 text-xs uppercase font-bold"
                                                >
                                                    {isVerifying ? <Loader2 className="animate-spin w-4 h-4" /> : "Já paguei"}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* --- PAYMENT FORMS (Card or Pix Setup) --- */
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {/* CREDIT CARD FIELDS */}
                                            {paymentMethod === 'CREDIT_CARD' && (
                                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                    {/* Virtual Card Preview */}
                                                    <div className="relative bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-4 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FFF200]/5 to-transparent rounded-full blur-2xl" />
                                                        <div className="flex justify-between items-start mb-6">
                                                            <div className="w-10 h-7 bg-primary rounded-md shadow-lg" />
                                                            <div className="flex gap-1.5 opacity-60">
                                                                <div className="w-8 h-5 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/100px-Visa_Inc._logo.svg.png')] bg-contain bg-no-repeat bg-center" />
                                                                <div className="w-8 h-5 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/100px-Mastercard-logo.svg.png')] bg-contain bg-no-repeat bg-center" />
                                                            </div>
                                                        </div>
                                                        <p className="font-mono text-lg text-white/80 tracking-[0.2em] mb-4">
                                                            {cardData.number || '•••• •••• •••• ••••'}
                                                        </p>
                                                        <div className="flex justify-between text-xs">
                                                            <div>
                                                                <p className="text-white/30 text-[9px] uppercase">Titular</p>
                                                                <p className="text-white/70 font-medium">{cardData.holderName || 'SEU NOME'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-white/30 text-[9px] uppercase">Validade</p>
                                                                <p className="text-white/70 font-medium">{cardData.expiry || 'MM/AA'}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Card Form Inputs */}
                                                    <div className="grid grid-cols-1 gap-3 p-4 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner">
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                                            <Input
                                                                placeholder="Nome como está no cartão"
                                                                value={cardData.holderName}
                                                                onChange={e => setCardData({ ...cardData, holderName: e.target.value.toUpperCase() })}
                                                                className="pl-10 bg-black/40 border-white/10 h-11 text-xs text-white placeholder:text-white/30"
                                                            />
                                                        </div>
                                                        <div className="relative">
                                                            <CreditCardIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                                            <Input
                                                                placeholder="Número do cartão"
                                                                value={cardData.number}
                                                                onChange={e => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                                                                className="pl-10 bg-black/40 border-white/10 h-11 text-xs text-white placeholder:text-white/30 font-mono tracking-wider"
                                                            />
                                                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/40" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <Input
                                                                placeholder="MM/AA"
                                                                value={cardData.expiry}
                                                                onChange={e => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
                                                                className="bg-black/40 border-white/10 h-11 text-xs text-white text-center"
                                                            />
                                                            <Input
                                                                placeholder="CVV"
                                                                maxLength={4}
                                                                value={cardData.cvv}
                                                                onChange={e => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '') })}
                                                                className="bg-black/40 border-white/10 h-11 text-xs text-white text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* BILLING INFO (Shared for Card and Pix Automatic) */}
                                            <div className="space-y-3 p-4 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner">
                                                <div className="flex flex-col gap-1 mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span className="text-[9px] text-white/40 uppercase font-black tracking-widest">Dados de Cobrança</span>
                                                    </div>
                                                    <p className="text-[10px] text-white/40 leading-tight">
                                                        Necessário para emissão da nota fiscal e registro seguro do seu {paymentMethod === 'PIX_AUTOMATIC' ? 'Pix' : 'pagamento'}.
                                                    </p>
                                                </div>
                                                <Input
                                                    placeholder="CPF ou CNPJ (obrigatório)"
                                                    value={formatCPFCNPJ(clientInfo.cpfCnpj)}
                                                    onChange={e => setClientInfo({ ...clientInfo, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                                                    className="bg-black/40 border-white/10 h-10 text-xs text-white placeholder:text-white/30 transition-all font-mono"
                                                    maxLength={18}
                                                />

                                                {/* Address fields only for Credit Card */}
                                                {paymentMethod === 'CREDIT_CARD' && (
                                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-300">
                                                        <Input
                                                            placeholder="CEP"
                                                            value={clientInfo.postalCode}
                                                            onChange={e => setClientInfo({ ...clientInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                                                            className="bg-black/40 border-white/10 h-10 text-xs text-white placeholder:text-white/30 font-mono"
                                                            maxLength={8}
                                                        />
                                                        <Input
                                                            placeholder="Nº ou Complemento"
                                                            value={clientInfo.addressNumber}
                                                            onChange={e => setClientInfo({ ...clientInfo, addressNumber: e.target.value })}
                                                            className="bg-black/40 border-white/10 h-10 text-xs text-white placeholder:text-white/30"
                                                        />
                                                    </div>
                                                )}

                                                <Input
                                                    placeholder="WhatsApp para recibo"
                                                    value={clientInfo.phone}
                                                    onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value.replace(/\D/g, '') })}
                                                    className="bg-black/40 border-white/10 h-10 text-xs text-white placeholder:text-white/30 font-mono"
                                                />
                                            </div>

                                            {/* MAIN ACTION BUTTON */}
                                            <Button
                                                onClick={handleProcessPayment}
                                                disabled={
                                                    !clientInfo.cpfCnpj ||
                                                    (clientInfo.cpfCnpj.length !== 11 && clientInfo.cpfCnpj.length !== 14) ||
                                                    isProcessingPayment
                                                }
                                                className="w-full bg-gradient-to-r from-[#FFF200] to-[#FFD700] text-black font-black uppercase h-14 rounded-xl shadow-[0_10px_40px_-10px_rgba(255,242,0,0.4)] hover:shadow-[0_15px_50px_-10px_rgba(255,242,0,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all text-xs tracking-widest"
                                            >
                                                {isProcessingPayment ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Sparkles className="w-4 h-4 fill-current" />
                                                        {`Pagar R$ ${productType === 'BOOST_BUNDLE' ? '132,00' : '97,00'}`}
                                                    </span>
                                                )}
                                            </Button>

                                            {paymentMethod === 'PIX_AUTOMATIC' && (
                                                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 animate-in fade-in zoom-in duration-300">
                                                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-[10px] text-white/60 leading-tight">
                                                            Ao confirmar, você autoriza o <span className="text-white font-bold">Pix Automático</span>: pagamento imediato de R$ {productType === 'BOOST_BUNDLE' ? '132,00' : '97,00'} e recorrência mensal de R$ 97,00.
                                                        </p>
                                                        <p className="text-[9px] text-white/30 italic">Pode ser cancelado a qualquer momento no app do seu banco.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Security Badges */}
                                            <div className="flex items-center justify-center gap-4 text-[8px] font-black uppercase tracking-tighter opacity-30 select-none">
                                                <div className="flex items-center gap-1"><Shield className="w-3 h-3" /> SSL 256-BIT</div>
                                                <div className="w-px h-3 bg-white/20" />
                                                <div className="flex items-center gap-1"><Lock className="w-3 h-3" /> Criptografado</div>
                                                <div className="w-px h-3 bg-white/20" />
                                                <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> PCI DSS</div>
                                            </div>
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
            </motion.div>

            <p className="absolute bottom-4 text-[10px] text-white/10 font-bold tracking-[0.3em] uppercase">Direct AI • {APP_VERSION}</p>
        </div>
    );
};

export default Checkout;
