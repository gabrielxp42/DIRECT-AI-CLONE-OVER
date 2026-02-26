import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Truck,
    Clock,
    CheckCircle2,
    Download,
    ExternalLink,
    Search,
    Filter,
    Package,
    AlertCircle,
    Copy,
    Navigation,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionProvider';

interface ShippingLabel {
    id: string;
    external_id: string;
    status: string;
    pdf_url: string;
    price: number;
    tracking_code: string;
    origin_zip: string;
    destination_zip: string;
    recipient_name: string;
    service_name: string;
    created_at: string;
    pedido_id: string;
    provider?: string;
}

interface PendingOrderLabel {
    id: string;
    order_number: number;
    shipping_label_id: string;
    shipping_label_status: string;
    valor_frete: number;
    cliente_nome: string;
    created_at: string;
}

export const LogisticsOverview: React.FC = () => {
    const { session } = useSession();
    const userId = session?.user?.id;
    const queryClient = useQueryClient();
    const [localTrackingUpdates, setLocalTrackingUpdates] = React.useState<Record<string, string>>({});
    const [isAutoSyncing, setIsAutoSyncing] = React.useState(false);
    const syncQueueRef = React.useRef<Set<string>>(new Set());
    const isSyncingRef = React.useRef(false);
    const lastSyncAttemptRef = React.useRef<Record<string, number>>({}); // Timestamp do último sync por label

    const { data: labels, isLoading: loadingLabels, refetch: refetchLabels } = useQuery({
        queryKey: ['shipping_labels_all', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('shipping_labels')
                .select('*, pedidos(order_number, clientes(nome))')
                .eq('user_id', userId!)
                .order('created_at', { ascending: false });
            if (error) throw error;
            // Map to flatten the client name as fallback for recipient_name
            return (data || []).map((label: any) => ({
                ...label,
                recipient_name: label.recipient_name || label.pedidos?.clientes?.nome || null,
            })) as ShippingLabel[];
        },
        enabled: !!userId
    });

    const { data: pendingOrders, isLoading: loadingPending } = useQuery({
        queryKey: ['pending_labels_orders', userId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pedidos')
                .select('id, order_number, shipping_label_id, shipping_label_status, valor_frete, clientes(nome), created_at')
                .eq('user_id', userId)
                .eq('shipping_label_status', 'pending');

            if (error) {
                console.error("Erro ao buscar pedidos pendentes:", error);
                throw error;
            }

            return (data || []).map((p: any) => ({
                id: p.id,
                order_number: p.order_number,
                shipping_label_id: p.shipping_label_id,
                shipping_label_status: p.shipping_label_status,
                valor_frete: p.valor_frete,
                cliente_nome: p.clientes?.nome || 'Cliente não identificado',
                created_at: p.created_at
            })) as PendingOrderLabel[];
        },
        enabled: !!userId
    });

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Código copiado!");
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const handleDownloadLabel = async (label: ShippingLabel) => {
        if (label.pdf_url) {
            window.open(label.pdf_url, '_blank');
            return;
        }

        if (label.provider === 'frenet') {
            // For Frenet, we try to refresh tracking to get the URL if it's not present
            toast.info("Buscando link da etiqueta Frenet...");
            await handleRefreshTracking(label);
            return;
        }

        const labelExternalId = label.external_id || label.id;
        if (labelExternalId) {
            const payload = JSON.stringify({ order_id: labelExternalId });
            const base64Payload = btoa(payload);
            const constructedUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;

            supabase
                .from('shipping_labels')
                .update({ pdf_url: constructedUrl })
                .eq('id', label.id)
                .then(() => console.log("PDF URL salva no banco"));

            window.open(constructedUrl, '_blank');
            return;
        }

        toast.error("ID da etiqueta não encontrado.");
    };

    const handleRefreshTracking = async (label: ShippingLabel, isBackground: boolean = false) => {
        const loadingToast = !isBackground ? toast.loading(`Sincronizando rastreio: ${label.recipient_name}...`) : null;
        try {
            const token = await getValidToken();
            const provider = label.provider || 'superfrete';
            const functionName = provider === 'frenet' ? 'frenet-proxy' : 'superfrete-proxy';

            console.log(`[LogisticsOverview] Refreshing tracking for provider: ${provider}, Label ID: ${label.id}, External ID: ${label.external_id}`);
            const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'tracking',
                    params: {
                        id: label.id,
                        order_id: label.external_id,
                        orders: [label.external_id],
                        tracking_num: label.tracking_code,
                        service_code: label.service_name
                    }
                })
            });

            let data;
            let responseText = "";
            try {
                responseText = await response.text();
                data = JSON.parse(responseText);
            } catch (e) {
                // FALLBACK NO FRONTEND: Se a Edge Function não deployada mandou HTML/Erro
                console.log("Edge Function retornou formato inválido. Tentando extração manual do HTML no Frontend...");
                const correiosMatch = responseText.match(/([A-Z]{2}\d{9}[A-Z]{2})/i);
                const adiMatch = responseText.match(/(ADI\d{8,12}[A-Z]{0,2})/i);
                const foundTracking = correiosMatch?.[0] || adiMatch?.[0];

                if (foundTracking) {
                    data = {
                        success: true,
                        tracking_code: foundTracking.toUpperCase(),
                        message: "Extraído via fallback do Frontend"
                    };
                } else {
                    const snippet = responseText.substring(0, 50) + "...";
                    const cleanerError = responseText.includes('<!DOCTYPE html>') ? "Erro interno do servidor (HTML)" : snippet;
                    throw new Error(`A API do parceiro ainda não retornou o rastreio. Detalhes: ${cleanerError}`);
                }
            }

            if (data.error || data.message?.includes('[object Object]')) {
                const errorMsg = typeof data.message === 'object' ? JSON.stringify(data.message) : (data.message || "Erro desconhecido");
                throw new Error(errorMsg);
            }
            if (data.tracking_code) {
                // Atualizar etiqueta com rastreio, status e PDF permanente
                const updateData: any = {
                    tracking_code: data.tracking_code,
                    status: data.status || 'released' // Persistir o status real retornado pela API
                };
                if (data.url || data.pdf) updateData.pdf_url = data.url || data.pdf;

                const { error: labelError } = await supabase
                    .from('shipping_labels')
                    .update(updateData)
                    .eq('id', label.id);

                if (labelError) {
                    console.error("Erro ao atualizar shipping_labels:", labelError);
                    throw new Error(`Erro ao salvar no banco: ${labelError.message}`);
                }

                // Atualizar pedido se vinculado
                if (label.pedido_id) {
                    const { error: pedidoError } = await supabase
                        .from('pedidos')
                        .update({
                            tracking_code: data.tracking_code,
                            shipping_label_status: data.status || 'released' // Também manter o status do pedido sincronizado
                        })
                        .eq('id', label.pedido_id);

                    if (pedidoError) console.warn("Aviso: Falha ao atualizar o pedido vinculado:", pedidoError);
                }

                // ATUALIZAÇÃO INSTANTÂNEA PARA O USUÁRIO
                setLocalTrackingUpdates(prev => ({
                    ...prev,
                    [label.id]: data.tracking_code
                }));

                if (!isBackground) {
                    toast.success(`Rastreio atualizado: ${data.tracking_code}`, {
                        id: loadingToast!,
                        description: data.message === "Extraído via fallback de texto" || data.message === "Extraído via fallback do Frontend" ? "Código recuperado com sucesso!" : "Informações sincronizadas com sucesso."
                    });
                }

                // Forçar invalidação agressiva do cache
                await queryClient.invalidateQueries({ queryKey: ['shipping_labels_all'] });
                await queryClient.invalidateQueries({ queryKey: ['pending_labels_orders'] });
                await refetchLabels();
                await refetchLabels();
            } else {
                console.log("Debug Logística:", data);
                if (!isBackground) {
                    toast.error(data.error || "Não foi possível obter o rastreio.", { id: loadingToast! });
                }
            }
        } catch (error: any) {
            console.error("Erro ao sincronizar:", error);
            if (!isBackground) {
                toast.error(error.message || "Erro na conexão", { id: loadingToast! });
            }
        }
    };

    // Escutar por mudanças em tempo real (Realtime)
    React.useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('logistics_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'shipping_labels',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('📦 Mudança detectada em Logistics (Realtime):', payload);
                    // Invalidação imediata do cache para refletir mudanças do Robô de Sync ou outros usuários
                    queryClient.invalidateQueries({ queryKey: ['shipping_labels_all'] });
                    toast.info("Status atualizado em tempo real", {
                        description: "Uma etiqueta foi atualizada pelo sistema de sincronização."
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, queryClient]);

    // Robô de Sincronização Automática (Agressivo)
    React.useEffect(() => {
        if (!labels || labels.length === 0 || isAutoSyncing || isSyncingRef.current) return;

        // Limpar o cache de sincronização a cada 30 minutos
        const interval = 1000 * 60 * 30;
        const lastClear = (window as any)._lastSyncClear || 0;
        if (Date.now() - lastClear > interval) {
            console.log("🔄 [Logistics] Limpando fila de sync para nova rodada automática...");
            syncQueueRef.current.clear();
            (window as any)._lastSyncClear = Date.now();
        }

        const now = Date.now();
        const labelsToSync = labels.filter(label => {
            const hasNoTracking = !label.tracking_code || label.tracking_code.startsWith('ADI');
            const inQueue = syncQueueRef.current.has(label.id);
            const lastAttempt = lastSyncAttemptRef.current[label.id] || 0;
            const isCooldownOver = now - lastAttempt > 1000 * 60 * 2; // 2 minutos de cooldown

            return hasNoTracking && !inQueue && isCooldownOver;
        }).slice(0, 5); // Tentar 5 por vez

        if (labelsToSync.length > 0) {
            const runAutoSync = async () => {
                if (isSyncingRef.current) return;
                isSyncingRef.current = true;
                setIsAutoSyncing(true);

                console.log(`🤖 [Logistics] Robô iniciando sincronização de ${labelsToSync.length} etiquetas...`);

                try {
                    for (const label of labelsToSync) {
                        syncQueueRef.current.add(label.id);
                        lastSyncAttemptRef.current[label.id] = Date.now();
                        await handleRefreshTracking(label, true);
                        // Pausa entre chamadas para evitar Rate Limit
                        await new Promise(r => setTimeout(r, 1500));
                    }
                } catch (error) {
                    console.error("Erro no robô de sincronização:", error);
                } finally {
                    setIsAutoSyncing(false);
                    isSyncingRef.current = false;
                }
            };

            runAutoSync();
        }

        return () => { };
    }, [labels, isAutoSyncing, queryClient]);

    return (
        <div className="space-y-6">
            {/* Etiquetas Pendentes de Pagamento */}
            {pendingOrders && pendingOrders.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2 text-amber-500">
                        <Clock className="h-4 w-4" />
                        Reservas Pendentes ({pendingOrders.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingOrders.map((order) => (
                            <Card key={order.id} className="border-amber-500/30 bg-amber-500/5 overflow-hidden">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-bold text-amber-600 uppercase">PEDIDO {order.order_number}</p>
                                            <p className="text-xs font-bold truncate max-w-[150px]">{order.cliente_nome}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px] font-black uppercase">
                                            Aguardando Pagamento
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                        <Truck className="h-4 w-4 text-amber-500" />
                                        <div className="flex-1">
                                            <p className="text-[10px] text-amber-600 font-bold leading-none">ID RESERVA</p>
                                            <p className="text-[11px] font-mono font-bold truncate">{order.shipping_label_id}</p>
                                        </div>
                                        <p className="text-sm font-black text-amber-500">{formatCurrency(order.valor_frete)}</p>
                                    </div>
                                    <Button
                                        className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-9 gap-2"
                                        onClick={() => {
                                            toast.info(`Acesse o Pedido ${order.order_number} para finalizar o pagamento.`);
                                        }}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Finalizar no Pedido
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Histórico de Etiquetas Emitidas */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        Histórico de Etiquetas
                    </h3>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary gap-2 h-9 text-[10px] font-bold uppercase tracking-wide"
                            onClick={async () => {
                                if (isAutoSyncing) return;
                                const labelsToSync = labels?.filter(l => !l.tracking_code || l.tracking_code.startsWith('ADI')) || [];
                                if (labelsToSync.length === 0) {
                                    toast.info("Tudo pronto!", { description: "Todas as etiquetas já estão sincronizadas." });
                                    return;
                                }
                                setIsAutoSyncing(true);
                                const t = toast.loading(`Sincronizando ${labelsToSync.length} etiquetas...`);
                                let count = 0;
                                try {
                                    for (const l of labelsToSync) {
                                        await handleRefreshTracking(l, true);
                                        count++;
                                        toast.loading(`Sincronizando ${count}/${labelsToSync.length}...`, { id: t });
                                        await new Promise(r => setTimeout(r, 1000));
                                    }
                                    toast.success("Sincronização concluída!", { id: t });
                                } catch (error) {
                                    toast.error("Erro durante a sincronização em lote", { id: t });
                                } finally {
                                    setIsAutoSyncing(false);
                                    queryClient.invalidateQueries({ queryKey: ['shipping_labels_all'] });
                                }
                            }}
                            disabled={isAutoSyncing}
                        >
                            <RefreshCw className={`h-4 w-4 ${isAutoSyncing ? 'animate-spin' : ''}`} />
                            {isAutoSyncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
                        </Button>
                        <div className="flex bg-muted p-1 rounded-xl shadow-inner border border-border/50">
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-1.5 uppercase tracking-wide border-none bg-transparent hover:bg-white/50">
                                <Search className="h-3 w-3" /> Buscar
                            </Button>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-1.5 uppercase tracking-wide border-none bg-transparent hover:bg-white/50">
                                <Filter className="h-3 w-3" /> Filtrar
                            </Button>
                        </div>
                    </div>
                </div>

                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0">
                        {loadingLabels ? (
                            <div className="p-12 text-center text-muted-foreground">Carregando etiquetas...</div>
                        ) : labels && labels.length > 0 ? (
                            <div className="rounded-2xl border border-border/50 overflow-hidden bg-card">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border">
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Destinatário</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Tipo</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Rastreio</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Valor</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider">Data</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-secondary-foreground/60 tracking-wider text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {labels.map((label) => (
                                            <tr key={label.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-primary hover:underline cursor-pointer">
                                                            {label.recipient_name || <span className="text-muted-foreground/50 not-italic">Sem destinatário</span>}
                                                        </span>
                                                        <span className="text-[9px] font-medium text-muted-foreground uppercase mt-0.5">
                                                            ID: {label.external_id}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant="outline" className="text-[9px] font-black px-1.5 h-5 bg-muted border-border whitespace-nowrap">
                                                            {label.service_name || 'CORREIOS'}
                                                        </Badge>
                                                        {label.provider && (
                                                            <div className="flex items-center gap-1">
                                                                <img
                                                                    src={label.provider === 'frenet' ? "/logo - fre net.png" : "/logo - superfrete.png"}
                                                                    alt={label.provider}
                                                                    className="h-3 w-3 object-contain opacity-70"
                                                                />
                                                                <span className="text-[8px] font-bold text-muted-foreground uppercase">{label.provider}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 min-w-[200px]">
                                                    {(() => {
                                                        const displayTracking = localTrackingUpdates[label.id] || label.tracking_code;

                                                        if (displayTracking) {
                                                            return (
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                                                        <button
                                                                            onClick={() => copyToClipboard(displayTracking)}
                                                                            className="flex items-center gap-2 text-[10px] font-mono font-black text-secondary-foreground hover:text-primary bg-muted px-2.5 py-1.5 rounded-lg border border-border transition-all flex-1 shadow-sm min-w-0"
                                                                            title="Copiar código"
                                                                        >
                                                                            <Copy className="h-3 w-3 flex-shrink-0" />
                                                                            <span className="truncate">{displayTracking}</span>
                                                                        </button>

                                                                        <div className="flex items-center p-0.5 bg-muted border border-border rounded-lg shadow-sm flex-shrink-0">
                                                                            <button
                                                                                onClick={() => handleRefreshTracking(label)}
                                                                                className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-background"
                                                                                title={`Sincronizar com ${label.provider === 'frenet' ? 'Frenet' : 'SuperFrete'}`}
                                                                            >
                                                                                <Navigation className="h-3.5 w-3.5" />
                                                                            </button>
                                                                            <div className="w-[1px] h-3 bg-border mx-0.5" />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const trackingUrl = label.provider === 'frenet'
                                                                                        ? `https://rastreamento.correios.com.br/app/index.php?objeto=${displayTracking}`
                                                                                        : `https://rastreamento.correios.com.br/app/index.php?objeto=${displayTracking}`;
                                                                                    window.open(trackingUrl, '_blank');
                                                                                }}
                                                                                className="p-1.5 text-muted-foreground hover:text-blue-500 transition-colors rounded-md hover:bg-background"
                                                                                title="Rastrear nos Correios"
                                                                            >
                                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {displayTracking.startsWith('ADI') && (
                                                                        <div className="flex items-center gap-1.5 px-1">
                                                                            <div className="relative flex h-1.5 w-1.5">
                                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                                                                            </div>
                                                                            <span className="text-[9px] text-blue-600 font-black uppercase tracking-tight">Cód. Temporário? Sincronize</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-muted-foreground/50 font-bold">-</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                                                                    onClick={() => handleRefreshTracking(label)}
                                                                    title="Buscar Rastreio"
                                                                >
                                                                    <Navigation className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-4 text-[11px] font-black text-foreground">
                                                    {formatCurrency(label.price)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {(() => {
                                                        const status = label.status?.toLowerCase() || '';
                                                        let badgeConfig = {
                                                            label: label.status || 'Pendente',
                                                            className: "bg-slate-500/15 text-slate-400 border-slate-500/30"
                                                        };

                                                        if (status === 'released' || status.includes('aguardando') || status.includes('liberada')) {
                                                            badgeConfig = {
                                                                label: 'Aguardando postagem',
                                                                className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                                            };
                                                        } else if (status.includes('postado') || status.includes('trânsito') || status.includes('transito') || status.includes('encaminhado') || status.includes('entregue em')) {
                                                            badgeConfig = {
                                                                label: 'Em Trânsito',
                                                                className: "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                                            };
                                                        } else if (status.includes('entregue') || status.includes('destinatário') || status === 'delivered' || status.includes('concluido') || status.includes('concluído')) {
                                                            badgeConfig = {
                                                                label: 'Entregue',
                                                                className: "bg-purple-500/15 text-purple-400 border-purple-500/30"
                                                            };
                                                        } else if (status.includes('cancelado') || status.includes('estornado') || status === 'cancelled') {
                                                            badgeConfig = {
                                                                label: 'Cancelado',
                                                                className: "bg-red-500/15 text-red-400 border-red-500/30"
                                                            };
                                                        }

                                                        return (
                                                            <Badge className={`${badgeConfig.className} text-[9px] font-bold px-2 py-0.5 whitespace-nowrap`}>
                                                                {badgeConfig.label}
                                                            </Badge>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="text-[10px] font-medium text-muted-foreground">
                                                        {new Date(label.created_at).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRefreshTracking(label);
                                                            }}
                                                            title="Sincronizar Rastreio"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                                                            onClick={() => handleDownloadLabel(label)}
                                                            title="Baixar Etiqueta"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10"
                                                            onClick={() => toast.info("Função de cancelamento em breve")}
                                                            title="Excluir"
                                                        >
                                                            <AlertCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/30">
                                <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                                    <Package className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-tight">Nenhuma etiqueta emitida</h4>
                                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto mt-1">
                                    Comece a gerar fretes na seção acima para ver seu histórico aqui.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div >
        </div >
    );
};
