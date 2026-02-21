import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundTasks, BackgroundTask } from '@/hooks/useBackgroundTasks';
import {
    CheckCircle2,
    Circle,
    XCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    FileText,
    MessageSquare,
    X,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export const TaskDock = () => {
    const { tasks, removeTask } = useBackgroundTasks();
    const [isExpanded, setIsExpanded] = useState(true);
    const isMobile = useIsMobile();

    if (tasks.length === 0) return null;

    return (
        <div className={cn(
            "fixed z-[60] flex flex-col gap-2 transition-all duration-300",
            isMobile
                ? "bottom-20 left-4 right-4" // Above mobile bottom nav
                : "bottom-4 left-4 w-80"      // Desktop bottom left
        )}>
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Tarefas em Segundo Plano ({tasks.length})
                </span>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {tasks.map((task) => (
                            <TaskItem key={task.id} task={task} onRemove={() => removeTask(task.id)} />
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const TaskItem = ({ task, onRemove }: { task: BackgroundTask, onRemove: () => void }) => {
    const isCompleted = task.status === 'completed';
    const isError = task.status === 'error';

    useEffect(() => {
        if (isCompleted) {
            const timer = setTimeout(() => {
                onRemove();
            }, 4000); // 4 seconds delay before auto-removing
            return () => clearTimeout(timer);
        }
    }, [isCompleted, onRemove]);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{
                opacity: 0,
                x: -100,
                scale: 0.9,
                transition: {
                    duration: 0.5,
                    ease: "circOut"
                }
            }}
            drag="x"
            dragConstraints={{ left: -100, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
                if (info.offset.x < -60) {
                    onRemove();
                }
            }}
            className={cn(
                "relative group overflow-hidden rounded-xl border p-3 shadow-lg backdrop-blur-md transition-all touch-none cursor-grab active:cursor-grabbing",
                isCompleted
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : isError
                        ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                        : "bg-background/80 border-border text-foreground"
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-1">
                    {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : isError ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate pr-6">{task.title}</h4>
                    <p className="text-[10px] text-muted-foreground truncate mb-2">
                        {task.description || (isCompleted ? 'Tarefa concluída' : isError ? task.error : 'Processando...')}
                    </p>

                    {/* Mini Progress Bar */}
                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden mb-2">
                        <motion.div
                            className={cn(
                                "h-full transition-all",
                                isCompleted ? "bg-green-500" : isError ? "bg-red-500" : "bg-primary"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${task.progress}%` }}
                        />
                    </div>

                    {/* Step Visualization (Only if multiple steps) */}
                    <div className="flex gap-1.5 flex-wrap">
                        {task.steps.map((step) => (
                            <div key={step.id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                                {step.status === 'completed' ? (
                                    <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                                ) : step.status === 'error' ? (
                                    <XCircle className="h-2.5 w-2.5 text-red-500" />
                                ) : step.status === 'loading' ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                                ) : (
                                    <Circle className="h-2.5 w-2.5 text-muted-foreground" />
                                )}
                                <span className="text-[8px] font-medium leading-none">{step.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={onRemove}
                    className="absolute top-2 right-2 p-1 hover:bg-muted rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Shine effect for completed task */}
            {isCompleted && (
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
                    animate={{ x: ['100%', '-100%'] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
            )}
        </motion.div>
    );
};
