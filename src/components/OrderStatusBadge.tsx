import { Badge } from "@/components/ui/badge";

interface OrderStatusBadgeProps {
  status: string;
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return 'default';
      case 'processando':
        return 'secondary';
      case 'enviado':
        return 'outline';
      case 'entregue':
        return 'default';
      case 'cancelado':
        return 'destructive';
      case 'pago':
        return 'default';
      case 'aguardando retirada': // Novo status
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return 'bg-primary/20 text-primary hover:bg-primary/30';
      case 'processando':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'enviado':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
      case 'entregue':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'cancelado':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'pago':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'aguardando retirada': // Novo status
        return 'bg-orange-500 text-white hover:bg-orange-600';
      default:
        return '';
    }
  };

  return (
    <Badge
      variant={getStatusVariant(status)}
      className={getStatusColor(status)}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};