
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Crown, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { SubscriptionModal } from './SubscriptionModal';

export const TrialBanner = () => {
    const { isTrial, daysRemaining, isExpired, isActive } = useSubscription();
    const [showModal, setShowModal] = useState(false);

    if (isActive) return null;

    // Expired State (Critical Red/Dark Theme)
    if (isExpired) {
        return (
            <>
                <div className="relative z-50 overflow-hidden bg-red-950/90 backdrop-blur-md border-b border-red-500/30 text-white shadow-lg animate-in slide-in-from-top-full duration-500">
                    <div className="absolute inset-0 bg-red-600/10 animate-pulse"></div>
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                            </div>
                            <div>
                                <p className="font-bold text-sm md:text-base leading-tight">Período de teste finalizado</p>
                                <p className="text-xs text-red-200">Seu acesso está restrito ao modo leitura.</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="relative z-10 bg-white text-red-900 hover:bg-red-50 font-bold border-none shadow-md transition-transform hover:scale-105"
                            onClick={() => setShowModal(true)}
                        >
                            Reativar Acesso
                        </Button>
                    </div>
                </div>
                <SubscriptionModal open={showModal} onOpenChange={setShowModal} />
            </>
        );
    }

    // Active Trial State (Premium Yellow/Dark Theme)
    return (
        <>
            <div className="relative z-50 bg-[#0a0a0a] border-b border-[#FFF200]/20 text-white shadow-xl animate-in slide-in-from-top-4 duration-700">
                {/* Subtle animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF200]/5 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>

                <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        <div className={`
              w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300
              ${daysRemaining <= 3 ? 'bg-orange-500/20 border-orange-500/50' : 'bg-[#FFF200]/10 border-[#FFF200]/30'}
            `}>
                            {daysRemaining <= 3 ? <Clock className="w-4 h-4 text-orange-400" /> : <Sparkles className="w-4 h-4 text-[#FFF200]" />}
                        </div>

                        <div className="flex flex-col">
                            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Status do Plano</span>
                            <span className="text-sm font-semibold flex items-center gap-1.5">
                                Teste Gratuito
                                <span className="w-1 h-1 rounded-full bg-zinc-600"></span>
                                <span className={`${daysRemaining <= 3 ? 'text-orange-400' : 'text-[#FFF200]'}`}>
                                    {daysRemaining} dias restantes
                                </span>
                            </span>
                        </div>
                    </div>

                    <Button
                        size="sm"
                        className="bg-[#FFF200] text-black hover:bg-[#E6D900] border-none font-bold shadow-[0_0_15px_rgba(255,242,0,0.15)] transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(255,242,0,0.4)] flex items-center gap-2 group"
                        onClick={() => setShowModal(true)}
                    >
                        <Crown className="w-4 h-4 transition-transform group-hover:rotate-12" />
                        <span className="hidden md:inline">Virar Pro</span>
                        <span className="md:hidden">Assinar</span>
                    </Button>
                </div>
            </div>
            <SubscriptionModal open={showModal} onOpenChange={setShowModal} />
        </>
    );
};
