import { packItems2D } from "./src/utils/binPacking.js";
import fs from 'fs';

let out = "";
const q = 17;
const items = [
    { id: "1", width: 11.2, height: 14.8, quantity: q, allowRotation: false }
];

const result = packItems2D(58, 1, items);

out += `Total Height: ${result.totalHeightCm}\n`;
out += "Placed Items:\n";
result.placedItems.forEach(item => {
    out += `[id:${item.id}] x:${item.x}, y:${item.y}\n`;
});

fs.writeFileSync("out4.txt", out, "utf8");
