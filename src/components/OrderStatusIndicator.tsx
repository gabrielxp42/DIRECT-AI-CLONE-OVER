import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
// Status Badge v3 - Outlined style, Pago is solid

interface OrderStatusIndicatorProps {
  status: string;
}

export const OrderStatusIndicator: React.FC<OrderStatusIndicatorProps> = ({ status }) => {
  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return { color: 'text-yellow-600 border-yellow-400', bgColor: 'bg-transparent', label: 'Pendente' };
      case 'processando':
        return { color: 'text-blue-600 border-blue-400', bgColor: 'bg-transparent', label: 'Processando' };
      case 'enviado':
        return { color: 'text-purple-600 border-purple-400', bgColor: 'bg-transparent', label: 'Enviado' };
      case 'entregue':
        return { color: 'text-green-600 border-green-400', bgColor: 'bg-transparent', label: 'Entregue' };
      case 'cancelado':
        return { color: 'text-red-600 border-red-400', bgColor: 'bg-transparent', label: 'Cancelado' };
      case 'pago':
        return { color: 'text-white border-green-600', bgColor: 'bg-green-600', label: 'Pago' };
      case 'aguardando retirada':
        return { color: 'text-orange-600 border-orange-400', bgColor: 'bg-transparent', label: 'Ag. Retirada' };
      default:
        return { color: 'text-gray-600 border-gray-400', bgColor: 'bg-transparent', label: status };
    }
  };

  const { color, bgColor, label } = getStatusInfo(status);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase border transition-all hover:scale-105 cursor-pointer",
          color,
          bgColor
        )}>
          {label}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Clique para alterar status</p>
      </TooltipContent>
    </Tooltip>
  );
};