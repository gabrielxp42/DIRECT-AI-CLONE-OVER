import { PlusCircle, UserPlus, Layers, Truck, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export const DashboardQuickActions = () => {
    const navigate = useNavigate();

    const actions = [
        {
            title: "Novo Pedido",
            icon: PlusCircle,
            onClick: () => navigate('/pedidos', { state: { openForm: true } }),
            color: "text-blue-500 dark:text-blue-400",
            hoverGlow: "group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
            borderHover: "group-hover:border-blue-500/30",
            bgGradient: "from-blue-500/5 to-transparent",
            desc: "Criar venda"
        },
        {
            title: "Novo Cliente",
            icon: UserPlus,
            onClick: () => navigate('/clientes', { state: { openForm: true } }),
            color: "text-green-500 dark:text-green-400",
            hoverGlow: "group-hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]",
            borderHover: "group-hover:border-green-500/30",
            bgGradient: "from-green-500/5 to-transparent",
            desc: "Cadastrar"
        },
        {
            title: "Novo Insumo",
            icon: Layers,
            onClick: () => navigate('/insumos', { state: { openForm: true } }),
            color: "text-purple-500 dark:text-purple-400",
            hoverGlow: "group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
            borderHover: "group-hover:border-purple-500/30",
            bgGradient: "from-purple-500/5 to-transparent",
            desc: "Estoque"
        },
        {
            title: "Gerar Etiqueta (Frete)",
            icon: Truck,
            onClick: () => navigate('/logistica'),
            color: "text-orange-500 dark:text-orange-400",
            hoverGlow: "group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
            borderHover: "group-hover:border-orange-500/30",
            bgGradient: "from-orange-500/5 to-transparent",
            desc: "Logística e Envios"
        }
    ];

    return (
        <div className="mb-8 relative z-10">
            <h2 className="text-lg md:text-xl font-black mb-4 flex items-center gap-2 uppercase italic tracking-tighter text-foreground">
                <span className="bg-primary/20 p-1.5 rounded-xl text-primary border border-primary/30 flex items-center justify-center w-8 h-8">
                    <Zap className="h-4 w-4 fill-current" />
                </span> 
                Acesso Rápido
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {actions.map((action, index) => (
                    <Card
                        key={index}
                        onClick={action.onClick}
                        className={`p-5 flex flex-col items-center justify-center text-center h-36 transition-all duration-300 cursor-pointer 
                        bg-card/40 dark:bg-slate-900/40 backdrop-blur-md 
                        border border-border/40 hover:scale-[1.03] rounded-2xl shadow-sm hover:shadow-xl group relative overflow-hidden ${action.borderHover} ${action.hoverGlow}`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${action.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        
                        <div className={`p-4 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/30 dark:border-white/10 mb-3 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                            <action.icon className={`h-6 w-6 ${action.color} transition-all duration-300 group-hover:drop-shadow-[0_0_8px_currentColor]`} />
                        </div>
                        <h3 className="font-bold text-sm text-foreground tracking-tight">{action.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">{action.desc}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};
