import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, MessageCircle, ExternalLink, Bot, Crown } from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useClientes, usePedidos, useInsumos } from '@/hooks/useDataFetch';
import { useToast } from "@/hooks/use-toast";
import { GabiActionDialog } from './GabiActionDialog';
import { useIsPlusMode } from '@/hooks/useIsPlusMode';

// Interface para Insights Estruturados
interface InsightAction {
    label: string;
    url?: string;
    type: 'whatsapp' | 'link' | 'action';
    directMessage?: string; // Mensagem pronta para envio direto
    actionType?: 'billing' | 'offer' | 'generic'; // Tipo da ação para estilização do dialog
    phone?: string; // Telefone formatado para envio direto (evita parsing de URL)
}

interface InsightItem {
    id: string;
    text: string;
    type: 'alert' | 'success' | 'info' | 'warning';
    action?: InsightAction;
    aiAction?: {
        message: string;
    };
}

export const AIMessagesWidget: React.FC = () => {
    const { session, supabase } = useSession();
    const [selectedAction, setSelectedAction] = useState<{ message: string, type: 'billing' | 'offer' | 'generic', customerName: string, phone: string } | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const { toast } = useToast();
    const { canSendDirectly: isPlusMode } = useIsPlusMode();

    // Importar useAIAssistant dinamicamente ou usar window event dispatch se não estiver dentro do provider
    // Como o widget está no dashboard, assumimos que está dentro do provider principal ou usaremos dispatch direto
    // Para simplificar e evitar erro de hook fora de contexto se o widget for usado isoladamente:
    const triggerAI = (msg: string) => {
        // Disparar evento global que o AIAssistant escuta
        window.dispatchEvent(new CustomEvent('trigger-ai-message', { detail: msg }));
    };
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
        // Carregar IDs descartados do localStorage (persistência de 24h)
        try {
            const stored = localStorage.getItem('direct_ai_dismissed_alerts');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, number>;
                const now = Date.now();
                const validIds = Object.entries(parsed)
                    .filter(([, timestamp]) => now - timestamp < 24 * 60 * 60 * 1000) // 24 horas
                    .map(([id]) => id);
                return new Set(validIds);
            }
        } catch (e) { console.warn('Erro ao carregar alertas descartados:', e); }
        return new Set();
    });

    // Utilizar os hooks globais (React Query)
    const { data: clientes = [], isLoading: loadingClientes } = useClientes();
    const { data: pedidos = [], isLoading: loadingPedidos } = usePedidos();
    const { data: insumos = [], isLoading: loadingInsumos } = useInsumos();

    const loading = loadingClientes || loadingPedidos || loadingInsumos;

    const insights = useMemo(() => {
        // Se ainda está carregando ou não tem usuário, retorna vazio
        if (loading || !session?.user?.id) return [];

        const newInsights: InsightItem[] = [];
        const now = new Date();

        // 📦 0. ALERTAS DE ESTOQUE (NOVO)
        if (Array.isArray(insumos)) {
            const lowStockInsumos = insumos.filter(i =>
                (i.quantidade_atual || 0) <= (i.quantidade_minima || 0)
            );

            lowStockInsumos.forEach((insumo) => {
                const pct = insumo.quantidade_minima ? (insumo.quantidade_atual / insumo.quantidade_minima) * 100 : 0;
                const isCritical = pct <= 20;

                newInsights.push({
                    id: `low-stock-${insumo.id}`,
                    type: isCritical ? 'alert' : 'warning',
                    text: isCritical
                        ? `🚨 **CRÍTICO:** O estoque de **${insumo.nome}** está acabando! Restam apenas ${insumo.quantidade_atual} ${insumo.unidade}.`
                        : `📦 O insumo **${insumo.nome}** está abaixo da meta. Saldo: ${insumo.quantidade_atual} ${insumo.unidade}.`,
                    action: {
                        label: 'Ver Estoque',
                        url: '/insumos',
                        type: 'link'
                    }
                });
            });
        }

        // 🚨 1. ALERTAS DE COBRANÇA
        if (Array.isArray(pedidos)) {
            const pedidosPendentes = pedidos.filter((p: any) =>
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

            // Comportamento original: 1 card por cliente (humanizado)
            // Mostra até 3 clientes individualmente para manter o toque pessoal
            const clientesDevedores = Object.values(clientesComPendencias) as any[];
            clientesDevedores
                .sort((a: any, b: any) => b.dias - a.dias)
                .slice(0, 3) // Limite de 3 alertas individuais
                .forEach((cliente: any, idx) => {
                    if (cliente.dias >= 3) {
                        const isUrgent = cliente.dias >= 7;
                        let phone = cliente.telefone?.replace(/\D/g, '');
                        // Garantir formato 55...
                        if (phone && phone.length >= 10 && !phone.startsWith('55')) {
                            phone = `55${phone}`;
                        }

                        const message = `Olá ${cliente.nome}, tudo bem? Vi que o pedido #${cliente.orderNumber} (R$ ${cliente.valor.toFixed(2)}) ainda está pendente. Podemos ajudar com algo?`;
                        const whatsappLink = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : undefined;

                        newInsights.push({
                            id: `billing-${idx}`,
                            type: isUrgent ? 'alert' : 'warning',
                            text: isUrgent
                                ? `🚨 **${cliente.nome}** está há **${cliente.dias} dias** sem pagar o pedido #${cliente.orderNumber} (R$ ${cliente.valor.toFixed(2)})!`
                                : `⚠️ **${cliente.nome}** tem pedido #${cliente.orderNumber} pendente há ${cliente.dias} dias.`,
                            action: whatsappLink ? {
                                label: 'Cobrar agora',
                                url: whatsappLink,
                                type: 'action', // Alterado para action
                                directMessage: message, // Prepara envio direto
                                actionType: 'billing',
                                phone: phone // Passando telefone limpo e formatado diretamente
                            } : undefined,
                            // Dados extras para ação da IA (MANTIDO para compatibilidade, mas a ação principal agora é o botão direto)
                            aiAction: {
                                message: `Use a ferramenta 'send_whatsapp_message' para enviar uma mensagem de cobrança amigável para o cliente ${cliente.nome} (Telefone: ${cliente.telefone || 'Desconhecido'}) referente ao pedido #${cliente.orderNumber} no valor de R$ ${cliente.valor.toFixed(2)}. Diga que estamos aguardando o pagamento. NÃO altere o status do pedido. Apenas envie a mensagem.`
                            }
                        });
                    }
                });
        }

        // 💰 2. OPORTUNIDADES DE VENDA
        if (Array.isArray(clientes) && Array.isArray(pedidos)) {
            const vipsInativos = clientes.filter((c: any) => {
                const userOrders = pedidos.filter((p: any) => p.cliente_id === c.id);
                if (userOrders.length < 5) return false;

                const daysSince = Math.floor((now.getTime() - new Date(userOrders[0].created_at).getTime()) / 86400000);
                return daysSince >= 15 && daysSince <= 45;
            });

            if (vipsInativos.length > 0) {
                const vip = vipsInativos[0];
                let phone = vip.telefone?.replace(/\D/g, '');
                if (phone && phone.length >= 10 && !phone.startsWith('55')) {
                    phone = `55${phone}`;
                }

                const message = `Olá ${vip.nome}! Sentimos sua falta. Que tal aproveitar nossas ofertas da semana?`;

                newInsights.push({
                    id: 'vip-inactive',
                    type: 'info',
                    text: `💎 **${vip.nome}** é cliente VIP mas não compra há dias. Ofereça um desconto!`,
                    action: phone ? {
                        label: 'Enviar Oferta',
                        url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
                        type: 'action',
                        directMessage: message,
                        actionType: 'offer',
                        phone: phone
                    } : undefined,
                    aiAction: {
                        message: `Use a ferramenta 'send_whatsapp_message' para enviar uma oferta especial para o cliente VIP ${vip.nome} (Telefone: ${vip.telefone || 'Desconhecido'}) que não compra há dias. Ofereça um desconto atrativo e diga que sentimos falta dele! NÃO altere status de nenhum pedido.`
                    }
                });
            }
        }

        // 📈 3. TENDÊNCIAS
        if (Array.isArray(pedidos)) {
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
            } else if (now.getHours() >= 16 && now.getDay() >= 1 && now.getDay() <= 5) {
                // Alerta de "sem vendas" só aparece após 16h em dias úteis (Seg-Sex)
                newInsights.push({
                    id: 'no-sales',
                    type: 'warning', // Rebaixado de 'alert' para 'warning' (menos agressivo)
                    text: `⚠️ Ainda **não tivemos vendas hoje**. Envie uma oferta relâmpago! ⚡`
                });
            }
        }

        // Fallback
        if (newInsights.length === 0) {
            newInsights.push({
                id: 'fallback',
                type: 'info',
                text: "✨ Tudo tranquilo! Aproveite para organizar o estoque ou planejar a semana."
            });
        }

        // Ordenação de prioridade: Alertas de estoque > Outros alertas > Warnings > Info > Success
        return newInsights.sort((a, b) => {
            const priorityMap = { 'alert': 0, 'warning': 1, 'info': 2, 'success': 3 };

            // Prioridade especial para estoque se ambos forem alertas
            if (a.type === b.type && a.type === 'alert') {
                const aIsStock = a.id.startsWith('low-stock');
                const bIsStock = b.id.startsWith('low-stock');
                if (aIsStock && !bIsStock) return -1;
                if (!aIsStock && bIsStock) return 1;
            }

            return (priorityMap[a.type as keyof typeof priorityMap] ?? 99) -
                (priorityMap[b.type as keyof typeof priorityMap] ?? 99);
        });
    }, [clientes, pedidos, insumos, loading, session?.user?.id]);

    const handleActionClickMain = (e: React.MouseEvent, item: InsightItem) => {
        e.stopPropagation();
        if (item.action?.type === 'action' && item.action.directMessage) {
            // Extrair nome do cliente
            let customerName = "Cliente";
            const nameMatch = item.text.match(/\*\*(.*?)\*\*/);
            if (nameMatch) customerName = nameMatch[1];

            // Tentar usar o telefone formatado direto do objeto de ação
            let phone = item.action.phone || "";

            // Fallback: Extrair telefone do URL se não houver no objeto (legado/outros casos)
            if (!phone) {
                if (item.action.url && item.action.url.includes('phone=')) {
                    phone = item.action.url.split('phone=')[1]?.split('&')[0];
                } else if (item.action.url && item.action.url.includes('wa.me/')) {
                    phone = item.action.url.split('wa.me/')[1]?.split('?')[0];
                }
            }

            console.log("Gabi Action Clicked:", { customerName, phone, message: item.action.directMessage });

            setSelectedAction({
                message: item.action.directMessage,
                type: item.action.actionType || 'generic',
                customerName: customerName,
                phone: phone
            });
        } else if (item.action?.type === 'whatsapp') {
            window.open(item.action.url, '_blank');
        } else if (item.action?.url) {
            navigate(item.action.url);
        }
    };

    const handleConfirmActionMain = async () => {
        if (!selectedAction) return;
        setIsActionLoading(true);

        try {
            // Chamada à Edge Function whatsapp-proxy
            const { data, error } = await supabase.functions.invoke('whatsapp-proxy', {
                body: {
                    action: 'send-text',
                    phone: selectedAction.phone,
                    message: selectedAction.message
                }
            });

            if (error) throw error;
            if (!data || !data.success) throw new Error(data?.message || 'Erro ao enviar mensagem');

            toast({
                title: "Sucesso! 🚀",
                description: `Mensagem enviada para ${selectedAction.customerName}.`,
                duration: 3000,
                className: "bg-green-500 text-white border-0"
            });

            setSelectedAction(null);
        } catch (err: any) {
            console.error('Erro no envio:', err);
            toast({
                title: "Erro no envio ❌",
                description: "Não foi possível enviar automaticamente. Abrindo WhatsApp Web...",
                variant: "destructive",
            });
            // Fallback
            setSelectedAction(null);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => {
            const newSet = new Set(prev).add(id);
            // Salvar no localStorage com timestamp
            try {
                const stored = localStorage.getItem('direct_ai_dismissed_alerts');
                const parsed = stored ? JSON.parse(stored) : {};
                parsed[id] = Date.now();
                // Limpar entradas antigas (> 24h) para não poluir o storage
                const now = Date.now();
                const cleaned = Object.fromEntries(
                    Object.entries(parsed).filter(([, ts]) => now - (ts as number) < 24 * 60 * 60 * 1000)
                );
                localStorage.setItem('direct_ai_dismissed_alerts', JSON.stringify(cleaned));
            } catch (e) { console.warn('Erro ao salvar alerta descartado:', e); }
            return newSet;
        });
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

        return (
            <AnimatePresence>
                {!isRemoving && (
                    <motion.div
                        drag={isMobile ? "x" : false}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.15}
                        onDragStart={(event, info) => {
                            // Cancelar drag se clicar em botão ou elemento interativo
                            const target = (event as any).target as HTMLElement;
                            if (target.closest('button') || target.closest('[role="button"]') || target.closest('.cursor-pointer')) {
                                return false;
                            }
                        }}
                        onDragEnd={handleDragEnd}
                        initial={{ opacity: 0, x: -30, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.9 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30
                        }}
                        className="relative mb-2"
                    >
                        <Card className={`p-4 border-l-4 pr-8 relative ${getStyles(item.type)} transition-shadow hover:shadow-md`}>
                            <div className="flex flex-col gap-3">
                                <p className="text-sm select-none" dangerouslySetInnerHTML={{
                                    __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }} />

                                <div className="flex gap-2 flex-wrap items-center mt-1">
                                    {item.action && item.action.type !== 'action' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs gap-2 bg-background/50 hover:bg-background border-zinc-200 dark:border-zinc-800"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Previne que o clique dispare o drag ou outros eventos do pai
                                                if (item.action?.type === 'whatsapp') {
                                                    window.open(item.action.url, '_blank');
                                                } else if (item.action?.url) {
                                                    navigate(item.action.url);
                                                }
                                            }}
                                        >
                                            {item.action.type === 'whatsapp' && <MessageCircle className="h-3.5 w-3.5 text-green-500" />}
                                            {item.action.label}
                                            <ExternalLink className="h-3 w-3 opacity-50" />
                                        </Button>
                                    )}

                                    {/* Botão AI Action - Condicional baseado no Plus Mode */}
                                    {item.aiAction && (
                                        isPlusMode ? (
                                            /* PLUS MODE: Botão Gabi Premium - Abre Dialog */
                                            <div className="relative group rounded-lg p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-sm hover:shadow-md transition-all cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    if (item.action?.type === 'action') {
                                                        handleActionClickMain(e, item);
                                                    } else {
                                                        triggerAI(item.aiAction!.message);
                                                    }
                                                }}>
                                                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-sm rounded-lg group-hover:opacity-40 transition-opacity" />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="relative h-8 text-xs gap-2 bg-slate-950/90 text-white hover:bg-slate-900 border-0 hover:text-white w-full"
                                                >
                                                    <Sparkles className="h-3.5 w-3.5 text-[#ffd93d]" />
                                                    {item.action?.actionType === 'offer' ? "DEIXAR A GABI OFERECER O DESCONTO ⚡" : "DEIXAR A GABI COBRAR 👊🏽"}
                                                </Button>
                                            </div>
                                        ) : (
                                            /* NORMAL MODE: Botão WhatsApp Verde - Abre Link */
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs gap-2 bg-[#25D366] hover:bg-[#20BA5C] text-white border-0 shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (item.action?.url) {
                                                        window.open(item.action.url, '_blank');
                                                    }
                                                }}
                                            >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                                {item.action?.actionType === 'offer' ? "Enviar Oferta" : "Enviar Cobrança"}
                                                <ExternalLink className="h-3 w-3 opacity-70" />
                                            </Button>
                                        )
                                    )}
                                </div>
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
                )
                }
            </AnimatePresence >
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
            {/* Renderizar o Dialog na raiz do Widget para garantir que não seja afetado pelo overflow ou layout dos cards */}
            {selectedAction && (
                <GabiActionDialog
                    isOpen={!!selectedAction}
                    onOpenChange={(open) => !open && setSelectedAction(null)}
                    customerName={selectedAction.customerName}
                    messagePreview={selectedAction.message}
                    phone={selectedAction.phone}
                    onConfirm={handleConfirmActionMain}
                    isLoading={isActionLoading}
                    actionType={selectedAction.type}
                />
            )}
        </div>
    );
};
