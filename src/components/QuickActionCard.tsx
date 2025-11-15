import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
        "flex flex-col items-center justify-center p-3 h-full text-center cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50",
        "min-w-[80px] min-h-[80px]", // Aumenta um pouco o tamanho mínimo para melhor toque/clique
        className
      )}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center justify-center space-y-1">
        <Icon className="h-5 w-5 text-primary" />
        {count !== undefined && (
          <span className="text-xl font-bold text-foreground leading-none">
            {count}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground leading-tight mt-0.5">
          {title}
        </span>
      </div>
    </Card>
  );
};