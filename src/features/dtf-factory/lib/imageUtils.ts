import { electronBridge } from './electronBridge';

// Helper para converter Data URI para Blob diretamente
export async function dataURItoBlob(dataURI: string): Promise<Blob> {
    try {
        const commaIndex = dataURI.indexOf(',');
        if (!dataURI.startsWith('data:') || commaIndex === -1) {
            throw new Error('Invalid Data URI');
        }

        const header = dataURI.substring(0, commaIndex);
        const dataPart = dataURI.substring(commaIndex + 1);
        const isBase64 = header.includes(';base64');
        const mimeMatch = /^data:([^;]+)/.exec(header);
        const mimeType = mimeMatch?.[1] || 'application/octet-stream';

        if (isBase64) {
            const binary = atob(dataPart);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            return new Blob([bytes], { type: mimeType });
        }

        const decoded = decodeURIComponent(dataPart);
        return new Blob([decoded], { type: mimeType });
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

    // =====================================================================
    // FAST PATH: Domínios bloqueados por CORS (Kie AI / aiquickdraw.com)
    // Sabemos que o fetch direto SEMPRE falha, então vamos direto ao proxy.
    // =====================================================================
    const isCorsBlocked = url.includes('aiquickdraw.com') || url.includes('tempfile.');

    if (isCorsBlocked) {
        console.log('[IMAGE-UTILS] 🚀 Domínio CORS-bloqueado detectado (Kie AI). Usando proxy direto...');
        
        // Tenta múltiplos proxies CORS públicos
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
        ];

        for (const proxyUrl of proxies) {
            try {
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    if (blob.size > 0) {
                        console.log(`[IMAGE-UTILS] ✅ Proxy funcionou! Blob size: ${blob.size}`);
                        return blob;
                    }
                }
            } catch (proxyErr) {
                console.warn('[IMAGE-UTILS] Proxy falhou, tentando próximo...', proxyErr);
            }
        }

        // Se todos os proxies falharam, tenta o Electron Bridge como último recurso
        try {
            const result = await electronBridge.downloadImage(url);
            if (result.success && result.data) {
                if (result.data.startsWith('data:')) {
                    return await dataURItoBlob(result.data);
                }
                const res = await fetch(result.data);
                return await res.blob();
            }
        } catch (_) { /* silencioso */ }

        throw new Error('Não foi possível baixar a imagem da IA. Todos os métodos falharam.');
    }

    // =====================================================================
    // NORMAL PATH: URLs normais (Supabase Storage, blob:, etc)
    // =====================================================================
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error ${response.status} ${response.statusText}`);
        return await response.blob();
    } catch (e) {
        console.warn(`⚠️ [IMAGE-UTILS] Browser fetch failed (Attempt ${6 - retries}/5). Error:`, e instanceof Error ? e.message : String(e));

        // Tenta via Electron Bridge como backup
        if (!url.startsWith('blob:')) {
            try {
                const result = await electronBridge.downloadImage(url);
                if (result.success && result.data) {
                    if (result.data.startsWith('data:')) {
                        return await dataURItoBlob(result.data);
                    }
                    const res = await fetch(result.data);
                    return await res.blob();
                }
            } catch (bridgeError) {
                console.warn('[IMAGE-UTILS] Bridge fallback failed');
            }
        }

        // Fallback final: Image Tag -> Canvas
        if (retries === 1) {
            try {
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

        if (retries <= 1) {
            throw new Error(`Failed to fetch image after multiple attempts.`);
        }

        await new Promise(r => setTimeout(r, delay));
        return fetchWithRetry(url, retries - 1, delay * 2);
    }
}
