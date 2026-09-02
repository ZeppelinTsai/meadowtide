import "./jsdom-setup";
import { gameState } from "../src/game-state";
import { FLOWER_BED_TILES, LAYOUT } from "../src/layout-maps";

gameState.currentMapName = "livingArea";

const { flowerBedGroup, syncFlowerBedVisuals } = await import("../src/farm-visuals");

console.log("LAYOUT.garden:", LAYOUT.garden);
console.log("FLOWER_BED_TILES:", FLOWER_BED_TILES);
console.log("currentMapName:", gameState.currentMapName);

syncFlowerBedVisuals();

console.log("flowerBedGroup.visible:", flowerBedGroup.visible);
console.log("flowerBedGroup.children.length:", flowerBedGroup.children.length);
flowerBedGroup.children.forEach((c: any, i: number) => {
  console.log(i, c.type, c.position.x, c.position.y, c.position.z);
});
