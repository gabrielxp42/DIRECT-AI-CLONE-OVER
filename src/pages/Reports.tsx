import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
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
  CalendarIcon
} from "lucide-react";
import { useViewportZoom } from '@/hooks/useViewportZoom';
import { MetersBarChart } from '@/components/MetersBarChart';
import { RevenueLineChart } from '@/components/RevenueLineChart';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const calculatePeriodDates = (period: string, customRange?: { from?: Date; to?: Date }) => {
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

const fetchReportData = async (supabase: any, selectedPeriod: string, customRange?: { from?: Date; to?: Date }): Promise<SalesReport> => {
  const { start: periodStart, end: periodEnd } = calculatePeriodDates(selectedPeriod, customRange);
  const now = new Date();

  // Datas para cálculo de crescimento (Mês Atual vs Mês Anterior)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // --- BUSCA DE DADOS DE CRESCIMENTO (MÊS ATUAL E ANTERIOR) ---
  const [
    { data: currentMonthOrders, error: currentOrdersError },
    { data: previousMonthOrders, error: previousOrdersError },
    { data: currentMonthCustomers, error: currentCustomersError },
    { data: previousMonthCustomers, error: previousCustomersError },
  ] = await Promise.all([
    supabase.from("pedidos").select("valor_total, created_at").gte("created_at", currentMonthStart.toISOString()).lte("created_at", now.toISOString()),
    supabase.from("pedidos").select("valor_total, created_at").gte("created_at", previousMonthStart.toISOString()).lte("created_at", previousMonthEnd.toISOString()),
    supabase.from("clientes").select("id, created_at").gte("created_at", currentMonthStart.toISOString()).lte("created_at", now.toISOString()),
    supabase.from("clientes").select("id, created_at").gte("created_at", previousMonthStart.toISOString()).lte("created_at", previousMonthEnd.toISOString()),
  ]);

  if (currentOrdersError || previousOrdersError || currentCustomersError || previousCustomersError) {
    throw new Error("Erro ao buscar dados de crescimento.");
  }

  // --- BUSCA DE DADOS PRINCIPAIS (PERÍODO SELECIONADO) ---
  const { data: orders, error: ordersError } = await supabase
    .from("pedidos")
    .select("*, clientes(nome), pedido_items(*, produtos(nome)), pedido_servicos(*)")
    .order("created_at", { ascending: false });

  if (ordersError) throw new Error(ordersError.message);

  // Filter orders by selected period
  const periodOrders = orders?.filter(order => {
    const orderDate = new Date(order.created_at);
    return orderDate >= periodStart && orderDate <= periodEnd;
  }) || [];

  // Fetch customers (all time for total count)
  const { data: customers, error: customersError } = await supabase
    .from("clientes")
    .select("*");

  if (customersError) throw new Error(customersError.message);

  // Fetch products (all time for total count)
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("*");

  if (productsError) throw new Error(productsError.message);

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

  // Services Report
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
  
  // Meters by period (simplified for now)
  const metersByPeriod: Array<{ period: string; meters: number }> = [];
  
  // Revenue by period (for line chart)
  const revenueByPeriod: Array<{ period: string; revenue: number }> = [];
  
  // Lógica de agrupamento para o gráfico de linha (por dia se for semana, por semana se for mês, por mês se for ano)
  if (selectedPeriod === "today" || selectedPeriod === "week") {
    const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const startDay = new Date(periodStart);
    const numDays = selectedPeriod === "today" ? 1 : 7;
    
    for (let i = 0; i < numDays; i++) {
      const dayStart = new Date(startDay);
      dayStart.setDate(startDay.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOrders = periodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });
      
      const revenue = dayOrders.reduce((sum, order) => sum + order.valor_total, 0);
      
      revenueByPeriod.push({
        period: selectedPeriod === "today" ? 'Hoje' : daysOfWeek[dayStart.getDay()],
        revenue: revenue,
      });
      
      metersByPeriod.push({
        period: selectedPeriod === "today" ? 'Hoje' : daysOfWeek[dayStart.getDay()],
        meters: dayOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0),
      });
    }
  } else if (selectedPeriod === "month" || selectedPeriod === "year") {
    // Agrupar por semana (mês) ou por mês (ano)
    const isMonth = selectedPeriod === "month";
    const numPeriods = isMonth ? 4 : 12; // 4 semanas ou 12 meses
    
    for (let i = 0; i < numPeriods; i++) {
      let periodLabel: string;
      let periodStartCalc: Date;
      let periodEndCalc: Date;

      if (isMonth) {
        // Agrupamento por semana do mês
        periodStartCalc = new Date(periodStart);
        periodStartCalc.setDate(1 + (i * 7));
        periodEndCalc = new Date(periodStartCalc);
        periodEndCalc.setDate(periodStartCalc.getDate() + 6);
        periodEndCalc.setHours(23, 59, 59, 999);
        periodLabel = `Semana ${i + 1}`;
      } else {
        // Agrupamento por mês do ano
        periodStartCalc = new Date(periodStart.getFullYear(), periodStart.getMonth() + i, 1);
        periodEndCalc = new Date(periodStart.getFullYear(), periodStart.getMonth() + i + 1, 0, 23, 59, 59, 999);
        periodLabel = periodStartCalc.toLocaleDateString('pt-BR', { month: 'short' });
      }

      const periodOrdersCalc = periodOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= periodStartCalc && orderDate <= periodEndCalc;
      });
      
      const revenue = periodOrdersCalc.reduce((sum, order) => sum + order.valor_total, 0);
      
      revenueByPeriod.push({ period: periodLabel, revenue });
      metersByPeriod.push({ period: periodLabel, meters: periodOrdersCalc.reduce((sum, order) => sum + (order.total_metros || 0), 0) });
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

const Reports = () => {
  const { supabase } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState("all");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useViewportZoom(true);

  const { data: reportData, isLoading, error } = useQuery<SalesReport>({
    queryKey: ["comprehensive-report", selectedPeriod, customDateRange],
    queryFn: () => fetchReportData(supabase, selectedPeriod, customDateRange),
    enabled: !!supabase,
    staleTime: 5 * 60 * 1000,
  });

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "today": return "Hoje";
      case "week": return "Esta Semana";
      case "month": return "Este Mês";
      case "year": return "Este Ano";
      case "custom": 
        if (customDateRange.from && customDateRange.to) {
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
  const filteredServicos = reportData?.servicesReport.servicosDetalhados.filter(servico => {
    const matchesSearch = 
      servico.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      servico.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      servico.pedido_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesService = selectedService === "all" || servico.nome === selectedService;
    
    return matchesSearch && matchesService;
  }) || [];

  // Get unique service names for filter
  const uniqueServices = useMemo(() => {
    return Array.from(new Set(reportData?.servicesReport.servicosDetalhados.map(s => s.nome) || []));
  }, [reportData]);

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar relatórios: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER E SELETOR DE PERÍODO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Relatórios de Vendas</h1>
        </div>
      </div>

      {/* SELEÇÃO DE PERÍODO REIMAGINADA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <ToggleGroup 
          type="single" 
          value={selectedPeriod} 
          onValueChange={(value) => {
            if (value && value !== 'custom') {
              setSelectedPeriod(value);
              setCustomDateRange({}); // Limpa o range customizado
            }
          }}
          className="flex-wrap justify-start"
        >
          <ToggleGroupItem value="today" aria-label="Hoje" className="h-9 px-3 text-sm">
            Hoje
          </ToggleGroupItem>
          <ToggleGroupItem value="week" aria-label="Esta Semana" className="h-9 px-3 text-sm">
            Esta Semana
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Este Mês" className="h-9 px-3 text-sm">
            Este Mês
          </ToggleGroupItem>
          <ToggleGroupItem value="year" aria-label="Este Ano" className="h-9 px-3 text-sm">
            Este Ano
          </ToggleGroup>
        
        {/* Seletor de Data Personalizado */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal h-9 px-3 text-sm",
                selectedPeriod !== 'custom' && "text-muted-foreground"
              )}
              onClick={() => setSelectedPeriod('custom')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedPeriod === 'custom' && customDateRange.from ? (
                customDateRange.to ? (
                  <>
                    {format(customDateRange.from, "dd/MM/yyyy")} -{" "}
                    {format(customDateRange.to, "dd/MM/yyyy")}
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
              defaultMonth={customDateRange.from}
              selected={customDateRange}
              onSelect={(range) => {
                setCustomDateRange(range || {});
                if (range?.from && range?.to) {
                  setIsDatePickerOpen(false);
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        Métricas para: <Badge variant="secondary" className="text-base font-bold">{getPeriodLabel(selectedPeriod)}</Badge>
      </h2>

      {/* Key Metrics - Visão Geral do Período */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Receita Total */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(reportData?.totalRevenue || 0)}</div>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : (
              <>
                <div className="text-2xl font-bold">{reportData?.totalOrders || 0}</div>
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Metros (ML)</CardTitle>
            <Ruler className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
              <>
                <div className="text-2xl font-bold text-blue-600">
                  {formatMeters(reportData?.metersReport.totalMeters || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Metragem impressa no período
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(reportData?.averageOrderValue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Por pedido
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {isLoading ? (
          <Skeleton className="h-80 w-full lg:col-span-2" />
        ) : (
          <>
            <RevenueLineChart
              data={reportData?.revenueByPeriod || []}
              title="Tendência de Receita"
              description={`Evolução da receita por ${selectedPeriod === 'week' || selectedPeriod === 'today' ? 'Dia' : 'Período'} em ${getPeriodLabel(selectedPeriod)}`}
            />
            <MetersBarChart 
              data={reportData?.metersReport.metersByPeriod || []}
              title={`Distribuição da Metragem`}
              description={`Metragem por ${selectedPeriod === 'week' || selectedPeriod === 'today' ? 'Dia' : 'Período'} em ${getPeriodLabel(selectedPeriod)}`}
            />
          </>
        )}
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 h-auto">
          <TabsTrigger value="services" className="py-2 flex items-center gap-2"><Wrench className="h-4 w-4" /> Serviços</TabsTrigger>
          <TabsTrigger value="products" className="py-2 flex items-center gap-2"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
          <TabsTrigger value="customers" className="py-2 flex items-center gap-2"><User className="h-4 w-4" /> Clientes</TabsTrigger>
          <TabsTrigger value="recent" className="py-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Recentes</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          {/* Services Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita de Serviços</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData?.servicesReport.totalServicesRevenue || 0)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Total em {getPeriodLabel(selectedPeriod).toLowerCase()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Serviços</CardTitle>
                <Wrench className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-1/2" /> : (
                  <div className="text-2xl font-bold text-primary">
                    {reportData?.servicesReport.totalServicesCount || 0}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Serviços executados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Médio</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                  <div className="text-2xl font-bold">
                    {formatCurrency(reportData?.servicesReport.averageServiceValue || 0)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Por serviço
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Services */}
          <Card>
            <CardHeader>
              <CardTitle>Serviços Detalhados</CardTitle>
              <CardDescription>
                Lista completa de todos os serviços executados ({getPeriodLabel(selectedPeriod)})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <SearchInput
                    placeholder="Buscar por serviço, cliente ou ID do pedido..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filtrar por serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os serviços</SelectItem>
                      {uniqueServices.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Pedido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : filteredServicos.length > 0 ? (
                      filteredServicos.map((servico) => (
                        <TableRow key={servico.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-primary" />
                              {servico.nome}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {servico.cliente_nome}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{servico.quantidade}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(servico.valor_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {formatCurrency(servico.valor_total)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{servico.status_pedido}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            #{servico.pedido_id.slice(-8)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            {searchTerm || selectedService !== "all" 
                              ? "Nenhum serviço encontrado com os filtros aplicados." 
                              : `Nenhum serviço encontrado para ${getPeriodLabel(selectedPeriod).toLowerCase()}.`
                            }
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {filteredServicos.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground">
                  Mostrando {filteredServicos.length} de {reportData?.servicesReport.servicosDetalhados.length} serviços
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Produtos Mais Vendidos</CardTitle>
              <CardDescription>Top 5 produtos por receita ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;