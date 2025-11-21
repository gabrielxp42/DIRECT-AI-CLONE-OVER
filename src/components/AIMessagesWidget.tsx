import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, X, ChevronDown } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from '@/hooks/use-mobile';

export const AIMessagesWidget: React.FC = () => {
    const { session } = useSession();
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<string[]>([]);

    // Estado local para mensagens dispensadas
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchInsightsData = async () => {
            if (!session?.user?.id || !session?.access_token) return;

            try {
                setLoading(true);
                console.log('[AIMessagesWidget] Buscando dados para insights via FETCH DIRETO...');

                const accessToken = session.access_token;
                const headers = {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                };

                // Buscar clientes (apenas campos necessários) via fetch direto
                const clientesUrl = `${SUPABASE_URL}/rest/v1/clientes?select=id,nome,created_at&order=created_at.desc`;
                const clientesResponse = await fetch(clientesUrl, { method: 'GET', headers });

                if (!clientesResponse.ok) {
                    const errorText = await clientesResponse.text();
                    throw new Error(`Erro ao buscar clientes: ${clientesResponse.status} ${clientesResponse.statusText} - ${errorText}`);
                }

                const clientes = await clientesResponse.json();
                if (!Array.isArray(clientes)) {
                    throw new Error('Resposta inválida ao buscar clientes.');
                }

                // Buscar pedidos recentes (últimos 1000 pedidos para análise) via fetch direto
                const pedidosUrl = `${SUPABASE_URL}/rest/v1/pedidos?select=id,cliente_id,created_at,valor_total&order=created_at.desc&limit=1000`;
                const pedidosResponse = await fetch(pedidosUrl, { method: 'GET', headers });

                if (!pedidosResponse.ok) {
                    const errorText = await pedidosResponse.text();
                    throw new Error(`Erro ao buscar pedidos: ${pedidosResponse.status} ${pedidosResponse.statusText} - ${errorText}`);
                }

                const pedidos = await pedidosResponse.json();
                if (!Array.isArray(pedidos)) {
                    throw new Error('Resposta inválida ao buscar pedidos.');
                }

                if (!clientes || !pedidos) {
                    setLoading(false);
                    return;
                }

                // Gerar Insights
                const newInsights: string[] = [];
                const now = new Date();

                // 1. Clientes Inativos (> 30 dias)
                const inactiveClients = clientes.filter(cliente => {
                    const clienteOrders = pedidos.filter(p => p.cliente_id === cliente.id);
                    if (clienteOrders.length === 0) return false; // Nunca comprou não é inativo, é lead

                    const lastOrder = clienteOrders[0]; // Já está ordenado por data desc
                    const daysSince = Math.floor((now.getTime() - new Date(lastOrder.created_at).getTime()) / (86400000));
                    return daysSince > 30;
                });

                if (inactiveClients.length > 0) {
                    newInsights.push(`Opa! Percebi que **${inactiveClients[0].nome}** não compra há mais de 30 dias. Que tal entrar em contato? 📞`);
                }

                // 2. Dia de menor movimento
                const ordersByDay = Array(7).fill(0);
                pedidos.forEach(p => ordersByDay[new Date(p.created_at).getDay()]++);
                const slowestDay = ordersByDay.indexOf(Math.min(...ordersByDay));
                const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

                if (slowestDay !== -1) {
                    newInsights.push(`${days[slowestDay]}s costumam ter menos movimento. Considere uma promoção! 💡`);
                }

                // 3. Cliente VIP
                const clientCounts: Record<string, number> = {};
                pedidos.forEach(p => {
                    if (p.cliente_id) clientCounts[p.cliente_id] = (clientCounts[p.cliente_id] || 0) + 1;
                });

                const topClientId = Object.keys(clientCounts).sort((a, b) => clientCounts[b] - clientCounts[a])[0];
                if (topClientId) {
                    const topClient = clientes.find(c => c.id === topClientId);
                    const count = clientCounts[topClientId];
                    if (topClient && count > 5) {
                        newInsights.push(`${topClient.nome} é cliente VIP com ${count} pedidos! 💎`);
                    }
                }

                // 4. Resumo de Vendas (Sempre útil - Fallback 1)
                const today = new Date().toISOString().split('T')[0];
                const todaysOrders = pedidos.filter(p => p.created_at.startsWith(today));

                if (todaysOrders.length > 0) {
                    const totalHoje = todaysOrders.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
                    newInsights.push(`Hoje já tivemos **${todaysOrders.length} pedidos** totalizando **R$ ${totalHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**. 🚀`);
                } else {
                    // Se não vendeu nada hoje, sugere ação
                    newInsights.push(`Ainda não tivemos pedidos hoje. Que tal enviar uma oferta para seus clientes VIP? 🎯`);
                }

                // 5. Dicas Aleatórias (Fallback 2 - Garante que sempre tem pelo menos 2 cards se os outros falharem)
                if (newInsights.length < 2) {
                    const dicas = [
                        "💡 Dica: Manter o cadastro dos clientes atualizado ajuda na fidelização.",
                        "📊 Você sabia? Analisar os relatórios semanais pode revelar tendências de venda.",
                        "⭐ Clientes satisfeitos tendem a comprar 3x mais. Que tal pedir um feedback?",
                        "📦 Verifique se há produtos com estoque baixo para repor a tempo."
                    ];
                    // Adiciona uma dica aleatória que ainda não esteja na lista (improvável repetir, mas boa prática)
                    const dica = dicas[Math.floor(Math.random() * dicas.length)];
                    newInsights.push(dica);
                }

                setInsights(newInsights);
            } catch (error) {
                console.error('[AIMessagesWidget] Erro ao gerar insights:', error);
                // Fallback final em caso de erro
                setInsights(["Olá! Estou pronto para ajudar você a vender mais hoje. 🚀"]);
            } finally {
                setLoading(false);
            }
        };

        fetchInsightsData();
    }, [session?.user?.id, session?.access_token]);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => {
            const newSet = new Set(prev);
            newSet.add(id);
            return newSet;
        });
    };

    // Componente interno SwipeableMessage
    const SwipeableMessage = ({ insight, index, onDismiss }: { insight: string, index: number, onDismiss: () => void }) => {
        const [touchStart, setTouchStart] = React.useState<number | null>(null);
        const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
        const [isRemoved, setIsRemoved] = React.useState(false);
        const [translateX, setTranslateX] = React.useState(0);
        const minSwipeDistance = 50;

        const onTouchStart = (e: React.TouchEvent) => {
            setTouchEnd(null);
            setTouchStart(e.targetTouches[0].clientX);
        };

        const onTouchMove = (e: React.TouchEvent) => {
            setTouchEnd(e.targetTouches[0].clientX);
            if (touchStart !== null) {
                setTranslateX(e.targetTouches[0].clientX - touchStart);
            }
        };

        const onTouchEnd = () => {
            if (!touchStart || !touchEnd) {
                setTranslateX(0);
                return;
            }
            const distance = touchStart - touchEnd;
            const isLeftSwipe = distance > minSwipeDistance;
            const isRightSwipe = distance < -minSwipeDistance;

            if (isLeftSwipe || isRightSwipe) {
                setIsRemoved(true);
                setTranslateX(isLeftSwipe ? -500 : 500);
                setTimeout(onDismiss, 300);
            } else {
                setTranslateX(0);
            }
        };

        if (isRemoved) return null;

        return (
            <div
                className="relative overflow-hidden touch-pan-y group"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: touchEnd ? 'none' : 'transform 0.3s ease-out',
                    opacity: Math.max(0, 1 - Math.abs(translateX) / 300)
                }}
            >
                <Card className="p-4 border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20 pr-10 relative">
                    <p
                        className="text-sm select-none"
                        dangerouslySetInnerHTML={{
                            __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }}
                    />
                    <button
                        onClick={() => {
                            setIsRemoved(true);
                            setTimeout(onDismiss, 300);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hidden sm:block"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </Card>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-2 w-48 bg-muted rounded" />
                    </div>
                </div>
                <div className="h-20 bg-muted rounded-lg" />
            </div>
        );
    }

    const visibleInsights = insights.map((text, idx) => ({ text, id: `insight-${idx}` }))
        .filter(item => !dismissedIds.has(item.id));

    // Conteúdo das mensagens (reutilizável)
    const MessagesContent = () => (
        <div className="space-y-2">
            {visibleInsights.length > 0 ? (
                visibleInsights.map((item, index) => (
                    <SwipeableMessage
                        key={item.id}
                        index={index}
                        insight={item.text}
                        onDismiss={() => handleDismiss(item.id)}
                    />
                ))
            ) : (
                <Card className="p-4 border-dashed text-center text-muted-foreground text-sm animate-in fade-in duration-500">
                    Nenhuma nova sugestão. Bom trabalho! 👍
                </Card>
            )}
        </div>
    );

    // Mobile: Accordion colapsado
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
                                    {visibleInsights.length > 0
                                        ? `${visibleInsights.length} ${visibleInsights.length === 1 ? 'alerta' : 'alertas'}`
                                        : "Tudo limpo! ✨"}
                                </p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <MessagesContent />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }

    // Desktop: Layout normal expandido
    return (
        <div className="space-y-3 overflow-hidden">
            <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 border-2 border-primary shadow-sm">
                    <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        <Sparkles className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold">Assistente IA</p>
                    <p className="text-xs text-muted-foreground">
                        {visibleInsights.length > 0 ? "Algumas coisas que notei por aqui..." : "Tudo limpo! Você está em dia. ✨"}
                    </p>
                </div>
            </div>
            <MessagesContent />
        </div>
    );
};
