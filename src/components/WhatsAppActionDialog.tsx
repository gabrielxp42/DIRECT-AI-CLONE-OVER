import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FileText, MessageSquare, Phone, Send } from "lucide-react";

interface WhatsAppActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    phone: string;
    messagePreview: string;
    onConfirm: (data: { phone: string; attachPdf: boolean }) => void;
    isLoading?: boolean;
}

export const WhatsAppActionDialog = ({
    isOpen,
    onOpenChange,
    customerName,
    phone,
    messagePreview,
    onConfirm,
    isLoading = false
}: WhatsAppActionDialogProps) => {
    const isMobile = useIsMobile();
    const [editablePhone, setEditablePhone] = useState(phone);
    const [attachPdf, setAttachPdf] = useState(true);

    // Atualiza o telefone local quando a prop muda
    useEffect(() => {
        setEditablePhone(phone);
    }, [phone]);

    const handleConfirm = () => {
        onConfirm({
            phone: editablePhone,
            attachPdf
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "bg-background text-foreground border-border shadow-2xl p-0 gap-0 overflow-hidden",
                isMobile ? "w-full max-w-full h-auto fixed bottom-0 rounded-t-[2rem] rounded-b-none" : "max-w-md rounded-2xl"
            )}>
                {/* Header Visual */}
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6 border-b border-border/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-green-600 dark:text-green-500">
                            <MessageSquare className="h-5 w-5" />
                            Enviar via WhatsApp
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Confirme os dados antes de enviar para {customerName}.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    {/* Campo de Telefone */}
                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-muted-foreground flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Telefone de Destino
                        </Label>
                        <Input
                            id="phone"
                            value={editablePhone}
                            onChange={(e) => setEditablePhone(e.target.value)}
                            className="bg-muted/50 border-input focus:border-green-500/50 h-11"
                            placeholder="5511999999999"
                        />
                    </div>

                    {/* Toggle PDF */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <FileText className="h-4 w-4 text-amber-500" />
                                Anexar Pedido em PDF?
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Envia o arquivo PDF junto com o resumo.
                            </p>
                        </div>
                        <Switch
                            checked={attachPdf}
                            onCheckedChange={setAttachPdf}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>

                    {/* Preview da Mensagem */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Prévia da Mensagem
                        </Label>
                        <div className="text-xs text-muted-foreground bg-muted/30 p-4 rounded-xl border border-border max-h-[120px] overflow-y-auto whitespace-pre-wrap font-mono">
                            {messagePreview}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-0 gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 text-muted-foreground hover:text-foreground hover:bg-accent h-12"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 shadow-lg shadow-green-900/20 dark:shadow-green-900/10"
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Enviando...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Enviar Mensagem
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
