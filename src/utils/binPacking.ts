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
 * Função de empacotamento em Prateleira (Shelf Packing) com Centralização Automática.
 * Garante o alinhamento em "linhas" horizontais para facilitar o corte em guilhotina,
 * agrupando as sobras de forma igualitária (esq/dir).
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

    let currentX = 0;
    let shelfY = 0;
    let currentShelfHeight = 0;
    let lastOriginalIndex = -1;
    let contentWidth = 0;

    let currentShelfItems: any[] = [];

    const flushShelf = () => {
        if (currentShelfItems.length === 0) return;

        const shelfWidth = currentX;
        contentWidth = Math.max(contentWidth, shelfWidth);
        const slack = usableWidth - shelfWidth;
        const offsetX = Math.max(0, slack / 2); // Centraliza na prateleira

        currentShelfItems.forEach(i => {
            placedItems.push({
                ...i,
                x: i.x + offsetX,
                y: shelfY
            });
        });

        shelfY += currentShelfHeight + separation;
        currentX = 0;
        currentShelfHeight = 0;
        currentShelfItems = [];
    };

    expandedItems.forEach((item) => {
        let pw = item.width;
        let ph = item.height;
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
            }
        }

        const widthNeeded = currentX === 0 ? pw : pw + separation;
        const changedLogo = lastOriginalIndex !== -1 && item.originalIndex !== lastOriginalIndex;

        if ((currentX + widthNeeded > usableWidth && currentX > 0) || (changedLogo && currentX > 0)) {
            flushShelf();
        }

        lastOriginalIndex = item.originalIndex;
        const finalX = currentX === 0 ? 0 : currentX + separation;

        currentShelfItems.push({
            ...item,
            x: finalX,
            packWidth: pw,
            packHeight: ph,
            rotated,
            isOverflowing
        });

        currentX = finalX + pw;
        if (ph > currentShelfHeight) {
            currentShelfHeight = ph;
        }
    });

    // Despejar os últimos itens
    flushShelf();

    let totalHeightCm = shelfY > 0 ? shelfY - separation : 0;

    return {
        totalHeightCm,
        placedItems,
        totalItemsOverflowing,
        itemsToOptimize,
        contentWidth
    };
}
