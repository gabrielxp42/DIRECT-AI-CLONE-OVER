import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ArrowRight, Home, Users, Package, Settings, Sparkles, Terminal, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: any;
    path: string;
    completed: boolean;
}

export const MagicOnboarding = ({ stats }: { stats: any }) => {
    const navigate = useNavigate();
    const { session } = useSession();
    const [isVisible, setIsVisible] = useState(true);

    const steps: OnboardingStep[] = [
        {
            id: 'profile',
            title: 'Perfil da Empresa',
            description: 'Configure seu logo e dados de contato para os orçamentos.',
            icon: Settings,
            path: '/profile',
            completed: !!stats?.hasCompanyProfile
        },
        {
            id: 'products',
            title: 'Primeiro Produto',
            description: 'Cadastre um produto ou serviço para começar a vender.',
            icon: Package,
            path: '/produtos',
            completed: (stats?.productsCount || 0) > 0
        },
        {
            id: 'clients',
            title: 'Cadastrar Cliente',
            description: 'Adicione seu primeiro cliente à base de dados.',
            icon: Users,
            path: '/clientes',
            completed: (stats?.customersCount || 0) > 0
        },
        {
            id: 'order',
            title: 'Criar Pedido',
            description: 'Gere seu primeiro orçamento ou ordem de serviço.',
            icon: Home,
            path: '/pedidos',
            completed: (stats?.totalOrders || 0) > 0
        }
    ];

    const completedCount = steps.filter(s => s.completed).length;
    const progress = (completedCount / steps.length) * 100;

    const nextStep = steps.find(s => !s.completed);

    if (completedCount === steps.length && !isVisible) return null;

    return (
        <div className="mb-6 relative group">
            <Card className="border-white/5 bg-zinc-950/80 backdrop-blur-xl shadow-xl overflow-hidden transition-all duration-300">
                <div
                    className="p-3 md:px-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setIsVisible(!isVisible)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-md border border-primary/20">
                            <Terminal className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                                    Missão Start-up
                                </h3>
                                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                                    {Math.round(progress)}%
                                </span>
                            </div>
                            {(!isVisible && nextStep) && (
                                <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                                    <span className="text-zinc-500">Próximo:</span> {nextStep.title} <ArrowRight className="w-2.5 h-2.5" />
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-20 md:w-32 hidden sm:block">
                            <Progress value={progress} className="h-1 bg-white/5" />
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-white/10">
                            {isVisible ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>

                {isVisible && (
                    <div className="px-3 pb-3 md:px-4 md:pb-4 border-t border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                            {steps.map((step) => (
                                <div
                                    key={step.id}
                                    onClick={() => navigate(step.path)}
                                    className={cn(
                                        "relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer flex items-center gap-3 group/item",
                                        step.completed
                                            ? "bg-green-500/[0.03] border-green-500/10 opacity-70"
                                            : "bg-white/[0.02] border-white/5 hover:border-primary/30 hover:bg-white/[0.04]"
                                    )}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-md flex-shrink-0 transition-colors",
                                        step.completed ? "bg-green-500/10 text-green-500" : "bg-white/5 text-zinc-500 group-hover/item:text-primary"
                                    )}>
                                        <step.icon className="w-3.5 h-3.5" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-tight truncate pr-2",
                                                step.completed ? "text-zinc-500 line-through" : "text-zinc-200 group-hover/item:text-primary"
                                            )}>
                                                {step.title}
                                            </span>
                                            {step.completed && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                                        </div>
                                        <p className="text-[9px] text-zinc-600 truncate group-hover/item:text-zinc-500">
                                            {step.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {completedCount === steps.length && (
                            <div className="mt-3 bg-green-500/5 border border-green-500/10 rounded-lg p-2.5 flex items-center justify-between">
                                <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Setup Completo
                                </p>
                                <button
                                    onClick={() => setIsVisible(false)}
                                    className="text-[9px] text-zinc-500 hover:text-zinc-300 underline decoration-zinc-700 underline-offset-2"
                                >
                                    Dispensar este card
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};
