export function packItems2D(
    usableWidth,
    separation,
    itemsToPack
) {
    const placedItems = [];
    let totalItemsOverflowing = 0;
    let itemsToOptimize = 0;

    const expandedItems = [];
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

    let currentShelfItems = [];

    const flushShelf = () => {
        if (currentShelfItems.length === 0) return;

        const shelfWidth = currentX;
        contentWidth = Math.max(contentWidth, shelfWidth);

        currentShelfItems.forEach(i => {
            placedItems.push({
                ...i,
                x: i.x,
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

        const widthNeeded = currentX === 0 ? pw : pw + separation;

        if (currentX + widthNeeded > usableWidth && currentX > 0) {
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

const items = [
    { id: "1", width: 10, height: 10, quantity: 18, allowRotation: false }
];

const result = packItems2D(58, 1, items);

import fs from 'fs';

let out = "";
out += "Total Height: " + result.totalHeightCm + "\n";
out += "Placed Items:\n";
result.placedItems.forEach(item => {
    out += `[id:${item.id}] x:${item.x}, y:${item.y}\n`;
});

fs.writeFileSync("out_shelf.txt", out, "utf8");
