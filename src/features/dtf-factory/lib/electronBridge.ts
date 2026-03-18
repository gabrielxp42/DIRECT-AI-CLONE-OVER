// Tipagem para a API do Electron exposta via preload
declare global {
    interface Window {
        electronAPI?: {
            saveImage: (buffer: ArrayBuffer, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
            getSavePath: () => Promise<string>;
            selectSavePath: () => Promise<string | null>;
            openFolder: () => Promise<void>;
            showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            resetSavePath: () => Promise<string>;
            // Novas funções para modo contexto
            getContextMode: () => Promise<{
                isContextMode: boolean;
                images: string[];
                folder: string | null;
                savePath: string;
            }>;
            readImageFile: (filePath: string) => Promise<{
                success: boolean;
                data?: string;
                filename?: string;
                folder?: string;
                error?: string;
                recoveredPath?: string;
            }>;
            scanOriginalsFolder: () => Promise<{ success: boolean; files?: { filename: string; path: string; mtime: Date }[]; error?: string }>;
            closeApp: () => Promise<void>;
            toggleWidgetMode: (targetMode: 'widget' | 'desktop') => Promise<void>;
            getRecentDownloads: () => Promise<{ success: boolean; files?: string[]; error?: string }>;
            onContextUpdate: (callback: (data: any) => void) => void;
            launchMontador: (imagePathOrPaths: string | string[]) => Promise<{ success: boolean; error?: string }>;
            onApiGenerateRequest: (callback: (data: any) => void) => void;
            sendApiGenerateResponse: (requestId: string, result: { success: boolean, path?: string, error?: string }) => Promise<void>;
        };
    }
}

export interface ContextModeInfo {
    isContextMode: boolean;
    isAutoMode?: boolean;
    images: string[];
    folder: string | null;
    savePath: string;
}

export interface ElectronBridge {
    isElectron: boolean;
    saveImage: (buffer: ArrayBuffer, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getSavePath: () => Promise<string>;
    selectSavePath: () => Promise<string | null>;
    openFolder: () => Promise<void>;
    showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    resetSavePath: () => Promise<string>;
    getContextMode: () => Promise<ContextModeInfo>;
    readImageFile: (filePath: string) => Promise<{ success: boolean; data?: string; filename?: string; folder?: string; error?: string; recoveredPath?: string }>;
    closeApp: () => Promise<void>;
    toggleWidgetMode: (targetMode: 'widget' | 'desktop') => Promise<void>;
    getRecentDownloads: () => Promise<{ success: boolean; files?: string[]; error?: string }>;
    onContextUpdate: (callback: (data: ContextModeInfo & { auto?: boolean }) => void) => void;
    // Window controls
    minimizeWindow: () => Promise<void>;
    minimizeToTray: () => Promise<void>;
    // Prompt history
    savePromptHistory: (prompt: string) => Promise<{ success: boolean }>;
    getPromptHistory: () => Promise<{ success: boolean; history: string[] }>;
    // Notifications
    showNotification: (title: string, body: string) => Promise<{ success: boolean }>;
    isWindowFocused: () => Promise<boolean>;
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
    downloadImage: (url: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    setGenerationStatus: (isActive: boolean) => Promise<void>;
    onModeUpdate: (callback: (mode: 'widget' | 'desktop') => void) => void;

    // Gallery
    scanOriginalsFolder: () => Promise<{ success: boolean; files?: { filename: string; path: string; mtime: Date }[]; error?: string }>;

    // Montador Rápido
    launchMontador: (imagePathOrPaths: string | string[]) => Promise<{ success: boolean; error?: string }>;

    // API Externa
    onApiGenerateRequest: (callback: (data: any) => void) => void;
    sendApiGenerateResponse: (requestId: string, result: { success: boolean, path?: string, error?: string }) => Promise<void>;
}

export const electronBridge: ElectronBridge = {
    isElectron: typeof window !== 'undefined' && !!window.electronAPI,

    downloadImage: async (url) => {
        if (window.electronAPI && (window.electronAPI as any).downloadImage) {
            return (window.electronAPI as any).downloadImage(url);
        }
        // Fallback para web: fetch normal (assumindo que CORS permite ou falha)
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const blob = await res.blob();
            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onload = () => resolve({ success: true, data: reader.result as string });
                reader.onerror = () => resolve({ success: false, error: 'Read error' });
                reader.readAsDataURL(blob);
            });
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    saveImage: async (buffer, filename) => {
        if (window.electronAPI) {
            return window.electronAPI.saveImage(buffer, filename);
        }
        // Fallback para navegador: download
        const blob = new Blob([buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, path: filename };
    },

    getSavePath: async () => {
        if (window.electronAPI) {
            return window.electronAPI.getSavePath();
        }
        return 'Downloads';
    },

    selectSavePath: async () => {
        if (window.electronAPI) {
            return window.electronAPI.selectSavePath();
        }
        return null;
    },

    openFolder: async () => {
        if (window.electronAPI) {
            return window.electronAPI.openFolder();
        }
    },

    showItemInFolder: async (filePath) => {
        if (window.electronAPI && (window.electronAPI as any).showItemInFolder) {
            return (window.electronAPI as any).showItemInFolder(filePath);
        }
        return { success: false, error: 'Not supported in web' };
    },

    resetSavePath: async () => {
        if (window.electronAPI) {
            return window.electronAPI.resetSavePath();
        }
        return 'Downloads';
    },

    // === NOVAS FUNÇÕES PARA MODO CONTEXTO ===

    getContextMode: async () => {
        if (window.electronAPI) {
            return window.electronAPI.getContextMode();
        }
        return {
            isContextMode: false,
            images: [],
            folder: null,
            savePath: 'Downloads'
        };
    },

    readImageFile: async (filePath: string) => {
        if (window.electronAPI) {
            return window.electronAPI.readImageFile(filePath);
        }
        return { success: false, error: 'Não disponível na web' };
    },

    scanOriginalsFolder: async () => {
        if (window.electronAPI && (window.electronAPI as any).scanOriginalsFolder) {
            return (window.electronAPI as any).scanOriginalsFolder();
        }
        return { success: false, error: 'Not supported in web' };
    },

    closeApp: async () => {
        if (window.electronAPI) {
            return window.electronAPI.closeApp();
        }
        console.log('Fechar app (mock) - Não faz nada na web');
    },

    toggleWidgetMode: async (targetMode: 'widget' | 'desktop') => {
        if (window.electronAPI && window.electronAPI.toggleWidgetMode) {
            return window.electronAPI.toggleWidgetMode(targetMode);
        }
        // alert('ERRO: App não detectou Electron ou função ausente. (Mock Mode)'); // Removido para Web
        console.log('Alternar widget mode (mock):', targetMode);
    },

    getRecentDownloads: async () => {
        if (window.electronAPI && window.electronAPI.getRecentDownloads) {
            return window.electronAPI.getRecentDownloads();
        }
        return { success: true, files: ['mock_image_1.png', 'mock_image_2.jpg'] };
    },

    onContextUpdate: (callback) => {
        if (window.electronAPI && window.electronAPI.onContextUpdate) {
            window.electronAPI.onContextUpdate(callback);
        } else {
            console.log('onContextUpdate não disponível (mock)');
        }
    },

    // === WINDOW CONTROLS ===
    minimizeWindow: async () => {
        if (window.electronAPI && (window.electronAPI as any).minimizeWindow) {
            return (window.electronAPI as any).minimizeWindow();
        }
    },

    minimizeToTray: async () => {
        if (window.electronAPI && (window.electronAPI as any).minimizeToTray) {
            return (window.electronAPI as any).minimizeToTray();
        }
    },

    // === PROMPT HISTORY ===
    savePromptHistory: async (prompt: string) => {
        if (window.electronAPI && (window.electronAPI as any).savePromptHistory) {
            return (window.electronAPI as any).savePromptHistory(prompt);
        }
        // Fallback localStorage
        try {
            const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
            const filtered = history.filter((p: string) => p !== prompt);
            filtered.unshift(prompt);
            localStorage.setItem('promptHistory', JSON.stringify(filtered.slice(0, 20)));
            return { success: true };
        } catch {
            return { success: false };
        }
    },

    getPromptHistory: async () => {
        if (window.electronAPI && (window.electronAPI as any).getPromptHistory) {
            return (window.electronAPI as any).getPromptHistory();
        }
        // Fallback localStorage
        try {
            const history = JSON.parse(localStorage.getItem('promptHistory') || '[]');
            return { success: true, history };
        } catch {
            return { success: true, history: [] };
        }
    },

    // === NOTIFICATIONS ===
    showNotification: async (title: string, body: string) => {
        if (window.electronAPI && (window.electronAPI as any).showNotification) {
            return (window.electronAPI as any).showNotification(title, body);
        }
        // Fallback Web Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
            return { success: true };
        }
        return { success: false };
    },

    isWindowFocused: async () => {
        if (window.electronAPI && (window.electronAPI as any).isWindowFocused) {
            return (window.electronAPI as any).isWindowFocused();
        }
        return document.hasFocus();
    },

    openExternal: async (url: string) => {
        if (window.electronAPI && (window.electronAPI as any).openExternal) {
            return (window.electronAPI as any).openExternal(url);
        }
        // Fallback for web: open in new tab
        window.open(url, '_blank');
        return { success: true };
    },

    setGenerationStatus: async (isActive: boolean) => {
        if (window.electronAPI && (window.electronAPI as any).setGenerationStatus) {
            return (window.electronAPI as any).setGenerationStatus(isActive);
        }
    },

    onModeUpdate: (callback: (mode: 'widget' | 'desktop') => void) => {
        if (window.electronAPI && (window.electronAPI as any).onModeUpdate) {
            (window.electronAPI as any).onModeUpdate(callback);
        }
    },

    // === MONTADOR RÁPIDO ===
    launchMontador: async (imagePathOrPaths: string | string[]) => {
        if (window.electronAPI && (window.electronAPI as any).launchMontador) {
            return (window.electronAPI as any).launchMontador(imagePathOrPaths);
        }
        return { success: false, error: 'Não disponível na web' };
    },

    // === API EXTERNA ===
    onApiGenerateRequest: (callback) => {
        if (window.electronAPI && window.electronAPI.onApiGenerateRequest) {
            // Remove previous listeners to avoid duplication if called multiple times by React effects
            // Note: Since electronAPI is a bridge, we rely on the implementation in preload/main. 
            // Ideally we should have an explicit 'off' method.
            window.electronAPI.onApiGenerateRequest(callback);
        }
    },
    sendApiGenerateResponse: async (requestId, result) => {
        if (window.electronAPI && window.electronAPI.sendApiGenerateResponse) {
            return window.electronAPI.sendApiGenerateResponse(requestId, result);
        }
        return Promise.resolve();
    }
};
