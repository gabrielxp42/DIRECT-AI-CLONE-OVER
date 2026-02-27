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
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
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

    // Parte de cima (antes de Y ocupar)
    if (usedNode.y > freeNode.y && usedNode.y < freeNode.y + freeNode.h) {
        results.push({
            x: freeNode.x,
            y: freeNode.y,
            w: freeNode.w,
            h: usedNode.y - freeNode.y
        });
    }

    // Parte de baixo (depois de Y ocupar)
    if (usedNode.y + usedNode.h < freeNode.y + freeNode.h) {
        results.push({
            x: freeNode.x,
            y: usedNode.y + usedNode.h,
            w: freeNode.w,
            h: freeNode.y + freeNode.h - (usedNode.y + usedNode.h)
        });
    }

    // Parte da esquerda (antes de X ocupar)
    if (usedNode.x > freeNode.x && usedNode.x < freeNode.x + freeNode.w) {
        results.push({
            x: freeNode.x,
            y: freeNode.y,
            w: usedNode.x - freeNode.x,
            h: freeNode.h
        });
    }

    // Parte da direita (depois de X ocupar)
    if (usedNode.x + usedNode.w < freeNode.x + freeNode.w) {
        results.push({
            x: usedNode.x + usedNode.w,
            y: freeNode.y,
            w: freeNode.x + freeNode.w - (usedNode.x + usedNode.w),
            h: freeNode.h
        });
    }

    return results;
}

/**
 * Remove retângulos livres que estão 100% contidos em outros retângulos livres (limpeza)
 */
function pruneFreeList(freeRects: Rect[]): Rect[] {
    return freeRects.filter((rectA, i) => {
        for (let j = 0; j < freeRects.length; j++) {
            if (i === j) continue;
            const rectB = freeRects[j];
            if (rectA.x >= rectB.x && rectA.y >= rectB.y &&
                rectA.x + rectA.w <= rectB.x + rectB.w &&
                rectA.y + rectA.h <= rectB.y + rectB.h) {
                return false; // rectA está inserido em rectB, podemos removê-lo
            }
        }
        return true;
    });
}

/**
 * Função de empacotamento em Prateleira (Shelf Packing) melhorado.
 * Garante o alinhamento em "linhas" horizontais para facilitar o corte em guilhotina,
 * agrupando as sobras na borda direita em vez de misturar os logos.
 */
export function packItems2D(
    usableWidth: number,
    separation: number,
    itemsToPack: PackableItem[]
): BinPackingResult {
    const placedItems: PlacedItem[] = [];
    let totalItemsOverflowing = 0;
    let itemsToOptimize = 0;

    // 1. Expansão dos itens virtuais. 
    // Diferente do MaxRects, NÃO vamos embaralhar todos os itens baseados em área para o Shelf,
    // porque o usuário expressamente quer "organização" por tipo de logotipo.
    // Vamos mantê-los agrupados (logo A, depois logo B).
    const expandedItems: (PackableItem & { originalIndex: number })[] = [];
    itemsToPack.forEach((item, index) => {
        for (let i = 0; i < item.quantity; i++) {
            expandedItems.push({ ...item, originalIndex: index });
        }
    });

    // Cursor e Prateleiras
    let currentX = 0;
    let shelfY = 0;
    let currentShelfHeight = 0;
    let lastOriginalIndex = -1;

    expandedItems.forEach((item) => {
        let pw = item.width;
        let ph = item.height;
        let rotated = false;
        let isOverflowing = false;

        // Se o item sozinho já é maior que o rolo
        if (pw > usableWidth) {
            if (item.allowRotation !== false && ph <= usableWidth) {
                // Tenta girar pro item caber se couber
                const temp = pw;
                pw = ph;
                ph = temp;
                rotated = true;
                itemsToOptimize++;
            } else {
                isOverflowing = true;
                totalItemsOverflowing++;
            }
        } else if (item.allowRotation !== false) {
            // Otimização "Burra": Opcional: só rotaciona se a versão rodada gastar *menos largura* neste momento
            // Mas o usuário preferiu alinhar igual, então por padrão vamos respeitar a orientação visual na Shelf
        }

        // Calcula a largura que este bloco exigirá (incluindo a margem da direita caso não seja o último do rolo)
        // No algoritmo Shelf, nós testamos primeiro se ele cabe na prateleira atual
        const widthNeeded = currentX === 0 ? pw : pw + separation;

        // REGRA DE OURO DE ORGANIZAÇÃO: Se mudou o logo (originalIndex diferente do anterior),
        // E já tem algo na prateleira atual, FORÇA a quebra de linha para não misturar trabalhos.
        const changedLogo = lastOriginalIndex !== -1 && item.originalIndex !== lastOriginalIndex;

        // Se o item não cabe na prateleira atual (ultrapassou largura útil) OU mudou de logo
        if ((currentX + widthNeeded > usableWidth && currentX > 0) || (changedLogo && currentX > 0)) {
            // Fecha a prateleira atual, desce Y e zera X
            shelfY += currentShelfHeight + separation;
            currentX = 0;
            currentShelfHeight = 0;
        }

        lastOriginalIndex = item.originalIndex;

        // Posição Final da Arte na Prateleira
        const finalX = currentX === 0 ? 0 : currentX + separation;

        placedItems.push({
            ...item,
            x: finalX,
            y: shelfY,
            packWidth: pw,
            packHeight: ph,
            rotated,
            isOverflowing
        });

        // Atualiza cursores da prateleira atual
        currentX = finalX + pw;
        if (ph > currentShelfHeight) {
            currentShelfHeight = ph; // A prateleira precisa esticar para cobrir o item mais alto nela
        }
    });

    // O Total estipulado é a soma da última prateleira com as de cima
    let totalHeightCm = shelfY + currentShelfHeight;

    // Se a lista estiver vazia
    if (placedItems.length === 0) {
        totalHeightCm = 0;
    }

    return {
        totalHeightCm,
        placedItems,
        totalItemsOverflowing,
        itemsToOptimize
    };
}
