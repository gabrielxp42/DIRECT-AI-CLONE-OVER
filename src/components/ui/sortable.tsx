import React, { createContext, useContext } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemContextProps {
    attributes: any;
    listeners: any;
    isDragging: boolean;
}

const SortableItemContext = createContext<SortableItemContextProps>({
    attributes: {},
    listeners: {},
    isDragging: false,
});

export function useSortableItem() {
    return useContext(SortableItemContext);
}

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
    className?: string;
}

export function SortableItem({ id, children, className }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : "auto",
        position: "relative" as const,
    };

    return (
        <SortableItemContext.Provider value={{ attributes, listeners, isDragging }}>
            <div ref={setNodeRef} style={style} className={className}>
                {children}
            </div>
        </SortableItemContext.Provider>
    );
}

export function SortableDragHandle({ children, className }: { children: React.ReactNode; className?: string }) {
    const { attributes, listeners } = useSortableItem();
    return (
        <div {...attributes} {...listeners} className={className} style={{ cursor: 'grab', touchAction: 'none' }}>
            {children}
        </div>
    );
}
