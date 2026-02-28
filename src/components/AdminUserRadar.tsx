import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, MousePointerClick, RefreshCw, ScrollText, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type PageViewLog = {
    id: string;
    created_at: string;
    message: string;
    details: any;
    user_id: string;
    profile?: { company_name: string; email: string };
};

export function AdminUserRadar() {
    const [events, setEvents] = useState<PageViewLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchActivity = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('id, created_at, message, details, user_id, profile:profiles(company_name, email)')
                .eq('category', 'page_view')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setEvents(data as unknown as PageViewLog[]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchActivity();

        const channel = supabase
            .channel('radar-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'system_logs',
                    filter: "category=eq.page_view"
                },
                (payload) => {
                    // Fetch completely to get profile relation, or mock it with old data if possible
                    fetchActivity();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const formatTimeAgo = (dateStr: string) => {
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `${diffMins}m atrás`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        return `${Math.floor(diffHours / 24)}d atrás`;
    };

    const getPathName = (path: string) => {
        if (!path || path === '/') return 'Dashboard Inicial';
        if (path.includes('dashboard')) return 'Dashboard';
        if (path.includes('pedidos')) return 'Gestão de Pedidos';
        if (path.includes('clientes')) return 'Carteira de Clientes';
        if (path.includes('produtos')) return 'Catálogo de Produtos';
        if (path.includes('insumos')) return 'Estoque e Insumos';
        if (path.includes('financeiro')) return 'Financeiro';
        if (path.includes('gabi')) return 'Configurações Gabi AI';
        if (path.includes('settings')) return 'Ajustes da Conta';
        return path;
    };

    return (
        <Card className="shadow-2xl rounded-[2rem] overflow-hidden border-none bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
            <CardHeader className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                            <div className="relative">
                                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                    <Eye size={24} />
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                </span>
                            </div>
                            Radar de Clientes
                        </CardTitle>
                        <CardDescription className="text-sm font-medium mt-1">
                            Acompanhe em tempo real a navegação e o foco de uso dos seus clientes.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading && events.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground">
                        <MousePointerClick className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-bold italic">Nenhum rastro de atividade detectado ainda.</p>
                    </div>
                ) : (
                    <div className="max-h-[600px] overflow-y-auto w-full p-4 space-y-3">
                        <AnimatePresence>
                            {events.map((event) => {
                                const profile = Array.isArray(event.profile) ? event.profile[0] : event.profile;
                                return (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black">
                                                {profile?.company_name?.substring(0, 2).toUpperCase() || 'US'}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black italic uppercase text-sm leading-tight text-foreground">
                                                    {profile?.company_name || 'Desconhecido'}
                                                </span>
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    {profile?.email || 'Sem e-mail'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end hidden sm:flex">
                                                <Badge variant="outline" className="text-[10px] bg-indigo-50 font-bold border-indigo-200 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
                                                    {getPathName(event.details?.path)}
                                                </Badge>
                                            </div>
                                            <div className="text-[10px] font-black tracking-widest uppercase text-muted-foreground min-w-[70px] text-right">
                                                {formatTimeAgo(event.created_at)}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
