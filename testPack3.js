import { packItems2D } from "./src/utils/binPacking.js";

import fs from 'fs';

let out = "";
for (let q = 1; q <= 12; q++) {
    const items = [
        { id: "1", width: 10, height: 15, quantity: q, allowRotation: false }
    ];

    const result = packItems2D(58, 1, items);

    out += `\n--- Quantity ${q} ---\n`;
    result.placedItems.forEach(item => {
        out += `[id:${item.id}] x:${item.x}, y:${item.y}\n`;
    });
}

fs.writeFileSync("out3.txt", out, "utf8");
