import React, { useMemo } from 'react';
import { Bot, TrendingUp, TrendingDown, Target, Zap, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GabiReportsInsightProps {
    reportData: any;
    isLoading?: boolean;
}

export const ReportsGabiInsight = ({ reportData, isLoading }: GabiReportsInsightProps) => {
    const gabiMessage = useMemo(() => {
        if (!reportData) return null;

        const { totalRevenue, monthlyGrowth, profitMargin, totalOrders, metersReport } = reportData;
        const revenueGrowth = monthlyGrowth?.revenue || 0;

        // 1. Cenário de Alto Crescimento (Receita > 30%)
        if (revenueGrowth > 30) {
            return {
                icon: Zap,
                color: "text-primary",
                bg: "bg-primary/10",
                border: "border-primary/20",
                title: "Crescimento Explosivo! 🚀",
                message: `Sua receita subiu impressionantes ${revenueGrowth.toFixed(1)}% em relação ao período anterior. O volume de pedidos acompanhou? Mantenha o estoque de tinta e mídia em dia!`
            };
        }

        // 2. Cenário de Atenção (Queda > 15%)
        if (revenueGrowth < -15) {
            return {
                icon: AlertCircle,
                color: "text-red-500",
                bg: "bg-red-500/10",
                border: "border-red-500/20",
                title: "Sinal Amarelo ⚠️",
                message: `Notei uma queda de ${Math.abs(revenueGrowth).toFixed(1)}% na receita. Verifique se houve menos dias úteis ou se algum cliente grande parou de pedir. Posso ajudar a criar uma promoção de recuperação.`
            };
        }

        // 3. Cenário de Alta Produção (Metragem > esperada - Exemplo visual)
        if (metersReport?.totalMeters > 1000) { // Exemplo arbitrário, ajustável
            return {
                icon: Sparkles,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
                title: "Fábrica a Todo Vapor 🏭",
                message: `Você já imprimiu mais de ${Math.floor(metersReport.totalMeters)} metros neste período! Sua máquina não para. Lembre-se de verificar a manutenção preventiva das cabeças de impressão.`
            };
        }

        // 4. Cenário Padrão (Resumo Geral)
        return {
            icon: Bot,
            color: "text-primary",
            bg: "bg-primary/10",
            border: "border-primary/20",
            title: "Resumo da Gabi 💎",
            message: `Tudo estável. Faturamos ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)} com ${totalOrders} pedidos. A margem de lucro está saudável em ${profitMargin.toFixed(1)}%. Continue assim!`
        };
    }, [reportData]);

    if (isLoading || !gabiMessage) return null;

    return (
        <div className={cn(
            "relative group rounded-xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg shadow-purple-500/10 mt-2",
            "animate-in slide-in-from-right-full fade-in duration-500 ease-out"
        )}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-md rounded-xl" />
            <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[10px] p-4 flex gap-4 items-start">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                    <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                        {gabiMessage.title}
                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px] text-white/60">GABI AI</span>
                    </div>
                    <p className="text-[12px] text-slate-300 leading-relaxed font-medium">
                        {/* Process message to highlight bold parts if needed, or just render as is if gabiMessage.message already has tags */}
                        {gabiMessage.message.split(/(\d+[%]?|R\$ [\d,.]+)/g).map((part, i) =>
                            /(\d+[%]?|R\$ [\d,.]+)/.test(part) ? <strong key={i} className="text-white font-black">{part}</strong> : part
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};
