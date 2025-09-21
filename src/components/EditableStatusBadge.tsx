import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LucideIcon, Clock, Wrench, CheckCircle, Package, Truck, XCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusOption {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'pendente', label: 'Pendente', icon: Clock, color: 'bg-yellow-500 border-yellow-600' },
  { value: 'processando', label: 'Processando', icon: Wrench, color: 'bg-blue-500 border-blue-600' },
  { value: 'pago', label: 'Pago', icon: CheckCircle, color: 'bg-green-500 border-green-600' },
  { value: 'aguardando retirada', label: 'Aguardando Retirada', icon: Package, color: 'bg-orange-500 border-orange-600' },
  { value: 'entregue', label: 'Entregue', icon: Truck, color: 'bg-green-700 border-green-800' },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle, color: 'bg-red-500 border-red-600' },
];

interface EditableStatusBadgeProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  isLoading?: boolean;
}

export const EditableStatusBadge: React.FC<EditableStatusBadgeProps> = ({
  currentStatus,
  onStatusChange,
  isLoading = false,
}) => {
  const statusInfo = STATUS_OPTIONS.find(option => option.value === currentStatus);
  const Icon = statusInfo?.icon || Clock; // Default icon if status not found
  const colorClass = statusInfo?.color || 'bg-gray-500 border-gray-600';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer text-white text-[0.6rem] px-1 py-0 whitespace-nowrap flex items-center justify-center gap-1",
            colorClass,
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          style={{ minWidth: '80px' }} // Garante um tamanho mínimo para o badge
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="animate-pulse">Atualizando...</span>
          ) : (
            <>
              <Icon className="h-3 w-3" />
              <span>{statusInfo?.label || currentStatus}</span>
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            disabled={isLoading || option.value === currentStatus}
            className="flex items-center gap-2"
          >
            <option.icon className="h-4 w-4" />
            <span>{option.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};