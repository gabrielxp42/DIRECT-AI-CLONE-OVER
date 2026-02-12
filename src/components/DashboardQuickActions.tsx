import React from 'react';
import { PlusCircle, UserPlus, FileText, Layers, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export const DashboardQuickActions = () => {
    const navigate = useNavigate();

    const actions = [
        {
            title: "Novo Pedido",
            icon: PlusCircle,
            onClick: () => navigate('/pedidos', { state: { openForm: true } }),
            color: "text-blue-600",
            bg: "bg-blue-50 hover:bg-blue-100",
            desc: "Criar venda"
        },
        {
            title: "Novo Cliente",
            icon: UserPlus,
            onClick: () => navigate('/clientes', { state: { openForm: true } }),
            color: "text-green-600",
            bg: "bg-green-50 hover:bg-green-100",
            desc: "Cadastrar"
        },
        {
            title: "Novo Insumo",
            icon: Layers,
            onClick: () => navigate('/insumos', { state: { openForm: true } }),
            color: "text-purple-600",
            bg: "bg-purple-50 hover:bg-purple-100",
            desc: "Estoque"
        },
        {
            title: "Gerar Etiqueta (Frete)",
            icon: Truck,
            onClick: () => navigate('/logistica'),
            color: "text-primary",
            bg: "bg-primary/5 hover:bg-primary/10",
            desc: "Logística e Envios"
        }
    ];

    return (
        <div className="mb-8">
            <h2 className="text-lg md:text-xl font-black mb-4 flex items-center gap-2 uppercase italic tracking-tighter">
                <span className="bg-primary/10 p-1 rounded text-primary border border-primary/20">⚡</span> Acesso Rápido
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {actions.map((action, index) => (
                    <Card
                        key={index}
                        onClick={action.onClick}
                        className={`p-4 flex flex-col items-center justify-center text-center h-32 transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-primary/20 shadow-sm hover:shadow-md group ${action.bg}`}
                    >
                        <div className={`p-3 rounded-full bg-white shadow-sm mb-2 group-hover:scale-110 transition-transform duration-200`}>
                            <action.icon className={`h-6 w-6 ${action.color}`} />
                        </div>
                        <h3 className="font-semibold text-sm text-gray-900">{action.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">{action.desc}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};
