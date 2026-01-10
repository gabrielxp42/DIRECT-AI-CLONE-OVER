
import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Shield, Crown, Bot, Printer, BarChart3, TrendingUp, Bell, ArrowRight, X } from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";

interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const features = [
    {
        icon: <Bot className="w-10 h-10" />,
        title: "Sócio Digital 24h",
        description: "Esqueça de olhar relatórios. O Gabriel monitora seu lucro e produção enquanto você foca no que importa."
    },
    {
        icon: <Zap className="w-10 h-10" />,
        title: "Pedidos em Segundos",
        description: "Um sistema feito sob medida para DTF. Crie pedidos e organize sua produção com facilidade total."
    },
    {
        icon: <TrendingUp className="w-10 h-10" />,
        title: "Lucro sob Controle",
        description: "Veja exatamente quanto está ganhando por dia com dashboards simples e diretos, sem enrolação."
    },
    {
        icon: <Sparkles className="w-10 h-10" />,
        title: "Arsenal que Cresce",
        description: "Você ganha novas ferramentas toda semana. O sistema fica mais potente e seu trabalho mais fácil, sem cobrar mais por isso."
    }
];

const FeatureCard = ({ feature, index, scrollProgress, total }: { feature: any, index: number, scrollProgress: number, total: number }) => {
    // Calcula a posição alvo deste slide (0.0 a 1.0)
    const targetPos = index / total;

    // Calcula a distância real considerando o loop (0.0 a 0.5)
    let diff = scrollProgress - targetPos;
    if (Math.abs(diff) > 0.5) {
        diff = diff > 0 ? diff - 1 : diff + 1;
    }

    // Mapeia a distância (-0.5 a 0.5) para uma escala de 0 a 1 de proximidade do centro
    const proximity = 1 - Math.min(Math.abs(diff) * (total / 1.5), 1); // Sensibilidade ajustada
    const isCenter = proximity > 0.95;

    // Direção para rotação
    const dir = diff > 0 ? -1 : 1;

    return (
        <motion.div
            initial={false}
            animate={{
                scale: 0.85 + (0.15 * proximity),
                z: -400 + (400 * proximity),
                rotateY: (1 - proximity) * (dir * 25),
                opacity: 0.2 + (0.8 * proximity),
                filter: `blur(${(1 - proximity) * 12}px)`,
                x: (1 - proximity) * (dir * 25), // Ultra-agressivo para caber
            }}
            style={{
                zIndex: Math.round(proximity * 100),
                pointerEvents: isCenter ? "auto" : "none"
            }}
            transition={{
                type: "spring",
                stiffness: 260,
                damping: 32,
                mass: 1
            }}
            className={cn(
                "relative w-full h-[260px] rounded-[52px] border transition-all duration-500 flex flex-col items-center p-8 select-none overflow-hidden",
                isCenter
                    ? "bg-white/[0.08] backdrop-blur-3xl border-white/20 shadow-[0_45px_100px_rgba(0,0,0,0.8)]"
                    : "bg-white/5 border-white/5"
            )}
        >
            {/* Liquid Glass Architecture */}
            {proximity > 0.8 && (
                <>
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-30 pointer-events-none" />
                    <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent opacity-20 pointer-events-none" />
                </>
            )}

            <div className="relative flex-shrink-0 mb-5">
                <div className={cn(
                    "w-16 h-16 rounded-[24px] flex items-center justify-center transition-all duration-700 relative",
                    proximity > 0.8
                        ? "bg-[#FFF200] text-black shadow-[0_15px_35px_rgba(255,242,0,0.4)] rotate-0 scale-100"
                        : "bg-white/10 text-white/20 rotate-12 scale-90"
                )}>
                    {React.cloneElement(feature.icon as React.ReactElement, { className: "w-7 h-7" })}
                    {proximity > 0.8 && (
                        <div className="absolute inset-0 rounded-[24px] bg-white/20 animate-pulse pointer-events-none blur-sm" />
                    )}
                </div>
            </div>

            <div className="flex flex-col items-center gap-2 flex-1">
                <h4 className={cn(
                    "font-black uppercase italic tracking-widest text-xl transition-all duration-500 text-center",
                    proximity > 0.8 ? "text-white opacity-100" : "text-white/20"
                )}>
                    {feature.title}
                </h4>
                <p className={cn(
                    "text-sm font-bold leading-tight px-4 transition-all duration-700 text-center",
                    proximity > 0.9 ? "text-white/70 translate-y-0 opacity-100" : "text-white/0 translate-y-4 opacity-0"
                )}>
                    {feature.description}
                </p>
            </div>

            {proximity > 0.8 && (
                <motion.div
                    layoutId="activeGlow"
                    className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#FFF200]/10 blur-[100px] rounded-full pointer-events-none z-[-1]"
                />
            )}
        </motion.div>
    );
};

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
    const [api, setApi] = React.useState<CarouselApi>();
    const [current, setCurrent] = React.useState(0);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [isSuccess, setIsSuccess] = React.useState(false);
    const timerRef = React.useRef<NodeJS.Timeout>();

    React.useEffect(() => {
        // Verifica se voltou do Stripe com sucesso
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            setIsSuccess(true);
            // Limpa o parâmetro da URL sem recarregar
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    React.useEffect(() => {
        if (!api) return;

        const onSelect = () => setCurrent(api.selectedScrollSnap());
        const onScroll = () => {
            let p = api.scrollProgress();
            p = ((p % 1) + 1) % 1;
            setScrollProgress(p);
        };

        const startAutoplay = (delay = 5000) => {
            stopAutoplay();
            timerRef.current = setTimeout(() => {
                if (api.canScrollNext()) api.scrollNext();
                else if (api.scrollSnapList().length > 0) api.scrollTo(0);
            }, delay);
        };

        const stopAutoplay = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = undefined;
            }
        };

        api.on("select", onSelect);
        api.on("scroll", onScroll);
        api.on("pointerDown", stopAutoplay);
        api.on("settle", () => {
            startAutoplay(5000);
        });

        startAutoplay(3000);
        onScroll();

        return () => {
            stopAutoplay();
            api.off("select", onSelect);
            api.off("scroll", onScroll);
        };
    }, [api]);

    const handleUpgrade = () => {
        window.open('https://buy.stripe.com/test_eVq5kE1DceNA51Afz18ww05', '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[min(620px,95vw)] h-fit max-h-[94vh] overflow-y-auto overflow-x-hidden border-white/10 bg-black/95 backdrop-blur-3xl text-white p-0 gap-0 shadow-[0_0_150px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-500 rounded-[56px] border-white/5 no-scrollbar select-none sm:px-0 flex flex-col items-center">
                <AnimatePresence mode="wait">
                    {!isSuccess ? (
                        <motion.div
                            key="modal-content"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full h-full flex flex-col items-center"
                        >
                            {/* Header Section */}
                            <div className="relative pt-12 pb-6 px-4 md:px-12 text-center w-full flex flex-col items-center">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-[#FFF200]/10 to-transparent pointer-events-none opacity-40" />

                                <div className="relative z-10 flex flex-col items-center w-full max-w-[90%] md:max-w-none">
                                    <div className="flex justify-center mb-6">
                                        <div className="p-4 bg-white/5 backdrop-blur-2xl rounded-[32px] border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.3)] relative group cursor-pointer" onClick={() => setIsSuccess(true)}>
                                            <div className="absolute inset-0 rounded-[32px] bg-[#FFF200]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            <Crown className="w-8 h-8 text-[#FFF200] drop-shadow-[0_0_12px_rgba(255,242,0,0.6)] relative z-10" strokeWidth={2.5} />
                                        </div>
                                    </div>

                                    <DialogTitle className="flex flex-col items-center gap-1.5 m-0 p-0 text-center w-full">
                                        <span className="opacity-60 text-[10px] md:text-xs font-black tracking-[0.4em] uppercase italic leading-none mb-1">
                                            O Cérebro da sua Empresa
                                        </span>
                                        <span className="text-[#FFF200] drop-shadow-[0_0_20px_rgba(255,242,0,0.3)] text-2xl md:text-3xl lg:text-4xl font-black tracking-tight uppercase italic leading-[1.1] w-full text-center text-balance">
                                            DESBLOQUEIE A <br className="md:hidden" /> INTELIGÊNCIA REAL
                                        </span>
                                    </DialogTitle>
                                </div>
                            </div>

                            <div className="relative py-8 w-full flex flex-col items-center px-4 md:px-10 overflow-visible">
                                <Carousel
                                    setApi={setApi}
                                    className="w-full max-w-full overflow-visible"
                                    opts={{
                                        loop: true,
                                        align: "center",
                                        skipSnaps: false
                                    }}
                                >
                                    <CarouselContent className="ml-0 items-center overflow-visible" viewportClassName="!overflow-visible">
                                        {features.map((feature, index) => (
                                            <CarouselItem key={index} className="pl-0 basis-[72%] sm:basis-[52%] min-w-0 px-2 flex justify-center perspective-[2000px]">
                                                <FeatureCard
                                                    feature={feature}
                                                    index={index}
                                                    scrollProgress={scrollProgress}
                                                    total={features.length}
                                                />
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                </Carousel>

                                {/* Indicators */}
                                <div className="flex justify-center gap-2.5 mt-8">
                                    {features.map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all duration-500 relative",
                                                current === i
                                                    ? "w-12 bg-[#FFF200] shadow-[0_0_15px_rgba(255,242,0,0.5)]"
                                                    : "w-1.5 bg-white/10"
                                            )}
                                        >
                                            {current === i && (
                                                <div className="absolute inset-0 bg-[#FFF200] blur-[4px] rounded-full opacity-50" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pricing Card */}
                            <div className="px-6 md:px-10 py-6 w-full">
                                <div className="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[48px] p-8 flex flex-col items-center justify-center gap-6 relative overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                    <div className="relative z-10 text-center space-y-2">
                                        <span className="text-[12px] text-white/40 font-black uppercase tracking-[0.4em]">Plano Elite Anual</span>
                                        <div className="flex items-baseline justify-center gap-4">
                                            <span className="text-white/20 text-2xl line-through italic font-black">R$ 97</span>
                                            <div className="flex items-baseline">
                                                <span className="text-6xl md:text-7xl font-black text-white italic tracking-tighter drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
                                                    R$ 47
                                                </span>
                                                <span className="text-xl font-bold text-white/40 ml-2 italic">/mês</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative z-10 bg-[#FFF200]/5 border border-[#FFF200]/30 rounded-full px-8 py-2.5 transition-all duration-300">
                                        <span className="text-[13px] text-[#FFF200] font-black uppercase italic tracking-widest flex items-center gap-2.5 drop-shadow-[0_0_10px_rgba(255,242,0,0.3)]">
                                            <Sparkles className="w-4 h-4" /> O dobro de recursos, metade do preço
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Section */}
                            <div className="px-6 md:px-10 pb-12 pt-4 flex flex-col items-center w-full">
                                <div className="w-full space-y-10 group flex flex-col items-center">
                                    <Button
                                        className="w-full h-20 text-2xl md:text-3xl font-black bg-[#FFF200] text-black hover:bg-[#ffe600] shadow-[0_20px_50px_-15px_rgba(255,242,0,0.6)] rounded-[32px] transition-all hover:scale-[1.02] active:scale-[0.98] uppercase italic gap-4 relative overflow-hidden flex items-center justify-center border-t border-white/30"
                                        onClick={handleUpgrade}
                                    >
                                        <span className="relative z-10 drop-shadow-[0_2px_5px_rgba(0,0,0,0.2)]">Assinar Agora</span>
                                        <ArrowRight className="w-7 h-7 relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                    </Button>

                                    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-white/30 text-[12px] font-black uppercase tracking-[0.3em] w-full px-4">
                                        <div className="flex items-center gap-3 decoration-transparent group/badge cursor-default">
                                            <Zap className="w-4 h-4 text-[#FFF200] drop-shadow-[0_0_8px_rgba(255,242,0,0.4)]" />
                                            <span className="group-hover/badge:text-white transition-colors">Pix Instantâneo</span>
                                        </div>
                                        <div className="hidden md:block w-px h-4 bg-white/5" />
                                        <div className="flex items-center gap-3 group/badge cursor-default">
                                            <Shield className="w-4 h-4 text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                            <span className="group-hover/badge:text-white transition-colors">Cancelamento Grátis</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success-content"
                            initial={{ opacity: 0, scale: 0.9, rotateX: 20 }}
                            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                            className="w-full flex flex-col items-center justify-center py-20 px-8 text-center min-h-[500px] relative overflow-hidden"
                            transition={{ type: "spring", damping: 20, stiffness: 100 }}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#FFF200]/5 blur-[120px] rounded-full animate-pulse" />

                            <div className="relative mb-12">
                                <motion.div
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: "spring", damping: 12 }}
                                    className="w-32 h-32 bg-[#FFF200] rounded-[40px] flex items-center justify-center shadow-[0_25px_60px_rgba(255,242,0,0.4)] relative z-10"
                                >
                                    <Check className="w-16 h-16 text-black" strokeWidth={4} />
                                    <div className="absolute -inset-4 border border-[#FFF200]/30 rounded-[48px] animate-[spin_10s_linear_infinite]" />
                                    <div className="absolute -inset-8 border border-[#FFF200]/10 rounded-[56px] animate-[spin_15s_linear_infinite_reverse]" />
                                </motion.div>
                                <motion.div
                                    animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                    className="absolute inset-0 bg-[#FFF200]/20 blur-3xl rounded-full"
                                />
                            </div>

                            <div className="relative z-10 space-y-4 max-w-sm">
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-4xl md:text-5xl font-black italic text-[#FFF200] uppercase tracking-tighter"
                                >
                                    PAGAMENTO <br />CONFIRMADO!
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-white/60 font-bold text-lg leading-tight uppercase tracking-widest italic"
                                >
                                    Seja bem-vindo ao próximo nível da sua empresa. <br />
                                    <span className="text-white">O Gabriel já está ativo.</span>
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 }}
                                className="mt-16 w-full max-w-xs"
                            >
                                <Button
                                    className="w-full h-16 text-xl font-bold bg-white text-black hover:bg-white/90 rounded-2xl shadow-[0_15px_30px_rgba(255,255,255,0.1)] transition-all uppercase italic"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Começar agora
                                </Button>
                            </motion.div>
                            <ConfettiEffect />
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

const ConfettiEffect = () => {
    return (
        <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: "50%", y: "50%", scale: 0, opacity: 1 }}
                    animate={{
                        x: `${Math.random() * 100}%`,
                        y: `${Math.random() * 100}%`,
                        scale: Math.random() * 2 + 0.5,
                        opacity: 0,
                        rotate: Math.random() * 360
                    }}
                    transition={{
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        repeatDelay: Math.random() * 3
                    }}
                    className="absolute w-2 h-2 bg-[#FFF200] rounded-full blur-[1px]"
                />
            ))}
        </div>
    );
};
