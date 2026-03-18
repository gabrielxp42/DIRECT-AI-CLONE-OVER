import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, QrCode, RefreshCw, CheckCircle, Loader2, AlertCircle, Smartphone, ShieldCheck, Zap, Bot, Star, Gift, Crown, ArrowRight, RefreshCcw, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/contexts/SessionProvider";
import { useIsPlusMode } from "@/hooks/useIsPlusMode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { SubscriptionModal } from "./SubscriptionModal";
import { GabiSuccessModal } from "./GabiSuccessModal";
import { AITrainingProgressCard } from "./AITrainingProgressCard";
import { motion, AnimatePresence } from "framer-motion";

export function WhatsAppConnection() {
    const { profile } = useSession();
    const { isPlus, isWhatsAppGifted } = useIsPlusMode();
    const [loading, setLoading] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        checkConnectionStatus();
    }, [profile]); // Re-run when profile updates

    // Polling de status quando estiver connecting
    useEffect(() => {
        let isPolling = false;
        let interval: NodeJS.Timeout;

        if (status === 'connecting') {
            interval = setInterval(async () => {
                if (isPolling) return; // Evita chamadas sobrepostas
                isPolling = true;

                try {
                    const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                        body: { action: 'update-status' }
                    });

                    if (data?.connected) {
                        setStatus('connected');
                        setShowSuccessModal(true);
                        setQrCode(null);
                        toast.success("WhatsApp Conectado com Sucesso!");
                    } else if (data?.qrcode) {
                        // Se recebemos um QR, atualizamos o estado
                        setQrCode(data.qrcode);
                    } else if (data?.state === 'not_found' || data?.error) {
                        // Se a instância não existe ou deu erro crítico, volta ao estado inicial
                        console.log("Instance not found or error during polling, resetting status");
                        setStatus('disconnected');
                        setQrCode(null);
                    }
                } catch (e) {
                    console.error("Status check failed", e);
                } finally {
                    isPolling = false;
                }
            }, 5000); // Checa a cada 5 segundos
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status]);

    const checkConnectionStatus = async () => {
        if (profile?.whatsapp_status === 'connected') {
            setStatus('connected');
            setQrCode(null);
        } else if (profile?.whatsapp_status === 'connecting') {
            setStatus('connecting');
            // Recuperar QR do cache se existir
            if (profile?.whatsapp_qr_cache) {
                setQrCode(profile.whatsapp_qr_cache);
            }
        } else {
            setStatus('disconnected');
            setQrCode(null);
        }
    };

    const handleConnect = async (force = false) => {
        if (loading) return; // Prevent double-clicks
        setLoading(true);
        setStatus('connecting');
        setQrCode(null);

        try {
            // Prioritize the existing instance ID from the database if available
            const savedInstanceId = profile?.whatsapp_instance_id;

            // Fallback generation logic - UNIQUE per user to avoid clashes (company + short id)
            const cleanName = (profile?.company_name || 'user')
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .substring(0, 15);

            const generatedId = `${cleanName}${profile?.id?.substring(0, 4)}`;

            const instanceId = force ? generatedId : (savedInstanceId || generatedId);

            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'create', instanceName: instanceId, force }
            });

            if (error) throw error;

            // Normalizar: O QR pode vir em data.qrcode.base64 ou data.base64 (Evolution v2 varia)
            const qrBase64 = data?.qrcode?.base64 || data?.base64;

            if (qrBase64) {
                setQrCode(qrBase64);
                toast.success("QR Code gerado! Escaneie agora.", {
                    description: "Abra o WhatsApp > Aparelhos Conectados > Conectar Aparelho"
                });
            } else if (data?.instance?.state === 'open' || data?.instance?.status === 'open' || data?.status === 'connected') {
                // Already connected
                setStatus('connected');
                toast.success("Instância já conectada!");
            } else {
                console.error("WhatsApp Integration Error:", data); // Log full response

                // Se a instância foi criada mas sem QR (count:0), avisar para tentar novamente
                if (data?.qrcode?.count === 0 || data?.instance?.status === 'close') {
                    toast.error("QR Code não gerado. Tente novamente.", {
                        description: "Aguarde 5 segundos e clique em 'Conectar' novamente."
                    });
                } else {
                    let errorMsg = "Falha ao obter QR Code";
                    if (data?.message && typeof data.message === 'string') errorMsg = data.message;
                    else if (data?.error && typeof data.error === 'string') errorMsg = data.error;
                    else if (data?.error?.message) errorMsg = data.error.message;
                    else if (typeof data === 'string' && data.length > 3) errorMsg = data;
                    else errorMsg = "A API da Evolution recusou a criação. Tente o botão 'Reset Total' abaixo para limpar a conta.";

                    toast.error(`Não foi possível obter o QR Code.`, {
                        description: errorMsg
                    });
                }
                setStatus('disconnected');
            }

        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao conectar: " + (error.message || "Erro desconhecido"));
            setStatus('disconnected');
        } finally {
            setLoading(false);
        }
    };

    const handleForceRefresh = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'update-status' }
            });

            if (data?.connected) {
                setStatus('connected');
                setShowSuccessModal(true);
                setQrCode(null);
                toast.success("Conectado!");
            } else if (data?.qrcode) {
                setQrCode(data.qrcode);
                toast.success("QR Code atualizado!");
            } else {
                toast.info("Ainda sincronizando... Verifique se o QR Code foi escaneado.");
            }
        } catch (e) {
            toast.error("Erro ao verificar status.");
        } finally {
            setLoading(false);
        }
    };

    const handleRestart = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'restart' }
            });

            if (data?.success) {
                toast.success("Reiniciando instância... Aguarde a sincronização.");
                // Força um check de status em breve
                setTimeout(handleForceRefresh, 3000);
            } else {
                toast.error("Erro ao reiniciar instância.");
            }
        } catch (e) {
            toast.error("Erro na comunicação com a Gabi.");
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'delete' }
            });
            if (error) throw error;

            // Explicit local cleanup
            setStatus('disconnected');
            setQrCode(null);

            // Sync with profile if possible
            if (profile?.id) {
                await supabase.from('profiles_v2').update({
                    whatsapp_status: 'disconnected',
                    whatsapp_qr_cache: null,
                    whatsapp_instance_id: null
                }).eq('uid', profile.id);
            }

            toast.success("Desconectado com sucesso.");
        } catch (error: any) {
            toast.error("Erro ao desconectar.");
        } finally {
            setLoading(false);
        }
    }

    if (!isPlus) {
        return (
            <div className="relative group overflow-hidden rounded-3xl">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 via-zinc-500/10 to-primary/10 blur-xl opacity-30" />
                <Card className="border-white/5 bg-zinc-950/90 backdrop-blur-2xl shadow-2xl overflow-hidden relative">
                    <CardContent className="p-8 md:p-12 flex flex-col items-center text-center space-y-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 border border-white/5 flex items-center justify-center relative overflow-hidden">
                                <Bot className="w-12 h-12 text-primary drop-shadow-[0_0_15px_rgba(255,242,0,0.5)]" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-zinc-950 border border-white/10 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-zinc-500" />
                            </div>
                        </div>

                        <div className="space-y-4 max-w-md">
                            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest mb-2">
                                Gabi Engine • Feature de Elite
                            </Badge>
                            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-[0.9]">
                                WhatsApp <br />
                                <span className="text-primary shimmer-text italic">Plus Mode</span>
                            </h2>
                            <p className="text-zinc-400 text-sm md:text-md font-bold italic leading-relaxed">
                                "Ei! Notei que você ainda não habilitou meu motor de envios. No WhatsApp Plus eu aviso seus clientes na hora, envio fotos dos pedidos e organizo sua comunicação sozinho."
                            </p>
                        </div>

                        <div className="w-full h-px bg-white/5" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                <span className="text-primary flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-left">
                                    <CheckCircle className="w-3 h-3" /> Envio Direto
                                </span>
                                <p className="text-[10px] text-zinc-500 font-medium text-left">Sem wa.me. Envie direto do sistema.</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                                <span className="text-primary flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-left">
                                    <CheckCircle className="w-3 h-3" /> Automação
                                </span>
                                <p className="text-[10px] text-zinc-500 font-medium text-left">A Gabi cuida de avisar o cliente.</p>
                            </div>
                        </div>

                        <Button
                            className="w-full h-16 bg-primary hover:bg-[#ffe600] text-black font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_15px_30px_-10px_rgba(255,242,0,0.3)] gap-3 group/btn"
                            onClick={() => setIsUpgradeModalOpen(true)}
                        >
                            <Crown className="w-5 h-5 fill-black" />
                            Quero o WhatsApp Plus Agora
                            <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>

                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                            Indisponível no Plano Atual
                        </p>
                    </CardContent>
                </Card>

                <SubscriptionModal
                    open={isUpgradeModalOpen}
                    onOpenChange={setIsUpgradeModalOpen}
                />
            </div>
        );
    }

    return (
        <div className="relative group">
            <div className={cn(
                "absolute -inset-0.5 bg-gradient-to-r from-emerald-500/30 via-green-500/30 to-teal-500/30 blur-xl opacity-30 transition-opacity duration-1000",
                status === 'connected' ? "opacity-50" : "opacity-30"
            )} />

            <Card className="border-zinc-200 dark:border-white/5 bg-white dark:bg-zinc-950/80 backdrop-blur-xl shadow-xl overflow-hidden relative rounded-3xl">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                    <MessageSquare className="w-24 h-24 text-zinc-900 dark:text-white" />
                </div>

                <CardContent className="p-6 md:p-10 space-y-8">
                    {/* Header styled like SmartGoalCard */}
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <div className="relative group/bot">
                            <div className={cn(
                                "p-4 rounded-[2rem] border transition-all duration-500",
                                status === 'connected'
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 scale-110 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                    : "bg-zinc-900 border-white/5 text-zinc-500"
                            )}>
                                <Bot className="w-10 h-10" />
                            </div>
                            {status === 'connected' && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1.5 border-4 border-zinc-950"
                                >
                                    <Zap className="w-3 h-3 fill-current" />
                                </motion.div>
                            )}
                        </div>

                        <div className="text-center md:text-left space-y-2 flex-1">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest">
                                    Gabi Engine V2
                                </Badge>
                                {isWhatsAppGifted && (
                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <Gift className="w-3 h-3" /> Presente Ativo
                                    </Badge>
                                )}
                            </div>
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">
                                {status === 'connected' ? "BOT ATIVO NO COMANDO" : status === 'connecting' ? "ESTABELECENDO CONTATO..." : "CONEXÃO DA INTELIGÊNCIA"}
                            </h2>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-bold italic leading-tight max-w-md">
                                {status === 'connected'
                                    ? "👋 Ei! Gabi aqui. Estou conectada e pronta para automatizar seus avisos de pedido."
                                    : status === 'connecting'
                                        ? "🚀 Só um segundo! Estou configurando minha inteligência no seu WhatsApp..."
                                        : "👋 Olá! Sou a Gabi. Preciso que você conecte o WhatsApp para que eu possa falar com seus clientes."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Segurança</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-medium tracking-tight">Instância criptografada e dedicada.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                                <Smartphone className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Multi-Device</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-medium tracking-tight">Use no PC e Celular simultaneamente.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 space-y-3">
                            <div className="flex items-center gap-2 text-primary">
                                <Star className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Gabi AI</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-medium tracking-tight">Lógica inteligente de avisos inclusa.</p>
                        </div>
                    </div>

                    {/* Connection Area */}
                    <div className="pt-4 border-t border-zinc-200 dark:border-white/5">
                        {status === 'connected' ? (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-zinc-900 dark:text-white font-black italic uppercase tracking-tighter text-xl">SISTEMA ONLINE</p>
                                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Pronto para a ação</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleRestart}
                                        disabled={loading}
                                        className="h-12 px-6 rounded-xl border-primary/20 text-primary hover:bg-primary hover:text-white font-black uppercase tracking-widest text-xs transition-all"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                                        Reiniciar Sincronização
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleDisconnect}
                                        disabled={loading}
                                        className="h-10 px-4 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all opacity-60 hover:opacity-100"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Power className="w-3 h-3 mr-2" />}
                                        Desconectar
                                    </Button>
                                    <div className="flex flex-col items-center gap-2 mt-2">
                                        <button
                                            onClick={() => handleConnect(true)}
                                            className="text-[9px] text-zinc-500 hover:text-red-500 uppercase font-bold tracking-tighter transition-colors"
                                        >
                                            Problemas Graves? Forçar Reset Total
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center space-y-6">
                                {qrCode ? (
                                    <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                                        <div className="relative group/qr p-4 bg-white rounded-3xl shadow-2xl">
                                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                            <img
                                                src={qrCode}
                                                alt="WhatsApp QR Code"
                                                className="w-48 h-48 md:w-64 md:h-64 relative z-10"
                                            />
                                        </div>
                                        <div className="max-w-xs">
                                            <p className="text-zinc-900 dark:text-white font-black italic uppercase tracking-widest text-sm mb-2">QR CODE PRONTO ✨</p>
                                            <p className="text-zinc-500 text-[11px] font-bold leading-tight">
                                                Abra o WhatsApp no seu celular {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col items-center py-8 space-y-4">
                                        <Button
                                            onClick={() => handleConnect(false)}
                                            disabled={loading || status === 'connecting'}
                                            className="w-full max-w-sm h-16 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all shadow-xl group/btn overflow-hidden relative"
                                        >
                                            <span className="relative z-10 flex items-center gap-3">
                                                {status === 'connecting' ? "SINCRONIZANDO..." : "CONECTAR AO MOTOR GABI"}
                                                {status === 'connecting' ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />}
                                            </span>
                                            {status === 'connecting' && (
                                                <div className="absolute inset-0 bg-primary/20 animate-pulse" />
                                            )}
                                        </Button>

                                        {status === 'connecting' && (
                                            <div className="flex flex-col items-center space-y-2">
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest italic animate-pulse">
                                                    Estabelecendo Handshake com Evolução...
                                                </p>
                                                <div className="flex gap-4">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleForceRefresh}
                                                        disabled={loading}
                                                        className="px-4 h-10 rounded-xl border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase tracking-widest text-[10px]"
                                                    >
                                                        Atualizar Status
                                                    </Button>
                                                </div>
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    onClick={handleDisconnect}
                                                    className="text-[9px] text-red-400 hover:text-red-500 uppercase font-black"
                                                >
                                                    Cancelar e Resetar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Opção de Reset Total sempre visível se não estiver FULL conectado */}
                                {!loading && status !== 'connected' && (
                                    <button
                                        onClick={() => handleConnect(true)}
                                        className="text-[9px] text-zinc-500 hover:text-red-500 uppercase font-black tracking-tighter transition-colors mt-2 flex items-center gap-2 group"
                                    >
                                        <RefreshCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                                        Instância travada ou QR não carrega? Tentar Reset Total
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <GabiSuccessModal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
            />

            {status === 'connected' && (
                <div className="mt-6">
                    <AITrainingProgressCard />
                </div>
            )}
        </div>
    );
}
