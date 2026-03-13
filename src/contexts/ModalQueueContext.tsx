import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * Modal Queue System
 * 
 * Prevents multiple auto-opening modals from colliding.
 * Each modal registers with a priority (lower = higher priority).
 * Only the highest-priority registered modal is "allowed" to display.
 * 
 * Priority Map:
 *   1 - GiftPlanModal (Pro/WhatsApp gift)
 *   2 - GiftVetorizaModal (Vetoriza AI gift)
 *   3 - GiftUnlockModal (Branding unlock)
 *   5 - ShippingFeatureModal (Feature announcement)
 *  10 - TutorialGuide (Welcome/page tours)
 */

interface ModalQueueEntry {
    id: string;
    priority: number;
}

interface ModalQueueContextType {
    /** Register a modal that wants to open. Returns a deregister function. */
    register: (id: string, priority: number) => void;
    /** Deregister a modal (call when it closes or unmounts). */
    deregister: (id: string) => void;
    /** Check if this modal is currently allowed to display (it's the highest priority). */
    isAllowed: (id: string) => boolean;
    /** List of currently registered modal IDs (for debugging). */
    activeModals: string[];
}

const ModalQueueContext = createContext<ModalQueueContextType>({
    register: () => {},
    deregister: () => {},
    isAllowed: () => true,
    activeModals: [],
});

export const useModalQueue = () => useContext(ModalQueueContext);

export const ModalQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [queue, setQueue] = useState<ModalQueueEntry[]>([]);

    const register = useCallback((id: string, priority: number) => {
        setQueue(prev => {
            // Don't duplicate
            if (prev.some(m => m.id === id)) return prev;
            console.log(`[ModalQueue] ✅ Registered: "${id}" (priority ${priority})`);
            return [...prev, { id, priority }].sort((a, b) => a.priority - b.priority);
        });
    }, []);

    const deregister = useCallback((id: string) => {
        setQueue(prev => {
            const filtered = prev.filter(m => m.id !== id);
            if (filtered.length !== prev.length) {
                console.log(`[ModalQueue] ❌ Deregistered: "${id}". Remaining: [${filtered.map(m => m.id).join(', ')}]`);
            }
            return filtered;
        });
    }, []);

    const isAllowed = useCallback((id: string) => {
        if (queue.length === 0) return true;
        // The first item in the sorted queue is the highest priority (lowest number)
        return queue[0].id === id;
    }, [queue]);

    const activeModals = useMemo(() => queue.map(m => m.id), [queue]);

    return (
        <ModalQueueContext.Provider value={{ register, deregister, isAllowed, activeModals }}>
            {children}
        </ModalQueueContext.Provider>
    );
};
