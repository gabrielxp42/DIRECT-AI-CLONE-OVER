
import { setPngDpi } from './halftoneService';

export interface AntiTransparencySettings {
    mode: 'magicWand' | 'chromaKey';
    backgroundColor: string; // Hex
    chromaTolerance: number;
    shadowTolerance: number;
    erosion: number;
    magicPoints: { x: number, y: number }[];
    alphaThreshold: number;
    softness: number;
}

const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
}

export const runAntiTransparencyProcessing = (
    sourceData: Uint8ClampedArray,
    width: number,
    height: number,
    settingsToUse: AntiTransparencySettings,
    pointScale: number
): ImageData => {
    const outputImageData = new ImageData(width, height);
    const outputData = outputImageData.data;

    const bgColor = hexToRgb(settingsToUse.backgroundColor || '#00ff00');
    const erosion = settingsToUse.erosion || 0;
    const threshold = settingsToUse.alphaThreshold || 10;
    const mode = settingsToUse.mode;
    const chromaTolerance = settingsToUse.chromaTolerance || 50;
    const shadowTolerance = settingsToUse.shadowTolerance || 0;
    const softness = settingsToUse.softness || 0;
    const rawMagicPoints = settingsToUse.magicPoints || [];

    // Escalar pontos mágicos para resolução alvo
    const magicPoints = rawMagicPoints.map(p => ({
        x: Math.round(p.x * pointScale),
        y: Math.round(p.y * pointScale)
    }));

    let finalAlpha = new Uint8Array(width * height);

    if (mode === 'magicWand' && magicPoints.length > 0) {
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const r = sourceData[idx];
            const g = sourceData[idx + 1];
            const b = sourceData[idx + 2];
            const a = sourceData[idx + 3];

            if (a <= threshold) {
                finalAlpha[i] = 0;
                continue;
            }

            finalAlpha[i] = a; 

            // Lógica de Softness
            if (softness > 0) {
                const bgColor_raw = hexToRgb(settingsToUse.backgroundColor || '#000000');
                const dr = r - bgColor_raw.r;
                const dg = g - bgColor_raw.g;
                const db = b - bgColor_raw.b;
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);

                if (dist < chromaTolerance) {
                    const ramp = (softness / 100) * 128;
                    const diff = chromaTolerance - dist;
                    const softAlpha = Math.max(0, 255 - (diff / ramp) * 255);
                    finalAlpha[i] = Math.min(a, Math.round(softAlpha));
                }
            }
        }

        const stack: { x: number, y: number, startR: number, startG: number, startB: number }[] = [];
        const visited = new Uint8Array(width * height);

        for (const point of magicPoints) {
            if (point.x >= 0 && point.x < width && point.y >= 0 && point.y < height) {
                const idx = point.y * width + point.x;
                stack.push({
                    x: point.x,
                    y: point.y,
                    startR: sourceData[idx * 4],
                    startG: sourceData[idx * 4 + 1],
                    startB: sourceData[idx * 4 + 2]
                });
                visited[idx] = 1;
            }
        }

        while (stack.length > 0) {
            const { x: cx, y: cy, startR, startG, startB } = stack.pop()!;
            const cIdx = cy * width + cx;

            finalAlpha[cIdx] = 0; // Remove pixel

            const neighbors = [
                [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
            ];

            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (visited[nIdx]) continue;

                    const na = sourceData[nIdx * 4 + 3];
                    if (na <= threshold) continue;

                    const nr = sourceData[nIdx * 4];
                    const ng = sourceData[nIdx * 4 + 1];
                    const nb = sourceData[nIdx * 4 + 2];

                    const dr = nr - startR;
                    const dg = ng - startG;
                    const db = nb - startB;
                    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

                    if (dist < chromaTolerance) {
                        visited[nIdx] = 1;
                        stack.push({ x: nx, y: ny, startR, startG, startB });
                    }
                }
            }
        }
    } else if (mode === 'magicWand' && magicPoints.length === 0) {
        for (let i = 0; i < width * height; i++) {
            finalAlpha[i] = sourceData[i * 4 + 3] > threshold ? 255 : 0;
        }
    } else if (mode === 'chromaKey') {
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const r = sourceData[idx];
            const g = sourceData[idx + 1];
            const b = sourceData[idx + 2];
            const a = sourceData[idx + 3];

            if (a <= threshold) {
                finalAlpha[i] = 0;
                continue;
            }

            const dr = r - bgColor.r;
            const dg = g - bgColor.g;
            const db = b - bgColor.b;
            const rgbDistance = Math.sqrt(dr * dr + dg * dg + db * db);

            const pixelLuma = 0.299 * r + 0.587 * g + 0.114 * b;
            const targetLuma = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b;

            let effectiveTolerance = chromaTolerance;

            if (pixelLuma < targetLuma) {
                const shadowFactor = 1 + (shadowTolerance / 50);
                effectiveTolerance *= shadowFactor;
            }

            if (rgbDistance < effectiveTolerance) {
                if (softness === 0) {
                    finalAlpha[i] = 0;
                } else {
                    const ramp = (softness / 100) * 128;
                    const diff = effectiveTolerance - rgbDistance;
                    const alpha = Math.max(0, 255 - (diff / ramp) * 255);
                    finalAlpha[i] = Math.round(alpha);
                }
            } else {
                finalAlpha[i] = 255;
            }
        }
    }

    // 2. EROSÃO
    if (erosion > 0) {
        let currentAlpha = new Uint8Array(finalAlpha);
        for (let pass = 0; pass < erosion; pass++) {
            currentAlpha.set(finalAlpha);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (currentAlpha[idx] === 0) continue;
                    let isEdge = false;
                    if (y > 0 && currentAlpha[idx - width] === 0) isEdge = true;
                    else if (y < height - 1 && currentAlpha[idx + width] === 0) isEdge = true;
                    else if (x > 0 && currentAlpha[idx - 1] === 0) isEdge = true;
                    else if (x < width - 1 && currentAlpha[idx + 1] === 0) isEdge = true;
                    if (isEdge) finalAlpha[idx] = 0;
                }
            }
        }
    }

    // 3. OUPUT
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        const alpha = finalAlpha[i];
        if (alpha > 0) {
            outputData[idx] = sourceData[idx];
            outputData[idx + 1] = sourceData[idx + 1];
            outputData[idx + 2] = sourceData[idx + 2];
            outputData[idx + 3] = alpha; // Respect alpha
        } else {
            outputData[idx] = 0;
            outputData[idx + 1] = 0;
            outputData[idx + 2] = 0;
            outputData[idx + 3] = 0;
        }
    }

    return outputImageData;
};

export async function autoRemoveBackground(imageUrl: string, tolerance: number = 45): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
            
            // Redimensionar para processamento se for muito grande para evitar travamentos, 
            // mas manter o aspecto
            const maxDimension = 1500;
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Pontos mágicos automáticos: Amostragem agressiva do perímetro
            const magicPoints = [];
            const step = Math.max(10, Math.floor(width / 50)); 
            
            for (let x = 0; x < width; x += step) {
                magicPoints.push({ x, y: 2 });
                magicPoints.push({ x, y: height - 2 });
            }
            for (let y = 0; y < height; y += step) {
                magicPoints.push({ x: 2, y });
                magicPoints.push({ x: width - 2, y });
            }

            const settings: AntiTransparencySettings = {
                mode: 'magicWand',
                backgroundColor: '#000000', 
                chromaTolerance: tolerance, 
                shadowTolerance: 30, // Pro: Catch more shadows
                erosion: 1, 
                magicPoints: magicPoints,
                alphaThreshold: 10,
                softness: 20 // Pro: Very soft edges for better blending
            };

            const processedData = runAntiTransparencyProcessing(
                data,
                width,
                height,
                settings,
                1
            );

            ctx.putImageData(processedData, 0, 0);

            canvas.toBlob(async (blob) => {
                if (blob) {
                    const finalBlob = await setPngDpi(blob, 300);
                    resolve(finalBlob);
                } else {
                    reject(new Error('Erro ao criar blob'));
                }
            }, 'image/png');
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = imageUrl;
    });
}
