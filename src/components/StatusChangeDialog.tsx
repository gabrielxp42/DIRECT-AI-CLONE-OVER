import { useState } from "react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Banknote, Smartphone, CreditCard, Barcode, Building2, MessageCircle, Sparkles, Clock, MapPin, Truck, AlertCircle, XCircle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSession } from "@/contexts/SessionProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  pagoAt?: string | null;
  isLoading?: boolean;
  orderNumber?: number;
  onStatusChange: (newStatus: string, observacao?: string, notifyClient?: boolean, trackingCode?: string) => void;
}

const orderStatuses = [
  { value: 'pago', label: 'Pago', icon: Banknote },
  { value: 'processando', label: 'Em Produção', icon: Clock },
  { value: 'aguardando retirada', label: 'Pronto para Retirada', icon: MapPin },
  { value: 'enviado', label: 'Enviado / Despachado', icon: Truck },
  { value: 'entregue', label: 'Entregue', icon: CheckCircle },
  { value: 'pendente', label: 'Pendente', icon: AlertCircle },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle },
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
  const [notifyClient, setNotifyClient] = useState(false);
  const [trackingCode, setTrackingCode] = useState("");
  const { activeMethods } = usePaymentMethods();
  const { profile } = useSession();

  const handleSubmit = () => {
    if (selectedStatus !== currentStatus) {
      onStatusChange(selectedStatus, observacao.trim() || undefined, notifyClient, trackingCode.trim() || undefined);
      setObservacao("");
      setTrackingCode("");
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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
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
            <Select value={selectedStatus} onValueChange={(val) => {
              setSelectedStatus(val);
              // Reset notification check when status changes, or default to true for specific statuses
              if (['aguardando retirada', 'enviado', 'pago'].includes(val)) {
                setNotifyClient(true);
              } else {
                setNotifyClient(false);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <status.icon className="h-4 w-4 text-muted-foreground" />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedStatus === 'enviado' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="tracking-code">Código de Rastreio</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tracking-code"
                  placeholder="Insira o código de rastreio..."
                  className="pl-10"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Gabi AI Trigger for WhatsApp */}
          {['pago', 'aguardando retirada', 'enviado'].includes(selectedStatus) && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
              <div className="relative group rounded-xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg shadow-purple-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] opacity-20 blur-md rounded-xl" />
                <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[10px] p-4 flex gap-4 items-start">

                  {/* Gabi Avatar */}
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FF6B6B] to-[#ffd93d] flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>

                  <div className="space-y-3 w-full">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-1">
                          Gabi AI Insight
                          <span className="bg-white/10 px-1 py-0.5 rounded text-[7px] text-white/50 tracking-normal">WHATSAPP AGENT</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                          {selectedStatus === 'pago' && "Confirmamos o pagamento! Quer que eu envie uma confirmação para o cliente? 😊"}
                          {selectedStatus === 'aguardando retirada' && "Notei que o pedido está pronto! Quer que eu envie uma mensagem chamando o cliente? 🚀"}
                          {selectedStatus === 'enviado' && "Pedido despachado! Quer que eu envie os detalhes e o rastreio para o cliente? 🚚"}
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