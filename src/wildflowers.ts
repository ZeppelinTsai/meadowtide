import * as THREE from "three";
import { hash2 } from "./utils";

// ==============================================================
// 野花採集系統——五個物種各自獨立的花頭生成函式 + 叢生包裝。
// 每個物種都是不同的花瓣/花心幾何組合，不是同一顆花換色，見
// docs/decisions/wildflower-gathering-system.md。
// 花瓣用 THREE.Shape + bezier 曲線描邊再 ShapeGeometry 拉出輪廓
// (跟 weather-particles.ts 的花瓣貼圖畫法同一種技巧，只是這裡直接
// 做成 3D 平面幾何，不是畫在 canvas 貼圖上)。
// ==============================================================

export type FlowerSpeciesId =
  | "wildDaisy"
  | "redPoppy"
  | "dandelion"
  | "blueDayflower"
  | "pinkWoodSorrel";

export interface FlowerSpeciesDefinition {
  id: FlowerSpeciesId;
  label: string;
  // 對應顏料色——顏料/染色系統之後才會用到，目前只是資料標記，不影響玩法。
  pigmentColor: string;
}

export const FLOWER_SPECIES: readonly FlowerSpeciesDefinition[] = [
  { id: "wildDaisy", label: "白雛菊", pigmentColor: "白" },
  { id: "redPoppy", label: "紅罌粟花", pigmentColor: "紅" },
  { id: "dandelion", label: "蒲公英", pigmentColor: "黃" },
  { id: "blueDayflower", label: "藍露草", pigmentColor: "藍" },
  { id: "pinkWoodSorrel", label: "粉紅酢漿草", pigmentColor: "粉" },
];

export function flowerSpeciesLabel(id: FlowerSpeciesId): string {
  return FLOWER_SPECIES.find((s) => s.id === id)?.label ?? id;
}

export function isFlowerSpeciesId(id: string): id is FlowerSpeciesId {
  return FLOWER_SPECIES.some((s) => s.id === id);
}

// --------------------------------------------------------------
// 共用幾何/材質小工具
// --------------------------------------------------------------
function pointedPetalGeometry(length: number, width: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.5, length * 0.2, width * 0.42, length * 0.75, 0, length);
  shape.bezierCurveTo(-width * 0.42, length * 0.75, -width * 0.5, length * 0.2, 0, 0);
  return new THREE.ShapeGeometry(shape, 6);
}

function roundedPetalGeometry(length: number, width: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(width * 0.65, length * 0.25, width * 0.6, length * 0.95, width * 0.18, length);
  shape.quadraticCurveTo(0, length * 1.08, -width * 0.18, length);
  shape.bezierCurveTo(-width * 0.6, length * 0.95, -width * 0.65, length * 0.25, 0, 0);
  return new THREE.ShapeGeometry(shape, 6);
}

function heartLeafGeometry(size: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(
    -size * 0.6,
    -size * 0.2,
    -size,
    size * 0.5,
    -size * 0.5,
    size * 0.85,
  );
  shape.quadraticCurveTo(-size * 0.15, size * 0.65, 0, size * 0.42);
  shape.quadraticCurveTo(size * 0.15, size * 0.65, size * 0.5, size * 0.85);
  shape.bezierCurveTo(size, size * 0.5, size * 0.6, -size * 0.2, 0, 0);
  return new THREE.ShapeGeometry(shape, 6);
}

function makeStem(height: number, radiusTop = 0.008) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusTop * 1.4, height, 4),
    new THREE.MeshStandardMaterial({ color: 0x3f8244, flatShading: true }),
  );
  stem.position.y = height / 2;
  stem.castShadow = true;
  return stem;
}

// 把一片花瓣/葉片幾何放射狀排列在花心/莖頂周圍：holder 沿世界 Y 軸旋轉
// 決定方位角，petal 自身繞局部 X 軸旋轉把「往 +Y 長出去的形狀」放平，
// tilt 控制花瓣上翹/下垂的角度，radius 控制花瓣基部離中心多遠。
function radialPart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  angle: number,
  tilt: number,
  radius = 0,
) {
  const holder = new THREE.Group();
  holder.rotation.y = angle;
  const part = new THREE.Mesh(geometry, material);
  part.rotation.x = -Math.PI / 2 + tilt;
  part.position.z = -radius;
  part.castShadow = true;
  holder.add(part);
  return holder;
}

// 白雛菊花瓣是白色，在沙地/淺色地面(尤其冬天雪地)幾乎融進背景——只有
// 這個物種需要額外疊一層稍微放大、深色的描邊網格：跟填色網格共用同一個
// holder/同一個變換，只是整體放大一圈，`polygonOffset` 把它推到填色
// 網格「後面」一點點避免 z-fighting，讓白色花瓣在淺色地面上還能看出
// 輪廓。其他四個物種目前配色跟地面對比夠，不需要這層。
const PETAL_OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: 0x3a3128,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
function radialPetalWithOutline(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  angle: number,
  tilt: number,
  radius = 0,
  outlineScale = 1.3,
) {
  const holder = new THREE.Group();
  holder.rotation.y = angle;
  const outline = new THREE.Mesh(geometry, PETAL_OUTLINE_MAT);
  outline.rotation.x = -Math.PI / 2 + tilt;
  outline.position.z = -radius;
  outline.scale.setScalar(outlineScale);
  holder.add(outline);
  const part = new THREE.Mesh(geometry, material);
  part.rotation.x = -Math.PI / 2 + tilt;
  part.position.z = -radius;
  part.castShadow = true;
  holder.add(part);
  return holder;
}

// --------------------------------------------------------------
// 白雛菊——黃色花心圓盤 + 細長白色花瓣，扁平放射狀。
// --------------------------------------------------------------
function makeWildDaisyHead(): THREE.Group {
  const g = new THREE.Group();
  const height = 0.16;
  g.add(makeStem(height));
  const head = new THREE.Group();
  head.position.y = height;
  g.add(head);

  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xfbfbf3,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const petalGeo = pointedPetalGeometry(0.075, 0.02);
  const petalCount = 9;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    head.add(radialPetalWithOutline(petalGeo, petalMat, angle, 0.1, 0.015));
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 8, 5),
    new THREE.MeshStandardMaterial({ color: 0xf4c430, flatShading: true }),
  );
  center.scale.y = 0.6;
  head.add(center);
  return g;
}

// --------------------------------------------------------------
// 紅罌粟花——4 片大紅花瓣呈杯狀微捲 + 深色花心。
// --------------------------------------------------------------
function makeRedPoppyHead(): THREE.Group {
  const g = new THREE.Group();
  const height = 0.2;
  g.add(makeStem(height, 0.01));
  const head = new THREE.Group();
  head.position.y = height;
  g.add(head);

  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xd7233b,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const petalGeo = roundedPetalGeometry(0.09, 0.075);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    head.add(radialPart(petalGeo, petalMat, angle, 0.55, 0.01));
  }
  const center = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.022, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2320, flatShading: true }),
  );
  center.position.y = 0.01;
  head.add(center);
  return g;
}

// --------------------------------------------------------------
// 蒲公英——密集細瘦黃色花瓣，堆得比雛菊密、微微拱起像一顆小絨球。
// --------------------------------------------------------------
function makeDandelionHead(): THREE.Group {
  const g = new THREE.Group();
  const height = 0.13;
  g.add(makeStem(height, 0.007));
  const head = new THREE.Group();
  head.position.y = height;
  g.add(head);

  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf6c81a,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  // 2026-09-01：原尺寸實機測試太不明顯，Zeppelin 反饋「黃花需要大一點」，
  // 花瓣加長加寬、基部離心距離跟著放大；第二輪反饋又要求再放大一點、
  // 補上描邊(跟白雛菊/粉紅酢漿草同一套 radialPetalWithOutline)，其餘
  // 物種的比例不受影響。
  const petalGeo = pointedPetalGeometry(0.082, 0.016);
  const petalCount = 22;
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2 + hash2(i, 3.1) * 0.2;
    head.add(radialPetalWithOutline(petalGeo, petalMat, angle, 0.32, 0.011));
  }
  return g;
}

// --------------------------------------------------------------
// 藍露草——兩片大藍花瓣朝上、一片小花瓣朝下，明顯不對稱。
// --------------------------------------------------------------
function makeBlueDayflowerHead(): THREE.Group {
  const g = new THREE.Group();
  const height = 0.17;
  g.add(makeStem(height, 0.009));
  const head = new THREE.Group();
  head.position.y = height;
  g.add(head);

  const bigPetalMat = new THREE.MeshStandardMaterial({
    color: 0x3f6fe0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const bigPetalGeo = roundedPetalGeometry(0.07, 0.065);
  head.add(radialPart(bigPetalGeo, bigPetalMat, -0.85, 0.55, 0.008));
  head.add(radialPart(bigPetalGeo, bigPetalMat, 0.85, 0.55, 0.008));

  const smallPetalMat = new THREE.MeshStandardMaterial({
    color: 0xf3efe0,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const smallPetalGeo = pointedPetalGeometry(0.03, 0.022);
  head.add(radialPart(smallPetalGeo, smallPetalMat, Math.PI, -0.5, 0.006));

  const stamen = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xf6d94a, flatShading: true }),
  );
  stamen.position.y = 0.01;
  head.add(stamen);
  return g;
}

// --------------------------------------------------------------
// 粉紅酢漿草——5 片小粉花瓣的花 + 3 片心形葉，葉片矮、花稍高。
// --------------------------------------------------------------
function makePinkWoodSorrelHead(): THREE.Group {
  const g = new THREE.Group();

  const leafHeight = 0.055;
  const leaves = new THREE.Group();
  leaves.position.y = leafHeight;
  g.add(makeStem(leafHeight, 0.007));
  g.add(leaves);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4d9a52,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  // 2026-09-01：跟蒲公英同一輪反饋，粉紅酢漿草原尺寸也偏小，葉片/花瓣
  // 一起放大；花瓣是淺粉色，跟白雛菊一樣可能在雪地融進背景，一併加上
  // 描邊(radialPetalWithOutline)。
  const leafGeo = heartLeafGeometry(0.058);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    leaves.add(radialPart(leafGeo, leafMat, angle, 0.28, 0.008));
  }

  const flowerHeight = 0.13;
  const flowerStem = makeStem(flowerHeight, 0.006);
  flowerStem.position.x = 0.02;
  flowerStem.position.z = 0.02;
  g.add(flowerStem);
  const head = new THREE.Group();
  head.position.set(0.02, flowerHeight, 0.02);
  g.add(head);
  // 2026-09-01：原本的粉色實機測試「不夠明顯」，換成飽和度更高的洋紅粉
  // (0xf1789f → 0xe0327d)；描邊倍率也從共用預設 1.3 收到 1.18，花瓣本身
  // 比較窄，描邊太粗會把粉色面積吃掉太多，收窄後粉色本體比較看得出來。
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xe0327d,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const petalGeo = pointedPetalGeometry(0.055, 0.033);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    head.add(radialPetalWithOutline(petalGeo, petalMat, angle, 0.15, 0.011, 1.18));
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xf6d94a, flatShading: true }),
  );
  head.add(center);
  return g;
}

function makeFlowerHead(species: FlowerSpeciesId): THREE.Group {
  switch (species) {
    case "wildDaisy":
      return makeWildDaisyHead();
    case "redPoppy":
      return makeRedPoppyHead();
    case "dandelion":
      return makeDandelionHead();
    case "blueDayflower":
      return makeBlueDayflowerHead();
    case "pinkWoodSorrel":
      return makePinkWoodSorrelHead();
  }
}

// 單朵花——用於背包/手持展示，跟叢生節點模型分開，避免背包裡塞一整叢。
export function makeFlowerSpecimen(species: FlowerSpeciesId): THREE.Group {
  return makeFlowerHead(species);
}

// 採集點叢生模型——同一物種 2~4 朵花頭聚在一起，跟
// props-decor.ts 的 makeGardenBed() 用 makeFlower() 堆花叢是同一種做法，
// 只是這裡每個物種都是專屬幾何而不是共用一顆球花再換色。
// 2026-09-01：原始花頭幾何是照真花比例做的，單獨放大地圖上完全不明顯，
// Zeppelin 反饋要跟 makeWoodPile()/makeStonePile()(props-decor.ts，各自
// 用 group.scale.setScalar(1.35/1.4) 放大)一樣顯眼——這裡用同樣手法對
// 整叢套一個更大的倍率(花頭本身幾何遠比原木/岩塊小，所以倍率也大得多)，
// 只放大最終叢生 group，不動個別花頭的幾何比例/輪廓。
const CLUSTER_SCALE = 2.6;
// 每個節點裡花頭彼此散開的半徑倍率——目前只有蒲公英需要收緊(Zeppelin
// 反饋「黃花花叢擠一點」)，其他物種維持預設 1(不縮不放)。
const CLUSTER_SPREAD: Partial<Record<FlowerSpeciesId, number>> = {
  dandelion: 0.55,
};
export function makeFlowerCluster(
  species: FlowerSpeciesId,
  x: number,
  z: number,
  seed = hash2(x * 3.1, z * 7.7),
): THREE.Group {
  const group = new THREE.Group();
  const headCount = 2 + Math.floor(hash2(seed, seed * 2.3) * 3); // 2~4
  const spread = CLUSTER_SPREAD[species] ?? 1;
  for (let i = 0; i < headCount; i++) {
    const head = makeFlowerHead(species);
    const a = hash2(seed + i * 1.9, i * 2.7) * Math.PI * 2;
    const r = (0.05 + hash2(i * 1.3, seed * 1.7 + i) * 0.15) * spread;
    head.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    head.rotation.y = hash2(seed * 3.3 + i, i * 4.1) * Math.PI * 2;
    const scale = 0.85 + hash2(i * 2.1, seed * 0.7) * 0.3;
    head.scale.setScalar(scale);
    group.add(head);
  }
  group.scale.setScalar(CLUSTER_SCALE);
  group.position.set(x, 0, z);
  return group;
}
