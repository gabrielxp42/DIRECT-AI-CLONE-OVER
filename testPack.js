import { packItems2D } from "./src/utils/binPacking.js";

const items = [
    { id: "1", width: 10, height: 10, quantity: 18, allowRotation: false }
];

const result = packItems2D(58, 1, items);

import fs from 'fs';

let out = "";
out += "Total Height: " + result.totalHeightCm + "\n";
out += "Placed Items:\n";
result.placedItems.forEach(item => {
    out += `id: ${item.id}, x: ${item.x}, y: ${item.y}, w: ${item.packWidth}, h: ${item.packHeight}\n`;
});

fs.writeFileSync("out.txt", out, "utf8");
