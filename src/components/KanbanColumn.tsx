import React, { memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
    id: string;
    title: string;
    color: string;
    count: number;
    children: React.ReactNode;
}

export const KanbanColumn = memo(function KanbanColumn({ id, title, color, count, children }: KanbanColumnProps) {
    return (
        <div className="flex flex-col gap-4 bg-muted/30 rounded-xl border p-4 min-h-[500px]">
            <div className={cn("flex items-center justify-between px-2 py-1 rounded-md border text-xs font-bold uppercase tracking-wider", color)}>
                <span>{title}</span>
                <span className="bg-background/50 px-2 py-0.5 rounded-full">{count}</span>
            </div>
            <Droppable droppableId={id}>
                {(provided, snapshot) => (
                    <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                            "flex-1 flex flex-col gap-3 rounded-lg border-2",
                            snapshot.isDraggingOver ? "bg-muted/30 border-primary/50" : "border-transparent"
                        )}
                    >
                        {children}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    );
});
