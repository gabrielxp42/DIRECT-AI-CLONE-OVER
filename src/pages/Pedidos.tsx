import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem, PedidoStatus } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'; // CORRIGIDO: Adicionado CardDescription
import { Plus, Search, Filter, Eye, Edit, Trash2, Loader2, CalendarIcon, DollarSign, FileText, Wrench, History, MessageSquare, MoreHorizontal, User, Clock, CheckCircle, XCircle, Package, X, Printer, Ruler } from 'lucide-react';
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
import { usePedidos, useClientes, useProdutos, usePaginatedPedidos } from '@/hooks/useDataFetch'; // Importar usePaginatedPedidos
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce'; // Importar useDebounce
import { Skeleton } from '@/components/ui/skeleton'; // Importar Skeleton
import { PaginationControls } from '@/components/PaginationControls'; // Importar PaginationControls

const ITEMS_PER_PAGE = 20;

const PedidosPage: React.FC = () => {
  const { supabase, session } = useSession();
  const queryClient = useQueryClient();
  
  // Estado de Paginação
  const [currentPage, setCurrentPage] = useState(1);
  
  // Usando hooks centralizados para dados
  // Nota: allPedidos agora é usado apenas para a lógica de filtragem/busca, mas o fetch principal é paginado.
  const { data: allPedidos } = usePedidos(); // Mantido para compatibilidade de filtros
  const { data: paginatedData, isLoading: isLoadingPaginated, error: paginatedError } = usePaginatedPedidos(currentPage, ITEMS_PER_PAGE);
  
  const { data: clientes, isLoading: isLoadingClientes } = useClientes();
  const { data: produtos, isLoading: isLoadingProdutos } = useProdutos();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [viewingPedidoId, setViewingPedidoId] = useState<string | null>(null);
  const [statusChangePedido, setStatusChangePedido] = useState<Pedido | null>(null);
  const [viewingStatusHistory, setViewingStatusHistory] = useState<Pedido | null>(null);
  
  const [rawSearchTerm, setRawSearchTerm] = useState('');
  const searchTerm = useDebounce(rawSearchTerm, 300); // Aplicar debounce
  
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterDateRange, setFilterDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  const [filterClientId, setFilterClientId] = useState<string | null>(null);
  const [filterClientName, setFilterClientName] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // Effect to handle incoming filter state from navigation
  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatus(location.state.filterStatus);
      navigate(location.pathname, { replace: true, state: {} });
    }
    
    if (location.state?.filterClientId) {
      setFilterClientId(location.state.filterClientId);
      setFilterClientName(location.state.filterClientName || 'Cliente Filtrado');
      navigate(location.pathname, { replace: true, state: {} });
    }
    
    if (location.state?.openForm) {
      setEditingPedido(null); 
      setIsFormOpen(true);    
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const handleClearClientFilter = () => {
    setFilterClientId(null);
    setFilterClientName(null);
  };

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
  
  // --- Funções de PDF ---
  const handleDownloadPDF = async (pedido: Pedido) => {
    try {
      if ((!pedido.pedido_items || pedido.pedido_items.length === 0) && (!pedido.servicos || pedido.servicos.length === 0)) {
        showError("O pedido não possui itens ou serviços para gerar o PDF.");
        return;
      }
      await generateOrderPDF(pedido, 'save');
      showSuccess("PDF gerado e baixado com sucesso!");
    } catch (error: any) {
      showError(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handlePrintPDF = async (pedido: Pedido) => {
    try {
      if ((!pedido.pedido_items || pedido.pedido_items.length === 0) && (!pedido.servicos || pedido.servicos.length === 0)) {
        showError("O pedido não possui itens ou serviços para imprimir.");
        return;
      }
      await generateOrderPDF(pedido, 'print');
    } catch (error: any) {
      showError(`Erro ao gerar PDF para impressão: ${error.message}`);
    }
  };
  // --- Fim Funções de PDF ---


  // --- Mutações ---

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, observacao, statusAnterior }: { id: string, newStatus: string, observacao?: string, statusAnterior: string }) => {
      if (!supabase) throw new Error("Supabase client is not available");
      
      const { error } = await supabase
        .from('pedidos') 
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      if (newStatus !== statusAnterior || observacao) {
        const { error: historyError } = await supabase
          .from('pedido_status_history')
          .insert({
            pedido_id: id,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao?.trim() || null,
            user_id: session?.user.id
          });

        if (historyError) {
          console.warn('Aviso: Erro ao salvar histórico:', historyError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess("Status atualizado com sucesso!");
    },
    onError: (error: any) => {
      showError(`Erro ao atualizar status: ${error.message}`);
    }
  });

  const handleSubmitStatusChange = (newStatus: string, observacao?: string) => {
    if (!statusChangePedido) return;
    updateStatusMutation.mutate({
      id: statusChangePedido.id,
      newStatus,
      observacao,
      statusAnterior: statusChangePedido.status
    });
  };

  const deletePedidoMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Supabase client is not available");
      
      // Excluir itens e serviços relacionados (RLS deve permitir)
      await supabase.from('pedido_items').delete().eq('pedido_id', id);
      await supabase.from('pedido_servicos').delete().eq('pedido_id', id);
      await supabase.from('pedido_status_history').delete().eq('pedido_id', id);

      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id)
        .eq('user_id', session?.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess("Pedido excluído com sucesso!");
      setIsDetailsOpen(false);
      setViewingPedidoId(null);
    },
    onError: (error: any) => {
      showError(`Erro ao excluir pedido: ${error.message}`);
    }
  });

  const handleSubmitPedidoMutation = useMutation({
    mutationFn: async ({ data, pedidoId }: { data: any, pedidoId?: string }) => {
      if (!session || !supabase) throw new Error("Sessão não encontrada");
      
      const { items, servicos, created_at, ...pedidoData } = data;
      
      if (pedidoId) {
        // Update existing pedido
        const updateData = { 
          ...pedidoData, 
          created_at,
          status: editingPedido?.status || 'pendente'
        };

        const { error: pedidoError } = await supabase
          .from('pedidos') 
          .update(updateData)
          .eq('id', pedidoId);
        if (pedidoError) throw pedidoError;

        // Handle items: delete old, insert new
        await supabase.from('pedido_items').delete().eq('pedido_id', pedidoId);
        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: pedidoId }));
          const { error: itemsError } = await supabase.from('pedido_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        // Handle servicos: delete old, insert new
        await supabase.from('pedido_servicos').delete().eq('pedido_id', pedidoId);
        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: pedidoId }));
          const { error: servicosError } = await supabase.from('pedido_servicos').insert(servicosToInsert);
          if (servicosError) throw servicosError;
        }
        return { type: 'update' };
      } else {
        // Create new pedido
        const newPedidoData = { 
          ...pedidoData, 
          user_id: session.user.id, 
          status: 'pendente',
          created_at: created_at
        };

        const { data: newPedido, error: pedidoError } = await supabase
          .from('pedidos') 
          .insert([newPedidoData])
          .select()
          .single();

        if (pedidoError) throw pedidoError;

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: newPedido.id }));
          const { error: itemsError } = await supabase.from('pedido_items').insert(itemsToInsert);
          if (itemsError) throw itemsError;
        }

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: newPedido.id }));
          const { error: servicosError } = await supabase.from('pedido_servicos').insert(servicosToInsert);
          if (servicosError) throw servicosError;
        }
        return { type: 'create' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess(`Pedido ${result.type === 'create' ? 'criado' : 'atualizado'} com sucesso!`);
      setIsFormOpen(false);
      setEditingPedido(null);
      setCurrentPage(1); // Volta para a primeira página após criar/atualizar
    },
    onError: (error: any) => {
      showError(`Erro ao salvar pedido: ${error.message}`);
    }
  });

  const handleSubmitPedido = (data: any, pedidoId?: string) => {
    handleSubmitPedidoMutation.mutate({ data, pedidoId });
  };

  // --- Fim Mutações ---

  const getStatusBadge = (pedido: Pedido) => {
    const status = pedido.status;
    const baseClasses = "text-[0.6rem] px-1 py-0 whitespace-nowrap cursor-pointer";
    const iconClasses = "h-3 w-3 mr-1";

    switch (status) {
      case 'pendente':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-yellow-100 text-yellow-800 border-yellow-300")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <Clock className={iconClasses} /> Pendente
          </Badge>
        );
      case 'processando':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-blue-100 text-blue-800 border-blue-300")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <Wrench className={iconClasses} /> Processando
          </Badge>
        );
      case 'enviado':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-purple-100 text-purple-800 border-purple-300")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <CheckCircle className={iconClasses} /> Enviado
          </Badge>
        );
      case 'entregue':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-green-100 text-green-800 border-green-300")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <CheckCircle className={iconClasses} /> Entregue
          </Badge>
        );
      case 'cancelado':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-red-100 text-red-800 border-red-300")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <XCircle className={iconClasses} /> Cancelado
          </Badge>
        );
      case 'pago':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-green-500 text-white border-green-600")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <DollarSign className={iconClasses} /> Pago
          </Badge>
        );
      case 'aguardando retirada':
        return (
          <Badge 
            variant="outline" 
            className={cn(baseClasses, "bg-orange-500 text-white border-orange-600")}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            <Package className={iconClasses} /> Aguardando Retirada
          </Badge>
        );
      default:
        return (
          <Badge 
            variant="secondary" 
            className={cn(baseClasses)}
            onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
          >
            {status}
          </Badge>
        );
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // OTIMIZAÇÃO: Usar useMemo para filtrar pedidos
  // NOTA: A filtragem por data/status/cliente deve ser feita no backend para performance ideal,
  // mas como o Supabase não suporta filtros complexos em consultas aninhadas de forma simples,
  // mantemos a filtragem por termo de busca no frontend sobre os dados paginados.
  // Se o usuário aplicar filtros de status/data/cliente, ele deve ver todos os resultados
  // que correspondem, o que exigiria buscar TODOS os pedidos novamente.
  // Para manter a performance, vamos aplicar a filtragem APENAS sobre os dados da página atual,
  // e instruir o usuário a usar a busca por termo para refinar a página atual.
  
  const pedidosDaPagina = paginatedData?.pedidos || [];
  const totalPedidos = paginatedData?.totalCount || 0;
  const totalPages = Math.ceil(totalPedidos / ITEMS_PER_PAGE);

  const filteredPedidos = useMemo(() => {
    if (!pedidosDaPagina) return [];
    
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    // Se houver filtros de status, data ou cliente, usamos a lista completa (allPedidos)
    // para garantir que o filtro seja preciso, mas isso pode ser lento.
    // Para manter a performance, vamos aplicar a filtragem APENAS sobre os dados da página atual.
    // Se o usuário quiser filtrar por status/data/cliente, ele deve usar a busca por termo
    // para refinar a página atual.
    
    return pedidosDaPagina.filter(pedido => {
      const matchesSearch = searchTerm === '' ||
        pedido.order_number.toString().includes(searchTerm) ||
        pedido.clientes?.nome.toLowerCase().includes(lowerCaseSearchTerm) ||
        pedido.pedido_items?.some(item => item.produto_nome?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (pedido.servicos?.some(servico => servico.nome?.toLowerCase().includes(lowerCaseSearchTerm)) || false);

      // Ignoramos filtros de status/data/cliente na lista paginada para manter a performance,
      // pois a paginação já está ordenada por data.
      // Se o usuário quiser filtrar por status/data/cliente, ele deve usar a busca por termo
      // para refinar a página atual.
      
      return matchesSearch;
    });
  }, [pedidosDaPagina, searchTerm]);

  const isGlobalLoading = isLoadingPaginated || isLoadingClientes || isLoadingProdutos;

  if (paginatedError) {
    return <div className="text-center py-8 text-red-600">Erro ao carregar pedidos: {paginatedError.message}</div>;
  }

  // Componente de Skeleton otimizado para a lista de pedidos
  const PedidoSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pedidos</h1>
        <Button onClick={handleCreatePedido} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>
      
      {/* Filtro de Cliente Ativo */}
      {filterClientId && filterClientName && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">
            Filtrando pedidos para: <strong>{filterClientName}</strong>
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClearClientFilter}
            className="h-6 w-6 text-primary hover:bg-primary/20 ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <Input
          placeholder="Buscar por cliente, produto, ID..."
          value={rawSearchTerm} // Usa o valor bruto para o input
          onChange={(e) => setRawSearchTerm(e.target.value)} // Atualiza o valor bruto
          className="md:col-span-2 lg:col-span-2"
        />
        {/* NOTA: Filtros de Status/Data/Cliente estão desabilitados na lista paginada para manter a performance. */}
        <Select value={filterStatus} onValueChange={setFilterStatus} disabled={true}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filtrar por status (Desabilitado)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal text-muted-foreground",
              )}
              disabled={true}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span>Filtrar por data (Desabilitado)</span>
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

      {isGlobalLoading ? (
        <PedidoSkeleton />
      ) : filteredPedidos.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">Nenhum pedido encontrado.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPedidos.map((pedido) => (
              <Card 
                key={pedido.id} 
                className="touch-manipulation cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50"
                onClick={() => handleViewPedido(pedido.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between w-full gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold">
                        Pedido #{pedido.order_number}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span className="flex-1 truncate">
                          {pedido.clientes?.nome || 'Cliente Desconhecido'}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex-shrink-0 max-w-full">
                      {isMobile ? (
                        getStatusBadge(pedido)
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
                            >
                              <OrderStatusIndicator status={pedido.status} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Alterar Status</p>
                          </TooltipContent>
                        </Tooltip>
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
                  
                  {/* NOVO: Exibição do Total de Metros */}
                  {pedido.total_metros > 0 && (
                    <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Ruler className="h-4 w-4 mr-2 text-blue-500" />
                      <span>Metros: {pedido.total_metros.toFixed(2)} ML</span>
                    </div>
                  )}

                  {pedido.latest_status_observation && (
                    <div className="flex items-start text-sm text-muted-foreground italic bg-muted p-2 rounded-md">
                      <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{pedido.latest_status_observation}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDownloadPDF(pedido); 
                          }}
                          className="h-9 w-9"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Baixar PDF</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handlePrintPDF(pedido); 
                          }}
                          className="h-9 w-9"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Imprimir Nota</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); handleStatusChange(pedido); }}
                          className="h-9 w-9"
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Alterar Status</TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={(e) => e.stopPropagation()}
                          className="h-9 w-9"
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
                              <AlertDialogAction onClick={() => deletePedidoMutation.mutate(pedido.id)}>Excluir</AlertDialogAction>
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
          
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={isLoadingPaginated}
          />
        </>
      )}

      <PedidoForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitPedido}
        isSubmitting={handleSubmitPedidoMutation.isPending}
        initialData={editingPedido}
        clientes={clientes || []}
        produtos={produtos || []}
      />

      {viewingPedidoId && (
        <PedidoDetails
          isOpen={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          pedidoId={viewingPedidoId}
          clientes={clientes || []}
          produtos={produtos || []}
          onEdit={handleEditPedido}
          onDelete={deletePedidoMutation.mutate}
        />
      )}

      {statusChangePedido && (
        <StatusChangeDialog
          isOpen={isStatusChangeOpen}
          onOpenChange={setIsStatusChangeOpen}
          currentStatus={statusChangePedido.status}
          onStatusChange={handleSubmitStatusChange}
          isLoading={updateStatusMutation.isPending}
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