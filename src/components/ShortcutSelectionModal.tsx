import * as React from 'react';
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
    Settings2
} from "lucide-react";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { cn } from "@/lib/utils";

interface ShortcutOption {
    id: string;
    label: string;
    icon: any;
    description: string;
}

const AVAILABLE_SHORTCUTS: ShortcutOption[] = [
    { id: 'calculator', label: 'Calculadora DTF', icon: Calculator, description: 'Calculadora de preços e orçamentos' },
    { id: 'new_pedido', label: 'Criar Pedido', icon: PlusCircle, description: 'Atalho rápido para novo orçamento' },
    { id: 'talk_gabi', label: 'Falar com a Gabi', icon: MessageSquare, description: 'Abrir assistente de IA' },
    { id: 'add_insumo', label: 'Adicionar Insumo', icon: Layers, description: 'Registro rápido de novos materiais' },
    { id: 'new_cliente', label: 'Novo Cliente', icon: Users, description: 'Cadastro rápido de clientes' },
    { id: 'new_produto', label: 'Novo Produto', icon: Package, description: 'Cadastro rápido de produtos' },
    { id: 'pix_generator', label: 'Gerador de PIX', icon: QrCode, description: 'Gerar QR Code PIX rapidamente' },
    { id: 'price_table', label: 'Tabela de Preços', icon: ClipboardList, description: 'Consulta rápida de valores' },
];

interface ShortcutSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ShortcutSelectionModal = ({ isOpen, onClose }: ShortcutSelectionModalProps) => {
    const { companyProfile, updateProfileAsync, isUpdating } = useCompanyProfile();
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (companyProfile?.sidebar_shortcuts) {
            setSelectedIds(companyProfile.sidebar_shortcuts);
        } else {
            setSelectedIds(['calculator', 'new_pedido', 'talk_gabi', 'new_cliente']);
        }
    }, [companyProfile?.sidebar_shortcuts, isOpen]);

    const toggleShortcut = (id: string) => {
        setSelectedIds(current =>
            current.includes(id)
                ? current.filter(i => i !== id)
                : [...current, id].slice(0, 6) // Max 6 shortcuts to keep layout clean
        );
    };

    const handleSave = async () => {
        try {
            await updateProfileAsync({ sidebar_shortcuts: selectedIds });
            onClose();
        } catch (error) {
            console.error('Failed to save shortcuts:', error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-background/95 backdrop-blur-xl border-primary/20 shadow-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Settings2 className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-bold">Personalizar Atalhos</DialogTitle>
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        Escolha até 6 atalhos para aparecer na sua barra lateral. Isso ajuda você a acessar o que mais usa rapidamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                    {AVAILABLE_SHORTCUTS.map((shortcut) => {
                        const isSelected = selectedIds.includes(shortcut.id);
                        return (
                            <button
                                key={shortcut.id}
                                onClick={() => toggleShortcut(shortcut.id)}
                                className={cn(
                                    "flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 text-left group relative",
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-md"
                                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                                )}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                                        <Check className="h-3 w-3" />
                                    </div>
                                )}

                                <div className={cn(
                                    "p-2 rounded-lg mb-3 transition-colors",
                                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                                )}>
                                    <shortcut.icon className="h-5 w-5" />
                                </div>

                                <h4 className="font-semibold text-sm mb-1">{shortcut.label}</h4>
                                <p className="text-[11px] text-muted-foreground leading-tight">
                                    {shortcut.description}
                                </p>
                            </button>
                        );
                    })}
                </div>

                <DialogFooter className="flex items-center justify-between sm:justify-between w-full border-t border-border mt-2 pt-4">
                    <p className="text-xs text-muted-foreground">
                        {selectedIds.length} de 6 selecionados
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={isUpdating}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isUpdating} className="px-6">
                            {isUpdating ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
