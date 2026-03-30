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
        
        // --- Show loading overlay ---
        let overlay: HTMLDivElement | null = null;
        try {
            overlay = document.createElement('div');
            overlay.id = 'montador-loading-overlay';
            overlay.style.cssText = `
                position:fixed; inset:0; z-index:99999;
                background:rgba(0,0,0,0.9); backdrop-filter:blur(12px);
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                font-family:system-ui,-apple-system,sans-serif; color:white;
                transition: opacity 0.5s ease-out;
            `;
            const images = Array.isArray(imagePathOrPaths) ? imagePathOrPaths : [imagePathOrPaths];
            overlay.innerHTML = `
                <div style="position:relative; width:80px; height:80px; margin-bottom:24px;">
                    <div style="position:absolute; inset:0; border:4px solid rgba(249,115,22,0.1); border-radius:50%;"></div>
                    <div id="loader-spinner" style="position:absolute; inset:0; border:4px solid transparent; border-top-color:#f97316; border-radius:50%; animation:spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite"></div>
                    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:900; color:#f97316;" id="loader-percent">0%</div>
                </div>
                <h3 style="margin:0; font-size:20px; font-weight:900; text-transform:uppercase; letter-spacing:0.1em; background:linear-gradient(to right, #fff, #f97316); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">Enviando Estampas</h3>
                <p id="loader-status" style="margin-top:8px; font-size:14px; font-weight:500; color:rgba(255,255,255,0.5)">Preparando ambiente...</p>
                <div style="margin-top:20px; width:200px; height:4px; bg:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; position:relative;">
                    <div id="loader-progress" style="position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(to right, #f97316, #fb923c); transition: width 0.3s ease-out;"></div>
                </div>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            `;
            document.body.appendChild(overlay);
        } catch (_) { }

        const updateProgress = (completed: number, total: number, statusText: string) => {
            if (!overlay) return;
            const percent = Math.round((completed / total) * 100);
            const percentEl = overlay.querySelector('#loader-percent');
            const statusEl = overlay.querySelector('#loader-status');
            const progressEl = overlay.querySelector('#loader-progress') as HTMLDivElement;
            if (percentEl) percentEl.textContent = `${percent}%`;
            if (statusEl) statusEl.textContent = statusText;
            if (progressEl) progressEl.style.width = `${percent}%`;
        };

        try {
            const images = Array.isArray(imagePathOrPaths) ? imagePathOrPaths : [imagePathOrPaths];
            const total = images.length;
            let completed = 0;

            // --- Process in Parallel for speed ---
            const persistentImages = await Promise.all(images.map(async (img, index) => {
                if (img.startsWith('blob:')) {
                    try {
                        updateProgress(completed, total, `Processando imagem ${index + 1} de ${total}...`);
                        const res = await fetch(img);
                        const blob = await res.blob();
                        const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                        completed++;
                        updateProgress(completed, total, `Imagem ${completed} pronta!`);
                        return dataUrl;
                    } catch (err) {
                        console.warn('[launchMontador] Failed to convert blob:', img, err);
                        completed++;
                        return null;
                    }
                }
                completed++;
                return img;
            }));

            const validImages = persistentImages.filter(Boolean) as string[];

            if (validImages.length === 0) {
                throw new Error('Nenhuma imagem válida para enviar.');
            }

            updateProgress(total, total, `Abrindo Montador...`);

            const orderId = queryParams.get('orderId');
            const orderNumber = queryParams.get('orderNumber');
            const itemId = queryParams.get('itemId');


            const bridgePayload = {
                type: 'VETORIZA_TO_MONTADOR',
                data: { 
                    images: validImages,
                    orderId,
                    orderNumber,
                    itemId
                }

            };


            (window as any).__OVERPIXEL_BRIDGE__ = bridgePayload;
            try {
                localStorage.setItem('OVERPIXEL_BRIDGE_STATE', JSON.stringify(bridgePayload));
            } catch (quotaErr) {
                console.warn('[launchMontador] localStorage quota exceeded');
            }

            // Navigate
            const baseUrl = '/montador';
            const params = new URLSearchParams();
            if (orderId) params.set('orderId', orderId);
            if (orderNumber) params.set('orderNumber', orderNumber);
            if (itemId) params.set('itemId', itemId);
            
            const targetUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

            console.log('[launchMontador] Bridge payload set with', validImages.length, 'images');
            
            // Disparar evento de append (se Montador já estiver aberto, ele apenas adiciona)
            window.dispatchEvent(new CustomEvent('OVERPIXEL_MONTADOR_APPEND', { detail: { images: validImages } }));
            
            // Também navegar (primeiro uso) – se já estiver na rota, o listener de append cuidará
            window.dispatchEvent(new CustomEvent('OVERPIXEL_NAVIGATE', { detail: targetUrl }));

            // --- Synchronized Handoff ---
            // Instead of a fixed timeout, we wait for the Montador to signal it's ready
            return new Promise<{ success: boolean }>((resolve) => {
                let resolved = false;

                const finish = (success: boolean) => {
                    if (resolved) return;
                    resolved = true;
                    if (overlay) {
                        overlay.style.opacity = '0';
                        setTimeout(() => { if (overlay?.parentNode) overlay.remove(); }, 500);
                    }
                    resolve({ success });
                };

                // Listen for ready signal from MontadorInterface.tsx
                window.addEventListener('OVERPIXEL_MONTADOR_READY', () => {
                    console.log('[launchMontador] Montador signaled READY!');
                    finish(true);
                }, { once: true });

                // Safety timeout (in case Montador fails to signal)
                setTimeout(() => {
                    if (!resolved) {
                        console.warn('[launchMontador] Montador ready signal timed out, closing overlay anyway.');
                        finish(true);
                    }
                }, 8000); // 8 seconds is plenty for even heavy images
            });


        } catch (e: any) {
            console.error('[launchMontador] Error:', e);
            if (overlay) {
                overlay.innerHTML = `
                    <div style="background:rgba(220,38,38,0.1); padding:32px; border-radius:24px; border:1px solid rgba(220,38,38,0.3); text-align:center; max-width:400px; backdrop-filter:blur(20px);">
                        <div style="width:50px; height:50px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg>
                        </div>
                        <h3 style="color:#ef4444; margin:0 0 12px 0; font-size:20px; font-weight:900; text-transform:uppercase;">ERRO NA TRANSFERÊNCIA</h3>
                        <p style="color:rgba(255,255,255,0.7); margin:0 0 24px 0; font-size:14px; font-weight:500; line-height:1.5;">${e.message || 'Falha desconhecida ao preparar os arquivos.'}</p>
                        <button onclick="document.getElementById('montador-loading-overlay').remove()" style="width:100%; background:white; color:black; border:none; padding:12px; border-radius:12px; cursor:pointer; font-weight:800; font-size:12px; text-transform:uppercase; letter-spacing:0.1em; transition:all 0.2s;">Fechar e Tentar Novamente</button>
                    </div>
                `;
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
