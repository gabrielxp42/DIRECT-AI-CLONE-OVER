import React, { useState } from "react";
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
  Clock
} from "lucide-react";
import { useViewportZoom } from '@/hooks/useViewportZoom';
import { MetersBarChart } from '@/components/MetersBarChart';
import { cn } from "@/lib/utils";

interface SalesReport {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  averageOrderValue: number;
  topProducts: Array<{
    nome: string;
    totalSold: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    nome: string;
    totalOrders: number;
    totalSpent: number;
  }>;
  recentOrders: Array<{
    id: string;
    cliente_nome: string;
    valor_total: number;
    status: string;
    created_at: string;
  }>;
  monthlyGrowth: {
    revenue: number;
    orders: number;
    customers: number;
  };
  servicesReport: {
    totalServicesRevenue: number;
    totalServicesCount: number;
    averageServiceValue: number;
    servicesByPeriod: Array<{
      period: string;
      revenue: number;
      count: number;
    }>;
    topServices: Array<{
      nome: string;
      totalRevenue: number;
      totalCount: number;
      averageValue: number;
    }>;
    servicosDetalhados: Array<{
      id: string;
      nome: string;
      quantidade: number;
      valor_unitario: number;
      valor_total: number;
      pedido_id: string;
      cliente_nome: string;
      data_pedido: string;
      status_pedido: string;
      observacoes_pedido?: string;
    }>;
  };
  metersReport: {
    totalMeters: number;
    metersByPeriod: Array<{
      period: string;
      meters: number;
    }>;
  };
}

const Reports = () => {
  const { supabase } = useSession();
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState("all");

  useViewportZoom(true);

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "week": return "Esta Semana";
      case "month": return "Este Mês";
      case "quarter": return "Este Trimestre";
      case "year": return "Este Ano";
      default: return "Este Período";
    }
  };

  const { data: reportData, isLoading } = useQuery<SalesReport>({
    queryKey: ["comprehensive-report", selectedPeriod],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase client is not available");

      const now = new Date();
      
      // Helper para calcular datas de início e fim do período
      const calculatePeriodDates = (period: string) => {
        let periodStart: Date;
        let periodEnd: Date = now;

        switch (period) {
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
          case "quarter":
            const currentQuarter = Math.floor(now.getMonth() / 3);
            periodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
            break;
          case "year":
            periodStart = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        // Ajustar o final do período para o final do dia atual, se for o período atual
        if (periodStart.getTime() <= now.getTime()) {
            periodEnd = new Date(now);
        } else {
            // Se for um período passado, calcular o final do período
            if (period === "month") {
                periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59, 999);
            } else if (period === "quarter") {
                periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0, 23, 59, 59, 999);
            } else if (period === "year") {
                periodEnd = new Date(periodStart.getFullYear() + 1, 0, 0, 23, 59, 59, 999);
            }
        }

        return { start: periodStart, end: periodEnd };
      };

      const { start: periodStart, end: periodEnd } = calculatePeriodDates(selectedPeriod);
      
      // Datas para cálculo de crescimento (mês anterior)
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);


      // Fetch all orders with related data
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

      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from("clientes")
        .select("*");

      if (customersError) throw new Error(customersError.message);

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from("produtos")
        .select("*");

      if (productsError) throw new Error(productsError.message);

      // Calculate basic metrics (using ALL customers for total count, but periodOrders for revenue/AOV)
      const totalRevenue = periodOrders.reduce((sum, order) => sum + order.valor_total, 0) || 0;
      const totalOrders = periodOrders.length || 0;
      const totalCustomers = customers?.length || 0;
      const totalProducts = products?.length || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate top products (using periodOrders)
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

      // Calculate top customers (using periodOrders)
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

      // Get recent orders (using ALL orders)
      const recentOrders = orders?.slice(0, 10).map(order => ({
        id: order.id,
        cliente_nome: order.clientes?.nome || 'Cliente não encontrado',
        valor_total: order.valor_total,
        status: order.status,
        created_at: order.created_at
      })) || [];

      // --- CÁLCULO DE CRESCIMENTO MENSAL CORRIGIDO ---
      
      // 1. Buscar clientes do mês atual e anterior
      const { data: currentMonthCustomers, error: currentCustomersError } = await supabase
        .from("clientes")
        .select("id, created_at")
        .gte("created_at", currentMonthStart.toISOString());

      if (currentCustomersError) throw new Error(currentCustomersError.message);

      const { data: previousMonthCustomers, error: previousCustomersError } = await supabase
        .from("clientes")
        .select("id, created_at")
        .gte("created_at", previousMonthStart.toISOString())
        .lte("created_at", previousMonthEnd.toISOString());

      if (previousCustomersError) throw new Error(previousCustomersError.message);

      const currentRevenue = currentMonthOrders.reduce((sum, order) => sum + order.valor_total, 0);
      const previousRevenue = previousMonthOrders.reduce((sum, order) => sum + order.valor_total, 0);

      const monthlyGrowth = {
        revenue: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        orders: previousMonthOrders.length > 0 ? ((currentMonthOrders.length - previousMonthOrders.length) / previousMonthOrders.length) * 100 : 0,
        customers: previousMonthCustomers.length > 0 ? ((currentMonthCustomers.length - previousMonthCustomers.length) / previousMonthCustomers.length) * 100 : 0,
      };
      
      // --- FIM CÁLCULO DE CRESCIMENTO MENSAL CORRIGIDO ---

      // SERVICES REPORT (using periodOrders)
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

      // Group services by name
      const servicesByName = new Map();
      allServices.forEach(service => {
        const existing = servicesByName.get(service.nome) || { 
          totalRevenue: 0, 
          totalCount: 0 
        };
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

      // Services by period (weekly breakdown for current period)
      const servicesByPeriod = [];
      if (selectedPeriod === "week") {
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        for (let i = 0; i < 7; i++) {
          const dayStart = new Date(periodStart);
          dayStart.setDate(periodStart.getDate() + i);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayServices = allServices.filter(service => {
            const serviceDate = new Date(service.order_date);
            return serviceDate >= dayStart && serviceDate <= dayEnd;
          });
          
          servicesByPeriod.push({
            period: daysOfWeek[dayStart.getDay()],
            revenue: dayServices.reduce((sum, service) => sum + service.total_value, 0),
            count: dayServices.reduce((sum, service) => sum + service.quantidade, 0)
          });
        }
      } else if (selectedPeriod === "month") {
        const weeksInMonth = Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) / 7);
        for (let week = 0; week < weeksInMonth; week++) {
          const weekStart = new Date(periodStart);
          weekStart.setDate(1 + (week * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          const weekServices = allServices.filter(service => {
            const serviceDate = new Date(service.order_date);
            return serviceDate >= weekStart && serviceDate <= weekEnd;
          });
          
          servicesByPeriod.push({
            period: `Semana ${week + 1}`,
            revenue: weekServices.reduce((sum, service) => sum + service.total_value, 0),
            count: weekServices.reduce((sum, service) => sum + service.quantidade, 0)
          });
        }
      }

      // METERS REPORT (using periodOrders)
      const totalMeters = periodOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0);
      
      const metersByPeriod: Array<{ period: string; meters: number }> = [];
      
      if (selectedPeriod === "week") {
        const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        for (let i = 0; i < 7; i++) {
          const dayStart = new Date(periodStart);
          dayStart.setDate(periodStart.getDate() + i);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          
          const dayOrders = periodOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= dayStart && orderDate <= dayEnd;
          });
          
          metersByPeriod.push({
            period: daysOfWeek[dayStart.getDay()],
            meters: dayOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0),
          });
        }
      } else if (selectedPeriod === "month") {
        // Agrupar por semana do mês
        const daysInMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
        const weeksInMonth = Math.ceil(daysInMonth / 7);
        
        for (let week = 0; week < weeksInMonth; week++) {
          const weekStart = new Date(periodStart);
          weekStart.setDate(1 + (week * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          const weekOrders = periodOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= weekStart && orderDate <= weekEnd;
          });
          
          metersByPeriod.push({
            period: `Semana ${week + 1}`,
            meters: weekOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0),
          });
        }
      } else if (selectedPeriod === "quarter" || selectedPeriod === "year") {
        // Agrupar por mês
        const numMonths = selectedPeriod === "quarter" ? 3 : 12;
        for (let i = 0; i < numMonths; i++) {
          const monthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + i, 1);
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const monthOrders = periodOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= monthStart && orderDate <= monthEnd;
          });
          
          metersByPeriod.push({
            period: monthStart.toLocaleDateString('pt-BR', { month: 'short' }),
            meters: monthOrders.reduce((sum, order) => sum + (order.total_metros || 0), 0),
          });
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
        }
      };
    },
    enabled: !!supabase,
    refetchInterval: 5 * 60 * 1000,
  });

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
  const uniqueServices = Array.from(new Set(reportData?.servicesReport.servicosDetalhados.map(s => s.nome) || []));

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar relatórios</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER E SELETOR DE PERÍODO */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Relatórios</h1>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Selecione o Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="quarter">Este Trimestre</SelectItem>
              <SelectItem value="year">Este Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics - Visão Geral do Período */}
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-muted-foreground" />
        Métricas Principais ({getPeriodLabel(selectedPeriod)})
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Receita Total */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.totalRevenue)}</div>
            <div className={`text-xs flex items-center ${getGrowthColor(reportData.monthlyGrowth.revenue)}`}>
              {React.createElement(getGrowthIcon(reportData.monthlyGrowth.revenue), { className: "h-3 w-3 mr-1" })}
              {formatGrowth(reportData.monthlyGrowth.revenue)} este mês
            </div>
          </CardContent>
        </Card>

        {/* Total de Pedidos */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalOrders}</div>
            <div className={`text-xs flex items-center ${getGrowthColor(reportData.monthlyGrowth.orders)}`}>
              {React.createElement(getGrowthIcon(reportData.monthlyGrowth.orders), { className: "h-3 w-3 mr-1" })}
              {formatGrowth(reportData.monthlyGrowth.orders)} este mês
            </div>
          </CardContent>
        </Card>
        
        {/* Total de Metros */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Metros (ML)</CardTitle>
            <Ruler className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatMeters(reportData.metersReport.totalMeters)}
            </div>
            <p className="text-xs text-muted-foreground">
              Metragem impressa no período
            </p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(reportData.averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground">
              Por pedido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="py-2">Visão Geral</TabsTrigger>
          <TabsTrigger value="meters" className="py-2">Metragem (ML)</TabsTrigger>
          <TabsTrigger value="services" className="py-2">Serviços</TabsTrigger>
          <TabsTrigger value="products" className="py-2">Produtos</TabsTrigger>
          <TabsTrigger value="customers" className="py-2">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
                <CardDescription>Top 5 produtos por receita ({getPeriodLabel(selectedPeriod)})</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd Vendida</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.topProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{product.nome}</TableCell>
                        <TableCell className="text-center">{product.totalSold}</TableCell>
                        <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Melhores Clientes</CardTitle>
                <CardDescription>Top 5 clientes por valor gasto ({getPeriodLabel(selectedPeriod)})</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.topCustomers.map((customer, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{customer.nome}</TableCell>
                        <TableCell className="text-center">{customer.totalOrders}</TableCell>
                        <TableCell className="text-right">{formatCurrency(customer.totalSpent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recentes</CardTitle>
              <CardDescription>Últimos 10 pedidos realizados (Geral)</CardDescription>
            </CardHeader>
            <CardContent>
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
                    {reportData.recentOrders.map((order) => (
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
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ABA: METRAGEM */}
        <TabsContent value="meters" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Metros Lineares ({getPeriodLabel(selectedPeriod)})</CardTitle>
              <Ruler className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {formatMeters(reportData.metersReport.totalMeters)}
              </div>
              <p className="text-sm text-muted-foreground">
                Metragem impressa no período
              </p>
            </CardContent>
          </Card>
          
          <MetersBarChart 
            data={reportData.metersReport.metersByPeriod.map(d => ({
              period: d.period,
              meters: d.meters
            }))}
            title={`Distribuição da Metragem`}
            description={`Metragem por ${selectedPeriod === 'week' ? 'Dia' : selectedPeriod === 'month' ? 'Semana' : 'Mês'} durante ${getPeriodLabel(selectedPeriod).toLowerCase()}`}
          />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          {/* Services Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita de Serviços</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(reportData.servicesReport.totalServicesRevenue)}
                </div>
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
                <div className="text-2xl font-bold text-primary">
                  {reportData.servicesReport.totalServicesCount}
                </div>
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
                <div className="text-2xl font-bold">
                  {formatCurrency(reportData.servicesReport.averageServiceValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Por serviço
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Services */}
          <Card>
            <CardHeader>
              <CardTitle>Serviços Mais Rentáveis</CardTitle>
              <CardDescription>
                Performance de cada tipo de serviço ({getPeriodLabel(selectedPeriod)})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo de Serviço</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="text-right">Receita Total</TableHead>
                      <TableHead className="text-right">Valor Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.servicesReport.topServices.map((servico, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{servico.nome}</TableCell>
                        <TableCell className="text-center">{servico.totalCount}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(servico.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(servico.averageValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

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
                    <SelectTrigger className="w-48">
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
                      <TableHead className="text-center">Data</TableHead>
                      <TableHead>Pedido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServicos.length > 0 ? (
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
                          <TableCell className="text-center text-sm">
                            {formatDate(servico.data_pedido)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            #{servico.pedido_id.slice(-8)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
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
                  Mostrando {filteredServicos.length} de {reportData.servicesReport.servicosDetalhados.length} serviços
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada de Produtos</CardTitle>
              <CardDescription>Performance completa dos produtos ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Quantidade Vendida</TableHead>
                      <TableHead className="text-right">Receita Total</TableHead>
                      <TableHead className="text-right">Receita Média</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.topProducts.map((product, index) => (
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada de Clientes</CardTitle>
              <CardDescription>Performance completa dos clientes ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
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
                    {reportData.topCustomers.map((customer, index) => (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;