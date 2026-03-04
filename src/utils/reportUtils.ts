import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getValidToken } from "@/utils/tokenGuard";
import { DateRange } from "react-day-picker";

// Types
export interface SalesReport {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    totalProducts: number;
    averageOrderValue: number;
    topProducts: Array<{ nome: string; totalSold: number; revenue: number; }>;
    topCustomers: Array<{ nome: string; totalOrders: number; totalSpent: number; }>;
    recentOrders: Array<{ id: string; cliente_nome: string; valor_total: number; status: string; created_at: string; }>;
    monthlyGrowth: { revenue: number; orders: number; customers: number; profit: number; };
    totalProfit: number;
    estimatedProfit: number;
    profitMargin: number;
    targetProfitMargin: number;
    servicesReport: {
        totalServicesRevenue: number;
        totalServicesCount: number;
        averageServiceValue: number;
        servicesByPeriod: Array<{ period: string; revenue: number; count: number; }>;
        topServices: Array<{ nome: string; totalRevenue: number; totalCount: number; averageValue: number; }>;
        servicosDetalhados: Array<{
            id: string; nome: string; quantidade: number; valor_unitario: number; valor_total: number;
            pedido_id: string; cliente_nome: string; data_pedido: string; status_pedido: string;
            observacoes_pedido?: string; order_date: string; total_value: number;
        }>;
    };
    metersReport: {
        totalMeters: number;
        totalsByType: Record<string, number>;
        revenueByType: Record<string, number>;
        metersByPeriod: Array<{ period: string; meters: number;[key: string]: string | number; }>;
    };
    revenueByPeriod: Array<{ period: string; revenue: number; }>;
    financialReport: {
        byStatus: Array<{ status: string; count: number; value: number; }>;
        totalPaid: number;
        totalPending: number;
        totalCancelled: number;
    };
    groupingType?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export const calculatePeriodDates = (period: string, customRange?: DateRange, specificYear?: string) => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;

    // Use specific year if provided for 'year' or any relative logic if needed
    const targetYear = specificYear ? parseInt(specificYear) : now.getFullYear();

    if (customRange?.from && customRange?.to) {
        periodStart = customRange.from;
        periodEnd = customRange.to;
        // Set end of day for the end date if it's at 00:00:00
        if (periodEnd.getHours() === 0 && periodEnd.getMinutes() === 0) {
            periodEnd.setHours(23, 59, 59, 999);
        }
    } else {
        switch (period) {
            case "today":
                periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case "week":
                const dayOfWeek = now.getDay();
                const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                periodStart = new Date(now);
                periodStart.setDate(now.getDate() - daysToSubtract);
                periodStart.setHours(0, 0, 0, 0);
                break;
            case "month":
                periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case "year":
                periodStart = new Date(targetYear, 0, 1);
                periodEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
                // If target year is current year, cap at now? Or full year?
                if (targetYear === now.getFullYear()) {
                    periodEnd = now;
                }
                break;
            default: // Default to month
                periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        // For non-custom, non-year periods, end is now
        if (period !== 'year' && !customRange) {
            periodEnd = now;
        }
    }
    return { start: periodStart, end: periodEnd };
};

// Helper to fetch all rows handling pagination automatically
const doFetch = async (endpoint: string, params: URLSearchParams, token: string, fetchAll = false) => {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(fetchAll ? { 'Prefer': 'count=exact' } : {})
    };

    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    // If not needing all data, just do standard single fetch
    if (!fetchAll) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
        const res = await fetch(url, { method: 'GET', headers });
        if (!res.ok) throw new Error(`Fetch error ${endpoint}: ${res.statusText}`);
        return res.json();
    }

    // Loop for pagination
    while (hasMore) {
        // Set Range header: e.g. 0-999, 1000-1999
        const rangeStart = page * pageSize;
        const rangeEnd = rangeStart + pageSize - 1;
        const fetchHeaders = { ...headers, 'Range': `${rangeStart}-${rangeEnd}` };

        const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
        const res = await fetch(url, { method: 'GET', headers: fetchHeaders });

        if (!res.ok) throw new Error(`Fetch error ${endpoint} (page ${page}): ${res.statusText}`);

        const data = await res.json();
        allData = allData.concat(data);

        // Check content-range to see if we reached the end
        const contentRange = res.headers.get('content-range'); // e.g., "0-999/2500"
        if (contentRange) {
            const totalSize = parseInt(contentRange.split('/')[1] || '0', 10);
            if (allData.length >= totalSize || data.length < pageSize) {
                hasMore = false;
            }
        } else {
            // Fallback if no content-range provided (unlikely with Supabase but safe)
            if (data.length < pageSize) hasMore = false;
        }
        page++;
    }
    return allData;
};

const doCount = async (endpoint: string, token: string, userId?: string) => {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Range': '0-0'
    };

    let url = `${SUPABASE_URL}/rest/v1/${endpoint}?select=id&limit=1`;
    if (userId) {
        url += `&user_id=eq.${userId}`;
    }
    // We need to pass Prefer: count=exact
    const countHeaders = { ...headers, 'Prefer': 'count=exact' };
    const res = await fetch(url, { method: 'GET', headers: countHeaders });
    if (!res.ok) throw new Error(`Count error ${endpoint}`);

    const contentRange = res.headers.get('content-range');
    if (contentRange) {
        // Format is usually "0-0/100" or "*/100"
        const parts = contentRange.split('/');
        return parts.length > 1 ? parseInt(parts[1], 10) : 0;
    }
    return 0;
}

export const fetchReportData = async (
    accessToken: string,
    selectedPeriod: string,
    customRange?: DateRange,
    chartView: 'summary' | 'daily' = 'daily',
    specificYear?: string,
    userId?: string,
    organizationId?: string | null
): Promise<SalesReport> => {
    const validToken = await getValidToken();
    const effectiveToken = validToken || accessToken;

    if (!effectiveToken) throw new Error("Sem token de acesso válido para fetch.");

    const { start: periodStart, end: periodEnd } = calculatePeriodDates(selectedPeriod, customRange, specificYear);
    const now = new Date();

    // 1. Data Fetching (Parallelized where possible)

    // Growth Data Dates
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [
        periodOrders,
        currentMonthOrdersStats,
        previousMonthStats,
        totalCustomersCount,
        totalProductsCount,
        insumos,
        profileData
    ] = await Promise.all([
        // Main Orders: Enable fetchAll (pagination) and server-side filtering for both start and end dates
        doFetch('pedidos', (() => {
            const params = new URLSearchParams({
                select: '*,clientes(nome),pedido_items(*,produtos(nome,insumo_id,consumo_insumo)),pedido_servicos(*),pedido_status_history(*)',
                created_at: `gte.${periodStart.toISOString()}`,
            });
            if (userId) params.append('user_id', `eq.${userId}`);
            return params;
        })(), effectiveToken, true).then(data => {
            return data.filter((d: any) => new Date(d.created_at) <= periodEnd);
        }),

        // Current Month Stats (for growth)
        doFetch('pedidos', (() => {
            const params = new URLSearchParams({
                select: 'valor_total,id',
                created_at: `gte.${currentMonthStart.toISOString()}`
            });
            if (userId) params.append('user_id', `eq.${userId}`);
            return params;
        })(), effectiveToken, true),

        // Previous Month Stats (for growth)
        Promise.all([
            doFetch('pedidos', (() => {
                const params = new URLSearchParams({
                    select: 'valor_total,id',
                    created_at: `gte.${previousMonthStart.toISOString()}`,
                });
                if (userId) params.append('user_id', `eq.${userId}`);
                return params;
            })(), effectiveToken, true).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd)),

            doFetch('clientes', (() => {
                const params = new URLSearchParams({
                    select: 'id',
                    created_at: `gte.${previousMonthStart.toISOString()}`
                });
                if (userId) params.append('user_id', `eq.${userId}`);
                return params;
            })(), effectiveToken, true).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd))
        ]),

        // Total Counts (Optimized)
        doCount('clientes', effectiveToken, userId),
        doCount('produtos', effectiveToken, userId),

        // Insumos for cost
        // Insumos for cost
        doFetch('insumos', (() => {
            const params = new URLSearchParams({ select: 'id,custo_unitario' });
            if (userId) params.append('user_id', `eq.${userId}`);
            return params;
        })(), effectiveToken),

        // 6. User Profile for target profit margin
        doFetch('profiles', (() => {
            const params = new URLSearchParams({ select: 'target_profit_margin' });
            if (userId) params.append('id', `eq.${userId}`);
            return params;
        })(), effectiveToken)
    ]);

    const [previousMonthOrders, previousMonthCustomers] = previousMonthStats;

    // 2. Process Insumos Cost
    const insumoCostMap = new Map<string, number>();
    insumos.forEach((insumo: any) => insumoCostMap.set(insumo.id, insumo.custo_unitario));

    const calculateOrderCost = (order: any) => {
        let orderCost = 0;
        if (order.pedido_items) {
            order.pedido_items.forEach((item: any) => {
                // Product info is now joined in pedido_items.produtos
                const produto = item.produtos;
                if (produto && produto.insumo_id && produto.consumo_insumo) {
                    const custoInsumo = insumoCostMap.get(produto.insumo_id) || 0;
                    orderCost += (custoInsumo * produto.consumo_insumo * item.quantidade);
                }
            });
        }
        return orderCost;
    };

    // 3. Aggregate Metrics
    // We can do single pass over periodOrders for most things
    let totalRevenue = 0;
    let totalCost = 0;
    let totalMeters = 0;

    const productSales = new Map<string, { totalSold: number, revenue: number }>();
    const customerSpending = new Map<string, { totalOrders: number, totalSpent: number }>();
    const financialStats = new Map<string, { count: number, value: number, status: string }>();
    const totalsByType: Record<string, number> = {};
    const revenueByType: Record<string, number> = {};
    const allServices: any[] = [];

    periodOrders.forEach((order: any) => {
        const createdDate = new Date(order.created_at);
        const paidDate = order.pago_at ? new Date(order.pago_at) : null;

        const createdInRange = createdDate >= periodStart && createdDate <= periodEnd;
        const paidInRange = paidDate && paidDate >= periodStart && paidDate <= periodEnd;

        // Totals based on creation (Revenue logic matching Dashboard)
        // UM PEDIDO É CONSIDERADO PAGO SE:
        // 1. Tem data de pagamento (pago_at) E não está cancelado
        // O status visual (pago, entregue, aguardando retirada) não importa tanto quanto a existência da data de pagamento.
        const isPaid = order.pago_at !== null && order.status !== 'cancelado';

        // 1. COMPONENT BREAKDOWN (DEMAND) - All Orders (Requested by user for backlog visibility)
        if (order.pedido_items) {
            order.pedido_items.forEach((item: any) => {
                const tipoRaw = (item.tipo || 'dtf').toLowerCase().trim();
                const tipo = tipoRaw === '' ? 'outro' : tipoRaw;

                totalsByType[tipo] = (totalsByType[tipo] || 0) + (Number(item.quantidade) || 0);
                revenueByType[tipo] = (revenueByType[tipo] || 0) + (Number(item.quantidade) * Number(item.preco_unitario || 0));
            });
        }

        if (order.pedido_items) {
            order.pedido_items.forEach((item: any) => {
                const tipoRaw = (item.tipo || 'dtf').toLowerCase().trim();
                // Filter for Linear Meters (Roll only) - Production should count regardless of payment
                const isRoll = ['dtf', 'vinil', 'adesivo'].some(t => tipoRaw.includes(t)) && !tipoRaw.includes('varejo');
                if (isRoll && order.status !== 'cancelado') {
                    totalMeters += (Number(item.quantidade) || 0);
                }

                // Product Sales aggregation (stats) - Also useful for production volume
                let productName = item.produtos?.nome || item.produto_nome || (item.tipo && item.tipo !== 'dtf' ? item.tipo : null) || 'Produto não encontrado';

                if (productName) {
                    const lowerName = productName.toLowerCase().trim();
                    if (lowerName.includes('prensa') || lowerName.includes('prensada')) {
                        productName = 'Prensa / Prensada';
                    }
                    // Normalization hook
                    productName = productName.charAt(0).toUpperCase() + productName.slice(1);
                }

                const existingProd = productSales.get(productName) || { totalSold: 0, revenue: 0 };
                productSales.set(productName, {
                    totalSold: existingProd.totalSold + item.quantidade,
                    revenue: existingProd.revenue + (item.quantidade * item.preco_unitario)
                });
            });
        }

        if (isPaid) {
            // Cálculo robusto do faturamento "limpo" (sem frete)
            const subtotal = (order.subtotal_produtos || 0) + (order.subtotal_servicos || 0);
            const dPerc = subtotal * ((order.desconto_percentual || 0) / 100);
            const faturamentoLimpo = Math.max(0, subtotal - (order.desconto_valor || 0) - dPerc);
            totalRevenue += faturamentoLimpo;

            totalCost += calculateOrderCost(order);


            // Customer Spending (only for PAID)
            const customerName = order.clientes?.nome || 'Cliente Anônimo';
            const existingCust = customerSpending.get(customerName) || { totalOrders: 0, totalSpent: 0 };
            customerSpending.set(customerName, {
                totalOrders: existingCust.totalOrders + 1,
                totalSpent: existingCust.totalSpent + (order.valor_total || 0)
            });

            // Financial Report (status snapshot for orders in period)
            if (createdInRange) {
                const status = order.status || 'desconhecido';
                const existingFin = financialStats.get(status) || { count: 0, value: 0, status };

                // Valor para o Snapshot Financeiro (também sem frete por padrão nos relatórios)
                const subtotal = (order.subtotal_produtos || 0) + (order.subtotal_servicos || 0);
                const dPerc = subtotal * ((order.desconto_percentual || 0) / 100);
                const valorTotalCalculado = Math.max(0, subtotal - (order.desconto_valor || 0) - dPerc);

                financialStats.set(status, {
                    count: existingFin.count + 1,
                    value: existingFin.value + valorTotalCalculado,
                    status
                });
            }

            // Services (Inclusão baseada em persistência de pagamento)
            if (isPaid) {
                if (order.pedido_servicos) {
                    order.pedido_servicos.forEach((servico: any) => {
                        allServices.push({
                            ...servico,
                            pedido_id: order.id,
                            cliente_nome: order.clientes?.nome || 'Cliente Anônimo',
                            data_pedido: order.created_at,
                            status_pedido: order.status,
                            total_value: servico.quantidade * servico.valor_unitario,
                            // Flag para consistência com o Dashboard
                            pago_no_periodo: true
                        });
                    });
                }
            }
        }
    });

    const userTargetMargin = (profileData && profileData[0]?.target_profit_margin !== undefined)
        ? profileData[0].target_profit_margin
        : 0.3; // Default 30%

    // Lucro Estimado baseado na margem que o usuário definiu (útil quando não há custos cadastrados)
    const estimatedProfit = totalRevenue * userTargetMargin;
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalOrders = periodOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 4. Derived Lists (Top 5s)
    const topProducts = Array.from(productSales.entries())
        .map(([nome, data]) => ({ nome, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    const topCustomers = Array.from(customerSpending.entries())
        .map(([nome, data]) => ({ nome, ...data }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

    const recentOrders = periodOrders.slice(0, 10).map((order: any) => ({
        id: order.id,
        cliente_nome: order.clientes?.nome || 'Cliente não encontrado',
        valor_total: order.valor_total,
        status: order.status,
        created_at: order.created_at
    }));

    // 5. Growth Calculation
    const currentRevenue = currentMonthOrdersStats.reduce((sum: number, o: any) => {
        const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
        const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
        return sum + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
    }, 0);
    const previousRevenue = previousMonthOrders.reduce((sum: number, o: any) => {
        const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
        const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
        return sum + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
    }, 0);

    // Note: Customers Growth is approximated by new customers added in period
    // We actually need "Active Customers" (who bought something), not "New Customers Added".
    // The original code calculated "New Customers" (created_at).
    // We will stick to the original logic: New Customers Created.
    // But we need to fetch that separately as 'periodOrders' filters by order date.
    // Let's rely on the previous fetch for that, but we currently only fetched `previousMonthCustomers`.
    // We need `currentMonthCustomers` count.
    const currentMonthCustomers = await doCount('clientes', effectiveToken); // This is total ALl Time count, strictly speaking.
    // Actually, to display "Growth of New Customers", we need count of customers created THIS month vs LAST month.
    // The original code did: `currentMonthCustomers` (created this month).
    const currentMonthNewCustomersCount = await doFetch('clientes', (() => {
        const params = new URLSearchParams({
            select: 'id',
            created_at: `gte.${currentMonthStart.toISOString()}`
        });
        if (userId) params.append('user_id', `eq.${userId}`);
        return params;
    })(), effectiveToken).then(res => res.length); // Use length since we filtered

    const previousMonthNewCustomersCount = previousMonthCustomers.length;

    const monthlyGrowth = {
        revenue: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        orders: previousMonthOrders.length > 0 ? ((currentMonthOrdersStats.length - previousMonthOrders.length) / previousMonthOrders.length) * 100 : 0,
        customers: previousMonthNewCustomersCount > 0 ? ((currentMonthNewCustomersCount - previousMonthNewCustomersCount) / previousMonthNewCustomersCount) * 100 : 0,
        profit: 0 // Placeholder
    };

    // 6. Chart Data Generation (Grouping)
    // Determine grouping strategy based on date range length
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    let groupingType: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily';

    if (selectedPeriod === 'today') groupingType = 'hourly';
    else if (chartView === 'summary') {
        if (selectedPeriod === 'month') groupingType = 'weekly';
        else if (selectedPeriod === 'year') groupingType = 'monthly';
        else if (selectedPeriod === 'custom') {
            if (daysDiff > 90) groupingType = 'monthly';
            else if (daysDiff > 32) groupingType = 'weekly';
            else groupingType = 'daily';
        }
    } else {
        // Daily view requested, but if range is too large, force aggregation for readability
        if (selectedPeriod === 'year' || (selectedPeriod === 'custom' && daysDiff > 90)) {
            groupingType = 'monthly';
        } else if (selectedPeriod === 'custom' && daysDiff > 32) {
            groupingType = 'weekly';
        }
    }

    const revenueByPeriod: any[] = [];
    const metersByPeriod: any[] = [];

    // Helper to init buckets
    const generateBuckets = () => {
        const buckets: { start: Date, end: Date, label: string }[] = [];

        if (groupingType === 'hourly') {
            const periods = [
                { name: 'Madrugada', start: 0, end: 5 },
                { name: 'Manhã', start: 6, end: 11 },
                { name: 'Tarde', start: 12, end: 17 },
                { name: 'Noite', start: 18, end: 23 }
            ];
            periods.forEach(p => {
                const s = new Date(periodStart); s.setHours(p.start, 0, 0, 0);
                const e = new Date(periodStart); e.setHours(p.end, 59, 59, 999);
                buckets.push({ start: s, end: e, label: p.name });
            });
        } else if (groupingType === 'daily') {
            for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
                const s = new Date(d); s.setHours(0, 0, 0, 0);
                const e = new Date(d); e.setHours(23, 59, 59, 999);
                buckets.push({
                    start: s, end: e,
                    label: selectedPeriod === 'week'
                        ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][s.getDay()]
                        : `${s.getDate()}/${s.getMonth() + 1}`
                });
            }
        } else if (groupingType === 'weekly') {
            let current = new Date(periodStart);
            while (current <= periodEnd) {
                const s = new Date(current);
                const e = new Date(current); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
                if (e > periodEnd) e.setTime(periodEnd.getTime());

                buckets.push({
                    start: s,
                    end: e,
                    label: selectedPeriod === 'month' ? `Semana ${Math.ceil(s.getDate() / 7)}` : `${s.getDate()}/${s.getMonth() + 1}`
                });
                current.setDate(current.getDate() + 7);
            }
        } else if (groupingType === 'monthly') {
            // Support multi-year ranges by iterating from start to end
            let current = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
            while (current <= periodEnd) {
                const s = new Date(current);
                const e = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
                if (e > periodEnd) e.setTime(periodEnd.getTime());

                buckets.push({
                    start: s,
                    end: e,
                    label: s.toLocaleDateString('pt-BR', { month: 'short', year: daysDiff > 366 ? '2-digit' : undefined })
                });
                current.setMonth(current.getMonth() + 1);
            }
        }
        return buckets;
    };

    const buckets = generateBuckets();

    buckets.forEach(bucket => {
        const ordersInBucket = periodOrders.filter((o: any) => {
            const d = new Date(o.created_at);
            return d >= bucket.start && d <= bucket.end;
        });

        const rev = ordersInBucket.reduce((sum: number, o: any) => {
            const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
            const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
            return sum + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
        }, 0);

        // Somar metros de pedidos NÃO CANCELADOS (Produção Real)
        const productionOrders = ordersInBucket.filter((o: any) => {
            return o.status !== 'cancelado';
        });

        const met = Number(productionOrders.reduce((sum: number, o: any) => {
            let orderMeters = 0;
            if (o.pedido_items) {
                o.pedido_items.forEach((item: any) => {
                    const tipo = (item.tipo || 'dtf').toLowerCase().trim();
                    const isRoll = ['dtf', 'vinil', 'adesivo'].some(t => tipo.includes(t)) && !tipo.includes('varejo');
                    if (isRoll) {
                        orderMeters += (Number(item.quantidade) || 0);
                    }
                });
            }
            return sum + orderMeters;
        }, 0).toFixed(2));

        const cost = productionOrders.reduce((sum: number, o: any) => sum + calculateOrderCost(o), 0);
        const profit = Number((rev - cost).toFixed(2));

        const bucketTotals: Record<string, number> = {};
        // Chart bars show REALIZED production (Paid) and ROLL only to avoid confusion
        productionOrders.forEach((o: any) => {
            if (o.pedido_items) {
                o.pedido_items.forEach((item: any) => {
                    const tipoRaw = (item.tipo || 'outro').toLowerCase().trim();
                    const tipo = tipoRaw === '' ? 'outro' : tipoRaw;
                    const isRoll = ['dtf', 'vinil', 'adesivo'].some(t => tipo.includes(t)) && !tipo.includes('varejo');
                    if (isRoll) {
                        bucketTotals[tipo] = Number(((bucketTotals[tipo] || 0) + (Number(item.quantidade) || 0)).toFixed(2));
                    }
                });
            }
        });


        revenueByPeriod.push({ period: bucket.label, revenue: rev, profit: profit, meters: met });
        metersByPeriod.push({ period: bucket.label, meters: met, ...bucketTotals });
    });

    // 7. Final Financial Report Structure
    const financialReport = {
        byStatus: Array.from(financialStats.values()).sort((a, b) => b.value - a.value),
        totalPaid: periodOrders.filter((o: any) => {
            const isPaid = o.pago_at !== null && o.status !== 'cancelado';
            return isPaid;
        }).reduce((acc: number, o: any) => {
            const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
            const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
            return acc + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
        }, 0),
        totalPending: periodOrders.filter((o: any) =>
            o.pago_at === null && o.status !== 'cancelado'
        ).reduce((acc: number, o: any) => {
            const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
            const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
            return acc + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
        }, 0),
        totalCancelled: periodOrders.filter((o: any) => o.status === 'cancelado').reduce((acc: number, o: any) => {
            const subtotal = (o.subtotal_produtos || 0) + (o.subtotal_servicos || 0);
            const dPerc = subtotal * ((o.desconto_percentual || 0) / 100);
            return acc + Math.max(0, subtotal - (o.desconto_valor || 0) - dPerc);
        }, 0)
    };

    // Services Stats
    const serviceStats = new Map();
    allServices.forEach(s => {
        const ex = serviceStats.get(s.nome) || { totalRevenue: 0, totalCount: 0 };
        serviceStats.set(s.nome, { totalRevenue: ex.totalRevenue + s.total_value, totalCount: ex.totalCount + s.quantidade });
    });
    const topServices = Array.from(serviceStats.entries()).map(([nome, d]) => ({
        nome, ...d, averageValue: d.totalCount > 0 ? d.totalRevenue / d.totalCount : 0
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);


    return {
        totalRevenue,
        totalOrders,
        totalCustomers: totalCustomersCount, // Using optimized count
        totalProducts: totalProductsCount,   // Using optimized count
        averageOrderValue,
        topProducts,
        topCustomers,
        recentOrders,
        monthlyGrowth,
        totalProfit,
        estimatedProfit,
        profitMargin,
        targetProfitMargin: userTargetMargin,
        revenueByPeriod,
        metersReport: {
            totalMeters,
            totalsByType,
            revenueByType,
            metersByPeriod
        },
        financialReport,
        servicesReport: {
            totalServicesRevenue: allServices.reduce((acc, s) => acc + s.total_value, 0),
            totalServicesCount: allServices.reduce((acc, s) => acc + s.quantidade, 0),
            averageServiceValue: 0, // calc if needed
            servicesByPeriod: [], // placeholder
            topServices,
            servicosDetalhados: allServices
        },
        groupingType
    };
};
