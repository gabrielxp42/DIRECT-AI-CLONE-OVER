import { packItems2D } from "./src/utils/binPacking.js";
import fs from 'fs';

let out = "";
for (let useW = 55; useW <= 59; useW += 0.1) {
    for (let sep = 0; sep <= 1; sep += 0.1) {
        for (let margin = 0; margin <= 2; margin += 0.5) {
            const items = [
                { id: "1", width: 10, height: 10, quantity: 50, allowRotation: false }
            ];
            const result = packItems2D(useW, sep, items);
            const total = result.totalHeightCm + (margin * 2);
            if (Math.abs(total - 153.2) < 0.5) {
                out += `Match! totalHeightCm=${total}, useW=${useW}, sep=${sep}, margin=${margin}\n`;
            }
        }
    }
}
fs.writeFileSync("out7.txt", out, "utf8");
