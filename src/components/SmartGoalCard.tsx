import React, { useMemo } from 'react';
import { differenceInSeconds } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Users, Printer, DollarSign, ArrowRight, Package, Star, Bot, Sparkles, X, Crown, Medal, TrendingUp, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AchievementsModal } from './AchievementsModal';
import { useState, useEffect } from 'react';
import { CelebrationModal } from './CelebrationModal';
import { GiftUnlockModal } from './GiftUnlockModal';
import { useSession } from '@/contexts/SessionProvider';

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

const isBasicTheme = () => document.documentElement.classList.contains('ui-basic');

export const SmartGoalCard = ({ stats }: { stats: any }) => {
    const { profile, supabase, hasPermission } = useSession();
    const navigate = useNavigate();
    const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
    const [celebrationMilestone, setCelebrationMilestone] = useState<any | null>(null);
    const [isGiftOpen, setIsGiftOpen] = useState(false);
    const [flashGoal, setFlashGoal] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(0);

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
        { id: 'white_label_unlock', category: 'growth' as const, title: 'Identidade Elite', description: 'Você desbloqueou a personalização total da marca!', icon: Gift, value: stats?.customersCount || 0, target: 100 },
    ];

    useEffect(() => {
        if (!stats || !profile) return;
        const serverCompletedTours = profile.completed_tours || [];
        const unacknowledged = milestones
            .filter(m => m.value >= m.target)
            .filter(m => {
                const dbKey = `milestone:${m.id}`;
                const localKey = `acknowledged_milestone_${m.id}`;
                return !localStorage.getItem(localKey) && !serverCompletedTours.includes(dbKey);
            })
            .sort((a, b) => b.target - a.target);

        if (unacknowledged.length > 0) {
            const milestone = unacknowledged[0];
            if (milestone.id === 'white_label_unlock') {
                setIsGiftOpen(true);
            } else {
                setCelebrationMilestone(milestone);
            }
        }

        const hasSeenSurprise = localStorage.getItem('acknowledged_milestone_branding_surprise_v2') ||
            serverCompletedTours.includes('milestone:branding_surprise_v2');

        if (!hasSeenSurprise && profile.subscription_status === 'active') {
            setIsGiftOpen(true);
        }
    }, [stats, profile]);

    useEffect(() => {
        if (!flashGoal) return;
        const interval = setInterval(() => {
            const seconds = differenceInSeconds(new Date(flashGoal.expiresAt), new Date());
            if (seconds <= 0) {
                setFlashGoal(null);
                localStorage.removeItem('gabi_flash_goal');
            } else {
                setTimeLeft(seconds);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [flashGoal]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    const persistMilestone = async (milestoneId: string, category?: string, target?: number) => {
        const localKey = `acknowledged_milestone_${milestoneId}`;
        const dbKey = `milestone:${milestoneId}`;
        localStorage.setItem(localKey, 'true');
        if (category && target) {
            milestones.filter(m => m.category === category && m.target <= target)
                .forEach(m => localStorage.setItem(`acknowledged_milestone_${m.id}`, 'true'));
        }
        if (profile && supabase) {
            try {
                const currentTours = profile.completed_tours || [];
                const milestoneToPersist = [dbKey];
                if (category && target) {
                    milestones.filter(m => m.category === category && m.target <= target)
                        .forEach(m => {
                            const key = `milestone:${m.id}`;
                            if (!milestoneToPersist.includes(key)) milestoneToPersist.push(key);
                        });
                }
                const updatedTours = Array.from(new Set([...currentTours, ...milestoneToPersist]));
                await supabase.from('profiles_v2').update({ completed_tours: updatedTours }).eq('uid', profile.uid);
            } catch (err) {
                console.error('[SmartGoalCard] Erro:', err);
            }
        }
    };

    const activeGoal: Goal = useMemo(() => {
        const canViewFinancials = hasPermission('view_financial_goals') || hasPermission('view_financial_dashboard');
        const totalMeters = stats?.lifetimeMeters || stats?.totalMeters || 0;

        if (totalMeters < 100) {
            return {
                id: 'prod_100',
                type: 'production',
                title: "Aquecendo a Máquina 🏎️",
                description: `Alcance os primeiros 100 metros totais. Faltam ${(100 - totalMeters).toFixed(1)}m.`,
                target: 100,
                current: totalMeters,
                unit: 'm',
                icon: Printer,
                color: 'text-blue-500',
                aiInsight: "Máquina parada é prejuízo! 🏎️ Vi que você tá começando, bora amassar esses 100m e mostrar quem manda na produção? 👊⚡",
                actionPath: '/pedidos',
                actionLabel: 'Novo Pedido'
            };
        }

        const currentSales = (stats?.lifetimeSales || stats?.totalSales || 0);
        if (canViewFinancials) {
            let nextSalesTarget = 0;
            let stepSize = 0;
            if (currentSales < 50000) {
                if (currentSales < 5000) nextSalesTarget = 5000;
                else if (currentSales < 20000) nextSalesTarget = 20000;
                else nextSalesTarget = 50000;
            } else {
                if (currentSales < 250000) stepSize = 50000;
                else if (currentSales < 1000000) stepSize = 100000;
                else stepSize = 500000;
                nextSalesTarget = Math.ceil((currentSales + 1) / stepSize) * stepSize;
            }
            const missing = nextSalesTarget - currentSales;
            return {
                id: `revenue_target_${nextSalesTarget}`,
                type: 'sales',
                title: currentSales > 100000 ? "Empire Builder 👑" : "Tubarão do Mercado 🦈",
                description: `Próximo marco histórico: R$ ${nextSalesTarget.toLocaleString('pt-BR')}. Falta R$ ${missing.toLocaleString('pt-BR')}.`,
                target: nextSalesTarget,
                current: currentSales,
                unit: 'R$',
                icon: DollarSign,
                color: 'text-green-500',
                aiInsight: currentSales > 300000
                    ? `VOCÊ É UMA MÁQUINA! 🤖💥 Já passamos de R$ ${(currentSales / 1000).toFixed(0)}k acumulados. A próxima barreira é logo ali!`
                    : "Seu faturamento tá consistente, mas eu sei que você pode MAIS! 🚀 Pelos meus cálculos, a gente bate essa meta rapidinho. BORA! 💰✨",
                actionPath: '/pedidos',
                actionLabel: 'Vender Mais'
            };
        }

        return {
            id: 'growth_fallback',
            type: 'growth',
            title: "Crescimento Constante 🚀",
            description: `Seu foco agora é expandir a base de clientes para fortalecer o negócio.`,
            target: 100,
            current: stats?.customersCount || 0,
            unit: 'clis',
            icon: Users,
            color: 'text-purple-500',
            aiInsight: "Foque em conquistar novos clientes! Uma base sólida garante o futuro da sua estamparia. 🤝🚀",
            actionPath: '/clientes',
            actionLabel: 'Novos Clientes'
        };
    }, [stats, hasPermission]);

    const progress = Math.min((activeGoal.current / activeGoal.target) * 100, 100);
    const isCompleted = progress >= 100;
    const unlockedCount = milestones.filter(m => m.value >= m.target).length;

    return (
        <div className="mb-0 relative group">
            <div className={cn(
                "absolute -inset-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000",
                activeGoal.type === 'production' && "via-blue-500/20",
                activeGoal.type === 'growth' && "via-purple-500/20",
                activeGoal.type === 'sales' && "via-green-500/20"
            )} />

            <Card className={cn(
                "border-none shadow-2xl overflow-hidden relative transition-all duration-500",
                isBasicTheme() 
                    ? "bg-zinc-900/60 backdrop-blur-xl border border-white/10" 
                    : "bg-black/60 backdrop-blur-2xl border border-white/5 hover:border-white/10 ring-1 ring-white/5"
            )}>
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Target className="w-24 h-24 text-white" />
                </div>

                <div className="p-4 md:p-5 flex flex-col justify-between gap-5 relative overflow-hidden">
                    <div className="flex flex-col gap-4 flex-1 min-w-0">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-xl border shadow-inner flex-shrink-0",
                                activeGoal.type === 'production' && "bg-blue-500/10 border-blue-500/20 text-blue-500",
                                activeGoal.type === 'growth' && "bg-purple-500/10 border-purple-500/20 text-purple-500",
                                activeGoal.type === 'sales' && "bg-green-500/10 border-green-500/20 text-green-500",
                            )}>
                                {isCompleted ? <Trophy className="w-6 h-6 animate-bounce" /> : <activeGoal.icon className="w-6 h-6" />}
                            </div>

                            <div className="space-y-1 min-w-0 flex-1 text-left">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base md:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2 truncate">
                                        {isCompleted ? "Meta Conquistada!" : activeGoal.title}
                                    </h3>
                                    <button onClick={() => setIsAchievementsOpen(true)} className="text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-primary transition-colors flex items-center gap-1.5 ml-auto">
                                        <Trophy className="w-3 h-3 text-primary" /> ({unlockedCount})
                                    </button>
                                </div>
                                <div className="text-xs md:text-sm text-zinc-400 font-medium leading-relaxed break-words">
                                    {isCompleted ? "Parabéns! Meta destruída." : activeGoal.description}
                                </div>
                            </div>
                        </div>

                        {!isCompleted && (
                            <div className={cn(
                                "mt-4 relative group rounded-xl p-[1px] shadow-lg overflow-hidden",
                                isBasicTheme() ? "bg-white/5 border border-white/10" : "bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7]"
                            )}>
                                {!isBasicTheme() && <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-30 blur-md rounded-xl" />}
                                <div className="relative rounded-[10px] p-2 md:p-3 flex gap-3 items-start bg-zinc-950/90 backdrop-blur-xl">
                                    <div className={cn(
                                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-lg",
                                        isBasicTheme() ? "bg-white/5 text-zinc-400 border border-white/10" : "bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] text-white"
                                    )}>
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-0.5 min-w-0 flex-1 text-left">
                                        <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Resumo da Gabi</div>
                                        <p className="text-[10px] md:text-[11px] leading-relaxed font-medium text-zinc-300 break-words">
                                            {activeGoal.aiInsight}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 w-full pt-4 border-t border-white/5 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                            <span className="text-zinc-500 uppercase tracking-wider">Progresso Atual</span>
                            <span className={cn("tabular-nums font-bold", activeGoal.color)}>
                                {activeGoal.type === 'sales' && "R$ "}{activeGoal.current.toLocaleString('pt-BR')} / {activeGoal.target.toLocaleString('pt-BR')} {activeGoal.unit.replace('R$', '')}
                            </span>
                        </div>

                        <div className="relative h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                            <div className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden",
                                    activeGoal.type === 'production' && "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]",
                                    activeGoal.type === 'growth' && "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]",
                                    activeGoal.type === 'sales' && "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]",
                                    isCompleted && "bg-primary shadow-[0_0_15px_rgba(242,230,53,0.5)]"
                                )}
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse-slow w-full h-full" />
                            </div>
                        </div>

                        {!isCompleted && (
                            <Button variant="ghost" size="sm" className="mt-1 w-full justify-between group/btn text-xs font-bold uppercase tracking-wide border border-white/10 hover:bg-white/5 text-white active:scale-95 transition-all" onClick={() => navigate(activeGoal.actionPath)}>
                                {activeGoal.actionLabel}
                                <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <AchievementsModal isOpen={isAchievementsOpen} onClose={() => setIsAchievementsOpen(false)} stats={stats} />
            <CelebrationModal isOpen={!!celebrationMilestone} onClose={() => setCelebrationMilestone(null)} milestone={celebrationMilestone} />
            <GiftUnlockModal isOpen={isGiftOpen} onClose={() => setIsGiftOpen(false)} userName={stats?.companyName} />
        </div>
    );
};
