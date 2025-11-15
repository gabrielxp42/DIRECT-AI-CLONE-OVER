import React, { useState, useMemo } from 'react';
import { useServiceCommissionReport } from '@/hooks/useServiceCommissionReport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Wrench, CalendarIcon, Loader2, Clock, TrendingUp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// Define a semana de trabalho: Terça (2) a Sábado (6)
const WORK_WEEK_START_DAY = 2; // Terça-feira (0=Dom, 1=Seg, 2=Ter...)
const WORK_WEEK_END_DAY = 6; // Sábado

const getWorkWeekRange = (date: Date) => {
  const today = startOfDay(date);
  let start = today;
  let end = today;
  const dayOfWeek = date.getDay();

  // 1. Encontrar o início da semana de trabalho (Terça)
  // Se for Terça (2), Quarta (3), Quinta (4), Sexta (5), Sábado (6), o início é a Terça atual.
  // Se for Domingo (0) ou Segunda (1), o início é a Terça anterior.
  
  if (dayOfWeek === 0) { // Domingo
    start = subDays(today, 5); // Início na Terça anterior (5 dias atrás)
  } else if (dayOfWeek === 1) { // Segunda
    start = subDays(today, 6); // Início na Terça anterior (6 dias atrás)
  } else {
    // Se for Terça a Sábado, subtrai os dias para chegar na Terça (dia 2)
    start = subDays(today, dayOfWeek - WORK_WEEK_START_DAY);
  }
  
  // 2. Encontrar o fim da semana de trabalho (Sábado)
  // O fim é sempre o Sábado após a data de início.
  end = addDays(start, WORK_WEEK_END_DAY - WORK_WEEK_START_DAY);
  
  // Garantir que o fim seja 23:59:59.999
  end = endOfDay(end);

  return { start, end };
};

export const ServiceCommissionReport: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  const { data: report, isLoading, error } = useServiceCommissionReport(
    dateRange.from || null,
    dateRange.to || null,
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Relatório de Serviços (Comissão)
        </CardTitle>
        <CardDescription>
          Total de serviços de arte realizados no período, excluindo itens como Sedex.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Seletor de Período */}
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
              Serviços Excluídos
            </CardTitle>
            <CardContent className="p-0 pt-2">
              <div className="text-lg font-bold mt-1">
                <Badge variant="secondary">Sedex</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Não contam para comissão
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Detalhes */}
        <h3 className="text-lg font-semibold pt-4 border-t flex items-center gap-2">
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
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum serviço de comissão encontrado no período.</TableCell></TableRow>
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
      </CardContent>
    </Card>
  );
};