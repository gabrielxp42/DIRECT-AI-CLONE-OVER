import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardShortcutCardProps {
  title: string;
  count: number | string;
  icon: LucideIcon;
  to: string;
  filterState?: any;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode; // Adicionado children para o texto de crescimento
}

export const DashboardShortcutCard: React.FC<DashboardShortcutCardProps> = ({
  title,
  count,
  icon: Icon,
  to,
  filterState,
  loading = false,
  className,
  children, // Recebe o children
}) => {
  return (
    <Link to={to} state={filterState} className={cn("block", className)}>
      <Card className="h-full flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold">{count}</div>
              {children} {/* Renderiza o conteúdo de crescimento aqui */}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};