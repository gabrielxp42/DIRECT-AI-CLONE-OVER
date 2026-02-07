
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from "framer-motion";
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
    ArrowRight, Printer, Users, Target, X
} from "lucide-react";

interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

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
    }
];

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
    const navigate = useNavigate();

    const handleGoToCheckout = () => {
        onOpenChange(false);
        navigate('/checkout');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-full max-w-4xl border-white/10 bg-black/90 backdrop-blur-3xl text-white p-0 overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] rounded-3xl flex flex-col md:flex-row">
                <DialogTitle className="sr-only">Assinatura Elite DTF</DialogTitle>
                <DialogDescription className="sr-only">
                    Escolha o plano ideal para gerir sua produção de DTF com inteligência artificial.
                </DialogDescription>

                {/* Lado Esquerdo: Header + CTA */}
                <div className="relative flex flex-col md:w-[35%] bg-gradient-to-b from-[#111] to-black border-b md:border-b-0 md:border-r border-white/5 p-8 justify-between z-20">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-[#FFF200]/5 border border-[#FFF200]/10 rounded-full px-3 py-1 mb-6">
                            <Crown className="w-3.5 h-3.5 text-[#FFF200]" />
                            <span className="text-[10px] font-bold text-[#FFF200] uppercase tracking-wider">Sistema Elite DTF</span>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-[0.9] mb-4">
                            PARE DE <br /> PERDER <br />
                            <span className="text-[#FFF200]">DINHEIRO</span>
                        </h2>
                        <p className="text-sm text-white/40 font-medium leading-relaxed">
                            O Gabriel é o seu gerente que não dorme, não erra e organiza tudo 24h por dia.
                        </p>
                    </div>

                    <div className="mt-8">
                        <div className="flex items-baseline gap-3 mb-4">
                            <span className="text-white/20 text-xl line-through font-bold">R$ 147</span>
                            <span className="text-5xl font-black text-white italic tracking-tighter">R$ 97</span>
                            <span className="text-white/40 font-bold text-sm">/mês</span>
                        </div>
                        <Button
                            className="w-full h-14 text-base font-black bg-[#FFF200] text-black hover:bg-[#ffe600] rounded-xl uppercase gap-2 shadow-[0_20px_40px_-10px_rgba(255,242,0,0.3)]"
                            onClick={handleGoToCheckout}
                        >
                            Quero Assinar Agora
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Lado Direito: Grid de Benefícios */}
                <div className="flex-1 p-8 bg-black/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {benefits.map((benefit, idx) => (
                            <div key={idx} className={cn(
                                "p-4 rounded-2xl border transition-all",
                                benefit.isPrimary ? "bg-[#FFF200]/10 border-[#FFF200]/30" : "bg-white/5 border-white/10"
                            )}>
                                <benefit.icon className={cn("w-8 h-8 mb-3", benefit.isPrimary ? "text-[#FFF200]" : "text-white/40")} />
                                <h4 className="font-black text-sm uppercase italic mb-1">{benefit.title}</h4>
                                <p className="text-[11px] text-white/40 leading-tight">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 p-2 text-white/20 hover:text-white transition-colors z-50">
                    <X className="w-6 h-6" />
                </button>
            </DialogContent>
        </Dialog>
    );
};
