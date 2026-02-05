import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BookOpen, Tag, MessageSquare, AlertTriangle, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface KnowledgeEntry {
    id: string;
    knowledge_type: 'business_rule' | 'client_profile' | 'tone' | 'product' | 'faq' | 'exception';
    content: any;
    confidence: number;
    source_count: number;
    created_at: string;
    is_active: boolean;
}

interface AIKnowledgeViewerProps {
    userId: string;
}

export function AIKnowledgeViewer({ userId }: AIKnowledgeViewerProps) {
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        if (userId) {
            fetchKnowledge();
        }
    }, [userId]);

    const fetchKnowledge = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_knowledge_base')
                .select('*')
                .eq('user_id', userId)
                .order('confidence', { ascending: false });

            if (error) throw error;
            setEntries(data as KnowledgeEntry[]);
        } catch (error) {
            console.error('Error fetching knowledge:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'business_rule': return <BookOpen className="w-4 h-4 text-blue-500" />;
            case 'tone': return <MessageSquare className="w-4 h-4 text-purple-500" />;
            case 'product': return <Tag className="w-4 h-4 text-green-500" />;
            case 'exception': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            default: return <BookOpen className="w-4 h-4" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'business_rule': return 'Regra de Negócio';
            case 'tone': return 'Tom de Voz';
            case 'client_profile': return 'Perfil de Cliente';
            case 'product': return 'Produto/Serviço';
            case 'faq': return 'FAQ';
            case 'exception': return 'Exceção';
            default: return type;
        }
    };

    const deleteEntry = async (id: string) => {
        try {
            const { error } = await supabase
                .from('ai_knowledge_base')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setEntries(entries.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting knowledge:', error);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('ai_knowledge_base')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setEntries(entries.map(e =>
                e.id === id ? { ...e, is_active: !currentStatus } : e
            ));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const filteredEntries = filter === 'all'
        ? entries
        : entries.filter(e => e.knowledge_type === filter);

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum conhecimento extraído ainda.</p>
                <p className="text-sm">O agente precisa analisar mais conversas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                    {entries.length} padrões identificados
                </h3>
                <Tabs value={filter} onValueChange={setFilter} className="w-auto">
                    <TabsList className="h-8">
                        <TabsTrigger value="all" className="text-xs">Tudo</TabsTrigger>
                        <TabsTrigger value="business_rule" className="text-xs">Regras</TabsTrigger>
                        <TabsTrigger value="tone" className="text-xs">Tom</TabsTrigger>
                        <TabsTrigger value="product" className="text-xs">Produtos</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <ScrollArea className="h-[430px] pr-4">
                <div className="space-y-3">
                    <AnimatePresence>
                        {filteredEntries.map((entry) => (
                            <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                            >
                                <Card className={`border overflow-hidden bg-card/40 backdrop-blur-sm ${!entry.is_active ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="p-4 flex gap-4">
                                        <div className="mt-1 flex-shrink-0">
                                            {getTypeIcon(entry.knowledge_type)}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-primary/5">
                                                        {getTypeLabel(entry.knowledge_type)}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                                        {(entry.confidence * 100).toFixed(0)}% confiança
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => toggleStatus(entry.id, entry.is_active)}
                                                        className={`p-1.5 rounded-lg transition-all ${entry.is_active
                                                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                                            : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                                            }`}
                                                        title={entry.is_active ? "Desativar regra" : "Ativar regra"}
                                                    >
                                                        <Check className={`w-3.5 h-3.5 ${!entry.is_active ? 'opacity-30' : ''}`} />
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            if (confirm('Tem certeza que deseja excluir este padrão de conhecimento permanentemente?')) {
                                                                deleteEntry(entry.id);
                                                            }
                                                        }}
                                                        className="p-1.5 rounded-lg transition-all bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                                        title="Excluir permanentemente"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-sm bg-black/20 p-3 rounded-lg font-mono text-xs overflow-hidden border border-white/5">
                                                <pre className="whitespace-pre-wrap break-words text-indigo-200/90 leading-relaxed">
                                                    {JSON.stringify(entry.content, null, 2)}
                                                </pre>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3 text-primary/60" />
                                                        <span className="font-semibold text-primary/80">{entry.source_count}</span>
                                                        <span>fontes de dados</span>
                                                    </div>
                                                </div>
                                                <div className="tabular-nums">
                                                    {new Date(entry.created_at).toLocaleDateString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </ScrollArea>
        </div>
    );
}
