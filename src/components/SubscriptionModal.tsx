
import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap, Shield, Crown, Bot, Printer } from "lucide-react";

interface SubscriptionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
    const handleUpgrade = () => {
        // Redirect to Stripe (Product: Direct AI Pro - Gestão & IA)
        window.open('https://buy.stripe.com/test_eVq5kE1DceNA51Afz18ww05', '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md border-[#FFF200]/20 bg-black/90 backdrop-blur-xl text-white p-0 gap-0 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">

                {/* Header Visual */}
                <div className="relative h-32 bg-gradient-to-br from-yellow-600 via-yellow-400 to-yellow-600 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/20 blur-3xl rounded-full"></div>
                    {/* The Crown icon and its container are now part of the DialogHeader below */}
                </div>

                <DialogHeader className="px-6 pt-6 pb-2 text-center">
                    <div className="mx-auto w-16 h-16 bg-[#FFF200]/10 rounded-full flex items-center justify-center mb-4 border border-[#FFF200]/20 shadow-[0_0_30px_rgba(255,242,0,0.15)]">
                        <Crown className="w-8 h-8 text-[#FFF200]" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-white tracking-tight">
                        Desbloqueie a <span className="text-[#FFF200]">Inteligência Real</span>
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 mt-2 text-base">
                        Leve sua gestão para o próximo nível com a potência máxima da Direct AI.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-4">
                    {/* Benefit 1 - AI HIGHLY EMPHASIZED */}
                    <div className="relative overflow-hidden rounded-xl border border-[#FFF200]/30 bg-gradient-to-r from-[#FFF200]/10 via-black/40 to-black/20 p-4 group">
                        {/* Animated Background Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF200]/10 to-transparent -translate-x-full group-hover:animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>

                        <div className="relative flex gap-4 items-start">
                            <div className="mt-1 bg-[#FFF200] p-2 rounded-lg text-black shadow-[0_0_15px_rgba(255,242,0,0.4)] animate-pulse">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-white text-lg flex items-center gap-2">
                                    Seu Gerente IA
                                    <span className="text-[10px] bg-[#FFF200] text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Novo</span>
                                </h4>
                                <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                                    <span className="text-[#FFF200]">"Quanto vendi hoje?"</span> Mande áudios e receba relatórios instantâneos. Sua empresa na palma da mão.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Benefit 2 - DTF SPECIALIZATION */}
                    <div className="flex gap-4 items-start group px-2">
                        <div className="mt-1 bg-white/5 p-2 rounded-lg group-hover:bg-[#FFF200]/10 transition-colors">
                            <Printer className="w-5 h-5 text-[#FFF200]" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-white">Feito para DTF & Impressão</h4>
                            <p className="text-sm text-zinc-400 leading-relaxed">Chega de adaptarc ERPs de padaria. Controle metros, rolos e insumos com a unidade de medida certa.</p>
                        </div>
                    </div>
                    {/* Benefit 3 - FINANCE & SPEED */}
                    <div className="flex gap-4 items-start group px-2">
                        <div className="mt-1 bg-white/5 p-2 rounded-lg group-hover:bg-[#FFF200]/10 transition-colors">
                            <Zap className="w-5 h-5 text-[#FFF200]" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-white">Criação de Pedidos Flash</h4>
                            <p className="text-sm text-zinc-400 leading-relaxed">Fluxo otimizado para lançar pedidos em segundos e calcular custos automaticamente.</p>
                        </div>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-white/5 mx-6 p-4 rounded-xl border border-white/5 text-center mb-2">
                    <p className="text-zinc-400 text-sm uppercase tracking-wider font-semibold mb-1">Apenas</p>
                    <div className="flex items-center justify-center gap-1">
                        <span className="text-muted-foreground text-lg line-through mr-2">R$ 97</span>
                        <span className="text-4xl font-bold text-white">R$ 47</span>
                        <span className="text-zinc-400 self-end mb-1">/mês</span>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2">
                    <Button
                        className="w-full h-14 text-lg font-bold bg-[#FFF200] text-black hover:bg-[#E6D900] shadow-[0_0_20px_rgba(255,242,0,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={handleUpgrade}
                    >
                        Assinar Agora
                    </Button>
                    <p className="text-center text-xs text-zinc-500 w-full mt-3 flex items-center justify-center gap-2">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-green-500" /> Pix Instantâneo</span>
                        <span>•</span>
                        <span>Cancelamento grátis</span>
                    </p>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );
};
