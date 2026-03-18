

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface WidgetConfig {
    id: string;
    prompt: string;
    aspectRatio: string;
    garmentMode: 'black' | 'white' | 'color';
    halftonePreset: string;
    promptStyle: string;
    edgeContraction: number;
    widthCm: number;
    heightCm: number;
    createdAt: number;
    uploadedImages: string[]; // Base64 Data URLs
    externalStatus?: {
        step: string;
        progress: number;
        message: string;
        error?: string;
        imageUrl?: string;
        savedPath?: string;
    };
}



interface WidgetContextType {
    widgets: WidgetConfig[];
    addWidget: (aspectRatio: string) => string;
    removeWidget: (id: string) => void;
    updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
    duplicateWidget: (id: string) => void;
    clearAllWidgets: () => void;
    triggerAllGenerations: () => void;
    globalGenerationTimestamp: number;
    setWidgetGenerating: (id: string, isGenerating: boolean) => void;
    isAnyGenerating: boolean;
    // API Desktop Only - Mocked for Web
    apiProcessingWidgetId: string | null;
    setApiProcessingWidgetId: (id: string | null) => void;
}

const WidgetContext = createContext<WidgetContextType>({
    widgets: [],
    addWidget: () => '',
    removeWidget: () => { },
    updateWidget: () => { },
    duplicateWidget: () => { },
    clearAllWidgets: () => { },
    triggerAllGenerations: () => { },
    globalGenerationTimestamp: 0,
    setWidgetGenerating: () => { },
    isAnyGenerating: false,
    apiProcessingWidgetId: null,
    setApiProcessingWidgetId: () => { },
});

export const useWidgets = () => useContext(WidgetContext);

function generateId(): string {
    return `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function WidgetProvider({ children }: { children: React.ReactNode }) {
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [globalGenerationTimestamp, setGlobalGenerationTimestamp] = useState(0);
    const [generatingWidgets, setGeneratingWidgets] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false); // RESTAURADO
    
    // Estado para controle de qual widget está sendo processado pela API externa (Context Mode)
    // No Web, isso não é usado, mas mantemos o estado para compatibilidade de tipos
    const [apiProcessingWidgetId, setApiProcessingWidgetId] = useState<string | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('dtf_widgets');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Ao recarregar, limpar qualquer externalStatus (imagem gerada da API)
                    // para garantir que o widget inicie no modo de configuração (input)
                    const cleanedWidgets = parsed.map(w => ({
                        ...w,
                        externalStatus: undefined,
                        uploadedImages: w.uploadedImages || [] // Garante que é um array, mesmo que vazio pelo localStorage
                    }));
                    setWidgets(cleanedWidgets);
                }
            } catch (e) {
                console.error('Failed to parse saved widgets', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever widgets change
    useEffect(() => {
        if (isLoaded) {
            // Remove uploadedImages (which contain large Base64 URLs) before saving to local storage
            // to prevent "QuotaExceededError".
            // Também removemos externalStatus para não salvar imagens finais (API) acidentalmente.
            const widgetsToSave = widgets.map(w => ({ 
                ...w, 
                uploadedImages: [],
                externalStatus: undefined 
            }));
            localStorage.setItem('dtf_widgets', JSON.stringify(widgetsToSave));
        }
    }, [widgets, isLoaded]);

    const addWidget = useCallback((aspectRatio: string) => {
        const id = generateId();
        const newWidget: WidgetConfig = {
            id,
            prompt: '',
            aspectRatio,
            garmentMode: 'black',
            halftonePreset: 'halftone_medio_preto',
            promptStyle: 'none',
            edgeContraction: 2,
            widthCm: 0,
            heightCm: 0,
            createdAt: Date.now(),
            uploadedImages: [],
        };
        setWidgets(prev => [...prev, newWidget]);
        return id;
    }, []);

    const removeWidget = useCallback((id: string) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
        setGeneratingWidgets(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const clearAllWidgets = useCallback(() => {
        setWidgets([]);
        setGeneratingWidgets(new Set());
    }, []);

    const updateWidget = useCallback((id: string, updates: Partial<WidgetConfig>) => {
        setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    }, []);

    const duplicateWidget = useCallback((originalId: string) => {
        setWidgets(prev => {
            const original = prev.find(w => w.id === originalId);
            if (!original) return prev;

            const newId = generateId();
            const newWidget: WidgetConfig = {
                ...original,
                id: newId,
                createdAt: Date.now()
            };

            // Insert after the original widget
            const index = prev.findIndex(w => w.id === originalId);
            const newWidgets = [...prev];
            newWidgets.splice(index + 1, 0, newWidget);
            return newWidgets;
        });
    }, []);

    const triggerAllGenerations = useCallback(() => {
        setGlobalGenerationTimestamp(Date.now());
    }, []);

    const setWidgetGenerating = useCallback((id: string, isGenerating: boolean) => {
        setGeneratingWidgets(prev => {
            const next = new Set(prev);
            if (isGenerating) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }, []);

    return (
        <WidgetContext.Provider value={{
            widgets,
            addWidget,
            removeWidget,
            updateWidget,
            duplicateWidget,
            clearAllWidgets,
            triggerAllGenerations,
            globalGenerationTimestamp,
            setWidgetGenerating,
            isAnyGenerating: generatingWidgets.size > 0,
            apiProcessingWidgetId,
            setApiProcessingWidgetId
        }}>
            {children}
        </WidgetContext.Provider>
    );
}
