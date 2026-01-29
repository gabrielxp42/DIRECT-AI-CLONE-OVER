import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Users, Printer, DollarSign, ArrowRight, Package, Star, Bot, Sparkles, X, Crown, Medal, TrendingUp, Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AchievementsModal } from './AchievementsModal';
import { useState, useEffect } from 'react';
import { CelebrationModal } from './CelebrationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInSeconds } from 'date-fns';

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
    const [flashGoal, setFlashGoal] = useState<any | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

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

        // Lógica de Level Up
        const lastLvl = Number(localStorage.getItem('gabi_user_level') || '1');
        if (currentLevel > lastLvl) {
            setCelebrationMilestone({
                id: 'levelup_' + currentLevel,
                title: `SUBIU DE NÍVEL!`,
                description: `Você agora é Nível ${currentLevel}. Sua autoridade na gráfica acaba de crescer!`,
                icon: Crown,
                category: 'growth'
            });
            localStorage.setItem('gabi_user_level', currentLevel.toString());
        }

        // Lógica de Meta Relâmpago (Flash Goals)
        const checkFlashGoal = () => {
            const saved = localStorage.getItem('gabi_flash_goal');
            if (saved) {
                const parsed = JSON.parse(saved);
                const expiry = new Date(parsed.expiresAt);
                if (expiry > new Date()) {
                    // Meta ainda válida. Verificar progresso.
                    const startValue = parsed.startValue;
                    const targetIncrease = parsed.targetIncrease;
                    const currentValue = stats.totalMeters || 0;
                    const earned = currentValue - startValue;

                    if (earned >= targetIncrease && !parsed.completed) {
                        parsed.completed = true;
                        localStorage.setItem('gabi_flash_goal', JSON.stringify(parsed));
                        setCelebrationMilestone({
                            id: 'flash_' + parsed.id,
                            title: 'Desafio Relâmpago!',
                            description: `Você bateu a meta de +${targetIncrease}m em tempo recorde!`,
                            icon: Zap,
                            category: 'production'
                        });
                    }
                    setFlashGoal(parsed);
                    return;
                } else {
                    localStorage.removeItem('gabi_flash_goal');
                    setFlashGoal(null);
                }
            }

            // Chance de 20% de gerar nova se não houver ativos (e usuário tiver alguma produção)
            if (!saved && (stats.totalMeters || 0) > 10 && Math.random() < 0.2) {
                const durationHours = 24;
                const newGoal = {
                    id: Date.now().toString(),
                    title: "Bora Turbinar a Produção? 🚀🔥",
                    description: `Imprima mais 5m nas próximas 24h e mostre que você não tá pra brincadeira! ⚡`,
                    startValue: stats.totalMeters || 0,
                    targetIncrease: 5,
                    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
                    completed: false
                };
                localStorage.setItem('gabi_flash_goal', JSON.stringify(newGoal));
                setFlashGoal(newGoal);
            }
        };

        checkFlashGoal();
    }, [stats]);

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

    // Lógica de Níveis (RPG Style)
    const totalAchievements = milestones.filter(m => m.value >= m.target).length;
    const currentLevel = Math.floor(totalAchievements / 2) + 1;
    const xpInLevel = totalAchievements % 2;
    const xpNeededForNextLevel = 2; // A cada 2 conquistas sobe um nível
    const levelProgress = (xpInLevel / xpNeededForNextLevel) * 100;

    // Lógica Inteligente de Seleção de Meta
    const activeGoal: Goal = useMemo(() => {
        // Prioridade 1: Onboarding (Criação de Perfil e primeiro pedido)
        if (!stats?.hasCompanyProfile) {
            return {
                id: 'onboarding_profile',
                type: 'growth',
                title: "Configuração Inicial 🛠️",
                description: "Complete seu perfil empresarial para desbloquear o poder total da Gabi.",
                target: 1,
                current: 0,
                unit: '',
                icon: Bot,
                color: 'text-zinc-400',
                aiInsight: "Sua marca é seu maior patrimônio! 🔥 Vamos configurar esse perfil pra deixar seus clientes de queixo caído? BORA! 🚀",
                actionPath: '/perfil',
                actionLabel: 'Configurar Agora'
            };
        }

        // Prioridade 2: Metas de Produção (Gargalo de Máquina)
        const totalMeters = stats?.totalMeters || 0;
        if (totalMeters < 100) {
            return {
                id: 'prod_100',
                type: 'production',
                title: "Aquecendo a Máquina 🏎️",
                description: "Alcance os primeiros 100 metros totais de produção.",
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
        const currentSales = stats?.totalSales || 0;

        // Lógica de Escada Inteligente: Baseada no Ticket Médio Real do Usuário
        const avgTicket = stats?.averageTicket || 500;

        // O "degrau" é sempre equivalente a ~5 pedidos médios do cliente.
        // Isso garante que a meta seja desafiadora mas tangível para o tamanho dele.
        const dynamicStep = Math.max(1000, Math.ceil((avgTicket * 5) / 500) * 500);
        const nextSalesTarget = Math.ceil((currentSales + 1) / dynamicStep) * dynamicStep;

        // Prioridade 4: Metas de Clientes (Base)
        const customers = stats?.customersCount || 0;
        if (customers < 10 || (customers < 25 && totalMeters > 500)) {
            return {
                id: 'growth_clients',
                type: 'growth',
                title: "Expansão de Carteira 🤝",
                description: `Sua base de clientes precisa crescer. Atinja ${customers < 10 ? 10 : 25} clientes cadastrados.`,
                target: customers < 10 ? 10 : 25,
                current: customers,
                unit: 'clis',
                icon: Users,
                color: 'text-purple-500',
                aiInsight: "Produção tá top, mas cadê os clientes novos? 🤔 Diversifica essa base pra gente dominar o bairro todo! Vamo faturar com força! 🤝💰",
                actionPath: '/clientes',
                actionLabel: 'Cadastrar Cliente'
            };
        }

        return {
            id: 'revenue_booster',
            type: 'sales',
            title: "Tubarão do Mercado 🦈",
            description: `Próximo marco de faturamento: R$ ${nextSalesTarget.toLocaleString('pt-BR')}.`,
            target: nextSalesTarget,
            current: currentSales,
            unit: 'R$',
            icon: DollarSign,
            color: 'text-green-500',
            aiInsight: currentSales > 20000
                ? "Nível Profissional detectado! 🦅 Agora o jogo é escala pura. Bater recorde de faturamento é sua nova rotina. VAI PRA CIMA! 🦈🔥"
                : "Seu faturamento tá consistente, mas eu sei que você pode MAIS! 🚀 Pelos meus cálculos, a gente bate essa meta rapidinho. BORA! 💰✨",
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

                {/* Level Up Progress Bar (New!) */}
                <div className="h-1.5 w-full bg-zinc-100 dark:bg-white/5 relative overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${levelProgress}%` }}
                        className="h-full bg-gradient-to-r from-primary via-yellow-400 to-primary shadow-[0_0_15px_rgba(255,242,0,0.5)]"
                    />
                </div>

                <div className="p-4 md:p-5 flex flex-col justify-between gap-5 relative text-left">
                    <div className="flex flex-col gap-4 flex-1">
                        <div className="flex items-start gap-4">
                            <div className="relative">
                                <div className={cn(
                                    "p-3 rounded-xl border shadow-inner flex-shrink-0",
                                    activeGoal.type === 'production' && "bg-blue-500/10 border-blue-500/20 text-blue-500",
                                    activeGoal.type === 'growth' && "bg-purple-500/10 border-purple-500/20 text-purple-500",
                                    activeGoal.type === 'sales' && "bg-green-500/10 border-green-500/20 text-green-500",
                                )}>
                                    {isCompleted ? <Trophy className="w-6 h-6 animate-bounce" /> : <activeGoal.icon className="w-6 h-6" />}
                                </div>
                                {/* Level Badge */}
                                <div className="absolute -bottom-2 -right-2 bg-zinc-900 border border-white/10 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                                    {currentLevel}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base md:text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                        <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Meta:</span>
                                        {isCompleted ? "Conquistada!" : activeGoal.title}
                                        {isCompleted && <Sparkles className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                    </h3>
                                    <div className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                        LVL {currentLevel}
                                    </div>
                                    <button
                                        onClick={() => setIsAchievementsOpen(true)}
                                        className="text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-primary transition-colors flex items-center gap-1.5 ml-auto group/trophy"
                                    >
                                        <Trophy className="w-3 h-3 text-primary group-hover/trophy:scale-125 transition-transform" /> Ver Conquistas
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
                        {/* Flash Challenge Widget (Pulsing Neon!) */}
                        {flashGoal && !flashGoal.completed && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-4 relative group/flash overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-yellow-500/20 to-orange-500/20 animate-pulse" />
                                <div className="relative border border-orange-500/30 bg-orange-500/10 backdrop-blur-md rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-orange-500 rounded-lg shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                                            <Zap className="w-4 h-4 text-white fill-white animate-pulse" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1">
                                                Desafio Relâmpago
                                                <span className="flex h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping" />
                                            </div>
                                            <div className="text-xs font-black text-zinc-900 dark:text-white line-clamp-1">{flashGoal.title}</div>
                                            <div className="text-[10px] font-medium text-orange-600 dark:text-orange-400 leading-tight mb-1">{flashGoal.description}</div>
                                            <div className="text-[9px] font-bold text-zinc-500 flex items-center gap-1 bg-white/5 w-fit px-1.5 py-0.5 rounded">
                                                <Clock className="w-2.5 h-2.5" /> Expira em: {formatTime(timeLeft)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                                            {Math.max(0, (stats?.totalMeters || 0) - flashGoal.startValue).toFixed(1)} / {flashGoal.targetIncrease}m
                                        </div>
                                        <div className="h-1 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden">
                                            <motion.div
                                                className="h-full bg-orange-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, (((stats?.totalMeters || 0) - flashGoal.startValue) / flashGoal.targetIncrease) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

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
