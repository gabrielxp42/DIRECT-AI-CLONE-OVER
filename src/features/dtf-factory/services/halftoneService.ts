// Halftone Service - Adaptado do projeto Overpixel existente

export type HalftoneLevels = { min: number; max: number };

export interface HalftoneSettings {
    brightness: number;
    contrast: number;
    saturation?: number;
    levels: HalftoneLevels;
    dotSize: number;
    angle?: number;
    removeBlack: boolean;
    blackSensitivity: number;
    whiteChoke?: number;
    dotMode?: 'dynamic' | 'fixed';
    shape?: 'circle' | 'line' | 'square' | 'ellipse' | 'diamond' | 'triangle' | 'cross' | 'inv_circle' | 'spiral' | 'cross_hatch';
    dotMinPercent?: number;
    dotMaxPercent?: number;
    dotFixedPercent?: number;
    dotInvert?: boolean;
    edgeContraction?: number;
    invertInput?: boolean;
    invertOutput?: boolean;
}

// Presets de Halftone
export const HALFTONE_PRESETS: Record<string, { name: string; settings: HalftoneSettings }> = {
    // --- UTILS ---
    removeBlack: {
        name: 'Remover Preto (Simples)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 5 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },

    // --- RETÍCULA (Círculo) ---
    halftone_fraco_preto: {
        name: 'Retícula - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_fraco_branco: {
        name: 'Retícula - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },
    halftone_medio_preto: {
        name: 'Retícula - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_medio_branco: {
        name: 'Retícula - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },
    halftone_forte_preto: {
        name: 'Retícula - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_forte_branco: {
        name: 'Retícula - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },

    // --- HACHURA (Linha) ---
    hachura_fraco_preto: {
        name: 'Hachura - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_fraco_branco: {
        name: 'Hachura - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },
    hachura_medio_preto: {
        name: 'Hachura - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_medio_branco: {
        name: 'Hachura - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },
    hachura_forte_preto: {
        name: 'Hachura - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_forte_branco: {
        name: 'Hachura - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },

    // --- QUADRADO ---
    quadrado_fraco_preto: {
        name: 'Quadrado - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_fraco_branco: {
        name: 'Quadrado - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },
    quadrado_medio_preto: {
        name: 'Quadrado - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_medio_branco: {
        name: 'Quadrado - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },
    quadrado_forte_preto: {
        name: 'Quadrado - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_forte_branco: {
        name: 'Quadrado - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },

    // --- ESPIRAL ---
    spiral_fraco_preto: {
        name: 'Espiral - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_fraco_branco: {
        name: 'Espiral - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'spiral'
        }
    },
    spiral_medio_preto: {
        name: 'Espiral - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_medio_branco: {
        name: 'Espiral - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'spiral'
        }
    },
    spiral_forte_preto: {
        name: 'Espiral - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_forte_branco: {
        name: 'Espiral - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'spiral'
        }
    },
};

// Aplicar halftone a um blob
// Helper para criar canvas (Main Thread ou Worker)
// Helper para criar canvas (Main Thread ou Worker)
function createAgnosticCanvas(width: number, height: number): { canvas: any, ctx: any } {
    if (typeof (globalThis as any).OffscreenCanvas !== 'undefined') {
        const canvas = new (globalThis as any).OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        return { canvas, ctx };
    } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        return { canvas, ctx };
    }
    return { canvas: null, ctx: null };
}

// Aplicar halftone a um blob (Compatível com Worker)
export async function applyHalftoneToBlob(
    blob: Blob | ImageBitmap, // Aceita ImageBitmap direto para performance no worker
    settings: HalftoneSettings
): Promise<Blob> {
    let imgBitmap: ImageBitmap;

    if (blob instanceof ImageBitmap) {
        imgBitmap = blob;
    } else {
        imgBitmap = await createImageBitmap(blob);
    }

    const w = imgBitmap.width;
    const h = imgBitmap.height;

    const { canvas, ctx } = createAgnosticCanvas(w, h);
    if (!canvas || !ctx) return new Blob([]);

    // @ts-ignore - ImageBitmap é aceito em ambos, mas Type definitions podem reclamar
    ctx.drawImage(imgBitmap, 0, 0);

    // Se recebemos um blob e criamos o bitmap, devemos fechá-lo para economizar memória
    if (!(blob instanceof ImageBitmap)) {
        imgBitmap.close();
    }

    const src = ctx.getImageData(0, 0, w, h);
    const out = applyColorHalftone(src, settings);

    const { canvas: outCanvas, ctx: octx } = createAgnosticCanvas(out.width, out.height);
    if (!outCanvas || !octx) return new Blob([]);

    octx.putImageData(out, 0, 0);

    let result: Blob | null = null;

    if (outCanvas.convertToBlob) {
        result = await (outCanvas as any).convertToBlob({ type: 'image/png' });
    } else {
        result = await new Promise<Blob | null>((resolve) =>
            (outCanvas as HTMLCanvasElement).toBlob(b => resolve(b || null), 'image/png', 1.0)
        );
    }

    if (result) {
        return await setPngDpi(result, 300);
    }
    // Fallback: se falhar, retorna o original (não deve acontecer)
    return blob instanceof Blob ? blob : new Blob([]);
}

// Algoritmo de halftone pixel-perfect
function applyColorHalftone(imageData: ImageData, settings: HalftoneSettings): ImageData {
    const { width, height, data: srcData } = imageData;
    const out = new ImageData(width, height);
    const destData = out.data;

    const dotSize = Math.max(1, settings.dotSize);
    const dotMode = settings.dotMode || 'dynamic';
    const dotInvert = settings.dotInvert !== undefined ? settings.dotInvert : true;
    const dotMinPercent = Math.max(0, Math.min(100, settings.dotMinPercent ?? 10));
    const dotMaxPercent = Math.max(0, Math.min(100, settings.dotMaxPercent ?? 100));
    const dotFixedPercent = Math.max(0, Math.min(100, settings.dotFixedPercent ?? 60));
    const shape = settings.shape || 'circle';

    const brightnessBoost = settings.brightness <= 100 && settings.brightness >= -100
        ? settings.brightness
        : settings.brightness - 100;

    const contrastVal = settings.contrast <= 100 && settings.contrast >= -100
        ? settings.contrast
        : settings.contrast - 100;
    const contrastFactor = contrastVal !== 0
        ? (259 * (contrastVal + 255)) / (255 * (259 - contrastVal))
        : 1;

    const blackThreshold = settings.blackSensitivity !== undefined ? settings.blackSensitivity : 15;

    // --- EDGE EROSION (CONTRACTION) PRE-PROCESSING ---
    let processSrcData: Uint8ClampedArray = srcData;
    const erosionAmount = settings.edgeContraction || 0;

    if (erosionAmount > 0) {
        let currentSrc = new Uint8ClampedArray(srcData);
        let currentDest = new Uint8ClampedArray(srcData);
        const alphaThreshold = 50;

        // Helper para verificar se um pixel é considerado "fundo" (transparente ou preto a ser removido)
        const isBackground = (pixelIdx: number) => {
            // 1. Transparência Alpha
            if (currentSrc[pixelIdx + 3] < alphaThreshold) return true;

            // 2. Preto (apenas se removeBlack estiver ativo)
            // Isso permite que a erosão funcione mesmo em imagens com fundo preto opaco
            if (settings.removeBlack) {
                const r = currentSrc[pixelIdx];
                const g = currentSrc[pixelIdx + 1];
                const b = currentSrc[pixelIdx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;

                // Se Inversão de Entrada estiver ativa, o "Fundo" a ser removido é o BRANCO (Alta Luminosidade)
                // O Preto (Baixa Luminosidade) é o CONTEÚDO que será preservado (invertido para branco depois)
                if (settings.invertInput) {
                    // Remove Branco: se lum > (255 - threshold)
                    if (lum > (255 - blackThreshold)) return true;
                } else {
                    // Remove Preto (Padrão): se lum < threshold
                    if (lum < blackThreshold) return true;
                }
            }
            return false;
        };

        for (let pass = 0; pass < erosionAmount; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;

                    // Se o próprio pixel já é fundo, garante que fica transparente
                    if (isBackground(idx)) {
                        currentDest[idx + 3] = 0;
                        continue;
                    }

                    let isEdge = false;
                    // Checa vizinhos
                    if (y === 0 || isBackground(((y - 1) * width + x) * 4)) isEdge = true;
                    else if (y === height - 1 || isBackground(((y + 1) * width + x) * 4)) isEdge = true;
                    else if (x === 0 || isBackground((y * width + (x - 1)) * 4)) isEdge = true;
                    else if (x === width - 1 || isBackground((y * width + (x + 1)) * 4)) isEdge = true;

                    if (isEdge) {
                        currentDest[idx + 3] = 0;
                    }
                }
            }
            currentSrc.set(currentDest);
        }
        processSrcData = currentDest;
    }

    const getLuminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

    const levelMin = settings.levels ? (settings.levels.min || 0) : 0;
    const levelMax = settings.levels ? (settings.levels.max || 255) : 255;
    const levelRange = levelMax - levelMin || 1;

    const angle = settings.angle ?? 45;
    const angleRad = (angle * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            let r = processSrcData[idx];
            let g = processSrcData[idx + 1];
            let b = processSrcData[idx + 2];
            const a = processSrcData[idx + 3];

            // Inversão real das cores (Negativo) se solicitado
            // Isso permite converter "Fundo Branco + Texto Preto" em "Fundo Preto + Texto Branco"
            if (settings.invertInput) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            if (a === 0) {
                destData[idx + 3] = 0;
                continue;
            }

            let luminance = getLuminance(r, g, b);

            const satVal = settings.saturation || 0;
            if (satVal !== 0) {
                const satMultiplier = 1 + (satVal / 100);
                r = luminance + (r - luminance) * satMultiplier;
                g = luminance + (g - luminance) * satMultiplier;
                b = luminance + (b - luminance) * satMultiplier;

                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));

                luminance = getLuminance(r, g, b);
            }

            if (settings.removeBlack && luminance < blackThreshold) {
                destData[idx + 3] = 0;
                continue;
            }

            if (levelRange !== 255) {
                luminance = ((luminance - levelMin) / levelRange) * 255;
                luminance = Math.max(0, Math.min(255, luminance));
            }

            luminance += brightnessBoost;
            if (contrastFactor !== 1) {
                luminance = contrastFactor * (luminance - 128) + 128;
            }
            luminance = Math.max(0, Math.min(255, luminance));

            luminance = Math.max(0, Math.min(255, luminance));

            let normX = 0;
            let normY = 0;
            let dist = 0;
            let maxDist = 1.5;

            if (shape === 'spiral') {
                // Modo Espiral Global
                // Ignora o grid padrão e usa coordenadas polares do centro da imagem
                const dx = x - width / 2;
                const dy = y - height / 2;
                const angle = Math.atan2(dy, dx) + angleRad;
                const radius = Math.sqrt(dx * dx + dy * dy);

                // Espiral de Arquimedes: r = a + b * theta
                // Queremos que a "distância" entre braços seja dotSize
                // Efetivamente, deslocamos o raio baseado no ângulo
                const spiralRadius = radius - (angle / (2 * Math.PI)) * dotSize;

                // Normalizamos como se fosse uma linha (Line Halftone)
                const cellPos = ((spiralRadius % dotSize) + dotSize) % dotSize;
                const normPos = (cellPos / dotSize) * 2 - 1;

                dist = Math.abs(normPos);
                maxDist = 1.0; // Espiral é baseada em linha
            } else {
                // Modo Grid Padrão
                const rotX = x * cosA - y * sinA;
                const rotY = x * sinA + y * cosA;

                const cellX = ((rotX % dotSize) + dotSize) % dotSize;
                const cellY = ((rotY % dotSize) + dotSize) % dotSize;

                normX = (cellX / dotSize) * 2 - 1;
                normY = (cellY / dotSize) * 2 - 1;

                switch (shape) {
                    case 'line':
                        dist = Math.abs(normY);
                        maxDist = 1.0;
                        break;
                    case 'square':
                        dist = Math.max(Math.abs(normX), Math.abs(normY));
                        break;
                    case 'cross_hatch':
                        // Cruzado (Cross-Hatch) / Jogo da Velha
                        // União de linhas nos eixos X e Y da célula
                        // Usa maxDist 1.0 para paridade com o modo 'line' (conforme solicitado pelo usuário)
                        dist = Math.min(Math.abs(normX), Math.abs(normY));
                        maxDist = 1.0;
                        break;
                    case 'ellipse':
                        // Simples elipse alongada em X
                        dist = Math.sqrt((normX * normX) * 0.5 + (normY * normY) * 2);
                        break;
                    case 'diamond':
                        // Losango (Manhattan Distance)
                        dist = (Math.abs(normX) + Math.abs(normY)) / 1.4;
                        break;
                    case 'triangle':
                        dist = Math.max(Math.abs(normX) * 0.866 + normY * 0.5, -normY);
                        break;
                    case 'cross':
                        dist = Math.pow(Math.abs(normX) * Math.abs(normY), 0.5) * 2;
                        break;
                    case 'inv_circle':
                        dist = 1 - Math.cos(normX * Math.PI / 2) * Math.cos(normY * Math.PI / 2);
                        break;
                    case 'circle':
                    default:
                        dist = Math.sqrt(normX * normX + normY * normY);
                        break;
                }
            }

            let radiusPercent: number;
            if (dotMode === 'fixed') {
                const cutoff = 12;
                if (dotInvert) {
                    radiusPercent = luminance < cutoff ? 0 : dotFixedPercent;
                } else {
                    radiusPercent = luminance > (255 - cutoff) ? 0 : dotFixedPercent;
                }
            } else {
                if (dotInvert) {
                    radiusPercent = dotMinPercent + (dotMaxPercent - dotMinPercent) * (luminance / 255);
                } else {
                    radiusPercent = dotMaxPercent - (dotMaxPercent - dotMinPercent) * (luminance / 255);
                }
            }

            const threshold = (radiusPercent / 100) * maxDist;

            if (dist < threshold) {
                if (settings.invertOutput) {
                    destData[idx] = 255 - r;
                    destData[idx + 1] = 255 - g;
                    destData[idx + 2] = 255 - b;
                } else {
                    destData[idx] = r;
                    destData[idx + 1] = g;
                    destData[idx + 2] = b;
                }
                destData[idx + 3] = a;
            } else {
                destData[idx + 3] = 0;
            }
        }
    }

    return out;
}

// Adicionar DPI ao PNG
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xedb88320 ^ (c >>> 1);
        else c = c >>> 1;
    }
    crcTable[n] = c;
}

function crc32(buf: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
}

export async function setPngDpi(blob: Blob, dpi: number): Promise<Blob> {
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    if (uint8[0] !== 0x89 || uint8[1] !== 0x50 || uint8[2] !== 0x4E || uint8[3] !== 0x47) {
        console.warn('Not a PNG file, skipping DPI setting');
        return blob;
    }

    const view = new DataView(buffer);
    const ihdrLength = view.getUint32(8, false);
    const ihdrEnd = 8 + 4 + 4 + ihdrLength + 4;

    const pixelsPerMeter = Math.round(dpi / 0.0254);

    const chunkLen = 9;
    const chunkType = [112, 72, 89, 115]; // 'pHYs'
    const data = new Uint8Array(9);
    const dataView = new DataView(data.buffer);
    dataView.setUint32(0, pixelsPerMeter, false);
    dataView.setUint32(4, pixelsPerMeter, false);
    dataView.setUint8(8, 1);

    const crcBuf = new Uint8Array(4 + 9);
    crcBuf.set(chunkType, 0);
    crcBuf.set(data, 4);
    const crcVal = crc32(crcBuf);

    const newBuffer = new Uint8Array(uint8.length + 4 + 4 + 9 + 4);
    newBuffer.set(uint8.slice(0, ihdrEnd), 0);

    const insertPos = ihdrEnd;

    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, chunkLen, false);
    newBuffer.set(lenBuf, insertPos);
    newBuffer.set(chunkType, insertPos + 4);
    newBuffer.set(data, insertPos + 8);

    const crcWriteBuf = new Uint8Array(4);
    new DataView(crcWriteBuf.buffer).setUint32(0, crcVal, false);
    newBuffer.set(crcWriteBuf, insertPos + 17);

    newBuffer.set(uint8.slice(ihdrEnd), insertPos + 21);

    return new Blob([newBuffer], { type: 'image/png' });
}

// Obter lista de presets
export function getHalftonePresets() {
    return HALFTONE_PRESETS;
}

export function getHalftonePreset(key: string) {
    return HALFTONE_PRESETS[key];
}