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
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon: Icon,
  to,
  onClick,
  filterState,
  className,
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
        "flex flex-col items-center justify-center p-4 aspect-square text-center cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-0 h-full w-full">
        <Icon className="h-8 w-8 mb-2 text-primary" />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </CardContent>
    </Card>
  );
};