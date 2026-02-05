import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { MessageSquare, Send, Sparkles } from "lucide-react";

interface GabiActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    phone: string;
    messagePreview: string;
    onConfirm: () => void;
    isLoading?: boolean;
    actionType?: 'billing' | 'offer' | 'generic';
}

export const GabiActionDialog = ({
    isOpen,
    onOpenChange,
    customerName,
    phone,
    messagePreview,
    onConfirm,
    isLoading = false,
    actionType = 'generic'
}: GabiActionDialogProps) => {
    const isMobile = useIsMobile();

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "bg-zinc-950 text-white border-zinc-900 shadow-2xl p-0 gap-0 overflow-hidden",
                isMobile ? "w-full max-w-full h-auto fixed bottom-0 rounded-t-[2rem] rounded-b-none" : "max-w-md rounded-2xl"
            )}>
                {/* Header Visual */}
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-6 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            <Sparkles className="h-5 w-5 text-purple-400" />
                            Ação do Gabi AI
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {actionType === 'billing'
                                ? `Cobrança automática para ${customerName}`
                                : actionType === 'offer'
                                    ? `Enviar oferta especial para ${customerName}`
                                    : `Enviar mensagem para ${customerName}`}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-5">
                    {/* Destinatário */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                            {customerName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{customerName}</p>
                            <p className="text-xs text-zinc-500">{phone}</p>
                        </div>
                    </div>

                    {/* Preview da Mensagem */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            Mensagem que a Gabi enviará
                        </Label>
                        <div className="text-xs text-zinc-300 bg-white/5 p-4 rounded-xl border border-white/5 max-h-[150px] overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                            {messagePreview}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-0 gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 text-zinc-500 hover:text-white hover:bg-white/5 h-12"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold h-12 shadow-lg shadow-purple-900/20"
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Enviando...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Confirmar Envio
                            </div>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
