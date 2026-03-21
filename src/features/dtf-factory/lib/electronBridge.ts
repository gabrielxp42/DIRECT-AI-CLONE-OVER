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
        
        // --- Show loading overlay while converting ---
        let overlay: HTMLDivElement | null = null;
        try {
            overlay = document.createElement('div');
            overlay.id = 'montador-loading-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:99999;
                background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                font-family:system-ui,sans-serif; color:white;
            `;
            const images = Array.isArray(imagePathOrPaths) ? imagePathOrPaths : [imagePathOrPaths];
            overlay.innerHTML = `
                <div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.15);border-top-color:#f97316;border-radius:50%;animation:spin 0.8s linear infinite"></div>
                <p style="margin-top:16px;font-size:15px;font-weight:600;color:rgba(255,255,255,0.9)">Preparando imagens para o Montador…</p>
                <p style="margin-top:4px;font-size:12px;color:rgba(255,255,255,0.45)">Convertendo ${images.length} arquivo${images.length > 1 ? 's' : ''}</p>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            `;
            document.body.appendChild(overlay);
        } catch (_) { /* overlay is cosmetic, ignore errors */ }

        try {
            const images = Array.isArray(imagePathOrPaths) ? imagePathOrPaths : [imagePathOrPaths];

            // --- Convert all blob: URLs to data: URLs so they survive navigation ---
            const persistentImages: string[] = [];
            for (const img of images) {
                if (img.startsWith('blob:')) {
                    try {
                        const res = await fetch(img);
                        const blob = await res.blob();
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        persistentImages.push(dataUrl);
                        console.log('[launchMontador] Converted blob to data URL, size:', Math.round(dataUrl.length / 1024), 'KB');
                    } catch (err) {
                        console.warn('[launchMontador] Failed to convert blob to data URL, skipping:', img, err);
                    }
                } else {
                    // Already a data: URL, http URL, or file path — keep as-is
                    persistentImages.push(img);
                }
            }

            if (persistentImages.length === 0) {
                if (overlay) {
                    overlay.innerHTML = `
                        <div style="background:rgba(220,38,38,0.2);padding:24px;border-radius:12px;border:1px solid rgba(220,38,38,0.5);text-align:center;max-width:400px">
                            <h3 style="color:#ef4444;margin:0 0 8px 0;font-size:18px">Erro ao preparar imagens</h3>
                            <p style="color:rgba(255,255,255,0.8);margin:0 0 16px 0;font-size:14px">Nenhuma imagem válida foi processada. Tente novamente.</p>
                            <button onclick="document.getElementById('montador-loading-overlay').remove()" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Fechar</button>
                        </div>
                    `;
                }
                console.error('[launchMontador] No valid images after conversion');
                return { success: false, error: 'Nenhuma imagem válida para enviar.' };
            }

            // Use window global instead of localStorage to avoid QuotaExceededError
            // (base64 images can be 10+ MB, localStorage limit is ~5MB)
            const bridgePayload = {
                type: 'VETORIZA_TO_MONTADOR',
                data: { images: persistentImages }
            };

            // Store in BOTH places: window global (primary) and localStorage (fallback for smaller payloads)
            (window as any).__OVERPIXEL_BRIDGE__ = bridgePayload;
            try {
                localStorage.setItem('OVERPIXEL_BRIDGE_STATE', JSON.stringify(bridgePayload));
            } catch (quotaErr) {
                console.warn('[launchMontador] localStorage quota exceeded, using window global only');
            }

            console.log('[launchMontador] Bridge payload set, navigating to /montador with', persistentImages.length, 'images');
            
            // Navigate via Custom Event so Layout.tsx can use React Router's useNavigate
            window.dispatchEvent(new CustomEvent('OVERPIXEL_NAVIGATE', { detail: '/montador' }));

            // Remove overlay after a short delay (Montador will take over rendering)
            // But we keep it longer here to ensure navigation happens if the route change is fast
            setTimeout(() => { if (overlay && overlay.parentNode) overlay.remove(); }, 2000);
            
            return { success: true };
        } catch (e: any) {
            console.error('[launchMontador] Error:', e);
            if (overlay) {
                overlay.innerHTML = `
                    <div style="background:rgba(220,38,38,0.2);padding:24px;border-radius:12px;border:1px solid rgba(220,38,38,0.5);text-align:center;max-width:400px">
                        <h3 style="color:#ef4444;margin:0 0 8px 0;font-size:18px">Erro Crítico</h3>
                        <p style="color:rgba(255,255,255,0.8);margin:0 0 16px 0;font-size:14px">${e.message || 'Falha ao iniciar na web'}</p>
                        <button onclick="document.getElementById('montador-loading-overlay').remove()" style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Fechar</button>
                    </div>
                `;
            } else {
                return { success: false, error: e.message || 'Falha ao iniciar na web' };
            }
            return { success: false, error: e.message };
        }
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
