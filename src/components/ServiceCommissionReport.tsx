import React, { useState, useMemo } from 'react';
import { useServiceCommissionReport, DetailedServiceItem } from '@/hooks/useServiceCommissionReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Wrench, CalendarIcon, Loader2, Clock, TrendingUp, Filter, User, ShoppingCart } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PedidoStatus } from '@/types/pedido';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrderStatusBadge } from './OrderStatusBadge';
import { useIsMobile } from '@/hooks/use-mobile';

// Define a semana de trabalho: Terça (2) a Sábado (6)
const WORK_WEEK_START_DAY = 2; // Terça-feira (0=Dom, 1=Seg, 2=Ter...)
const WORK_WEEK_END_DAY = 6; // Sábado

const getWorkWeekRange = (date: Date) => {
  const today = startOfDay(date);
  let start = today;
  let end = today;
  const dayOfWeek = date.getDay();

  // 1. Encontrar o início da semana de trabalho (Terça)
  if (dayOfWeek === 0) { // Domingo
    start = subDays(today, 5); // Início na Terça anterior (5 dias atrás)
  } else if (dayOfWeek === 1) { // Segunda
    start = subDays(today, 6); // Início na Terça anterior (6 dias atrás)
  } else {
    // Se for Terça a Sábado, subtrai os dias para chegar na Terça (dia 2)
    start = subDays(today, dayOfWeek - WORK_WEEK_START_DAY);
  }
  
  // 2. Encontrar o fim da semana de trabalho (Sábado)
  end = addDays(start, WORK_WEEK_END_DAY - WORK_WEEK_START_DAY);
  
  // Garantir que o fim seja 23:59:59.999
  end = endOfDay(end);

  return { start, end };
};

const statusOptions: { value: PedidoStatus[] | 'all', label: string }[] = [
  { value: 'all', label: 'Todos os Status' },
  { value: ['pago', 'entregue', 'enviado', 'aguardando retirada'], label: 'Comissão Paga (Concluídos)' },
  { value: ['pago'], label: 'Apenas Pagos' },
  { value: ['pendente', 'processando'], label: 'Comissão Pendente (Em Aberto)' },
];

export const ServiceCommissionReport: React.FC = () => {
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('pago'); // Default para 'pago'
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');

  // Calcula o intervalo da semana de trabalho com base na data atual
  const { start: defaultStart, end: defaultEnd } = useMemo(() => getWorkWeekRange(currentDate), [currentDate]);
  
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: defaultStart,
    to: defaultEnd,
  });

  // Atualiza o range quando a data base muda (ex: ao carregar o componente)
  React.useEffect(() => {
    setDateRange({ from: defaultStart, to: defaultEnd });
  }, [defaultStart, defaultEnd]);

  const requiredStatusArray = useMemo(() => {
    const status = statusOptions.find(opt => 
      (Array.isArray(opt.value) ? opt.value.join(',') : opt.value) === selectedStatus
    );
    return status?.value || 'all';
  }, [selectedStatus]);

  const { data: report, isLoading, error } = useServiceCommissionReport(
    dateRange.from || null,
    dateRange.to || null,
    requiredStatusArray as PedidoStatus[] | 'all',
    ['Sedex', 'sedex', 'SEDEX'] // Excluir Sedex
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range.to) {
      // Se um range completo for selecionado, use-o
      setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
      setIsDatePickerOpen(false);
    } else if (range?.from) {
      // Se apenas o início for selecionado, use o dia inteiro
      setDateRange({ from: startOfDay(range.from), to: endOfDay(range.from) });
    } else {
      setDateRange({});
    }
  };

  const handlePreviousWeek = () => {
    const newDate = subDays(currentDate, 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addDays(currentDate, 7);
    setCurrentDate(newDate);
  };

  const displayRange = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      const from = format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR });
      const to = format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR });
      return from === to ? from : `${from} - ${to}`;
    }
    return 'Selecione um período';
  }, [dateRange]);

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Relatório de Serviços (Comissão)
        </CardTitle>
        <CardDescription>
          Total de serviços de arte realizados no período, filtrado por status de pagamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Seletor de Período e Status */}
        <div className="flex flex-col gap-3 border-b pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="icon" onClick={handlePreviousWeek} disabled={isLoading}>
                <span className="sr-only">Semana Anterior</span>
                {'<'}
              </Button>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-64 justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                    disabled={isLoading}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {displayRange}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={handleNextWeek} disabled={isLoading}>
                <span className="sr-only">Próxima Semana</span>
                {'>'}
              </Button>
            </div>
            
            <div className="w-full sm:w-auto">
              <Button 
                variant="secondary" 
                onClick={() => setCurrentDate(new Date())}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <Clock className="h-4 w-4 mr-2" />
                Semana Atual
              </Button>
            </div>
          </div>
          
          {/* Filtro de Status */}
          <div className="flex items-center gap-2 w-full">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={selectedStatus} onValueChange={handleStatusChange} disabled={isLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por status de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem 
                    key={Array.isArray(opt.value) ? opt.value.join(',') : opt.value} 
                    value={Array.isArray(opt.value) ? opt.value.join(',') : opt.value}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Métricas de Comissão */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-green-500">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Total de Serviços
            </CardTitle>
            <CardContent className="p-0 pt-2">
              {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(report?.totalCommissionRevenue || 0)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Valor base para comissão
              </p>
            </CardContent>
          </Card>
          
          <Card className="p-4 border-l-4 border-primary">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Serviços (Qtd)
            </CardTitle>
            <CardContent className="p-0 pt-2">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : (
                <div className="text-2xl font-bold text-primary">
                  {report?.totalServicesCount || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Itens de serviço únicos
              </p>
            </CardContent>
          </Card>
          
          <Card className="p-4 border-l-4 border-blue-500">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Envolvidos
            </CardTitle>
            <CardContent className="p-0 pt-2">
              {isLoading ? <Skeleton className="h-8 w-1/2" /> : (
                <div className="text-2xl font-bold text-blue-600">
                  {report?.items.reduce((sum, item) => sum + item.order_count, 0) || 0}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Pedidos com serviços no filtro
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs para Resumo e Detalhes */}
        <div className="flex border-b">
          <Button 
            variant="ghost" 
            className={cn("rounded-none border-b-2", activeTab === 'summary' ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            onClick={() => setActiveTab('summary')}
          >
            Resumo por Serviço
          </Button>
          <Button 
            variant="ghost" 
            className={cn("rounded-none border-b-2", activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            onClick={() => setActiveTab('details')}
          >
            Detalhes por Pedido
          </Button>
        </div>

        {/* Conteúdo da Tab: Resumo */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Detalhes por Tipo de Serviço
            </h3>
            
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-center">Qtd Total</TableHead>
                    <TableHead className="text-center">Pedidos</TableHead>
                    <TableHead className="text-right">Receita (Comissão)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : report?.items.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum serviço de comissão encontrado no período com o status selecionado.</TableCell></TableRow>
                  ) : (
                    report?.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.service_name}</TableCell>
                        <TableCell className="text-center">{item.total_quantity}</TableCell>
                        <TableCell className="text-center">{item.order_count}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(item.total_revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Conteúdo da Tab: Detalhes */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              Serviços por Pedido e Cliente
            </h3>
            
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Data</TableHead>
                    <TableHead className="w-[80px]">Pedido</TableHead>
                    <TableHead className="w-[150px]">Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-center w-[60px]">Qtd</TableHead>
                    <TableHead className="text-right w-[100px]">Valor Unit.</TableHead>
                    <TableHead className="text-right w-[100px]">Total</TableHead>
                    <TableHead className="text-center w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : report?.detailedItems.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum serviço detalhado encontrado com os filtros aplicados.</TableCell></TableRow>
                  ) : (
                    report?.detailedItems.map((item: DetailedServiceItem) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {item.order_date_formatted}
                        </TableCell>
                        <TableCell className="font-medium text-sm whitespace-nowrap">
                          #{item.order_number}
                        </TableCell>
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {item.client_name}
                        </TableCell>
                        <TableCell className="text-sm">{item.service_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(item.unit_value)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap">
                          {formatCurrency(item.total_value)}
                        </TableCell>
                        <TableCell className="text-center">
                          <OrderStatusBadge status={item.order_status} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};