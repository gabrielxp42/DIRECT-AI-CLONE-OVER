
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSession } from "@/contexts/SessionProvider";
import { Sparkles, Gift, Zap, ChevronRight, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import confetti from 'canvas-confetti';
import { VetorizaShowcase } from "./VetorizaShowcase";
import { useModalQueue } from '@/contexts/ModalQueueContext';

export function GiftVetorizaModal() {
    const { session, profile } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isOpened, setIsOpened] = useState(false);
    const [showShowcase, setShowShowcase] = useState(false);
    const navigate = useNavigate();
    const { register, deregister, isAllowed } = useModalQueue();
    const MODAL_ID = 'gift-vetoriza';

    useEffect(() => {
        if (session && profile) {
            const isGifted = (profile as any).is_vetoriza_ai_gifted === true;
            const hasNotViewed = (profile as any).is_vetoriza_ai_gifted_viewed === false;
            const localViewed = localStorage.getItem('is_vetoriza_ai_gifted_viewed') === 'true';

            if (isGifted && hasNotViewed && !localViewed) {
                console.log("🎁 Triggering Vetoriza AI Gift Modal!");
                register(MODAL_ID, 2);
                setIsOpen(true);
            }
        }
    }, [session, profile]);

    const handleOpenGift = () => {
        setIsOpened(true);

        confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#fbbf24', '#f59e0b', '#FFFFFF', '#000000']
        });

        setTimeout(() => {
            setShowShowcase(true);
        }, 1200);
    };

    const markAsViewed = async (newOpenState?: boolean) => {
        // Only allow closing if it was already "opened" (present resgatado)
        // or if explicitly allowed. User said "obrigatorio a abrir o presente"
        if (!isOpened && newOpenState === false) return;

        if (newOpenState === true) return;
        setIsOpen(false);
        deregister(MODAL_ID);

        if (!session?.user?.id) return;

        try {
            await fetch(`${SUPABASE_URL}/rest/v1/profiles_v2?uid=eq.${session.user.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_vetoriza_ai_gifted_viewed: true })
            });
            localStorage.setItem('is_vetoriza_ai_gifted_viewed', 'true');
        } catch (error) {
            console.error("❌ Error marking gift view:", error);
        }
    };

    return (
        <Dialog open={isOpen && isAllowed(MODAL_ID)} onOpenChange={markAsViewed}>
            <DialogContent className="gift-modal-box w-[95vw] max-w-[550px] p-0 overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.9)] bg-zinc-950/80 backdrop-blur-3xl">
                <div className="sr-only">
                    <DialogHeader>
                        <DialogTitle>Vetoriza AI - Presente Recebido</DialogTitle>
                        <DialogDescription>
                            Você recebeu 150 créditos de IA do administrador como presente exclusivo.
                        </DialogDescription>
                    </DialogHeader>
                </div>
                {/* Responsive scaling for smaller viewports */}
                <style>{`
                    .gift-modal-box {
                        transform-origin: center center;
                    }
                    @media (max-height: 820px) {
                        .gift-modal-box { transform: translate(-50%, -50%) scale(0.9) !important; }
                    }
                    @media (max-height: 720px) {
                        .gift-modal-box { transform: translate(-50%, -50%) scale(0.8) !important; }
                    }
                    @media (max-height: 620px) {
                        .gift-modal-box { transform: translate(-50%, -50%) scale(0.7) !important; }
                    }
                    @media (max-height: 520px) {
                        .gift-modal-box { transform: translate(-50%, -50%) scale(0.6) !important; }
                    }
                `}</style>
                {/* Premium Background Decor */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-20 w-96 h-96 bg-amber-500/20 blur-[120px] rounded-full mix-blend-screen animate-pulse" />
                    <div className="absolute -bottom-40 -right-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center p-3 pt-4 pb-3 sm:p-5 sm:pt-8 sm:pb-6">
                    {!isOpened ? (
                        <div className="space-y-4 sm:space-y-6 flex flex-col items-center">
                            <motion.div
                                animate={{
                                    y: [0, -10, 0],
                                    rotate: [0, -5, 5, 0],
                                    scale: [1, 1.05, 1]
                                }}
                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                className="relative group cursor-pointer"
                                onClick={handleOpenGift}
                            >
                                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 rounded-[1.5rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_50px_rgba(245,158,11,0.4)] relative z-10 transition-all group-hover:scale-110 group-hover:rotate-3 duration-500 border-t-4 border-white/30">
                                    <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-black fill-current/10" />
                                </div>
                                <div className="absolute inset-0 -m-4 sm:-m-6 border-2 border-amber-500/30 rounded-[2.5rem] sm:rounded-[3.5rem] animate-ping opacity-20" />
                                <div className="absolute inset-0 -m-2 sm:-m-3 border-2 border-primary/20 rounded-[2rem] sm:rounded-[3rem] animate-pulse" />
                            </motion.div>

                            <div className="space-y-2 sm:space-y-3">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest"
                                >
                                    <Sparkles className="w-3 h-3 fill-current" />
                                    PRESENTE EXCLUSIVO
                                </motion.div>
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
                                    VOCÊ FOI <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-500 to-amber-200">SELECIONADO!</span>
                                </h2>
                                <p className="text-zinc-400 font-medium max-w-sm mx-auto text-[11px] sm:text-sm leading-relaxed">
                                    O administrador enviou um pacote de elite para sua conta. Abra agora para descobrir.
                                </p>
                            </div>

                            <Button
                                onClick={handleOpenGift}
                                className="w-full max-w-xs h-12 sm:h-14 rounded-[1.2rem] sm:rounded-[1.5rem] bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-black font-black uppercase tracking-[0.15em] text-sm sm:text-base shadow-[0_15px_30px_rgba(245,158,11,0.3)] group transition-all active:scale-95 border-b-4 border-amber-800"
                            >
                                ABRIR PRESENTE
                                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform" />
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full space-y-3 sm:space-y-4">
                            <AnimatePresence mode="wait">
                                {!showShowcase ? (
                                    <motion.div
                                        key="loader"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 1.2 }}
                                        className="h-40 sm:h-52 flex flex-col items-center justify-center space-y-3 sm:space-y-4"
                                    >
                                        <motion.div
                                            animate={{
                                                rotate: 360,
                                                scale: [1, 1.5, 1],
                                            }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="text-amber-500"
                                        >
                                            <Zap className="w-14 h-14 sm:w-20 sm:h-20 fill-current shadow-[0_0_50px_rgba(245,158,11,0.5)]" />
                                        </motion.div>
                                        <p className="text-zinc-500 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] animate-pulse">
                                            DESBLOQUEANDO PODER...
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="content"
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-3 sm:space-y-4"
                                    >
                                        <div className="space-y-1 sm:space-y-2">
                                            <div className="mx-auto w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-1 shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]">
                                                <Star className="w-5 h-5 sm:w-7 sm:h-7 fill-current" />
                                            </div>
                                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                                                VETORIZA AI{" "}
                                                <span className="text-amber-500">LIBERADO!</span>
                                            </h2>
                                            <p className="text-zinc-400 text-[10px] sm:text-xs font-medium">
                                                Você ganhou <strong>150 créditos</strong> e acesso à ferramenta mais poderosa do Brasil.
                                            </p>
                                        </div>

                                        <VetorizaShowcase />

                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 p-2 sm:p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                                <p className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500">Créditos</p>
                                                <p className="text-base sm:text-lg font-black text-white italic flex items-center justify-center gap-1">
                                                    <Zap size={12} className="text-amber-500" /> +150
                                                </p>
                                            </div>
                                            <div className="flex-1 p-2 sm:p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                                <p className="text-[8px] sm:text-[9px] font-black uppercase text-zinc-500">Status</p>
                                                <p className="text-base sm:text-lg font-black text-white italic flex items-center justify-center gap-1">
                                                    <Star size={12} className="text-emerald-500" /> PREMIUM
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-10 sm:h-12 bg-white text-black hover:bg-zinc-200 font-black uppercase tracking-wider text-xs sm:text-sm rounded-xl shadow-2xl transition-all duration-300"
                                            onClick={() => {
                                                markAsViewed(false);
                                                setTimeout(() => {
                                                    window.dispatchEvent(new CustomEvent('open-vetorizador'));
                                                }, 300);
                                            }}
                                        >
                                            COMEÇAR A USAR AGORA
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
