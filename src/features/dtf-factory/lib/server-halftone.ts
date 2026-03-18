
import Jimp from 'jimp';

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

// Presets de Halftone (Copiados do cliente para consistência)
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
    halftone_medio_preto: {
        name: 'Retícula - Médio (Preto)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: false, invertOutput: false, shape: 'circle'
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
    // --- BRANCOS ---
    halftone_medio_branco: {
        name: 'Retícula - Médio (Branco)',
        settings: {
            brightness: 100, contrast: 13, levels: { min: 3, max: 255 },
            dotSize: 18, angle: 45, removeBlack: true, blackSensitivity: 24,
            dotMode: 'dynamic', dotMinPercent: 10, dotMaxPercent: 100, dotInvert: true,
            edgeContraction: 2, invertInput: true, invertOutput: true, shape: 'circle'
        }
    },
};

export function getHalftonePreset(key: string) {
    return HALFTONE_PRESETS[key] || HALFTONE_PRESETS['halftone_medio_preto'];
}

/**
 * Aplica halftone a um buffer de imagem (Server-Side)
 * @param imageBuffer Buffer da imagem (PNG/JPG)
 * @param settings Configurações de halftone
 * @returns Buffer da imagem PNG processada
 */
export async function applyHalftoneServer(
    imageBuffer: Buffer,
    settings: HalftoneSettings
): Promise<Buffer> {
    // 1. Decodificar imagem com Jimp
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // 2. Converter para Uint8ClampedArray para processamento
    const srcData = new Uint8ClampedArray(image.bitmap.data);

    // 3. Aplicar algoritmo de halftone
    const processedData = applyColorHalftoneLogic(srcData, width, height, settings);

    // 4. Atualizar bitmap do Jimp
    image.bitmap.data = Buffer.from(processedData);

    // 5. Retornar buffer PNG
    const resultBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

    // 6. Aplicar DPI (300)
    return setPngDpiBuffer(resultBuffer, 300);
}

// Algoritmo de halftone pixel-perfect (Portado do halftoneService.ts)
// Removemos dependência de ImageData, usamos Uint8ClampedArray direto
function applyColorHalftoneLogic(
    srcData: Uint8ClampedArray,
    width: number,
    height: number,
    settings: HalftoneSettings
): Uint8ClampedArray {
    // Copia para output
    const destData = new Uint8ClampedArray(width * height * 4);

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

        const isBackground = (pixelIdx: number) => {
            if (currentSrc[pixelIdx + 3] < alphaThreshold) return true;
            if (settings.removeBlack) {
                const r = currentSrc[pixelIdx];
                const g = currentSrc[pixelIdx + 1];
                const b = currentSrc[pixelIdx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (settings.invertInput) {
                    if (lum > (255 - blackThreshold)) return true;
                } else {
                    if (lum < blackThreshold) return true;
                }
            }
            return false;
        };

        for (let pass = 0; pass < erosionAmount; pass++) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (isBackground(idx)) {
                        currentDest[idx + 3] = 0;
                        continue;
                    }
                    let isEdge = false;
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
                    case 'line':
                        dist = Math.abs(normY);
                        maxDist = 1.0;
                        break;
                    case 'square':
                        dist = Math.max(Math.abs(normX), Math.abs(normY));
                        break;
                    case 'cross_hatch':
                        dist = Math.min(Math.abs(normX), Math.abs(normY));
                        maxDist = 1.0;
                        break;
                    case 'ellipse':
                        dist = Math.sqrt((normX * normX) * 0.5 + (normY * normY) * 2);
                        break;
                    case 'diamond':
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

    return destData;
}

// Adicionar DPI ao PNG (Server-side Buffer version)
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

export function setPngDpiBuffer(buffer: Buffer, dpi: number): Buffer {
    const uint8 = new Uint8Array(buffer);

    if (uint8[0] !== 0x89 || uint8[1] !== 0x50 || uint8[2] !== 0x4E || uint8[3] !== 0x47) {
        return buffer;
    }

    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);
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

    return Buffer.from(newBuffer);
}

/**
 * Adiciona fundo preto usando Jimp (Server-side)
 */
export async function addBlackBackgroundServer(imageBuffer: Buffer): Promise<Buffer> {
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Criar nova imagem preta
    const bg = new Jimp(width, height, 0x000000FF);
    
    // Compor imagem original sobre o fundo preto
    bg.composite(image, 0, 0);

    return await bg.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * Adiciona fundo branco usando Jimp (Server-side)
 */
export async function addWhiteBackgroundServer(imageBuffer: Buffer): Promise<Buffer> {
    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Criar nova imagem branca
    const bg = new Jimp(width, height, 0xFFFFFFFF);
    
    // Compor imagem original sobre o fundo branco
    bg.composite(image, 0, 0);

    return await bg.getBufferAsync(Jimp.MIME_PNG);
}
