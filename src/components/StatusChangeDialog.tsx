import { useState } from "react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Banknote, Smartphone, CreditCard, Barcode, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
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
  onStatusChange: (newStatus: string, observacao?: string) => void;
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
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [observacao, setObservacao] = useState("");
  const { activeMethods } = usePaymentMethods();

  const handleSubmit = () => {

    if (selectedStatus !== currentStatus) {
      onStatusChange(selectedStatus, observacao.trim() || undefined);
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Status do Pedido</DialogTitle>
          <DialogDescription>
            {orderNumber && `Pedido #${orderNumber} - `}
            Altere o status e adicione uma observação opcional sobre a mudança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
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

          {isStatusChanged && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  placeholder="Ex: Pago 50% do valor, Cliente retirou parcialmente, etc."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="resize-none"
                />
              </div>

              {/* Payment Method Shortcuts - Premium Design */}
              <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">💰 Forma de Pagamento</h4>
                  <span className="text-[10px] text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">Toque para adicionar</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
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
                          "group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br border-2 transition-all duration-200 active:scale-95 hover:shadow-lg",
                          styles.container
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                          styles.iconBg
                        )}>
                          <Icon className={cn(
                            "w-5 h-5",
                            styles.textColor
                          )} />
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
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

        <DialogFooter>
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