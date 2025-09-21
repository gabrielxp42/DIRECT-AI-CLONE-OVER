import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Users, CreditCard, Activity, Plus, MessageSquare, ShoppingCart, Package, User, Clock, Wrench, Handshake, Truck, CheckSquare } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickActionCard } from "@/components/QuickActionCard";
import { useAIAssistant } from '@/contexts/AIAssistantProvider';

const Index = () => {
  const { data: stats, isLoading, error } = useDashboardData();
  const { open: openAIAssistant } = useAIAssistant();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
      
      {/* Nova seção de Ações Rápidas */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3"> {/* Ajustado para 5 colunas em lg */}
          <QuickActionCard 
            title="Pendentes" 
            icon={Clock} 
            to="/pedidos" 
            filterState={{ filterStatus: 'pendente' }}
            count={isLoading ? undefined : stats?.pendingOrdersCount}
            loading={isLoading}
          />
          <QuickActionCard 
            title="Processando" 
            icon={Wrench} 
            to="/pedidos" 
            filterState={{ filterStatus: 'processando' }}
            count={isLoading ? undefined : stats?.processingOrdersCount}
            loading={isLoading}
          />
          <QuickActionCard 
            title="Faltam Pagar" 
            icon={DollarSign} 
            to="/pedidos" 
            filterState={{ filterStatus: 'pendente-pagamento' }}
            count={isLoading ? undefined : stats?.pendingPaymentOrdersCount}
            loading={isLoading}
          />
          <QuickActionCard 
            title="Aguardando Retirada" 
            icon={Package} 
            to="/pedidos" 
            filterState={{ filterStatus: 'aguardando retirada' }}
            count={isLoading ? undefined : stats?.awaitingPickupOrdersCount}
            loading={isLoading}
          />
          <QuickActionCard 
            title="Entregues" 
            icon={CheckSquare} 
            to="/pedidos" 
            filterState={{ filterStatus: 'entregue' }}
            count={isLoading ? undefined : stats?.deliveredOrdersCount}
            loading={isLoading}
          />
          {/* O atalho para o chat AI foi removido conforme solicitado */}
        </div>
      </div>

      {/* Cards de Visão Geral Existentes */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendas Totais
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.totalSales || 0)}</div>
                <p className={`text-xs ${getGrowthColor(stats?.salesGrowth || 0)}`}>
                  {formatGrowth(stats?.salesGrowth || 0)} do último mês
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Novos Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">+{stats?.newCustomers || 0}</div>
                <p className={`text-xs ${getGrowthColor(stats?.customersGrowth || 0)}`}>
                  {formatGrowth(stats?.customersGrowth || 0)} do último mês
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Ativos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">+{stats?.activeOrders || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Pedidos pendentes
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(stats?.averageTicket || 0)}</div>
                <p className={`text-xs ${getGrowthColor(stats?.ticketGrowth || 0)}`}>
                  {formatGrowth(stats?.ticketGrowth || 0)} do último mês
                </p>
              </>
            )}
          </CardContent>
        </Card>
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