
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSession } from "@/contexts/SessionProvider";
import { Check, Sparkles, Gift, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

export function GiftPlanModal() {
    const { session, profile } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const TRIGGER_PLAN = 'pro';

    useEffect(() => {
        console.log("🎁 Checking Gift Modal conditions:", {
            hasSession: !!session,
            hasProfile: !!profile,
            giftViewed: profile?.subscription_gift_viewed,
            tier: profile?.subscription_tier,
            status: profile?.subscription_status,
            isGifted: profile?.is_gifted_plan
        });

        if (session && profile) {
            const hasNotViewed = profile.subscription_gift_viewed === false;
            // Safer check: either pro tier or active status
            const isPro = profile.subscription_tier === TRIGGER_PLAN || profile.subscription_status === 'active';

            if (isPro && hasNotViewed) {
                console.log("🎯 Triggering Gift/Welcome Modal!");
                setIsOpen(true);
            }
        }
    }, [session, profile]);

    const isGifted = profile?.is_gifted_plan === true;

    const markAsViewed = async () => {
        setIsOpen(false);
        if (!session?.user?.id) return;

        try {
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ subscription_gift_viewed: true })
            });
        } catch (error) {
            console.error("Error marking view:", error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={markAsViewed}>
            <DialogContent className="w-[95vw] max-w-[450px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255,242,0,0.15)] bg-black/40 backdrop-blur-3xl">
                {/* Liquid Glass Background Layers */}
                <div className="absolute inset-0 z-0">
                    {/* Gradient Orb Top */}
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#FFF200]/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
                    {/* Gradient Orb Bottom */}
                    <div className="absolute -bottom-20 right-0 w-60 h-60 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none mix-blend-screen" />

                    {/* Noise Texture (Optional Sim) */}
                    <div className="absolute inset-0 bg-white/5 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center p-8 pt-12 pb-8">

                    {/* Icon Container with Glass Effect */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-24 h-24 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 shadow-[0_8px_32px_0_rgba(255,242,0,0.2)] backdrop-blur-md flex items-center justify-center mb-6 relative group"
                    >
                        {/* Core Icon Glow */}
                        <div className="absolute inset-0 bg-[#FFF200] opacity-20 blur-xl rounded-full group-hover:opacity-40 transition-opacity duration-500" />

                        {isGifted ? (
                            <Gift className="w-12 h-12 text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" strokeWidth={1.5} />
                        ) : (
                            <Crown className="w-12 h-12 text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" strokeWidth={1.5} />
                        )}
                    </motion.div>

                    {/* Headline */}
                    <motion.h2
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-white drop-shadow-lg"
                    >
                        {isGifted ? "Parabéns!" : "Você é Elite!"}
                    </motion.h2>

                    {/* Description */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-white/80 text-sm font-medium leading-relaxed max-w-[280px] mb-8"
                    >
                        {isGifted ? (
                            <p>Um administrador concedeu a você acesso <span className="text-[#FFF200] font-bold drop-shadow-sm">VITALÍCIO</span> ao plano Profissional.</p>
                        ) : (
                            <p>Sua assinatura foi confirmada! Agora você tem <span className="text-[#FFF200] font-bold drop-shadow-sm">PODER ILIMITADO</span> para criar e gerenciar.</p>
                        )}
                    </motion.div>

                    {/* Feature Card - Glassmorphism */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 mb-8 shadow-inner backdrop-blur-sm"
                    >
                        <div className="flex items-center gap-3 group">
                            <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full group-hover:bg-[#FFF200]/20 transition-colors"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                            <span className="text-sm text-gray-200">IA Gerativa Ilimitada</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full group-hover:bg-[#FFF200]/20 transition-colors"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                            <span className="text-sm text-gray-200">Gestão de Estoque Completa</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full group-hover:bg-[#FFF200]/20 transition-colors"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                            <span className="text-sm text-gray-200">Prioridade no Suporte</span>
                        </div>
                    </motion.div>

                    {/* CTA Button - Neon Yellow */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="w-full"
                    >
                        <Button
                            className="w-full h-14 bg-[#FFF200] hover:bg-[#ffe600] text-black font-black uppercase tracking-widest text-sm rounded-xl shadow-[0_0_20px_rgba(255,242,0,0.4)] hover:shadow-[0_0_40px_rgba(255,242,0,0.6)] hover:scale-[1.02] transition-all duration-300 border-none relative overflow-hidden group"
                            onClick={markAsViewed}
                        >
                            <span className="relative z-10">{isGifted ? "Resgatar Presente" : "Acessar Painel"}</span>
                            {/* Shine Effect */}
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent z-0 w-full transform skew-x-12" />
                        </Button>
                    </motion.div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
