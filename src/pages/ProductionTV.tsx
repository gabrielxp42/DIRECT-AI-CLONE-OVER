import React, { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, ProductionStatus } from '@/types/pedido';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Maximize2, Minimize2, Tv, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const COLUMNS: { id: ProductionStatus; title: string; color: string }[] = [
    { id: 'design', title: '🎨 Design', color: 'border-blue-500' },
    { id: 'queued', title: '📥 Fila', color: 'border-amber-500' },
    { id: 'printing', title: '🖨️ Imprimindo', color: 'border-purple-500' },
    { id: 'ready', title: '✅ Pronto', color: 'border-green-500' },
];

export default function ProductionTV() {
    const { session, profile } = useSession();
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const navigate = useNavigate();

    const fetchPedidos = async () => {
        if (!session?.user?.id) return;

        let query = supabase
            .from('pedidos')
            .select('*, clientes(nome), pedido_items(*)')
            .order('order_number', { ascending: false });

        if (profile?.organization_id) {
            query = query.eq('organization_id', profile.organization_id);
        } else {
            query = query.eq('user_id', session.user.id);
        }

        const { data } = await query;
        if (data) setPedidos(data as Pedido[]);
        setLoading(false);
    };

    useEffect(() => {
        fetchPedidos();
        const channel = supabase
            .channel('tv_production_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => fetchPedidos())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [session?.user?.id]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="fixed inset-0 bg-zinc-950 text-white z-[9999] overflow-hidden flex flex-col p-6">
            {/* Logo Watermark Background */}
            {profile?.company_logo_url && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] z-0"
                    style={{
                        backgroundImage: `url(${profile.company_logo_url})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        filter: 'grayscale(100%) brightness(200%)'
                    }}
                />
            )}

            <header className="flex justify-between items-center mb-8 z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-2 rounded-lg">
                        <Tv className="h-8 w-8 text-black" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black italic tracking-tighter">PAINEL DE PRODUÇÃO</h1>
                        <p className="text-zinc-500 font-bold uppercase text-sm tracking-widest flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Monitoramento em Tempo Real
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" className="text-zinc-500 hover:text-white" onClick={toggleFullscreen}>
                        {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                    </Button>
                    <Button variant="ghost" className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10" onClick={() => navigate('/producao')}>
                        <LogOut className="h-6 w-6" />
                        <span className="ml-2 font-bold uppercase text-xs">Sair</span>
                    </Button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-4 gap-6 overflow-hidden">
                {COLUMNS.map(col => (
                    <div key={col.id} className="flex flex-col gap-4">
                        <div className={cn("border-l-4 pl-4 py-2", col.color)}>
                            <h2 className="text-2xl font-black uppercase italic">{col.title}</h2>
                            <p className="text-zinc-500 text-sm font-bold">{pedidos.filter(p => p.production_status === col.id).length} pedidos</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-2">
                            <AnimatePresence mode="popLayout">
                                {pedidos.filter(p => p.production_status === col.id).map(pedido => (
                                    <motion.div
                                        key={pedido.id}
                                        layoutId={pedido.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-3xl font-black text-primary italic">#{pedido.order_number}</span>
                                        </div>
                                        <p className="text-xl font-bold truncate mb-4">{pedido.clientes?.nome}</p>

                                        <div className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50">
                                            <span className="text-xs font-black uppercase text-zinc-500">Metragem</span>
                                            <span className="text-3xl font-black italic text-white">{pedido.total_metros?.toFixed(1)}m</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
