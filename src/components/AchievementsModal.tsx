import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Trophy, Star, Target, Zap, TrendingUp, Users, Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: any;
    unlocked: boolean;
    category: 'production' | 'growth' | 'sales';
}

interface AchievementsModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: any;
}

export const AchievementsModal = ({ isOpen, onClose, stats }: AchievementsModalProps) => {
    const milestones: Achievement[] = [
        // Produção
        { id: 'p1', category: 'production', title: 'Start na Máquina', description: 'Imprimiu os primeiros 100m.', icon: Zap, unlocked: (stats?.totalMeters || 0) >= 100 },
        { id: 'p2', category: 'production', title: 'Ritmo Industrial', description: 'Atingiu a marca de 500m impressos.', icon: Target, unlocked: (stats?.totalMeters || 0) >= 500 },
        { id: 'p3', category: 'production', title: 'Lenda da Produção', description: 'Bateu 1km (1000m) de material rodado.', icon: Crown, unlocked: (stats?.totalMeters || 0) >= 1000 },

        // Crescimento
        { id: 'g1', category: 'growth', title: 'Primeiros Contatos', description: 'Cadastrou 10 clientes ativos.', icon: Users, unlocked: (stats?.customersCount || 0) >= 10 },
        { id: 'g2', category: 'growth', title: 'Dominando o Bairro', description: 'Chegou a 50 clientes na carteira.', icon: Medal, unlocked: (stats?.customersCount || 0) >= 50 },
        { id: 'g3', category: 'growth', title: 'Pai de Todos', description: 'Exército de 200+ clientes cadastrados.', icon: Star, unlocked: (stats?.customersCount || 0) >= 200 },

        // Vendas
        { id: 's1', category: 'sales', title: 'Primeiro Buffet', description: 'Faturou R$ 5.000 em vendas.', icon: TrendingUp, unlocked: (stats?.totalSales || 0) >= 5000 },
        { id: 's2', category: 'sales', title: 'Gráfica de Respeito', description: 'Ultrapassou R$ 20.000 em faturamento.', icon: Trophy, unlocked: (stats?.totalSales || 0) >= 20000 },
        { id: 's3', category: 'sales', title: 'Tubarão do Mercado', description: 'Marca histórica de R$ 50.000+.', icon: Crown, unlocked: (stats?.totalSales || 0) >= 50000 },
    ];

    const unlockedCount = milestones.filter(m => m.unlocked).length;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] md:max-w-2xl bg-zinc-950/90 backdrop-blur-2xl border-white/10 text-white overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] p-4 md:p-6">
                {/* Glow Background */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                <DialogHeader className="relative z-10 text-left">
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-primary/20 border border-primary/20 text-primary shadow-[0_0_20px_rgba(255,242,0,0.1)]">
                                <Trophy className="w-6 h-6 md:w-8 md:h-8 fill-primary/20" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg md:text-2xl font-black uppercase italic tracking-tighter">Sala de Troféus</DialogTitle>
                                <p className="text-zinc-500 text-[10px] md:text-sm font-medium italic">
                                    Conquistas desbloqueadas: <span className="text-primary font-black">{unlockedCount} / {milestones.length}</span>
                                </p>
                            </div>
                        </div>
                        {/* Global Rank Badge */}
                        <div className="flex flex-col items-end">
                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Seu Rank</div>
                            <div className="text-sm md:text-lg font-black text-white italic uppercase tracking-tighter bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent transform -skew-x-12">
                                {unlockedCount <= 3 ? "Iniciante" : unlockedCount <= 6 ? "Profissional" : "Lenda Viva"}
                            </div>
                        </div>
                    </div>

                    {/* Category Progression Bars */}
                    <div className="grid grid-cols-3 gap-2 mt-4 bg-white/5 p-2 rounded-xl border border-white/10">
                        {['production', 'growth', 'sales'].map((cat) => {
                            const catTotal = milestones.filter(m => m.category === cat).length;
                            const catUnlocked = milestones.filter(m => m.category === cat && m.unlocked).length;
                            const perc = (catUnlocked / catTotal) * 100;
                            const labels = { production: 'Produção', growth: 'Base', sales: 'Vendas' };
                            return (
                                <div key={cat} className="space-y-1">
                                    <div className="flex justify-between text-[8px] font-black uppercase tracking-tighter text-zinc-400">
                                        <span>{labels[cat as keyof typeof labels]}</span>
                                        <span>{catUnlocked}/{catTotal}</span>
                                    </div>
                                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                cat === 'production' && "bg-blue-500",
                                                cat === 'growth' && "bg-purple-500",
                                                cat === 'sales' && "bg-green-500"
                                            )}
                                            style={{ width: `${perc}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 mt-4 md:mt-6 relative z-10 overflow-y-auto max-h-[70vh] md:max-h-[60vh] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {milestones.map((m) => (
                        <div
                            key={m.id}
                            className={cn(
                                "p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-500 relative group overflow-hidden flex flex-col items-center text-center md:items-start md:text-left",
                                m.unlocked
                                    ? "bg-white/[0.03] border-white/10 shadow-lg hover:border-primary/40 hover:bg-white/[0.05]"
                                    : "bg-black/40 border-white/5 opacity-40 grayscale"
                            )}
                        >
                            {/* Rare Glow */}
                            {m.unlocked && m.id.includes('3') && (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />
                            )}

                            <div className={cn(
                                "w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center mb-2 md:mb-3 border shadow-inner",
                                m.unlocked
                                    ? "bg-primary/20 border-primary/20 text-primary"
                                    : "bg-zinc-800 border-white/5 text-zinc-600"
                            )}>
                                <m.icon className={cn("w-4 h-4 md:w-5 md:h-5", m.unlocked && m.id.includes('3') && "animate-pulse")} />
                            </div>

                            <h4 className={cn(
                                "text-[10px] md:text-xs font-black uppercase tracking-tight mb-1",
                                m.unlocked ? "text-white" : "text-zinc-500"
                            )}>
                                {m.title}
                            </h4>
                            <p className="hidden md:block text-[10px] text-zinc-500 leading-tight font-medium">
                                {m.description}
                            </p>

                            {m.unlocked && (
                                <div className="absolute top-2 right-2">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col items-center gap-4 relative z-10 text-center">
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-2xl bg-primary text-black font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(255,242,0,0.3)] hover:shadow-[0_0_40px_rgba(255,242,0,0.4)] transition-all active:scale-95"
                    >
                        Continuar Vencendo 🚀
                    </button>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] italic">
                        Sistema AI de Reconhecimento de Elite
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
