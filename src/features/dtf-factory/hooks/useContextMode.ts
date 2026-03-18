

import { useState, useEffect } from 'react';
import { electronBridge, ContextModeInfo } from '@dtf/lib/electronBridge';

interface UseContextModeResult {
    isReady: boolean;
    isContextMode: boolean;
    isAutoMode: boolean; // Novo
    contextImages: string[]; // Caminhos dos arquivos
    contextFolder: string | null;
    savePath: string;
    loadedImages: { data: string; filename: string }[]; // Imagens carregadas como base64
    isWidgetMode: boolean;
}

export function useContextMode(): UseContextModeResult {
    const [isReady, setIsReady] = useState(false);
    const [contextInfo, setContextInfo] = useState<ContextModeInfo & { isAutoMode?: boolean }>({ // Atualizar tipo local se necessário ou assumir extension
        isContextMode: false,
        images: [],
        folder: null,
        savePath: 'Downloads'
    });
    const [loadedImages, setLoadedImages] = useState<{ data: string; filename: string }[]>([]);
    const [isWidgetMode, setIsWidgetMode] = useState(false);

    useEffect(() => {
        async function init() {
            try {
                // Verificar se está em modo widget via URL (passado pelo Electron)
                const params = new URLSearchParams(window.location.search);
                const widgetModeParam = params.get('widgetMode') === 'true';
                setIsWidgetMode(widgetModeParam);

                // Obter informações do modo contexto do Electron
                const info = await electronBridge.getContextMode();
                setContextInfo(info as any); // cast para aceitar isAutoMode se type definition estiver desatualizada

                // ... (resto do code fica igual, mas já que estamos replaces, mantemos)
                console.log('Context mode info:', info);

                // Se tem imagens no contexto, carregá-las
                if (info.isContextMode && info.images.length > 0) {
                    const loaded: { data: string; filename: string }[] = [];

                    for (const imagePath of info.images) {
                        const result = await electronBridge.readImageFile(imagePath);
                        if (result.success && result.data && result.filename) {
                            loaded.push({ data: result.data, filename: result.filename });
                        }
                    }

                    setLoadedImages(loaded);
                    console.log('Loaded images:', loaded.length);
                }

                setIsReady(true);

                // Ouvir atualizações de contexto (segunda instância)
                electronBridge.onContextUpdate(async (data: any) => {
                    console.log('Context Update Recebido:', data);

                    // Atualizar info
                    const newInfo = {
                        isContextMode: true,
                        isAutoMode: data.auto || false,
                        images: data.images || [],
                        folder: data.folder || null,
                        savePath: data.savePath || 'Downloads'
                    };
                    setContextInfo(newInfo as any);

                    // Carregar novas imagens
                    if (newInfo.images.length > 0) {
                        const loaded: { data: string; filename: string }[] = [];
                        for (const imagePath of newInfo.images) {
                            const result = await electronBridge.readImageFile(imagePath);
                            if (result.success && result.data && result.filename) {
                                loaded.push({ data: result.data, filename: result.filename });
                            }
                        }

                        // Atualizar loadedImages com as NOVAS
                        setLoadedImages(loaded);
                    }
                });

                // Ouvir mudança de modo (Widget <-> Desktop) SEM recarregar
                electronBridge.onModeUpdate((mode: 'widget' | 'desktop') => {
                    console.log('Mode updated to:', mode);
                    setIsWidgetMode(mode === 'widget');
                });

            } catch (error) {
                console.error('Erro ao obter modo contexto:', error);
                setIsReady(true);
            }
        }

        init();
    }, []);

    return {
        isReady,
        isContextMode: contextInfo.isContextMode,
        isAutoMode: (contextInfo as any).isAutoMode || false, // Passar valor
        contextImages: contextInfo.images,
        contextFolder: contextInfo.folder,
        savePath: contextInfo.savePath,
        loadedImages,
        isWidgetMode
    };
}
