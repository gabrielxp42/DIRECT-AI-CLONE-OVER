import React from 'react';
import { Cliente } from '@/types/cliente';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Calendar, Clock, Loader2, User, ArrowRight, Ruler, Brain, Sparkles, Bot } from 'lucide-react';
import { useClientMetrics } from '@/hooks/useClientMetrics';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAIAssistant } from '@/contexts/AIAssistantProvider';

interface ClientDetailsCardProps {
  cliente: Cliente;
  onClose: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatMeters = (value: number) => {
  return `${value.toFixed(2)} ML`;
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pendente': return 'bg-primary/20 text-primary';
    case 'processando': return 'bg-blue-100 text-blue-800';
    case 'entregue': return 'bg-green-100 text-green-800';
    case 'cancelado': return 'bg-red-100 text-red-800';
    case 'pago': return 'bg-green-500 text-white';
    case 'aguardando retirada': return 'bg-orange-500 text-white';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const ClientDetailsCard: React.FC<ClientDetailsCardProps> = ({ cliente, onClose }) => {
  const { data: metrics, isLoading, error } = useClientMetrics(cliente.id);
  const navigate = useNavigate();
  const { open: openAssistant } = useAIAssistant();

  const handleViewAllOrders = () => {
    // Redireciona para a página de pedidos com o ID do cliente no estado
    navigate('/pedidos', { state: { filterClientId: cliente.id, filterClientName: cliente.nome } });
    onClose(); // Fecha o modal
  };

  const handleSendToGabi = () => {
    openAssistant();
    onClose();
    // Preecher um input do chat ou simplesmente abrir a Gabi
    // Idealmente, a Gabi poderia ter um state global para 'mensagem inicial'
    // Como a Gabi abre, o usuário já pode falar sobre o cliente lá.
    // Simulando o envio de uma mensagem sobre o cliente via localStorage ou event listener:
    window.dispatchEvent(new CustomEvent('gabi:ask', { 
      detail: `Me fale sobre o cliente ${cliente.nome} (telefone: ${cliente.telefone})` 
    }));
  };

  return (
    <Card className="w-full h-full flex flex-col border-none shadow-none">
      <CardHeader className="pb-4 border-b relative">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {cliente.nome}
            </CardTitle>
            <CardDescription className="mt-1">
              Métricas e histórico de pedidos.
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
            onClick={handleSendToGabi}
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Perguntar à Gabi</span>
          </Button>
        </div>
        {/* REMOVIDO O BOTÃO DE FECHAR DUPLICADO */}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500">
            Erro ao carregar métricas.
          </div>
        ) : (
          <>
            {/* Métricas Principais */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Gasto</span>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(metrics?.totalSpent || 0)}
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total de Pedidos</span>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {metrics?.totalOrdersCount || 0}
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total de Metros (ML)</span>
                  <Ruler className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {formatMeters(metrics?.totalMeters || 0)}
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Último Pedido</span>
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-lg font-bold mt-1">
                  {metrics?.lastOrderDate
                    ? format(new Date(metrics.lastOrderDate), 'dd/MM/yyyy', { locale: ptBR })
                    : 'N/A'}
                </div>
              </Card>
            </div>

            {/* Observações / Memória da Gabi */}
            {cliente.observacoes && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Brain className="h-12 w-12 text-primary" />
                </div>
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Memória da Gabi</h3>
                </div>
                <p className="text-sm text-foreground/80 italic leading-relaxed relative z-10">
                  "{cliente.observacoes}"
                </p>
              </div>
            )}

            <Separator />

            {/* Últimos Pedidos */}
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Últimos 5 Pedidos
            </h3>

            {metrics?.lastOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum pedido recente encontrado.</p>
            ) : (
              <div className="space-y-3">
                {metrics?.lastOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">Pedido #{order.order_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">
                        {formatCurrency(order.valor_total)}
                      </span>
                      <Badge className={cn("text-xs h-5", getStatusColor(order.status))}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Botão Ver Todos os Pedidos */}
            {metrics && metrics.totalOrdersCount > 0 && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleViewAllOrders}
                >
                  Ver Todos os {metrics.totalOrdersCount} Pedidos
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};