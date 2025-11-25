import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SearchInput } from "@/components/SearchInput";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Wrench,
  Calendar,
  User,
  FileText,
  Filter,
  BarChart3,
  Ruler,
  Clock,
  ChevronDown,
  CalendarIcon,
  Loader2
} from "lucide-react";

import { MetersBarChart } from '@/components/MetersBarChart';
import { RevenueLineChart } from '@/components/RevenueLineChart';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ServiceCommissionReport } from "@/components/ServiceCommissionReport";
import { DateRange } from "react-day-picker"; // Importar DateRange
import { EmptyState } from "@/components/EmptyState";

// Tipos de dados (mantidos do original, mas simplificados para o contexto)
interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  averageOrderValue: number;
  topProducts: Array<{ nome: string; totalSold: number; revenue: number; }>;
  topCustomers: Array<{ nome: string; totalOrders: number; totalSpent: number; }>;
  recentOrders: Array<{ id: string; cliente_nome: string; valor_total: number; status: string; created_at: string; }>;
  monthlyGrowth: { revenue: number; orders: number; customers: number; };
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
    metersByPeriod: Array<{ period: string; meters: number; }>;
  };
  revenueByPeriod: Array<{ period: string; revenue: number; }>; // Novo campo para o gráfico de linha
}

// --- Lógica de Data e Fetch ---

const calculatePeriodDates = (period: string, customRange?: DateRange) => { // Usar DateRange
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date = now;

  if (customRange?.from && customRange?.to) {
    periodStart = customRange.from;
    periodEnd = customRange.to;
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
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
      default: // Default to month
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    // Para períodos predefinidos, o fim é sempre o momento atual
    periodEnd = now;
  }

  return { start: periodStart, end: periodEnd };
};

const fetchReportData = async (
  accessToken: string,
  selectedPeriod: string,
  customRange?: DateRange,
  chartView: 'summary' | 'daily' = 'daily'
): Promise<SalesReport> => { // Usar DateRange
  if (!accessToken) {
    throw new Error("Sem token de acesso para fetch.");
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // Helper para fetch
  const doFetch = async (endpoint: string, params: URLSearchParams) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`Fetch error ${endpoint}: ${res.statusText}`);
    return res.json();
  };

  const { start: periodStart, end: periodEnd } = calculatePeriodDates(selectedPeriod, customRange);
  const now = new Date();

  // Datas para cálculo de crescimento (Mês Atual vs Mês Anterior)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // --- BUSCA DE DADOS DE CRESCIMENTO (MÊS ATUAL E ANTERIOR) ---

  let currentMonthOrders, previousMonthOrders, currentMonthCustomers, previousMonthCustomers;

  try {
    currentMonthOrders = await doFetch('pedidos', new URLSearchParams({
      select: 'valor_total,created_at',
      created_at: `gte.${currentMonthStart.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= now));
  } catch (e: any) {
    throw new Error(`Erro ao buscar pedidos do mês atual: ${e.message}`);
  }

  try {
    previousMonthOrders = await doFetch('pedidos', new URLSearchParams({
      select: 'valor_total,created_at',
      created_at: `gte.${previousMonthStart.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd));
  } catch (e: any) {
    throw new Error(`Erro ao buscar pedidos do mês anterior: ${e.message}`);
  }

  try {
    currentMonthCustomers = await doFetch('clientes', new URLSearchParams({
      select: 'id,created_at',
      created_at: `gte.${currentMonthStart.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= now));
  } catch (e: any) {
    throw new Error(`Erro ao buscar clientes do mês atual: ${e.message}`);
  }

  try {
    previousMonthCustomers = await doFetch('clientes', new URLSearchParams({
      select: 'id,created_at',
      created_at: `gte.${previousMonthStart.toISOString()}`,
    })).then(data => data.filter((d: any) => new Date(d.created_at) <= previousMonthEnd));
  } catch (e: any) {
    throw new Error(`Erro ao buscar clientes do mês anterior: ${e.message}`);
  }

  // --- BUSCA DE DADOS PRINCIPAIS (PERÍODO SELECIONADO) ---
  let orders, customers, products;

  try {
    orders = await doFetch('pedidos', new URLSearchParams({
      select: '*,clientes(nome),pedido_items(*,produtos(nome)),pedido_servicos(*)',
      order: 'created_at.desc'
    }));
  } catch (e: any) {
    throw new Error(`Erro ao buscar pedidos completos: ${e.message}`);
  }

  // Filter orders by selected period
  const periodOrders = orders?.filter((order: any) => {
    const orderDate = new Date(order.created_at);
    return orderDate >= periodStart && orderDate <= periodEnd;
  }) || [];

  // Fetch customers (all time for total count)
  try {
    customers = await doFetch('clientes', new URLSearchParams({
      select: '*'
    }));
  } catch (e: any) {
    throw new Error(`Erro ao buscar todos os clientes: ${e.message}`);
  }

  // Fetch products (all time for total count)
  try {
    products = await doFetch('produtos', new URLSearchParams({
      select: '*'
    }));
  } catch (e: any) {
    throw new Error(`Erro ao buscar todos os produtos: ${e.message}`);
  }

  // --- CÁLCULOS DE MÉTRICAS ---
  const totalRevenue = periodOrders.reduce((sum, order) => sum + order.valor_total, 0) || 0;
  const totalOrders = periodOrders.length || 0;
  const totalCustomers = customers?.length || 0;
  const totalProducts = products?.length || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top Products
  const productSales = new Map();
  periodOrders.forEach(order => {
    order.pedido_items.forEach(item => {
      const productName = item.produtos?.nome || item.produto_nome || 'Produto não encontrado';
      const existing = productSales.get(productName) || { totalSold: 0, revenue: 0 };
      productSales.set(productName, {
        totalSold: existing.totalSold + item.quantidade,
        revenue: existing.revenue + (item.quantidade * item.preco_unitario)
      });
    });
  });
  const topProducts = Array.from(productSales.entries())
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top Customers
  const customerSpending = new Map();
  periodOrders.forEach(order => {
    const customerName = order.clientes?.nome || 'Cliente não encontrado';
    const existing = customerSpending.get(customerName) || { totalOrders: 0, totalSpent: 0 };
    customerSpending.set(customerName, {
      totalOrders: existing.totalOrders + 1,
      totalSpent: existing.totalSpent + order.valor_total
    });
  });
  const topCustomers = Array.from(customerSpending.entries())
    .map(([nome, data]) => ({ nome, ...data }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // Recent Orders (using ALL orders)
  const recentOrders = orders?.slice(0, 10).map(order => ({
    id: order.id,
    cliente_nome: order.clientes?.nome || 'Cliente não encontrado',
    valor_total: order.valor_total,
    status: order.status,
    created_at: order.created_at
  })) || [];

  // Monthly Growth
  const currentRevenue = currentMonthOrders.reduce((sum, order) => sum + order.valor_total, 0);
  const previousRevenue = previousMonthOrders.reduce((sum, order) => sum + order.valor_total, 0);
  const monthlyGrowth = {
    revenue: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
    orders: previousMonthOrders.length > 0 ? ((currentMonthOrders.length - previousMonthOrders.length) / previousMonthOrders.length) * 100 : 0,
    customers: previousMonthCustomers.length > 0 ? ((currentMonthCustomers.length - previousMonthCustomers.length) / previousMonthCustomers.length) * 100 : 0,
  };

  // Services Report (Mantido apenas para compatibilidade de tipo, mas não usado na UI)
  const allServices = [];
  periodOrders.forEach(order => {
    if (order.pedido_servicos && order.pedido_servicos.length > 0) {
      order.pedido_servicos.forEach(servico => {
        allServices.push({
          id: servico.id || `${order.id}-${servico.nome}`,
          nome: servico.nome,
          quantidade: servico.quantidade,
          valor_unitario: servico.valor_unitario,
          valor_total: servico.quantidade * servico.valor_unitario,
          pedido_id: order.id,
          cliente_nome: order.clientes?.nome || 'Cliente não encontrado',
          data_pedido: order.created_at,
          status_pedido: order.status,
          observacoes_pedido: order.observacoes,
          order_date: order.created_at,
          total_value: servico.quantidade * servico.valor_unitario
        });
      });
    }
  });

  const totalServicesRevenue = allServices.reduce((sum, service) => sum + service.total_value, 0);
  const totalServicesCount = allServices.reduce((sum, service) => sum + service.quantidade, 0);
  const averageServiceValue = totalServicesCount > 0 ? totalServicesRevenue / totalServicesCount : 0;

  const servicesByName = new Map();
  allServices.forEach(service => {
    const existing = servicesByName.get(service.nome) || { totalRevenue: 0, totalCount: 0 };
    servicesByName.set(service.nome, {
      totalRevenue: existing.totalRevenue + service.total_value,
      totalCount: existing.totalCount + service.quantidade
    });
  });

  const topServices = Array.from(servicesByName.entries())
    .map(([nome, data]) => ({
      nome,
      totalRevenue: data.totalRevenue,
      totalCount: data.totalCount,
      averageValue: data.totalCount > 0 ? data.totalRevenue / data.totalCount : 0
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Services by period (simplified for now)
  const servicesByPeriod = [];

  // Meters Report
  const totalMeters = periodOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0);

  // Meters by period and Revenue by period
  const metersByPeriod: Array<{ period: string; meters: number }> = [];
  const revenueByPeriod: Array<{ period: string; revenue: number }> = [];

  // Calcular diferença em dias entre início e fim do período
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

  // Determinar o tipo de agrupamento baseado no período E na visualização escolhida
  let groupingType: 'daily' | 'weekly' | 'monthly' = 'daily';

  if (chartView === 'summary') {
    // Visualização RESUMIDA (como estava antes)
    if (selectedPeriod === 'today') {
      groupingType = 'daily'; // Hoje sempre é diário
    } else if (selectedPeriod === 'week') {
      groupingType = 'daily'; // Semana sempre mostra os 7 dias
    } else if (selectedPeriod === 'month') {
      groupingType = 'weekly'; // Mês mostra 4-5 semanas
    } else if (selectedPeriod === 'year') {
      groupingType = 'monthly'; // Ano mostra 12 meses
    } else if (selectedPeriod === 'custom') {
      groupingType = daysDiff <= 31 ? 'daily' : 'weekly';
    }
  } else {
    // Visualização DIÁRIA (detalhada)
    if (selectedPeriod === 'today') {
      groupingType = 'daily';
    } else if (selectedPeriod === 'week') {
      groupingType = 'daily'; // 7 dias
    } else if (selectedPeriod === 'month') {
      groupingType = 'daily'; // 30-31 dias
    } else if (selectedPeriod === 'year') {
      groupingType = 'monthly'; // Ano sempre mensal (muitos dias)
    } else if (selectedPeriod === 'custom') {
      groupingType = daysDiff <= 31 ? 'daily' : 'weekly';
    }
  }

  // Gerar dados baseado no tipo de agrupamento
  if (groupingType === 'daily') {
    // Agrupamento diário
    let numDays: number;

    if (selectedPeriod === 'today') {
      // Para "Hoje", mostrar períodos do dia em vez de um único ponto
      const periods = [
        { name: 'Madrugada', start: 0, end: 5 },
        { name: 'Manhã', start: 6, end: 11 },
        { name: 'Tarde', start: 12, end: 17 },
        { name: 'Noite', start: 18, end: 23 }
      ];

      periods.forEach(period => {
        const periodStartForRange = new Date(periodStart); // Use the overall periodStart (which is the start of today)
        periodStartForRange.setHours(period.start, 0, 0, 0);
        const periodEndForRange = new Date(periodStart); // Use the overall periodStart (which is the start of today)
        periodEndForRange.setHours(period.end, 59, 59, 999);

        const ordersInPeriod = periodOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= periodStartForRange && orderDate <= periodEndForRange;
        });

        const revenue = ordersInPeriod.reduce((sum, order) => sum + order.valor_total, 0);
        const meters = ordersInPeriod.reduce((sum, order) => sum + (order.total_metros || 0), 0);

        revenueByPeriod.push({ period: period.name, revenue });
        metersByPeriod.push({ period: period.name, meters });
      });

      return {
        totalRevenue,
        totalOrders,
        totalCustomers,
        totalProducts,
        averageOrderValue,
        topProducts,
        topCustomers,
        recentOrders,
        monthlyGrowth,
        servicesReport: {
          totalServicesRevenue,
          totalServicesCount,
          averageServiceValue,
          servicesByPeriod,
          topServices,
          servicosDetalhados: allServices
        },
        metersReport: {
          totalMeters,
          metersByPeriod
        },
        revenueByPeriod
      }; // Sair da função após processar "Hoje"
    } else if (selectedPeriod === 'week') {
      numDays = 7;
    } else if (selectedPeriod === 'month') {
      // Número de dias no mês
      numDays = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
    } else if (selectedPeriod === 'custom') {
      numDays = daysDiff + 1;
    } else {
      numDays = daysDiff + 1;
    }

    for (let i = 0; i < numDays; i++) {
      const dayStart = new Date(periodStart);
      dayStart.setDate(periodStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Não processar dias futuros
      if (dayStart > periodEnd) break;

      const dayOrders = periodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });

      const revenue = dayOrders.reduce((sum, order) => sum + order.valor_total, 0);
      const meters = dayOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0);

      // Formatar label do dia
      let periodLabel: string;
      if (selectedPeriod === 'week') {
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        periodLabel = daysOfWeek[dayStart.getDay()];
      } else {
        // Para mês ou custom, mostrar dia do mês
        periodLabel = dayStart.getDate().toString();
      }

      revenueByPeriod.push({ period: periodLabel, revenue });
      metersByPeriod.push({ period: periodLabel, meters });
    }
  } else if (groupingType === 'weekly') {
    // Agrupamento semanal
    let numWeeks: number;

    if (selectedPeriod === 'month') {
      // Para mês, calcular número de semanas
      const firstDay = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
      const lastDay = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
      numWeeks = Math.ceil((lastDay.getDate() - firstDay.getDate() + 1) / 7);
    } else {
      numWeeks = Math.ceil(daysDiff / 7);
    }

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(periodStart);
      weekStart.setDate(periodStart.getDate() + (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Ajustar último período para não ultrapassar periodEnd
      if (weekEnd > periodEnd) {
        weekEnd.setTime(periodEnd.getTime());
      }

      const weekOrders = periodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= weekStart && orderDate <= weekEnd;
      });

      const revenue = weekOrders.reduce((sum, order) => sum + order.valor_total, 0);
      const meters = weekOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0);

      let periodLabel: string;
      if (selectedPeriod === 'month') {
        periodLabel = `Semana ${i + 1}`;
      } else {
        periodLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
      }

      revenueByPeriod.push({ period: periodLabel, revenue });
      metersByPeriod.push({ period: periodLabel, meters });
    }
  } else if (groupingType === 'monthly') {
    // Agrupamento mensal (para ano)
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(periodStart.getFullYear(), i, 1);
      const monthEnd = new Date(periodStart.getFullYear(), i + 1, 0, 23, 59, 59, 999);

      const monthOrders = periodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      const revenue = monthOrders.reduce((sum, order) => sum + order.valor_total, 0);
      const meters = monthOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0);

      const periodLabel = monthStart.toLocaleDateString('pt-BR', { month: 'short' });

      revenueByPeriod.push({ period: periodLabel, revenue });
      metersByPeriod.push({ period: periodLabel, meters });
    }
  }



  return {
    totalRevenue,
    totalOrders,
    totalCustomers,
    totalProducts,
    averageOrderValue,
    topProducts,
    topCustomers,
    recentOrders,
    monthlyGrowth,
    servicesReport: {
      totalServicesRevenue,
      totalServicesCount,
      averageServiceValue,
      servicesByPeriod,
      topServices,
      servicosDetalhados: allServices
    },
    metersReport: {
      totalMeters,
      metersByPeriod
    },
    revenueByPeriod
  };
};

const Reports: React.FC = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined); // Usar DateRange | undefined
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState("all");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [chartView, setChartView] = useState<'summary' | 'daily'>('daily'); // NOVO: Controle de visualização



  // Validação crítica: só executar se sessão não estiver carregando E token estiver disponível
  const isEnabled = !sessionLoading && !!accessToken;

  const { data: reportData, isLoading, error } = useQuery<SalesReport>({
    queryKey: ["comprehensive-report", selectedPeriod, customDateRange, chartView],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Sem token de acesso para fetch.");
      }
      return fetchReportData(accessToken, selectedPeriod, customDateRange, chartView);
    },
    enabled: isEnabled, // Aguardar sessão carregar antes de executar
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
  });

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "today": return "Hoje";
      case "week": return "Esta Semana";
      case "month": return "Este Mês";
      case "year": return "Este Ano";
      case "custom":
        if (customDateRange?.from && customDateRange?.to) {
          return `${format(customDateRange.from, 'dd/MM')} - ${format(customDateRange.to, 'dd/MM')}`;
        }
        return "Período Personalizado";
      default: return "Este Período";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMeters = (value: number) => {
    return `${value.toFixed(2)} ML`;
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  const getGrowthIcon = (growth: number) => {
    return growth >= 0 ? TrendingUp : TrendingDown;
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Filter services based on search and selected service type
  // REMOVIDO: Lógica de filtro de serviços detalhados, pois a tab foi removida.

  // Get unique service names for filter
  // REMOVIDO: Lógica de uniqueServices, pois a tab foi removida.

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar relatórios: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-safe">
      {/* HEADER E SELETOR DE PERÍODO */}
      <div className="flex flex-col gap-3 border-b pb-3 md:pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          <h1 className="text-xl md:text-3xl font-bold">Relatórios</h1>
        </div>
      </div>

      {/* SELEÇÃO DE PERÍODO REIMAGINADA */}
      <div className="flex flex-col gap-3">
        {/* Botões de período com scroll horizontal no mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <ToggleGroup
            type="single"
            value={selectedPeriod}
            onValueChange={(value) => {
              if (value && value !== 'custom') {
                setSelectedPeriod(value);
                setCustomDateRange(undefined);
              }
            }}
            className="flex gap-2 w-max md:w-auto md:flex-wrap"
          >
            <ToggleGroupItem value="today" aria-label="Hoje" className="h-9 px-3 text-sm whitespace-nowrap">
              Hoje
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Esta Semana" className="h-9 px-3 text-sm whitespace-nowrap">
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Este Mês" className="h-9 px-3 text-sm whitespace-nowrap">
              Mês
            </ToggleGroupItem>
            <ToggleGroupItem value="year" aria-label="Este Ano" className="h-9 px-3 text-sm whitespace-nowrap">
              Ano
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Seletor de Data Personalizado */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
              className={cn(
                "w-full md:w-auto justify-start text-left font-normal h-9 px-3 text-sm",
                selectedPeriod !== 'custom' && "text-muted-foreground"
              )}
              onClick={() => setSelectedPeriod('custom')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedPeriod === 'custom' && customDateRange?.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, "dd/MM/yy")} -{" "}
                    {format(customDateRange.to, "dd/MM/yy")}
                  </>
                ) : (
                  format(customDateRange.from, "dd/MM/yyyy")
                )
              ) : (
                <span>Personalizar</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <DatePicker
              initialFocus
              mode="range"
              defaultMonth={customDateRange?.from}
              selected={customDateRange}
              onSelect={(range) => {
                setCustomDateRange(range);
                if (range?.from && range?.to) {
                  setIsDatePickerOpen(false);
                }
              }}
              numberOfMonths={window.innerWidth < 768 ? 1 : 2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <h2 className="text-base md:text-xl font-semibold flex items-center gap-2 flex-wrap">
        <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
        <span className="text-sm md:text-base">Métricas:</span>
        <Badge variant="secondary" className="text-sm md:text-base font-bold">{getPeriodLabel(selectedPeriod)}</Badge>
      </h2>

      {/* Key Metrics - Visão Geral do Período */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">

        {/* Receita Total */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {isLoading ? <Skeleton className="h-6 md:h-8 w-3/4" /> : (
              <>
                <div className="text-lg md:text-2xl font-bold">{formatCurrency(reportData?.totalRevenue || 0)}</div>
                <div className={`text-xs flex items-center ${getGrowthColor(reportData?.monthlyGrowth.revenue || 0)}`}>
                  {React.createElement(getGrowthIcon(reportData?.monthlyGrowth.revenue || 0), { className: "h-3 w-3 mr-1" })}
                  {formatGrowth(reportData?.monthlyGrowth.revenue || 0)} este mês
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total de Pedidos */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {isLoading ? <Skeleton className="h-6 md:h-8 w-1/2" /> : (
              <>
                <div className="text-lg md:text-2xl font-bold">{reportData?.totalOrders || 0}</div>
                <div className={`text-xs flex items-center ${getGrowthColor(reportData?.monthlyGrowth.orders || 0)}`}>
                  {React.createElement(getGrowthIcon(reportData?.monthlyGrowth.orders || 0), { className: "h-3 w-3 mr-1" })}
                  {formatGrowth(reportData?.monthlyGrowth.orders || 0)} este mês
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total de Metros */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Metros (ML)</CardTitle>
            <Ruler className="h-3 w-3 md:h-4 md:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {isLoading ? <Skeleton className="h-6 md:h-8 w-3/4" /> : (
              <>
                <div className="text-lg md:text-2xl font-bold text-blue-600">
                  {formatMeters(reportData?.metersReport.totalMeters || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Impressos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {isLoading ? <Skeleton className="h-6 md:h-8 w-3/4" /> : (
              <>
                <div className="text-lg md:text-2xl font-bold">{formatCurrency(reportData?.averageOrderValue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Por pedido
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-64 md:h-80 w-full" />
            <Skeleton className="h-64 md:h-80 w-full" />
          </>
        ) : (
          <>
            {/* Toggle de Visualização acima dos gráficos */}
            <div className="lg:col-span-2 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Gráficos de Desempenho</h3>
              </div>

              {/* Toggle de Visualização */}
              {(selectedPeriod === 'month' || selectedPeriod === 'year') && (
                <ToggleGroup
                  type="single"
                  value={chartView}
                  onValueChange={(value) => {
                    if (value) setChartView(value as 'summary' | 'daily');
                  }}
                  className="flex gap-1"
                >
                  <ToggleGroupItem
                    value="summary"
                    aria-label="Visualização Resumida"
                    className="h-9 px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    📊 Resumida
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="daily"
                    aria-label="Visualização Diária"
                    className="h-9 px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    📅 Diária
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </div>

            <RevenueLineChart
              data={reportData?.revenueByPeriod || []}
              title="Tendência de Receita"
              description={`Evolução da receita por ${chartView === 'daily' ? 'Dia' : selectedPeriod === 'month' ? 'Semana' : 'Período'} em ${getPeriodLabel(selectedPeriod)}`}
            />
            <MetersBarChart
              data={reportData?.metersReport.metersByPeriod || []}
              title={`Distribuição da Metragem`}
              description={`Metragem por ${chartView === 'daily' ? 'Dia' : selectedPeriod === 'month' ? 'Semana' : 'Período'} em ${getPeriodLabel(selectedPeriod)}`}
            />
          </>
        )}
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="commission" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="grid w-max md:w-full grid-cols-4 h-auto">
            <TabsTrigger value="commission" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Comissão</span>
              <span className="sm:hidden">Com.</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Package className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Produtos</span>
              <span className="sm:hidden">Prod.</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <User className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Clientes</span>
              <span className="sm:hidden">Cli.</span>
            </TabsTrigger>
            <TabsTrigger value="recent" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Recentes</span>
              <span className="sm:hidden">Rec.</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="commission" className="space-y-6">
          <ServiceCommissionReport />
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>Top 5 produtos por receita ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                reportData?.topProducts.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="Nenhum produto vendido"
                    description="Não houve vendas de produtos neste período."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtd Vendida</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Receita Média</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData?.topProducts.map((product, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{product.nome}</TableCell>
                            <TableCell className="text-center">{product.totalSold}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(product.revenue)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(product.revenue / product.totalSold)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Melhores Clientes</CardTitle>
              <CardDescription>Top 5 clientes por valor gasto ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                reportData?.topCustomers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum cliente ativo"
                    description="Nenhum cliente realizou compras neste período."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-center">Total de Pedidos</TableHead>
                          <TableHead className="text-right">Total Gasto</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData?.topCustomers.map((customer, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{customer.nome}</TableCell>
                            <TableCell className="text-center">{customer.totalOrders}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(customer.totalSpent)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(customer.totalSpent / customer.totalOrders)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recentes (Geral)</CardTitle>
              <CardDescription>Últimos 10 pedidos realizados no sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                reportData?.recentOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title="Nenhum pedido recente"
                    description="Não há pedidos registrados recentemente."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData?.recentOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">#{order.id.slice(-8)}</TableCell>
                            <TableCell>{order.cliente_nome}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(order.valor_total)}</TableCell>
                            <TableCell>{formatDate(order.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;