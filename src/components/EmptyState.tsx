import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
    action?: React.ReactNode; // Nova prop para componente customizado
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    actionLabel,
    onAction,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-500 ${className}`}>
            <div className="bg-muted/30 p-6 rounded-full mb-6 ring-1 ring-border shadow-sm">
                <Icon className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
                {description}
            </p>
            {action ? (
                action
            ) : (
                actionLabel && onAction && (
                    <Button onClick={onAction} size="lg" className="font-medium shadow-md hover:shadow-lg transition-all">
                        {actionLabel}
                    </Button>
                )
            )}
        </div>
    );
};
