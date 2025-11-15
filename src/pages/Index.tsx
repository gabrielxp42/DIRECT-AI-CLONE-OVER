import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Users, Activity, Ruler, Clock, Wrench, Package, CheckSquare } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionCard } from "@/components/QuickActionCard";
import { useAIAssistant } from '@/contexts/AIAssistantProvider';
import { DashboardShortcutCard } from "@/components/DashboardShortcutCard"; // Reutilizando o card maior para métricas

const Index = () => {
  const { data: stats, isLoading, error } = useDashboardData();
  const { open: openAIAssistant } = useAIAssistant();

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
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar dados do dashboard</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-left">Dashboard</h1>
      
      {/* Seção de Ações Rápidas - Mais compacta */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
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
            title="Aguardando Retirada" 
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
          <p className={`text-xs ${getGrowthColor(stats?.metersGrowth || 0)}`}>
            {formatGrowth(stats?.metersGrowth || 0)} do último mês
          </p>
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
      
      <div className="mt-8 text-center">
        <p className="text-lg text-muted-foreground">
          Bem-vindo ao seu assistente de vendas!
        </p>
      </div>
    </div>
  );
};

export default Index;