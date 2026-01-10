
import React from 'react';
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
import { Check, Sparkles, Zap, Shield, Crown, Bot, Printer, BarChart3, TrendingUp, Bell, ArrowRight } from "lucide-react";
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

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
    const [api, setApi] = React.useState<CarouselApi>();
    const [current, setCurrent] = React.useState(0);

    React.useEffect(() => {
        if (!api) return;
        setCurrent(api.selectedScrollSnap());
        api.on("select", () => {
            setCurrent(api.selectedScrollSnap());
        });
    }, [api]);

    const handleUpgrade = () => {
        window.open('https://buy.stripe.com/test_eVq5kE1DceNA51Afz18ww05', '_blank');
    };

    const features = [
        {
            icon: <Bot className="w-6 h-6" />,
            title: "Gerente IA 24/7",
            badge: "Novo",
            description: (
                <>
                    <span className="text-[#FFF200]">"Vendas cresceram 457%!"</span> Receba cobranças automáticas e insights reais via WhatsApp e Voz em tempo real.
                </>
            ),
            highlights: ["Cobranças WhatsApp", "Relatórios via Áudio"]
        },
        {
            icon: <TrendingUp className="w-6 h-6" />,
            title: "Relatórios de Elite",
            badge: "Inteligente",
            description: (
                <>
                    Visualize <span className="text-green-400 font-bold">lucro real, inadimplência e projeções</span> com dashboards que explicam seu negócio.
                </>
            ),
            highlights: ["Análise de Margem", "Previsão de Caixa"]
        },
        {
            icon: <Printer className="w-6 h-6" />,
            title: "Especialista em DTF",
            badge: "Foco",
            description: (
                <>
                    Controle <span className="text-[#FFF200]">metros, rolos e insumos</span>. Um sistema moldado para quem vive de impressão e escala.
                </>
            ),
            highlights: ["Custos Automáticos", "Pedidos em 2 Cliques"]
        }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95vw] max-h-[95vh] overflow-y-auto border-white/10 bg-[#080808] text-white p-0 gap-0 shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 scrollbar-none">

                {/* Header Visual - More sleek */}
                <div className="relative h-24 md:h-28 bg-gradient-to-br from-zinc-900 to-[#111] flex items-center justify-center overflow-hidden border-b border-white/5">
                    <div className="absolute inset-0 bg-[#FFF200]/5 opacity-10"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#FFF200]/10 blur-[60px] rounded-full animate-pulse"></div>
                    <Crown className="w-10 h-10 text-[#FFF200] relative z-20 drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" />
                </div>

                <DialogHeader className="px-6 pt-6 pb-2 text-center">
                    <DialogTitle className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase italic rotate-[-1deg]">
                        DESBLOQUEIE A <br />
                        <span className="text-[#FFF200] drop-shadow-[0_0_10px_rgba(255,242,0,0.3)]">INTELIGÊNCIA REAL</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-2">
                    <Carousel setApi={setApi} className="w-full" opts={{ loop: true }}>
                        <CarouselContent className="-ml-2 md:-ml-4">
                            {features.map((feature, index) => (
                                <CarouselItem key={index} className="pl-2 md:pl-4">
                                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/50 p-5 md:p-6 min-h-[190px] flex flex-col justify-between group transition-all hover:bg-zinc-900/80">
                                        <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all">
                                            {React.cloneElement(feature.icon as React.ReactElement, { className: "w-24 h-24" })}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="bg-[#FFF200] p-2 rounded-xl text-black shadow-[0_0_20px_rgba(255,242,0,0.2)]">
                                                    {feature.icon}
                                                </div>
                                                <h4 className="font-bold text-white text-lg md:text-xl">
                                                    {feature.title}
                                                </h4>
                                                <span className="text-[9px] bg-[#FFF200]/10 text-[#FFF200] px-2 py-0.5 rounded-full font-black uppercase border border-[#FFF200]/20">
                                                    {feature.badge}
                                                </span>
                                            </div>
                                            <p className="text-sm md:text-base text-zinc-300 leading-snug font-medium">
                                                {feature.description}
                                            </p>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-1.5 font-bold">
                                            {feature.highlights.map((h, i) => (
                                                <span key={i} className="text-[9px] md:text-[10px] text-zinc-400 bg-white/5 px-2 py-1 rounded-md">
                                                    {h}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                    </Carousel>

                    {/* Pagination Indicator - More spaced */}
                    <div className="flex justify-center gap-2 mt-4 mb-2">
                        {features.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => api?.scrollTo(i)}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    current === i ? "w-8 bg-[#FFF200]" : "w-1.5 bg-white/10 hover:bg-white/30"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Pricing Section - Cleaner and separated */}
                <div className="px-6 py-2">
                    <div className="bg-zinc-900/80 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest leading-none mb-1">PLANO PRO ANUAL</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-muted-foreground text-sm line-through">R$ 97</span>
                                <span className="text-3xl font-black text-white italic">R$ 47<span className="text-xs not-italic font-medium text-zinc-500 ml-1">/mês</span></span>
                            </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-md font-bold border border-green-500/20">50% OFF</span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2 pb-8">
                    <div className="w-full space-y-4">
                        <Button
                            className="w-full h-14 text-lg font-black bg-[#FFF200] text-black hover:bg-[#ffe600] shadow-[0_10px_20px_-5px_rgba(255,242,0,0.3)] rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.98] uppercase italic"
                            onClick={handleUpgrade}
                        >
                            Assinar Agora <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <div className="flex items-center justify-center gap-4 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-[#FFF200]" /> Pix Instantâneo</span>
                            <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                            <span>Cancelamento Free</span>
                        </div>
                    </div>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
};
