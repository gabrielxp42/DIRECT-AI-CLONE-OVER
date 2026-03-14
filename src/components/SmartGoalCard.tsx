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
        // Special Unique Milestone: White Label Unlock (100 clients)
        { id: 'white_label_unlock', category: 'growth' as const, title: 'Identidade Elite', description: 'Você desbloqueou a personalização total da marca!', icon: Gift, value: stats?.customersCount || 0, target: 100 },
    ];

    useEffect(() => {
        if (!stats || !profile) return;

        const serverCompletedTours = profile.completed_tours || [];

        // Procura a maior conquista recém-desbloqueada que ainda não foi comemorada
        const unacknowledged = milestones
            .filter(m => m.value >= m.target)
            .filter(m => {
                const dbKey = `milestone:${m.id}`;
                const localKey = `acknowledged_milestone_${m.id}`;
                return !localStorage.getItem(localKey) && !serverCompletedTours.includes(dbKey);
            })
            .sort((a, b) => b.target - a.target); // Pega a mais difícil primeiro

        if (unacknowledged.length > 0) {
            const milestone = unacknowledged[0];
            if (milestone.id === 'white_label_unlock') {
                setIsGiftOpen(true);
            } else {
                setCelebrationMilestone(milestone);
            }
        }

        // NOVO: Trigger surpresa de branding para todos
        const hasSeenSurprise = localStorage.getItem('acknowledged_milestone_branding_surprise_v2') ||
            serverCompletedTours.includes('milestone:branding_surprise_v2');

        if (!hasSeenSurprise && profile.subscription_status === 'active') {
            setIsGiftOpen(true);
        }
    }, [stats, profile]);

    // Timer do Flash Goal
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

    // Sincronização entre abas (Storage Event Listener)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'gabi_flash_goal') {
                if (e.newValue) {
                    try {
                        const parsed = JSON.parse(e.newValue);
                        setFlashGoal(parsed);
                    } catch (err) { /* ignore */ }
                } else {
                    setFlashGoal(null);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };
    const persistMilestone = async (milestoneId: string, category?: string, target?: number) => {
        const localKey = `acknowledged_milestone_${milestoneId}`;
        const dbKey = `milestone:${milestoneId}`;

        // 1. Guard no LocalStorage (Imediato)
        localStorage.setItem(localKey, 'true');

        // 2. Silenciamento em lote: Marcar todas as metas menores da mesma categoria como concluídas
        if (category && target) {
            milestones
                .filter(m => m.category === category && m.target <= target)
                .forEach(m => {
                    localStorage.setItem(`acknowledged_milestone_${m.id}`, 'true');
                });
        }

        // 3. Persistir no Banco de Dados
        if (profile && supabase) {
            try {
                const currentTours = profile.completed_tours || [];

                // Coleta IDs de metas menores para persistir em lote se necessário
                const milestoneToPersist = [dbKey];
                if (category && target) {
                    milestones
                        .filter(m => m.category === category && m.target <= target)
                        .forEach(m => {
                            const key = `milestone:${m.id}`;
                            if (!milestoneToPersist.includes(key)) milestoneToPersist.push(key);
                        });
                }

                const updatedTours = Array.from(new Set([...currentTours, ...milestoneToPersist]));

                await supabase
                    .from('profiles')
                    .update({ completed_tours: updatedTours })
                    .eq('id', profile.id);
            } catch (err) {
                console.error('[SmartGoalCard] Erro ao persistir conquista:', err);
            }
        }
    };

    const handleCloseCelebration = () => {
        if (celebrationMilestone) {
            persistMilestone(celebrationMilestone.id, celebrationMilestone.category, celebrationMilestone.target);
            setCelebrationMilestone(null);
        }
    };

    const handleCloseGift = () => {
        persistMilestone('branding_surprise_v2', 'growth', 0);
        // Force branding unlock in local storage so settings can enable it immediately
        localStorage.setItem('branding_feature_unlocked', 'true');
        setIsGiftOpen(false);
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
        const canViewFinancials = hasPermission('view_financial_goals') || hasPermission('view_financial_dashboard');

        // Prioridade 2: Metas de Produção (Gargalo de Máquina) - LIFETIME POWER
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

        // Prioridade 3: Metas de Venda (Se produção está ok, foca em lucro)
        // SANITIZAÇÃO AGRESSIVA: Filtramos qualquer resquício de dados leaked no cálculo da meta
        const currentSales = (stats?.lifetimeSales || stats?.totalSales || 0);

        if (canViewFinancials) {
            // Se o valor for absurdamente alto e o usuário não tiver pedidos condizentes, 
            // indicamos uma possível inconsistência.
            if (currentSales > 100000 && (stats?.lifetimeOrders || 0) < 10) {
                console.warn("Detectada meta inflada por dados externos. Ajustando visão...");
            }

            // Lógica de Escada Infinita (Infinite Scaling Logic) 2.0
            let nextSalesTarget = 0;
            let stepSize = 0;

            if (currentSales < 50000) {
                // Fase Inicial: Degraus menores para manter motivação
                if (currentSales < 5000) nextSalesTarget = 5000; // 0 -> 5k
                else if (currentSales < 20000) nextSalesTarget = 20000; // 5k -> 20k
                else nextSalesTarget = 50000; // 20k -> 50k
            } else {
                // Fase Empire: Degraus dinâmicos baseados no tamanho do império
                if (currentSales < 250000) stepSize = 50000;    // 50k steps
                else if (currentSales < 1000000) stepSize = 100000; // 100k steps
                else stepSize = 500000; // 500k steps para milionários

                // Arredonda para o próximo degrau
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
                    ? `VOCÊ É UMA MÁQUINA! 🤖💥 Já passamos de R$ ${(currentSales / 1000).toFixed(0)}k acumulados. A próxima barreira de R$ ${(nextSalesTarget / 1000).toFixed(0)}k é logo ali. Mantenha o ritmo! 🔥`
                    : "Seu faturamento tá consistente, mas eu sei que você pode MAIS! 🚀 Pelos meus cálculos, a gente bate essa meta rapidinho. BORA! 💰✨",
                actionPath: '/pedidos',
                actionLabel: 'Vender Mais'
            };
        }

        // Fallback: Se não puder ver vendas, a meta padrão vira CRESCIMENTO (Clientes)
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
                                        {isCompleted && <Sparkles className="w-4 h-4 text-primary fill-primary" />}
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

                                    {/* Botão de Reset Cirúrgico para Metas Bugadas */}
                                    {activeGoal.type === 'sales' && activeGoal.current > 100000 && (stats?.lifetimeOrders || 0) < 10 && (
                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('dashboard-stats-v2');
                                                window.location.reload();
                                            }}
                                            className="ml-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                                            title="Clique para forçar o recálculo se os valores estiverem errados."
                                        >
                                            <X className="w-3 h-3" /> Reset Metas
                                        </button>
                                    )}
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
                                            {(activeGoal.type === 'sales' && activeGoal.current > 100000 && (stats?.lifetimeOrders || 0) < 10)
                                                ? <span className="text-primary font-black">⚠️ ALERTA: Detectei faturamento de outros usuários aqui. Use o botão 'Reset Metas' acima para limpar meu cache e ver apenas sua realidade!</span>
                                                : activeGoal.aiInsight?.split(/(\d+[%]?|R\$ [\d,.]+)/g).map((part, i) =>
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
                                    isCompleted && "bg-primary"
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

            <GiftUnlockModal
                isOpen={isGiftOpen}
                onClose={handleCloseGift}
                userName={stats?.companyName}
            />
        </div>
    );
};
