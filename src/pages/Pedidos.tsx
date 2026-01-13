import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem, PedidoStatus } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Search, Filter, Eye, Edit, Trash2, Loader2, CalendarIcon, DollarSign, FileText, Scissors, History, MessageSquare, MoreHorizontal, User, Clock, CheckCircle, XCircle, Package, X, Printer, Ruler, PackageOpen, Wrench, Users, Activity, CheckSquare, ChevronDown, Sparkles, ScrollText } from 'lucide-react';
import { PedidoForm } from '@/components/PedidoForm';
import { PedidoDetails } from '@/components/PedidoDetails';
import { EmptyState } from '@/components/EmptyState';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { OrderStatusIndicator } from '@/components/OrderStatusIndicator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePedidos, useClientes, useProdutos, usePaginatedPedidos, useTiposProducao } from '@/hooks/useDataFetch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/PaginationControls';
import { DateRange } from 'react-day-picker'; // Importar DateRange
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { TutorialGuide } from '@/components/TutorialGuide';
import { useTour } from '@/hooks/useTour';
import { PEDIDOS_TOUR } from '@/utils/tours';
import { useCompanyProfile, getCompanyInfoForPDF } from '@/hooks/useCompanyProfile';
import { printThermalReceipt } from '@/utils/thermalPrinter';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const PedidosPage: React.FC = () => {
  const { session, profile, isLoading: sessionLoading } = useSession();
  const { data: tiposProducao } = useTiposProducao();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const { canWriteData } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isTourOpen, currentStep, steps, startTour, nextStep, prevStep, closeTour, shouldAutoStart } = useTour(PEDIDOS_TOUR, 'pedidos');
  const { companyProfile } = useCompanyProfile();

  useEffect(() => {
    if (shouldAutoStart && !sessionLoading) {
      const timer = setTimeout(startTour, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoStart, sessionLoading, startTour]);

  // Verificação CRÍTICA no início do componente
  if (sessionLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  // Verificação do token de acesso
  if (!accessToken) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8 space-y-4">
          <div className="text-red-600 dark:text-red-400 font-semibold text-lg">
            Erro de Autenticação
          </div>
          <div className="text-muted-foreground">
            Token de acesso não encontrado. Por favor, faça login novamente.
          </div>
          <Button onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      </div>
    );
  }

  // Estado de Paginação e Limite
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[1]); // Default 20

  // Filtros
  const [rawSearchTerm, setRawSearchTerm] = useState('');
  const searchTerm = useDebounce(rawSearchTerm, 300);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined); // Usar DateRange | undefined
  const [filterClientId, setFilterClientId] = useState<string | null>(null);
  const [filterClientName, setFilterClientName] = useState<string | null>(null);

  // IMPORTANTE: Só chamar os hooks DEPOIS de garantir que o token está disponível
  // Fetch de dados paginados com filtros
  const { data: paginatedData, isLoading: isLoadingPaginated, error: paginatedError } = usePaginatedPedidos(
    currentPage,
    itemsPerPage,
    filterStatus,
    filterDateRange,
    filterClientId,
    searchTerm // PASSANDO O TERMO DE BUSCA PARA O BACKEND
  );

  // Garantir que os hooks só executem se o token estiver disponível
  const { data: clientes, isLoading: isLoadingClientes, error: clientesError } = useClientes();
  const { data: produtos, isLoading: isLoadingProdutos, error: produtosError } = useProdutos();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [viewingPedidoId, setViewingPedidoId] = useState<string | null>(null);
  const [statusChangePedido, setStatusChangePedido] = useState<Pedido | null>(null);
  const [viewingStatusHistory, setViewingStatusHistory] = useState<Pedido | null>(null);

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
      if (!canWriteData) {
        setShowUpgradeModal(true);
      } else {
        setEditingPedido(null);
        setIsFormOpen(true);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Resetar página para 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDateRange, filterClientId, searchTerm]);

  const handleClearClientFilter = () => {
    setFilterClientId(null);
    setFilterClientName(null);
  };

  const handleCreatePedido = () => {
    if (!canWriteData) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingPedido(null); // Garante que é um novo pedido
    setIsFormOpen(true);
  };

  const handleEditPedido = (pedido: Pedido) => {
    if (!canWriteData) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingPedido(pedido);
    setIsFormOpen(true);
  };

  const handleViewPedido = (pedidoId: string) => {
    setViewingPedidoId(pedidoId);
    setIsDetailsOpen(true);
  };

  const handleStatusChange = (pedido: Pedido) => {
    if (!canWriteData) {
      setShowUpgradeModal(true);
      return;
    }
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
      const companyInfo = getCompanyInfoForPDF(companyProfile);
      await generateOrderPDF(pedido, 'save', undefined, companyInfo);
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
      const companyInfo = getCompanyInfoForPDF(companyProfile);
      await generateOrderPDF(pedido, 'print', undefined, companyInfo);
    } catch (error: any) {
      showError(`Erro ao gerar PDF para impressão: ${error.message}`);
    }
  };
  // --- Fim Funções de PDF ---


  // --- Mutações ---

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, observacao, statusAnterior }: { id: string, newStatus: string, observacao?: string, statusAnterior: string }) => {
      const validToken = await getValidToken();
      if (!validToken || !session) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // Atualizar status do pedido
      const updateUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Erro ao atualizar status: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`);
      }

      // Inserir histórico se necessário
      if (newStatus !== statusAnterior || observacao) {
        const historyUrl = `${SUPABASE_URL}/rest/v1/pedido_status_history`;
        const historyResponse = await fetch(historyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify([{
            pedido_id: id,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao?.trim() || null,
            user_id: session.user.id
          }])
        });

        if (!historyResponse.ok) {
          const errorText = await historyResponse.text();
          console.warn('Aviso: Erro ao salvar histórico:', errorText);
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
      const validToken = await getValidToken();
      if (!validToken || !session) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      };

      // Excluir itens e serviços relacionados
      const deleteRelated = async (table: string) => {
        try {
          const url = `${SUPABASE_URL}/rest/v1/${table}?pedido_id=eq.${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });

          if (!response.ok) {
            const errorText = await response.text();
            // Logar aviso mas não interromper imediatamente (tenta excluir o pedido mesmo assim, 
            // caso as relações já tenham sido removidas ou não existam)
            console.warn(`Aviso: Erro ao excluir ${table}: ${response.status} - ${errorText}`);

            // Se for erro de permissão (RLS) ou erro severo, talvez devêssemos parar?
            // Mas vamos tentar seguir para o delete principal.
          }
        } catch (e) {
          console.error(`Exceção ao excluir ${table}:`, e);
        }
      };

      // Tentar excluir dependências em paralelo, mas tratar erros individualmente
      await Promise.all([
        deleteRelated('pedido_items'),
        deleteRelated('pedido_servicos'),
        deleteRelated('pedido_status_history')
      ]);

      // Excluir o pedido
      const pedidoUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${id}&user_id=eq.${session.user.id}`;
      const response = await fetch(pedidoUrl, { method: 'DELETE', headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro ao excluir pedido principal:", errorText);
        throw new Error(`Erro ao excluir pedido: ${response.status} ${response.statusText} - ${errorText}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess("Pedido excluído com sucesso!");
      setIsDetailsOpen(false);
      setViewingPedidoId(null);
    },
    onError: (error: any) => {
      console.error("Erro na mutação de exclusão:", error);
      showError(`Erro ao excluir pedido: ${error.message}`);
    }
  });

  const handleSubmitPedidoMutation = useMutation({
    mutationFn: async ({ data, pedidoId }: { data: any, pedidoId?: string }) => {
      const validToken = await getValidToken();
      if (!validToken || !session) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const { items, servicos, created_at, ...pedidoData } = data;

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      if (pedidoId) {
        // Update existing pedido
        const updateData = {
          ...pedidoData,
          created_at,
          status: editingPedido?.status || 'pendente'
        };

        const updateUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${pedidoId}`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updateData)
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Erro ao atualizar pedido: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`);
        }

        // Handle items: delete old, insert new
        const deleteItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items?pedido_id=eq.${pedidoId}`;
        await fetch(deleteItemsUrl, { method: 'DELETE', headers });

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: pedidoId }));
          const insertItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items`;
          const itemsResponse = await fetch(insertItemsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemsToInsert)
          });
          if (!itemsResponse.ok) {
            const errorText = await itemsResponse.text();
            throw new Error(`Erro ao inserir itens: ${itemsResponse.status} ${itemsResponse.statusText} - ${errorText}`);
          }
        }

        // Handle servicos: delete old, insert new
        const deleteServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos?pedido_id=eq.${pedidoId}`;
        await fetch(deleteServicosUrl, { method: 'DELETE', headers });

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: pedidoId }));
          const insertServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos`;
          const servicosResponse = await fetch(insertServicosUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(servicosToInsert)
          });
          if (!servicosResponse.ok) {
            const errorText = await servicosResponse.text();
            throw new Error(`Erro ao inserir serviços: ${servicosResponse.status} ${servicosResponse.statusText} - ${errorText}`);
          }
        }
        return { type: 'update' };
      } else {
        // Create new pedido
        const newPedidoData = {
          ...pedidoData,
          user_id: session.user.id,
          organization_id: profile?.organization_id,
          status: 'pendente',
          created_at: created_at
        };

        const createUrl = `${SUPABASE_URL}/rest/v1/pedidos`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify([newPedidoData])
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Erro ao criar pedido: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
        }

        const newPedidoArray = await createResponse.json();
        const newPedido = Array.isArray(newPedidoArray) ? newPedidoArray[0] : newPedidoArray;

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: newPedido.id }));
          const insertItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items`;
          const itemsResponse = await fetch(insertItemsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemsToInsert)
          });
          if (!itemsResponse.ok) {
            const errorText = await itemsResponse.text();
            throw new Error(`Erro ao inserir itens: ${itemsResponse.status} ${itemsResponse.statusText} - ${errorText}`);
          }
        }

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: newPedido.id }));
          const insertServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos`;
          const servicosResponse = await fetch(insertServicosUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(servicosToInsert)
          });
          if (!servicosResponse.ok) {
            const errorText = await servicosResponse.text();
            throw new Error(`Erro ao inserir serviços: ${servicosResponse.status} ${servicosResponse.statusText} - ${errorText}`);
          }
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

  // OTIMIZAÇÃO: A filtragem por termo de busca agora é feita no backend.
  const pedidosDaPagina = paginatedData?.pedidos || [];
  const totalPedidos = paginatedData?.totalCount || 0;
  const totalPages = Math.ceil(totalPedidos / itemsPerPage);

  // Não precisamos mais de useMemo para filtrar, pois o backend já filtrou.
  const filteredPedidos = pedidosDaPagina;

  const isGlobalLoading = isLoadingPaginated || isLoadingClientes || isLoadingProdutos;

  // Verificar erros de todos os hooks
  const hasError = paginatedError || clientesError || produtosError;
  const errorMessage = paginatedError?.message || clientesError?.message || produtosError?.message || 'Erro desconhecido ao carregar pedidos';

  if (hasError) {
    // Log detalhado do erro para debug
    console.error('[PedidosPage] Erro detectado:', {
      paginatedError: paginatedError?.message,
      paginatedErrorStack: paginatedError?.stack,
      paginatedErrorFull: paginatedError,
      clientesError: clientesError?.message,
      produtosError: produtosError?.message,
      accessToken: !!accessToken,
      session: !!session,
    });

    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8 space-y-4">
          <div className="text-red-600 dark:text-red-400 font-semibold text-lg">
            Erro ao carregar pedidos
          </div>
          <div className="text-muted-foreground">
            {errorMessage}
          </div>
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            {errorMessage.includes('Cannot read properties of undefined') && (
              <p>O cliente Supabase não está disponível. Verifique a conexão.</p>
            )}
            {errorMessage.includes('Supabase client') && (
              <p>Problema na inicialização do cliente Supabase.</p>
            )}
          </div>
          {(errorMessage.includes('Supabase client') || errorMessage.includes('undefined')) && (
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Componente de Skeleton otimizado para a lista de pedidos
  const PedidoSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(itemsPerPage)].map((_, i) => (
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
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pedidos</h1>
          {!isTourOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={startTour}
              className="hidden sm:flex text-[10px] h-7 bg-primary/5 hover:bg-primary/10 border-primary/20"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Ver Tutorial
            </Button>
          )}
        </div>
        <Button id="btn-novo-pedido" onClick={handleCreatePedido} className="w-full sm:w-auto">
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
          id="search-pedidos"
          placeholder="Buscar por cliente, produto, ID..."
          value={rawSearchTerm}
          onChange={(e) => setRawSearchTerm(e.target.value)}
          className="md:col-span-2 lg:col-span-2"
        />

        {/* Filtro de Status - REATIVADO */}
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

        {/* Filtro de Data - REATIVADO */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !filterDateRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterDateRange?.from ? (
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
              defaultMonth={filterDateRange?.from}
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
      ) : (filteredPedidos.length === 0 && !isTourOpen) ? (
        <div className="col-span-full">
          <EmptyState
            title={searchTerm || filterStatus !== 'todos' || filterClientId ? "Nenhum pedido encontrado com esses filtros" : "Nenhum pedido cadastrado"}
            description={searchTerm || filterStatus !== 'todos' || filterClientId ? "Tente ajustar seus filtros ou buscar por outro termo." : "Comece a vender agora mesmo! Crie seu primeiro pedido para gerenciar suas vendas."}
            icon={PackageOpen}
            actionLabel={searchTerm || filterStatus !== 'todos' || filterClientId ? "Limpar Filtros" : "Criar Primeiro Pedido"}
            onAction={searchTerm || filterStatus !== 'todos' || filterClientId ? () => {
              setRawSearchTerm('');
              setFilterStatus('todos');
              setFilterClientId(null);
              setFilterDateRange(undefined);
            } : handleCreatePedido}
          />
        </div>
      ) : (
        <>
          <div id="lista-pedidos" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Card de Demonstração para o Tutorial quando a lista está vazia */}
            {isTourOpen && filteredPedidos.length === 0 && (
              <Card
                id="first-order-card"
                className="opacity-90 border-dashed border-primary/50 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg z-10">
                  EXEMPLO
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <CardTitle className="text-lg font-semibold">Pedido #1001</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <User className="h-3 w-3" /> João Silva (Exemplo)
                      </CardDescription>
                    </div>
                    <div id="order-status-badge">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                        <Wrench className="h-3 w-3 mr-1" /> Processando
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4 mr-2" /> 10/01/2024
                  </div>
                  <div className="flex items-center text-base font-bold text-primary">
                    <DollarSign className="h-4 w-4 mr-1" /> Total: R$ 450,00
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center text-[10px] font-bold px-2 py-0.5 rounded border text-blue-600 bg-blue-50">
                      <Printer className="h-3 w-3 mr-1" /> DTF: 5.00m
                    </div>
                    <div className="flex items-center text-[10px] font-bold px-2 py-0.5 rounded border text-orange-600 bg-orange-50">
                      <Scissors className="h-3 w-3 mr-1" /> VINIL: 2.50m
                    </div>
                  </div>
                  <div id="order-card-actions" className="flex justify-end gap-2 pt-3 border-t mt-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 opacity-50"><FileText className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 opacity-50"><Printer className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {filteredPedidos.map((pedido, index) => (
              <Card
                key={pedido.id}
                id={index === 0 ? "first-order-card" : undefined}
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
                    <div id={index === 0 ? "order-status-badge" : undefined} className="flex-shrink-0 max-w-full">
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

                  {/* Exibição Detalhada da Produção (Dinâmica) */}
                  {pedido.pedido_items && pedido.pedido_items.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(() => {
                        // Agrupar itens por tipo
                        const totalsByType = new Map<string, number>();
                        pedido.pedido_items.forEach(item => {
                          const tipo = (item.tipo || 'dtf').toLowerCase();
                          const current = totalsByType.get(tipo) || 0;
                          totalsByType.set(tipo, current + Number(item.quantidade || 0));
                        });

                        return Array.from(totalsByType.entries()).map(([tipo, total]) => {
                          const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipo);
                          const isVinil = tipo === 'vinil';
                          const isDTF = tipo === 'dtf';
                          const isUnidade = tipoInfo?.unidade_medida === 'unidade';

                          let Icon = Ruler;
                          let colorClass = "text-gray-600 bg-gray-50 border-gray-100 dark:bg-gray-900/20 dark:border-gray-800";
                          let label = tipoInfo?.nome || tipo.toUpperCase();

                          if (isVinil) {
                            Icon = Scissors;
                            colorClass = "text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800";
                          } else if (isDTF) {
                            Icon = Printer;
                            colorClass = "text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800";
                          } else if (tipoInfo) {
                            Icon = isUnidade ? Package : Ruler;
                            colorClass = "text-primary bg-primary/5 border-primary/10 dark:bg-primary/900/20 dark:border-primary/800";
                          }

                          return (
                            <div key={tipo} className={cn("flex items-center text-[0.65rem] font-bold px-2 py-0.5 rounded border", colorClass)}>
                              <Icon className="h-3 w-3 mr-1" />
                              {label}: {total.toFixed(isUnidade ? 0 : 2)}{isUnidade ? 'und' : 'm'}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {pedido.latest_status_observation && (
                    <div className="flex items-start text-sm text-muted-foreground italic bg-muted p-2 rounded-md">
                      <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{pedido.latest_status_observation}</span>
                    </div>
                  )}

                  <div id={index === 0 ? "order-card-actions" : undefined} className="flex justify-end gap-2 pt-3 border-t mt-3">
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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Opções de Impressão</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handlePrintPDF(pedido);
                        }}>
                          <Printer className="h-4 w-4 mr-2" />
                          Nota (A4)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          printThermalReceipt(pedido);
                        }}>
                          <ScrollText className="h-4 w-4 mr-2" />
                          Cupom (80mm)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

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

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Pedidos por página:</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => setItemsPerPage(Number(value))}
                disabled={isGlobalLoading}
              >
                <SelectTrigger className="w-[80px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={isLoadingPaginated}
            />

            <div className="text-sm text-muted-foreground">
              Total de {totalPedidos} pedidos
            </div>
          </div>
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

      <SubscriptionModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />

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

export default PedidosPage;