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
  Loader2,
  Share2
} from "lucide-react";

import { MetersBarChart } from '@/components/MetersBarChart';
import { RevenueLineChart } from '@/components/RevenueLineChart';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
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
import { ReportsGabiInsight } from "@/components/ReportsGabiInsight";

const Reports: React.FC = () => {
  const { session, isLoading: sessionLoading, organizationId } = useSession();
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
      return fetchReportData(
        accessToken,
        selectedPeriod,
        customDateRange,
        chartView,
        selectedYear,
        session?.user?.id,
        organizationId
      );
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

      {/* SELEÇÃO DE PERÍODO UNIFICADA (CIRÚRGICO) */}
      <div id="reports-period-selector" className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
        <h2 className="text-base md:text-xl font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          <span className="text-sm md:text-base">Período:</span>

          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 sm:items-center bg-background/50 dark:bg-slate-900/50 p-1 rounded-xl border border-border/50 backdrop-blur-md w-full sm:w-auto shadow-sm">
            <ToggleGroup
              type="single"
              value={selectedPeriod}
              onValueChange={(value) => {
                if (value) setSelectedPeriod(value);
              }}
              className="w-full sm:w-auto grid grid-cols-4 sm:flex gap-1"
            >
              <ToggleGroupItem value="today" size="sm" className="data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm text-[10px] sm:text-xs font-bold transition-all px-2 sm:px-3 rounded-lg h-7 sm:h-8">
                Hoje
              </ToggleGroupItem>
              <ToggleGroupItem value="week" size="sm" className="data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm text-[10px] sm:text-xs font-bold transition-all px-2 sm:px-3 rounded-lg h-7 sm:h-8">
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm" className="data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm text-[10px] sm:text-xs font-bold transition-all px-2 sm:px-3 rounded-lg h-7 sm:h-8">
                Mês
              </ToggleGroupItem>
              <ToggleGroupItem value="year" size="sm" className="data-[state=on]:bg-white dark:data-[state=on]:bg-slate-800 data-[state=on]:shadow-sm text-[10px] sm:text-xs font-bold transition-all px-2 sm:px-3 rounded-lg h-7 sm:h-8">
                Ano
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="h-4 w-px bg-border/40 hidden sm:block" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "justify-center sm:justify-start text-left font-semibold h-7 sm:h-8 text-[10px] sm:text-xs w-full sm:w-auto",
                    !customDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {customDateRange?.from ? (
                    customDateRange.to ? (
                      <>
                        {format(customDateRange.from, "dd/MM", { locale: ptBR })} -{" "}
                        {format(customDateRange.to, "dd/MM", { locale: ptBR })}
                      </>
                    ) : (
                      format(customDateRange.from, "dd/MM", { locale: ptBR })
                    )
                  ) : (
                    <span>Personalizar</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <DatePicker
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange?.from}
                  selected={customDateRange}
                  onSelect={(range) => {
                    setCustomDateRange(range);
                    if (range?.from) {
                      setSelectedPeriod('custom');
                    }
                  }}
                  numberOfMonths={1}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </h2>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex gap-2 text-xs"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
          <Button
            size="sm"
            onClick={(e) => {
              if (!reportData) return;
              const summary = `📊 *Resumo Direct AI*
📅 Período: ${getPeriodLabel(selectedPeriod)}
💰 Receita: ${formatCurrency(reportData.totalRevenue)}
📦 Pedidos: ${reportData.totalOrders}
📏 Metragem: ${formatMeters(reportData.metersReport.totalMeters)}
${reportData.topCustomers?.[0] ? `🏆 Top Cliente: ${reportData.topCustomers[0].nome}` : ''}

_Gerado por Direct AI_`;
              navigator.clipboard.writeText(summary);
              // Feedback visual simples
              const btn = e.currentTarget;
              const icon = btn.querySelector('svg');
              const textSpan = btn.querySelector('span') || btn.lastChild;

              if (textSpan) {
                const originalText = textSpan.textContent;
                textSpan.textContent = "Copiado!";
                setTimeout(() => textSpan.textContent = originalText, 2000);
              }
            }}
            className="gap-2 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/20"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Compartilhar Resumo</span>
          </Button>
        </div>
      </div>

      {/* Key Metrics - Visão Geral do Período */}
      {/* Bento Grid - Layout Inteligente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Coluna da Esquerda: KPIs Financeiros e de Vendas (2x2) */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">

          {/* Receita Total */}
          <Card id="reports-revenue-card" className="hover:shadow-md transition-all border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                <>
                  <div className="text-xl sm:text-2xl font-black text-foreground">{formatCurrency(reportData?.totalRevenue || 0)}</div>
                  <div className={`text-xs flex items-center mt-1 font-medium ${getGrowthColor(reportData?.monthlyGrowth.revenue || 0)}`}>
                    {React.createElement(getGrowthIcon(reportData?.monthlyGrowth.revenue || 0), { className: "h-3 w-3 mr-1" })}
                    {formatGrowth(reportData?.monthlyGrowth.revenue || 0)} este mês
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Lucro Estimado (Movido para cima para agrupar co Receita) */}
          <Card id="reports-profit-card" className="hover:shadow-md transition-all border-l-4 border-l-emerald-600 shadow-sm bg-emerald-50/30 dark:bg-emerald-950/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Lucro Estimado</CardTitle>
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-1 rounded-full">
                <DollarSign className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                <>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(reportData?.totalProfit || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    Margem: <Badge variant="outline" className="h-5 px-1.5 font-bold border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-transparent dark:text-emerald-400">{reportData?.profitMargin.toFixed(0)}%</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pedidos */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Pedidos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : (
                <>
                  <div className="text-xl sm:text-2xl font-black text-foreground">{reportData?.totalOrders || 0}</div>
                  <div className={`text-xs flex items-center mt-1 font-medium ${getGrowthColor(reportData?.monthlyGrowth.orders || 0)}`}>
                    {React.createElement(getGrowthIcon(reportData?.monthlyGrowth.orders || 0), { className: "h-3 w-3 mr-1" })}
                    {formatGrowth(reportData?.monthlyGrowth.orders || 0)} este mês
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Ticket Médio */}
          <Card className="hover:shadow-md transition-all border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Ticket Médio</CardTitle>
              <div className="bg-purple-100 dark:bg-purple-900/50 p-1 rounded-full">
                <Package className="h-3 w-3 text-purple-700 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                <>
                  <div className="text-xl sm:text-2xl font-black text-foreground">{formatCurrency(reportData?.averageOrderValue || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Por pedido realizado
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna da Direita: Consumo de Material (Ocupa toda a altura) */}
        <div className="lg:col-span-1">
          <Card id="reports-meters-card" className="hover:shadow-md transition-all shadow-sm h-full flex flex-col border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 bg-blue-50/80 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold text-blue-800 dark:text-blue-300">Consumo de Mídia</CardTitle>
                <CardDescription className="text-[10px] text-blue-600/80 font-medium">Metragem linear e unidades</CardDescription>
              </div>
              <div className="bg-blue-100 dark:bg-blue-800 p-1.5 rounded-md">
                <Ruler className="h-4 w-4 text-blue-700 dark:text-blue-300" />
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 space-y-4">
              {isLoading ? <Skeleton className="h-full w-full" /> : (
                (() => {
                  const entries = reportData?.metersReport.totalsByType ? Object.entries(reportData.metersReport.totalsByType) : [];
                  const metricItems = entries.filter(([tipo]) => {
                    const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                    return !tipoInfo || tipoInfo.unidade_medida !== 'unidade';
                  });
                  const unitItems = entries.filter(([tipo]) => {
                    const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                    return tipoInfo?.unidade_medida === 'unidade';
                  });

                  return (
                    <div className="space-y-4">
                      {/* Bloco 1: Rolos */}
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Total Linear</span>
                          <span className="text-2xl font-black text-blue-600 tracking-tight">{formatMeters(reportData?.metersReport.totalMeters || 0)}</span>
                        </div>
                        <div className="space-y-1.5">
                          {metricItems.map(([tipo, total]) => {
                            const isVinil = tipo === 'vinil';
                            return (
                              <div key={tipo} className="flex justify-between items-center text-xs p-1.5 bg-background rounded border border-border/50">
                                <span className={cn("capitalize flex items-center gap-1.5 font-semibold", isVinil ? "text-orange-600" : "text-blue-600")}>
                                  {isVinil ? <Scissors className="h-3 w-3" /> : <Printer className="h-3 w-3" />}
                                  {tipo}
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                  {(total as number).toFixed(2)}m
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {unitItems.length > 0 && (
                        <div className="pt-2 border-t border-dashed">
                          {(() => {
                            const retailRevenue = unitItems.reduce((acc, [tipo]) => {
                              return acc + (reportData?.metersReport.revenueByType?.[tipo] || 0);
                            }, 0);
                            return (
                              <div className="flex justify-between items-baseline mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Unidades & Varejo</span>
                                <span className="text-xs font-bold text-emerald-600 tracking-tight">{formatCurrency(retailRevenue)}</span>
                              </div>
                            );
                          })()}
                          <div className="grid grid-cols-2 gap-2">
                            {unitItems.map(([tipo, total]) => (
                              <div key={tipo} className="bg-background p-2 rounded border border-border/50 text-center flex flex-col justify-center min-h-[50px]">
                                <div className="text-[9px] uppercase font-bold text-muted-foreground truncate mb-0.5">{tipo}</div>
                                <div className="text-sm font-black text-foreground">{(total as number).toFixed(0)}</div>
                                <div className="text-[10px] text-emerald-600/80 font-medium">
                                  {formatCurrency(reportData?.metersReport.revenueByType?.[tipo] || 0)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gabi AI Partner Insight */}
      <div id="reports-gabi-insight">
        <ReportsGabiInsight reportData={reportData} isLoading={isLoading} />
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