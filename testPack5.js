import { packItems2D } from "./src/utils/binPacking.js";
import fs from 'fs';

let out = "";
const q = 12;
const items = [
    { id: "1", width: 10, height: 10, quantity: q, allowRotation: false }
];

const result = packItems2D(55, 1, items);

out += `Total Height: ${result.totalHeightCm}\n`;
out += "Placed Items:\n";
result.placedItems.forEach(item => {
    out += `[id:${item.id}] x:${item.x}, y:${item.y}\n`;
});

fs.writeFileSync("out5.txt", out, "utf8");
