import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    Brain,
    Zap,
    Database,
    CheckCircle2,
    Clock,
    Terminal,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TrainingLog {
    id: string;
    agent_type: 'extractor' | 'validator' | 'synthesizer' | 'evaluator' | 'responder';
    action: string;
    details: any;
    created_at: string;
}

interface AITrainingLogsProps {
    userId: string;
}

export function AITrainingLogs({ userId }: AITrainingLogsProps) {
    const [logs, setLogs] = useState<TrainingLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchLogs();

            const channel = supabase
                .channel(`ai-logs-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'ai_training_logs',
                        filter: `user_id=eq.${userId}`
                    },
                    (payload) => {
                        console.log('[AI Logs] New log received:', payload.new.id);
                        setLogs(prev => [payload.new as TrainingLog, ...prev].slice(0, 50));
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [userId]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_training_logs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLogs(data as TrainingLog[]);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getAgentIcon = (type: string) => {
        switch (type) {
            case 'extractor': return <Search className="w-3.5 h-3.5" />;
            case 'synthesizer': return <Brain className="w-3.5 h-3.5" />;
            case 'evaluator': return <CheckCircle2 className="w-3.5 h-3.5" />;
            case 'validator': return <Zap className="w-3.5 h-3.5" />;
            default: return <Database className="w-3.5 h-3.5" />;
        }
    };

    const getAgentLabel = (type: string) => {
        switch (type) {
            case 'extractor': return 'Extrator';
            case 'synthesizer': return 'Sintetizador';
            case 'evaluator': return 'Avaliador';
            case 'validator': return 'Validador';
            default: return type;
        }
    };

    if (isLoading && logs.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">Carregando atividade...</div>;
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg opacity-40">
                <Terminal className="w-10 h-10 mb-2" />
                <p className="text-sm">Nenhuma atividade registrada hoje.</p>
                <p className="text-xs">A IA registra passos aqui quando analisa conversas.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[430px] pr-4">
            <div className="space-y-3">
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={cn(
                                "border border-white/5 rounded-lg p-3 relative overflow-hidden group transition-colors",
                                log.details?.is_error ? "bg-red-500/10 border-red-500/20" : "bg-muted/30"
                            )}
                        >
                            <div className="flex items-start justify-between gap-3 relative z-10">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] h-5 gap-1.5 flex items-center pr-2",
                                                log.details?.is_error ? "bg-red-500/20 text-red-500 border-red-500/30" : "bg-primary/5"
                                            )}
                                        >
                                            {log.details?.is_error ? <AlertCircle className="w-3 h-3" /> : getAgentIcon(log.agent_type)}
                                            {getAgentLabel(log.agent_type)}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "text-xs font-medium line-clamp-2",
                                        log.details?.is_error ? "text-red-200" : "text-indigo-100"
                                    )}>
                                        {log.details?.message || log.action}
                                    </p>

                                    {log.agent_type === 'evaluator' && log.details?.metrics && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(log.details.metrics).map(([key, value]) => (
                                                <div key={key} className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                                                    <span className="text-muted-foreground capitalize mr-1">{key}:</span>
                                                    <span className="text-primary font-bold">{value}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ScrollArea>
    );
}
