import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, CheckCircle, Smartphone, User, Search, Check, ChevronsUpDown, Users, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useClientes } from '@/hooks/useDataFetch';
import { useIsMobile } from '@/hooks/use-mobile';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface GabiActionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    customerName: string;
    messagePreview: string;
    onConfirm: (data: { phone?: string; attachPdf?: boolean }) => void;
    phone?: string;
    isLoading?: boolean;
    actionType?: 'billing' | 'offer' | 'generic';
}

export const GabiActionDialog: React.FC<GabiActionDialogProps> = ({
    isOpen,
    onOpenChange,
    customerName,
    messagePreview,
    onConfirm,
    phone: initialPhone = '',
    isLoading = false,
    actionType = 'generic'
}) => {
    const isMobile = useIsMobile();
    const [phone, setPhone] = React.useState(initialPhone);
    const [clientOpen, setClientOpen] = React.useState(false);
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [attachPdf, setAttachPdf] = React.useState(true); // Default to true based on user preference memory in future
    const { data: clients } = useClientes();

    React.useEffect(() => {
        if (isOpen) {
            setPhone(initialPhone);
            setClientOpen(false);
        }
    }, [isOpen, initialPhone]);

    const getGradient = () => {
        switch (actionType) {
            case 'billing': return 'from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7]'; // Padrão Gabi
            case 'offer': return 'from-emerald-400 via-teal-500 to-cyan-500'; // Oferta Esverdeada
            default: return 'from-[#FF6B6B] via-[#ffd93d] to-[#6c5ce7]';
        }
    };

    const getIcon = () => {
        switch (actionType) {
            case 'billing': return <Smartphone className="w-5 h-5 text-white" />;
            case 'offer': return <CheckCircle className="w-5 h-5 text-white" />;
            default: return <MessageCircle className="w-5 h-5 text-white" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "border-0 p-0 overflow-y-auto bg-slate-950/95 text-white backdrop-blur-xl scrollbar-hide",
                isMobile
                    ? "max-w-[100vw] w-full p-0 pb-safe rounded-t-[2.5rem] rounded-b-none bottom-0 top-auto translate-y-0 h-[95vh]"
                    : "sm:max-w-md max-h-[95vh]"
            )}>
                {isMobile && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full z-50" />
                )}
                {/* Header com Gradiente Animado */}
                <div className={`relative h-24 bg-gradient-to-br ${getGradient()} p-6 flex items-center justify-between overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />

                    {/* Particles Effect (Simulated with absolute dots) */}
                    <motion.div
                        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute top-2 right-10 w-24 h-24 bg-white/20 rounded-full blur-2xl"
                    />

                    <div className="relative z-10 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-lg backdrop-blur-md">
                            {getIcon()}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-white tracking-wide uppercase">
                                Gabi Action
                            </h2>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-white/80 font-medium">
                                    Automação via
                                </p>
                                <div className="flex items-center gap-1 bg-[#25D366] px-2 py-0.5 rounded-full">
                                    <MessageCircle className="w-3 h-3 text-white" />
                                    <span className="text-[10px] font-black text-white tracking-wide">WhatsApp</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Descrição Contextual */}
                    <div className="text-center">
                        <DialogTitle className="text-lg font-bold text-white mb-2">
                            Confirmar Envio?
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Vou enviar a seguinte mensagem diretamente para o WhatsApp{initialPhone || customerName !== 'Cliente' ? ` de ` : ''}
                            <span className="text-white font-bold">{initialPhone || (customerName !== 'Cliente' ? customerName : '')}</span>:
                        </DialogDescription>
                    </div>

                    {/* Seção de Seleção de Destinatário */}
                    <div className="space-y-3 px-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                                WhatsApp do Destinatário
                            </Label>
                            {clients && clients.length > 0 && (
                                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px] font-black text-primary hover:text-primary hover:bg-primary/10 gap-1 uppercase tracking-tighter"
                                        >
                                            <Users className="w-3 h-3" /> Buscar Cliente
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[280px] bg-slate-900 border-slate-800" align="end">
                                        <Command className="bg-transparent">
                                            <CommandInput placeholder="Procurar cliente..." className="h-9" />
                                            <CommandList>
                                                <CommandEmpty className="py-2 text-xs text-center text-slate-500">Nenhum cliente encontrado.</CommandEmpty>
                                                <CommandGroup>
                                                    {clients.map((client) => (
                                                        <CommandItem
                                                            key={client.id}
                                                            value={client.nome}
                                                            onSelect={() => {
                                                                if (client.telefone) setPhone(client.telefone);
                                                                setClientOpen(false);
                                                            }}
                                                            className="text-xs text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-white">{client.nome}</span>
                                                                {client.telefone && <span className="text-[10px] text-slate-500">{client.telefone}</span>}
                                                            </div>
                                                            {phone === client.telefone && <Check className="w-3 h-3 text-primary" />}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl">
                            <Smartphone className="h-4 w-4 text-slate-500" />
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="Número com DDD (ex: 11999999999)"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="bg-transparent border-none text-white placeholder:text-slate-600 h-7 p-0 focus-visible:ring-0 shadow-none selection:bg-primary/20"
                            />
                        </div>
                    </div>

                    {/* Preview da Mensagem (Chat Bubble Style) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Preview da Mensagem
                            </Label>
                            {messagePreview.length > 150 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="h-6 text-[10px] font-black text-slate-500 hover:text-white gap-1 uppercase tracking-tighter"
                                >
                                    {isExpanded ? (
                                        <><ChevronUp className="w-3 h-3" /> Ver Menos</>
                                    ) : (
                                        <><ChevronDown className="w-3 h-3" /> Ver Completo</>
                                    )}
                                </Button>
                            )}
                        </div>
                        <div className={cn(
                            "relative bg-slate-900/50 p-4 rounded-2xl border border-slate-800 rounded-tl-sm mx-2 transition-all duration-300 ease-in-out overflow-y-auto",
                            isExpanded ? "max-h-[50vh]" : "max-h-40"
                        )}>
                            <p className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                                {messagePreview}
                            </p>
                            {!isExpanded && messagePreview.length > 200 && (
                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent rounded-b-2xl pointer-events-none" />
                            )}
                            <div className="absolute -left-2 top-0 w-4 h-4 bg-slate-900/50 border-l border-t border-slate-800 transform -rotate-45" />
                        </div>
                    </div>

                    <div className="px-6 pb-4">
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5 mt-2">
                            <div
                                onClick={() => setAttachPdf(!attachPdf)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group",
                                    attachPdf
                                        ? "bg-emerald-500/10 border-emerald-500/50"
                                        : "bg-white/5 border-white/5 hover:border-white/10"
                                )}
                            >
                                <div className={cn(
                                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                    attachPdf ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white/5 text-slate-400"
                                )}>
                                    {attachPdf ? <Check className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className={cn("text-xs font-bold uppercase tracking-wider", attachPdf ? "text-emerald-400" : "text-slate-400")}>
                                            Anexar Resumo PDF
                                        </h4>
                                        {attachPdf && (
                                            <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                                Ativado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                                        Envia o documento oficial do pedido junto com a mensagem.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 bg-slate-900/50 backdrop-blur-md border-t border-white/5">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => onConfirm({ phone, attachPdf })}
                        disabled={isLoading || (!initialPhone && !phone)}
                        className={`bg-gradient-to-r ${getGradient()} text-slate-950 font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all`}
                    >
                        {isLoading ? (
                            <>Enviando...</>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar Agora
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
