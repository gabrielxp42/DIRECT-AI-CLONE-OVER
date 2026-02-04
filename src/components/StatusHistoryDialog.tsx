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
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();
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
        return 'bg-emerald-500 text-white';
      case 'aguardando retirada':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const sortedHistory = [...statusHistory].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "gap-0 p-0 bg-zinc-950 text-white border-zinc-900 shadow-2xl flex flex-col overflow-hidden",
        isMobile
          ? "w-full rounded-t-[2rem] rounded-b-none h-[95vh] fixed bottom-0 left-0 right-0 top-auto translate-y-0 max-w-full"
          : "max-w-[500px] max-h-[600px] rounded-2xl"
      )}>
        {isMobile && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-zinc-800 rounded-full z-50" />
        )}
        <DialogHeader className={cn("shrink-0 border-b border-zinc-800 bg-zinc-900 px-6 py-4", isMobile && "pt-10")}>
          <DialogTitle>Histérico de Status</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {orderNumber && `Pedido #${orderNumber} - `}
            Acompanhe as mudanças do pedido.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 scrollbar-hide">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma alteração registrada.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedHistory.map((item, index) => (
                <div key={item.id} className="relative pl-6">
                  {index < sortedHistory.length - 1 && (
                    <div className="absolute left-2.5 top-8 bottom-0 w-0.5 bg-zinc-800" />
                  )}
                  <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{item.status_anterior}</Badge>
                      <span className="text-zinc-600">→</span>
                      <Badge className={cn("text-[10px]", getStatusColor(item.status_novo))}>{item.status_novo}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      <User className="h-3 w-3" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    {item.observacao && (
                      <div className="text-sm text-zinc-300 italic border-l-2 border-zinc-800 pl-3">
                        "{item.observacao}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};