
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSession } from "@/contexts/SessionProvider";
import { Check, Sparkles, Gift, Crown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import confetti from 'canvas-confetti';

export function GiftPlanModal() {
    const { session, profile } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const TRIGGER_PLAN = 'pro';

    useEffect(() => {
        if (session && profile) {
            const hasNotViewed = profile.subscription_gift_viewed === false;
            const hasNotViewedWhatsApp = (profile as any).is_whatsapp_plus_gifted_viewed === false;

            // Immediate local check to avoid flickering
            const localViewed = localStorage.getItem('subscription_gift_viewed') === 'true';
            const localViewedWhatsApp = localStorage.getItem('is_whatsapp_plus_gifted_viewed') === 'true';

            // Check for Pro/Expert Gift
            const isPro = profile.subscription_tier === TRIGGER_PLAN || profile.subscription_status === 'active';
            const hasWhatsAppGift = !!(profile as any).is_whatsapp_plus_gifted;

            if ((isPro && hasNotViewed && !localViewed) || (hasWhatsAppGift && hasNotViewedWhatsApp && !localViewedWhatsApp)) {
                console.log("🎯 Triggering Gift/Welcome Modal!");
                setIsOpen(true);

                // Extra celebration for WhatsApp Gift
                if (hasWhatsAppGift && hasNotViewedWhatsApp && !localViewedWhatsApp) {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#00FF00', '#FFFFFF', '#10b981']
                    });
                }
            }
        }
    }, [session, profile]);

    const isGifted = profile?.is_gifted_plan === true;
    const isWAGift = (profile as any)?.is_whatsapp_plus_gifted === true;

    const markAsViewed = async (newOpenState?: boolean) => {
        if (newOpenState === true) return;
        setIsOpen(false);

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
            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
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
        <Dialog open={isOpen} onOpenChange={markAsViewed}>
            <DialogContent className="w-[95vw] max-w-[450px] p-0 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(255,242,0,0.15)] bg-black/40 backdrop-blur-3xl">
                {/* Liquid Glass Background Layers */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#FFF200]/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
                    <div className="absolute -bottom-20 right-0 w-60 h-60 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none mix-blend-screen" />
                    <div className="absolute inset-0 bg-white/5 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center p-8 pt-12 pb-8">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        className={cn(
                            "w-24 h-24 rounded-3xl bg-gradient-to-br border shadow-xl backdrop-blur-md flex items-center justify-center mb-6 relative group",
                            isWAGift ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 shadow-emerald-500/20" : "from-white/10 to-white/5 border-white/20 shadow-[#FFF200]/20"
                        )}
                    >
                        <div className={cn(
                            "absolute inset-0 opacity-20 blur-xl rounded-full group-hover:opacity-40 transition-opacity duration-500",
                            isWAGift ? "bg-emerald-500" : "bg-[#FFF200]"
                        )} />

                        {isWAGift ? (
                            <Zap className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" strokeWidth={1.5} />
                        ) : isGifted ? (
                            <Gift className="w-12 h-12 text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" strokeWidth={1.5} />
                        ) : (
                            <Crown className="w-12 h-12 text-[#FFF200] drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" strokeWidth={1.5} />
                        )}
                    </motion.div>

                    <motion.h2
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-3xl font-black uppercase italic tracking-tighter mb-2 text-white drop-shadow-lg"
                    >
                        {isWAGift ? "PODER MÁXIMO!" : isGifted ? "Parabéns!" : "Você é Elite!"}
                    </motion.h2>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="text-white/80 text-sm font-medium leading-relaxed max-w-[320px] mb-8"
                    >
                        {isWAGift ? (
                            <p>Ei! Gabi aqui. Acabei de liberar o <span className="text-emerald-500 font-bold drop-shadow-sm">WHATSAPP PLUS</span> pra você. Agora seu negócio terá automação de elite!</p>
                        ) : isGifted ? (
                            <p>Um administrador concedeu a você acesso <span className="text-[#FFF200] font-bold drop-shadow-sm">VITALÍCIO</span> ao plano Profissional.</p>
                        ) : (
                            <p>Sua assinatura foi confirmada! Agora você tem <span className="text-[#FFF200] font-bold drop-shadow-sm">PODER ILIMITADO</span> para criar e gerenciar.</p>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3 mb-8 shadow-inner backdrop-blur-sm"
                    >
                        {isWAGift ? (
                            <>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-emerald-500" /></div>
                                    <span className="text-sm text-gray-200">Envio Direto via Evolução API</span>
                                </div>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-emerald-500" /></div>
                                    <span className="text-sm text-gray-200">Status em Tempo Real</span>
                                </div>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-emerald-500" /></div>
                                    <span className="text-sm text-gray-200">Gabi Engine Pro Hack Ativado</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                                    <span className="text-sm text-gray-200">IA Gerativa Ilimitada</span>
                                </div>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                                    <span className="text-sm text-gray-200">Gestão de Estoque Completa</span>
                                </div>
                                <div className="flex items-center gap-3 group">
                                    <div className="bg-[#FFF200]/10 border border-[#FFF200]/20 p-1.5 rounded-full"><Check className="w-3.5 h-3.5 text-[#FFF200]" /></div>
                                    <span className="text-sm text-gray-200">Prioridade no Suporte</span>
                                </div>
                            </>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="w-full"
                    >
                        <Button
                            className={cn(
                                "w-full h-14 font-black uppercase tracking-widest text-sm rounded-xl shadow-lg transition-all duration-300 border-none relative overflow-hidden group",
                                isWAGift
                                    ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/40"
                                    : "bg-[#FFF200] text-black hover:bg-[#ffe600] shadow-[0_0_20px_rgba(255,242,0,0.4)]"
                            )}
                            onClick={() => {
                                markAsViewed(false);
                                if (isWAGift) {
                                    navigate('/settings#whatsapp-settings-section');
                                } else {
                                    navigate('/settings');
                                }
                            }}
                        >
                            <span className="relative z-10">
                                {isWAGift ? "Ir para Gabi Engine" : isGifted ? "Resgatar Presente" : "Acessar Painel"}
                            </span>
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent z-0 w-full transform skew-x-12" />
                        </Button>
                    </motion.div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
