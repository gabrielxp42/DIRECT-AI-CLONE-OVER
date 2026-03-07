import { packItems2D } from "./src/utils/binPacking.js";

function detectEShape(placedItems) {
    // Collect rows
    const rows = {};
    placedItems.forEach(item => {
        if (!rows[item.y]) rows[item.y] = 0;
        rows[item.y]++;
    });

    // Sort Ys
    const ys = Object.keys(rows).map(Number).sort((a, b) => a - b);

    if (ys.length >= 3) {
        // Check for pattern: Many, 1, Many
        for (let i = 0; i < ys.length - 2; i++) {
            if (rows[ys[i]] > 1 && rows[ys[i + 1]] === 1 && rows[ys[i + 2]] > 1) {
                return true;
            }
        }
    }
    return false;
}

let found = false;
for (let width = 5; width <= 15; width += 0.1) {
    for (let height = 5; height <= 15; height += 0.1) {
        for (let sep = 0; sep <= 2; sep += 0.5) {
            for (let useW = 56; useW <= 58; useW += 1) {
                const items = [{ id: "1", width: width, height: height, quantity: 15, allowRotation: false }];
                const res = packItems2D(useW, sep, items);
                if (detectEShape(res.placedItems)) {
                    console.log(`FOUND BUG! w=${width}, h=${height}, sep=${sep}, useW=${useW}`);
                    found = true;
                }
            }
        }
    }
}
if (!found) console.log("No E shape found in fuzzing!");
