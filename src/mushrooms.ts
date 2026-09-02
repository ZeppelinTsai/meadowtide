import * as THREE from "three";
import { hash2 } from "./utils";

// ==============================================================
// 蘑菇採集系統——目前只有香菇一個物種，架構比照 wildflowers.ts 的
// FlowerSpeciesId 留擴充空間（Zeppelin：「之後會有其他菇」）：之後新增
// 菇類時，比照這裡加新的 MushroomSpeciesId 值＋item-catalog.ts 註冊新
// item id＋MUSHROOM_SPECIES 加一筆，不用重寫周邊的採集點/存讀檔邏輯。
// item id 沿用專案裡本來就有的 "mushroom"（原本只有 prologue 劇情贈送、
// 沒有野外採集點，cooking-ui.ts 的烤蘑菇串食譜也吃這個 id）——沒有另外
// 改名，避免動到既有存檔欄位/食譜成本表。
// ==============================================================

export type MushroomSpeciesId = "mushroom";

export interface MushroomSpeciesDefinition {
  id: MushroomSpeciesId;
  label: string;
}

export const MUSHROOM_SPECIES: readonly MushroomSpeciesDefinition[] = [
  { id: "mushroom", label: "香菇" },
];

export function mushroomSpeciesLabel(id: MushroomSpeciesId): string {
  return MUSHROOM_SPECIES.find((s) => s.id === id)?.label ?? id;
}

export function isMushroomSpeciesId(id: string): id is MushroomSpeciesId {
  return MUSHROOM_SPECIES.some((s) => s.id === id);
}

// --------------------------------------------------------------
// 香菇——扁圓傘蓋（半球用 SphereGeometry 的 phiLength/thetaLength 切出
// 上半球再壓扁）+ 短粗菌柄，跟採集點的原木/岩塊一樣走 flatShading 低模
// 路線，不用外部貼圖。
// --------------------------------------------------------------
function makeShiitakeCap(): THREE.Group {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0xe4d3ae,
    flatShading: true,
    roughness: 0.9,
  });
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.036, 0.09, 7),
    stemMat,
  );
  stem.position.y = 0.045;
  stem.castShadow = true;
  g.add(stem);

  const capMat = new THREE.MeshStandardMaterial({
    color: 0x8a5a3a,
    flatShading: true,
    roughness: 0.88,
  });
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capMat,
  );
  cap.scale.y = 0.62;
  cap.position.y = 0.09;
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);

  // 傘蓋邊緣一圈淺色菌褶暗示——不用真的建摺頁幾何，一片壓扁的圓盤墊在
  // 傘蓋下緣就夠讀出「這是香菇不是石頭」，維持低模風格。
  const gillMat = new THREE.MeshStandardMaterial({
    color: 0xd9c39a,
    flatShading: true,
    roughness: 0.95,
  });
  const gill = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 9), gillMat);
  gill.position.y = 0.086;
  g.add(gill);

  return g;
}

// 單顆——用於背包/手持展示，跟叢生節點模型分開（比照 makeFlowerSpecimen）。
export function makeMushroomSpecimen(_species: MushroomSpeciesId): THREE.Group {
  return makeShiitakeCap();
}

// 採集點叢生模型——2~3 顆香菇貼地聚在一起，比照 makeFlowerCluster()，
// 密度/尺寸目標是要跟 makeWoodPile()/makeStonePile() 一樣顯眼(那兩個都
// 用 group.scale.setScalar(1.35/1.4) 放大)。
const CLUSTER_SCALE = 2.2;
export function makeMushroomCluster(
  species: MushroomSpeciesId,
  x: number,
  z: number,
  seed = hash2(x * 4.3, z * 6.1),
): THREE.Group {
  const group = new THREE.Group();
  const capCount = 2 + Math.floor(hash2(seed, seed * 1.9) * 2); // 2~3
  for (let i = 0; i < capCount; i++) {
    const cap = makeShiitakeCap();
    const a = hash2(seed + i * 2.1, i * 3.3) * Math.PI * 2;
    const r = 0.04 + hash2(i * 1.7, seed * 1.3 + i) * 0.09;
    cap.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    cap.rotation.y = hash2(seed * 2.7 + i, i * 4.9) * Math.PI * 2;
    const scale = 0.85 + hash2(i * 1.9, seed * 0.6) * 0.35;
    cap.scale.setScalar(scale);
    group.add(cap);
  }
  group.scale.setScalar(CLUSTER_SCALE);
  group.position.set(x, 0, z);
  return group;
}
