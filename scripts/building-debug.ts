import { getScaledBuildingBounds } from "../src/building-scale";
import { LAYOUT, MAPS } from "../src/layout-maps";

const entries = [
  ...MAPS.livingArea.buildings.map((building) => ({
    name: building.style === "barn" ? "animalBarn" : "playerHouse",
    building,
    fallbackScale: 1,
  })),
  ...LAYOUT.oldVillage.houses.map((building) => ({
    name: `oldVillage:${building.role}`,
    building,
    fallbackScale: LAYOUT.oldVillage.houseVisualScale,
  })),
];

for (const { name, building, fallbackScale } of entries) {
  const bounds = getScaledBuildingBounds(building, fallbackScale);
  const doorHeight =
    (building as { doorWorldHeight?: number }).doorWorldHeight ||
    (name.startsWith("oldVillage:")
      ? LAYOUT.oldVillage.houseDoorWorldHeight
      : null);
  console.log(
    `${name.padEnd(28)} scale=${bounds.scale.toFixed(2)} ` +
      `bounds=(${bounds.minX.toFixed(2)},${bounds.minZ.toFixed(2)})..` +
      `(${bounds.maxX.toFixed(2)},${bounds.maxZ.toFixed(2)}) ` +
      `doorX=${building.doorX ?? "-"} corridorHalf=${bounds.doorHalfWidth.toFixed(2)} ` +
      `doorHeight=${doorHeight ?? "default"}`,
  );
}
