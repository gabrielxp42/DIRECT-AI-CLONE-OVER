import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Brain, Sparkles, TrendingUp, Clock, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from "sonner";
import { useSession } from '@/contexts/SessionProvider';

interface AITrainingProgress {
    training_status: 'learning' | 'ready' | 'paused' | 'disabled';
    confidence_score: number;
    conversations_analyzed: number;
    patterns_identified: number;
    similarity_score: number;
    coverage_score: number;
    tone_consistency_score: number;
    product_knowledge_score: number;
    started_at: string;
    ready_at?: string;
    last_analysis_at?: string;
}

export function AITrainingProgressCard() {
    const { session } = useSession();
    const [progress, setProgress] = useState<AITrainingProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
    const [messageCount, setMessageCount] = useState<number>(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        if (!session) return;

        // Fetch progress and message count
        const fetchData = async () => {
            try {
                const { data: progressData } = await supabase
                    .from('ai_agent_training')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                if (progressData) {
                    setProgress(progressData as AITrainingProgress);

                    // Calculate estimated days remaining if in learning state
                    if (progressData.training_status === 'learning' && progressData.conversations_analyzed > 0) {
                        const targetConversations = 300;
                        const currentRate = progressData.conversations_analyzed / getDaysSinceStart(progressData.started_at);
                        const remaining = targetConversations - progressData.conversations_analyzed;
                        const estimatedDays = Math.ceil(remaining / currentRate);
                        setDaysRemaining(estimatedDays);
                    }
                }

                const { count } = await supabase
                    .from('whatsapp_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', session.user.id);

                setMessageCount(count || 0);
            } catch (err) {
                console.error("Error fetching AI data", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Realtime subscription for updates
        const channel = supabase
            .channel('ai_training_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_agent_training', filter: `user_id=eq.${session.user.id}` }, (payload) => {
                setProgress(payload.new as AITrainingProgress);
                if (payload.new.training_status === 'learning' && payload.new.conversations_analyzed > 0) {
                    const targetConversations = 300;
                    const currentRate = payload.new.conversations_analyzed / getDaysSinceStart(payload.new.started_at);
                    const remaining = targetConversations - payload.new.conversations_analyzed;
                    const estimatedDays = Math.ceil(remaining / currentRate);
                    setDaysRemaining(estimatedDays);
                } else {
                    setDaysRemaining(null);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `user_id=eq.${session.user.id}` }, () => {
                setMessageCount(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session]);

    const getDaysSinceStart = (startDate: string): number => {
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays || 1; // Minimum 1 day
    };

    const handleRepairConnection = async () => {
        setIsAnalyzing(true);
        toast.info("Reparando conexão com WhatsApp...");
        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: { action: 'configure-webhook' }
            });

            if (error) throw error;
            if (data?.error) {
                console.error("Webhook Config Error:", data);
                throw new Error(data.message + (data.details ? ` (${JSON.stringify(data.details)})` : ""));
            }

            toast.success("Conexão reparada! O sistema deve começar a receber mensagens.");
        } catch (e: any) {
            console.error("Repair Error:", e);
            toast.error("Erro ao reparar", {
                description: e.message,
                duration: 10000, // Show for longer
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleForceAnalysis = async () => {
        setIsAnalyzing(true);
        toast.info("Iniciando análise manual...");
        try {
            const { data, error } = await supabase.functions.invoke('ai-training-processor', {
                body: { force_user_id: session?.user?.id }
            });

            if (error) throw error;

            toast.success("Análise concluída!");
            // Refresh data
            const { data: updated } = await supabase
                .from('ai_agent_training')
                .select('*')
                .eq('user_id', session?.user?.id!)
                .single();
            if (updated) setProgress(updated as AITrainingProgress);

        } catch (e: any) {
            toast.error("Erro ao analisar: " + e.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (isLoading) return null;

    if (!progress) {
        // Fallback for when there's no data yet (just connected)
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Sparkles className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Iniciando Aprendizado...</CardTitle>
                                <CardDescription>O sistema está aguardando suas conversas</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                            {messageCount === 0 ? (
                                <>
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full" />
                                        <Loader2 className="w-12 h-12 text-yellow-500 animate-spin relative z-10" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium">Aguardando mensagens...</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 mb-4">
                                            Converse no WhatsApp conectado para alimentar a IA.
                                        </p>
                                        <div className="relative z-20">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleRepairConnection}
                                                disabled={isAnalyzing}
                                                className="text-xs border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/30 cursor-pointer"
                                            >
                                                <RefreshCw className={`w-3 h-3 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                                {isAnalyzing ? 'Configurando...' : 'Não está recebendo? Reparar'}
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full" />
                                        <CheckCircle2 className="w-12 h-12 text-green-500 relative z-10" />
                                    </div>
                                    <div className="relative z-30">
                                        <h3 className="font-medium text-green-600 dark:text-green-400">{messageCount} mensagens recebidas!</h3>
                                        <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 mb-4">
                                            Pronto para iniciar a primeira análise.
                                        </p>
                                        <Button
                                            onClick={handleForceAnalysis}
                                            disabled={isAnalyzing}
                                            className="relative z-40 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
                                        >
                                            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Brain className="w-5 h-5 mr-2" />}
                                            {isAnalyzing ? 'Analisando...' : 'Iniciar Análise Agora'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    const isReady = progress.training_status === 'ready';
    const confidenceScore = progress.confidence_score || 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <Brain className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {isReady ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            Gabi está Pronta!
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                                            Gabi está Aprendendo
                                        </>
                                    )}
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    {isReady
                                        ? 'Sua IA pode atender clientes automaticamente'
                                        : 'Observando suas conversas para aprender seu estilo'}
                                </CardDescription>
                            </div>
                        </div>
                        {isReady && (
                            <Button size="sm" className="gap-2">
                                <Sparkles className="w-4 h-4" />
                                Ativar
                            </Button>
                        )}
                        {!isReady && (
                            <Button size="sm" variant="outline" className="gap-2" onClick={handleForceAnalysis} disabled={isAnalyzing}>
                                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                Analisar
                            </Button>
                        )}
                        {!isReady && messageCount === 0 && (
                            <Button size="sm" variant="destructive" className="gap-2 ml-2" onClick={handleRepairConnection} disabled={isAnalyzing}>
                                <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                                Reparar Conexão
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Main Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Progresso Geral</span>
                            <span className="text-2xl font-bold text-primary">{confidenceScore}%</span>
                        </div>
                        <Progress value={confidenceScore} className="h-3" />
                        {!isReady && daysRemaining && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Estimativa: {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} restantes
                            </p>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                            <p className="text-xs text-muted-foreground">Conversas Analisadas</p>
                            <p className="text-xl font-bold">{progress.conversations_analyzed}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                            <p className="text-xs text-muted-foreground">Padrões Identificados</p>
                            <p className="text-xl font-bold">{progress.patterns_identified}</p>
                        </div>
                    </div>

                    {/* Detailed Metrics */}
                    <div className="space-y-2 pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Métricas Detalhadas
                        </p>

                        <MetricBar
                            label="Similaridade de Respostas"
                            value={progress.similarity_score || 0}
                            icon={<TrendingUp className="w-3 h-3" />}
                        />
                        <MetricBar
                            label="Cobertura de Casos"
                            value={progress.coverage_score || 0}
                            icon={<CheckCircle2 className="w-3 h-3" />}
                        />
                        <MetricBar
                            label="Consistência de Tom"
                            value={progress.tone_consistency_score || 0}
                            icon={<Sparkles className="w-3 h-3" />}
                        />
                        <MetricBar
                            label="Conhecimento de Produtos"
                            value={progress.product_knowledge_score || 0}
                            icon={<Brain className="w-3 h-3" />}
                        />
                    </div>

                    {/* How it Works */}
                    {!isReady && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-primary" />
                                Como funciona?
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                A Gabi está observando suas conversas no WhatsApp para aprender como você atende.
                                Quando atingir <strong>85% de confiança</strong>, ela poderá atender automaticamente
                                seus clientes no seu estilo!
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}

function MetricBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                    {icon}
                    {label}
                </span>
                <span className="font-medium">{value}%</span>
            </div>
            <Progress value={value} className="h-1.5" />
        </div>
    );
}
