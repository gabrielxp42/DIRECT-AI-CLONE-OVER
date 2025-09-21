import { useState } from "react";
import { Button } from "@/components/ui/button";
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
}

const orderStatuses = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'processando', label: 'Processando' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'pago', label: 'Pago' },
];

export const StatusChangeDialog = ({
  isOpen,
  onOpenChange,
  currentStatus,
  onStatusChange,
  isLoading = false,
  orderNumber
}: StatusChangeDialogProps) => {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [observacao, setObservacao] = useState("");

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
            <div className="flex items-center">
              <OrderStatusBadge status={currentStatus} />
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
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Textarea
                id="observacao"
                placeholder="Ex: Pago 50% do valor, Cliente retirou parcialmente, etc."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground text-right">
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