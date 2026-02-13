import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
    Navigation
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

        // Try to construct the permanent PDF URL directly using base64 format
        // SuperFrete uses: https://etiqueta.superfrete.com/_etiqueta/pdf/{base64({"order_id":"<id>"})}?format=A4
        const labelExternalId = label.external_id || label.id;
        if (labelExternalId) {
            const payload = JSON.stringify({ order_id: labelExternalId });
            const base64Payload = btoa(payload);
            const constructedUrl = `https://etiqueta.superfrete.com/_etiqueta/pdf/${base64Payload}?format=A4`;

            // Save to DB for future use
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
                                            // Here we would ideally open the logistics modal for this order
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
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-1.5 uppercase tracking-wide">
                            <Search className="h-3 w-3" /> Buscar
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold gap-1.5 uppercase tracking-wide">
                            <Filter className="h-3 w-3" /> Filtrar
                        </Button>
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
                                                    <Badge variant="outline" className="text-[9px] font-black px-1.5 h-5 bg-muted border-border">
                                                        {label.service_name || 'CORREIOS'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {label.tracking_code ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => copyToClipboard(label.tracking_code)}
                                                                className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-muted-foreground hover:text-primary bg-muted px-2 py-1 rounded-md border border-border"
                                                            >
                                                                <Copy className="h-3 w-3" />
                                                                {label.tracking_code}
                                                            </button>
                                                            <button
                                                                onClick={() => window.open(`https://rastreamento.correios.com.br/app/index.php?objeto=${label.tracking_code}`, '_blank')}
                                                                className="text-muted-foreground/60 hover:text-blue-500"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-muted-foreground/50 font-bold">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-[11px] font-black text-foreground">
                                                    {formatCurrency(label.price)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 whitespace-nowrap">
                                                        {label.status === 'released' ? 'Aguardando postagem' : label.status}
                                                    </Badge>
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
            </div>
        </div>
    );
};
