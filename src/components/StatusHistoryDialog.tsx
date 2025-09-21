import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, User, MessageSquare } from "lucide-react";
import { StatusHistoryItem } from "@/types/pedido";

interface StatusHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  statusHistory: StatusHistoryItem[];
  orderNumber?: number;
}

export const StatusHistoryDialog = ({
  isOpen,
  onOpenChange,
  statusHistory,
  orderNumber
}: StatusHistoryDialogProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'processando':
        return 'bg-blue-100 text-blue-800';
      case 'enviado':
        return 'bg-purple-100 text-purple-800';
      case 'entregue':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      case 'pago':
        return 'bg-green-500 text-white';
      case 'aguardando retirada': // Novo status
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedHistory = [...statusHistory].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px]">
        <DialogHeader>
          <DialogTitle>Histórico de Status</DialogTitle>
          <DialogDescription>
            {orderNumber && `Pedido #${orderNumber} - `}
            Acompanhe todas as alterações de status realizadas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma alteração de status registrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedHistory.map((item, index) => (
                <div key={item.id} className="relative">
                  {index < sortedHistory.length - 1 && (
                    <div className="absolute left-4 top-12 bottom-0 w-px bg-border" />
                  )}
                  
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getStatusColor(item.status_anterior)}>
                          {item.status_anterior}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge className={getStatusColor(item.status_novo)}>
                          {item.status_novo}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                      
                      {item.observacao && (
                        <div className="bg-muted p-3 rounded-md">
                          <div className="flex items-start gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{item.observacao}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {index < sortedHistory.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};