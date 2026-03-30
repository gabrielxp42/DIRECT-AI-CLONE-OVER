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
    amber: "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] dark:hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]",
    blue: "bg-blue-500/5 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.15)]",
    rose: "bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 hover:shadow-[0_0_20px_rgba(244,63,94,0.2)] dark:hover:shadow-[0_0_20px_rgba(251,113,133,0.15)]",
    indigo: "bg-indigo-500/5 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] dark:hover:shadow-[0_0_20px_rgba(129,140,248,0.15)]",
    emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] dark:hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]",
    zinc: "bg-zinc-500/5 border-zinc-500/20 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/10 hover:border-zinc-500/40 hover:shadow-[0_0_20px_rgba(113,113,122,0.2)] dark:hover:shadow-[0_0_20px_rgba(161,161,170,0.15)]",
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
        "flex flex-col items-center justify-center p-3 h-full text-center cursor-pointer transition-all duration-300 hover:scale-[1.03] border backdrop-blur-md rounded-2xl group relative overflow-hidden",
        "min-w-[100px] min-h-[90px] md:min-w-[120px] bg-card/40 dark:bg-slate-900/40",
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