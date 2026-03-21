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
    removeWhite?: boolean;
    whiteSensitivity?: number;
    alphaThreshold?: number;
    magicPoints?: {x: number, y: number}[];
    softness?: number; // 0-100: How smooth the edge removal is
}

// Presets de Halftone
export const HALFTONE_PRESETS: Record<string, { name: string; settings: HalftoneSettings }> = {
    // --- UTILS ---
    removeBlack: {
        name: 'Remover Preto (Simples)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 5 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },

    // --- RETÍCULA (Círculo) ---
    halftone_fraco_preto: {
        name: 'Retícula - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_fraco_branco: {
        name: 'Retícula - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },
    halftone_medio_preto: {
        name: 'Retícula - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_medio_branco: {
        name: 'Retícula - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },
    halftone_forte_preto: {
        name: 'Retícula - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
        }
    },
    halftone_forte_branco: {
        name: 'Retícula - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },

    // --- HACHURA (Linha) ---
    hachura_fraco_preto: {
        name: 'Hachura - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_fraco_branco: {
        name: 'Hachura - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },
    hachura_medio_preto: {
        name: 'Hachura - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_medio_branco: {
        name: 'Hachura - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },
    hachura_forte_preto: {
        name: 'Hachura - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'line'
        }
    },
    hachura_forte_branco: {
        name: 'Hachura - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'line'
        }
    },

    // --- QUADRADO ---
    quadrado_fraco_preto: {
        name: 'Quadrado - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_fraco_branco: {
        name: 'Quadrado - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },
    quadrado_medio_preto: {
        name: 'Quadrado - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_medio_branco: {
        name: 'Quadrado - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },
    quadrado_forte_preto: {
        name: 'Quadrado - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'square'
        }
    },
    quadrado_forte_branco: {
        name: 'Quadrado - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'square'
        }
    },

    // --- ESPIRAL ---
    spiral_fraco_preto: {
        name: 'Espiral - Fraco (Preto)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_fraco_branco: {
        name: 'Espiral - Fraco (Branco)',
        settings: {
            brightness: 100, contrast: 100, levels: { min: 3, max: 230 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'spiral'
        }
    },
    spiral_medio_preto: {
        name: 'Espiral - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_medio_branco: {
        name: 'Espiral - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'spiral'
        }
    },
    spiral_forte_preto: {
        name: 'Espiral - Forte (Preto)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'spiral'
        }
    },
    spiral_forte_branco: {
        name: 'Espiral - Forte (Branco)',
        settings: {
            brightness: 28, contrast: -14, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 35, softness: 15,
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
    
    // Se a configuração tiver um flag para pular halftone, ou se usarmos a função dedicada
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
    const { width, height } = imageData;
    const processSrcData = applyBackgroundRemoval(imageData, settings).data;
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

            // Se o pixel ficou transparente na remoção de fundo/erosão, pula
            if (a === 0) {
                destData[idx + 3] = 0;
                continue;
            }

            // Inversão real das cores (Negativo) se solicitado
            if (settings.invertInput) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
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

            if (levelRange !== 255) {
                luminance = ((luminance - levelMin) / levelRange) * 255;
                luminance = Math.max(0, Math.min(255, luminance));
            }

            luminance += brightnessBoost;
            if (contrastFactor !== 1) {
                luminance = contrastFactor * (luminance - 128) + 128;
            }
            luminance = Math.max(0, Math.min(255, luminance));

            let normX = 0;
            let normY = 0;
            let dist = 0;
            let maxDist = 1.5;

            if (shape === 'spiral') {
                const dx = x - width / 2;
                const dy = y - height / 2;
                const angle = Math.atan2(dy, dx) + angleRad;
                const radius = Math.sqrt(dx * dx + dy * dy);
                const spiralRadius = radius - (angle / (2 * Math.PI)) * dotSize;
                const cellPos = ((spiralRadius % dotSize) + dotSize) % dotSize;
                const normPos = (cellPos / dotSize) * 2 - 1;
                dist = Math.abs(normPos);
                maxDist = 1.0;
            } else {
                const rotX = x * cosA - y * sinA;
                const rotY = x * sinA + y * cosA;
                const cellX = ((rotX % dotSize) + dotSize) % dotSize;
                const cellY = ((rotY % dotSize) + dotSize) % dotSize;
                normX = (cellX / dotSize) * 2 - 1;
                normY = (cellY / dotSize) * 2 - 1;

                switch (shape) {
                    case 'line': dist = Math.abs(normY); maxDist = 1.0; break;
                    case 'square': dist = Math.max(Math.abs(normX), Math.abs(normY)); break;
                    case 'cross_hatch': dist = Math.min(Math.abs(normX), Math.abs(normY)); maxDist = 1.0; break;
                    case 'ellipse': dist = Math.sqrt((normX * normX) * 0.5 + (normY * normY) * 2); break;
                    case 'diamond': dist = (Math.abs(normX) + Math.abs(normY)) / 1.4; break;
                    case 'triangle': dist = Math.max(Math.abs(normX) * 0.866 + normY * 0.5, -normY); break;
                    case 'cross': dist = Math.pow(Math.abs(normX) * Math.abs(normY), 0.5) * 2; break;
                    case 'inv_circle': dist = 1 - Math.cos(normX * Math.PI / 2) * Math.cos(normY * Math.PI / 2); break;
                    case 'circle':
                    default: dist = Math.sqrt(normX * normX + normY * normY); break;
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

// NOVO: Remoção exclusiva de fundo por erosão (sem halftone)
export function applyBackgroundRemoval(imageData: ImageData, settings: HalftoneSettings): ImageData {
    const { width, height, data: srcData } = imageData;
    const out = new ImageData(width, height);
    const destData = out.data;

    const blackThreshold = settings.blackSensitivity !== undefined ? settings.blackSensitivity : 15;
    const erosionAmount = settings.edgeContraction || 0;

    let currentSrc = new Uint8ClampedArray(srcData);
    let currentDest = new Uint8ClampedArray(srcData);
    const alphaThreshold = settings.alphaThreshold || 10;
    const chromaTolerance = settings.whiteSensitivity || 30; // Reutilizando whiteSensitivity como tolerância

    const isBackground = (data: Uint8ClampedArray, pixelIdx: number): { isBg: boolean, alpha: number } => {
        const a = data[pixelIdx + 3];
        if (a < alphaThreshold) return { isBg: true, alpha: 0 };

        const softness = settings.softness || 0;
        const ramp = softness > 0 ? (softness / 100) * 128 : 1; // Distância de "feathering"

        if (settings.removeBlack) {
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            if (settings.invertInput) {
                const targetLum = 255 - blackThreshold;
                if (lum > targetLum) {
                    if (softness === 0) return { isBg: true, alpha: 0 };
                    const diff = lum - targetLum;
                    const alpha = Math.max(0, 255 - (diff / ramp) * 255);
                    return { isBg: alpha < 255, alpha: Math.round(alpha) };
                }
            } else {
                if (lum < blackThreshold) {
                    if (softness === 0) return { isBg: true, alpha: 0 };
                    const diff = blackThreshold - lum;
                    const alpha = Math.max(0, 255 - (diff / ramp) * 255);
                    return { isBg: alpha < 255, alpha: Math.round(alpha) };
                }
            }
        }

        if (settings.removeWhite) {
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            const whiteThreshold = settings.whiteSensitivity !== undefined ? (255 - settings.whiteSensitivity) : 240;
            if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
                if (softness === 0) return { isBg: true, alpha: 0 };
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                const diff = lum - whiteThreshold;
                const alpha = Math.max(0, 255 - (diff / ramp) * 255);
                return { isBg: alpha < 255, alpha: Math.round(alpha) };
            }
        }

        return { isBg: false, alpha: 255 };
    };

    // ALGORITMO MAGIC WAND (Flood Fill conectado)
    // Se magicPoints forem fornecidos, usa apenas eles. Caso contrário, usa Sementes automáticas (bordas)
    const magicPoints = settings.magicPoints || [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: 0, y: height - 1 },
        { x: width - 1, y: height - 1 },
        { x: Math.floor(width / 2), y: 0 },
        { x: Math.floor(width / 2), y: height - 1 },
        { x: 0, y: Math.floor(height / 2) },
        { x: width - 1, y: Math.floor(height / 2) }
    ];

    // 1. GLOBAL PASS (Remoção baseada em luma/cor em toda a imagem)
    const finalAlpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
        const res = isBackground(currentSrc, i * 4);
        finalAlpha[i] = res.alpha;
    }

    // 2. MAGIC WAND (Remoção conectada a partir de sementes)
    const stack: { x: number, y: number, startR: number, startG: number, startB: number }[] = [];
    const visited = new Uint8Array(width * height);

    for (const point of magicPoints) {
        const idx = point.y * width + point.x;
        // Se a semente for considerada fundo no Global Pass, ela é uma boa semente
        if (finalAlpha[idx] < 255 || settings.magicPoints) {
            stack.push({
                x: point.x,
                y: point.y,
                startR: currentSrc[idx * 4],
                startG: currentSrc[idx * 4 + 1],
                startB: currentSrc[idx * 4 + 2]
            });
            visited[idx] = 1;
        }
    }

    // Flood Fill
    while (stack.length > 0) {
        const { x: cx, y: cy, startR, startG, startB } = stack.pop()!;
        const cIdx = cy * width + cx;
        finalAlpha[cIdx] = 0; // Remove

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (visited[nIdx]) continue;

                if (currentSrc[nIdx * 4 + 3] <= alphaThreshold) {
                    visited[nIdx] = 1;
                    stack.push({ x: nx, y: ny, startR, startG, startB });
                    continue;
                }

                const nr = currentSrc[nIdx * 4], ng = currentSrc[nIdx * 4 + 1], nb = currentSrc[nIdx * 4 + 2];
                const dist = Math.sqrt(Math.pow(nr - startR, 2) + Math.pow(ng - startG, 2) + Math.pow(nb - startB, 2));

                if (dist < chromaTolerance) {
                    visited[nIdx] = 1;
                    finalAlpha[nIdx] = 0; // Remove pixel conectado
                    stack.push({ x: nx, y: ny, startR, startG, startB });
                }
            }
        }
    }

    // Aplica o alpha final
    for (let i = 0; i < width * height; i++) {
        currentDest[i * 4 + 3] = finalAlpha[i];
    }
    currentSrc.set(currentDest);

    // Aplica Erosão se solicitado
    if (erosionAmount > 0) {
        for (let pass = 0; pass < erosionAmount; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (currentSrc[idx + 3] === 0) continue;

                    let isEdge = false;
                    if (y === 0 || currentSrc[((y - 1) * width + x) * 4 + 3] === 0) isEdge = true;
                    else if (y === height - 1 || currentSrc[((y + 1) * width + x) * 4 + 3] === 0) isEdge = true;
                    else if (x === 0 || currentSrc[(y * width + (x - 1)) * 4 + 3] === 0) isEdge = true;
                    else if (x === width - 1 || currentSrc[(y * width + (x + 1)) * 4 + 3] === 0) isEdge = true;

                    if (isEdge) {
                        currentDest[idx + 3] = 0;
                    }
                }
            }
            currentSrc.set(currentDest);
        }
    }

    // DESPECKLE: Remoção de ruído avançada (Passo 5x5)
    // Remove "ilhas" de até 4-5 pixels, que é o tamanho das sujeiras vistas no teste real.
    const tempFinalAlpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) tempFinalAlpha[i] = currentDest[i * 4 + 3];

    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            const idx = y * width + x;
            if (tempFinalAlpha[idx] === 0) continue;

            let neighbors = 0;
            // Verifica vizinhança 5x5 (24 pixels ao redor)
            for (let ny = y - 2; ny <= y + 2; ny++) {
                for (let nx = x - 2; nx <= x + 2; nx++) {
                    if (nx === x && ny === y) continue;
                    if (tempFinalAlpha[ny * width + nx] > 0) neighbors++;
                }
            }

            // Um pixel de logo legítimo terá muitos vizinhos. 
            // Sujeiras isoladas, mesmo que sejam clusters de 2-3 pixels, terão poucos vizinhos num raio de 5x5.
            if (neighbors < 4) {
                currentDest[idx * 4 + 3] = 0;
            }
        }
    }

    // GARANTIA: Pixels transparentes devem ter RGB = 0
    // Isso evita que renderizadores de Canvas (como no Montador) acidentalmente 
    // mesclem ou mostrem um "fundo branco fantasma" ao ler a imagem via imageData ou blob.
    for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        if (currentDest[idx + 3] === 0) {
            currentDest[idx] = 0;
            currentDest[idx + 1] = 0;
            currentDest[idx + 2] = 0;
        }
    }

    destData.set(currentDest);
    return out;
}

// NOVO: Aplicar apenas remoção de fundo (Compatível com Worker)
export async function applyBackgroundRemovalToBlob(
    blob: Blob | ImageBitmap,
    settings: HalftoneSettings
): Promise<Blob> {
    let imgBitmap: ImageBitmap = blob instanceof ImageBitmap ? blob : await createImageBitmap(blob);
    const w = imgBitmap.width;
    const h = imgBitmap.height;

    const { canvas, ctx } = createAgnosticCanvas(w, h);
    if (!canvas || !ctx) return new Blob([]);
    ctx.drawImage(imgBitmap, 0, 0);
    if (!(blob instanceof ImageBitmap)) imgBitmap.close();

    const src = ctx.getImageData(0, 0, w, h);
    const out = applyBackgroundRemoval(src, settings);

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

    if (result) return await setPngDpi(result, 300);
    return blob instanceof Blob ? blob : new Blob([]);
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