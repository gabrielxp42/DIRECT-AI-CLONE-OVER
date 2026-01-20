
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Check, Sparkles, Zap, Shield, Crown, Bot, TrendingUp,
    ArrowRight, Printer, Users, Smartphone, Clock, Target, X, Copy, CreditCard as CreditCardIcon
} from "lucide-react";
import { useSession } from "@/contexts/SessionProvider";
import { toast } from "sonner";

import { logPaymentEvent } from '@/utils/logger';

interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Vantagens com exemplos detalhados para o Hover
const benefits = [
    {
        icon: Bot,
        badge: "✨ EXCLUSIVO",
        badgeColor: "bg-[#FFF200] text-black border-[#FFF200]",
        title: "Seu Gerente 24h",
        description: "Pergunte sobre seu lucro. O Gabriel responde na hora.",
        example: {
            user: "Quanto lucrei com a Nike essa semana?",
            ai: "R$ 1.250,00 com 30% de margem! 🚀"
        },
        colSpan: "col-span-full md:col-span-1",
        isPrimary: true
    },
    {
        icon: Target,
        badge: "NOVO • IA",
        badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
        title: "Recupere Vendas",
        description: "O Gabriel avisa quais clientes sumiram.",
        example: {
            user: "Quem não compra há 30 dias?",
            ai: "Encontrei 5 clientes VIP parados. Mandei msg? 👀"
        },
        colSpan: "col-span-full md:col-span-1",
        isPrimary: false
    },
    {
        icon: TrendingUp,
        badge: "CLAREZA",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
        title: "Adeus Planilhas",
        description: "Controle financeiro automático.",
        example: {
            user: "Qual meu custo de tinta hoje?",
            ai: "R$ 42,00. O lucro está em R$ 380,00."
        },
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Printer,
        badge: "PARA DTF",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
        title: "Metros e Rolos",
        description: "Controle de estoque real.",
        example: {
            user: "Quanto resta no Rolo 2?",
            ai: "32 metros. Dá pra fazer +150 estampas peito."
        },
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Zap,
        badge: "TEMPO",
        badgeColor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
        title: "Pedido em 30s",
        description: "Venda rápida no balcão.",
        example: {
            user: "Novo pedido: 10m para Carlos",
            ai: "Feito! Total R$ 600. Link de pgto gerado. ✅"
        },
        colSpan: "col-span-1",
        isPrimary: false
    },
    {
        icon: Users,
        badge: "MEMÓRIA",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
        title: "Histórico Total",
        description: "Tudo sobre seus clientes.",
        example: {
            user: "O que o João comprou mês passado?",
            ai: "50m de DTF e 2L de tinta. Gastou R$ 3.5k."
        },
        colSpan: "col-span-1",
        isPrimary: false
    }
];

const BenefitCard = React.memo(({ benefit, index, isMobile }: {
    benefit: typeof benefits[0] & { example?: { user: string, ai: string } },
    index: number,
    isMobile?: boolean
}) => {
    const Icon = benefit.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                delay: index * 0.1,
                duration: 0.5,
                type: "spring",
                stiffness: 100
            }}
            className={cn(
                "relative flex flex-col items-start gap-3 p-4 rounded-2xl transition-all duration-300 group z-0",
                isMobile ? "w-full h-full bg-white/[0.05] border border-white/10" : benefit.colSpan,
                !isMobile && (benefit.isPrimary
                    ? "bg-gradient-to-br from-[#FFF200]/10 to-black/40 border border-[#FFF200]/30 shadow-[0_0_30px_-10px_rgba(255,242,0,0.15)] hover:z-50"
                    : "bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] hover:z-50")
            )}
        >
            {/* Hover Glow Effect (Desktop) */}
            {!isMobile && <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />}

            <div className="flex w-full items-start justify-between relative z-10">
                <div className={cn(
                    "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    !isMobile && "group-hover:scale-110 group-hover:rotate-6",
                    benefit.isPrimary
                        ? "bg-[#FFF200] text-black shadow-[0_8px_20px_rgba(255,242,0,0.3)]"
                        : "bg-white/10 text-white/50"
                )}>
                    <Icon className="w-5 h-5" />
                </div>

                <span className={cn(
                    "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    benefit.badgeColor
                )}>
                    {benefit.badge}
                </span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1 relative z-10 w-full">
                <h4 className={cn(
                    "font-black text-sm uppercase italic tracking-wide",
                    benefit.isPrimary ? "text-white" : "text-white/90"
                )}>
                    {benefit.title}
                </h4>

                <p className={cn(
                    "text-[11px] leading-relaxed font-medium transition-opacity duration-300",
                    isMobile ? "opacity-60 mb-2" : "group-hover:opacity-20",
                    benefit.isPrimary ? "text-white/70" : "text-white/40"
                )}>
                    {benefit.description}
                </p>

                {/* Inline Example for Mobile Carousel */}
                {isMobile && benefit.example && (
                    <div className="w-full bg-black/40 rounded-lg p-2 border border-white/5 space-y-1.5 mt-auto">
                        <div className="flex justify-end">
                            <span className="text-[9px] text-white/80 px-2 py-1 rounded-xl bg-white/5">
                                {benefit.example.user}
                            </span>
                        </div>
                        <div className="flex justify-start">
                            <div className="bg-[#FFF200] text-[9px] text-black font-black px-2 py-1 rounded-xl flex items-center gap-1 shadow-[0_2px_8px_rgba(255,242,0,0.2)]">
                                <Bot className="w-3 h-3" />
                                {benefit.example.ai}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Example (Desktop Only) */}
            {!isMobile && benefit.example && (
                <div className="absolute left-0 right-0 top-[85%] pt-4 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-300 z-50 hidden md:block px-2 sm:px-0">
                    <div className="bg-[#111111] rounded-xl p-3 border border-white/10 shadow-[0_20px_40px_-5px_rgba(0,0,0,1)] relative">
                        <div className="absolute -top-1.5 left-8 w-3 h-3 bg-[#111111] border-t border-l border-white/10 rotate-45" />

                        <div className="space-y-2">
                            <div className="flex justify-end">
                                <span className="text-[10px] text-white/90 px-2.5 py-1.5 rounded-2xl rounded-tr-sm max-w-[90%] font-medium bg-white/10">
                                    {benefit.example.user}
                                </span>
                            </div>
                            <div className="flex justify-start">
                                <div className="bg-[#FFF200] text-[10px] text-black font-black px-2.5 py-1.5 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(255,242,0,0.2)] max-w-[95%] flex items-center gap-1.5">
                                    <Bot className="w-3.5 h-3.5 shrink-0" />
                                    {benefit.example.ai}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {benefit.isPrimary && (
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-[#FFF200]/15 blur-[50px] rounded-full pointer-events-none opacity-60" />
            )}
        </motion.div>
    );
});

BenefitCard.displayName = 'BenefitCard';

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
    const [isSuccess, setIsSuccess] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState<'benefits' | 'checkout'>('benefits');
    const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
    const [paymentData, setPaymentData] = useState<{ url?: string; pix?: { encodedImage: string; payload: string }; subscriptionId?: string } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    // Credit Card Form State
    const [cardData, setCardData] = useState({
        holderName: '',
        number: '',
        expiry: '',
        cvv: ''
    });

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setIsSuccess(true);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const { session } = useSession();

    const handleUpgrade = async (methodOverride?: 'PIX' | 'CREDIT_CARD') => {
        if (!session?.user) {
            toast.error("Faça login para continuar.");
            return;
        }

        const currentMethod = methodOverride || paymentMethod;

        if (currentMethod === 'CREDIT_CARD') {
            if (!cardData.holderName || !cardData.number || !cardData.expiry || !cardData.cvv) {
                toast.error("Preencha todos os dados do cartão.");
                return;
            }
        }

        try {
            setIsProcessing(true);
            const loadingMsg = currentMethod === 'PIX' ? "Gerando QR Code Pix..." : "Processando pagamento seguro...";
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
                    paymentMethod: currentMethod,
                    creditCard: currentMethod === 'CREDIT_CARD' ? {
                        holderName: cardData.holderName,
                        number: cardData.number.replace(/\s+/g, ''),
                        expiryMonth,
                        expiryYear: '20' + expiryYear,
                        ccv: cardData.cvv
                    } : undefined,
                    creditCardHolderInfo: currentMethod === 'CREDIT_CARD' ? {
                        name: cardData.holderName,
                        email: session.user.email,
                        cpfCnpj: '00000000000', // Será substituído pelo gerado no backend para Sandbox
                        postalCode: '00000000',
                        addressNumber: '0',
                        phone: '00000000000'
                    } : undefined
                })
            });

            const data = await response.json();
            toast.dismiss('checkout-loader');

            if (data.success) {
                if (currentMethod === 'PIX') {
                    if (data.pix) {
                        setPaymentData(data);
                        setCheckoutStep('checkout');
                    } else {
                        throw new Error("Dados do PIX não foram gerados corretamente.");
                    }
                } else {
                    // Cartão ou Link direto
                    if (data.url) {
                        setPaymentData(data);
                        // Se for cartão com URL de redirecionamento (caso o direto falhe), ou se for link
                        if (currentMethod === 'CREDIT_CARD') {
                            // Lógica de sucesso do cartão (já redireciona ou mostra sucesso)
                            setIsSuccess(true);
                        } else {
                            setCheckoutStep('checkout');
                        }
                    } else {
                        // Se for sucesso de cartão sem URL (processamento direto 100%), apenas sucesso
                        if (currentMethod === 'CREDIT_CARD') {
                            setPaymentData(data); // Salva o ID da assinatura para verificação futura
                            setIsSuccess(true);
                        } else {
                            throw new Error("URL de pagamento não retornada.");
                        }
                    }
                }
            } else {
                throw new Error(data.error || "Falha desconhecida ao processar pagamento.");
            }

        } catch (error: any) {
            console.error(error);
            toast.dismiss('checkout-loader');
            toast.error(error.message || "Erro ao processar pagamento.");
        } finally {
            setIsProcessing(false);
        }
    };



    const handleVerifyPayment = async () => {
        if (!session?.access_token) return;
        try {
            setIsVerifying(true);
            toast.loading("Verificando aprovação no banco...", { id: 'verify-loader' });

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
                // Recarrega para atualizar o status do usuário globalmente
                window.location.reload();
            } else {
                toast.info("Pagamento ainda em análise. Tente novamente em alguns segundos.");
            }

        } catch (error) {
            console.error(error);
            toast.error("Erro ao verificar status.");
        } finally {
            setIsVerifying(false);
        }
    };

    const formatCardNumber = (value: string) => {
        const v = value.replace(/\D/g, '').substring(0, 16);
        return v.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const formatExpiry = (value: string) => {
        const v = value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 3) return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
        return v;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Modal Container */}
            <DialogContent className="w-[95vw] sm:w-full max-w-[420px] md:max-w-3xl lg:max-w-4xl h-[90vh] md:h-auto md:max-h-[85vh] overflow-y-auto md:overflow-hidden border-white/10 bg-black/90 backdrop-blur-3xl text-white p-0 gap-0 shadow-[0_0_150px_rgba(0,0,0,1)] rounded-xl sm:rounded-3xl flex flex-col md:flex-row">
                <DialogTitle className="sr-only">Assinatura Elite DTF</DialogTitle>
                <DialogDescription className="sr-only">
                    Escolha o plano ideal para gerir sua produção de DTF com inteligência artificial.
                </DialogDescription>
                <AnimatePresence mode="wait">
                    {/* State: Benefits Selection */}
                    {!isSuccess && checkoutStep === 'benefits' && (
                        <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">

                            {/* Lado Esquerdo (Desktop): Header + CTA Principal */}
                            <motion.div
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="relative flex flex-col md:w-[35%] lg:w-[32%] bg-gradient-to-b from-[#111] to-black border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-8 justify-between z-20 group/sidebar items-center text-center md:items-start md:text-left"
                            >
                                <div className="flex flex-col items-center md:items-start w-full">
                                    <div className="inline-flex items-center gap-2 bg-[#FFF200]/5 border border-[#FFF200]/10 rounded-full px-3 py-1 mb-4 md:mb-6 transition-colors group-hover/sidebar:border-[#FFF200]/20 group-hover/sidebar:bg-[#FFF200]/10">
                                        <Crown className="w-3.5 h-3.5 text-[#FFF200]" />
                                        <span className="text-[10px] font-bold text-[#FFF200] uppercase tracking-wider">
                                            Sistema Elite DTF
                                        </span>
                                    </div>

                                    <h2 className="text-3xl sm:text-3xl md:text-3xl lg:text-4xl font-black text-white uppercase italic tracking-tighter leading-[0.9] mb-3 md:mb-4">
                                        PARE DE <br />
                                        PERDER <br />
                                        <span className="text-[#FFF200] drop-shadow-[0_0_25px_rgba(255,242,0,0.3)] shimmer-text">DINHEIRO</span>
                                    </h2>

                                    <p className="text-xs sm:text-sm text-white/40 font-medium leading-relaxed max-w-[280px] md:max-w-[250px]">
                                        Uma funcionária que não dorme, não erra e organiza sua produção 24h por dia.
                                    </p>
                                </div>

                                {/* Preço e CTA Desktop */}
                                <div className="hidden md:flex flex-col gap-4 mt-8">
                                    <div className="relative group/price cursor-default">
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-white/20 text-xl line-through font-bold transition-colors group-hover/price:text-white/30">R$ 97</span>
                                            <span className="text-5xl font-black text-white italic tracking-tighter drop-shadow-2xl">
                                                R$ 47
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-white/40 font-bold text-sm">/mês</span>
                                            <div className="h-1 w-1 rounded-full bg-white/20" />
                                            <span className="text-emerald-400 font-bold text-xs uppercase tracking-wide">7 dias de garantia total</span>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-white/5" />

                                    <Button
                                        className="w-full h-14 text-base font-black bg-[#FFF200] text-black hover:bg-[#ffe600] shadow-[0_20px_40px_-10px_rgba(255,242,0,0.3)] rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase gap-2 relative overflow-hidden group/btn"
                                        onClick={() => handleUpgrade()}
                                    >
                                        <span className="relative z-10 text-black">Quero Organizar Agora</span>
                                        <ArrowRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 transition-transform text-black" />
                                        <div className="absolute inset-0 bg-white/30 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] z-0" />
                                    </Button>

                                    <p className="text-[10px] text-center text-white/20 uppercase font-bold tracking-widest flex items-center justify-center gap-2">
                                        <Shield className="w-3 h-3" />
                                        Compra 100% Segura
                                    </p>
                                </div>
                            </motion.div>

                            {/* Lado Direito / Mobile: Carousel de Benefícios */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex-1 flex flex-col min-h-0 bg-black/20 overflow-hidden relative"
                            >
                                {/* Scroll Area Desktop / Carousel Mobile */}
                                <div className="flex-1 overflow-x-hidden md:overflow-y-auto custom-scrollbar md:p-8 pb-32 md:pb-8 flex flex-col justify-center">

                                    {/* Desktop Grid */}
                                    <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-2xl mx-auto">
                                        {benefits.map((benefit, index) => (
                                            <BenefitCard key={index} benefit={benefit} index={index} />
                                        ))}
                                    </div>

                                    {/* Mobile Carousel (Snap Scroll) */}
                                    <div className="md:hidden w-full overflow-x-auto flex snap-x snap-mandatory gap-4 px-4 pb-4 pt-2 no-scrollbar scroll-smooth">
                                        {benefits.map((benefit, index) => (
                                            <div key={index} className="snap-center shrink-0 w-[280px] h-full flex items-center">
                                                <BenefitCard benefit={benefit} index={index} isMobile />
                                            </div>
                                        ))}
                                        {/* Spacer final para garantir padding */}
                                        <div className="w-4 shrink-0" />
                                    </div>

                                    {/* Indicadores Mobile (Dots) */}
                                    <div className="md:hidden flex justify-center gap-1.5 mt-2 mb-4">
                                        {benefits.map((_, idx) => (
                                            <div key={idx} className="w-1 h-1 rounded-full bg-white/20" />
                                        ))}
                                    </div>
                                </div>

                                {/* Mobile Bottom Bar - Fixo e Otimizado */}
                                <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-[#09090b]/95 backdrop-blur-xl z-30 pb-safe-area-bottom">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-white/30 text-sm line-through font-bold">R$ 97</span>
                                                <span className="text-3xl font-black text-white italic tracking-tight">R$ 47</span>
                                            </div>
                                        </div>
                                        <div className="bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full text-[10px] font-black text-red-400 animate-pulse tracking-wide">
                                            🔥 52% OFF
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full h-12 text-sm font-black bg-[#FFF200] text-black hover:bg-[#ffe600] rounded-xl uppercase gap-2 shadow-[0_4px_14px_rgba(255,242,0,0.3)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                        onClick={() => handleUpgrade()}
                                    >
                                        Quero Organizar Tudo
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                    <p className="text-[9px] text-center text-white/20 mt-2 font-medium">
                                        7 dias de garantia total • Acesso imediato
                                    </p>
                                </div>
                            </motion.div>

                            {/* Close Button Absolute */}
                            <button
                                onClick={() => onOpenChange(false)}
                                className="absolute top-4 right-4 p-2 text-white/20 hover:text-white transition-colors z-50 rounded-full hover:bg-white/5"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {/* State: Checkout (Pix / Card) */}
                    {!isSuccess && checkoutStep === 'checkout' && (
                        <motion.div
                            key="checkout-content"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full flex flex-col p-6 md:p-10 bg-[#09090b] h-full overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">
                                    FINALIZAR PAGAMENTO
                                </h2>
                                <button
                                    onClick={() => setCheckoutStep('benefits')}
                                    className="text-white/20 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex flex-col lg:flex-row gap-8">
                                {/* Seletor de Método e Formulário */}
                                <div className="flex-1 space-y-6">
                                    <div className="flex gap-4 mb-6">
                                        <button
                                            onClick={() => setPaymentMethod('PIX')}
                                            className={cn(
                                                "flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                                                paymentMethod === 'PIX' ? "border-[#FFF200] bg-[#FFF200]/10" : "border-white/5 bg-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <Zap className={cn("w-6 h-6", paymentMethod === 'PIX' ? "text-[#FFF200]" : "text-white/20")} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Pagar com PIX</span>
                                        </button>
                                        <button
                                            onClick={() => setPaymentMethod('CREDIT_CARD')}
                                            className={cn(
                                                "flex-1 p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                                                paymentMethod === 'CREDIT_CARD' ? "border-[#FFF200] bg-[#FFF200]/10" : "border-white/5 bg-white/5 hover:border-white/20"
                                            )}
                                        >
                                            <CreditCardIcon className={cn("w-6 h-6", paymentMethod === 'CREDIT_CARD' ? "text-[#FFF200]" : "text-white/20")} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Cartão de Crédito</span>
                                        </button>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {paymentMethod === 'PIX' ? (
                                            <motion.div
                                                key="pix-form"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="flex flex-col items-center p-8 rounded-2xl bg-white/5 border border-white/10"
                                            >
                                                {paymentData?.pix ? (
                                                    <div className="flex flex-col items-center gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                        <div className="text-center space-y-0.5">
                                                            <div className="flex items-baseline justify-center gap-2">
                                                                <span className="text-sm text-white/40 line-through">R$ 97,00</span>
                                                                <span className="text-4xl font-black text-[#FFF200] tracking-tighter">R$ 47,00</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/50 font-medium uppercase tracking-wide">
                                                                Isso dá menos de <span className="text-white font-bold">R$ 1,60 por dia</span>.
                                                            </p>
                                                            <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded-full inline-block mt-1">
                                                                ROI Imediato: Um erro evitado paga o mês.
                                                            </p>
                                                        </div>

                                                        <div className="bg-white p-2 rounded-xl shadow-[0_0_50px_rgba(255,255,255,0.1)] relative group mt-1">
                                                            <div className="absolute -inset-1 bg-gradient-to-tr from-[#FFF200] to-transparent opacity-20 blur-lg group-hover:opacity-40 transition-opacity" />
                                                            <img
                                                                src={`data:image/png;base64,${paymentData.pix.encodedImage}`}
                                                                alt="QR Code Pix"
                                                                className="w-32 h-32 md:w-40 md:h-40 relative z-10"
                                                            />
                                                        </div>

                                                        <div className="text-center space-y-1">
                                                            <p className="text-[10px] text-[#FFF200] font-black uppercase tracking-widest animate-pulse">
                                                                Aguardando Pagamento...
                                                            </p>
                                                            <p className="text-[10px] text-white/40 max-w-[200px] leading-tight">
                                                                Liberação automática assim que confirmado.
                                                            </p>
                                                        </div>

                                                        <Button
                                                            className="w-full h-10 bg-white/5 border border-white/10 text-white hover:bg-white/10 gap-2 font-bold text-xs uppercase"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(paymentData.pix?.payload || "");
                                                                toast.success("Código Pix copiado!");
                                                            }}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                            Copiar Código Pix
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center py-10 gap-4">
                                                        <div className="w-10 h-10 border-2 border-[#FFF200]/20 border-t-[#FFF200] rounded-full animate-spin" />
                                                        <p className="text-xs text-white/40 uppercase font-black">Gerando QR Code...</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="card-form"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                                className="space-y-4"
                                            >
                                                <div className="space-y-4 p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nome no Cartão</label>
                                                        <input
                                                            type="text"
                                                            placeholder="NOME IGUAL NO CARTÃO"
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#FFF200] focus:ring-1 focus:ring-[#FFF200] outline-none transition-all uppercase"
                                                            value={cardData.holderName}
                                                            onChange={e => setCardData({ ...cardData, holderName: e.target.value })}
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Número do Cartão</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="0000 0000 0000 0000"
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#FFF200] focus:ring-1 focus:ring-[#FFF200] outline-none transition-all"
                                                                value={cardData.number}
                                                                onChange={e => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                                                            />
                                                            <CreditCardIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Validade</label>
                                                            <input
                                                                type="text"
                                                                placeholder="MM/AA"
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#FFF200] focus:ring-1 focus:ring-[#FFF200] outline-none transition-all"
                                                                value={cardData.expiry}
                                                                onChange={e => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">CVV</label>
                                                            <input
                                                                type="text"
                                                                placeholder="123"
                                                                maxLength={4}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#FFF200] focus:ring-1 focus:ring-[#FFF200] outline-none transition-all"
                                                                value={cardData.cvv}
                                                                onChange={e => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '') })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    className="w-full h-14 bg-[#FFF200] text-black font-black uppercase tracking-widest rounded-xl hover:bg-[#ffe600] disabled:opacity-50 shadow-[0_15px_30px_-10px_rgba(255,242,0,0.3)]"
                                                    disabled={isProcessing}
                                                    onClick={() => handleUpgrade('CREDIT_CARD')}
                                                >
                                                    {isProcessing ? "PROCESSANDO..." : "PAGAR R$ 47,00 AGORA"}
                                                </Button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Resumo de Segurança */}
                                <div className="hidden lg:block w-72 space-y-4">
                                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Shield className="w-5 h-5 text-emerald-400" />
                                            <span className="text-xs font-black uppercase tracking-widest">Segurança Total</span>
                                        </div>
                                        <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                                            Seus dados são criptografados e processados diretamente via Asaas. Não salvamos informações de cartão em nossos servidores.
                                        </p>
                                    </div>
                                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Clock className="w-5 h-5 text-blue-400" />
                                            <span className="text-xs font-black uppercase tracking-widest">Ativação Imediata</span>
                                        </div>
                                        <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                                            Após a confirmação, seu acesso Pro é liberado automaticamente no sistema.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* State: Success */}
                    {isSuccess && (
                        /* Success State */
                        <motion.div
                            key="success-content"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full flex flex-col items-center justify-center py-20 px-6 text-center min-h-[500px] relative bg-black/95"
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FFF200]/5 blur-[100px] rounded-full pointer-events-none" />

                            <motion.div
                                initial={{ scale: 0, rotate: -30 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ delay: 0.2, type: "spring", damping: 15 }}
                                className="w-24 h-24 bg-[#FFF200] rounded-[2rem] flex items-center justify-center shadow-[0_20px_60px_-10px_rgba(255,242,0,0.5)] relative z-10 mb-8"
                            >
                                <Check className="w-12 h-12 text-black" strokeWidth={4} />
                            </motion.div>

                            <motion.h2 className="text-3xl md:text-5xl font-black italic text-[#FFF200] uppercase tracking-tighter mb-4 relative z-10">
                                PAGAMENTO RECEBIDO!
                            </motion.h2>

                            <motion.p className="text-white/60 font-medium text-lg max-w-md relative z-10 mb-10">
                                Estamos aguardando a confirmação do banco. <br />
                                Seu acesso Pro será liberado em instantes.
                            </motion.p>

                            <motion.div className="relative z-10 flex flex-col gap-3">
                                <Button
                                    className="h-12 px-8 text-sm font-bold bg-white/10 border border-white/20 text-white hover:bg-white/20 rounded-xl uppercase tracking-wide gap-2"
                                    onClick={handleVerifyPayment}
                                    disabled={isVerifying}
                                >
                                    {isVerifying ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <TrendingUp className="w-4 h-4" />
                                    )}
                                    Já Confirmei / Verificar Agora
                                </Button>
                                <Button
                                    className="h-14 px-10 text-lg font-black bg-white text-black hover:bg-white/90 rounded-xl uppercase tracking-wide gap-3 shadow-2xl"
                                    onClick={() => onOpenChange(false)}
                                >
                                    <Sparkles className="w-5 h-5 text-[#FFF200] fill-current" />
                                    Acessar Painel
                                </Button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog >
    );
};
