import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, X, ChevronRight, MessageCircle, ExternalLink } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

// Interface para Insights Estruturados
interface InsightAction {
    label: string;
    url?: string;
    type: 'whatsapp' | 'link' | 'action';
}

interface InsightItem {
    id: string;
    text: string;
    type: 'alert' | 'success' | 'info' | 'warning';
    action?: InsightAction;
}

export const AIMessagesWidget: React.FC = () => {
    const { session } = useSession();
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<InsightItem[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchInsightsData = async () => {
            if (!session?.user?.id) return;

            try {
                setLoading(true);
                const accessToken = await getValidToken();
                if (!accessToken) return;

                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                };

                // Buscar dados necessários
                const [clientesRes, pedidosRes, pedidosStatusRes] = await Promise.all([
                    fetch(`${SUPABASE_URL}/rest/v1/clientes?select=id,nome,telefone,created_at&order=created_at.desc`, { headers }),
                    fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=id,cliente_id,created_at,valor_total&order=created_at.desc&limit=1000`, { headers }),
                    fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=id,cliente_id,created_at,valor_total,status,order_number,clientes(nome,telefone)&order=created_at.desc&limit=1000`, { headers })
                ]);

                if (!clientesRes.ok || !pedidosRes.ok || !pedidosStatusRes.ok) throw new Error('Erro ao buscar dados');

                const clientes = await clientesRes.json();
                const pedidos = await pedidosRes.json();
                const pedidosComStatus = await pedidosStatusRes.json();

                const newInsights: InsightItem[] = [];
                const now = new Date();

                // 🚨 1. ALERTAS DE COBRANÇA
                const pedidosPendentes = pedidosComStatus.filter((p: any) =>
                    p.status === 'pendente' || p.status === 'processando'
                );

                const clientesComPendencias: Record<string, any> = {};
                pedidosPendentes.forEach((p: any) => {
                    if (!p.cliente_id || !p.clientes?.nome) return;
                    const diasPendente = Math.floor((now.getTime() - new Date(p.created_at).getTime()) / 86400000);

                    if (!clientesComPendencias[p.cliente_id] || diasPendente > clientesComPendencias[p.cliente_id].dias) {
                        clientesComPendencias[p.cliente_id] = {
                            ...p.clientes,
                            dias: diasPendente,
                            valor: p.valor_total,
                            orderNumber: p.order_number
                        };
                    }
                });

                Object.values(clientesComPendencias)
                    .sort((a: any, b: any) => b.dias - a.dias)
                    .slice(0, 2)
                    .forEach((cliente: any, idx) => {
                        if (cliente.dias >= 3) {
                            const isUrgent = cliente.dias >= 7;
                            const phone = cliente.telefone?.replace(/\D/g, '');
                            const message = `Olá ${cliente.nome}, tudo bem? Vi que o pedido #${cliente.orderNumber} (R$ ${cliente.valor.toFixed(2)}) ainda está pendente. Podemos ajudar com algo?`;
                            const whatsappLink = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}` : undefined;

                            newInsights.push({
                                id: `billing-${idx}`,
                                type: isUrgent ? 'alert' : 'warning',
                                text: isUrgent
                                    ? `🚨 **${cliente.nome}** está há **${cliente.dias} dias** sem pagar o pedido #${cliente.orderNumber} (R$ ${cliente.valor.toFixed(2)})!`
                                    : `⚠️ **${cliente.nome}** tem pedido #${cliente.orderNumber} pendente há ${cliente.dias} dias.`,
                                action: whatsappLink ? {
                                    label: 'Cobrar no WhatsApp',
                                    url: whatsappLink,
                                    type: 'whatsapp'
                                } : undefined
                            });
                        }
                    });

                // 💰 2. OPORTUNIDADES DE VENDA
                const clientesVIP = clientes.filter((c: any) =>
                    pedidos.filter((p: any) => p.cliente_id === c.id).length >= 5
                );

                const vipsInativos = clientesVIP.filter((c: any) => {
                    const orders = pedidos.filter((p: any) => p.cliente_id === c.id);
                    if (!orders.length) return false;
                    const daysSince = Math.floor((now.getTime() - new Date(orders[0].created_at).getTime()) / 86400000);
                    return daysSince >= 15 && daysSince <= 45;
                });

                if (vipsInativos.length > 0) {
                    const vip = vipsInativos[0];
                    const phone = vip.telefone?.replace(/\D/g, '');
                    const message = `Olá ${vip.nome}! Sentimos sua falta. Que tal aproveitar nossas ofertas da semana?`;

                    newInsights.push({
                        id: 'vip-inactive',
                        type: 'info',
                        text: `💎 **${vip.nome}** é cliente VIP mas não compra há dias. Ofereça um desconto!`,
                        action: phone ? {
                            label: 'Enviar Oferta',
                            url: `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`,
                            type: 'whatsapp'
                        } : undefined
                    });
                }

                // 📈 3. TENDÊNCIAS
                const last7Days = pedidos.filter((p: any) => (now.getTime() - new Date(p.created_at).getTime()) / 86400000 <= 7);
                const prev7Days = pedidos.filter((p: any) => {
                    const days = (now.getTime() - new Date(p.created_at).getTime()) / 86400000;
                    return days > 7 && days <= 14;
                });

                if (last7Days.length > 0 && prev7Days.length > 0) {
                    const currTotal = last7Days.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
                    const prevTotal = prev7Days.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
                    const growth = ((currTotal - prevTotal) / prevTotal) * 100;

                    if (Math.abs(growth) > 20) {
                        newInsights.push({
                            id: 'trend',
                            type: growth > 0 ? 'success' : 'warning',
                            text: growth > 0
                                ? `📈 Vendas **cresceram ${growth.toFixed(0)}%** essa semana! Continue assim! 🚀`
                                : `📉 Vendas **caíram ${Math.abs(growth).toFixed(0)}%** essa semana. Hora de uma promoção?`
                        });
                    }
                }

                // 📊 4. RESUMO DO DIA
                const todayStr = now.toISOString().split('T')[0];
                const todaysOrders = pedidos.filter((p: any) => p.created_at.startsWith(todayStr));

                if (todaysOrders.length > 0) {
                    const total = todaysOrders.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
                    newInsights.push({
                        id: 'daily-summary',
                        type: 'success',
                        text: `📊 Hoje: **${todaysOrders.length} pedidos** totalizando **R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**! 🎉`
                    });
                } else if (now.getHours() >= 14 && now.getDay() >= 1 && now.getDay() <= 5) {
                    newInsights.push({
                        id: 'no-sales',
                        type: 'alert',
                        text: `⚠️ Ainda **não tivemos vendas hoje**. Envie uma oferta relâmpago! ⚡`
                    });
                }

                // Fallback
                if (newInsights.length === 0) {
                    newInsights.push({
                        id: 'fallback',
                        type: 'info',
                        text: "✨ Tudo tranquilo! Aproveite para organizar o estoque ou planejar a semana."
                    });
                }

                setInsights(newInsights);
            } catch (error) {
                console.error('Erro ao gerar insights:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInsightsData();
    }, [session?.user?.id]);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => new Set(prev).add(id));
    };

    const SwipeableMessage = ({ item, onDismiss }: { item: InsightItem, onDismiss: () => void }) => {
        const [isRemoving, setIsRemoving] = useState(false);

        const getStyles = (type: string) => {
            switch (type) {
                case 'alert': return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
                case 'warning': return 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20';
                case 'success': return 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20';
                default: return 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20';
            }
        };

        const handleDismissClick = () => {
            setIsRemoving(true);
            setTimeout(onDismiss, 400);
        };

        const handleDragEnd = (event: any, info: any) => {
            const threshold = 120;
            const velocity = Math.abs(info.velocity.x);

            // Se arrastou mais de 120px OU teve velocidade alta (swipe rápido)
            if (Math.abs(info.offset.x) > threshold || velocity > 500) {
                setIsRemoving(true);
                setTimeout(onDismiss, 400);
            }
        };

        if (isRemoving) {
            return (
                <motion.div
                    initial={{ opacity: 1, scale: 1, height: 'auto' }}
                    animate={{
                        opacity: 0,
                        scale: 0.8,
                        height: 0,
                        marginBottom: 0
                    }}
                    transition={{
                        duration: 0.4,
                        ease: [0.4, 0, 0.2, 1] // Cubic bezier para suavidade
                    }}
                >
                    <Card className={`p-4 border-l-4 pr-8 relative ${getStyles(item.type)}`}>
                        <div className="flex flex-col gap-3">
                            <p className="text-sm select-none" dangerouslySetInnerHTML={{
                                __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }} />
                        </div>
                    </Card>
                </motion.div>
            );
        }

        return (
            <motion.div
                drag={isMobile ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, x: -30, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30
                }}
                whileDrag={{
                    scale: 1.02,
                    rotate: 0,
                    cursor: 'grabbing'
                }}
                className="relative mb-2"
            >
                <Card className={`p-4 border-l-4 pr-8 relative ${getStyles(item.type)} transition-shadow hover:shadow-md`}>
                    <div className="flex flex-col gap-3">
                        <p className="text-sm select-none" dangerouslySetInnerHTML={{
                            __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }} />

                        {item.action && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-fit h-8 text-xs gap-2 bg-background/50 hover:bg-background"
                                onClick={() => window.open(item.action?.url, '_blank')}
                            >
                                {item.action.type === 'whatsapp' && <MessageCircle className="h-3 w-3 text-green-500" />}
                                {item.action.label}
                                <ExternalLink className="h-3 w-3 opacity-50" />
                            </Button>
                        )}
                    </div>

                    <motion.button
                        onClick={handleDismissClick}
                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </motion.button>
                </Card>
            </motion.div>
        );
    };

    if (loading) return <div className="h-20 bg-muted rounded-lg animate-pulse" />;

    const visibleInsights = insights.filter(item => !dismissedIds.has(item.id));

    const Content = () => (
        <div className="space-y-2">
            {visibleInsights.length > 0 ? (
                visibleInsights.map((item) => (
                    <SwipeableMessage
                        key={item.id}
                        item={item}
                        onDismiss={() => handleDismiss(item.id)}
                    />
                ))
            ) : (
                <Card className="p-4 border-dashed text-center text-muted-foreground text-sm">
                    Tudo limpo! Bom trabalho! 👍
                </Card>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="ai-insights" className="border rounded-lg">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8 border-2 border-primary shadow-sm">
                                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                                    <Sparkles className="h-4 w-4" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-semibold">Assistente IA</p>
                                <p className="text-xs text-muted-foreground">
                                    {visibleInsights.length > 0 ? `${visibleInsights.length} alertas` : "Tudo limpo! ✨"}
                                </p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <Content />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border-2 border-primary shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold">Assistente IA</p>
                    <p className="text-xs text-muted-foreground">
                        {visibleInsights.length > 0 ? "Algumas coisas que notei..." : "Tudo limpo! ✨"}
                    </p>
                </div>
            </div>
            <Content />
        </div>
    );
};
