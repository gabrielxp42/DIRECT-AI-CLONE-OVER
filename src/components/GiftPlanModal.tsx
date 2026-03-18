
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSession } from "@/contexts/SessionProvider";
import { Check, Sparkles, Gift, Crown, Zap, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import confetti from 'canvas-confetti';
import { WhatsAppShowcase } from "./WhatsAppShowcase";
import { useModalQueue } from '@/contexts/ModalQueueContext';

export function GiftPlanModal() {
    const { session, profile } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const [showShowcase, setShowShowcase] = useState(false);
    const navigate = useNavigate();
    const { register, deregister, isAllowed } = useModalQueue();
    const MODAL_ID = 'gift-plan';
    const TRIGGER_PLAN = 'pro';

    useEffect(() => {
        if (session && profile) {
            // Standardizing property names (matching database and local consistency)
            const hasNotViewedPro = profile.subscription_gift_viewed === false;
            const hasNotViewedWhatsApp = (profile as any).is_whatsapp_plus_gifted_viewed === false;

            const localViewedPro = localStorage.getItem('subscription_gift_viewed') === 'true';
            const localViewedWhatsApp = localStorage.getItem('is_whatsapp_plus_gifted_viewed') === 'true';

            const isProGift = profile.subscription_tier === TRIGGER_PLAN && profile.is_gifted_plan === true;
            const isWAGift = !!(profile as any).is_whatsapp_plus_gifted;

            // Trigger if it's a gift (Pro or WhatsApp) and hasn't been viewed yet
            const shouldShowPro = isProGift && hasNotViewedPro && !localViewedPro;
            const shouldShowWA = isWAGift && hasNotViewedWhatsApp && !localViewedWhatsApp;

            if (shouldShowPro || shouldShowWA) {
                console.log("🎯 Triggering Gift Modal!", { pro: shouldShowPro, wa: shouldShowWA });
                register(MODAL_ID, 1);
                setIsOpen(true);
            }
        }
    }, [session, profile]);

    // Logic to determine which content to show based on the specific gift received
    const isWAGiftActive = (profile as any)?.is_whatsapp_plus_gifted === true && (profile as any)?.is_whatsapp_plus_gifted_viewed === false;
    const isProGiftActive = profile?.is_gifted_plan === true && profile?.subscription_gift_viewed === false;

    // Final display logic
    const showWAGift = isWAGiftActive || ((profile as any)?.is_whatsapp_plus_gifted === true && !isProGiftActive);
    const isWAGift = showWAGift; // Keeping ref for existing code

    const handleOpenGift = () => {
        setIsOpened(true);

        if (isWAGift) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#00FF00', '#FFFFFF', '#10b981']
            });
        }

        setTimeout(() => {
            setShowShowcase(true);
        }, 1500);
    };

    const markAsViewed = async (newOpenState?: boolean) => {
        if (newOpenState === true) return;
        setIsOpen(false);
        deregister(MODAL_ID);

        if (!session?.user?.id) return;

        const updates: any = {};
        if (profile?.subscription_gift_viewed === false) {
            updates.subscription_gift_viewed = true;
            localStorage.setItem('subscription_gift_viewed', 'true');
        }
        if ((profile as any)?.is_whatsapp_plus_gifted_viewed === false) {
            updates.is_whatsapp_plus_gifted_viewed = true;
            localStorage.setItem('is_whatsapp_plus_gifted_viewed', 'true');
        }

        if (Object.keys(updates).length === 0) return;

        try {
            await fetch(`${SUPABASE_URL}/rest/v1/profiles_v2?uid=eq.${session.user.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
        } catch (error) {
            console.error("❌ Error marking gift view:", error);
        }
    };

    return (
        <Dialog open={isOpen && isAllowed(MODAL_ID)} onOpenChange={markAsViewed}>
            <DialogContent className="w-[95vw] max-w-[500px] p-0 overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-zinc-950/90 backdrop-blur-3xl">
                {/* Background Decor */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                    <div className={cn(
                        "absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 blur-[100px] rounded-full pointer-events-none mix-blend-screen opacity-30",
                        isWAGift ? "bg-emerald-500" : "bg-primary"
                    )} />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center p-8 pt-12 pb-10">
                    {!isOpened ? (
                        <div className="space-y-8 flex flex-col items-center">
                            <motion.div
                                animate={{
                                    y: [0, -15, 0],
                                    rotate: [0, -3, 3, 0]
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="relative group cursor-pointer"
                                onClick={handleOpenGift}
                            >
                                <div className={cn(
                                    "w-32 h-32 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 transition-transform group-hover:scale-110 duration-500",
                                    isWAGift ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-primary to-primary/80"
                                )}>
                                    <Gift className={cn(
                                        "w-16 h-16 fill-current/10",
                                        isWAGift ? "text-white" : "text-black"
                                    )} />
                                </div>
                                <div className={cn(
                                    "absolute inset-0 -m-6 border-2 rounded-[3.5rem] animate-pulse opacity-20",
                                    isWAGift ? "border-emerald-500" : "border-primary"
                                )} />
                            </motion.div>

                            <div className="space-y-3">
                                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
                                    VOCÊ GANHOU <br />
                                    <span className={isWAGift ? "text-emerald-500" : "text-primary"}>MAIS VELOCIDADE!</span>
                                </h2>
                                <p className="text-zinc-400 font-medium max-w-xs mx-auto text-sm">
                                    {isWAGift
                                        ? "Sua operação acaba de ganhar um motor turbo de automação."
                                        : "Temos algo especial para marcar sua nova jornada."}
                                </p>
                            </div>

                            <Button
                                onClick={handleOpenGift}
                                className={cn(
                                    "w-full max-w-xs h-16 rounded-2xl font-black uppercase tracking-widest group shadow-2xl transition-all active:scale-95",
                                    isWAGift
                                        ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20"
                                        : "bg-primary hover:bg-[#ffe600] text-black shadow-primary/20"
                                )}
                            >
                                LIBERAR AGILIZADOR
                                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full space-y-6">
                            {showShowcase ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-2">
                                        <div className={cn(
                                            "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border shadow-inner",
                                            isWAGift ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-primary/10 border-primary/20 text-primary"
                                        )}>
                                            {isWAGift ? <Zap className="w-8 h-8" /> : <Crown className="w-8 h-8" />}
                                        </div>
                                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                                            {isWAGift ? "VELOCIDADE MÁXIMA ATIVADA!" : "ACESSO ELITE LIBERADO!"}
                                        </h2>
                                        <p className="text-zinc-400 text-xs max-w-sm mx-auto">
                                            {isWAGift
                                                ? "A Gabi agora trabalha por você, agilizando avisos e atendendo clientes."
                                                : "Agora você tem poder ilimitado para dominar o mercado."}
                                        </p>
                                    </div>

                                    {isWAGift ? <WhatsAppShowcase /> : (
                                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 shadow-inner">
                                            {[
                                                "IA Gerativa Ilimitada",
                                                "Gestão de Estoque Completa",
                                                "Prioridade no Suporte"
                                            ].map((feature, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <div className="bg-primary/10 border border-primary/20 p-1.5 rounded-full">
                                                        <Check className="w-3.5 h-3.5 text-primary" />
                                                    </div>
                                                    <span className="text-sm text-gray-300 font-medium">{feature}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        className={cn(
                                            "w-full h-14 font-black uppercase tracking-widest text-sm rounded-xl shadow-2xl transition-all duration-300 border-none",
                                            isWAGift
                                                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/40"
                                                : "bg-[#FFF200] text-black hover:bg-[#ffe600] shadow-primary/40"
                                        )}
                                        onClick={() => {
                                            markAsViewed(false);
                                            navigate(isWAGift ? '/settings#whatsapp-settings-section' : '/settings');
                                        }}
                                    >
                                        {isWAGift ? "ACESSAR GABI AGILIZA" : "RESGATAR AGORA"}
                                    </Button>
                                </motion.div>
                            ) : (
                                <div className="h-64 flex flex-col items-center justify-center space-y-4">
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.4, 1],
                                            opacity: [0.5, 1, 0.5],
                                            rotate: [0, 180, 360]
                                        }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className={isWAGift ? "text-emerald-500" : "text-primary"}
                                    >
                                        <Sparkles className="w-20 h-20 fill-current" />
                                    </motion.div>
                                    <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em] animate-pulse">
                                        Libertando o Poder...
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
