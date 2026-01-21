import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Users, Printer, DollarSign, ArrowRight, Package, Star, Bot, Sparkles, X, Crown, Medal, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AchievementsModal } from './AchievementsModal';
import { useState, useEffect } from 'react';
import { CelebrationModal } from './CelebrationModal';

interface Goal {
    id: string;
    type: 'production' | 'sales' | 'growth';
    title: any;
    description: any;
    target: number;
    current: number;
    unit: string;
    icon: any;
    color: string;
    aiInsight: string;
    actionPath: string;
    actionLabel: string;
}

export const SmartGoalCard = ({ stats }: { stats: any }) => {
    const navigate = useNavigate();
    const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
    const [celebrationMilestone, setCelebrationMilestone] = useState<any | null>(null);

    const milestones = [
        { id: 'p1', category: 'production' as const, title: 'Start na Máquina', description: 'Você imprimiu seus primeiros 100 metros!', icon: Printer, value: stats?.totalMeters || 0, target: 100 },
        { id: 'p2', category: 'production' as const, title: 'Ritmo Industrial', description: 'Marca incrível de 500 metros rodados!', icon: Target, value: stats?.totalMeters || 0, target: 500 },
        { id: 'p3', category: 'production' as const, title: 'Lenda da Produção', description: 'Bateu 1km de material! Insuperável!', icon: Crown, value: stats?.totalMeters || 0, target: 1000 },
        { id: 'g1', category: 'growth' as const, title: 'Primeiros Contatos', description: 'Você conquistou seus primeiros 10 clientes!', icon: Users, value: stats?.customersCount || 0, target: 10 },
        { id: 'g2', category: 'growth' as const, title: 'Dominando o Bairro', description: '50 clientes na carteira. Expansão real!', icon: Medal, value: stats?.customersCount || 0, target: 50 },
        { id: 'g3', category: 'growth' as const, title: 'Exército de Clientes', description: 'Mais de 200 clientes. Você é uma autoridade!', icon: Star, value: stats?.customersCount || 0, target: 200 },
        { id: 's1', category: 'sales' as const, title: 'Primeiro Buffet', description: 'Faturou R$ 5.000 em vendas. O lucro chegou!', icon: TrendingUp, value: stats?.totalSales || 0, target: 5000 },
        { id: 's2', category: 'sales' as const, title: 'Gráfica de Respeito', description: 'Rompeu a barreira dos R$ 20.000! Parabéns!', icon: Trophy, value: stats?.totalSales || 0, target: 20000 },
        { id: 's3', category: 'sales' as const, title: 'Tubarão do Mercado', description: 'Marca histórica de R$ 50.000! Você é elite!', icon: Crown, value: stats?.totalSales || 0, target: 50000 },
    ];

    useEffect(() => {
        if (!stats) return;

        // Procura a maior conquista recém-desbloqueada que ainda não foi comemorada
        const unacknowledged = milestones
            .filter(m => m.value >= m.target)
            .filter(m => !localStorage.getItem(`acknowledged_milestone_${m.id}`))
            .sort((a, b) => b.target - a.target); // Pega a mais difícil primeiro

        if (unacknowledged.length > 0) {
            setCelebrationMilestone(unacknowledged[0]);
        }
    }, [stats]);

    const handleCloseCelebration = () => {
        if (celebrationMilestone) {
            localStorage.setItem(`acknowledged_milestone_${celebrationMilestone.id}`, 'true');
            setCelebrationMilestone(null);
        }
    };

    // Cálcula quantas conquistas o usuário já tem
    const unlockedCount = [
        (stats?.totalMeters || 0) >= 100,
        (stats?.totalMeters || 0) >= 500,
        (stats?.totalMeters || 0) >= 1000,
        (stats?.customersCount || 0) >= 10,
        (stats?.customersCount || 0) >= 50,
        (stats?.customersCount || 0) >= 200,
        (stats?.totalSales || 0) >= 5000,
        (stats?.totalSales || 0) >= 20000,
        (stats?.totalSales || 0) >= 50000,
    ].filter(Boolean).length;

    // Lógica Inteligente de Seleção de Meta
    const activeGoal: Goal = useMemo(() => {
        if ((stats?.totalMeters || 0) < 100) {
            return {
                id: 'first_100m',
                type: 'production',
                title: (
                    <>
                        <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest mr-1.5">Meta:</span>
                        FAZER DINHEIRO 🤑
                    </>
                ) as any,
                description: (
                    <span>
                        Sua primeira grande conquista: Imprimir <span className="text-primary font-black">100 metros</span>.
                    </span>
                ) as any,
                target: 100,
                current: stats?.totalMeters || 0,
                unit: 'm',
                icon: Printer,
                color: 'text-blue-500',
                aiInsight: "Analisei sua produção: a máquina precisa rodar! Os primeiros 100 metros são o aquecimento para a escala industrial. 🚀",
                actionPath: '/pedidos',
                actionLabel: 'Novo Pedido'
            };
        }

        if ((stats?.customersCount || 0) < 10) {
            return {
                id: 'client_expansion',
                type: 'growth',
                title: (
                    <>
                        <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest mr-1.5">Meta:</span>
                        EXPANSÃO DE CARTEIRA
                    </>
                ) as any,
                description: (
                    <span>
                        Diversifique sua receita cadastrando <span className="text-primary font-black">10 clientes</span> ativos.
                    </span>
                ) as any,
                target: 10,
                current: stats?.customersCount || 0,
                unit: ' / 10',
                icon: Users,
                color: 'text-purple-500',
                aiInsight: "Sua base está crescendo! Ter clientes recorrentes é o segredo. Cadastre mais alguns e garanta o faturamento do mês que vem.",
                actionPath: '/clientes',
                actionLabel: 'Cadastrar Cliente'
            };
        }

        const currentSales = stats?.totalSales || 0;
        const nextSalesTarget = Math.ceil((currentSales + 1000) / 1000) * 1000;
        const isShark = currentSales > 5000;

        return {
            id: 'revenue_booster',
            type: 'sales',
            title: (
                <>
                    <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest mr-1.5">Meta:</span>
                    FAZER DINHEIRO 🤑
                </>
            ) as any,
            description: (
                <span>
                    Próximo marco de faturamento: <span className="text-primary font-black">R$ {nextSalesTarget.toLocaleString('pt-BR')}</span>.
                </span>
            ) as any,
            target: nextSalesTarget,
            current: currentSales,
            unit: 'R$',
            icon: DollarSign,
            color: 'text-green-500',
            aiInsight: isShark
                ? `Você já é um tubarão aqui! 🦈 Bater R$ ${nextSalesTarget.toLocaleString('pt-BR')} é só mais um dia comum na sua escala. Vamos dominar o mercado!`
                : `Seu ticket médio está interessante. Pelos meus cálculos, faltam poucos fechamentos para batermos R$ ${nextSalesTarget.toLocaleString('pt-BR')}. Vamos pra cima!`,
            actionPath: '/pedidos',
            actionLabel: 'Vender Mais'
        };

    }, [stats]);

    const progress = Math.min((activeGoal.current / activeGoal.target) * 100, 100);
    const isCompleted = progress >= 100;

    return (
        <div className="mb-0 relative group">
            <div className={cn(
                "absolute -inset-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000",
                activeGoal.type === 'production' && "via-blue-500/20",
                activeGoal.type === 'growth' && "via-purple-500/20",
                activeGoal.type === 'sales' && "via-green-500/20"
            )} />

            <Card className="border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/80 backdrop-blur-xl shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                    <Target className="w-24 h-24 text-zinc-900 dark:text-white" />
                </div>

                <div className="p-4 md:p-5 flex flex-col justify-between gap-5 relative">
                    <div className="flex flex-col gap-4 flex-1">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-xl border shadow-inner flex-shrink-0",
                                activeGoal.type === 'production' && "bg-blue-500/10 border-blue-500/20 text-blue-500",
                                activeGoal.type === 'growth' && "bg-purple-500/10 border-purple-500/20 text-purple-500",
                                activeGoal.type === 'sales' && "bg-green-500/10 border-green-500/20 text-green-500",
                            )}>
                                {isCompleted ? <Trophy className="w-6 h-6 animate-bounce" /> : <activeGoal.icon className="w-6 h-6" />}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base md:text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        {isCompleted ? "Meta Conquistada!" : activeGoal.title}
                                        {isCompleted && <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                    </h3>
                                    <div className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-primary" /> Meta Mensal
                                    </div>
                                    <button
                                        onClick={() => setIsAchievementsOpen(true)}
                                        className="text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-primary transition-colors flex items-center gap-1.5 ml-auto"
                                    >
                                        <Trophy className="w-3 h-3 text-primary animate-pulse" /> Ver Conquistas ({unlockedCount})
                                    </button>
                                </div>
                                <div className="text-xs md:text-sm text-zinc-600 dark:text-zinc-400 font-medium max-w-md leading-relaxed">
                                    {isCompleted
                                        ? "Parabéns! Você destruiu essa meta. A IA está calculando o próximo nível..."
                                        : activeGoal.description}
                                </div>
                            </div>
                        </div>

                        {/* Gabi AI Widget (Calculator Style) */}
                        {!isCompleted && (
                            <div className="mt-4 relative group rounded-xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg shadow-purple-500/10 animate-in slide-in-from-right-full fade-in duration-500 ease-out">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-md rounded-xl" />
                                <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[10px] p-3 flex gap-3 items-start">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-1">
                                            Resumo da Gabi
                                            <span className="bg-white/10 px-1 py-0.5 rounded text-[7px] text-white/50 tracking-normal">AI PARTNER</span>
                                        </div>
                                        <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                            {activeGoal.aiInsight?.split(/(\d+[%]?|R\$ [\d,.]+)/g).map((part, i) =>
                                                /(\d+[%]?|R\$ [\d,.]+)/.test(part) ? <strong key={i} className="text-white font-black">{part}</strong> : part
                                            ) || "Analizando seu progresso..."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 w-full pt-1 border-t border-zinc-100 dark:border-white/5 mt-2 pt-4">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">Progresso Atual</span>
                            <span className={cn(
                                "tabular-nums font-bold",
                                activeGoal.color
                            )}>
                                {activeGoal.type === 'sales' && "R$ "}
                                {activeGoal.current.toLocaleString('pt-BR')}
                                <span className="text-zinc-600 mx-1">/</span>
                                {activeGoal.target.toLocaleString('pt-BR')} {activeGoal.unit.replace('R$', '').replace('/ 10', '')}
                            </span>
                        </div>

                        <div className="relative h-2.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden",
                                    activeGoal.type === 'production' && "bg-blue-500",
                                    activeGoal.type === 'growth' && "bg-purple-500",
                                    activeGoal.type === 'sales' && "bg-green-500",
                                    isCompleted && "bg-yellow-400"
                                )}
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse-slow w-full h-full" />
                            </div>
                        </div>

                        {!isCompleted && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "mt-1 w-full justify-between group/btn text-xs font-bold uppercase tracking-wide border hover:scale-[1.02] transition-all",
                                    activeGoal.type === 'production' && "text-blue-400 border-blue-500/20 hover:bg-blue-500/10",
                                    activeGoal.type === 'growth' && "text-purple-400 border-purple-500/20 hover:bg-purple-500/10",
                                    activeGoal.type === 'sales' && "text-green-400 border-green-500/20 hover:bg-green-500/10",
                                )}
                                onClick={() => navigate(activeGoal.actionPath)}
                            >
                                {activeGoal.actionLabel}
                                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <AchievementsModal
                isOpen={isAchievementsOpen}
                onClose={() => setIsAchievementsOpen(false)}
                stats={stats}
            />

            <CelebrationModal
                isOpen={!!celebrationMilestone}
                onClose={handleCloseCelebration}
                milestone={celebrationMilestone}
            />
        </div>
    );
};
