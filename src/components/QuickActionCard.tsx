import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  count, // Usar a nova prop
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
        "flex flex-col items-center justify-center p-2 aspect-square text-center cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50", // Reduzido o padding
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-0 h-full w-full">
        <Icon className="h-5 w-5 mb-1 text-primary" /> {/* Ícone um pouco menor */}
        {count !== undefined && ( // Exibir contagem se fornecida
          <span className="text-lg font-bold text-foreground leading-none mb-0.5">
            {count}
          </span>
        )}
        <span className="text-xs font-medium text-muted-foreground leading-tight">{title}</span> {/* Texto menor e mais discreto */}
      </CardContent>
    </Card>
  );
};