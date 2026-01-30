import React, { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Calculator,
    PlusCircle,
    MessageSquare,
    Layers,
    Users,
    Package,
    QrCode,
    ClipboardList,
    Check,
    Settings2,
    X
} from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ShortcutOption {
    id: string;
    label: string;
    icon: any;
    description: string;
    color: string;
}

const AVAILABLE_SHORTCUTS: ShortcutOption[] = [
    { id: 'new_pedido', label: 'Criar Pedido', icon: PlusCircle, description: 'Atalho rápido para novo orçamento', color: 'text-primary' },
    { id: 'calculator', label: 'Calculadora DTF', icon: Calculator, description: 'Calculadora de preços e orçamentos', color: 'text-blue-400' },
    { id: 'talk_gabi', label: 'Falar com a Gabi', icon: MessageSquare, description: 'Abrir assistente de IA', color: 'text-pink-400' },
    { id: 'add_insumo', label: 'Adicionar Insumo', icon: Layers, description: 'Registro rápido de novos materiais', color: 'text-emerald-400' },
    { id: 'new_cliente', label: 'Novo Cliente', icon: Users, description: 'Cadastro rápido de clientes', color: 'text-purple-400' },
    { id: 'new_produto', label: 'Novo Produto', icon: Package, description: 'Cadastro rápido de produtos', color: 'text-orange-400' },
    { id: 'pix_generator', label: 'Gerador de PIX', icon: QrCode, description: 'Gerar QR Code PIX rapidamente', color: 'text-green-400' },
    { id: 'price_table', label: 'Tabela de Preços', icon: ClipboardList, description: 'Consulta rápida de valores', color: 'text-cyan-400' },
];

interface ShortcutSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShortcutSelectionModal = ({ isOpen, onClose }: ShortcutSelectionModalProps) => {
    const { companyProfile, updateProfileAsync, isUpdating } = useCompanyProfile();
    // Local state for instant feedback before saving
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    // Sync from DB when opening
    React.useEffect(() => {
        if (isOpen && companyProfile?.sidebar_shortcuts) {
            // Ensure array and valid IDs
            const current = Array.isArray(companyProfile.sidebar_shortcuts)
                ? (companyProfile.sidebar_shortcuts as string[])
                : ['calculator', 'new_pedido', 'talk_gabi', 'new_cliente'];
            setSelectedIds(current);
        }
    }, [isOpen, companyProfile]);

    const handleToggle = (id: string) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(item => item !== id);
            } else {
                if (prev.length >= 6) {
                    toast.error("Máximo de 6 atalhos permitidos.");
                    return prev;
                }
                return [...prev, id];
            }
        });
    };

    const handleSave = async () => {
        try {
            await updateProfileAsync({ sidebar_shortcuts: selectedIds });
            toast.success("Atalhos atualizados!");
            onClose();
        } catch (error) {
            toast.error("Erro ao salvar atalhos.");
            console.error(error);
        }
    };

    // Calculate slots usage
    const slotsUsed = selectedIds.length;
    const maxSlots = 6;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] w-[95vw] h-[85vh] sm:h-auto overflow-hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-white/10 p-0 shadow-2xl flex flex-col rounded-3xl">
                {/* Header Compacto */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <Settings2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white">Central de Atalhos</DialogTitle>
                            <DialogDescription className="text-xs text-zinc-400">Personalize sua barra de ações rápidas</DialogDescription>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo Scrollável */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-20">
                        {AVAILABLE_SHORTCUTS.map((shortcut) => {
                            const isSelected = selectedIds.includes(shortcut.id);
                            const Icon = shortcut.icon;

                            return (
                                <motion.button
                                    key={shortcut.id}
                                    onClick={() => handleToggle(shortcut.id)}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={cn(
                                        "relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 w-full text-left group overflow-hidden",
                                        isSelected
                                            ? "bg-white/[0.03] border-primary/50 shadow-[0_0_20px_var(--primary-custom)]/5"
                                            : "bg-transparent border-white/5 hover:bg-white/[0.02] hover:border-white/10 opacity-60 hover:opacity-100"
                                    )}
                                >
                                    {/* Selection Indicator */}
                                    <div className={cn(
                                        "absolute top-0 right-0 p-2 transition-all",
                                        isSelected ? "opacity-100" : "opacity-0"
                                    )}>
                                        <div className="bg-primary rounded-bl-xl rounded-tr-lg p-1">
                                            <Check className="w-3 h-3 text-primary-foreground font-bold" strokeWidth={4} />
                                        </div>
                                    </div>

                                    {/* Icon Box */}
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center border transition-colors shrink-0",
                                        isSelected
                                            ? "bg-primary/10 border-primary/20"
                                            : "bg-white/5 border-white/5 group-hover:bg-white/10"
                                    )}>
                                        <Icon className={cn("w-6 h-6 transition-colors", isSelected ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300")} />
                                    </div>

                                    {/* Text Info */}
                                    <div className="flex flex-col min-w-0">
                                        <span className={cn(
                                            "font-bold text-sm tracking-wide transition-colors",
                                            isSelected ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                                        )}>
                                            {shortcut.label}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 leading-tight line-clamp-2 mt-0.5">
                                            {shortcut.description}
                                        </span>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Flutuante */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl z-20">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Slots em uso</span>
                            <div className="flex items-center gap-1 mt-1">
                                {Array.from({ length: maxSlots }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            "w-3 h-3 rounded-full border transition-all",
                                            i < slotsUsed
                                                ? "bg-primary border-primary shadow-[0_0_10px_var(--primary-custom)]/50"
                                                : "bg-white/5 border-white/10"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isUpdating}
                                className="bg-primary hover:brightness-110 text-primary-foreground font-bold shadow-[0_0_20px_var(--primary-custom)]/20 px-6"
                            >
                                {isUpdating ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : "Salvar Alterações"}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
