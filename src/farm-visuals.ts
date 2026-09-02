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
// FLOWER_BED_TILES 而不是 cropState/FARMLAND_TILES；圍籬跟草坪/碎石
// 步道/鳥浴盆是靜態場景(build-map.ts 蓋一次)，這裡只管每格的花本身。
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
    // makeSoil() 原本是給沒有草坪蓋在上面的普通農地用的，y=0.01；這裡
    // 疊在 makeSmallGarden() 那片整片草坪(props-decor.ts，草坪頂面約
    // y=0.038)上面，太低會被草坪蓋住整個看不到土——2026-09-04 實機
    // 回報「花田被砍光光」，查出來就是這個。改成 0.045，跟同一個函式
    // 裡碎石步道(0.045)、makeGardenBed() 舊裝飾花圃的土(0.02，頂面
    // 0.045)同一個高度，是這個場景既有、已驗證會露出來的數字。
    const soil = makeSoil(x, z);
    soil.position.y = 0.045;
    flowerBedGroup.add(soil);
    const bed = flowerBedState[`${x},${z}`];
    if (bed) {
      const mesh = makeFlowerBedMesh(bed.stage, bed.species);
      mesh.position.x += x;
      mesh.position.z += z;
      flowerBedGroup.add(mesh);
    }
  });
}
