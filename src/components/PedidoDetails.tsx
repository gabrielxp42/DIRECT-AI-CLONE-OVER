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
  Clock,
  MessageSquare,
  History,
  Ruler,
  Loader2
} from 'lucide-react';
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
import { StatusChangeDialog } from '@/components/StatusChangeDialog';
import { StatusHistoryDialog } from '@/components/StatusHistoryDialog';

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
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [isStatusHistoryOpen, setIsStatusHistoryOpen] = useState(false);

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

      const response = await fetch(url, { method: 'GET', headers });

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
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>;
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
      await generateOrderPDF(pedido, 'save');
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
      await generateOrderPDF(pedido, 'print');
    } catch (error: any) {
      showError(`Erro ao gerar PDF para impressão: ${error.message}`);
    }
  };

  const handleSubmitStatusChange = async (newStatus: string, observacao?: string) => {
    if (!pedido || !supabase) return;

    try {
      const statusAnterior = pedido.status;

      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus }) // Usando a coluna 'status'
        .eq('id', pedido.id);

      if (error) throw error;

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
              <Button variant="outline" size="sm" onClick={handlePrintPDF}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Nota
              </Button>
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
                        <TableHead className="min-w-[150px]">Produto</TableHead>
                        <TableHead className="text-right min-w-[80px]">Quantidade</TableHead>
                        <TableHead className="text-right min-w-[100px]">Preço Unitário</TableHead>
                        <TableHead className="text-right min-w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.pedido_items.map((item) => (
                        <TableRow key={item.id}>
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
                          <TableCell className="text-right">{item.quantidade}</TableCell>
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
                    <span>-{formatCurrency((pedido.subtotal_produtos + pedido.subtotal_servicos) * (pedido.desconto_percentual / 100))}</span>
                  </div>
                )}

                {/* NOVO: Total de Metros */}
                {pedido.total_metros > 0 && (
                  <div className="flex justify-between border-t pt-3">
                    <div className="flex items-center font-semibold text-blue-500">
                      <Ruler className="h-4 w-4 mr-1" />
                      <span>Total Metros (ML):</span>
                    </div>
                    <span className="font-semibold text-blue-500">{pedido.total_metros.toFixed(2)} ML</span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                  <span>Total Final:</span>
                  <span>{formatCurrency(pedido.valor_total)}</span>
                </div>
              </div>
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