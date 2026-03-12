import { useNavigate } from "react-router-dom";
import { useAIAssistant } from "@/contexts/AIAssistantProvider";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { showSuccess } from "@/utils/toast";
import { toast } from "sonner";
import {
    Calculator,
    PlusCircle,
    MessageSquare,
    Layers,
    Users,
    Package,
    QrCode,
    ClipboardList,
    Truck,
    MessageCircle,
    Share2,
    Factory,
    LineChart,
    Boxes
} from "lucide-react";
import React from "react";

export const SHORTCUT_DEFINITIONS: Record<string, any> = {
    calculator: { label: 'Calculadora DTF', icon: Calculator, pulse: true },
    new_pedido: { label: 'Criar Pedido', icon: PlusCircle },
    talk_gabi: { label: 'Falar com a Gabi', icon: MessageSquare },
    add_insumo: { label: 'Adicionar Insumo', icon: Layers },
    new_cliente: { label: 'Novo Cliente', icon: Users },
    new_produto: { label: 'Novo Produto', icon: Package },
    shipping: { label: 'Gerar Frete', icon: Truck },
    whatsapp_config: { label: 'Conexão WhatsApp', icon: MessageCircle },
    finance: { label: 'Financeiro', icon: LineChart },
    inventory: { label: 'Estoque', icon: Boxes },
    pix_generator: { label: 'Gerador de PIX', icon: QrCode },
    price_table: { label: 'Tabela de Preços', icon: ClipboardList },
    catalog: { label: 'Catálogo Digital', icon: Share2 },
    production: { label: 'Produção', icon: Factory },
    logistics: { label: 'Logística', icon: Truck },
};

export const useShortcuts = (onOpenCalculator?: () => void) => {
    const { profile } = useAuth();
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
            case 'shipping':
            case 'whatsapp_config':
            case 'finance':
            case 'inventory':
            case 'logistics':
                 // Navigation to valid pages usually, but just in case keeping logistics mapped:
                 if (id === 'logistics' || id === 'shipping') navigate('/logistica');
                 else if (id === 'whatsapp_config') navigate('/settings', { state: { tab: 'whatsapp' } });
                 else if (id === 'inventory') navigate('/insumos');
                 else if (id === 'finance') navigate('/reports');
                 break;
            case 'pix_generator':
                toast.info("Gerador de PIX em breve!");
                break;
            case 'price_table':
                toast.info("Tabela de Preços em breve!");
                break;
            case 'catalog':
                toast.info("Catálogo em breve!");
                break;
            case 'production':
                if (profile?.is_admin) {
                    navigate('/producao');
                } else {
                    toast.info("Modo Operador e Fila de Produção em breve!");
                }
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
