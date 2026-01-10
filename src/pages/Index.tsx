import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DollarSign, Users, Activity, Ruler, Clock, Scissors, Printer, Wrench, Package, CheckSquare, ChevronDown, Sparkles } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useTiposProducao } from "@/hooks/useDataFetch";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionCard } from "@/components/QuickActionCard";
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { DashboardShortcutCard } from "@/components/DashboardShortcutCard"; // Reutilizando o card maior para métricas
import { AIMessagesWidget } from "@/components/AIMessagesWidget";
import { useState, useEffect } from "react";

import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { DailySummaryCard } from "@/components/DailySummaryCard";
import { AIAttentionBubble } from "@/components/AIAttentionBubble";
import { useSession } from "@/contexts/SessionProvider";
import { TutorialGuide } from "@/components/TutorialGuide";
import { useTour } from "@/hooks/useTour";
import { WELCOME_TOUR } from "@/utils/tours";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { data: stats, isLoading, error } = useDashboardData();
  const { data: tiposProducao } = useTiposProducao();
  const { open: openAIAssistant } = useAIAssistant();
  const { isLoading: sessionLoading } = useSession();
  const { isTourOpen, currentStep, steps, startTour, nextStep, prevStep, closeTour, shouldAutoStart } = useTour(WELCOME_TOUR, 'welcome');

  useEffect(() => {
    if (shouldAutoStart && !sessionLoading) {
      const timer = setTimeout(startTour, 2000); // Increased delay
      return () => clearTimeout(timer);
    }
  }, [shouldAutoStart, sessionLoading, startTour]);
  // Estado do acordeão: aberto no desktop, fechado no mobile
  const [accordionValue, setAccordionValue] = useState<string>("");

  // Detectar tamanho da tela e definir estado inicial
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setAccordionValue(isMobile ? "" : "resumo"); // Fechado no mobile, aberto no desktop
  }, []);

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

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-green-600' : 'text-red-600';
  };

  if (error) {
    console.error('[Dashboard] Erro ao carregar dados:', error);
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar dados do dashboard</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    );
  }

  // Log para debug
  console.log('[Dashboard] Estado:', { isLoading, hasData: !!stats, error: !!error });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-left">Dashboard</h1>

      <div id="ai-assistant-widget" className="grid gap-6 md:grid-cols-2 mb-6">
        <div className="relative">
          <AIAttentionBubble />
          <AIMessagesWidget />
        </div>

        {/* Resumo Diário com Acordeão */}
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
          className="w-full"
        >
          <AccordionItem value="resumo" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <span className="text-lg font-semibold flex items-center gap-2">
                <span className="bg-yellow-100 text-yellow-700 p-1 rounded">💰</span> Resumo Rápido
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <DailySummaryCard />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Ações Rápidas */}
      <div id="quick-actions-container">
        <DashboardQuickActions />
      </div>

      {/* Status dos Pedidos */}
      <div id="status-charts-container" className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-600 p-1 rounded">📊</span> Status dos Pedidos
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4"> {/* Layout mais compacto */}
          <QuickActionCard
            title="Pendentes"
            icon={Clock}
            to="/pedidos"
            filterState={{ filterStatus: 'pendente' }}
            count={isLoading ? '...' : stats?.pendingOrdersCount}
          />
          <QuickActionCard
            title="Processando"
            icon={Wrench}
            to="/pedidos"
            filterState={{ filterStatus: 'processando' }}
            count={isLoading ? '...' : stats?.processingOrdersCount}
          />
          <QuickActionCard
            title="Faltam Pagar"
            icon={DollarSign}
            to="/pedidos"
            filterState={{ filterStatus: 'pendente-pagamento' }}
            count={isLoading ? '...' : stats?.pendingPaymentOrdersCount}
          />
          <QuickActionCard
            title="Aguardando"
            icon={Package}
            to="/pedidos"
            filterState={{ filterStatus: 'aguardando retirada' }}
            count={isLoading ? '...' : stats?.awaitingPickupOrdersCount}
          />
          <QuickActionCard
            title="Entregues"
            icon={CheckSquare}
            to="/pedidos"
            filterState={{ filterStatus: 'entregue' }}
            count={isLoading ? '...' : stats?.deliveredOrdersCount}
          />
        </div>
      </div>

      {/* Cards de Visão Geral - Usando DashboardShortcutCard para melhor visualização */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <DashboardShortcutCard
          title="Vendas Totais"
          icon={DollarSign}
          to="/reports"
          loading={isLoading}
          count={formatCurrency(stats?.totalSales || 0)}
          className={getGrowthColor(stats?.salesGrowth || 0)}
        >
          <p className={`text-xs ${getGrowthColor(stats?.salesGrowth || 0)}`}>
            {formatGrowth(stats?.salesGrowth || 0)} do último mês
          </p>
        </DashboardShortcutCard>

        <DashboardShortcutCard
          title="Total de Metros (ML)"
          icon={Ruler}
          to="/reports"
          loading={isLoading}
          count={formatMeters(stats?.totalMeters || 0)}
          className={getGrowthColor(stats?.metersGrowth || 0)}
        >
          <div className="flex flex-col gap-1">
            <p className={`text-xs ${getGrowthColor(stats?.metersGrowth || 0)}`}>
              {formatGrowth(stats?.metersGrowth || 0)} do último mês
            </p>
            {!isLoading && stats?.productionTotals && Object.keys(stats.productionTotals).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1 border-t pt-1 border-gray-100 dark:border-gray-800">
                {Object.entries(stats.productionTotals).map(([tipo, total]) => {
                  const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                  const isVinil = tipo === 'vinil';
                  const isDTF = tipo === 'dtf';
                  const isUnidade = tipoInfo?.unidade_medida === 'unidade';

                  let Icon = Ruler;
                  let colorClass = "text-gray-600 bg-gray-50 dark:bg-gray-900/20";

                  if (isVinil) {
                    Icon = Scissors;
                    colorClass = "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
                  } else if (isDTF) {
                    Icon = Printer;
                    colorClass = "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
                  } else if (tipoInfo) {
                    Icon = isUnidade ? Package : Ruler;
                    colorClass = "text-primary bg-primary/5 dark:bg-primary/900/20";
                  }

                  return (
                    <span key={tipo} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1", colorClass)}>
                      <Icon className="h-2.5 w-2.5" /> {total.toFixed(isUnidade ? 0 : 1)}{isUnidade ? 'und' : 'm'}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </DashboardShortcutCard>

        <DashboardShortcutCard
          title="Novos Clientes"
          icon={Users}
          to="/clientes"
          loading={isLoading}
          count={`+${stats?.newCustomers || 0}`}
          className={getGrowthColor(stats?.customersGrowth || 0)}
        >
          <p className={`text-xs ${getGrowthColor(stats?.customersGrowth || 0)}`}>
            {formatGrowth(stats?.customersGrowth || 0)} do último mês
          </p>
        </DashboardShortcutCard>

        <DashboardShortcutCard
          title="Ticket Médio"
          icon={Activity}
          to="/reports"
          loading={isLoading}
          count={formatCurrency(stats?.averageTicket || 0)}
          className={getGrowthColor(stats?.ticketGrowth || 0)}
        >
          <p className={`text-xs ${getGrowthColor(stats?.ticketGrowth || 0)}`}>
            {formatGrowth(stats?.ticketGrowth || 0)} do último mês
          </p>
        </DashboardShortcutCard>
      </div>

      <div className="mt-8 text-center space-y-4">
        <p className="text-lg text-muted-foreground">
          Bem-vindo ao seu assistente de vendas!
        </p>
        {!isTourOpen && (
          <Button
            variant="outline"
            size="sm"
            onClick={startTour}
            className="text-xs text-primary bg-primary/5 border-primary/20 hover:bg-primary/10"
          >
            <Sparkles className="mr-2 h-3 w-3" />
            Reiniciar Tutorial
          </Button>
        )}
      </div>

      <TutorialGuide
        steps={steps}
        isOpen={isTourOpen}
        currentStep={currentStep}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={closeTour}
      />
    </div>
  );
};

export default Index;