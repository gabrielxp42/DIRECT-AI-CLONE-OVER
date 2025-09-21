import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, Clock, Wrench, CheckCircle, XCircle, Package, DollarSign } from "lucide-react";
import { cn } from '@/lib/utils';

interface OrderStatusIndicatorProps {
  status: string;
}

export const OrderStatusIndicator: React.FC<OrderStatusIndicatorProps> = ({ status }) => {
  const getStatusInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Pendente' };
      case 'processando':
        return { icon: Wrench, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Processando' };
      case 'enviado':
        return { icon: CheckCircle, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Enviado' };
      case 'entregue':
        return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Entregue' };
      case 'cancelado':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Cancelado' };
      case 'pago':
        return { icon: DollarSign, color: 'text-green-700', bgColor: 'bg-green-200', label: 'Pago' };
      case 'aguardando retirada':
        return { icon: Package, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Aguardando Retirada' };
      default:
        return { icon: Circle, color: 'text-gray-500', bgColor: 'bg-gray-100', label: status };
    }
  };

  const { icon: Icon, color, label } = getStatusInfo(status);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center justify-center h-6 w-6 rounded-full", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
};