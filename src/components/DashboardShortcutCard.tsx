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
    <Link to={to} state={filterState} className={cn("block group", className)}>
      <Card className="h-full flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:scale-[1.03] cursor-pointer bg-card/40 dark:bg-slate-900/40 backdrop-blur-md border border-border/40 hover:border-primary/20 relative overflow-hidden rounded-2xl">
        <div className="absolute -inset-2 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-bold text-foreground tracking-tight">{title}</CardTitle>
          <div className="p-2 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/30 dark:border-white/10 group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              <div className="text-lg md:text-2xl font-bold truncate">{count}</div>
              {children} {/* Renderiza o conteúdo de crescimento aqui */}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};