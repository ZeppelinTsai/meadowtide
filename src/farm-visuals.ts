import * as THREE from "three";
import { PLATEAU_Y, scene } from "./scene-sky";
import { gameState, cropState } from "./game-state";
import { FARMLAND_TILES, POUCH_POS } from "./layout-maps";
import { makeSoil, makeCropMesh, makeSeedPouch } from "./props";

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
            const mesh = makeCropMesh(c.stage);
            mesh.position.x += x;
            mesh.position.z += z;
            farmGroup.add(mesh);
          }
        });
        if (gameState.currentDay > gameState.pouchCollectedDay) {
          const pouch = makeSeedPouch();
          pouch.position.set(POUCH_POS.x, 0, POUCH_POS.z);
          farmGroup.add(pouch);
        }
      }
