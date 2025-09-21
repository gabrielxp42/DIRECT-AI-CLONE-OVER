import React, { useEffect, useState } from 'react';
import { useSession } from '@/contexts/SessionProvider';
import { Pedido, StatusHistoryItem } from '@/types/pedido';
import { Cliente } from '@/types/cliente';
import { Produto } from '@/types/produto';
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
  History
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
    if (!session || !supabase || !pedidoId) return;
    
    setLoading(true);
    try {
      // Buscar o pedido principal
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .select(`
          *,
          clientes (id, nome, telefone, email, endereco)
        `)
        .eq('id', pedidoId)
        .eq('user_id', session.user.id)
        .single();

      if (pedidoError) throw pedidoError;

      // Buscar itens do pedido
      const { data: itemsData, error: itemsError } = await supabase
        .from('pedido_items')
        .select(`
          *,
          produtos (id, nome)
        `)
        .eq('pedido_id', pedidoId);

      if (itemsError) throw itemsError;

      // Buscar serviços do pedido
      let servicosData: any[] = [];
      let servicosError: any = null;
      
      try {
        const { data, error } = await supabase
          .from('pedido_servicos')
          .select('*')
          .eq('pedido_id', pedidoId);
        
        servicosData = data || [];
        servicosError = error;
      } catch (e) {
        // Se a tabela pedido_servicos não existir, tentamos servicos
        try {
          const { data, error } = await supabase
            .from('servicos')
            .select('*')
            .eq('pedido_id', pedidoId);
          
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

      // Buscar histórico de status
      const { data: historyData, error: historyError } = await supabase
        .from('pedido_status_history')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: false });

      if (historyError) {
        console.warn('Aviso: Não foi possível carregar histórico de status:', historyError.message);
      }

      // Combinar os dados
      const pedidoCompleto = {
        ...pedidoData,
        pedido_items: itemsData || [],
        servicos: servicosData || []
      };

      setPedido(pedidoCompleto as Pedido);
      setStatusHistory(historyData || []);
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do pedido:', error);
      showError(`Erro ao carregar detalhes do pedido: ${error.message}`);
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

  const handleGeneratePDF = async () => {
    if (!pedido) return;
    try {
      await generateOrderPDF(pedido);
      showSuccess("PDF gerado com sucesso!");
    } catch (error: any) {
      showError(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handleSubmitStatusChange = async (newStatus: string, observacao?: string) => {
    if (!pedido || !supabase) return;
    
    try {
      const statusAnterior = pedido.status;
      
      const { error } = await supabase
        .from('pedidos')
        .update({ status: newStatus })
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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
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
              <Button variant="outline" size="sm" onClick={handleGeneratePDF}>
                <Printer className="h-4 w-4 mr-2" />
                Gerar PDF
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
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Preço Unitário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedido.pedido_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div>{item.produto_nome || getProdutoNome(item.produto_id)}</div>
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
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Valor Unitário</TableHead>
                        <TableHead className="text-right">Total</TableHead>
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
                  <p className="text-muted-foreground">{pedido.observacoes}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            {/* Resumo do Pedido */}
            <div className="border rounded-lg p-4">
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
                      <span>Desconto:</span>
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
                
                <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                  <span>Total:</span>
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