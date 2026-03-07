import { packItems2D } from "./src/utils/binPacking.js";
const items = [{ id: "1", width: 10, height: 10, quantity: 50, allowRotation: false }];
const result = packItems2D(57.6, 0.2, items);
console.log("Total Height:", result.totalHeightCm);
