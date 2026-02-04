import { useState } from "react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Banknote, Smartphone, CreditCard, Barcode, Building2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface StatusChangeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentStatus: string;
  onStatusChange: (newStatus: string, observacao?: string, notifyClient?: boolean) => void;
  isLoading?: boolean;
  orderNumber?: number;
  pagoAt?: string | null;
}

const orderStatuses = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'processando', label: 'Processando' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'pago', label: 'Pago' },
  { value: 'aguardando retirada', label: 'Aguardando Retirada' }, // Novo status
];

export const StatusChangeDialog = ({
  isOpen,
  onOpenChange,
  currentStatus,
  onStatusChange,
  isLoading = false,
  orderNumber,
  pagoAt
}: StatusChangeDialogProps) => {
  const isMobile = useIsMobile();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [observacao, setObservacao] = useState("");
  const [notifyClient, setNotifyClient] = useState(false);
  const { activeMethods } = usePaymentMethods();

  const handleSubmit = () => {

    if (selectedStatus !== currentStatus) {
      onStatusChange(selectedStatus, observacao.trim() || undefined, notifyClient);
      setObservacao("");
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setObservacao("");
    onOpenChange(false);
  };

  const isStatusChanged = selectedStatus !== currentStatus;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "border-0 p-0 overflow-y-auto bg-slate-950/95 text-white backdrop-blur-xl scrollbar-hide",
        isMobile
          ? "max-w-[100vw] w-full p-0 pb-safe rounded-t-[2.5rem] rounded-b-none bottom-0 top-auto translate-y-0 h-[95vh]"
          : "max-w-[95vw] md:max-w-[550px] max-h-[90vh] md:max-h-none md:overflow-visible"
      )}>
        {isMobile && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full z-50" />
        )}
        <DialogHeader className={cn(isMobile ? "p-6 pb-2" : "p-6")}>
          <DialogTitle>Alterar Status do Pedido</DialogTitle>
          <DialogDescription>
            {orderNumber && `Pedido #${orderNumber} - `}
            Altere o status e adicione uma observação opcional sobre a mudança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-2">
          <div className="space-y-2">
            <Label>Status Atual</Label>
            <div className="flex items-center justify-between">
              <OrderStatusBadge status={currentStatus} />
              {pagoAt && currentStatus === 'pago' && (
                <div className="flex items-center text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  PAGO EM: {format(new Date(pagoAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status">Novo Status</Label>
            <Select value={selectedStatus} onValueChange={(val) => {
              setSelectedStatus(val);
              // Reset notification check when status changes, or default to true for "aguardando retirada"
              if (val === 'aguardando retirada') {
                setNotifyClient(true);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gabi AI Trigger for WhatsApp */}
          {selectedStatus === 'aguardando retirada' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="relative group rounded-lg p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-md shadow-purple-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-md rounded-lg" />
                <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-lg p-2.5 flex gap-2.5 items-start">

                  {/* Gabi Avatar */}
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>

                  <div className="space-y-1.5 w-full">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-1">
                          Gabi AI Insight
                          <span className="bg-white/10 px-1 py-0.5 rounded text-[7px] text-white/50 tracking-normal">WHATSAPP AGENT</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          Notei que o pedido está pronto! Quer que eu envie uma mensagem chamando o cliente? 🚀
                        </p>
                      </div>
                    </div>

                    {/* Action Area - Green for WhatsApp Context */}
                    <div className="flex items-center gap-3 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 transition-colors hover:bg-emerald-500/20 cursor-pointer" onClick={() => setNotifyClient(!notifyClient)}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${notifyClient ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-zinc-800 border border-zinc-700'}`}>
                        {notifyClient && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <label className="text-xs font-bold text-emerald-400 cursor-pointer select-none flex-1 uppercase tracking-wide">
                        Sim, Avisar Cliente Agora
                      </label>
                      <Badge className="text-[9px] bg-emerald-500 text-white border-none font-black px-1.5 uppercase shadow-sm">
                        Beta
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isStatusChanged && (
            <div className="space-y-2.5">
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  placeholder="Ex: Pago 50% do valor, Cliente retirou parcialmente, etc."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={1}
                  maxLength={500}
                  className="resize-none"
                />
              </div>

              {/* Payment Method Shortcuts - Premium Design */}
              <div className="rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">💰 Forma de Pagamento</h4>
                  <span className="text-[10px] text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">Toque para adicionar</span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  {activeMethods.map((method) => {
                    const iconMap: Record<string, any> = { Banknote, Smartphone, CreditCard, Barcode, Building2 };
                    const Icon = iconMap[method.icon] || Banknote;

                    const colorMap: Record<string, { container: string, iconBg: string, textColor: string }> = {
                      emerald: {
                        container: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 hover:border-emerald-500 hover:shadow-emerald-500/20',
                        iconBg: 'bg-emerald-500/20 group-hover:bg-emerald-500/30',
                        textColor: 'text-emerald-600 dark:text-emerald-400'
                      },
                      cyan: {
                        container: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 hover:border-cyan-500 hover:shadow-cyan-500/20',
                        iconBg: 'bg-cyan-500/20 group-hover:bg-cyan-500/30',
                        textColor: 'text-cyan-600 dark:text-cyan-400'
                      },
                      violet: {
                        container: 'from-violet-500/20 to-violet-600/10 border-violet-500/40 hover:border-violet-500 hover:shadow-violet-500/20',
                        iconBg: 'bg-violet-500/20 group-hover:bg-violet-500/30',
                        textColor: 'text-violet-600 dark:text-violet-400'
                      },
                      orange: {
                        container: 'from-orange-500/20 to-orange-600/10 border-orange-500/40 hover:border-orange-500 hover:shadow-orange-500/20',
                        iconBg: 'bg-orange-500/20 group-hover:bg-orange-500/30',
                        textColor: 'text-orange-600 dark:text-orange-400'
                      },
                      blue: {
                        container: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 hover:border-blue-500 hover:shadow-blue-500/20',
                        iconBg: 'bg-blue-500/20 group-hover:bg-blue-500/30',
                        textColor: 'text-blue-600 dark:text-blue-400'
                      },
                    };

                    const styles = colorMap[method.color] || colorMap.emerald;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          const separator = observacao.trim() ? ' | ' : '';
                          setObservacao(prev => prev.trim() + separator + method.label);
                        }}
                        className={cn(
                          "group relative flex flex-row items-center justify-center gap-1 p-2 rounded-lg bg-gradient-to-br border-2 transition-all duration-200 active:scale-95 hover:shadow-md flex-shrink-0",
                          styles.container
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                          styles.iconBg
                        )}>
                          <Icon className={cn(
                            "w-3.5 h-3.5",
                            styles.textColor
                          )} />
                        </div>
                        <span className={cn(
                          "text-xs font-bold whitespace-nowrap",
                          styles.textColor
                        )}>{method.label}</span>
                      </button>
                    );
                  })}

                </div>

              </div>

              <div className="text-[10px] text-muted-foreground text-right">
                {observacao.length}/500 caracteres
              </div>
            </div>
          )}



          {isStatusChanged && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm font-medium mb-1">Resumo da alteração:</div>
              <div className="flex items-center gap-2 text-sm">
                <OrderStatusBadge status={currentStatus} />
                <span>→</span>
                <OrderStatusBadge status={selectedStatus} />
              </div>
              {observacao.trim() && (
                <div className="text-xs text-muted-foreground mt-2">
                  <strong>Observação:</strong> {observacao.trim()}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className={cn(isMobile ? "p-6 pt-2 bg-transparent border-t-0" : "p-4 bg-slate-900/50 backdrop-blur-md border-t border-white/5")}>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isStatusChanged || isLoading}
          >
            {isLoading ? "Alterando..." : "Alterar Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};