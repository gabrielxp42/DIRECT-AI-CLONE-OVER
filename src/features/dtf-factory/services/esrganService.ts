// Serviço de Upscale via Real-ESRGAN (Cloud Function existente)

const CLOUD_FUNCTION_URL = 'https://us-central1-overpixel-hub.cloudfunctions.net/enhanceImage';
const TIMEOUT_MS = 7 * 60 * 1000; // 7 minutos

// Limite de 1.0M pixels (Para garantir que 8x não exceda 8K de largura/altura)
// 1000x1000 * 8 = 8000x8000 (Safe for Canvas/GPU)
const MAX_PIXELS = 1000000;

export interface EnhanceOptions {
    scale: 4 | 8;
    version?: 'nightmare-general' | 'xinttao-anime';
    faceEnhance?: boolean;
}

/**
 * Redimensiona uma imagem se exceder o limite de pixels da GPU
 */
async function resizeImageIfNeeded(imageDataUrl: string): Promise<{ dataUrl: string; width: number; height: number; wasResized: boolean }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const originalWidth = img.naturalWidth;
            const originalHeight = img.naturalHeight;
            const totalPixels = originalWidth * originalHeight;

            console.log(`📐 Dimensões da imagem: ${originalWidth}x${originalHeight} = ${(totalPixels / 1000000).toFixed(2)}M pixels`);

            // Se está dentro do limite, retornar original
            if (totalPixels <= MAX_PIXELS) {
                console.log('✅ Imagem dentro do limite, sem necessidade de resize');
                resolve({
                    dataUrl: imageDataUrl,
                    width: originalWidth,
                    height: originalHeight,
                    wasResized: false
                });
                return;
            }

            // Calcular novo tamanho mantendo aspect ratio
            const ratio = Math.sqrt(MAX_PIXELS / totalPixels);
            const newWidth = Math.floor(originalWidth * ratio);
            const newHeight = Math.floor(originalHeight * ratio);

            console.log(`📏 Redimensionando de ${originalWidth}x${originalHeight} para ${newWidth}x${newHeight}`);

            // Criar canvas e redimensionar
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;

            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Converter para base64
            const resizedDataUrl = canvas.toDataURL('image/png', 1.0);

            console.log(`✅ Resize concluído: ${newWidth}x${newHeight} = ${((newWidth * newHeight) / 1000000).toFixed(2)}M pixels`);

            resolve({
                dataUrl: resizedDataUrl,
                width: newWidth,
                height: newHeight,
                wasResized: true
            });
        };

        img.onerror = () => reject(new Error('Erro ao carregar imagem para resize'));
        img.src = imageDataUrl;
    });
}

export async function enhanceImage(
    imageDataUrl: string,
    options: EnhanceOptions
): Promise<string> {
    const { scale, version = 'nightmare-general', faceEnhance = false } = options;

    console.log('🚀 Iniciando upscale Real-ESRGAN...', { scale, version });

    // PRIMEIRO: Verificar se precisa resize
    const resized = await resizeImageIfNeeded(imageDataUrl);

    // LOG IMPORTANTE: Tamanho sendo enviado para o upscaler
    console.log(`📤 ENVIANDO PARA UPSCALE: ${resized.width}x${resized.height} = ${((resized.width * resized.height) / 1000000).toFixed(2)}M pixels`);

    if (resized.wasResized) {
        console.log(`⚠️ Imagem foi redimensionada para caber na GPU`);
    }

    // Controller para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(CLOUD_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: resized.dataUrl, // Usar imagem redimensionada
                scale,
                face_enhance: faceEnhance,
                version,
                tile: 0,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 504) {
                console.warn('⚠️ Recebido 504 Gateway Timeout. O servidor pode estar "frio". Tentando novamente em 3s...');
                // Retry once
                await new Promise(r => setTimeout(r, 3000));

                const response2 = await fetch(CLOUD_FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: resized.dataUrl,
                        scale,
                        face_enhance: faceEnhance,
                        version,
                        tile: 0,
                    }),
                    signal: controller.signal,
                });

                if (!response2.ok) {
                    const errorText = await response2.text().catch(() => 'Unknown error');
                    throw new Error(`Erro no upscale (HTTP ${response2.status}) após retentativa: ${errorText}`);
                }

                const result2 = await response2.json();
                if (!result2.success) throw new Error(result2.error || 'Erro no upscale');
                console.log('✅ Upscale concluído na retentativa:', result2.url);
                return result2.url;
            }

            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('❌ Erro no upscale:', response.status, errorText);

            // Tentar parsear erro JSON se disponível
            let errorMessage = `Erro no upscale (HTTP ${response.status})`;
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    errorMessage = errorJson.error;
                }
            } catch { }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (!result.success) {
            console.error('❌ Upscale falhou:', result.error);
            throw new Error(result.error || 'Erro no upscale');
        }

        console.log('✅ Upscale concluído:', result.url);
        return result.url;

    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error('Timeout no upscale (7 minutos excedidos)');
        }

        throw error;
    }
}

/**
 * Calcula se o upscale é necessário baseado no tamanho alvo vs. capacidade do 4K gerado.
 * 
 * Regra:
 *   - Alvo ≤ max4K do aspect ratio × 1.05 (5% tolerância) → retorna 0 (pular upscale)
 *   - Alvo > esse limite → retorna 8 (upscale 8x obrigatório)
 *
 * Limites de geração 4K por aspect ratio (lado maior em pixels, 300DPI):
 *   1:1      → 4096px  (~35cm)   → +5% = ~4301px (~36.4cm)
 *   9:16     → 6144px  (~52cm)   → +5% = ~6451px (~54.6cm)
 *   16:9     → 6144px  (~52cm)   → +5% = ~6451px
 *   4:3      → 5760px  (~48.8cm) → +5% = ~6048px
 *   3:4      → 5760px  (~48.8cm) → +5% = ~6048px
 *   auto/outros → tratado como retangular padrão (5120px +5% = 5376px)
 */
export function calculateUpscaleFactor(
    _sourceW: number,
    _sourceH: number,
    targetMaxPx: number | undefined,
    aspectRatio: string = '1:1'
): number {
    // Se não há alvo definido, não faz upscale
    if (!targetMaxPx || targetMaxPx <= 0) return 0;

    // LÓGICA UNIFICADA COM O PIPELINE:
    // O pipeline já decidiu se precisa de upscale baseado em CM.
    // Aqui nós apenas confirmamos.
    // Se o alvo for > 45cm (aprox 5315px), o upscale é necessário.
    
    const LIMIT_UPSCALING_PX = 5315; // 45cm @ 300dpi

    if (targetMaxPx > LIMIT_UPSCALING_PX) {
        console.log(`[ESRGAN] 🔭 Upscale 8x Triggered: Alvo=${targetMaxPx}px > Limite=${LIMIT_UPSCALING_PX}px (45cm)`);
        return 8;
    }

    console.log(`[ESRGAN] ⚡ Skip Upscale: Alvo=${targetMaxPx}px <= Limite=${LIMIT_UPSCALING_PX}px (45cm)`);
    return 0;
}

import { electronBridge } from '@dtf/lib/electronBridge';

// Converter URL para base64
export async function urlToBase64(url: string): Promise<string> {
    console.log('📥 [ESRGAN] Convertendo URL para base64:', url.substring(0, 100) + '...');

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao baixar imagem: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                console.log('✅ [ESRGAN] Imagem convertida para base64 com sucesso');
                resolve(reader.result as string);
            };
            reader.onerror = () => reject(new Error('Erro ao ler blob para conversão base64'));
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn('⚠️ [ESRGAN] Browser fetch failed, trying Electron Main process (CORS Bypass)...', e);
        try {
            const result = await electronBridge.downloadImage(url);
            if (result.success && result.data) {
                console.log('✅ [ESRGAN] Imagem baixada via Electron Bridge com sucesso');
                return result.data;
            }
            throw new Error(result.error || 'Electron download falhou sem erro específico');
        } catch (bridgeError) {
            console.error('❌ [ESRGAN] Falha fatal ao converter URL para base64:', bridgeError);
            throw bridgeError;
        }
    }
}

// Wrapper que inclui conversão de URL para base64
export async function enhanceImageFromUrl(
    imageUrl: string,
    options: EnhanceOptions
): Promise<string> {
    console.log('🚀 [ESRGAN] Iniciando enhanceImageFromUrl...');
    try {
        const base64 = await urlToBase64(imageUrl);
        console.log('🔄 [ESRGAN] Base64 obtido, chamando enhanceImage...');
        return await enhanceImage(base64, options);
    } catch (error) {
        console.error('❌ [ESRGAN] Erro em enhanceImageFromUrl:', error);
        throw error;
    }
}
