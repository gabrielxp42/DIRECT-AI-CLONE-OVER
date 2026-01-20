
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
    // DISABLED: Usuário solicitou remover a barra de trial ("leave aside for now")
    return null;

    /* 
    return (
        <>
            <div className="relative z-50 bg-[#0a0a0a] border-b border-[#FFF200]/20 text-white shadow-xl animate-in slide-in-from-top-4 duration-700">
                ... (código original comentado para referência futura) ...
            </div>
            <SubscriptionModal open={showModal} onOpenChange={setShowModal} />
        </>
    ); 
    */
};
