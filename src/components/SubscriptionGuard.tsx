
import React, { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Lock, Sparkles, CheckCircle, Crown, Printer, TrendingUp, Bot } from 'lucide-react';
import { SubscriptionModal } from './SubscriptionModal';

interface SubscriptionGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requireWrite?: boolean;
}

export const SubscriptionGuard = ({ children, fallback, requireWrite = true }: SubscriptionGuardProps) => {
    const { isExpired, canWriteData } = useSubscription();
    const [showModal, setShowModal] = useState(false);

    if (canWriteData) {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center w-full min-h-[50vh] p-4 animate-in fade-in zoom-in-95 duration-500">
            <Card className="w-full max-w-lg border-primary/20 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden relative group">

                {/* Animated Background Elements */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent animate-spin-slow pointer-events-none" />

                <div className="relative">
                    <div className="h-2 bg-gradient-to-r from-primary/60 via-primary to-primary/60 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />

                    <CardHeader className="text-center pb-2 pt-8">
                        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 border border-primary/20 shadow-[0_0_30px_var(--primary-custom)]/10 group-hover:shadow-[0_0_50px_var(--primary-custom)]/20 transition-all duration-500">
                            <Lock className="w-10 h-10 text-primary" />
                        </div>
                        <CardTitle className="text-3xl font-bold text-white tracking-tight">
                            Acesso Expirado
                        </CardTitle>
                        <CardDescription className="text-zinc-400 text-lg mt-2">
                            Não perca o controle da sua produção agora.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-4 px-8">
                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 space-y-4">
                            <div className="flex items-start gap-4">
                                <Bot className="w-6 h-6 text-primary mt-0.5 shrink-0 animate-pulse" />
                                <div>
                                    <h4 className="font-semibold text-white text-base flex items-center gap-2">
                                        Super Gerente IA
                                        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 rounded uppercase">Exclusive</span>
                                    </h4>
                                    <p className="text-sm text-zinc-400">"Quanto lucrei essa semana?" - Respostas por áudio e texto em tempo real.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Printer className="w-6 h-6 text-primary mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-white text-base">Especialista em DTF</h4>
                                    <p className="text-sm text-zinc-400">Controle exato de rolos, metros e custos de produção.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="pb-8 px-8 flex flex-col gap-4">
                        <Button
                            className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:brightness-110 shadow-[0_0_20px_var(--primary-custom)]/30 transition-all hover:scale-[1.02]"
                            onClick={() => setShowModal(true)}
                        >
                            <Crown className="w-5 h-5 mr-2" />
                            Retomar Controle Total
                        </Button>
                        <p className="text-xs text-zinc-500">
                            Ou continue visualizando (apenas leitura).
                        </p>
                    </CardFooter>
                </div>
            </Card>

            {fallback && (
                <div className="mt-8 w-full opacity-50 hover:opacity-100 transition-opacity blur-[1px] hover:blur-none pointer-events-none select-none">
                    {fallback}
                </div>
            )}
            <SubscriptionModal open={showModal} onOpenChange={setShowModal} />
        </div>
    );
};
