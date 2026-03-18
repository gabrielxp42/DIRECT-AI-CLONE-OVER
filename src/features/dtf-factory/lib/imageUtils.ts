import { electronBridge } from './electronBridge';

// Helper para converter Data URI para Blob diretamente
export async function dataURItoBlob(dataURI: string): Promise<Blob> {
    try {
        const response = await fetch(dataURI);
        return await response.blob();
    } catch (e) {
        console.error('Error converting Data URI to Blob:', e);
        throw new Error('Invalid Data URI');
    }
}

// Baixar imagem como blob (com Retry e fallback para Electron Main Process e Image Tag)
export async function fetchWithRetry(url: string, retries = 5, delay = 1000): Promise<Blob> {
    // 1. Check for Data URI (no fetch needed)
    if (url.startsWith('data:')) {
        return await dataURItoBlob(url);
    }

    // 1.5. Check for local file path (Windows C:\ or Unix /)
    if (!url.startsWith('http') && !url.startsWith('blob:') && !url.startsWith('data:')) {
        try {
            console.log('[IMAGE-UTILS] Detecado caminho local, usando electronBridge.readImageFile:', url);
            const result = await electronBridge.readImageFile(url);
            if (result.success && result.data) {
                return await dataURItoBlob(result.data);
            }
            console.warn('[IMAGE-UTILS] Bridge failed to read local file', result.error);
        } catch (e) {
            console.warn('[IMAGE-UTILS] Erro chamando readImageFile:', e);
        }
    }

    // console.log(`[IMAGE-UTILS] Fetching blob (attempts left: ${retries}):`, url.length > 50 ? url.substring(0, 50) + '...' : url);

    try {
        // 2. Tenta fetch normal do navegador
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status} ${response.statusText}`);
        return await response.blob();
    } catch (e) {
        console.warn(`⚠️ [IMAGE-UTILS] Browser fetch failed (Attempt ${6 - retries}/5). Error:`, e instanceof Error ? e.message : String(e));

        // 3. Se ainda tem retries, tenta via Electron Bridge como backup imediato
        try {
            console.log('[IMAGE-UTILS] Trying Electron Bridge fallback...');
            const result = await electronBridge.downloadImage(url);
            if (result.success && result.data) {
                // Se o bridge retornou um data URI, converte direto sem fetch
                if (result.data.startsWith('data:')) {
                    return await dataURItoBlob(result.data);
                }
                const res = await fetch(result.data);
                return await res.blob();
            }
        } catch (bridgeError) {
            console.warn('[IMAGE-UTILS] Bridge fallback also failed (error suppressed to avoid spam)');
        }

        // 4. Fallback final: Image Tag -> Canvas (se bridge falhou e browser fetch falhou)
        if (retries === 1) {
            try {
                console.log('[IMAGE-UTILS] Trying Last Resort: Image Tag fallback...');
                return await new Promise<Blob>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) { reject(new Error('Canvas context failed')); return; }
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob(blob => {
                            if (blob) resolve(blob);
                            else reject(new Error('Canvas toBlob failed'));
                        }, 'image/png');
                    };
                    img.onerror = () => reject(new Error('Image Tag load failed'));
                    img.src = url;
                });
            } catch (imgError) {
                console.warn('[IMAGE-UTILS] Image Tag fallback also failed');
            }
        }

        // Se falhou tudo e não tem mais retries, desiste
        if (retries <= 1) {
            throw new Error(`Failed to fetch image after multiple attempts.`);
        }

        // Backoff exponencial
        // console.log(`[IMAGE-UTILS] Waiting ${delay}ms before next retry...`);
        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(url, retries - 1, delay * 2);
    }
}
