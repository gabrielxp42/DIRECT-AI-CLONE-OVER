import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, TrendingDown, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
import { useClientes, usePedidos } from '@/hooks/useDataFetch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Insight {
    type: 'warning' | 'success' | 'info' | 'suggestion';
    message: string;
    icon: React.ElementType;
}

export const AIInsightsCard: React.FC = () => {
    const { data: clientes, isLoading: loadingClientes } = useClientes();
    const { data: pedidos, isLoading: loadingPedidos } = usePedidos();
    const [insights, setInsights] = useState<Insight[]>([]);

    useEffect(() => {
        if (!clientes || !pedidos) return;

        const generatedInsights: Insight[] = [];
        const now = new Date();

        // Insight 1: Clientes inativos há muito tempo
        const inactiveClients = clientes.filter(cliente => {
            const clienteOrders = pedidos.filter(p => p.cliente_id === cliente.id);
            if (clienteOrders.length === 0) return false;

            const lastOrder = clienteOrders.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            const daysSinceLastOrder = Math.floor(
                (now.getTime() - new Date(lastOrder.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );

            return daysSinceLastOrder > 30;
        });

        if (inactiveClients.length > 0) {
            const topInactive = inactiveClients[0];
            generatedInsights.push({
                type: 'warning',
                message: `O cliente **${topInactive.nome}** não compra há mais de 30 dias. Que tal entrar em contato?`,
                icon: AlertCircle
            });
        }

        // Insight 2: Dia da semana com menos movimento
        const ordersByDayOfWeek = Array(7).fill(0);
        pedidos.forEach(pedido => {
            const day = new Date(pedido.created_at).getDay();
            ordersByDayOfWeek[day]++;
        });

        const slowestDay = ordersByDayOfWeek.indexOf(Math.min(...ordersByDayOfWeek));
        const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

        if (slowestDay !== -1 && ordersByDayOfWeek[slowestDay] < ordersByDayOfWeek.reduce((a, b) => a + b, 0) / 7) {
            generatedInsights.push({
                type: 'suggestion',
                message: `${daysOfWeek[slowestDay]}s costumam ter menos movimento. Considere uma promoção estratégica!`,
                icon: TrendingDown
            });
        }

        // Insight 3: Cliente com maior potencial (muitos pedidos)
        const clientesPedidoCount = clientes.map(cliente => ({
            cliente,
            count: pedidos.filter(p => p.cliente_id === cliente.id).length,
            total: pedidos.filter(p => p.cliente_id === cliente.id).reduce((sum, p) => sum + p.valor_total, 0)
        })).sort((a, b) => b.total - a.total);

        if (clientesPedidoCount.length > 0 && clientesPedidoCount[0].count > 5) {
            generatedInsights.push({
                type: 'success',
                message: `**${clientesPedidoCount[0].cliente.nome}** é um cliente VIP com ${clientesPedidoCount[0].count} pedidos! 💎`,
                icon: TrendingUp
            });
        }

        // Limitar a 3 insights
        setInsights(generatedInsights.slice(0, 3));
    }, [clientes, pedidos]);

    if (loadingClientes || loadingPedidos) {
        return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5" />
                        <Skeleton className="h-6 w-40" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (insights.length === 0) {
        return null; // Não mostrar o card se não houver insights
    }

    return (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                    Insights da IA
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {insights.map((insight, index) => {
                    const Icon = insight.icon;
                    const colorMap = {
                        warning: 'text-orange-600 bg-orange-50 border-orange-200',
                        success: 'text-green-600 bg-green-50 border-green-200',
                        info: 'text-blue-600 bg-blue-50 border-blue-200',
                        suggestion: 'text-purple-600 bg-purple-50 border-purple-200'
                    };

                    return (
                        <div
                            key={index}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${colorMap[insight.type]} transition-all hover:scale-[1.02]`}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <p
                                className="text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: insight.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }}
                            />
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
};
