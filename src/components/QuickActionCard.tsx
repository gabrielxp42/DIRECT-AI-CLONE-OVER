import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  title: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  filterState?: any;
  className?: string;
  count?: number | string;
  variant?: 'amber' | 'blue' | 'rose' | 'indigo' | 'emerald' | 'zinc';
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon: Icon,
  to,
  onClick,
  filterState,
  className,
  count,
  variant = 'zinc'
}) => {
  const navigate = useNavigate();

  const variantStyles = {
    amber: "bg-transparent border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/5 dark:bg-zinc-900/40",
    blue: "bg-transparent border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/5 dark:bg-zinc-900/40",
    rose: "bg-transparent border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 dark:bg-zinc-900/40",
    indigo: "bg-transparent border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 dark:bg-zinc-900/40",
    emerald: "bg-transparent border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 dark:bg-zinc-900/40",
    zinc: "bg-transparent border-zinc-500/30 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/5 dark:bg-zinc-900/40",
  };

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
        "flex flex-col items-center justify-center p-3 h-full text-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-2 shadow-sm rounded-2xl",
        "min-w-[100px] min-h-[90px] md:min-w-[120px]",
        variantStyles[variant],
        className
      )}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center justify-center space-y-1.5">
        <Icon className="h-5 w-5 mb-0.5" />
        {count !== undefined && (
          <span className="text-xl font-black tabular-nums tracking-tighter">
            {count}
          </span>
        )}
        <span className="text-[10px] font-black uppercase tracking-wider opacity-80 leading-tight">
          {title}
        </span>
      </div>
    </Card>
  );
};