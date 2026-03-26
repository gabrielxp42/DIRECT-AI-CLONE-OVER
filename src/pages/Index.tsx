import {
  DollarSign, Users, Activity, Ruler, Clock, Scissors, Printer, Wrench, Package, CheckSquare, ChevronDown, Sparkles, Trophy, Zap, TrendingUp, Bot, Layers
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useTiposProducao } from "@/hooks/useDataFetch";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionCard } from "@/components/QuickActionCard";
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { DashboardShortcutCard } from "@/components/DashboardShortcutCard";
import { AIMessagesWidget } from "@/components/AIMessagesWidget";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

import { DashboardQuickActions } from "@/components/DashboardQuickActions";
import { DailySummaryCard } from "@/components/DailySummaryCard";
import { SmartGoalCard } from '@/components/SmartGoalCard';
import { AIAttentionBubble } from "@/components/AIAttentionBubble";
import { AILowStockAlert } from "@/components/AILowStockAlert";
import { AITrainingProgressCard } from "@/components/AITrainingProgressCard";
import { useSession } from "@/contexts/SessionProvider";
import { TutorialGuide } from "@/components/TutorialGuide";
import { useTour } from "@/hooks/useTour";
import { WELCOME_TOUR } from "@/utils/tours";
import { Button } from "@/components/ui/button";
import { ShippingFeatureModal } from "@/components/modals/ShippingFeatureModal";
import './Dashboard.css';

const Index = () => {
  const { data: stats, isLoading, error } = useDashboardData();
  const { data: tiposProducao } = useTiposProducao();
  const { open: openAIAssistant } = useAIAssistant();
  const { isLoading: sessionLoading, activeSubProfile, profile, hasPermission } = useSession();
  const isBoss = !profile?.is_multi_profile_enabled || activeSubProfile?.role === 'chefe';
  const canViewFinancials = hasPermission('view_financial_dashboard') || hasPermission('view_financial_goals');
  const { isTourOpen, currentStep, steps, startTour, nextStep, prevStep, closeTour, shouldAutoStart } = useTour(WELCOME_TOUR, 'welcome');

  useEffect(() => {
    if (shouldAutoStart && !sessionLoading) {
      const timer = setTimeout(startTour, 5000);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoStart, sessionLoading, startTour]);

  const [accordionValue, setAccordionValue] = useState<string>("");
  const [showShippingFeature, setShowShippingFeature] = useState(false);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    setAccordionValue(isMobile ? "" : "resumo");

    const hasSeenFeature = localStorage.getItem('has_seen_shipping_feature_v3.4');
    if (!hasSeenFeature) {
      setTimeout(() => setShowShippingFeature(true), 1500);
    }
  }, []);

  const handleCloseShippingFeature = () => {
    setShowShippingFeature(false);
    localStorage.setItem('has_seen_shipping_feature_v3.4', 'true');
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

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? 'text-cyan-400' : 'text-rose-400';
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

  return (
    <div className="dashboard-container pb-24 px-2 md:px-6 w-full max-w-[100vw] overflow-x-hidden box-border">
      {/* Background Elements */}
      <div className="dashboard-bg-blobs">
        <div className="dashboard-blob dashboard-blob-1" />
        <div className="dashboard-blob dashboard-blob-2" />
      </div>

      <header className="relative z-10 flex justify-between items-center mb-6 md:mb-10 pt-4 px-2 md:px-0">
        <div>
          <h1 className="text-3xl md:text-5xl font-black dashboard-title-gradient italic uppercase tracking-tighter">
            Dashboard
          </h1>
          <p className="text-[10px] md:text-xs font-bold text-muted-foreground tracking-widest uppercase mt-1 md:mt-2 opacity-50">Direct AI Ecosystem</p>
        </div>
        <div className="hidden md:flex gap-3">
           <Button variant="ghost" size="icon" className="dashboard-glass-card rounded-full" style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 10px var(--primary-custom), inset 0 0 5px var(--primary-custom)' }}>
             <Activity className="w-4 h-4" />
           </Button>
           <Button variant="ghost" size="icon" className="dashboard-glass-card rounded-full" style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 10px var(--primary-custom), inset 0 0 5px var(--primary-custom)' }}>
             <TrendingUp className="w-4 h-4" />
           </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-8 items-start relative z-10 w-full max-w-full">
        <div id="ai-assistant-widget" className="lg:col-span-12 xl:col-span-8 flex flex-col gap-4 min-w-0 w-full overflow-hidden">
          <div onClick={openAIAssistant} className="dashboard-glass-card p-4 md:p-6 shadow-lg relative overflow-hidden group cursor-pointer w-full flex flex-col mx-auto" style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 15px var(--primary-custom), inset 0 0 5px var(--primary-custom)' }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
               <Bot className="w-24 h-24 md:w-32 md:h-32" />
            </div>
            <div className="relative z-10 space-y-4 w-full flex-1 min-w-0">
              <AILowStockAlert />
              <AIAttentionBubble />
              <AIMessagesWidget />
            </div>
          </div>
        </div>

        <div id="onboarding-container" className="lg:col-span-12 xl:col-span-4 h-full min-w-0 w-full overflow-hidden flex flex-col">
            <div className="dashboard-glass-card p-4 md:p-6 h-full flex flex-col overflow-hidden w-full flex-1 mx-auto" style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 15px var(--primary-custom), inset 0 0 5px var(--primary-custom)' }}>
              <div className="flex items-center gap-3 mb-4 md:mb-6 shrink-0">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner shrink-0">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black uppercase tracking-tight truncate">Minhas Metas</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60 truncate">Evolução do seu negócio</p>
                </div>
              </div>
              <div className="w-full flex-1 overflow-y-auto overflow-x-hidden min-h-[250px]">
                <SmartGoalCard stats={stats} />
              </div>
           </div>
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 relative z-10 mb-8 w-full max-w-full">
        <div id="quick-metrics" className="w-full min-w-0">
          <DailySummaryCard />
        </div>
        <div className="md:col-span-1 lg:col-span-2 w-full min-w-0">
          <AITrainingProgressCard />
        </div>
      </div>

      <div id="quick-actions-container" className="mb-8 hidden md:block relative z-10">
        <DashboardQuickActions />
      </div>

      <div id="status-charts-container" className="mb-10 relative z-10 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-3 mb-6 px-2 md:px-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20" style={{ borderColor: 'var(--primary-custom)', boxShadow: '0 0 10px var(--primary-custom)' }}>
             <Layers className="h-4 w-4 text-blue-500" style={{ color: 'var(--primary-custom)' }} />
          </div>
          <h2 className="text-xl font-black italic uppercase tracking-tighter">Status dos Pedidos</h2>
        </div>

        <div className="flex md:grid md:grid-cols-5 gap-4 overflow-x-auto no-scrollbar -mx-3 px-3 pb-2 snap-x snap-mandatory w-full max-w-full">
          {[
            { title: "Pendentes", icon: Clock, variant: "amber", status: "pendente", count: stats?.pendingOrdersCount },
            { title: "Processando", icon: Wrench, variant: "blue", status: "processando", count: stats?.processingOrdersCount },
            { title: "Faltam Pagar", icon: DollarSign, variant: "rose", status: "pendente-pagamento", count: stats?.pendingPaymentOrdersCount, hidden: !canViewFinancials },
            { title: "Aguardando", icon: Package, variant: "indigo", status: "aguardando retirada", count: stats?.awaitingPickupOrdersCount },
            { title: "Entregues", icon: CheckSquare, variant: "emerald", status: "entregue", count: stats?.deliveredOrdersCount }
          ].filter(i => !i.hidden).map((item, idx) => (
            <motion.div 
              key={item.title} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="flex-shrink-0 w-40 md:w-auto snap-start"
            >
              <QuickActionCard
                title={item.title}
                icon={item.icon}
                to="/pedidos"
                filterState={{ filterStatus: item.status }}
                count={isLoading ? '...' : item.count}
                variant={item.variant as any}
                className="dashboard-glass-card border-none hover:shadow-xl transition-all"
              />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {canViewFinancials && (
          <DashboardShortcutCard
            title="Vendas Totais"
            icon={DollarSign}
            to="/reports"
            loading={isLoading}
            count={formatCurrency(stats?.totalSales || 0)}
            className={cn("dashboard-glass-card", getGrowthColor(stats?.salesGrowth || 0))}
          >
            <p className={`text-xs font-bold ${getGrowthColor(stats?.salesGrowth || 0)}`}>
              {formatGrowth(stats?.salesGrowth || 0)} do último mês
            </p>
          </DashboardShortcutCard>
        )}

        <DashboardShortcutCard
          title="Total de Metros (ML)"
          icon={Ruler}
          to="/reports"
          loading={isLoading}
          count={formatMeters(stats?.totalMeters || 0)}
          className={cn("dashboard-glass-card", getGrowthColor(stats?.metersGrowth || 0))}
        >
          <div className="flex flex-col gap-1">
            <p className={`text-xs font-bold ${getGrowthColor(stats?.metersGrowth || 0)}`}>
              {formatGrowth(stats?.metersGrowth || 0)} do último mês
            </p>
            {!isLoading && stats?.productionTotals && Object.keys(stats.productionTotals).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 border-t pt-3 border-white/5">
                {Object.entries(stats.productionTotals).map(([tipo, total]) => {
                  const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                  const isVinil = tipo === 'vinil';
                  const isDTF = tipo === 'dtf';
                  const isUnidade = tipoInfo?.unidade_medida === 'unidade';

                  let Icon = Ruler;
                  let colorClass = "text-gray-400 bg-white/5";

                  if (isVinil) {
                    Icon = Scissors;
                    colorClass = "text-amber-400 bg-amber-400/10";
                  } else if (isDTF) {
                    Icon = Printer;
                    colorClass = "text-blue-400 bg-blue-400/10";
                  } else if (tipoInfo) {
                    Icon = isUnidade ? Package : Ruler;
                    colorClass = "text-cyan-400 bg-cyan-400/10";
                  }

                  return (
                    <span key={tipo} className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-lg border border-white/5 flex items-center gap-1.5", colorClass)}>
                      <Icon className="h-3 w-3" /> {(total as number).toFixed(isUnidade ? 0 : 1)}{isUnidade ? 'und' : 'm'}
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
          className={cn("dashboard-glass-card", getGrowthColor(stats?.customersGrowth || 0))}
        >
          <p className={`text-xs font-bold ${getGrowthColor(stats?.customersGrowth || 0)}`}>
            {formatGrowth(stats?.customersGrowth || 0)} do último mês
          </p>
        </DashboardShortcutCard>

        {canViewFinancials && (
          <DashboardShortcutCard
            title="Ticket Médio"
            icon={Activity}
            to="/reports"
            loading={isLoading}
            count={formatCurrency(stats?.averageTicket || 0)}
            className={cn("dashboard-glass-card", getGrowthColor(stats?.ticketGrowth || 0))}
          >
            <p className={`text-xs font-bold ${getGrowthColor(stats?.ticketGrowth || 0)}`}>
              {formatGrowth(stats?.ticketGrowth || 0)} do último mês
            </p>
          </DashboardShortcutCard>
        )}
      </div>

      <div className="mt-16 text-center space-y-6 relative z-10">
        <p className="text-xl font-medium dashboard-title-gradient opacity-80 italic" style={{ textShadow: '0 0 10px var(--primary-custom)' }}>
          Bem-vindo ao Direct AI
        </p>
        {!isTourOpen && (
          <Button
            variant="outline"
            size="lg"
            onClick={startTour}
            className="dashboard-glass-card text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 border-primary/20"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Reiniciar Tutorial
          </Button>
        )}
      </div>

      <ShippingFeatureModal
        isOpen={showShippingFeature}
        onClose={handleCloseShippingFeature}
      />

      <TutorialGuide
        steps={steps}
        isOpen={isTourOpen}
        currentStep={currentStep}
        onNext={nextStep}
        onPrev={prevStep}
        onClose={closeTour}
      />
    </div >
  );
};

export default Index;
