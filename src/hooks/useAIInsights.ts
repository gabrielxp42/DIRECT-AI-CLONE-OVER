import { useMemo, useState } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { useClientes, usePedidos, useInsumos } from '@/hooks/useDataFetch';

export interface InsightAction {
    label: string;
    url?: string;
    type: 'whatsapp' | 'link' | 'action';
    directMessage?: string;
    actionType?: 'billing' | 'offer' | 'generic';
    phone?: string;
}

export interface InsightItem {
    id: string;
    text: string;
    type: 'alert' | 'success' | 'info' | 'warning';
    action?: InsightAction;
    aiAction?: {
        message: string;
    };
}

export const useAIInsights = () => {
    const { session } = useSession();
    const { data: clientes = [], isLoading: loadingClientes } = useClientes();
    const { data: pedidos = [], isLoading: loadingPedidos } = usePedidos();
    const { data: insumos = [], isLoading: loadingInsumos } = useInsumos();

    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem('direct_ai_dismissed_alerts');
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, number>;
                const now = Date.now();
                const validIds = Object.entries(parsed)
                    .filter(([, timestamp]) => now - timestamp < 24 * 60 * 60 * 1000)
                    .map(([id]) => id);
                return new Set(validIds);
            }
        } catch (e) { console.warn('Erro ao carregar alertas descartados:', e); }
        return new Set();
    });

    const isLoading = loadingClientes || loadingPedidos || loadingInsumos;

    const insights = useMemo(() => {
        if (isLoading || !session?.user?.id) return [];

        const newInsights: InsightItem[] = [];
        const now = new Date();

        // 📦 0. ALERTAS DE ESTOQUE
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

            const clientesDevedores = Object.values(clientesComPendencias) as any[];
            clientesDevedores
                .sort((a: any, b: any) => b.dias - a.dias)
                .slice(0, 3)
                .forEach((cliente: any, idx) => {
                    if (cliente.dias >= 3) {
                        const isUrgent = cliente.dias >= 7;
                        let phone = cliente.telefone?.replace(/\D/g, '');
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
                                type: 'action',
                                directMessage: message,
                                actionType: 'billing',
                                phone: phone
                            } : undefined,
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
                newInsights.push({
                    id: 'no-sales',
                    type: 'warning',
                    text: `⚠️ Ainda **não tivemos vendas hoje**. Envie uma oferta relâmpago! ⚡`
                });
            }
        }

        if (newInsights.length === 0) {
            newInsights.push({
                id: 'fallback',
                type: 'info',
                text: "✨ Tudo tranquilo! Aproveite para organizar o estoque ou planejar a semana."
            });
        }

        return newInsights.sort((a, b) => {
            const priorityMap = { 'alert': 0, 'warning': 1, 'info': 2, 'success': 3 };
            if (a.type === b.type && a.type === 'alert') {
                const aIsStock = a.id.startsWith('low-stock');
                const bIsStock = b.id.startsWith('low-stock');
                if (aIsStock && !bIsStock) return -1;
                if (!aIsStock && bIsStock) return 1;
            }
            return (priorityMap[a.type as keyof typeof priorityMap] ?? 99) -
                (priorityMap[b.type as keyof typeof priorityMap] ?? 99);
        });
    }, [clientes, pedidos, insumos, isLoading, session?.user?.id]);

    const visibleInsights = useMemo(() =>
        insights.filter(item => !dismissedIds.has(item.id))
        , [insights, dismissedIds]);

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => {
            const newSet = new Set(prev).add(id);
            try {
                const stored = localStorage.getItem('direct_ai_dismissed_alerts');
                const parsed = stored ? JSON.parse(stored) : {};
                parsed[id] = Date.now();
                const now = Date.now();
                const cleaned = Object.fromEntries(
                    Object.entries(parsed).filter(([, ts]) => now - (ts as number) < 24 * 60 * 60 * 1000)
                );
                localStorage.setItem('direct_ai_dismissed_alerts', JSON.stringify(cleaned));
            } catch (e) { console.warn('Erro ao salvar alerta descartado:', e); }
            return newSet;
        });
    };

    return {
        insights,
        visibleInsights,
        isLoading,
        handleDismiss
    };
};
