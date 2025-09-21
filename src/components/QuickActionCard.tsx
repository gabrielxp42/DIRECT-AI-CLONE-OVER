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
  loading?: boolean; // Para exibir skeleton enquanto carrega
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon: Icon,
  to,
  onClick,
  filterState,
  className,
  count,
  loading = false,
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
        "flex flex-col items-center justify-center p-1.5 aspect-square text-center cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50", // Reduzido o padding
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="flex flex-col items-center justify-center p-0 h-full w-full">
        {loading ? (
          <>
            <div className="h-4 w-4 mb-1 rounded-full bg-muted-foreground/30 animate-pulse" />
            <div className="h-4 w-6 mb-0.5 bg-muted-foreground/30 animate-pulse" />
            <div className="h-3 w-10 bg-muted-foreground/30 animate-pulse" />
          </>
        ) : (
          <>
            <Icon className="h-4 w-4 mb-0.5 text-primary" /> {/* Ícone ainda menor */}
            {count !== undefined && (
              <span className="text-base font-bold text-foreground leading-none mb-0.5"> {/* Contagem menor */}
                {count}
              </span>
            )}
            <span className="text-xs font-medium text-muted-foreground leading-tight">{title}</span> {/* Texto menor */}
          </>
        )}
      </CardContent>
    </Card>
  );
};