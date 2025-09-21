import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Search, Filter, Eye, Edit, Trash2, Loader2, CalendarIcon, DollarSign, FileText, Wrench, History, MessageSquare, MoreHorizontal, User, Clock, CheckCircle, XCircle, Package } from 'lucide-react';
import { PedidoForm } from '@/components/PedidoForm';
import { PedidoDetails } from '@/components/PedidoDetails';
import { showSuccess, showError } from '@/utils/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { StatusChangeDialog } from '@/components/StatusChangeDialog';
import { StatusHistoryDialog } from '@/components/StatusHistoryDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrderStatusIndicator } from '@/components/OrderStatusIndicator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PedidosPage: React.FC = () => {
  const { supabase, session } = useSession();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [viewingPedidoId, setViewingPedidoId] = useState<string | null>(null);
  const [statusChangePedido, setStatusChangePedido] = useState<Pedido | null>(null);
  const [viewingStatusHistory, setViewingStatusHistory] = useState<Pedido | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterDateRange, setFilterDateRange] = useState<{ from?: Date; to?: Date }>({});

  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Effect to handle incoming filter state from navigation
  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatus(location.state.filterStatus);
      // Clear the state after use to prevent re-applying on subsequent visits
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);


  const fetchPedidos = useCallback(async () => {
    if (!session || !supabase) return;
    setLoading(true);
    try {
      // Buscar pedidos primeiro
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes (id, nome, telefone, email, endereco)
        `)
        .eq('user_id', session.user.id)
        .order('order_number', { ascending: false }); // Ordenar por número do pedido

      if (pedidosError) throw pedidosError;

      // Buscar itens dos pedidos
      const pedidoIds = pedidosData?.map(pedido => pedido.id) || [];
      const { data: itemsData, error: itemsError } = await supabase
        .from('pedido_items')
        .select(`
          *,
          produtos (id, nome)
        `)
        .in('pedido_id', pedidoIds);

      if (itemsError) throw itemsError;

      // Buscar serviços dos pedidos (verificando se a tabela existe)
      let servicosData: any[] = [];
      let servicosError: any = null;
      
      try {
        const { data, error } = await supabase
          .from('pedido_servicos')
          .select('*')
          .in('pedido_id', pedidoIds);
        
        servicosData = data || [];
        servicosError = error;
      } catch (e) {
        // Se a tabela pedido_servicos não existir, tentamos servicos
        try {
          const { data, error } = await supabase
            .from('servicos')
            .select('*')
            .in('pedido_id', pedidoIds);
          
          servicosData = data || [];
          servicosError = error;
        } catch (innerError) {
          // Se nenhuma tabela de serviços existir, continuamos sem serviços
          servicosData = [];
          servicosError = null;
        }
      }

      if (servicosError) {
        console.warn('Aviso: Não foi possível carregar serviços:', servicosError.message);
        servicosData = [];
      }

      // Buscar histórico de status para todos os pedidos
      const { data: allHistoryData, error: historyError } = await supabase
        .from('pedido_status_history')
        .select('*')
        .in('pedido_id', pedidoIds)
        .order('created_at', { ascending: false }); // Order by date to easily get the latest

      if (historyError) {
        console.warn('Aviso: Não foi possível carregar histórico de status:', historyError.message);
      }

      // Mapear histórico e última observação para cada pedido
      const pedidosCompletos = pedidosData?.map(pedido => {
        const orderHistory = allHistoryData?.filter(historyItem => historyItem.pedido_id === pedido.id) || [];
        const latestObservation = orderHistory.length > 0 ? orderHistory[0].observacao : null; // Get the latest (first after sorting)
        
        return {
          ...pedido,
          pedido_items: itemsData?.filter(item => item.pedido_id === pedido.id) || [],
          servicos: servicosData?.filter(servico => servico.pedido_id === pedido.id) || [],
          status_history: orderHistory, // Assign all history
          latest_status_observation: latestObservation, // Assign the latest observation
        };
      }) || [];

      setPedidos(pedidosCompletos as Pedido[]);
    } catch (error: any) {
      console.error('Erro completo:', error);
      showError(`Erro ao carregar pedidos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  const fetchClientesAndProdutos = useCallback(async () => {
    if (!session || !supabase) return;
    try {
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', session.user.id);
      if (clientesError) throw clientesError;
      setClientes(clientesData as Cliente[]);

      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*')
        .eq('user_id', session.user.id);
      if (produtosError) throw produtosError;
      setProdutos(produtosData as Produto[]);

    } catch (error: any) {
      showError(`Erro ao carregar dados de suporte: ${error.message}`);
    }
  }, [session, supabase]);

  useEffect(() => {
    fetchPedidos();
    fetchClientesAndProdutos();
  }, [fetchPedidos, fetchClientesAndProdutos]);

  // This useEffect handles opening the form when navigated from another component with state
  useEffect(() => {
    if (location.state?.openForm) {
      setEditingPedido(null); // Ensure it's a new order
      setIsFormOpen(true);    // Open the form dialog
      // Adiciona uma verificação para 'navigate' antes de chamá-lo
      if (navigate) {
        navigate(location.pathname, { replace: true, state: {} }); // Clear the state after use
      } else {
        console.error("Erro: navigate não está definido no useEffect de Pedidos.tsx");
      }
    }
  }, [location.state, location.pathname, navigate]); // Adicionado location.pathname à dependência

  const handleCreatePedido = () => {
    setEditingPedido(null); // Garante que é um novo pedido
    setIsFormOpen(true);
  };

  const handleEditPedido = (pedido: Pedido) => {
    setEditingPedido(pedido);
    setIsFormOpen(true);
  };

  const handleViewPedido = (pedidoId: string) => {
    setViewingPedidoId(pedidoId);
    setIsDetailsOpen(true);
  };

  const handleStatusChange = (pedido: Pedido) => {
    setStatusChangePedido(pedido);
    setIsStatusChangeOpen(true);
  };

  const handleViewStatusHistory = (pedido: Pedido) => {
    setViewingStatusHistory(pedido);
    setIsStatusHistoryOpen(true);
  };

  const handleSubmitStatusChange = async (newStatus: string, observacao?: string) => {
    if (!statusChangePedido || !supabase) return;
    
    try {
      const statusAnterior = statusChangePedido.status;

      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
        .eq('id', statusChangePedido.id);
      
      if (error) throw error;
      
      // Se houver observação, adicionar ao histórico
      if (observacao && observacao.trim()) {
        const { error: historyError } = await supabase
          .from('pedido_status_history')
          .insert({
            pedido_id: statusChangePedido.id,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao.trim(),
            user_id: session?.user.id
          });

        if (historyError) {
          console.warn('Aviso: Erro ao salvar histórico:', historyError);
        }
      }
      
      showSuccess("Status atualizado com sucesso!");
      fetchPedidos();
    } catch (error: any) {
      showError(`Erro ao atualizar status: ${error.message}`);
    }
  };

  const handleGeneratePDF = async (pedido: Pedido) => {
    try {
      await generateOrderPDF(pedido);
      showSuccess("PDF gerado com sucesso!");
    } catch (error: any) {
      showError(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handleSubmitPedido = async (data: Omit<Pedido, 'id' | 'created_at' | 'user_id' | 'status'>, pedidoId?: string) => {
    if (!session || !supabase) return;
    setIsSubmitting(true);

    try {
      if (pedidoId) {
        // Update existing pedido
        const { items, servicos, ...pedidoData } = data;

        // Update pedido main data
        const { error: pedidoError } = await supabase
          .from('pedidos')
          .update(pedidoData)
          .eq('id', pedidoId)
          .eq('user_id', session.user.id);
        if (pedidoError) throw pedidoError;

        // Handle items: delete old, insert new
        await supabase.from('pedido_items').delete().eq('pedido_id', pedidoId);
        if (items && items.length > 0) {
          const itemsToInsert = items.map(item => ({ ...item, pedido_id: pedidoId }));
          const { error: itemsError } = await supabase.from('pedido_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        // Handle servicos: delete old, insert new
        // Verificar qual tabela de serviços existe
        let servicosTable = 'pedido_servicos';
        try {
          await supabase.from('pedido_servicos').select('*').limit(1);
        } catch (e) {
          servicosTable = 'servicos';
        }

        await supabase.from(servicosTable).delete().eq('pedido_id', pedidoId);
        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map(servico => ({ ...servico, pedido_id: pedidoId }));
          const { error: servicosError } = await supabase.from(servicosTable).insert(servicosToInsert);
          if (servicosError) throw servicosError;
        }

        showSuccess("Pedido atualizado com sucesso!");
      } else {
        // Create new pedido
        const { items, servicos, ...pedidoData } = data;
        const { data: newPedido, error: pedidoError } = await supabase
          .from('pedidos')
          .insert([{ ...pedidoData, user_id: session.user.id, status: 'pendente' }])
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        if (items && items.length > 0) {
          const itemsToInsert = items.map(item => ({ ...item, pedido_id: newPedido.id }));
          const { error: itemsError } = await supabase.from('pedido_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        // Verificar qual tabela de serviços existe
        let servicosTable = 'pedido_servicos';
        try {
          await supabase.from('pedido_servicos').select('*').limit(1);
        } catch (e) {
          servicosTable = 'servicos';
        }

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map(servico => ({ ...servico, pedido_id: newPedido.id }));
          const { error: servicosError } = await supabase.from(servicosTable).insert(servicosToInsert);
          if (servicosError) throw servicosError;
        }

        showSuccess("Pedido criado com sucesso!");
      }
      setIsFormOpen(false);
      fetchPedidos();
    } catch (error: any) {
      showError(`Erro ao salvar pedido: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePedido = async (id: string) => {
    if (!supabase) return;
    try {
      const { error: historyError } = await supabase
        .from('pedido_status_history')
        .delete()
        .eq('pedido_id', id);
      if (historyError) console.warn('Aviso: Erro ao excluir histórico de status:', historyError.message);

      const { error: itemsError } = await supabase
        .from('pedido_items')
        .delete()
        .eq('pedido_id', id);
      if (itemsError) throw itemsError;

      let servicosTable = 'pedido_servicos';
      try {
        await supabase.from('pedido_servicos').select('*').limit(1);
      } catch (e) {
        servicosTable = 'servicos';
      }

      const { error: servicosError } = await supabase
        .from(servicosTable)
        .delete()
        .eq('pedido_id', id);
      if (servicosError) {
        console.warn('Aviso: Não foi possível excluir serviços:', servicosError.message);
      }

      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id)
        .eq('user_id', session?.user.id);
      if (error) throw error;
      showSuccess("Pedido excluído com sucesso!");
      fetchPedidos();
    } catch (error: any) {
      showError(`Erro ao excluir pedido: ${error.message}`);
    }
  };

  // Reintroduzindo a função getStatusBadge para uso no mobile
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[0.6rem] px-1 py-0 whitespace-nowrap"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case 'processando':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[0.6rem] px-1 py-0 whitespace-nowrap"><Wrench className="h-3 w-3 mr-1" /> Processando</Badge>;
      case 'enviado':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-[0.6rem] px-1 py-0 whitespace-nowrap"><CheckCircle className="h-3 w-3 mr-1" /> Enviado</Badge>;
      case 'entregue':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[0.6rem] px-1 py-0 whitespace-nowrap"><CheckCircle className="h-3 w-3 mr-1" /> Entregue</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[0.6rem] px-1 py-0 whitespace-nowrap"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      case 'pago':
        return <Badge variant="outline" className="bg-green-500 text-white border-green-600 text-[0.6rem] px-1 py-0 whitespace-nowrap"><DollarSign className="h-3 w-3 mr-1" /> Pago</Badge>;
      case 'aguardando retirada':
        return <Badge variant="outline" className="bg-orange-500 text-white border-orange-600 text-[0.6rem] px-1 py-0 whitespace-nowrap"><Package className="h-3 w-3 mr-1" /> Aguardando Retirada</Badge>;
      default:
        return <Badge variant="secondary" className="text-[0.6rem] px-1 py-0 whitespace-nowrap">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const filteredPedidos = pedidos.filter(pedido => {
    const matchesSearch = searchTerm === '' ||
      pedido.order_number.toString().includes(searchTerm) ||
      pedido.clientes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.pedido_items?.some(item => item.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pedido.servicos?.some(servico => servico.nome?.toLowerCase().includes(searchTerm.toLowerCase())) || false);

    let matchesStatus = true;
    if (filterStatus === 'pendente-pagamento') {
      matchesStatus = pedido.status !== 'pago' && pedido.status !== 'cancelado' && pedido.status !== 'entregue';
    } else if (filterStatus !== 'todos') {
      matchesStatus = pedido.status === filterStatus;
    }

    const pedidoDate = new Date(pedido.created_at);
    const matchesDate = (!filterDateRange.from || pedidoDate >= filterDateRange.from) &&
                        (!filterDateRange.to || pedidoDate <= filterDateRange.to);

    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pedidos</h1>
        <Button onClick={handleCreatePedido} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <Input
          placeholder="Buscar por cliente, produto, ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:col-span-2 lg:col-span-2"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="pendente-pagamento">Falta Pagar</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="aguardando retirada">Aguardando Retirada</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !filterDateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDateRange.from ? (
                filterDateRange.to ? (
                  <>
                    {format(filterDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(filterDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(filterDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Filtrar por data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={filterDateRange.from}
              selected={filterDateRange}
              onSelect={setFilterDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPedidos.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">Nenhum pedido encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPedidos.map((pedido) => (
            <Card 
              key={pedido.id} 
              className="touch-manipulation cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1 min-w-0"> {/* Adicionado min-w-0 aqui */}
                    <CardTitle className="text-lg font-semibold">
                      Pedido #{pedido.order_number}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <User className="h-3 w-3 flex-shrink-0" />
                      {isMobile ? (
                        <span className="flex-1 truncate">
                          {pedido.clientes?.nome || 'Cliente Desconhecido'}
                        </span>
                      ) : (
                        <span className="flex-1 truncate">
                          {pedido.clientes?.nome || 'Cliente Desconhecido'}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex-shrink-0 max-w-full"> {/* Adicionado max-w-full aqui */}
                    {isMobile ? (
                      getStatusBadge(pedido.status)
                    ) : (
                      <OrderStatusIndicator status={pedido.status} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{format(new Date(pedido.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                </div>
                <div className="flex items-center text-base font-medium text-gray-900 dark:text-gray-50">
                  <DollarSign className="h-4 w-4 mr-2 text-primary" />
                  <span>Total: {formatCurrency(pedido.valor_total)}</span>
                </div>

                {pedido.latest_status_observation && (
                  <div className="flex items-start text-sm text-muted-foreground italic bg-muted p-2 rounded-md">
                    <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{pedido.latest_status_observation}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleGeneratePDF(pedido); 
                    }}
                    title="Gerar PDF"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleStatusChange(pedido); 
                    }}
                    title="Alterar Status"
                  >
                    <Wrench className="h-4 w-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => e.stopPropagation()}
                        title="Mais Ações"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewPedido(pedido.id); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      {pedido.status_history && pedido.status_history.length > 0 && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewStatusHistory(pedido); }}>
                          <History className="h-4 w-4 mr-2" />
                          Histórico de Status
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditPedido(pedido); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                            <span className="text-destructive">Excluir</span>
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o pedido #{pedido.order_number}? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePedido(pedido.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PedidoForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitPedido}
        isSubmitting={isSubmitting}
        initialData={editingPedido}
        clientes={clientes}
        produtos={produtos}
      />

      {viewingPedidoId && (
        <PedidoDetails
          isOpen={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          pedidoId={viewingPedidoId}
          clientes={clientes}
          produtos={produtos}
          onEdit={handleEditPedido}
          onDelete={handleDeletePedido}
        />
      )}

      {statusChangePedido && (
        <StatusChangeDialog
          isOpen={isStatusChangeOpen}
          onOpenChange={setIsStatusChangeOpen}
          currentStatus={statusChangePedido.status}
          onStatusChange={handleSubmitStatusChange}
          orderNumber={statusChangePedido.order_number}
        />
      )}

      {viewingStatusHistory && (
        <StatusHistoryDialog
          isOpen={isStatusHistoryOpen}
          onOpenChange={setIsStatusHistoryOpen}
          statusHistory={viewingStatusHistory.status_history || []}
          orderNumber={viewingStatusHistory.order_number}
        />
      )}
    </div>
  );
};

export default PedidosPage;