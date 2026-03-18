import type { ImageDimensions, PackingResult, OptimizationSuggestion, FinalLayout, LayoutItem } from './types';

const DEFAULT_CANVAS_WIDTH_CM = 57;
const SPACING_PX = 2;
const BLEED_PX = 0;
const MAX_WASTE_CM = 12;
const MIN_RESIZE_CM = 3;
const MAX_RESIZE_CM = 5;

// Configurações da Máscara de Colisão
const MASK_RESOLUTION_PX_PER_CM = 5; // 5 células por cm (precisão de 2mm)

/**
 * Converte dimensões de pixels para centímetros
 */
export function pxToCm(px: number, dpi: number): number {
    return (px / dpi) * 2.54;
}

/**
 * Converte dimensões de centímetros para pixels
 */
export function cmToPx(cm: number, dpi: number): number {
    return (cm / 2.54) * dpi;
}

/**
 * Gera uma máscara de colisão de baixa resolução a partir da imagem
 * Retorna um Uint8Array onde 1 = ocupado, 0 = livre
 */
async function generateCollisionMask(img: CanvasImageSource, widthCm: number, heightCm: number): Promise<{
    mask: Uint8Array;
    maskWidth: number;
    maskHeight: number;
}> {
    const maskWidth = Math.ceil(widthCm * MASK_RESOLUTION_PX_PER_CM);
    const maskHeight = Math.ceil(heightCm * MASK_RESOLUTION_PX_PER_CM);

    const canvas = document.createElement('canvas');
    canvas.width = maskWidth;
    canvas.height = maskHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) throw new Error('Falha ao criar contexto para máscara');

    // Desenha a imagem redimensionada para a resolução da máscara
    ctx.drawImage(img, 0, 0, maskWidth, maskHeight);

    const imageData = ctx.getImageData(0, 0, maskWidth, maskHeight);
    const data = imageData.data;
    const mask = new Uint8Array(maskWidth * maskHeight);

    // Limiar de opacidade para considerar colisão (alpha > 10)
    const ALPHA_THRESHOLD = 10;

    for (let i = 0; i < mask.length; i++) {
        mask[i] = data[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
    }

    return { mask, maskWidth, maskHeight };
}

/**
 * Rotaciona uma máscara em 90 graus no sentido horário
 */
function rotateMask90(mask: Uint8Array, width: number, height: number): { mask: Uint8Array, width: number, height: number } {
    const newWidth = height;
    const newHeight = width;
    const newMask = new Uint8Array(newWidth * newHeight);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const newX = height - 1 - y;
            const newY = x;
            if (mask[y * width + x] === 1) {
                newMask[newY * newWidth + newX] = 1;
            }
        }
    }
    return { mask: newMask, width: newWidth, height: newHeight };
}

/**
 * Verifica se duas máscaras colidem
 */
function checkCollision(
    maskA: Uint8Array, wA: number, hA: number,
    maskB: Uint8Array, wB: number, hB: number,
    offsetX: number, offsetY: number
): boolean {
    const startX = Math.max(0, offsetX);
    const endX = Math.min(wA, offsetX + wB);
    const startY = Math.max(0, offsetY);
    const endY = Math.min(hA, offsetY + hB);

    if (startX >= endX || startY >= endY) return false;

    for (let y = startY; y < endY; y++) {
        const rowA = y * wA;
        const rowB = (y - offsetY) * wB;
        for (let x = startX; x < endX; x++) {
            if (maskA[rowA + x] === 1 && maskB[rowB + (x - offsetX)] === 1) return true;
        }
    }
    return false;
}

/**
 * Calcula o menor avanço horizontal (stride) possível
 */
function calculateOptimalStride(
    maskA: Uint8Array, wA: number, hA: number,
    maskB: Uint8Array, wB: number, hB: number
): number {
    // Tenta encontrar o menor X (de 0 até wA) onde não há colisão
    for (let x = 0; x < wA; x++) {
        if (!checkCollision(maskA, wA, hA, maskB, wB, hB, x, 0)) {
            return x;
        }
    }
    return wA;
}

/**
 * Calcula bounding box da imagem (área não-transparente)
 */
async function calculateBoundingBox(img: HTMLImageElement): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
}> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    let minX = img.width, minY = img.height, maxX = 0, maxY = 0;

    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            if (data[(y * img.width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX > maxX || minY > maxY) return { x: 0, y: 0, width: img.width, height: img.height };
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Tenta ler DPI dos metadados EXIF
 */
async function readDPIFromFile(file: File): Promise<number> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) { resolve(300); return; }
            const view = new DataView(arrayBuffer);
            if (view.byteLength > 8 && view.getUint32(0) === 0x89504E47) {
                let offset = 8;
                while (offset < view.byteLength - 12) {
                    const chunkLength = view.getUint32(offset);
                    const chunkType = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
                    if (chunkType === 'pHYs') {
                        const dpi = Math.round(view.getUint32(offset + 8) / 39.3701);
                        resolve(dpi > 0 ? dpi : 300);
                        return;
                    }
                    offset += 12 + chunkLength;
                }
            }
            resolve(300);
        };
        reader.onerror = () => resolve(300);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Extrai dimensões da imagem e gera máscara
 */
export async function getImageDimensions(file: File): Promise<{ dimensions: ImageDimensions; croppedImageUrl: string }> {
    return new Promise(async (resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = async () => {
            try {
                const dpi = await readDPIFromFile(file);
                const bbox = await calculateBoundingBox(img);
                const widthCm = pxToCm(bbox.width, dpi);
                const heightCm = pxToCm(bbox.height, dpi);

                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = bbox.width;
                cropCanvas.height = bbox.height;
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                    cropCtx.drawImage(img, -bbox.x, -bbox.y);
                    const maskData = await generateCollisionMask(cropCanvas as any, widthCm, heightCm);

                    // Gerar URL da imagem recortada
                    cropCanvas.toBlob((blob) => {
                        if (blob) {
                            const croppedUrl = URL.createObjectURL(blob);
                            URL.revokeObjectURL(url); // Liberar URL original temporária
                            resolve({
                                dimensions: {
                                    widthCm, heightCm, widthPx: bbox.width, heightPx: bbox.height, dpi,
                                    mask: maskData.mask, maskWidth: maskData.maskWidth, maskHeight: maskData.maskHeight
                                },
                                croppedImageUrl: croppedUrl
                            });
                        } else {
                            reject(new Error('Falha ao gerar imagem recortada'));
                        }
                    }, 'image/png');
                } else throw new Error('Falha ao criar contexto');
            } catch (error) { URL.revokeObjectURL(url); reject(error); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Erro ao carregar imagem')); };
        img.src = url;
    });
}

/**
 * Engine principal de otimização
 */
export function optimizeLayout(dimensions: ImageDimensions, customSpacingPx?: number, canvasWidthCm: number = DEFAULT_CANVAS_WIDTH_CM): PackingResult {
    const { widthCm, heightCm, mask, maskWidth, maskHeight } = dimensions;
    const spacingPx = customSpacingPx ?? SPACING_PX;
    const spacingCm = pxToCm(spacingPx, 300);
    const bleedCm = pxToCm(BLEED_PX * 2, 300);

    /* 
       LÓGICA DE ROTAÇÃO INTELIGENTE:
       Prioridade 1: Encaixar na largura (57cm)
       Prioridade 2: Maximizar número de colunas (cópias lado a lado)
       Prioridade 3: Se empatar colunas, usar a orientação que "enche" mais a largura (evita sobras inúteis de <7cm)
    */

    // Cenário 1: Original
    const scenarioOriginal = calculateScenario(mask, widthCm, heightCm, maskWidth || 0, maskHeight || 0, 0, widthCm, heightCm, spacingCm, canvasWidthCm);

    // Cenário 2: Rotacionado 90°
    let scenarioRotated = { count: 0, positions: [] as number[], wastedSpace: Infinity, isRotated: true };
    if (mask && maskWidth && maskHeight) {
        const rot90 = rotateMask90(mask, maskWidth, maskHeight);
        scenarioRotated = {
            ...calculateScenario(rot90.mask, heightCm, widthCm, rot90.width, rot90.height, 90, heightCm, widthCm, spacingCm, canvasWidthCm),
            isRotated: true
        };
    } else {
        // Fallback sem máscara - Reusing logic including tolerance/clamping
        scenarioRotated = {
            ...calculateScenario(undefined, heightCm, widthCm, 0, 0, 90, heightCm, widthCm, spacingCm, canvasWidthCm),
            isRotated: true
        };
    }

    // Decisão
    let finalScenario = scenarioOriginal;
    let rotation: 0 | 90 = 0;

    // Regra especial: FORCE ROTATE se a altura for "quase" 57cm (largura total)
    // Isso atende o pedido "force arquivos com 57 deitar"
    // Usamos tolerância de 1.0cm para aceitar até 58cm (que será clampado)
    const isHeightPerfectFit = Math.abs(heightCm - canvasWidthCm) < 1.0;

    // Regra especial: Se altura é MAIOR que canvas (dentro de um limite razoável) e largura é MENOR
    // Rotacionar pode fazer caber melhor (virando largura)
    const isHeightTooBigButWidthFits = heightCm > canvasWidthCm && widthCm <= canvasWidthCm;

    // Se a rotação é perfeita para a largura E é válida (cabe na folha), força a rotação
    if ((isHeightPerfectFit || isHeightTooBigButWidthFits) && scenarioRotated.count > 0) {
        finalScenario = scenarioRotated;
        rotation = 90;
    }
    // Regra Padrão: Se a rotação permitir mais colunas, use-a.
    else if (scenarioRotated.count > scenarioOriginal.count) {
        finalScenario = scenarioRotated;
        rotation = 90;
    } else if (scenarioRotated.count === scenarioOriginal.count) {
        // Empate de colunas: Preferir a que ocupa mais largura (menos sobra lateral)
        const wasteOrig = scenarioOriginal.wastedSpace;
        const wasteRot = scenarioRotated.wastedSpace;

        // Tolerância de ponto flutuante para comparação com 0
        if (wasteRot < wasteOrig && wasteRot > -0.01) {
            finalScenario = scenarioRotated;
            rotation = 90;
        }
    }

    // Calcular sugestão de resize
    let suggestion: OptimizationSuggestion | undefined = undefined;

    const stampW = rotation === 0 ? widthCm : heightCm;

    // REGRAS ESPECÍFICAS DO USUÁRIO

    // Regra 1: 29cm a 38cm -> Sugerir redimensionar para 28cm
    // Motivo: 29cm não cabe 2 na folha de 57cm, mas 28cm cabe (28+28=56).
    if (stampW >= 29 && stampW <= 38) {
        const targetW = 28;
        const ratio = targetW / stampW;
        const newW = rotation === 0 ? targetW : (widthCm * ratio);
        const newH = rotation === 0 ? (heightCm * ratio) : targetW;

        suggestion = {
            type: 'resize',
            message: `Dimensão de ${stampW.toFixed(1)}cm desperdiça papel! Reduza para 28cm para caber 2 unidades lado a lado.`,
            currentSize: { width: widthCm, height: heightCm },
            suggestedSize: { width: newW, height: newH },
            improvement: {
                additionalCopies: 1, // Assume que vai de 1 para 2 (ou dobra a capacidade da linha)
                sizeReduction: stampW - targetW
            }
        };
    }
    // Regra 2: 39cm a 49cm -> Alerta de encaixe ruim
    else if (stampW >= 39 && stampW <= 49) {
        suggestion = {
            type: 'warning',
            message: 'Encaixe ruim: A estampa ocupa muito espaço e só cabe 1 unidade na largura.',
            currentSize: { width: widthCm, height: heightCm }
        };
    }
    // Lógica Genérica de Otimização (Fallback)
    else {
        const currentCols = finalScenario.count;
        const targetCols = currentCols + 1;

        // Largura disponível para cada item se quisermos N+1 colunas
        // (Width - Margens) / (N+1) - Espaçamento
        const availableTotalWidth = canvasWidthCm - bleedCm;
        const targetItemWidth = (availableTotalWidth - (targetCols - 1) * spacingCm) / targetCols;

        const currentItemWidth = stampW;
        const diff = currentItemWidth - targetItemWidth;

        // Se a diferença for pequena (ex: < 4cm ou < 10% do tamanho), sugerir
        if (diff > 0 && diff < 4 && targetItemWidth > MIN_RESIZE_CM) {
            const reductionPercent = (diff / currentItemWidth) * 100;
            if (reductionPercent < 15) { // Max 15% de redução
                const ratio = targetItemWidth / currentItemWidth;
                const newW = rotation === 0 ? targetItemWidth : (widthCm * ratio);
                const newH = rotation === 0 ? (heightCm * ratio) : targetItemWidth;

                suggestion = {
                    type: 'resize',
                    message: `Reduza sua imagem de ${rotation === 0 ? widthCm.toFixed(1) : heightCm.toFixed(1)}cm para ${newW.toFixed(1)}cm para ganhar +1 coluna de impressão!`,
                    currentSize: { width: widthCm, height: heightCm },
                    suggestedSize: { width: newW, height: newH },
                    improvement: {
                        additionalCopies: 1,
                        sizeReduction: currentItemWidth - targetItemWidth
                    }
                };
            }
        }
    }

    // Decisão final
    if (finalScenario.count > 0) {
        const stampH = rotation === 0 ? heightCm : widthCm;

        return {
            success: true,
            copies: finalScenario.count,
            rotation: rotation,
            stampWidthCm: stampW,
            stampHeightCm: stampH,
            canvasWidthCm: canvasWidthCm,
            canvasHeightCm: stampH + bleedCm,
            wastedSpaceCm: canvasWidthCm - (finalScenario.count * (stampW + spacingCm)) + spacingCm,
            nestingMode: 'standard',
            itemPositions: finalScenario.positions,
            suggestion
        };
    }

    return { success: false, copies: 0, rotation: 0, canvasWidthCm: canvasWidthCm, canvasHeightCm: 0, wastedSpaceCm: 0, stampWidthCm: widthCm, stampHeightCm: heightCm, nestingMode: 'standard', error: `Não cabe na folha (${canvasWidthCm}cm)!` };
}

function calculateScenario(
    mask: Uint8Array | undefined,
    wCm: number, hCm: number,
    mW: number, mH: number,
    rot: number,
    origW: number, origH: number,
    spacingCm: number,
    canvasWidthCm: number
) {
    // Tolerância para aceitar largura exata (ignorando erro de ponto flutuante)
    if (wCm > canvasWidthCm + 0.05) return { count: 0, positions: [] as number[], wastedSpace: Infinity };

    // Se o item for maior que a largura (dentro da tolerância), clampar para cálculo
    const effectiveWCm = Math.min(wCm, canvasWidthCm);

    const standardBleedCm = pxToCm(BLEED_PX * 2, 300);

    // Se o item ocupa quase toda a largura, remover o bleed para permitir encaixe exato
    const isTightFit = effectiveWCm > (canvasWidthCm - standardBleedCm - 0.5);
    const appliedBleedCm = isTightFit ? 0 : standardBleedCm;

    // Largura disponível para itens (descontando margens de ambos os lados)
    const availableWidth = canvasWidthCm - appliedBleedCm;

    // Cálculo de colunas: primeiro item não tem espaçamento à esquerda
    // Fórmula: availableWidth >= N * itemWidth + (N-1) * spacing
    // Simplificando: N <= (availableWidth + spacing) / (itemWidth + spacing)
    const cols = Math.floor((availableWidth + spacingCm) / (effectiveWCm + spacingCm));

    return {
        count: Math.max(0, cols),
        positions: [] as number[],
        wastedSpace: availableWidth - (cols * effectiveWCm + (cols - 1) * spacingCm)
    };
}

/**
 * Gera layout final
 */
export function generateFinalLayout(result: PackingResult, customSpacingPx?: number): FinalLayout | null {
    if (!result.success || result.copies === 0) return null;
    const items: LayoutItem[] = [];
    const standardBleedCm = pxToCm(BLEED_PX, 300); // Margin per side

    // Check if tight fit (same logic as optimize)
    const isTightFit = result.stampWidthCm > (result.canvasWidthCm - (standardBleedCm * 2) - 0.5);

    // Se for tight fit, centralizar ou encostar na borda (x=0 se width=57). 
    // Vamos centralizar: (canvasWidth - width) / 2.
    const startX = isTightFit ? (result.canvasWidthCm - result.stampWidthCm) / 2 : standardBleedCm;

    const spacingPx = customSpacingPx ?? SPACING_PX;
    const spacingCm = pxToCm(spacingPx, 300);

    for (let i = 0; i < result.copies; i++) {
        let rotation = result.rotation;
        if (result.nestingMode === 'alternating' && i % 2 === 1) {
            rotation = (rotation + 180) % 360 as 0 | 90 | 180 | 270;
        }

        // Corrigido: itemPositions pode estar vazio, então calculamos linearmente
        // Cada item é posicionado lado a lado com espaçamento
        const posFromArray = result.itemPositions && result.itemPositions.length > i ? result.itemPositions[i] : null;

        // Se temos posições calculadas (não implementado no MVP simples acima, mas mantendo compatibilidade)
        // Se não, linear: startX + i * (width + space)
        const x = posFromArray !== null ? (posFromArray + (isTightFit ? 0 : standardBleedCm)) : (startX + i * (result.stampWidthCm + spacingCm));

        console.log('[PACKING] Item', i, 'posição:', { x, y: standardBleedCm, stampW: result.stampWidthCm, stampH: result.stampHeightCm });

        items.push({
            x,
            y: standardBleedCm, // Top Barrier (mantemos margem superior padrão)
            width: result.stampWidthCm,
            height: result.stampHeightCm,
            rotation: rotation as 0 | 90 | 180 | 270
        });
    }

    // Canvas Height = Top Margin + Content Height + Bottom Margin
    // Minimal vertical space
    const totalHeight = standardBleedCm + result.stampHeightCm + standardBleedCm;

    return { canvasWidth: result.canvasWidthCm, canvasHeight: totalHeight, items, totalCopies: result.copies };
}

/**
 * Novo Modo: Preenchimento Livre / Misto
 * Recebe uma lista expandida de itens (já considerando as quantidades)
 * e tenta encaixá-los na ordem, linha por linha.
 */
export function packFreeMode(
    itemsToPack: { id: string, lineId: string, url: string, widthCm: number, heightCm: number, spacingPx: number, rotation?: number }[],
    canvasWidthCm: number,
    globalSpacingYPx: number
): FinalLayout | null {
    if (itemsToPack.length === 0) return null;

    const standardBleedCm = pxToCm(BLEED_PX, 300);
    const availableWidthCm = canvasWidthCm - (standardBleedCm * 2);

    const layoutItems: LayoutItem[] = [];

    // Ordernar por área ou altura
    const sortedItems = [...itemsToPack].sort((a, b) => (b.widthCm * b.heightCm) - (a.widthCm * a.heightCm));

    interface SkylineSegment {
        x: number;
        w: number;
        y: number;
    }
    let skyline: SkylineSegment[] = [{ x: standardBleedCm, w: availableWidthCm, y: standardBleedCm }];

    for (const item of sortedItems) {
        const safeWidthCm = (isNaN(item.widthCm) || !isFinite(item.widthCm) || item.widthCm <= 0) ? 10 : item.widthCm;
        const safeHeightCm = (isNaN(item.heightCm) || !isFinite(item.heightCm) || item.heightCm <= 0) ? 10 : item.heightCm;

        const itemSpacingXCm = pxToCm(item.spacingPx || 20, 300);
        const itemSpacingYCm = pxToCm(globalSpacingYPx || 20, 300);

        const W = safeWidthCm + itemSpacingXCm;
        const H = safeHeightCm + itemSpacingYCm;

        let bestY = Infinity;
        let bestX = -1;

        for (let i = 0; i < skyline.length; i++) {
            const segment = skyline[i];

            if (segment.x + W <= canvasWidthCm - standardBleedCm + 0.001) {
                let maxY = segment.y;
                let fitW = 0;
                let fitPossible = false;

                for (let j = i; j < skyline.length; j++) {
                    const checkSeg = skyline[j];
                    if (checkSeg.y > maxY) maxY = checkSeg.y;

                    fitW += checkSeg.w;
                    if (fitW >= W - 0.001) {
                        fitPossible = true;
                        break;
                    }
                }

                if (fitPossible) {
                    if (maxY < bestY) {
                        bestY = maxY;
                        bestX = segment.x;
                    }
                }
            }
        }

        if (bestX === -1) {
            bestX = standardBleedCm;
            bestY = skyline.reduce((max, s) => Math.max(max, s.y), 0);
        }

        layoutItems.push({
            x: bestX,
            y: bestY,
            width: safeWidthCm,
            height: safeHeightCm,
            rotation: item.rotation || 0,
            lineId: item.lineId,
            imageUrl: item.url
        } as any);

        const newY = bestY + H;
        const newSegment: SkylineSegment = { x: bestX, w: W, y: newY };

        const newSkyline: SkylineSegment[] = [];
        for (const seg of skyline) {
            const segEndX = seg.x + seg.w;
            const newEndX = newSegment.x + newSegment.w;

            if (segEndX <= newSegment.x || seg.x >= newEndX) {
                newSkyline.push(seg);
            } else {
                if (seg.x < newSegment.x) {
                    newSkyline.push({ x: seg.x, w: newSegment.x - seg.x, y: seg.y });
                }
                if (segEndX > newEndX) {
                    newSkyline.push({ x: newEndX, w: segEndX - newEndX, y: seg.y });
                }
            }
        }

        newSkyline.push(newSegment);
        newSkyline.sort((a, b) => a.x - b.x);

        skyline = [];
        let currentSeg: SkylineSegment | null = null;
        for (const seg of newSkyline) {
            if (!currentSeg) currentSeg = { ...seg };
            else if (Math.abs(currentSeg.y - seg.y) < 0.001) currentSeg.w += seg.w;
            else {
                skyline.push(currentSeg);
                currentSeg = { ...seg };
            }
        }
        if (currentSeg) skyline.push(currentSeg);
    }

    let totalHeight = standardBleedCm;
    for (const item of layoutItems) {
        totalHeight = Math.max(totalHeight, item.y + item.height + standardBleedCm);
    }

    if (isNaN(totalHeight) || !isFinite(totalHeight)) totalHeight = 40;
    totalHeight = Math.min(totalHeight, 10000);

    return {
        canvasWidth: canvasWidthCm,
        canvasHeight: totalHeight,
        items: layoutItems,
        totalCopies: itemsToPack.length
    };
}
