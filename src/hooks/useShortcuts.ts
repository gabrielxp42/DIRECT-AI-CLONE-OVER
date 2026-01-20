import { useNavigate } from "react-router-dom";
import { useAIAssistant } from "@/contexts/AIAssistantProvider";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { showSuccess } from "@/utils/toast";
import {
    Calculator,
    PlusCircle,
    MessageSquare,
    Layers,
    Users,
    Package,
    QrCode,
    ClipboardList
} from "lucide-react";
import React from "react";

export const SHORTCUT_DEFINITIONS: Record<string, any> = {
    calculator: { label: 'Calculadora DTF', icon: Calculator, pulse: true },
    new_pedido: { label: 'Criar Pedido', icon: PlusCircle },
    talk_gabi: { label: 'Falar com a Gabi', icon: MessageSquare },
    add_insumo: { label: 'Adicionar Insumo', icon: Layers },
    new_cliente: { label: 'Novo Cliente', icon: Users },
    new_produto: { label: 'Novo Produto', icon: Package },
    pix_generator: { label: 'Gerador de PIX', icon: QrCode },
    price_table: { label: 'Tabela de Preços', icon: ClipboardList },
};

export const useShortcuts = (onOpenCalculator?: () => void) => {
    const { companyProfile } = useCompanyProfile();
    const { open: openAIAssistant } = useAIAssistant();
    const navigate = useNavigate();

    const activeShortcuts = React.useMemo(() => {
        if (companyProfile?.sidebar_shortcuts && Array.isArray(companyProfile.sidebar_shortcuts) && companyProfile.sidebar_shortcuts.length > 0) {
            return companyProfile.sidebar_shortcuts;
        }
        return ['calculator', 'new_pedido', 'talk_gabi', 'new_cliente'];
    }, [companyProfile]);

    const handleShortcutAction = (id: string) => {
        switch (id) {
            case 'calculator':
                if (onOpenCalculator) onOpenCalculator();
                break;
            case 'talk_gabi':
                openAIAssistant();
                break;
            case 'new_pedido':
                navigate('/pedidos', { state: { openForm: true } });
                break;
            case 'add_insumo':
                navigate('/insumos', { state: { openForm: true } });
                break;
            case 'new_cliente':
                navigate('/clientes', { state: { openForm: true } });
                break;
            case 'new_produto':
                navigate('/produtos', { state: { openForm: true } });
                break;
            case 'pix_generator':
                showSuccess("Gerador de PIX em breve!");
                break;
            case 'price_table':
                showSuccess("Tabela de Preços em breve!");
                break;
            default:
                console.warn(`No action defined for shortcut: ${id}`);
        }
    };

    return {
        activeShortcuts,
        handleShortcutAction,
        definitions: SHORTCUT_DEFINITIONS
    };
};
