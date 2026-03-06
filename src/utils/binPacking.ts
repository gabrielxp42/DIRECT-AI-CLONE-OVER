export interface PackableItem {
    id: string;
    width: number;
    height: number;
    quantity: number;
    allowRotation?: boolean;
    [key: string]: any; // Permite dados adicionais como cores, labels
}

export interface PlacedItem extends PackableItem {
    x: number;
    y: number;
    rotated: boolean;
    packWidth: number;
    packHeight: number;
    isOverflowing: boolean;
}

export interface BinPackingResult {
    totalHeightCm: number;
    placedItems: PlacedItem[];
    totalItemsOverflowing: number;
    itemsToOptimize: number;
    contentWidth: number; // Nova métrica para alinhar container
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Arredonda valores para evitar erros de ponto flutuante que quebram a heurística geométrica (ex: 10.200000000000001)
 */
function roundFloat(val: number): number {
    return Math.round(val * 1000) / 1000;
}

/**
 * Divide um retângulo livre em retângulos menores (sem a área consumida)
 */
function splitFreeNode(freeNode: Rect, usedNode: Rect): Rect[] {
    const results: Rect[] = [];

    // Se não há intersecção, o nó livre permanece intacto
    if (usedNode.x >= freeNode.x + freeNode.w || usedNode.x + usedNode.w <= freeNode.x ||
        usedNode.y >= freeNode.y + freeNode.h || usedNode.y + usedNode.h <= freeNode.y) {
        return [freeNode];
    }

    // Parte de cima
    if (usedNode.y > freeNode.y && usedNode.y < freeNode.y + freeNode.h) {
        results.push({
            x: freeNode.x,
            y: freeNode.y,
            w: freeNode.w,
            h: roundFloat(usedNode.y - freeNode.y)
        });
    }

    // Parte de baixo
    if (usedNode.y + usedNode.h < freeNode.y + freeNode.h) {
        results.push({
            x: freeNode.x,
            y: roundFloat(usedNode.y + usedNode.h),
            w: freeNode.w,
            h: roundFloat(freeNode.y + freeNode.h - (usedNode.y + usedNode.h))
        });
    }

    // Parte da esquerda
    if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.w) {
        results.push({
            x: freeNode.x,
            y: freeNode.y,
            w: roundFloat(usedNode.x - freeNode.x),
            h: freeNode.h
        });
    }

    // Parte da direita
    if (usedNode.x + usedNode.w < freeNode.x + freeNode.w) {
        results.push({
            x: roundFloat(usedNode.x + usedNode.w),
            y: freeNode.y,
            w: roundFloat(freeNode.x + freeNode.w - (usedNode.x + usedNode.w)),
            h: freeNode.h
        });
    }

    return results;
}

/**
 * Remove retângulos livres que estão 100% contidos em outros retângulos livres (limpeza)
 */
function pruneFreeList(freeRects: Rect[]): Rect[] {
    const EPSILON = 0.001; // Tolerância para flutuantes
    return freeRects.filter((rectA, i) => {
        for (let j = 0; j < freeRects.length; j++) {
            if (i === j) continue;
            const rectB = freeRects[j];
            // Verifica se A está contido em B com pequena tolerância
            if (rectA.x >= rectB.x - EPSILON && rectA.y >= rectB.y - EPSILON &&
                rectA.x + rectA.w <= rectB.x + rectB.w + EPSILON &&
                rectA.y + rectA.h <= rectB.y + rectB.h + EPSILON) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Função de empacotamento em 2D com Heurística Bottom-Left (MaxRects adaptado).
 * Encaixa os itens preenchendo o espaço disponível mais abaixo (menor Y) possível.
 * HMR BUSTER: ${Date.now()}
 */
export function packItems2D(
    usableWidth: number,
    separation: number,
    itemsToPack: PackableItem[]
): BinPackingResult {
    const placedItems: PlacedItem[] = [];
    let totalItemsOverflowing = 0;
    let itemsToOptimize = 0;

    const expandedItems: (PackableItem & { originalIndex: number })[] = [];
    itemsToPack.forEach((item, index) => {
        for (let i = 0; i < item.quantity; i++) {
            expandedItems.push({ ...item, originalIndex: index });
        }
    });

    let freeRects: Rect[] = [{ x: 0, y: 0, w: usableWidth, h: 9999999 }];
    let contentWidth = 0;
    let totalHeightCm = 0;

    expandedItems.forEach((item) => {
        let pw = Number(item.width) || 0;
        let ph = Number(item.height) || 0;
        const sep = Number(separation) || 0;
        let rotated = false;
        let isOverflowing = false;

        if (pw > usableWidth) {
            if (item.allowRotation !== false && ph <= usableWidth) {
                const temp = pw;
                pw = ph;
                ph = temp;
                rotated = true;
                itemsToOptimize++;
            } else {
                isOverflowing = true;
                totalItemsOverflowing++;
                return; // Pula este item pois ele não cabe de forma alguma
            }
        }

        let bestNodeIndex = -1;
        let bestY = Infinity;
        let bestX = Infinity;

        // Heurística Bottom-Left: Menor Y primeiro, em caso de empate, Menor X.
        for (let i = 0; i < freeRects.length; i++) {
            const fr = freeRects[i];
            // Se o espaço livre for maior ou igual (com tolerância EPSILON)
            if (fr.w >= pw - 0.001 && fr.h >= ph - 0.001) {
                if (fr.y < bestY - 0.001 || (Math.abs(fr.y - bestY) <= 0.001 && fr.x < bestX)) {
                    bestNodeIndex = i;
                    bestY = fr.y;
                    bestX = fr.x;
                }
            }
        }

        if (bestNodeIndex === -1) {
            totalItemsOverflowing++;
            return;
        }

        placedItems.push({
            ...item,
            x: bestX,
            y: bestY,
            packWidth: pw,
            packHeight: ph,
            rotated,
            isOverflowing: false
        });

        contentWidth = Math.max(contentWidth, bestX + pw);
        totalHeightCm = Math.max(totalHeightCm, bestY + ph);

        // O rect que consome espaço precisa incluir a margem de separação
        const usedNode: Rect = {
            x: bestX,
            y: bestY,
            w: pw + sep,
            h: ph + sep
        };

        // Atualiza a lista de espaços livres dividindo-os com o espaço recém-usado
        let newFreeRects: Rect[] = [];
        for (const fr of freeRects) {
            newFreeRects = newFreeRects.concat(splitFreeNode(fr, usedNode));
        }

        freeRects = pruneFreeList(newFreeRects);
    });

    return {
        totalHeightCm,
        placedItems,
        totalItemsOverflowing,
        itemsToOptimize,
        contentWidth
    };
}
