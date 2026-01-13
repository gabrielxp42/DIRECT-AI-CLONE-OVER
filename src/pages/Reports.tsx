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
import { useTiposProducao } from "@/hooks/useDataFetch";
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
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Clock,
  Printer,
  Scissors,
  CalendarIcon,
  Ruler,
  HelpCircle,
  BarChart3,
  User,
  Wrench,
  FileText,
  Filter,
  ChevronDown,
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
import { DateRange } from "react-day-picker";
import { EmptyState } from "@/components/EmptyState";
import { useTour } from "@/hooks/useTour";
import { REPORTS_TOUR } from "@/utils/tours";
import { TutorialGuide } from "@/components/TutorialGuide";
import { fetchReportData, SalesReport } from "@/utils/reportUtils";

const Reports: React.FC = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const accessToken = session?.access_token;
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined); // Usar DateRange | undefined
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedService, setSelectedService] = useState("all");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [chartView, setChartView] = useState<'summary' | 'daily'>('daily'); // NOVO: Controle de visualização
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const { isTourOpen, currentStep, steps, startTour, nextStep, prevStep, closeTour } = useTour(REPORTS_TOUR, 'reports_page_tour');



  // Validação crítica: só executar se sessão não estiver carregando E token estiver disponível
  const isEnabled = !sessionLoading && !!accessToken;

  const { data: reportData, isLoading, error } = useQuery<SalesReport>({
    queryKey: ["comprehensive-report", selectedPeriod, customDateRange, chartView, selectedYear],
    queryFn: () => {
      if (!accessToken) {
        throw new Error("Sem token de acesso para fetch.");
      }
      return fetchReportData(accessToken, selectedPeriod, customDateRange, chartView, selectedYear);
    },
    enabled: isEnabled, // Aguardar sessão carregar antes de executar
    staleTime: 0, // Sempre considerar stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente monta
  });

  const { data: tiposProducao } = useTiposProducao();

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
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <h1 className="text-xl md:text-3xl font-bold">Relatórios</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={startTour}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Como ler os dados</span>
          </Button>
        </div>
      </div>

      {/* SELEÇÃO DE PERÍODO REIMAGINADA */}
      <div id="reports-period-selector" className="flex flex-col md:flex-row md:items-center gap-3">
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

        {/* Seletor de Ano (Visível apenas se 'year' selecionado) */}
        {selectedPeriod === 'year' && (
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Seletor de Data Personalizado */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          {/* ... existing popover content ... */}
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
        <Card id="reports-revenue-card" className="hover:shadow-lg transition-shadow">
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
        <Card id="reports-meters-card" className="hover:shadow-lg transition-shadow">
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
                <div className="flex flex-col gap-0.5 mt-1 border-t pt-1 border-gray-100 dark:border-gray-800">
                  {reportData?.metersReport.totalsByType && Object.entries(reportData.metersReport.totalsByType).map(([tipo, total]) => {
                    const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                    const isVinil = tipo === 'vinil';
                    const isDTF = tipo === 'dtf';
                    const isUnidade = tipoInfo?.unidade_medida === 'unidade';

                    let Icon = Ruler;
                    let textColor = "text-gray-600";
                    let label = tipoInfo?.nome || tipo.toUpperCase();

                    if (isVinil) {
                      Icon = Scissors;
                      textColor = "text-orange-700";
                    } else if (isDTF) {
                      Icon = Printer;
                      textColor = "text-blue-700";
                    } else if (tipoInfo) {
                      Icon = isUnidade ? Package : Ruler;
                      textColor = "text-primary";
                    }

                    return (
                      <div key={tipo} className="flex items-center justify-between text-[10px] md:text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Icon className="h-3 w-3" /> {label}
                        </span>
                        <span className={cn("font-semibold", textColor)}>
                          {(total as number).toFixed(isUnidade ? 0 : 1)}{isUnidade ? 'und' : 'm'}
                        </span>
                      </div>
                    );
                  })}
                </div>
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

        {/* Lucro Estimado */}
        <Card id="reports-profit-card" className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Lucro Estimado</CardTitle>
            <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            {isLoading ? <Skeleton className="h-6 md:h-8 w-3/4" /> : (
              <>
                <div className="text-lg md:text-2xl font-bold text-green-600">
                  {formatCurrency(reportData?.totalProfit || 0)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Margem: <span className="font-bold text-foreground">{reportData?.profitMargin.toFixed(1)}%</span>
                </div>
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
              <div id="reports-charts-section" className="flex items-center gap-2">
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
      <Tabs id="reports-tabs-section" defaultValue="commission" className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="grid w-max md:w-full grid-cols-4 h-auto">
            <TabsTrigger value="commission" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Comissão</span>
              <span className="sm:hidden">Com.</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="py-2 px-3 md:px-4 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Financeiro</span>
              <span className="sm:hidden">Fin.</span>
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

        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Confirmada</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(reportData?.financialReport?.totalPaid || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pago, Entregue, Enviado</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Pendente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(reportData?.financialReport?.totalPending || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pendente, Processando</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita Perdida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(reportData?.financialReport?.totalCancelled || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pedidos Cancelados</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento por Status</CardTitle>
              <CardDescription>Visão detalhada do faturamento por status do pedido ({getPeriodLabel(selectedPeriod)})</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Qtd Pedidos</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData?.financialReport?.byStatus?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{item.count}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.value)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {reportData.totalRevenue > 0
                              ? ((item.value / reportData.totalRevenue) * 100).toFixed(1)
                              : 0}%
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

      <TutorialGuide
        isOpen={isTourOpen}
        currentStep={currentStep}
        steps={steps}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={closeTour}
      />
    </div>
  );
};

export default Reports;