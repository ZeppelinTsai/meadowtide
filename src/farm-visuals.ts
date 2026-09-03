import * as THREE from "three";
import { PLATEAU_Y, scene } from "./scene-sky";
import { gameState, cropState, flowerBedState } from "./game-state";
import { FARMLAND_TILES, FLOWER_BED_TILES } from "./layout-maps";
import { makeSoil, makeCropMesh } from "./props";
import { makeFlowerBedMesh } from "./wildflowers";

// 農作獨立渲染層
export const farmGroup = new THREE.Group();
      farmGroup.position.y = PLATEAU_Y; // 農地固定在高台範圍內，直接給一個定值就好
      scene.add(farmGroup);
      export function syncFarmVisuals() {
        farmGroup.clear();
        if (gameState.currentMapName !== "livingArea") {
          farmGroup.visible = false;
          return;
        }
        farmGroup.visible = true;
        FARMLAND_TILES.forEach(([x, z]) => {
          farmGroup.add(makeSoil(x, z));
          const c = cropState[`${x},${z}`];
          if (c) {
            const mesh = makeCropMesh(c.stage, c.cropType ?? "radish");
            mesh.position.x += x;
            mesh.position.z += z;
            farmGroup.add(mesh);
          }
        });
      }

// 花田——渲染邏輯照抄上面 syncFarmVisuals()，只是讀 flowerBedState/
// FLOWER_BED_TILES 而不是 cropState/FARMLAND_TILES；圍籬是靜態場景
// (build-map.ts 蓋一次)，這裡只管每格的土/花本身。
export const flowerBedGroup = new THREE.Group();
flowerBedGroup.position.y = PLATEAU_Y;
scene.add(flowerBedGroup);
export function syncFlowerBedVisuals() {
  flowerBedGroup.clear();
  if (gameState.currentMapName !== "livingArea") {
    flowerBedGroup.visible = false;
    return;
  }
  flowerBedGroup.visible = true;
  FLOWER_BED_TILES.forEach(([x, z]) => {
    // 這片花田原本疊在 makeSmallGarden() 的草坪上，土要墊到 0.045 才
    // 不會被草坪蓋住(見 git log)；2026-09-04 makeSmallGarden() 的草坪/
    // 步道/鳥浴盆整個拿掉後(build-map.ts)，改回跟一般農地
    // (syncFarmVisuals())同一套 makeSoil() 預設高度。
    flowerBedGroup.add(makeSoil(x, z));
    const bed = flowerBedState[`${x},${z}`];
    if (bed) {
      const mesh = makeFlowerBedMesh(bed.stage, bed.species);
      mesh.position.x += x;
      mesh.position.z += z;
      flowerBedGroup.add(mesh);
    }
  });
}
