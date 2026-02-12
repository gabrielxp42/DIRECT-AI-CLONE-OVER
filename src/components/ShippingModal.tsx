import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ShippingSection } from './ShippingSection';
import { Truck, Scale, Timer, ShieldCheck, BadgePercent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ShippingModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    pedidoId?: string;
    clientId?: string;
    clientAddress?: string;
    clientName?: string;
    orderNumber?: number;
    valorTotal?: number;
    initialLabelId?: string;
    initialStatus?: string;
    shipping_cep?: string;
}

export const ShippingModal: React.FC<ShippingModalProps> = ({
    isOpen,
    onOpenChange,
    pedidoId,
    clientId,
    clientName,
    clientAddress,
    orderNumber,
    valorTotal,
    initialLabelId,
    initialStatus,
    shipping_cep
}) => {
    const isMobile = useIsMobile();

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "max-w-3xl p-0 overflow-hidden border-none shadow-2xl bg-transparent",
                    isMobile ? "w-[95vw] rounded-2xl" : "rounded-3xl"
                )}
            >
                <div className="bg-background max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border shadow-xl relative">
                    {/* Background decorativo animado */}
                    <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-primary/20 via-background to-background opacity-50 pointer-events-none" />

                    {/* Header Premium */}
                    <div className="relative sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-primary/10">
                        <div className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-gradient-to-br from-primary to-primary/80 p-3 rounded-2xl shadow-lg shadow-primary/20 animate-in zoom-in-50 duration-500">
                                        <Truck className="h-6 w-6 text-black" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-2xl font-black italic tracking-tight uppercase text-primary flex items-center gap-2">
                                            Gere sua Etiqueta de Envio
                                            {orderNumber && (
                                                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-bold not-italic font-mono">
                                                    #{orderNumber}
                                                </span>
                                            )}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                            Simples, rápido e com o melhor preço.
                                        </DialogDescription>
                                    </div>
                                </div>

                                {/* Status Chips */}
                                <div className="hidden sm:flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-[10px] font-bold uppercase text-primary tracking-wide">Envio Seguro</span>
                                    </div>
                                </div>
                            </div>

                            {/* Feature Highlights - Dashboard Style */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { icon: Scale, label: "Cotação Real", sub: "Multi-transportadoras" },
                                    { icon: Timer, label: "Prazo Preciso", sub: "Calculado na hora" },
                                    { icon: ShieldCheck, label: "Rastreio Auto", sub: "Gerado no ato" },
                                    { icon: BadgePercent, label: "Taxa Zero", sub: "Sem custo extra" },
                                ].map((item, i) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-white/5 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="bg-background p-2 rounded-lg shadow-sm">
                                            <item.icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/80">{item.label}</span>
                                            <span className="text-[9px] text-muted-foreground">{item.sub}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-2 relative z-0">
                        <ShippingSection
                            pedidoId={pedidoId}
                            clientId={clientId}
                            clientName={clientName}
                            clientAddress={clientAddress}
                            orderNumber={orderNumber}
                            valorTotal={valorTotal}
                            initialLabelId={initialLabelId}
                            initialStatus={initialStatus}
                            shipping_cep={shipping_cep}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
