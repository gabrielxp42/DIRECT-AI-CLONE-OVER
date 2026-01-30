import React, { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  User,
  Package,
  Wrench,
  DollarSign,
  Tag,
  Percent,
  FileText,
  Edit,
  Trash2,
  Printer,
  Scissors,
  Clock,
  MessageSquare,
  History,
  Ruler,
  Loader2,
  ScrollText,
  CheckCircle,
  Bike,
  Truck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTiposProducao, deductInsumosFromPedido, restoreInsumosFromPedido, isInventoryConsumingStatus } from '@/hooks/useDataFetch';
import { showError, showSuccess } from '@/utils/toast';
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
import { generateOrderPDF } from '@/utils/pdfGenerator';
import { printThermalReceipt } from '@/utils/thermalPrinter';
import { StatusChangeDialog } from '@/components/StatusChangeDialog';
import { StatusHistoryDialog } from '@/components/StatusHistoryDialog';
import { useCompanyProfile, getCompanyInfoForPDF } from '@/hooks/useCompanyProfile';

interface PedidoDetailsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoId: string;
  clientes: Cliente[];
  produtos: Produto[];
  onEdit: (pedido: Pedido) => void;
  onDelete: (id: string) => void;
}

export const PedidoDetails: React.FC<PedidoDetailsProps> = ({
  isOpen,
  onOpenChange,
  pedidoId,
  clientes,
  produtos,
  onEdit,
  onDelete
}) => {
  const { supabase, session } = useSession();
  const { data: tiposProducao } = useTiposProducao();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);
  const { companyProfile } = useCompanyProfile();

  const fetchPedidoDetails = async () => {
    if (!session || !pedidoId) return;

    setLoading(true);
    try {
      // CRÍTICO: Obter token válido ANTES da requisição
      const validToken = await getValidToken();
      const effectiveToken = validToken || session.access_token;

      if (!effectiveToken) {
        showError("Sem token de acesso válido. Por favor, faça login novamente.");
        setLoading(false);
        return;
      }

      // Consulta ÚNICA e completa usando fetch direto
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json'
      };

      const selectParam = '*,clientes(id,nome,telefone,email,endereco),pedido_items(*),pedido_servicos(*),pedido_status_history(*)';
      const url = `${SUPABASE_URL}/rest/v1/pedidos?select=${encodeURIComponent(selectParam)}&id=eq.${pedidoId}`;

      const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedido: ${response.statusText}`);
      }

      const data = await response.json();
      const pedidoData = Array.isArray(data) ? data[0] : data;

      if (!pedidoData) throw new Error("Pedido não encontrado.");

      // O Supabase retorna as relações aninhadas.
      // Precisamos apenas garantir que o histórico esteja ordenado.
      const orderedHistory = (pedidoData.pedido_status_history || []).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Ordenar itens por ordem
      const orderedItems = (pedidoData.pedido_items || []).sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0));

      // Mapear dados para o tipo Pedido (garantindo que servicos e items existam)
      const pedidoCompleto: Pedido = {
        ...pedidoData,
        pedido_items: orderedItems,
        servicos: pedidoData.pedido_servicos || [],
        status_history: orderedHistory,
      } as Pedido;

      setPedido(pedidoCompleto);
      setStatusHistory(orderedHistory);

    } catch (error: any) {
      console.error('Erro ao carregar detalhes do pedido:', error);
      showError(`Erro ao carregar detalhes do pedido: ${error.message}`);
      setPedido(null); // Garantir que o estado seja limpo em caso de erro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pedidoId) {
      fetchPedidoDetails();
    }
  }, [isOpen, pedidoId, supabase, session]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Pendente</Badge>;
      case 'processando':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Processando</Badge>;
      case 'enviado':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Enviado</Badge>;
      case 'entregue':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Entregue</Badge>;
      case 'cancelado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Cancelado</Badge>;
      case 'pago':
        return <Badge className="bg-green-500 text-white hover:bg-green-600">Pago</Badge>;
      case 'aguardando retirada':
        return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Aguardando Retirada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getClienteNome = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : 'Cliente não encontrado';
  };

  const getProdutoNome = (produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    return produto ? produto.nome : 'Produto não encontrado';
  };

  const handleDownloadPDF = async () => {
    if (!pedido) return;
    try {
      if ((!pedido.pedido_items || pedido.pedido_items.length === 0) && (!pedido.servicos || pedido.servicos.length === 0)) {
        showError("O pedido não possui itens ou serviços para gerar o PDF.");
        return;
      }
      const companyInfo = getCompanyInfoForPDF(companyProfile);
      await generateOrderPDF(pedido, 'save', tiposProducao, companyInfo);
      showSuccess("PDF gerado e baixado com sucesso!");
    } catch (error: any) {
      showError(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handlePrintPDF = async () => {
    if (!pedido) return;
    try {
      if ((!pedido.pedido_items || pedido.pedido_items.length === 0) && (!pedido.servicos || pedido.servicos.length === 0)) {
        showError("O pedido não possui itens ou serviços para imprimir.");
        return;
      }
      const companyInfo = getCompanyInfoForPDF(companyProfile);
      await generateOrderPDF(pedido, 'print', tiposProducao, companyInfo);
    } catch (error: any) {
      showError(`Erro ao gerar PDF para impressão: ${error.message}`);
    }
  };

  const handleWhatsAppShare = () => {
    if (!pedido) return;

    const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
    const frete = pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0;
    const descontoPercentualCalculado = subtotal * ((pedido.desconto_percentual || 0) / 100);
    const valorTotalCalculado = Math.max(0, subtotal + frete - (pedido.desconto_valor || 0) - descontoPercentualCalculado);

    const clienteNome = pedido.clientes?.nome || getClienteNome(pedido.cliente_id);
    const orderNum = pedido.order_number;
    const total = formatCurrency(valorTotalCalculado);
    const status = pedido.status.toUpperCase();

    let message = `*RESUMO DO PEDIDO #${orderNum}*\n\n`;
    message += `👤 *Cliente:* ${clienteNome}\n`;
    message += `📊 *Status:* ${status}\n`;
    message += `💰 *Total:* ${total}\n\n`;

    if (pedido.pedido_items && pedido.pedido_items.length > 0) {
      message += `📦 *ITENS:*\n`;
      pedido.pedido_items.forEach(item => {
        message += `- ${item.quantidade}x ${item.produto_nome || getProdutoNome(item.produto_id)} (${formatCurrency(item.preco_unitario)})\n`;
      });
      message += `\n`;
    }

    if (pedido.servicos && pedido.servicos.length > 0) {
      message += `🛠️ *SERVIÇOS:*\n`;
      pedido.servicos.forEach(s => {
        message += `- ${s.quantidade}x ${s.nome} (${formatCurrency(s.valor_unitario)})\n`;
      });
      message += `\n`;
    }

    if (pedido.tipo_entrega) {
      message += `🚚 *ENTREGA:* ${pedido.tipo_entrega === 'frete' ? 'Frete' : 'Retirada'}\n`;
      if (pedido.tipo_entrega === 'frete') {
        if (pedido.valor_frete) message += `💰 *Valor Frete:* ${formatCurrency(pedido.valor_frete)}\n`;
        if (pedido.transportadora) message += `🏢 *Transportadora:* ${pedido.transportadora}\n`;
      }
      message += `\n`;
    }

    message += `🔗 _Enviado via Direct AI_`;

    const encodedMessage = encodeURIComponent(message);
    const telephone = pedido.clientes?.telefone || '';
    const phoneStr = telephone.replace(/\D/g, '');

    const whatsappUrl = phoneStr
      ? `https://api.whatsapp.com/send?phone=55${phoneStr}&text=${encodedMessage}`
      : `https://api.whatsapp.com/send?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };


  const handleSubmitStatusChange = async (newStatus: string, observacao?: string) => {
    if (!pedido || !supabase) return;

    try {
      const statusAnterior = pedido.status;
      const pago_at = newStatus === 'pago' ? new Date().toISOString() : (statusAnterior === 'pago' ? null : undefined);

      const updatePayload: any = { status: newStatus };
      if (pago_at !== undefined) updatePayload.pago_at = pago_at;

      const { error } = await supabase
        .from('pedidos')
        .update(updatePayload) // Usando a coluna 'status' e 'pago_at'
        .eq('id', pedido.id);

      if (error) throw error;

      // --- Lógica de Inventário Unificada ---
      const wasConsuming = isInventoryConsumingStatus(statusAnterior);
      const isNowConsuming = isInventoryConsumingStatus(newStatus);

      if (!wasConsuming && isNowConsuming) {
        console.log(`[Inventory] Status mudou para ${newStatus}. Deduzindo estoque...`);
        await deductInsumosFromPedido(pedido);
      } else if (wasConsuming && !isNowConsuming) {
        console.log(`[Inventory] Status mudou para ${newStatus}. Restaurando estoque...`);
        await restoreInsumosFromPedido(pedido);
      }

      // Se houver observação, adicionar ao histórico
      if (observacao && observacao.trim()) {
        const { error: historyError } = await supabase
          .from('pedido_status_history')
          .insert({
            pedido_id: pedido.id,
            status_anterior: statusAnterior,
            status_novo: newStatus,
            observacao: observacao.trim(),
            user_id: session?.user.id
          });

        if (historyError) {
          console.warn('Erro ao salvar histórico:', historyError);
        }
      }

      showSuccess("Status atualizado com sucesso!");
      // Atualizar o pedido localmente
      setPedido({ ...pedido, status: newStatus as any });
      // Recarregar histórico
      fetchPedidoDetails();
    } catch (error: any) {
      showError(`Erro ao atualizar status: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carregando Pedido...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!pedido) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-gray-500">Pedido não encontrado</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl">Pedido #{pedido.order_number}</DialogTitle>
              <div className="flex items-center mt-2">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {pedido.clientes?.nome || getClienteNome(pedido.cliente_id)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>

              <Button variant="outline" size="sm" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200" onClick={handleWhatsAppShare}>
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Opções de Impressão</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePrintPDF}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Nota (A4)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => pedido && printThermalReceipt(pedido)}>
                    <ScrollText className="h-4 w-4 mr-2" />
                    Imprimir Cupom (80mm)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {statusHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsStatusHistoryOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  Histórico
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStatusChangeOpen(true)}
              >
                <Wrench className="h-4 w-4 mr-2" />
                Alterar Status
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(pedido)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
                    <AlertDialogAction onClick={() => onDelete(pedido.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{format(new Date(pedido.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            </div>
            {getStatusBadge(pedido.status)}
            {pedido.pago_at && pedido.status === 'pago' && (
              <div className="flex items-center text-sm text-green-600 font-medium bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 mr-2" />
                Pago em: {format(new Date(pedido.pago_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="md:col-span-2 space-y-6">
            {/* Itens do Pedido */}
            {pedido.pedido_items && pedido.pedido_items.length > 0 && (
              <div>
                <div className="flex items-center mb-3">
                  <Package className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="text-lg font-semibold">Itens do Pedido</h3>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="min-w-[150px]">Produto</TableHead>
                        <TableHead className="text-right min-w-[80px]">Quantidade</TableHead>
                        <TableHead className="text-right min-w-[100px]">Preço Unitário</TableHead>
                        <TableHead className="text-right min-w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.pedido_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-center p-2">
                            {(() => {
                              const tipoStr = (item.tipo || 'dtf').toLowerCase();
                              const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipoStr);
                              const isVinil = tipoStr === 'vinil';
                              const isDTF = tipoStr === 'dtf';
                              const isUnidade = tipoInfo?.unidade_medida === 'unidade';

                              let Icon = Package;
                              let bgClass = "bg-primary/10 text-primary";
                              let label = tipoInfo?.nome || tipoStr.toUpperCase();

                              if (isVinil) {
                                Icon = Scissors;
                                bgClass = "bg-orange-100 text-orange-700";
                              } else if (isDTF) {
                                Icon = Printer;
                                bgClass = "bg-blue-100 text-blue-700";
                              } else if (tipoInfo) {
                                Icon = isUnidade ? Package : Ruler;
                                bgClass = "bg-primary/10 text-primary";
                              }

                              return (
                                <span title={label} className={cn("p-1.5 rounded-lg flex items-center justify-center", bgClass)}>
                                  <Icon className="h-4 w-4" />
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.produto_nome || getProdutoNome(item.produto_id)}</div>
                              {item.observacao && (
                                <div className="text-sm text-muted-foreground italic">
                                  Obs: {item.observacao}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantidade}
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {(() => {
                                const tipoStr = (item.tipo || 'dtf').toLowerCase();
                                const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === tipoStr);
                                return tipoInfo?.unidade_medida === 'unidade' ? 'UND' : 'ML';
                              })()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.preco_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.quantidade * item.preco_unitario)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Serviços */}
            {pedido.servicos && pedido.servicos.length > 0 && (
              <div>
                <div className="flex items-center mb-3">
                  <Wrench className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="text-lg font-semibold">Serviços</h3>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Serviço</TableHead>
                        <TableHead className="text-right min-w-[80px]">Quantidade</TableHead>
                        <TableHead className="text-right min-w-[100px]">Valor Unitário</TableHead>
                        <TableHead className="text-right min-w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.servicos.map((servico) => (
                        <TableRow key={servico.id}>
                          <TableCell>{servico.nome}</TableCell>
                          <TableCell className="text-right">{servico.quantidade}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(servico.valor_unitario)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(servico.quantidade * servico.valor_unitario)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Observações */}
            {pedido.observacoes && (
              <div>
                <div className="flex items-center mb-3">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  <h3 className="text-lg font-semibold">Observações</h3>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-muted-foreground whitespace-pre-wrap">{pedido.observacoes}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            {/* Resumo do Pedido */}
            <div className="border rounded-lg p-4 sticky top-4">
              <div className="flex items-center mb-4">
                <DollarSign className="h-5 w-5 mr-2 text-primary" />
                <h3 className="text-lg font-semibold">Resumo do Pedido</h3>
              </div>

              {(() => {
                const subtotal = (pedido.subtotal_produtos || 0) + (pedido.subtotal_servicos || 0);
                const frete = pedido.tipo_entrega === 'frete' ? (pedido.valor_frete || 0) : 0;
                const descontoPercentualCalculado = subtotal * ((pedido.desconto_percentual || 0) / 100);
                const valorTotalCalculado = Math.max(0, subtotal + frete - (pedido.desconto_valor || 0) - descontoPercentualCalculado);

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Subtotal Produtos:</span>
                      <span className="font-medium">{formatCurrency(pedido.subtotal_produtos || 0)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Subtotal Serviços:</span>
                      <span className="font-medium">{formatCurrency(pedido.subtotal_servicos || 0)}</span>
                    </div>

                    {pedido.desconto_valor > 0 && (
                      <div className="flex justify-between text-red-600">
                        <div className="flex items-center">
                          <Tag className="h-4 w-4 mr-1" />
                          <span>Desconto (R$):</span>
                        </div>
                        <span>-{formatCurrency(pedido.desconto_valor)}</span>
                      </div>
                    )}

                    {pedido.desconto_percentual > 0 && (
                      <div className="flex justify-between text-red-600">
                        <div className="flex items-center">
                          <Percent className="h-4 w-4 mr-1" />
                          <span>Desconto ({pedido.desconto_percentual}%):</span>
                        </div>
                        <span>-{formatCurrency(descontoPercentualCalculado)}</span>
                      </div>
                    )}

                    {pedido.tipo_entrega && (
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center text-muted-foreground text-sm">
                            {pedido.tipo_entrega === 'frete' ? (
                              <>
                                <Bike className="h-4 w-4 mr-2 text-orange-600" />
                                <span>Entrega (Frete)</span>
                              </>
                            ) : (
                              <>
                                <Package className="h-4 w-4 mr-2 text-primary" />
                                <span>Retirada no Local</span>
                              </>
                            )}
                          </div>
                          {pedido.tipo_entrega === 'frete' && pedido.valor_frete > 0 && (
                            <span className="font-medium text-orange-600">
                              {formatCurrency(pedido.valor_frete)}
                            </span>
                          )}
                        </div>

                        {pedido.tipo_entrega === 'frete' && pedido.transportadora && (
                          <div className="flex items-center bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-100 dark:border-orange-900/50">
                            <Truck className="h-4 w-4 mr-2 text-orange-600" />
                            <span className="text-xs font-medium text-orange-700 dark:text-orange-400 truncate">
                              Transportadora: {pedido.transportadora}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NOVO: Total de Metros Split */}
                    {pedido.total_metros > 0 && (
                      <div className="space-y-1 border-t pt-3 pb-2">
                        {pedido.total_metros_dtf > 0 && (
                          <div className="flex justify-between text-sm">
                            <div className="flex items-center text-blue-600 font-medium">
                              <Printer className="h-4 w-4 mr-1" />
                              <span>Total DTF:</span>
                            </div>
                            <span className="font-semibold text-blue-600">{pedido.total_metros_dtf.toFixed(2)} ML</span>
                          </div>
                        )}
                        {pedido.total_metros_vinil > 0 && (
                          <div className="flex justify-between text-sm">
                            <div className="flex items-center text-orange-600 font-medium">
                              <Scissors className="h-4 w-4 mr-1" />
                              <span>Total Vinil:</span>
                            </div>
                            <span className="font-semibold text-orange-600">{pedido.total_metros_vinil.toFixed(2)} ML</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <div className="flex items-center font-semibold text-gray-700 dark:text-gray-300">
                            <Ruler className="h-4 w-4 mr-1" />
                            <span>Total Metros:</span>
                          </div>
                          <span className="font-semibold">{pedido.total_metros.toFixed(2)} ML</span>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                      <span>Total Final:</span>
                      <span>{formatCurrency(valorTotalCalculado)}</span>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      </DialogContent>

      {pedido && (
        <StatusChangeDialog
          isOpen={isStatusChangeOpen}
          onOpenChange={setIsStatusChangeOpen}
          currentStatus={pedido.status}
          onStatusChange={handleSubmitStatusChange}
          orderNumber={pedido.order_number}
          pagoAt={pedido.pago_at}
        />
      )}

      {pedido && (
        <StatusHistoryDialog
          isOpen={isStatusHistoryOpen}
          onOpenChange={setIsStatusHistoryOpen}
          statusHistory={pedido.status_history || []}
          orderNumber={pedido.order_number}
        />
      )}
    </Dialog>
  );
};