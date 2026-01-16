
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Check, Sparkles, Zap, Shield, Crown, Bot, TrendingUp,
    ArrowRight, Printer, Users, Smartphone, Clock, Target, X
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

    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setIsSuccess(true);
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const { session } = useSession();

    const handleUpgrade = async () => {
        if (!session?.user) {
            toast.error("Faça login para continuar.");
            return;
        }

        try {
            toast.loading("Criando checkout seguro...", { id: 'checkout-loader' });

            const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    priceId: 'price_1SnPXqQ1NJXG7xxhCmM22cIR', // Profissional DTF (R$ 59,90) - Confirmado na lista de preços
                    userId: session.user.id,
                    email: session.user.email,
                    returnUrl: window.location.href.split('?')[0]
                })
            });

            const data = await response.json();
            toast.dismiss('checkout-loader');

            // Log attempt to Admin Panel
            logPaymentEvent(`Usuário iniciou checkout: ${session.user.email}`, {
                price_id: 'price_1SnPXqQ1NJXG7xxhCmM22cIR',
                email: session.user.email
            }, session.user.id);

            if (data.error) throw new Error(data.error);
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error("URL de checkout não retornada.");
            }

        } catch (error: any) {
            console.error(error);
            toast.dismiss('checkout-loader');
            toast.error("Erro ao iniciar pagamento: " + error.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Modal Container */}
            <DialogContent className="w-[95vw] sm:w-full max-w-[420px] md:max-w-3xl lg:max-w-4xl max-h-[100dvh] sm:h-auto overflow-hidden border-white/10 bg-black/90 backdrop-blur-3xl text-white p-0 gap-0 shadow-[0_0_150px_rgba(0,0,0,1)] rounded-xl sm:rounded-3xl flex flex-col md:flex-row">
                <AnimatePresence mode="wait">
                    {!isSuccess ? (
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
                                        onClick={handleUpgrade}
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
                                        onClick={handleUpgrade}
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
                    ) : (
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
                                BEM-VINDO À ELITE
                            </motion.h2>

                            <motion.p className="text-white/60 font-medium text-lg max-w-md relative z-10 mb-10">
                                O Gabriel já está analisando seus dados. <br />
                                Sua empresa nunca mais será a mesma.
                            </motion.p>

                            <motion.div className="relative z-10">
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
        </Dialog>
    );
};
