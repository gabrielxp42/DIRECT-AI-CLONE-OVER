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
    profitMargin: number;
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
        metersByPeriod: Array<{ period: string; meters: number;[key: string]: string | number; }>;
    };
    revenueByPeriod: Array<{ period: string; revenue: number; }>;
    financialReport: {
        byStatus: Array<{ status: string; count: number; value: number; }>;
        totalPaid: number;
        totalPending: number;
        totalCancelled: number;
    };
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

const doCount = async (endpoint: string, token: string) => {
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Range': '0-0'
    };
    // Use HEAD to get just the count or a minimal select with count=exact
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?select=id&limit=1`;
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
    specificYear?: string
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
        insumos
    ] = await Promise.all([
        // Main Orders: Enable fetchAll (pagination) and server-side filtering for both start and end dates
        doFetch('pedidos', new URLSearchParams({
            select: '*,clientes(nome),pedido_items(*,produtos(nome,insumo_id,consumo_insumo)),pedido_servicos(*)',
            created_at: `gte.${periodStart.toISOString()}`,
            // Add 'and' logic for lte? Supabase handles multiple params with same key as AND
            // Using query string construction carefully:
        }), effectiveToken, true).then(data => {
            // Server-side filtering via URLSearchParams with duplicates is tricky in simple object construction
            // So we keep ensuring client side filter for 'lte' to be 100% precise with microseconds,
            // BUT we fetched ALL pages effectively, so we won't miss data.
            return data.filter((d: any) => new Date(d.created_at) <= periodEnd);
        }),

        // Current Month Stats (for growth) - Optimized to just fetch totals if possible, but we need sum, so fetch needed cols
        doFetch('pedidos', new URLSearchParams({
            select: 'valor_total,id',
            created_at: `gte.${currentMonthStart.toISOString()}`
        }), effectiveToken, true), // Pagination on stats too just in case

        // Previous Month Stats (for growth)
        Promise.all([
            doFetch('pedidos', new URLSearchParams({
                select: 'valor_total,id',
                created_at: `gte.${previousMonthStart.toISOString()}`,
            }), effectiveToken, true).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd)),
            // Previous Month Customers count approximation (fetch simple)
            doFetch('clientes', new URLSearchParams({
                select: 'id',
                created_at: `gte.${previousMonthStart.toISOString()}`
            }), effectiveToken, true).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd))
        ]),

        // Total Counts (Optimized)
        doCount('clientes', effectiveToken),
        doCount('produtos', effectiveToken),

        // Insumos for cost
        doFetch('insumos', new URLSearchParams({ select: 'id,custo_unitario' }), effectiveToken)
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
    const allServices: any[] = [];

    periodOrders.forEach((order: any) => {
        // Totals
        totalRevenue += order.valor_total || 0;
        totalCost += calculateOrderCost(order);
        totalMeters += (order.total_metros || 0);

        // Meters by Type
        if (order.pedido_items) {
            order.pedido_items.forEach((item: any) => {
                const tipo = (item.tipo || 'dtf').toLowerCase();
                totalsByType[tipo] = (totalsByType[tipo] || 0) + (Number(item.quantidade) || 0);

                // Product Sales
                const productName = item.produtos?.nome || item.produto_nome || 'Produto não encontrado';
                const existingProd = productSales.get(productName) || { totalSold: 0, revenue: 0 };
                productSales.set(productName, {
                    totalSold: existingProd.totalSold + item.quantidade,
                    revenue: existingProd.revenue + (item.quantidade * item.preco_unitario)
                });
            });
        }

        // Customer Spending
        const customerName = order.clientes?.nome || 'Cliente Anônimo';
        const existingCust = customerSpending.get(customerName) || { totalOrders: 0, totalSpent: 0 };
        customerSpending.set(customerName, {
            totalOrders: existingCust.totalOrders + 1,
            totalSpent: existingCust.totalSpent + (order.valor_total || 0)
        });

        // Financial Report
        const status = order.status || 'desconhecido';
        const existingFin = financialStats.get(status) || { count: 0, value: 0, status };
        financialStats.set(status, {
            count: existingFin.count + 1,
            value: existingFin.value + (order.valor_total || 0),
            status
        });

        // Services
        if (order.pedido_servicos) {
            order.pedido_servicos.forEach((servico: any) => {
                allServices.push({
                    ...servico,
                    pedido_id: order.id,
                    cliente_nome: customerName,
                    data_pedido: order.created_at,
                    status_pedido: order.status,
                    total_value: servico.quantidade * servico.valor_unitario
                });
            });
        }
    });

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
    const currentRevenue = currentMonthOrdersStats.reduce((sum: number, o: any) => sum + o.valor_total, 0);
    const previousRevenue = previousMonthOrders.reduce((sum: number, o: any) => sum + o.valor_total, 0);

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
    const currentMonthNewCustomersCount = await doFetch('clientes', new URLSearchParams({
        select: 'id',
        created_at: `gte.${currentMonthStart.toISOString()}`
    }), effectiveToken).then(res => res.length); // Use length since we filtered

    const previousMonthNewCustomersCount = previousMonthCustomers.length;

    const monthlyGrowth = {
        revenue: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        orders: previousMonthOrders.length > 0 ? ((currentMonthOrdersStats.length - previousMonthOrders.length) / previousMonthOrders.length) * 100 : 0,
        customers: previousMonthNewCustomersCount > 0 ? ((currentMonthNewCustomersCount - previousMonthNewCustomersCount) / previousMonthNewCustomersCount) * 100 : 0,
        profit: 0 // Placeholder
    };

    // 6. Chart Data Generation (Grouping)
    // Determine grouping strategy
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    let groupingType: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily';

    if (selectedPeriod === 'today') groupingType = 'hourly';
    else if (chartView === 'summary') {
        if (selectedPeriod === 'month') groupingType = 'weekly';
        else if (selectedPeriod === 'year') groupingType = 'monthly';
    } else {
        // Daily view
        if (selectedPeriod === 'year') groupingType = 'monthly';
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
            // Logic for weeks
            let current = new Date(periodStart);
            let i = 1;
            while (current <= periodEnd) {
                const s = new Date(current);
                const e = new Date(current); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
                if (e > periodEnd) e.setTime(periodEnd.getTime());

                buckets.push({
                    start: s,
                    end: e,
                    label: selectedPeriod === 'month' ? `Semana ${i}` : `${s.getDate()}/${s.getMonth() + 1}`
                });
                current.setDate(current.getDate() + 7);
                i++;
            }
        } else if (groupingType === 'monthly') {
            for (let m = 0; m < 12; m++) {
                const s = new Date(periodStart.getFullYear(), m, 1);
                const e = new Date(periodStart.getFullYear(), m + 1, 0, 23, 59, 59, 999);
                buckets.push({ start: s, end: e, label: s.toLocaleDateString('pt-BR', { month: 'short' }) });
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

        const rev = ordersInBucket.reduce((sum: number, o: any) => sum + (o.valor_total || 0), 0);
        const met = ordersInBucket.reduce((sum: number, o: any) => sum + (o.total_metros || 0), 0);

        const bucketTotals: Record<string, number> = {};
        ordersInBucket.forEach((o: any) => {
            if (o.pedido_items) {
                o.pedido_items.forEach((item: any) => {
                    const tipo = (item.tipo || 'dtf').toLowerCase();
                    bucketTotals[tipo] = (bucketTotals[tipo] || 0) + (Number(item.quantidade) || 0);
                });
            }
        });

        revenueByPeriod.push({ period: bucket.label, revenue: rev });
        metersByPeriod.push({ period: bucket.label, meters: met, ...bucketTotals });
    });

    // 7. Final Financial Report Structure
    const financialReport = {
        byStatus: Array.from(financialStats.values()).sort((a, b) => b.value - a.value),
        totalPaid: periodOrders.filter((o: any) => ['pago', 'entregue', 'enviado', 'aguardando retirada'].includes(o.status)).reduce((acc: number, o: any) => acc + o.valor_total, 0),
        totalPending: periodOrders.filter((o: any) => ['pendente', 'processando'].includes(o.status)).reduce((acc: number, o: any) => acc + o.valor_total, 0),
        totalCancelled: periodOrders.filter((o: any) => o.status === 'cancelado').reduce((acc: number, o: any) => acc + o.valor_total, 0)
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
        profitMargin,
        revenueByPeriod,
        metersReport: {
            totalMeters,
            totalsByType,
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
        }
    };
};
