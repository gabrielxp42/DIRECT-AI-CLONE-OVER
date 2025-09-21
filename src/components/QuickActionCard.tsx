import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card'; // Removido CardContent
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  title: string;
  icon: LucideIcon;
  to?: string; // Rota para navegação
  onClick?: () => void; // Função para ação direta (ex: abrir modal)
  filterState?: any; // Estado para passar para a rota (ex: filtro de status)
  className?: string;
  count?: number; // Nova prop para a contagem
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon: Icon,
  to,
  onClick,
  filterState,
  className,
  count,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to, { state: filterState });
    }
  };

  return (
    <Card 
      className={cn(
        "flex flex-col items-center justify-center p-1 aspect-square text-center cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50", // Padding ainda mais reduzido
        "min-w-[60px] min-h-[60px]", // Tamanho mínimo para garantir que caibam 5 em uma linha
        className
      )}
      onClick={handleClick}
    >
      <Icon className="h-4 w-4 text-primary" /> {/* Ícone menor */}
      {count !== undefined && (
        <span className="text-sm font-bold text-foreground leading-none mt-0.5"> {/* Contagem menor */}
          {count}
        </span>
      )}
      <span className="text-[0.6rem] font-medium text-muted-foreground leading-tight mt-0.5"> {/* Texto ainda menor */}
        {title}
      </span>
    </Card>
  );
};