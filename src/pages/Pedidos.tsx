import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem, PedidoStatus } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Search, Filter, Eye, Edit, Trash2, Loader2, CalendarIcon, DollarSign, FileText, Scissors, History, MessageSquare, MoreHorizontal, User, Clock, CheckCircle, XCircle, Package, X, Printer, Ruler, PackageOpen, Wrench, Users, Activity, CheckSquare, ChevronDown, Sparkles, ScrollText, Calculator, Bike, Zap, Tag, Layers, PenTool, BadgeCheck, Palette, Info } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
// Lazy loaded components definitions
const PedidoForm = lazy(() => import('@/components/PedidoForm').then(m => ({ default: m.PedidoForm })));
const DTFCalculatorModal = lazy(() => import('@/components/DTFCalculatorModal').then(m => ({ default: m.DTFCalculatorModal })));
const PedidoDetails = lazy(() => import('@/components/PedidoDetails').then(m => ({ default: m.PedidoDetails })));
import { showSuccess, showError } from '@/utils/toast';
import { generateOrderPDFBase64 } from '@/utils/pdfGenerator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { generateOrderPDF } from '@/utils/pdfGenerator';

const StatusChangeDialog = lazy(() => import('@/components/StatusChangeDialog').then(m => ({ default: m.StatusChangeDialog })));
const StatusHistoryDialog = lazy(() => import('@/components/StatusHistoryDialog').then(m => ({ default: m.StatusHistoryDialog })));
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
import { usePedidos, useClientes, useProdutos, usePaginatedPedidos, useTiposProducao, restoreInsumosFromPedido, deductInsumosFromPedido, isInventoryConsumingStatus } from '@/hooks/useDataFetch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/PaginationControls';
import { DateRange } from 'react-day-picker'; // Importar DateRange
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabase } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { useSubscription } from '@/hooks/useSubscription';
const SubscriptionModal = lazy(() => import('@/components/SubscriptionModal').then(m => ({ default: m.SubscriptionModal })));
import { TutorialGuide } from '@/components/TutorialGuide';
import { useTour } from '@/hooks/useTour';
import { PEDIDOS_TOUR } from '@/utils/tours';
import { useCompanyProfile, getCompanyInfoForPDF } from '@/hooks/useCompanyProfile';
import { printThermalReceipt } from '@/utils/thermalPrinter';
import { motion } from 'framer-motion';
import { toPng, toBlob } from 'html-to-image';
import { Share2, Copy, Download, Image as ImageIcon } from 'lucide-react';
import { logger } from '@/utils/logger';
import { useIsPlusMode } from '@/hooks/useIsPlusMode';
import { WhatsAppActionDialog } from '@/components/WhatsAppActionDialog';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

const iconsMap: Record<string, any> = {
  Printer,
  Scissors,
  Package,
  Ruler,
  Info,
  Wrench,
  Zap,
  Tag,
  Layers,
  PenTool,
  BadgeCheck,
  Palette
};

const generateOrderSummary = (pedido: Pedido) => {
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM - HH:mm", { locale: ptBR });
    } catch (e) {
      return "-";
    }
  };

  const formatCurrency = (value: any) => {
    const val = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  const separator = "------------------------------------------";
  const dashedSeparator = "        ------------------";

  const statusText = pedido.status === 'pago' ? 'PAGO' : 'NÃO PAGO';

  let summary = `*PEDIDO #${pedido.order_number}*\n`;
  summary += `${formatDate(pedido.created_at)}\n\n`;
  summary += `${separator}\n`;
  summary += `*${pedido.clientes?.nome?.toUpperCase() || 'CLIENTE NÃO IDENTIFICADO'}*\n`;
  summary += `Tel: ${pedido.clientes?.telefone || '-'}\n`;
  summary += `${separator}\n\n`;

  // Itens
  if (pedido.pedido_items && pedido.pedido_items.length > 0) {
    pedido.pedido_items.forEach((item, index) => {
      const isLinear = item.tipo === 'dtf' || item.tipo === 'vinil';
      const unitFull = isLinear ? 'Metros' : 'Unid.';
      const unitSingular = isLinear ? 'metro' : 'unid.';
      const quantityDisplay = isLinear
        ? Number(item.quantidade).toFixed(2).replace('.', ',')
        : item.quantidade;

      summary += `*Produto:* ${item.produto_nome} ${(item.tipo) ? `(${item.tipo.toUpperCase()})` : ''}\n`;
      summary += `*Tamanho:* ${quantityDisplay} ${unitFull}\n`;
      summary += `*Valor unitário:* ${formatCurrency(item.preco_unitario)}/${unitSingular}\n`;
      summary += `*Total:* ${formatCurrency(Number(item.preco_unitario) * Number(item.quantidade))}\n`;
      if (item.observacao) {
        summary += `_Obs: ${item.observacao}_\n`;
      }

      if (index < pedido.pedido_items.length - 1 || (pedido.servicos && pedido.servicos.length > 0)) {
        summary += `${dashedSeparator}\n\n`;
      }
    });
  }

  // Serviços
  if (pedido.servicos && pedido.servicos.length > 0) {
    summary += `*SERVIÇOS EXTRAS*\n`;
    pedido.servicos.forEach(servico => {
      const lineTotal = formatCurrency(Number(servico.valor_unitario) * Number(servico.quantidade));
      const namePart = `${servico.nome} (${servico.quantidade}x)`;
      summary += `${namePart}\nTotal: ${lineTotal}\n`;
    });
    summary += `${separator}\n\n`;
  } else if (pedido.pedido_items && pedido.pedido_items.length > 0) {
    summary += `${separator}\n\n`;
  }

  // Cálculos de Totais
  const subtotalProdutos = Number(pedido.subtotal_produtos || 0);
  const subtotalServicos = Number(pedido.subtotal_servicos || 0);
  const subtotal = subtotalProdutos + subtotalServicos;
  const frete = (pedido.tipo_entrega === 'frete' ? Number(pedido.valor_frete || 0) : 0);
  const descontoValor = Number(pedido.desconto_valor || 0);
  const descontoPercentual = Number(pedido.desconto_percentual || 0);
  const descontoPercentualCalculado = subtotal * (descontoPercentual / 100);

  const valorTotalCalculado = Math.max(0, subtotal + frete - descontoValor - descontoPercentualCalculado);
  const valorExibicao = Number(pedido.valor_total) || valorTotalCalculado;

  summary += `*TOTAL: ${formatCurrency(valorExibicao)}*\n`;

  // Só incluir informação de entrega se for FRETE
  if (pedido.tipo_entrega === 'frete') {
    summary += `ENTREGA: FRETE\n`;
    if (pedido.valor_frete && Number(pedido.valor_frete) > 0) {
      summary += `VALOR DO FRETE: ${formatCurrency(pedido.valor_frete)}\n`;
    }
    if (pedido.transportadora) {
      summary += `TRANSPORTADORA: ${pedido.transportadora.toUpperCase()}\n`;
    }
  }

  summary += `STATUS: ${statusText}\n`;
  summary += `\n*** AGRADECEMOS A PREFERÊNCIA ***`;

  return summary;
};

const PedidosPage: React.FC = () => {
  const { session, profile, isLoading: sessionLoading } = useSession();
  const { data: tiposProducao } = useTiposProducao();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token;
  const { canWriteData } = useSubscription();
  const { canSendDirectly: isPlusMode } = useIsPlusMode();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [whatsAppDialog, setWhatsAppDialog] = useState<{ open: boolean; pedido: Pedido | null; summary: string }>({ open: false, pedido: null, summary: '' });
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
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [showUpdateCard, setShowUpdateCard] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);
  const [viewingPedidoId, setViewingPedidoId] = useState<string | null>(null);
  const [statusChangePedido, setStatusChangePedido] = useState<Pedido | null>(null);
  const [viewingStatusHistory, setViewingStatusHistory] = useState<Pedido | null>(null);
  const [pedidoToDelete, setPedidoToDelete] = useState<Pedido | null>(null);

  useEffect(() => {
    const hasViewed = localStorage.getItem('dtf_calculator_update_viewed_v2');
    if (!hasViewed) {
      setShowUpdateCard(true);
    }
  }, []);

  const handleDismissUpdateCard = () => {
    localStorage.setItem('dtf_calculator_update_viewed_v2', 'true');
    setShowUpdateCard(false);
  };

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

  // --- Funções de Compartilhamento ---
  const handleCopySummary = (pedido: Pedido) => {
    const summary = generateOrderSummary(pedido);
    navigator.clipboard.writeText(summary).then(() => {
      showSuccess("Resumo copiado para a área de transferência!");
    }).catch(() => {
      showError("Erro ao copiar resumo.");
    });
  };

  const handleShareWhatsApp = (pedido: Pedido) => {
    const summary = generateOrderSummary(pedido);

    // Tentar usar o telefone do cliente, se disponível
    let phone = pedido.clientes?.telefone || '';
    // Limpar telefone (manter apenas números)
    phone = phone.replace(/\D/g, '');

    if (isPlusMode) {
      // PLUS MODE: Abrir dialog para envio direto (mesmo se sem telefone, o dialog permite buscar)
      setWhatsAppDialog({ open: true, pedido, summary });
    } else {
      // NORMAL MODE: Abrir link wa.me
      const encodedText = encodeURIComponent(summary);
      const url = phone
        ? `https://wa.me/55${phone}?text=${encodedText}`
        : `https://wa.me/?text=${encodedText}`;
      window.open(url, '_blank');
    }
  };

  const handleConfirmWhatsAppSend = async (data: { phone?: string; attachPdf?: boolean } = {}) => {
    if (!whatsAppDialog.pedido) return;

    try {
      const phone = (data.phone || whatsAppDialog.pedido.clientes?.telefone || '').replace(/\D/g, '');
      const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
      let action = 'send-text';
      let bodyData: any = {
        phone: formattedPhone,
        message: whatsAppDialog.summary
      };

      if (data.attachPdf) {
        showSuccess("Preparando PDF e link público...");
        const pdfBase64 = await generateOrderPDFBase64(whatsAppDialog.pedido);

        const fileName = `pedido_${whatsAppDialog.pedido.id}_${Date.now()}.pdf`;

        // Converte para binário (compatível com navegador)
        const binaryString = window.atob(pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload pro Supabase
        const { error: uploadError } = await supabase.storage
          .from('order-pdfs')
          .upload(fileName, bytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('order-pdfs')
            .getPublicUrl(fileName);

          console.log('[WhatsApp] Generated Policy-Compliant URL:', publicUrl);

          action = 'send-media';
          bodyData = {
            phone: formattedPhone,
            message: whatsAppDialog.summary,
            mediaUrl: publicUrl, // Evolution baixa e anexa como arquivo
            mediaName: `Pedido_${whatsAppDialog.pedido.order_number}.pdf`,
            mediaType: 'document'
          };
        } else {
          // Se falhar o upload, tenta o clássico
          action = 'send-media';
          bodyData = {
            phone: formattedPhone,
            message: whatsAppDialog.summary,
            mediaBase64: pdfBase64,
            mediaName: `Pedido_${whatsAppDialog.pedido.order_number}.pdf`,
            mediaType: 'document'
          };
        }
      }

      const { data: resultData, error } = await supabase.functions.invoke('whatsapp-proxy', {
        body: {
          action,
          ...bodyData
        },
      });

      if (error) throw error;
      if (!resultData?.success) throw new Error(resultData?.message || 'Erro ao enviar');

      showSuccess(`Resumo enviado para ${whatsAppDialog.pedido.clientes?.nome || 'cliente'}!`);
      setWhatsAppDialog({ open: false, pedido: null, summary: '' });
    } catch (err: any) {
      console.error('Erro no envio direto:', err);

      const errorMessage = err.message || JSON.stringify(err);

      // Se foi envio de mídia e falhou por erro de upload, tenta só texto
      if (data.attachPdf && errorMessage.includes("Media upload failed")) {
        console.log('[WhatsApp] Media failed, retrying with text only...');
        showError('PDF não suportado pelo servidor. Enviando apenas texto...');

        try {
          const phone = (data.phone || whatsAppDialog.pedido.clientes?.telefone || '').replace(/\D/g, '');
          const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;

          const { data: textResult, error: textError } = await supabase.functions.invoke('whatsapp-proxy', {
            body: {
              action: 'send-text',
              phone: formattedPhone,
              message: whatsAppDialog.summary + '\n\n📎 (PDF disponível para download no sistema)'
            },
          });

          if (!textError && textResult?.success) {
            showSuccess(`Texto enviado! PDF não suportado pelo servidor.`);
            setWhatsAppDialog({ open: false, pedido: null, summary: '' });
            return;
          }
        } catch (textErr) {
          console.error('Fallback text also failed:', textErr);
        }
      }

      if (errorMessage.includes("Instância não conectada") || errorMessage.includes("Disconnected")) {
        showError('Seu WhatsApp não está conectado! Vá em Configurações > WhatsApp para conectar.');
      } else {
        showError(`Erro: ${errorMessage.substring(0, 100)}. Abrindo WhatsApp Web...`);
        // Fallback to wa.me link only for non-connection errors
        const phone = (whatsAppDialog.pedido.clientes?.telefone || '').replace(/\D/g, '');
        const encodedText = encodeURIComponent(whatsAppDialog.summary);
        const url = phone
          ? `https://wa.me/55${phone}?text=${encodedText}`
          : `https://wa.me/?text=${encodedText}`;
        window.open(url, '_blank');
      }
      setWhatsAppDialog({ open: false, pedido: null, summary: '' });
    }
  };

  const handleDownloadCardImage = async (pedidoId: string, orderNumber: number) => {
    const element = document.getElementById(`order-card-${pedidoId}`);
    if (!element) {
      showError("Erro ao localizar o card do pedido.");
      return;
    }

    try {
      // Pequeno hack para garantir que estilos carreguem
      const dataUrl = await toPng(element, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `pedido-${orderNumber}.png`;
      link.href = dataUrl;
      link.click();
      showSuccess("Imagem do card baixada!");
    } catch (err) {
      console.error(err);
      showError("Erro ao gerar imagem do card.");
    }
  };

  const handleCopyCardImage = async (pedidoId: string) => {
    const element = document.getElementById(`order-card-${pedidoId}`);
    if (!element) {
      showError("Erro ao localizar o card do pedido.");
      return;
    }

    try {
      const blob = await toBlob(element, { cacheBust: true, pixelRatio: 2 });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showSuccess("Imagem do card copiada!");
      } else {
        throw new Error("Falha ao gerar blob da imagem");
      }
    } catch (err) {
      console.error(err);
      showError("Erro ao copiar imagem. Navegador não suportado?");
    }
  };
  // --- Fim Funções de Compartilhamento ---


  // --- Mutações ---

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus, observacao, statusAnterior, pedidoFull }: { id: string, newStatus: string, observacao?: string, statusAnterior: string, pedidoFull?: Pedido }) => {
      const validToken = await getValidToken();
      if (!validToken || !session) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      // Atualizar status do pedido e data de pagamento se necessário
      const pago_at = newStatus === 'pago' ? new Date().toISOString() : (statusAnterior === 'pago' ? null : undefined);

      const updateUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${id}`;
      const updateBody: any = { status: newStatus };
      if (pago_at !== undefined) updateBody.pago_at = pago_at;

      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateBody)
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

      // --- Lógica de Inventário Unificada ---
      if (pedidoFull) {
        const wasConsuming = isInventoryConsumingStatus(statusAnterior);
        const isNowConsuming = isInventoryConsumingStatus(newStatus);

        if (!wasConsuming && isNowConsuming) {
          console.log(`[Inventory] Status mudou para ${newStatus}. Deduzindo estoque...`);
          await deductInsumosFromPedido(pedidoFull);
        } else if (wasConsuming && !isNowConsuming) {
          console.log(`[Inventory] Status mudou para ${newStatus}. Restaurando estoque...`);
          await restoreInsumosFromPedido(pedidoFull);
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

  const handleSubmitStatusChange = (newStatus: string, observacao?: string, notifyClient?: boolean) => {
    if (!statusChangePedido) return;
    updateStatusMutation.mutate({
      id: statusChangePedido.id,
      newStatus,
      observacao,
      statusAnterior: statusChangePedido.status,
      pedidoFull: statusChangePedido
    });

    // Auto-Notify Client via Gabi AI (WhatsApp)
    if (notifyClient && newStatus === 'aguardando retirada') {
      showSuccess("Gabi AI: Enviando notificação...");
      supabase.functions.invoke('send-whatsapp-notification', {
        body: { orderId: statusChangePedido.id }
      }).then(({ error, data }) => {
        if (error) {
          console.error("Erro Gabi AI:", error);
          showError("Gabi não conseguiu enviar o Zap. Verifique a conexão.");
        } else {
          console.log("Gabi AI Response:", data);
          showSuccess("Gabi AI: Mensagem enviada com sucesso!");
        }
      });
    }
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

      // 1. Buscar detalhes do pedido para ver se precisamos restaurar estoque
      const { data: pedido, error: fetchError } = await supabase
        .from('pedidos')
        .select('*, pedido_items(*)')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error("Erro ao buscar pedido para exclusão:", fetchError);
      } else if (pedido) {
        // 2. Se o pedido consumia estoque, restaurar os insumos
        const wasConsuming = isInventoryConsumingStatus(pedido.status);
        if (wasConsuming) {
          console.log(`[Inventory] Pedido #${pedido.order_number} excluído com status que consumia estoque (${pedido.status}). Restaurando estoque...`);
          await restoreInsumosFromPedido(pedido);
        }
      }

      // 3. Excluir itens e serviços relacionados
      const deleteRelated = async (table: string) => {
        try {
          const url = `${SUPABASE_URL}/rest/v1/${table}?pedido_id=eq.${id}`;
          const response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Aviso: Erro ao excluir ${table}: ${response.status} - ${errorText}`);
          }
        } catch (e) {
          console.error(`Exceção ao excluir ${table}:`, e);
        }
      };

      await Promise.all([
        deleteRelated('pedido_items'),
        deleteRelated('pedido_servicos'),
        deleteRelated('pedido_status_history')
      ]);

      // 4. Excluir o pedido
      const pedidoUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${id}&user_id=eq.${session.user.id}`;
      const response = await fetch(pedidoUrl, { method: 'DELETE', headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao excluir pedido: ${response.status} - ${errorText}`);
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
        // --- Lógica de Inventário para Edição (Opção B) ---
        // 1. Identificar se o estado antigo e o novo estado consomem estoque
        const oldStatus = editingPedido?.status || 'pendente';
        const newStatus = oldStatus; // Atualmente o formulário não permite mudar status, mas mantemos a variável para clareza

        const wasConsuming = isInventoryConsumingStatus(oldStatus);
        const isNowConsuming = isInventoryConsumingStatus(newStatus);

        // 2. Se o pedido JÁ consumia estoque, restauramos TUDO antes da edição
        if (wasConsuming && editingPedido) {
          logger.info(`[Inventory] Estornando estoque pré-edição para pedido #${editingPedido.order_number}...`);
          await restoreInsumosFromPedido(editingPedido);
        }

        // 3. Atualizar o pedido no Banco de Dados
        const updateData = {
          ...pedidoData,
          created_at,
          status: newStatus,
          pago_at: editingPedido?.pago_at
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

        // 4. Atualizar os itens (Deletar antigos, Inserir novos)
        // PROTEÇÃO: Só deletamos e inserimos se o array de itens for válido.
        // Se estivermos editando e o formulário enviou itens vazios, algo pode estar errado na inicialização.
        if (items && items.length > 0) {
          logger.log(`[Mutation] Atualizando ${items.length} itens para pedido ${pedidoId}...`);
          const deleteItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items?pedido_id=eq.${pedidoId}`;
          await fetch(deleteItemsUrl, { method: 'DELETE', headers });

          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: pedidoId }));
          const insertItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items`;
          const itemsResponse = await fetch(insertItemsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemsToInsert)
          });

          if (!itemsResponse.ok) {
            const errorText = await itemsResponse.text();
            throw new Error(`Erro ao inserir novos itens: ${itemsResponse.statusText}`);
          }

          // 5. Se o novo estado (pós-edição) consome estoque, deduzimos os NOVOS valores
          if (isNowConsuming && editingPedido) {
            logger.info(`[Inventory] Re-deduzindo estoque com novos itens para pedido #${editingPedido.order_number}...`);
            await deductInsumosFromPedido({
              ...editingPedido,
              status: newStatus,
              pedido_items: items
            } as Pedido);
          }
        } else {
          console.warn(`[Mutation] Tentativa de salvar pedido ${pedidoId} SEM ITENS. Operação de itens abortada para evitar corrupção.`);
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
        const isPago = data.status === 'pago';
        const newPedidoData = {
          ...pedidoData,
          user_id: session.user.id,
          organization_id: profile?.organization_id,
          status: 'pendente',
          created_at: created_at,
          pago_at: isPago ? new Date().toISOString() : null
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
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            id="btn-gerar-orcamento"
            variant="outline"
            onClick={() => setIsCalculatorOpen(true)}
            className="flex-1 sm:flex-none gap-2 bg-background border-primary/20 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all underline-offset-4 hover:underline"
          >
            <ScrollText className="h-4 w-4" />
            Gerar Orçamento
          </Button>
          <Button id="btn-novo-pedido" onClick={handleCreatePedido} className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Card de Novidade: Calculadora DTF (Mais discreto) */}
      {showUpdateCard && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-[1.5rem] border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all p-4 md:p-6 backdrop-blur-sm">
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismissUpdateCard}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
              <div className="shrink-0 p-3 bg-primary/10 rounded-xl text-primary border border-primary/10">
                <Calculator className="w-7 h-7" />
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 h-4 border-primary/30 text-primary">v2.0</Badge>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nova Ferramenta</span>
                </div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase mb-0.5">
                  Calculadora <span className="text-primary tracking-normal">DTF Profissional</span>
                </h3>
                <p className="text-xs text-muted-foreground font-medium max-w-xl line-clamp-2 md:line-clamp-none">
                  Simule o aproveitamento total do rolo, margens e metros necessários instantaneamente antes de fechar o pedido.
                </p>
              </div>

              <div className="shrink-0">
                <Button
                  onClick={() => { setIsCalculatorOpen(true); handleDismissUpdateCard(); }}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest px-6 h-9 rounded-xl shadow-lg shadow-primary/10 transition-transform active:scale-95"
                >
                  Abrir Agora
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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
                id={`order-card-${pedido.id}`}
                className="touch-manipulation cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50 group"
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
                  {pedido.pago_at && pedido.status === 'pago' && (
                    <div className="flex items-center text-[10px] text-green-600 font-medium">
                      <CheckCircle className="h-3 w-3 mr-1.5" />
                      Pago em: {format(new Date(pedido.pago_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </div>
                  )}
                  <div className="flex items-center text-base font-medium text-gray-900 dark:text-gray-50">
                    <DollarSign className="h-4 w-4 mr-2 text-primary" />
                    {(() => {
                      const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
                      const frete = pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0;
                      const dPerc = subtotal * ((pedido.desconto_percentual || 0) / 100);
                      const totalCalc = Math.max(0, subtotal + frete - (pedido.desconto_valor || 0) - dPerc);
                      return <span>Total: {formatCurrency(totalCalc)}</span>
                    })()}
                  </div>

                  {/* Tipo de Entrega */}
                  {pedido.tipo_entrega === 'retirada' && (
                    <div className="flex items-center text-xs font-semibold">
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 gap-1 py-0 px-2 h-6">
                        <Package className="h-3 w-3" />
                        RETIRADA
                      </Badge>
                    </div>
                  )}

                  {pedido.tipo_entrega === 'frete' && (
                    <div className="flex items-center text-xs font-semibold">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 gap-1 py-0 px-2 h-6">
                        <Bike className="h-3 w-3" />
                        ENTREGA
                      </Badge>
                    </div>
                  )}

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
                          let colorClass = "text-gray-400 bg-gray-500/10 border-gray-500/30";
                          let label = tipoInfo?.nome || tipo.toUpperCase();

                          // Dynamic configuration has priority
                          if (tipoInfo) {
                            if (tipoInfo.icon && iconsMap[tipoInfo.icon]) {
                              Icon = iconsMap[tipoInfo.icon];
                            } else if (isUnidade) {
                              Icon = Package;
                            }

                            if (tipoInfo.color) {
                              // Se a cor salva for do estilo antigo (bg-color-100), mapear para o novo estilo dark
                              if (tipoInfo.color.includes('bg-') && tipoInfo.color.includes('-100')) {
                                const baseColor = tipoInfo.color.split('-')[1]; // ex: orange
                                colorClass = `text-${baseColor}-500 bg-${baseColor}-500/10 border-${baseColor}-500/20`;
                              } else {
                                colorClass = tipoInfo.color + " border-transparent";
                              }
                            } else {
                              // Fallback for types without color config but widely used
                              if (tipo === 'vinil') colorClass = "text-orange-500 bg-orange-500/10 border-orange-500/30";
                              else if (tipo === 'dtf') colorClass = "text-blue-500 bg-blue-500/10 border-blue-500/30";
                              else colorClass = "text-primary bg-primary/10 border-primary/20";
                            }

                            // Fallback specific icons if not configured
                            if (!tipoInfo.icon) {
                              if (tipo === 'vinil') Icon = Scissors;
                              else if (tipo === 'dtf') Icon = Printer;
                            }
                          } else {
                            // Legacy/Fallback for hardcoded string matches without DB entry
                            if (isVinil) {
                              Icon = Scissors;
                              colorClass = "text-orange-500 bg-orange-500/10 border-orange-500/30";
                            } else if (isDTF) {
                              Icon = Printer;
                              colorClass = "text-blue-500 bg-blue-500/10 border-blue-500/30";
                            }
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
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5"
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
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 p-2">
                        <DropdownMenuLabel className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">
                          Compartilhar Pedido
                        </DropdownMenuLabel>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopySummary(pedido); }} className="cursor-pointer">
                          <Copy className="h-4 w-4 mr-2 text-amber-500" />
                          Copiar Resumo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(pedido); }} className={`cursor-pointer ${isPlusMode ? 'bg-gradient-to-r from-orange-500/10 via-yellow-500/10 to-purple-500/10' : ''}`}>
                          {isPlusMode ? (
                            <>
                              <Sparkles className="h-4 w-4 mr-2 text-orange-500" />
                              Enviar Direto ⚡
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-2 text-green-500" />
                              Enviar no WhatsApp
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadCardImage(pedido.id, pedido.order_number); }} className="cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-blue-500" />
                          Baixar Imagem (Card)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyCardImage(pedido.id); }} className="cursor-pointer">
                          <ImageIcon className="h-4 w-4 mr-2 text-purple-500" />
                          Copiar Imagem (Card)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePrintPDF(pedido); }}>
                          Nota (A4)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); printThermalReceipt(pedido); }}>
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
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5"
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
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/5"
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
                        <DropdownMenuItem
                          onSelect={() => setPedidoToDelete(pedido)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                          <span className="text-destructive">Excluir</span>
                        </DropdownMenuItem>
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

      <Suspense fallback={null}>
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
            pagoAt={statusChangePedido.pago_at}
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
        <DTFCalculatorModal
          isOpen={isCalculatorOpen}
          onClose={() => setIsCalculatorOpen(false)}
        />
      </Suspense>

      <Dialog open={!!pedidoToDelete} onOpenChange={(open) => !open && setPedidoToDelete(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o pedido #{pedidoToDelete?.order_number}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPedidoToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pedidoToDelete) {
                  deletePedidoMutation.mutate(pedidoToDelete.id);
                  setPedidoToDelete(null);
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Plus Mode Dialog */}
      <WhatsAppActionDialog
        isOpen={whatsAppDialog.open}
        onOpenChange={(open) => !open && setWhatsAppDialog({ open: false, pedido: null, summary: '' })}
        customerName={whatsAppDialog.pedido?.clientes?.nome || 'Cliente'}
        phone={whatsAppDialog.pedido?.clientes?.telefone || ''}
        messagePreview={whatsAppDialog.summary}
        onConfirm={handleConfirmWhatsAppSend}
        isLoading={isGlobalLoading}
      />
    </div>
  );
};

export default PedidosPage;