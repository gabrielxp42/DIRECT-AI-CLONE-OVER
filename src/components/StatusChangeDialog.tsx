import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Banknote, Smartphone, CreditCard, Barcode, Building2, MessageCircle, Sparkles, Clock, MapPin, Truck, AlertCircle, XCircle, Send, Coins } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";

interface StatusChangeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentStatus: string;
  pagoAt?: string | null;
  isLoading?: boolean;
  orderNumber?: number;
  initialTrackingCode?: string | null;
  onStatusChange: (newStatus: string, observacao?: string, notifyClient?: boolean, trackingCode?: string, markAsPaid?: boolean, metodo_pagamento?: string) => void;
  pedidoId?: string;
  clientAddress?: string;
  clientName?: string;
  tipoEntrega?: string;
  trackingCode?: string | null;
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
  pedidoId,
  clientAddress,
  clientName,
  tipoEntrega,
  trackingCode: currentTrackingCode,
  pagoAt,
  initialTrackingCode
}: StatusChangeDialogProps) => {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [observacao, setObservacao] = useState("");
  const [selectedMethodLabel, setSelectedMethodLabel] = useState<string | null>(null);
  const [notifyClient, setNotifyClient] = useState(false);
  const [trackingCode, setTrackingCode] = useState(initialTrackingCode || "");
  const [paymentDecision, setPaymentDecision] = useState<"paid" | "pending" | null>(null);
  const [showError, setShowError] = useState(false);

  const { activeMethods } = usePaymentMethods();

  useEffect(() => {
    if (isOpen) {
      setTrackingCode(initialTrackingCode || "");
      setSelectedStatus(currentStatus);
      setSelectedMethodLabel(null);

      // PEGAR PREFERÊNCIA DO DISPOSITIVO (Independente para cada usuário/aparelho)
      const stored = localStorage.getItem(`gabi_notify_pref_${currentStatus}`);

      // Se for a primeira vez no aparelho, padrão é FALSE (desligado).
      // Se o usuário já mexeu, respeita o que ele deixou salvo (ON ou OFF) naquele dispositivo.
      setNotifyClient(stored === 'true');

      setPaymentDecision(null);
      setObservacao("");
      setShowError(false);
    }
  }, [isOpen, initialTrackingCode, currentStatus]);

  const hIsStatusChanged = selectedStatus !== currentStatus;
  const isAdvancedStatus = ['processando', 'aguardando retirada', 'enviado'].includes(selectedStatus);
  const needsPaymentDecision = !pagoAt && isAdvancedStatus && selectedStatus !== currentStatus;

  const handleSubmit = () => {
    // Permitir submeter se o status mudou OU se há uma observação ou método selecionado
    const hasChanges = selectedStatus !== currentStatus || observacao.trim() || selectedMethodLabel;

    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    if (needsPaymentDecision && paymentDecision === null) {
      setShowError(true);
      return;
    }

    const markAsPaid = paymentDecision === 'paid';

    // O metodo_pagamento final será o label do botão ou o que estiver na observação se clicado
    const finalMetodo = selectedMethodLabel || (markAsPaid || selectedStatus === 'pago' ? observacao.trim() : undefined);

    onStatusChange(
      selectedStatus,
      observacao.trim() || undefined,
      notifyClient,
      trackingCode.trim() || undefined,
      markAsPaid,
      finalMetodo || undefined
    );

    onOpenChange(false);
  };

  const handleCancel = () => {
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
            Altere o status e confirme as informações de pagamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Status Atual</Label>
            <div className="flex items-center justify-between">
              <OrderStatusBadge status={currentStatus} />
              {pagoAt && (
                <div className="flex items-center text-[10px] text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-100">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  PAGO EM: {format(new Date(pagoAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-status" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Novo Status</Label>
            <Select value={selectedStatus} onValueChange={(val) => {
              setSelectedStatus(val);
              const stored = localStorage.getItem(`gabi_notify_pref_${val}`);
              setNotifyClient(stored === 'true');
              setPaymentDecision(null);
              setShowError(false);
            }}>
              <SelectTrigger className="h-11 font-medium">
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

          {/* FORCED PAYMENT DECISION BLOCK */}
          {needsPaymentDecision && (
            <motion.div
              animate={showError ? { x: [-5, 5, -5, 5, 0], transition: { duration: 0.4 } } : {}}
              className="animate-in zoom-in-95 fade-in duration-300"
            >
              <div className={cn(
                "rounded-xl border-2 p-4 space-y-4 shadow-sm transition-all duration-300",
                showError
                  ? "border-red-500 bg-red-500/10 shadow-red-500/20"
                  : "border-amber-500/50 bg-amber-500/5 shadow-amber-500/10"
              )}>
                <div className={cn(
                  "flex items-center gap-2 transition-colors",
                  showError ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                )}>
                  {showError ? <AlertCircle className="h-5 w-5 animate-pulse" /> : <Coins className="h-5 w-5" />}
                  <h4 className="text-sm font-black uppercase tracking-tight">
                    {showError ? "Ação Obrigatória!" : "Verificação de Pagamento"}
                  </h4>
                </div>

                <p className={cn(
                  "text-xs font-medium leading-relaxed transition-colors",
                  showError ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
                )}>
                  {showError
                    ? "Você precisa informar se o pedido foi pago para prosseguir com a atualização financeira correta."
                    : "Este pedido ainda não consta como pago. Já recebeu o valor do cliente?"}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant={paymentDecision === 'paid' ? 'default' : 'outline'}
                    className={cn(
                      "h-12 flex flex-col gap-0.5 transition-all text-[11px] font-bold uppercase border-2",
                      paymentDecision === 'paid'
                        ? "bg-green-600 hover:bg-green-700 border-green-700 shadow-md shadow-green-500/20"
                        : (showError ? "border-red-200 dark:border-red-900/50" : "border-amber-200 dark:border-amber-900/50")
                    )}
                    onClick={() => {
                      setPaymentDecision('paid');
                      setShowError(false);
                    }}
                  >
                    <Banknote className="h-4 w-4 mb-0.5" />
                    Sim, foi pago
                  </Button>
                  <Button
                    type="button"
                    variant={paymentDecision === 'pending' ? 'secondary' : 'outline'}
                    className={cn(
                      "h-12 flex flex-col gap-0.5 transition-all text-[11px] font-bold uppercase border-2",
                      paymentDecision === 'pending'
                        ? "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                        : (showError ? "border-red-200 dark:border-red-900/50" : "border-amber-200 dark:border-amber-900/50")
                    )}
                    onClick={() => {
                      setPaymentDecision('pending');
                      setShowError(false);
                    }}
                  >
                    <Clock className="h-4 w-4 mb-0.5" />
                    Não, a cobrar
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {selectedStatus === 'enviado' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="tracking-code" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Código de Rastreio</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tracking-code"
                  placeholder="Insira o código de rastreio..."
                  className="pl-10 h-11"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Gabi AI Trigger */}
          {['pago', 'aguardando retirada', 'enviado'].includes(selectedStatus) && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-4">
              <div className="relative group rounded-xl p-[1px] bg-gradient-to-br from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7] shadow-lg">
                <div className="relative bg-slate-950/90 backdrop-blur-xl rounded-[10px] p-4 flex gap-4 items-start border border-white/10">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="space-y-3 w-full">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      Gabi AI Notifica
                    </div>
                    <p className="text-xs text-slate-200 leading-tight">
                      {selectedStatus === 'pago' && tipoEntrega === 'frete' && !currentTrackingCode ? (
                        <span className="flex flex-col gap-2">
                          <span>Pagamento confirmado! Que tal já deixar a **etiqueta de envio** pronta? Economiza tempo! 🚚💨</span>
                          <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 p-1.5 rounded-lg border border-amber-400/20 italic">
                            * Após confirmar o status, um convite aparecerá nos detalhes do pedido.
                          </span>
                        </span>
                      ) : (
                        <>
                          {selectedStatus === 'pago' && "Confirmamos o pagamento! Mandamos uma confirmação pro cliente? 😊"}
                          {selectedStatus === 'aguardando retirada' && "O pedido ficou pronto! Quer avisar o cliente pra buscar? 🚀"}
                          {selectedStatus === 'enviado' && "Já despachamos! Enviamos o rastreio pro cliente agora? 🚚"}
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-2 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 cursor-pointer"
                      onClick={() => {
                        const newValue = !notifyClient;
                        setNotifyClient(newValue);
                        localStorage.setItem(`gabi_notify_pref_${selectedStatus}`, String(newValue));
                      }}>
                      <div className={`w-4 h-4 rounded-sm flex items-center justify-center ${notifyClient ? 'bg-emerald-500 text-white' : 'bg-slate-800 border-slate-700'}`}>
                        {notifyClient && <CheckCircle size={10} />}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Sim, Notificar via WhatsApp</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isStatusChanged && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="observacao" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Observação (opcional)</Label>
                <Textarea
                  id="observacao"
                  placeholder="Ex: Pago 50% do valor, Pagou no Pix, etc."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Payment Methods Section */}
              <div className="rounded-xl border bg-slate-50 dark:bg-slate-900/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase text-muted-foreground">💰 Forma de Pagamento</h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {activeMethods.slice(0, 6).map((method) => {
                    const iconMap: Record<string, any> = { Banknote, Smartphone, CreditCard, Barcode, Building2 };
                    const Icon = iconMap[method.icon] || Banknote;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          const separator = observacao.trim() ? ' | ' : '';
                          setObservacao(prev => prev.trim() + separator + method.label);
                          setSelectedMethodLabel(method.label);
                          if (needsPaymentDecision) {
                            setPaymentDecision('paid');
                            setShowError(false);
                          }
                        }}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 border-transparent bg-white dark:bg-slate-800 hover:border-primary/30 transition-all active:scale-95 shadow-sm"
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-[9px] font-bold truncate w-full text-center uppercase">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleCancel} disabled={isLoading} className="text-xs uppercase font-bold">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className={cn(
              "h-11 px-8 rounded-xl font-bold uppercase tracking-wider text-xs transition-all",
              (hIsStatusChanged || selectedMethodLabel || observacao.trim())
                ? "bg-primary hover:shadow-lg hover:shadow-primary/20 shadow-md"
                : "opacity-50 pointer-events-none"
            )}
          >
            {isLoading ? "Salvando..." : "Confirmar Alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};