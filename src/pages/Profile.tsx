
import { useSession } from "@/contexts/SessionProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    User,
    Shield,
    CreditCard,
    LogOut,
    Loader2,
    AlertCircle,
    Mail,
    DollarSign,
    Users,
    Package,
    History,
    FileText,
    TrendingUp,
    ChevronRight,
    Sparkles,
    MessageSquare,
    Settings,
    Zap,
    ShieldCheck,
    ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Profile() {
    const { session, profile, isLoading } = useSession();
    const navigate = useNavigate();
    const subscription = useSubscription();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    const formatDate = (date: Date | null | string) => {
        if (!date) return "N/A";
        return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    }

    const userEmail = session?.user?.email;
    const userInitials = userEmail ? userEmail.substring(0, 2).toUpperCase() : "U";

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success("Sessão encerrada");
    };

    const handleWhatsAppSupport = () => {
        window.open("https://wa.me/5521986243396?text=Olá! Preciso de suporte com minha conta no Direct AI.", "_blank");
    };

    const handleManageSubscription = async () => {
        if (!session?.access_token) return;

        try {
            toast.loading("Redirecionando para o portal de pagamento...", { id: 'portal-loader' });

            const response = await fetch('https://zdbjzrpgliqicwvncfpc.supabase.co/functions/v1/create-portal-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    returnUrl: window.location.href
                })
            });

            const data = await response.json();
            toast.dismiss('portal-loader');

            if (data.error) throw new Error(data.error);
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            toast.dismiss('portal-loader');
            toast.error("Erro ao abrir portal: " + error.message);
        }
    };

    return (
        <div className="relative min-h-screen pb-20 overflow-x-hidden pt-safe selection:bg-primary selection:text-black bg-background text-foreground transition-colors duration-300">
            {/* Background Identity: Adaptive and subtle */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-primary/10 dark:bg-primary/5 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full" />
            </div>

            <div className="container max-w-4xl pt-8 md:pt-14 px-5 md:px-8">

                {/* Header: Adaptive Design */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8 mb-12 md:mb-16"
                >
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 text-center md:text-left">
                        <div className="relative">
                            <motion.div whileHover={{ scale: 1.05 }} className="relative z-10">
                                <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl ring-1 ring-foreground/10 bg-muted">
                                    <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback className="text-2xl md:text-4xl bg-gradient-to-br from-muted to-background text-foreground font-black uppercase italic">
                                        {userInitials}
                                    </AvatarFallback>
                                </Avatar>
                            </motion.div>
                            {subscription.isActive && (
                                <div className="absolute -top-1 -right-1 z-20 bg-primary text-primary-foreground rounded-full p-2 shadow-lg border-2 border-background">
                                    <CrownIcon className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-foreground">
                                {profile?.first_name ? `${profile.first_name} ${profile?.last_name || ''}` : "Explorador Direct"}
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground font-bold">
                                <Mail className="w-4 h-4 text-primary" />
                                <span className="text-sm md:text-lg">{userEmail}</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="text-muted-foreground hover:text-destructive font-black uppercase tracking-widest text-[10px] md:text-xs"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair do Sistema
                    </Button>
                </motion.div>

                <div className="grid grid-cols-1 gap-8">

                    {/* LIQUID GLASS CARD: STAYS DARK/PREMIUM IN BOTH MODES */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="group relative overflow-hidden border-none bg-muted/30 dark:bg-card/30 shadow-2xl rounded-[2.5rem] md:rounded-[3.5rem] p-1">
                            {/* The Internal Liquid Glass "App" container: Always dark for High-End feel */}
                            <div className="relative overflow-hidden bg-zinc-950 rounded-[2.3rem] md:rounded-[3.3rem] min-h-[450px]">

                                {/* Inner Luminous Elements */}
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <div className="absolute top-[-10%] right-[-5%] w-[300px] h-[300px] bg-primary/10 blur-[80px] rounded-full" />
                                    <div className="absolute bottom-[-5%] left-[-5%] w-[250px] h-[250px] bg-white/5 blur-[70px] rounded-full" />
                                </div>

                                <CardContent className="p-8 md:p-14 relative z-10 h-full flex flex-col justify-between">

                                    <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
                                        <div className="text-center md:text-left space-y-4">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-1">
                                                <Sparkles className="w-3 h-3 text-primary" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Status da Assinatura</span>
                                            </div>
                                            <h3 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter text-white">
                                                {subscription.isActive
                                                    ? (profile?.subscription_tier === 'pro_max' ? "Elite PRO MAX" : "Elite PRO")
                                                    : "Plano Gratuito"}
                                            </h3>
                                            <p className="text-white/40 text-sm md:text-lg font-bold italic leading-tight">
                                                {subscription.isActive
                                                    ? (profile?.subscription_tier === 'pro_max'
                                                        ? "Acesso Total. Gabriel e WhatsApp Plus liberados."
                                                        : "Acesso Profissional. Potência e precisão garantidas.")
                                                    : "Evolua agora e domine o poder total da nossa inteligência."}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className={`h-24 w-24 md:h-32 md:w-32 rounded-[2rem] border-2 flex items-center justify-center transition-all ${subscription.isActive ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(255,242,0,0.2)] text-primary' : 'border-white/10 bg-white/5 text-white/10'}`}>
                                                <Zap className={`w-12 h-12 md:w-16 md:h-16 ${subscription.isActive ? 'fill-primary' : ''}`} />
                                            </div>
                                            {(subscription.isWhatsAppPlusActive || profile?.subscription_tier === 'pro_max') && (
                                                <Badge className="bg-emerald-500 text-white border-0 font-black italic uppercase tracking-tighter py-1 px-3 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                                    WhatsApp Plus Ativo
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats Grid inside the dark core */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mt-12 mb-12">
                                        <div className="p-6 md:p-8 rounded-[2rem] bg-white/[0.04] border border-white/5">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-3">Expiração do Ciclo</span>
                                            <p className="text-xl md:text-2xl font-black tracking-tight text-white italic uppercase">
                                                {subscription.isActive
                                                    ? (profile?.next_billing_date ? formatDate(profile.next_billing_date) : "RENOVAÇÃO AUTOMÁTICA")
                                                    : formatDate(subscription.trialEndsAt?.toISOString() || "")}
                                            </p>
                                        </div>
                                        <div className="p-6 md:p-8 rounded-[2rem] bg-white/[0.04] border border-white/5 text-center md:text-left">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-3">Verificação da Conta</span>
                                            <p className="text-xl md:text-2xl font-black tracking-tight text-emerald-400 italic flex items-center justify-center md:justify-start gap-3 uppercase">
                                                CONFIRMADO <ShieldCheck className="w-5 h-5" />
                                            </p>
                                        </div>
                                    </div>

                                    {/* Power Control: Progress Bar */}
                                    <div className="space-y-5">
                                        <div className="flex items-center justify-between px-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Capacidade Neural de IA</span>
                                            <span className="text-[10px] md:text-xs font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,242,0,0.5)]">
                                                {subscription.isActive ? "PODER ILIMITADO 🔥" : `${subscription.dailyUsage}/${subscription.maxDailyUsage} USOS`}
                                            </span>
                                        </div>
                                        <div className="h-4 w-full bg-black rounded-full border border-white/10 p-1 relative overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: subscription.isActive ? "100%" : `${(subscription.dailyUsage / subscription.maxDailyUsage) * 100}%` }}
                                                className={`h-full rounded-full bg-primary shadow-[0_0_15px_rgba(255,242,0,0.4)]`}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-32 h-full animate-[shimmer_2s_infinite] -skew-x-12" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-4 mt-8">
                                        {subscription.isActive && (
                                            <Button
                                                onClick={handleManageSubscription}
                                                variant="outline"
                                                className="w-full h-14 bg-white/5 border-white/10 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl gap-3"
                                            >
                                                <CreditCard className="w-4 h-4 text-primary" />
                                                Gerenciar Pagamentos e Assinatura
                                            </Button>
                                        )}

                                        {!subscription.isActive && (
                                            <Button
                                                onClick={() => setIsUpgradeModalOpen(true)}
                                                className="w-full h-18 md:h-20 bg-primary hover:bg-[#ffe600] text-primary-foreground font-black uppercase tracking-[0.2em] text-md md:text-lg rounded-3xl shadow-2xl group overflow-hidden border-none"
                                            >
                                                <span className="relative z-10 flex items-center gap-3">
                                                    DESBLOQUEAR PODER ELITE <ArrowRight className="w-6 h-6" />
                                                </span>
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                            </Button>
                                        )}

                                        {subscription.isActive && profile?.subscription_tier === 'pro' && (
                                            <Button
                                                onClick={() => navigate('/checkout')}
                                                variant="outline"
                                                className="w-full h-18 border-[#FFF200]/50 hover:bg-[#FFF200]/10 text-[#FFF200] font-bold uppercase tracking-wider text-sm rounded-[2rem] gap-3 group relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-[#FFF200]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                                <div className="relative z-10 flex items-center gap-3">
                                                    <Sparkles className="w-5 h-5 text-primary" />
                                                    Fazer Upgrade para ELITE PRO MAX
                                                </div>
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </div>

                            {/* Support Section */}
                            <div className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-2xl bg-[#FFF200]/10 border border-[#FFF200]/20 text-[#FFF200]">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white tracking-tight">Precisa de Ajuda?</h3>
                                        <p className="text-sm text-zinc-500 font-medium tracking-tight">Suporte técnico e comercial</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-300 hover:bg-[#FFF200] hover:text-black gap-2 font-bold px-6"
                                        asChild
                                    >
                                        <a href="mailto:gabrielxp45@gmail.com">
                                            <Mail className="h-5 w-5" />
                                            E-MAIL DE SUPORTE
                                        </a>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-300 hover:bg-green-500 hover:text-white hover:border-green-500 gap-2 font-bold px-6"
                                        onClick={() => window.open('https://wa.me/5521995560196', '_blank')}
                                    >
                                        <img src="https://cdn-icons-png.flaticon.com/512/124/124034.png" alt="WhatsApp" className="h-5 w-5 invert hover:invert-0" />
                                        WHATSAPP DIRETO
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Support & Stability: ADAPTIVE BOXES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="p-10 rounded-[2.5rem] bg-card border border-border flex flex-col justify-between min-h-[220px] shadow-xl"
                        >
                            <div className="space-y-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <MessageSquare className="w-6 h-6 text-primary" />
                                </div>
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Suporte Neural 24/7</h4>
                                <p className="text-md text-foreground/70 font-bold leading-relaxed italic">
                                    Ajuda prioritária direto no seu WhatsApp. Nossa equipe técnica está pronta para você.
                                </p>
                            </div>
                            <Button
                                onClick={handleWhatsAppSupport}
                                variant="link"
                                className="w-fit p-0 h-auto text-foreground font-black uppercase text-xs hover:text-primary transition-colors mt-6"
                            >
                                CHAMAR NO WHATSAPP →
                            </Button>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="p-10 rounded-[2.5rem] bg-card border border-border shadow-xl"
                        >
                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-10">DNA de Performance</h4>
                            <div className="space-y-8">
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <span className="text-sm font-bold text-muted-foreground italic">Estabilidade</span>
                                    <span className="text-sm font-black text-emerald-500 italic uppercase">EXCELENTE</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <span className="text-sm font-bold text-muted-foreground italic">Membro Desde</span>
                                    <span className="text-sm font-black text-foreground italic uppercase">{profile?.created_at ? format(new Date(profile.created_at), "MM/yyyy") : "-"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-muted-foreground italic">Identidade</span>
                                    <span className="text-sm font-black text-foreground italic uppercase">VERIFICADA ✅</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Slogan Decorator */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-20 text-center"
                >
                    <p className="text-[10px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.5em] font-black text-muted-foreground/30 px-4">
                        DIRECT AI - INTELIGÊNCIA ARTIFICIAL DAS PEQUENAS AS GRANDES EMPRESAS;
                    </p>
                </motion.div>

            </div>

            <SubscriptionModal
                open={isUpgradeModalOpen}
                onOpenChange={setIsUpgradeModalOpen}
            />
        </div>
    );
}

function CrownIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
    )
}
