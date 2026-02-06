import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Brain,
    Users,
    DollarSign,
    Activity,
    CheckCircle2,
    Loader2,
    Pause,
    Play,
    RefreshCw,
    Eye,
    Settings,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIKnowledgeViewer } from './AIKnowledgeViewer';
import { AITrainingLogs } from './AITrainingLogs';
import { cn } from '@/lib/utils';

interface AgentTraining {
    id: string;
    user_id: string;
    training_status: string;
    confidence_score: number;
    conversations_analyzed: number;
    patterns_identified: number;
    similarity_score: number;
    coverage_score: number;
    tone_consistency_score: number;
    product_knowledge_score: number;
    total_cost_usd: number;
    started_at: string;
    last_analysis_at: string;
    profiles: {
        company_name: string;
        company_email: string;
    };
}

interface AgentStats {
    total: number;
    ready: number;
    learning: number;
    paused: number;
    totalCost: number;
    avgConfidence: number;
}

export function AdminAIMonitoring() {
    const [agents, setAgents] = useState<AgentTraining[]>([]);
    const [stats, setStats] = useState<AgentStats>({
        total: 0,
        ready: 0,
        learning: 0,
        paused: 0,
        totalCost: 0,
        avgConfidence: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<AgentTraining | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [hasRecentError, setHasRecentError] = useState(false);

    useEffect(() => {
        fetchAgents();

        // Realtime subscription for immediate updates
        const channel = supabase
            .channel('ai-monitoring-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'ai_agent_training'
                },
                (payload) => {
                    console.log('[AI Monitoring] Realtime update received:', payload.eventType);
                    fetchAgents(); // Refresh data on any change
                }
            )
            .subscribe((status) => {
                console.log('[AI Monitoring] Subscription status:', status);
            });

        // Fallback polling every 60 seconds (reduced from 30s since we have realtime now)
        const interval = setInterval(fetchAgents, 60000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_agent_training')
                .select(`
          *,
          profiles (
            company_name,
            company_email
          )
        `)
                .order('confidence_score', { ascending: false });

            if (error) throw error;

            if (data) {
                setAgents(data as AgentTraining[]);

                // Calculate stats
                const ready = data.filter(a => a.training_status === 'ready').length;
                const learning = data.filter(a => a.training_status === 'learning').length;
                const paused = data.filter(a => a.training_status === 'paused').length;
                const totalCost = data.reduce((sum, a) => sum + (a.total_cost_usd || 0), 0);
                const avgConfidence = data.length > 0
                    ? data.reduce((sum, a) => sum + a.confidence_score, 0) / data.length
                    : 0;

                setStats({
                    total: data.length,
                    ready,
                    learning,
                    paused,
                    totalCost,
                    avgConfidence: Math.round(avgConfidence)
                });

                // Check for errors in the last 24h
                checkSystemHealth();
            }
        } catch (error) {
            console.error('Error fetching agents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkSystemHealth = async () => {
        try {
            const { data } = await supabase
                .from('ai_training_logs')
                .select('id')
                .eq('action', 'analysis_failed')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

            setHasRecentError(data && data.length > 0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleViewDetails = (agent: AgentTraining) => {
        setSelectedAgent(agent);
        setIsDetailOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ready':
                return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✅ Pronto</Badge>;
            case 'learning':
                return (
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        Aprendendo
                    </Badge>
                );
            case 'paused':
                return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">⏸️ Pausado</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getDaysAgo = (dateString: string) => {
        if (!dateString) return 'Nunca';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffMinutes = Math.floor(diffTime / (1000 * 60));

        if (diffMinutes < 1) return 'Agora mesmo';
        if (diffMinutes < 60) return `há ${diffMinutes} min`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `há ${diffHours}h`;

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return `há ${diffDays} dias`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with System Status Indicator */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Brain className="w-6 h-6 text-primary" />
                        Monitoramento de Agentes IA
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Acompanhe o treinamento e performance dos agentes Gemini
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-card border rounded-full px-4 py-2 self-start md:self-center shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "h-2 w-2 rounded-full",
                            hasRecentError
                                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                                : (agents.length > 0 ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-zinc-500")
                        )} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {hasRecentError ? "Gemini API: Instável" : "Gemini API: Ativa"}
                        </span>
                    </div>
                    <div className="w-[1px] h-3 bg-border mx-1" />
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "h-2 w-2 rounded-full",
                            hasRecentError ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                        )} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            {hasRecentError ? "Quota: Esgotada/Erro" : "Quota: OK"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-2 text-xs">
                            <Users className="w-4 h-4" />
                            Total de Agentes
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.total}</div>
                        <div className="flex gap-2 mt-2 text-xs">
                            <span className="text-green-500">✓ {stats.ready}</span>
                            <span className="text-blue-500">⟳ {stats.learning}</span>
                            <span className="text-yellow-500">⏸ {stats.paused}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="w-4 h-4" />
                            Agentes Prontos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-500">{stats.ready}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {stats.total > 0 ? Math.round((stats.ready / stats.total) * 100) : 0}% do total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-2 text-xs">
                            <TrendingUp className="w-4 h-4" />
                            Confiança Média
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{stats.avgConfidence}%</div>
                        <Progress value={stats.avgConfidence} className="mt-2 h-1.5" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription className="flex items-center gap-2 text-xs">
                            <DollarSign className="w-4 h-4" />
                            Custo Total (Mês)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">${stats.totalCost.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Média: ${stats.total > 0 ? (stats.totalCost / stats.total).toFixed(2) : '0.00'}/agente
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Agents List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Agentes por Usuário</CardTitle>
                        <Button size="sm" variant="outline" onClick={fetchAgents}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Atualizar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {agents.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Nenhum agente em treinamento ainda</p>
                            </div>
                        ) : (
                            agents.map((agent) => (
                                <motion.div
                                    key={agent.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold truncate">
                                                    {agent.profiles?.company_name || 'Empresa'}
                                                </h4>
                                                {getStatusBadge(agent.training_status)}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {agent.profiles?.company_email}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-2xl font-bold text-primary">
                                                    {agent.confidence_score}%
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {agent.conversations_analyzed} conversas
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleViewDetails(agent)}
                                                    className="h-8 text-xs"
                                                >
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    Detalhes
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <Progress value={agent.confidence_score} className="h-1.5" />
                                    </div>

                                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                        <span>
                                            Última análise: {getDaysAgo(agent.last_analysis_at || agent.started_at)}
                                        </span>
                                        <span>
                                            Custo: ${(agent.total_cost_usd || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-primary" />
                            Detalhes do Agente - {selectedAgent?.profiles?.company_name}
                        </DialogTitle>
                        <DialogDescription>
                            Métricas detalhadas de aprendizado e performance
                        </DialogDescription>
                    </DialogHeader>

                    {selectedAgent && (
                        <Tabs defaultValue="metrics" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                                <TabsTrigger value="knowledge">Conhecimento</TabsTrigger>
                                <TabsTrigger value="activity">Atividade</TabsTrigger>
                            </TabsList>

                            <TabsContent value="metrics" className="space-y-4 pt-4">
                                {/* Overall Progress */}
                                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Confiança Geral</span>
                                        <span className="text-3xl font-bold text-primary">
                                            {selectedAgent.confidence_score}%
                                        </span>
                                    </div>
                                    <Progress value={selectedAgent.confidence_score} className="h-2" />
                                </div>

                                {/* Detailed Metrics */}
                                <div className="grid grid-cols-2 gap-3">
                                    <MetricCard
                                        label="Similaridade de Respostas"
                                        value={selectedAgent.similarity_score || 0}
                                        weight="40%"
                                    />
                                    <MetricCard
                                        label="Cobertura de Casos"
                                        value={selectedAgent.coverage_score || 0}
                                        weight="30%"
                                    />
                                    <MetricCard
                                        label="Consistência de Tom"
                                        value={selectedAgent.tone_consistency_score || 0}
                                        weight="20%"
                                    />
                                    <MetricCard
                                        label="Conhecimento de Produtos"
                                        value={selectedAgent.product_knowledge_score || 0}
                                        weight="10%"
                                    />
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <p className="text-xs text-muted-foreground">Conversas</p>
                                        <p className="text-xl font-bold">{selectedAgent.conversations_analyzed}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <p className="text-xs text-muted-foreground">Padrões</p>
                                        <p className="text-xl font-bold">{selectedAgent.patterns_identified}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-muted/50">
                                        <p className="text-xs text-muted-foreground">Custo</p>
                                        <p className="text-xl font-bold">${(selectedAgent.total_cost_usd || 0).toFixed(2)}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2 border-t">
                                    <Button variant="outline" size="sm" className="flex-1">
                                        <Pause className="w-4 h-4 mr-2" />
                                        Pausar
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1">
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Resetar
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1">
                                        <Settings className="w-4 h-4 mr-2" />
                                        Configurar
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="knowledge" className="pt-4">
                                <AIKnowledgeViewer userId={selectedAgent.user_id} />
                            </TabsContent>

                            <TabsContent value="activity" className="pt-4">
                                <AITrainingLogs userId={selectedAgent.user_id} />
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}

function MetricCard({ label, value, weight }: { label: string; value: number; weight: string }) {
    return (
        <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-primary">{weight}</span>
            </div>
            <div className="flex items-center justify-between">
                <Progress value={value} className="h-1.5 flex-1 mr-2" />
                <span className="text-sm font-bold">{value}%</span>
            </div>
        </div>
    );
}
