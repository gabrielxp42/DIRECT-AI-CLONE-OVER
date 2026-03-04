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
import { MessageSquare, Send, Sparkles, User, ChevronsUpDown, Check, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface GabiActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    phone: string;
    messagePreview: string;
    onConfirm: (msg: string, clienteId?: string, manualPhone?: string) => void | Promise<void>;
    isLoading?: boolean;
    actionType?: 'billing' | 'offer' | 'generic';
    clientes?: any[];
}

export const GabiActionDialog = ({
    isOpen,
    onOpenChange,
    customerName,
    phone,
    messagePreview,
    onConfirm,
    isLoading = false,
    actionType = 'generic',
    clientes = []
}: GabiActionDialogProps) => {
    const isMobile = useIsMobile();
    const [clienteOpen, setClienteOpen] = useState(false);
    const [selectedId, setSelectedId] = useState("");
    const [manualPhone, setManualPhone] = useState("");

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
                    {/* Seletor de Cliente Integrado */}
                    {clientes && clientes.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                                Selecionar Cliente
                            </Label>
                            <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-full justify-between bg-white/5 border-white/10 hover:border-white/20 text-zinc-300 h-12 rounded-xl"
                                    >
                                        {selectedId ? (
                                            <div className="flex items-center gap-2 truncate">
                                                <User className="h-4 w-4 text-purple-400 shrink-0" />
                                                <span className="truncate">{clientes.find(c => c.id === selectedId)?.nome}</span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-500">Escolha um cliente...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[340px] p-0 bg-zinc-950 border-white/10 shadow-2xl" align="start">
                                    <Command className="bg-transparent">
                                        <CommandInput placeholder="Buscar cliente..." className="h-10" />
                                        <CommandList>
                                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {clientes.map((cliente) => (
                                                    <CommandItem
                                                        key={cliente.id}
                                                        value={cliente.nome}
                                                        onSelect={() => {
                                                            setSelectedId(cliente.id);
                                                            setClienteOpen(false);
                                                        }}
                                                        className="flex items-center justify-between text-zinc-300 hover:bg-white/5 cursor-pointer py-3"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{cliente.nome}</span>
                                                            <span className="text-[10px] text-zinc-500">{cliente.telefone || 'Sem telefone'}</span>
                                                        </div>
                                                        <Check
                                                            className={cn(
                                                                "h-4 w-4 text-purple-400",
                                                                selectedId === cliente.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">
                            Ou digitar número manualmente
                        </Label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <MessageSquare className="h-4 w-4 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                            </div>
                            <Input
                                placeholder="DDD + Número (ex: 11999998888)"
                                value={manualPhone}
                                onChange={(e) => {
                                    setManualPhone(e.target.value);
                                    if (e.target.value) setSelectedId(""); // Clear selection if typing manually
                                }}
                                className="bg-white/5 border-white/10 hover:border-white/20 focus:border-purple-500/50 text-zinc-300 h-12 pl-12 rounded-xl transition-all"
                            />
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
                        onClick={() => onConfirm(messagePreview, selectedId, manualPhone)}
                        disabled={isLoading || (!selectedId && !manualPhone)}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold h-12 shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:grayscale transition-all"
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
