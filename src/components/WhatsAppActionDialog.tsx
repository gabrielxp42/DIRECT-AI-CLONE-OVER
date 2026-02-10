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

const PixIcon = ({ className }: { className?: string }) => (
    <i className={cn("fa-brands fa-pix", className)}></i>
);

interface WhatsAppActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    phone: string;
    messagePreview: string;
    pixKey?: string | null;
    onConfirm: (data: { phone: string; attachPdf: boolean; includeText: boolean; includePix: boolean }) => void;
    isLoading?: boolean;
}

export const WhatsAppActionDialog = ({
    isOpen,
    onOpenChange,
    customerName,
    phone,
    messagePreview,
    pixKey,
    onConfirm,
    isLoading = false
}: WhatsAppActionDialogProps) => {
    const isMobile = useIsMobile();
    const [editablePhone, setEditablePhone] = useState(phone);
    const [attachPdf, setAttachPdf] = useState(true);
    const [includeText, setIncludeText] = useState(true);
    const [includePix, setIncludePix] = useState(false);

    // Atualiza o telefone local quando a prop muda
    useEffect(() => {
        setEditablePhone(phone);
    }, [phone]);

    const handleConfirm = () => {
        onConfirm({
            phone: editablePhone,
            attachPdf,
            includeText,
            includePix
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className={cn(
                    "bg-background text-foreground border-border shadow-2xl p-0 gap-0 overflow-hidden flex flex-col",
                    isMobile
                        ? "w-full max-w-full rounded-t-[2rem] rounded-b-none fixed bottom-0 max-h-[90vh]"
                        : "max-w-md rounded-2xl max-h-[85vh]"
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

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                            inputMode="tel"
                        />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3">
                        {/* Toggle PDF */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <FileText className="h-4 w-4 text-amber-500" />
                                    Anexar Pedido em PDF?
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Envia o arquivo PDF.
                                </p>
                            </div>
                            <Switch
                                checked={attachPdf}
                                onCheckedChange={setAttachPdf}
                                className="data-[state=checked]:bg-green-500"
                            />
                        </div>

                        {/* Toggle Texto */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <MessageSquare className="h-4 w-4 text-blue-500" />
                                    Resumo em Texto?
                                </div>
                            </div>
                            <Switch
                                checked={includeText}
                                onCheckedChange={setIncludeText}
                                className="data-[state=checked]:bg-blue-500"
                            />
                        </div>

                        {/* Toggle Pix */}
                        {pixKey && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 text-sm font-medium text-[#32BCAD]">
                                        <PixIcon className="h-4 w-4" />
                                        Chave Pix?
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate w-40">
                                        {pixKey}
                                    </p>
                                </div>
                                <Switch
                                    checked={includePix}
                                    onCheckedChange={setIncludePix}
                                    className="data-[state=checked]:bg-[#32BCAD]"
                                />
                            </div>
                        )}
                    </div>

                    {/* Preview da Mensagem */}
                    {includeText && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Prévia da Mensagem
                            </Label>
                            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border max-h-[80px] overflow-y-auto whitespace-pre-wrap font-mono">
                                {messagePreview}
                                {includePix && pixKey && `\n\n💰 *DADOS PARA PAGAMENTO*\nChave Pix: ${pixKey}`}
                            </div>
                        </div>
                    )}
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
                        disabled={isLoading || (!attachPdf && !includeText)}
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
                                Enviar
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
