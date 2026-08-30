// props.ts 拆分：植被/地形/地面材質類 make* 函式（樹、草、花、石頭、沙、山、洞窟入口……）。
// 拆分紀錄見 docs/decisions/props-file-split.md。
import * as THREE from "three";
import { hash2 } from "./utils";
import {
  gameState,
  getSeasonGrassTone,
  mapleAutumnColor,
  pastureGrassStageAt,
} from "./game-state";
import {
  TILE,
  PLATEAU_Y,
  NORTH_CLIFF_Z,
  SOUTH_TERRAIN_EXTENSION,
} from "./scene-sky";
import { STAR_SPARKLE_TEXTURE, STAR_SPARKLE_COLORS } from "./scene-sky";
import {
  LAYOUT,
  MAPS,
  SHRINE_PATH_START_X,
  SHRINE_PATH_LENGTH,
  SHRINE_PATH_ELEVATION,
  portSouthBeachEndZ,
  STAIR_SLOPE_TAN,
  DECORATIVE_STAIR_WIDTH,
} from "./layout-maps";
import {
  windowMats,
  waterSurfaceMaterials,
  waterSkyUnderlayMaterials,
  outdoorLampLights,
  foamMeshes,
  windmillRotors,
  pastureGrassBlades,
  avenueLeafMaterials,
  seasonalTreeLeafMaterials,
  seasonalGroundMaterials,
  mountainSeasonalMaterials,
  GRASS_STAGE_HEIGHTS,
  EAST_SEA_WAVE_DIRECTION,
  SOUTH_SEA_WAVE_DIRECTION,
  gangplankMeshes,
  prologueRefs,
} from "./scene-registries";
import { findSouthernShoreSandZ } from "./shore-foam";
import { randomPasturePoint } from "./npc-runtime";

// 木棧板材質——canvas 現畫木紋貼圖，跟 scene-sky.ts/weather-particles.ts
// 同一套「3D 世界不接外部圖片，程式生成貼圖」規則。畫一塊正方形貼圖，
// 靠 texture.repeat 依實際世界尺寸鋪滿，不用每個呼叫端各自重畫一次。
// 目前給山頂觀景台用；之後棧橋/碼頭甲板要類似木板質感也能直接共用。

export function makeTree(x, z) {
  const group = new THREE.Group();
  const r = hash2(x, z);
  const scale = 0.85 + r * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.11, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
  );
  trunk.position.y = 0.275 * scale;
  trunk.scale.setScalar(scale);
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({
    color: gameState.currentSeason === 3 ? 0xeaf0f3 : 0x2f8f3f,
    flatShading: true,
  });
  seasonalTreeLeafMaterials.push({
    material: leafMat,
    summerColor: new THREE.Color(0x2f8f3f),
    winterColor: new THREE.Color(0xeaf0f3).offsetHSL(
      0,
      -0.08,
      (r - 0.5) * 0.07,
    ),
  });
  const leaf1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), leafMat);
  leaf1.position.y = 0.62 * scale;
  leaf1.scale.setScalar(scale);
  leaf1.castShadow = true;
  const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), leafMat);
  leaf2.position.y = 0.85 * scale;
  leaf2.scale.setScalar(scale);
  leaf2.castShadow = true;
  group.add(leaf1, leaf2);
  group.position.set(x, 0, z);
  group.rotation.y = r * Math.PI * 2;
  group.scale.multiplyScalar(2);
  return group;
}
export const AVENUE_SEASON_COLORS = [0xf3a7c3, 0x3f9446, 0xc94f3d, 0xf2f5f7];

export function avenueSeasonColor(tint = 0) {
  return new THREE.Color(
    AVENUE_SEASON_COLORS[gameState.currentSeason],
  ).offsetHSL(
    tint * 0.018,
    gameState.currentSeason === 3 ? -0.12 : tint * 0.035,
    tint * 0.045,
  );
}

export function makeAvenueTree(x, z) {
  const tree = new THREE.Group();
  const tint = hash2(x * 2.7, z * 4.1) - 0.5;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6f472b,
    flatShading: true,
  });
  const leafMat = new THREE.MeshStandardMaterial({
    color: avenueSeasonColor(tint),
    flatShading: true,
    roughness: gameState.currentSeason === 3 ? 0.9 : 0.72,
  });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.11, 0.9, 7),
    trunkMat,
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  tree.add(trunk);

  function addBranch(from, to, radius = 0.035) {
    const start = new THREE.Vector3(...from),
      end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.62, radius, direction.length(), 6),
      trunkMat,
    );
    branch.position.copy(start).add(end).multiplyScalar(0.5);
    branch.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    branch.castShadow = true;
    tree.add(branch);
  }

  // 從主幹中上段向不同方向分叉，枝條刻意露在葉團之間。
  const tips = [
    [-0.34, 0.96, 0.02],
    [0.36, 0.9, 0.08],
    [-0.2, 1.17, -0.2],
    [0.22, 1.2, 0.2],
    [0.02, 1.34, -0.02],
  ];
  tips.forEach((tip, i) =>
    addBranch(
      [i < 2 ? 0 : (i - 3) * 0.025, 0.56 + i * 0.055, 0],
      tip,
      i === 4 ? 0.04 : 0.032,
    ),
  );
  addBranch([-0.08, 0.74, 0], [-0.24, 1.08, 0.13], 0.026);
  addBranch([0.08, 0.77, 0], [0.27, 1.05, -0.12], 0.026);

  // 葉子集中在枝梢，團塊較小且彼此留縫，不再堆成一整顆圓球。
  const crowns = tips.map((tip, i) => [
    tip[0],
    tip[1] + 0.05,
    tip[2],
    0.17 + (i % 2) * 0.035,
  ]);
  crowns.push(
    [-0.24, 1.09, 0.13, 0.16],
    [0.27, 1.07, -0.12, 0.17],
    [0, 1.12, 0, 0.18],
  );
  crowns.forEach(([lx, ly, lz, size], i) => {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 0),
      leafMat,
    );
    crown.position.set(lx, ly, lz);
    crown.scale.set(
      0.88 + hash2(x + i, z) * 0.22,
      0.78 + hash2(x, z + i) * 0.22,
      0.9,
    );
    crown.castShadow = true;
    tree.add(crown);
  });
  tree.position.set(x, 0, z);
  tree.rotation.y = hash2(x, z) * Math.PI * 2;
  tree.scale.multiplyScalar(2);
  avenueLeafMaterials.push({ material: leafMat, tint });
  return tree;
}

export function updateAvenueTreeColors() {
  avenueLeafMaterials.forEach(({ material, tint }) => {
    material.color.copy(avenueSeasonColor(tint));
    material.roughness = gameState.currentSeason === 3 ? 0.9 : 0.72;
  });
}

export function updateSeasonalTreeColors() {
  seasonalTreeLeafMaterials.forEach(
    ({ material, summerColor, winterColor }) => {
      material.color.copy(
        gameState.currentSeason === 3 ? winterColor : summerColor,
      );
      material.roughness = gameState.currentSeason === 3 ? 0.86 : 1;
    },
  );
}

export function updateSeasonalGroundColors() {
  const tone = getSeasonGrassTone();
  seasonalGroundMaterials.forEach((material) => {
    material.color.setHex(tone.ground);
    material.roughness = tone.roughness;
  });
  mountainSeasonalMaterials.forEach(
    ({ material, baseColor, winterColor, autumnColor }) => {
      material.color.setHex(
        gameState.currentSeason === 3
          ? winterColor
          : gameState.currentSeason === 2 && autumnColor !== undefined
            ? autumnColor
            : baseColor,
      );
      material.roughness = gameState.currentSeason === 3 ? 0.88 : 1;
    },
  );
  pastureGrassBlades.forEach((tuft) => {
    tuft.userData.grassMaterial.color.copy(
      seasonalPastureGrassColor(tuft.userData),
    );
    tuft.userData.grassMaterial.roughness = tone.roughness;
  });
}
// 牧場風吹草跟地板共用 SEASON_GRASS_TONES 的季節判斷，只是牧草额外保留
// 楓紅/楓黃兩種秋色(makeWindGrass() 依 seed 各叢混色)，不能只套地板的
// 單一秋色，所以額外抽成這個小函式讓建立時跟每次換季更新時共用同一套
// 「哪個季節挑哪個顏色」判斷，不寫兩份三元判斷。

function seasonalPastureGrassColor(userData) {
  if (gameState.currentSeason === 3) return userData.winterGrassColor;
  if (gameState.currentSeason === 2) return userData.autumnGrassColor;
  return userData.baseGrassColor;
}

export function makePath(x, z) {
  // 稍微超出單格邊界，讓相鄰路塊無縫接合，看不出棋盤狀格線。
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(TILE * 1.02, 0.04, TILE * 1.02),
    new THREE.MeshStandardMaterial({ color: 0xbfa172 }),
  );
  m.position.set(x, 0.01, z);
  m.receiveShadow = true;
  return m;
}

export function makeWater(x, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(TILE * 0.98, 0.06, TILE * 0.98),
    new THREE.MeshStandardMaterial({
      color: 0x3f8fd6,
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.88,
    }),
  );
  m.position.set(x, 0.0, z);
  return m;
}

export function makeLakeShoreRock(x, z, seed, isSeat = false) {
  const group = new THREE.Group();
  const rockColors = [
    0x596969, 0x73858a, 0x8d8170, 0x6f7568, 0x9a8d7b, 0x66757f,
  ];
  const colorIndex = Math.min(
    rockColors.length - 1,
    Math.floor(seed * rockColors.length),
  );
  const color = new THREE.Color(rockColors[colorIndex]).offsetHSL(
    (hash2(seed * 13.1, 4.7) - 0.5) * 0.045,
    (hash2(seed * 7.3, 8.9) - 0.5) * 0.16,
    (hash2(seed * 17.7, 1.2) - 0.5) * 0.16,
  );
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.95,
    }),
  );
  const width = isSeat ? 1.05 + seed * 0.18 : 0.76 + seed * 0.36;
  const height = isSeat ? 0.38 : 0.58 + seed * 0.28;
  rock.scale.set(width, height, 0.72 + hash2(seed * 8.3, 2.1) * 0.34);
  rock.rotation.set(
    (seed - 0.5) * 0.16,
    seed * Math.PI * 2,
    (0.5 - seed) * 0.12,
  );
  rock.position.y = isSeat ? 0.16 : 0.21;
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);
  group.position.set(x, 0, z);
  return group;
}

export function makeSoil(x, z) {
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(TILE * 0.98, 0.05, TILE * 0.98),
    new THREE.MeshStandardMaterial({ color: 0x6b4a30 }),
  );
  soil.position.set(x, 0.01, z);
  return soil;
}

export function makeGrassTuft(x, z, seed) {
  const g = new THREE.Group();
  // 裝飾用小草叢每次進地圖(buildMap())都重新生成，不需要另外掛進
  // 季節材質登記表做即時更新，直接在建立當下依目前季節挑色即可，
  // 跟牧場風吹草共用同一顆 mapleAutumnColor()，不重寫混色公式。
  const mat = new THREE.MeshStandardMaterial({
    color: gameState.currentSeason === 2 ? mapleAutumnColor(seed) : 0x4f9e46,
    flatShading: true,
  });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.14, 4), mat);
    const a = (i / 3) * Math.PI * 2 + seed * 6;
    blade.position.set(Math.cos(a) * 0.05, 0.07, Math.sin(a) * 0.05);
    blade.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(blade);
  }
  g.position.set(x, 0, z);
  return g;
}
// 牧場用的牧草——比裝飾用的 makeGrassTuft 高一點、密一點，每片葉子記錄
// 自己的基準角度跟相位(userData)，animate() 每幀疊加一個 sin 位移做出被
// 風吹動的搖擺，不會覆蓋掉葉片原本東倒西歪的自然角度

export function makeWindGrass(x, z, seed) {
  const g = new THREE.Group();
  const grassColor = new THREE.Color(0x5fae52).offsetHSL(
    (seed - 0.5) * 0.035,
    0.04,
    (seed - 0.5) * 0.08,
  );
  const winterGrassColor = new THREE.Color(0xe4ecef).offsetHSL(
    0,
    -0.08,
    (seed - 0.5) * 0.08,
  );
  const autumnGrassColor = mapleAutumnColor(seed);
  const mat = new THREE.MeshStandardMaterial({
    color: seasonalPastureGrassColor({
      baseGrassColor: grassColor,
      autumnGrassColor,
      winterGrassColor,
    }),
    flatShading: true,
    side: THREE.DoubleSide,
  });
  // 一叢草只用一個合併網格；舊版每片葉子都是獨立 Mesh，牧場會產生數千 draw calls。
  const positions = [];
  const bladeCount = 14;
  for (let i = 0; i < bladeCount; i++) {
    const a = (i / bladeCount) * Math.PI * 2 + seed * 6;
    const spread = 0.04 + hash2(seed * 9.1, i * 4.7) * 0.21;
    const cx = Math.cos(a) * spread,
      cz = Math.sin(a) * spread;
    const halfWidth = 0.019 + hash2(seed * 5.2, i) * 0.014;
    const px = -Math.sin(a) * halfWidth,
      pz = Math.cos(a) * halfWidth;
    const lean = (hash2(seed + i * 2.3, 7.1) - 0.5) * 0.16;
    positions.push(
      cx - px,
      0,
      cz - pz,
      cx + px,
      0,
      cz + pz,
      cx + Math.cos(a) * lean,
      1,
      cz + Math.sin(a) * lean,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  const bladeMesh = new THREE.Mesh(geometry, mat);
  g.add(bladeMesh);
  g.position.set(x, 0, z);
  g.userData.blades = [g];
  g.userData.baseRotZ = (hash2(seed, 2.4) - 0.5) * 0.12;
  g.userData.baseRotX = (hash2(seed + 3.7, 8.2) - 0.5) * 0.08;
  g.userData.phase = seed * 12;

  g.userData.stage = -1;
  g.userData.grassMaterial = mat;
  g.userData.baseGrassColor = grassColor;
  g.userData.autumnGrassColor = autumnGrassColor;
  g.userData.winterGrassColor = winterGrassColor;
  return g;
}

export function setPastureGrassStage(tuft, stage) {
  const nextStage = Math.max(0, Math.min(2, stage));
  if (tuft.userData.stage === nextStage) return;
  tuft.userData.stage = nextStage;
  const height = GRASS_STAGE_HEIGHTS[nextStage];
  tuft.userData.blades.forEach((pivot) => {
    const blade = pivot.children[0];
    blade.scale.y = height;
    blade.position.y = 0;
  });
}

export function findLongGrassNear(x, z, maxDistance = Infinity) {
  let best = null,
    bestDistance = maxDistance;
  pastureGrassBlades.forEach((tuft) => {
    if (tuft.userData.stage !== 2) return;
    const distance = Math.hypot(tuft.position.x - x, tuft.position.z - z);
    if (distance < bestDistance) {
      best = tuft;
      bestDistance = distance;
    }
  });
  return best;
}

export function chooseAnimalPastureTarget(
  animal,
  isSafe: (x: number, z: number) => boolean = () => true,
) {
  // 每次挑目標都重擲路徑亂數種子：就算兩次都選到同一叢長草，走去的
  // 路線(彎曲方向、幅度)跟停在草叢周圍的落點也不會一樣。
  animal.pathSeed = Math.random();
  if (animal.type !== "chicken") {
    const grass = findLongGrassNear(
      animal.mesh.position.x,
      animal.mesh.position.z,
      4,
    );
    if (grass) {
      const jitterAngle = Math.random() * Math.PI * 2;
      const jitterRadius = Math.random() * 0.3;
      const target = {
        x: grass.position.x + Math.cos(jitterAngle) * jitterRadius,
        z: grass.position.z + Math.sin(jitterAngle) * jitterRadius,
      };
      if (isSafe(target.x, target.z)) return target;
    }
  }
  return randomPasturePoint(isSafe);
}

export function tryEatPastureGrass(animal) {
  if (animal.type === "chicken") return false;
  const grass = findLongGrassNear(
    animal.mesh.position.x,
    animal.mesh.position.z,
    0.55,
  );
  if (!grass) return false;
  // 真正消耗哪一格牧草由每日 10:00 結算統一決定；這裡只播放動物低頭
  // 吃草的行為，不再另外改一套 32 秒即時生長資料。
  return true;
}

export function makeFlower(x, z, color) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a7a3a }),
  );
  stem.position.y = 0.06;
  const bloom = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 5),
    new THREE.MeshStandardMaterial({ color, flatShading: true }),
  );
  bloom.position.y = 0.13;
  g.add(stem, bloom);
  g.position.set(x, 0, z);
  return g;
}
// ==============================================================
// 參考圖裡還沒做的區域——先求佈局對，能做完整模型的做，還沒空做的
// 就用簡單方塊/平面卡位，之後再回頭精修
// ==============================================================
export const ORCHARD_FRUIT_STYLES = [
  { name: "apple", fruit: 0xd9432f, leaf: 0x438f3b },
  { name: "orange", fruit: 0xf28c28, leaf: 0x3f963e },
  { name: "lemon", fruit: 0xf3d34a, leaf: 0x559b3d },
  { name: "pear", fruit: 0xa9c84b, leaf: 0x4b913c },
  { name: "peach", fruit: 0xf49a82, leaf: 0x579f47 },
  { name: "plum", fruit: 0x7750a8, leaf: 0x3d813b },
  { name: "cherry", fruit: 0xc92f45, leaf: 0x4a963f },
  { name: "apricot", fruit: 0xf4ad55, leaf: 0x659c42 },
  { name: "lime", fruit: 0x78b947, leaf: 0x37883b },
  { name: "fig", fruit: 0x8d4c78, leaf: 0x4f8740 },
  { name: "persimmon", fruit: 0xe56f2d, leaf: 0x658f3c },
  { name: "whitePeach", fruit: 0xf4c4bd, leaf: 0x509344 },
];

export function makeFruitTree(x, z, seed, typeIndex = 0) {
  const style = ORCHARD_FRUIT_STYLES[typeIndex % ORCHARD_FRUIT_STYLES.length];
  const scale = 0.8 + seed * 0.3;
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
  );
  trunk.position.y = 0.25 * scale;
  trunk.scale.setScalar(scale);
  trunk.castShadow = true;
  group.add(trunk);
  const fruitLeafMat = new THREE.MeshStandardMaterial({
    color: gameState.currentSeason === 3 ? 0xe8eff2 : style.leaf,
    flatShading: true,
  });
  seasonalTreeLeafMaterials.push({
    material: fruitLeafMat,
    summerColor: new THREE.Color(style.leaf),
    winterColor: new THREE.Color(0xe8eff2).offsetHSL(
      0,
      -0.08,
      (seed - 0.5) * 0.08,
    ),
  });
  const leaf = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.32, 0),
    fruitLeafMat,
  );
  leaf.position.y = 0.62 * scale;
  leaf.scale.setScalar(scale);
  leaf.castShadow = true;
  group.add(leaf);
  const fruitMat = new THREE.MeshStandardMaterial({ color: style.fruit });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + seed * 5;
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 5),
      fruitMat,
    );
    fruit.position.set(
      Math.cos(a) * 0.28 * scale,
      0.6 * scale,
      Math.sin(a) * 0.28 * scale,
    );
    group.add(fruit);
  }
  group.position.set(x, 0, z);
  group.scale.multiplyScalar(2);
  group.userData.fruitType = style.name;
  return group;
}

// 瀑布——先做靜態占位（半透明淡藍色塊 + 崖底一顆白色泡沫），沒有做真的
// 水流動畫，之後想做的話這裡是入口

export function makeWaterfallPlaceholder(x, z) {
  const group = new THREE.Group();
  const cascade = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.9, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xcfeeff,
      transparent: true,
      opacity: 0.75,
      roughness: 0.15,
    }),
  );
  cascade.position.y = 0.45;
  group.add(cascade);
  const splash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    }),
  );
  splash.scale.set(1, 0.4, 1);
  splash.position.y = 0.05;
  group.add(splash);
  group.position.set(x, 0, z);
  return group;
}

// 牡蠣養殖架——浮筏＋垂繩，珍珠系統的採集點。原本是鋪滿的實心木板，
// 現在改成「井」字的竹枝格架：外框＋內部兩兩交叉，中間刻意留空隙，
// 從甲板縫隙就能隱約看到底下的海面跟垂掛的牡蠣殼，不是一整塊看不透
// 的平台。牡蠣殼一樣用 IcosahedronGeometry 湊不規則的殼形(跟
// makeStone 同招)，分成「趴在竹枝交叉點上」跟「垂進水裡」兩層。

export function makeStone(x, z, seed) {
  const stone = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1 + seed * 0.06, 0),
    new THREE.MeshStandardMaterial({
      color: 0x8a8a86,
      flatShading: true,
    }),
  );
  stone.position.set(x, 0.06, z);
  stone.rotation.set(seed * 6, seed * 4, seed * 2);
  stone.castShadow = true;
  return stone;
}

// 木材採集點——簡單的一小堆剛砍下的原木，交叉疊放。

export const SAND_TONES = [0xe8d29a, 0xe3cd93, 0xe6d29c, 0xe0c88e];

export function makeSand(x, z) {
  // 每格顏色/高度各自用座標算出來的決定性亂數微調，同一格重整頁面長得
  // 一樣，但不會每格都是完全一樣的色塊。色調刻意收得很近（只在同一個
  // 沙色附近微調），差太多在方格排列上反而會被看成棋盤格，比純色更
  // 「格子狀」。方塊之間不留縫（scale=1）避免每格描邊出網格線；旋轉/
  // 位移也不做——方形磚塊旋轉後邊角會互相重疊/露縫，更像碎裂的磁磚
  const seed = hash2(x * 5.7, z * 3.1);
  const tone = SAND_TONES[Math.floor(seed * 100) % SAND_TONES.length];
  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(TILE, 0.04 + seed * 0.02, TILE),
    new THREE.MeshStandardMaterial({ color: tone }),
  );
  sand.position.set(x, 0.01, z);
  sand.receiveShadow = true;
  return sand;
}
// 女神祠堂步道——一整條墊高浮出海面的沙洲，不是逐格貼平的沙灘。
// 側面刻意用比頂面深一點的沙色，讀起來像從海裡「長」出來的一塊
// 平台，不是懸空的方塊。範圍/高度都讀 layout-maps.ts 同一組常數，
// 跟 groundY() 的碰撞高度保持一致。

export function makeShrinePathCauseway() {
  const width = SHRINE_PATH_LENGTH * TILE,
    depth = 3 * TILE,
    centerX = SHRINE_PATH_START_X + (SHRINE_PATH_LENGTH - 1) / 2,
    centerZ = 1;
  const group = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.08, depth),
    new THREE.MeshStandardMaterial({ color: 0xe6d29c }),
  );
  top.position.y = SHRINE_PATH_ELEVATION;
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);
  const flank = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.985, SHRINE_PATH_ELEVATION, depth * 0.985),
    new THREE.MeshStandardMaterial({ color: 0xb89b6a, flatShading: true }),
  );
  flank.position.y = SHRINE_PATH_ELEVATION / 2;
  flank.castShadow = true;
  group.add(flank);
  group.position.set(centerX, 0, centerZ);
  return group;
}
export interface FoamOptions {
  waveDirection?: Readonly<{ x: number; z: number }>;
  rotationY?: number;
}

export function makeFoam(
  x,
  z,
  seed,
  { waveDirection = EAST_SEA_WAVE_DIRECTION, rotationY = 0 }: FoamOptions = {},
) {
  // 拍岸浪花做成一個小群組：浪頭捲上岸的前緣、退潮水漬、還有幾顆會滾動碎裂
  // 的低模泡沫顆粒，讓它有「衝上岸→碎開→退回去」的動態，不只是忽明忽暗
  const g = new THREE.Group();
  // 海面波浪的最高點大約在 y=0.235 左右（見 buildMap 裡的海面設定），泡沫要
  // 蓋在更上面，不然幾乎共平面的透明面會 z-fighting，畫面會閃出詭異的雜色條紋
  const FOAM_Y = 0.27;
  // crest/wash 用圓形(非矩形)當底——矩形有直角硬邊，海岸線抖動之後相鄰
  // 幾組浪花沿 x 各自跳動一點，硬邊矩形疊起來會露出樓梯狀的格線；圓形
  // 疊在一起邊緣是弧形，重疊處自然融在一起，看不出方塊拼接的痕跡
  const crest = new THREE.Mesh(
    new THREE.CircleGeometry(TILE * 0.34, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      roughness: 0.9,
    }),
  );
  // renderOrder 故意設得比海面高：一大片海面 vs. 好幾個小小的泡沫物件，
  // Three.js 用物件中心點到相機的距離排半透明物件的前後順序，海面這種
  // 橫跨整排格子的大 mesh 跟每一排泡沫的距離排序常常會不穩定（一排是綠、
  // 一排是灰藍，忽前忽後），乾脆明講「泡沫永遠畫在海面之後（蓋在上面）」
  crest.rotation.x = -Math.PI / 2;
  crest.position.y = FOAM_Y + 0.02;
  crest.renderOrder = 2;
  g.add(crest);
  // 沿本地 Y 軸（攤平後對應世界 Z，也就是沿岸方向）把幾何本身拉長，
  // 不能用 mesh.scale 做——下面 animate() 每幀都會覆寫 wash.scale，
  // 拉長要烤進頂點座標才留得住。浪花現在每兩排才放一組，拉長幅度要
  // 蓋過 2 格間距才不會露出斷點
  const wash = new THREE.Mesh(
    new THREE.CircleGeometry(TILE * 0.5, 12).scale(1, 2.2, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.95,
    }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(0.15, FOAM_Y, 0);
  wash.renderOrder = 1;
  g.add(wash);
  const bumps = [];
  for (let i = 0; i < 5; i++) {
    const s = hash2(seed + i * 3.1, seed * 1.7 + i);
    const bump = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.04 + s * 0.035, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
        roughness: 0.9,
      }),
    );
    bump.position.set(
      (s - 0.5) * TILE * 0.75,
      FOAM_Y + 0.02,
      (hash2(s, seed + i) - 0.5) * TILE * 0.4,
    );
    bump.renderOrder = 2;
    g.add(bump);
    bumps.push(bump);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotationY;
  g.userData = {
    seed,
    crest,
    wash,
    bumps,
    baseX: x,
    baseZ: z,
    waveDirection,
  };
  return g;
}

export function makeMountain(x, z, height, seed) {
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x7d93a8,
    flatShading: true,
  });
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(1.1 + seed * 0.5, height, 5),
    rockMat,
  );
  peak.position.y = height / 2;
  peak.rotation.y = seed * Math.PI * 2;
  g.add(peak);
  if (height > 2.2) {
    const snow = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.5, 5),
      new THREE.MeshStandardMaterial({
        color: 0xf2f5f8,
        flatShading: true,
      }),
    );
    snow.position.y = height - 0.18;
    g.add(snow);
  }
  g.position.set(x, 0, z);
  return g;
}

// 2026-08-25：從 makeOldVillageStalactiteCaveEntrance() 抽出來的通用
// 版本，改吃 cave 參數(不再寫死 LAYOUT.oldVillage.stalactiteCave)，
// 讓山之洞的入口(LAYOUT.mountain.cave)可以直接共用同一份「平台邊緣
// 嵌入岩塊、南向拱門開口、地面石筍+苔蘚」模板(2026-08-25 拿掉了原本拱門
// 「先套用同樣模板就好」，兩個洞窟的視覺先 100% 一致，之後真的要讓
// 山之洞長得不一樣(比如換成沒有鐘乳石的乾燥岩壁)再另外分家。

export function makeCaveRockEntrance(cave: {
  x: number;
  z: number;
  width: number;
  depth: number;
  entranceX: number;
  entranceWidth: number;
  entranceStartZ: number;
}) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x59615b,
    roughness: 1,
    flatShading: true,
  });
  const darkRockMat = new THREE.MeshStandardMaterial({
    color: 0x3b403d,
    roughness: 1,
    flatShading: true,
  });
  const mossRockMat = new THREE.MeshStandardMaterial({
    color: 0x4d5a3f,
    roughness: 1,
    flatShading: true,
  });
  const openingMat = new THREE.MeshBasicMaterial({
    color: 0x090d0d,
    side: THREE.DoubleSide,
  });
  const addRock = (x, y, z, radius, sx, sy, sz, seed) => {
    const mat = seed > 0.72 ? mossRockMat : seed > 0.5 ? darkRockMat : rockMat;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), mat);
    rock.position.set(x, y, z);
    rock.scale.set(sx, sy, sz);
    rock.rotation.set(seed * 0.25, seed * Math.PI, seed * 0.16);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  };

  const entranceZ = cave.z + cave.depth - 0.35;
  const entranceCenterX = cave.entranceX + (cave.entranceWidth - 1) / 2;
  // 入口正前方留空，堆石時繞開，避免擋住玩家視線/走位。
  const halfEntrance = cave.entranceWidth / 2 + 0.55;

  // 以交錯的低模岩塊填滿山腳量體；只有入口前方的實際可走走廊留空。
  // 後排仍可鋪石，會被洞口的黑色遮罩擋在內部，不會蓋住入口輪廓。
  const fillSpacingX = 1.25;
  const fillRows = [0.55, 1.75, 2.95, 4.05];
  fillRows.forEach((localZ, row) => {
    const columns = Math.ceil(cave.width / fillSpacingX);
    for (let column = 0; column <= columns; column++) {
      const x =
        cave.x +
        Math.min(
          cave.width - 0.35,
          0.35 + column * fillSpacingX + (row % 2) * fillSpacingX * 0.5,
        );
      const inEntranceLane = Math.abs(x - entranceCenterX) < halfEntrance;
      const inEntranceForeground = localZ >= cave.entranceStartZ - cave.z - 0.2;
      if (inEntranceLane && inEntranceForeground) continue;
      const seed = hash2(x * 4.7 + row, localZ * 6.3 + column);
      const radius = 0.82 + seed * 0.38;
      addRock(
        x,
        radius * (0.72 + hash2(column, row + 2.1) * 0.22),
        cave.z + localZ,
        radius,
        0.92 + hash2(seed, 1.7) * 0.3,
        0.85 + hash2(seed, 3.4) * 0.35,
        0.9 + hash2(seed, 5.1) * 0.3,
        seed,
      );
    }
  });

  // 崖面用 hash2 決定性灑石頭，數量隨洞窟寬度(現在 x=20~29，比原本
  // 寬)縮放；越靠洞窟兩端(接乾地/沙灘)堆得越高越密，做出實心山壁的
  // 量體感，中央入口附近則稀疏、矮，讓拱門輪廓不被埋掉。
  const rockCount = Math.max(6, Math.round(cave.width * 1.1));
  for (let i = 0; i < rockCount; i++) {
    const seed = hash2(cave.x * 3.1 + i * 5.7, cave.z * 2.3 + i * 1.9);
    const spread = hash2(i * 7.1, cave.width + i);
    const x = cave.x + spread * (cave.width - 1);
    if (Math.abs(x - entranceCenterX) < halfEntrance) continue;
    const nearEdge = Math.min(x - cave.x, cave.x + cave.width - 1 - x);
    const edgeBoost = Math.max(0, 1 - nearEdge / 3) * 0.9;
    const radius = 0.95 + hash2(seed * 4.2, i) * 0.75 + edgeBoost;
    const y = radius * (0.55 + hash2(i, seed * 3.3) * 0.3);
    const zJitter = hash2(seed * 9.1, i * 2.7) * 1.6;
    addRock(
      x,
      y,
      cave.z + 1.4 + zJitter,
      radius,
      0.85 + hash2(i, 4.4) * 0.5,
      0.7 + hash2(i, 8.1) * 0.45,
      0.85 + hash2(i, 1.6) * 0.5,
      seed,
    );
  }

  // 入口兩側/上方另外手動放三顆石頭收邊——灑點迴圈因淨空區會跳過
  // 這一段，單靠隨機不保證每次都有石頭把拱頂包住。刻意跟原本
  // (擴建前)同一套「深度」寫法——z 用 cave.z 往南偏移幾格，不是貼著
  // entranceZ——石頭才會退到洞口後方當背景，不會整顆懸在拱門正前方
  // 把黑色洞口整個蓋住(這正是拓寬後第一版美化「洞窟被岩石擋住」的
  // 成因：那版把收邊石頭搬到太靠近 entranceZ 的地方，一顆大石頭疊在
  // 拱門正上方，比拱門本身還寬)。
  addRock(cave.entranceX - 0.6, 1.3, cave.z + 2.1, 1.55, 1.1, 1.0, 1.3, 0.21);
  addRock(
    cave.entranceX + cave.entranceWidth + 0.5,
    1.35,
    cave.z + 2,
    1.65,
    1.15,
    1.05,
    1.3,
    0.73,
  );
  // 頂石縮小＋墊高，退到明顯比拱頂(y=2.2)還高的位置當「過梁」，
  // 不會把整個拱門罩住。
  addRock(entranceCenterX, 2.7, cave.z + 1.7, 1.15, 1.3, 0.6, 1.1, 0.46);

  // 拱門形狀改用 cave.entranceWidth 推導半寬，洞口變寬/變窄時跟著縮放，
  // 不再是寫死的 ±1.05；拱高從 2.2 加到 2.5，洞口本身更明顯一點。
  const archHalfWidth = cave.entranceWidth / 2 + 0.05;
  const arch = new THREE.Shape();
  arch.moveTo(-archHalfWidth, 0);
  arch.lineTo(-archHalfWidth, 0.85);
  arch.quadraticCurveTo(-archHalfWidth * 0.86, 2.3, 0, 2.5);
  arch.quadraticCurveTo(archHalfWidth * 0.86, 2.3, archHalfWidth, 0.85);
  arch.lineTo(archHalfWidth, 0);
  arch.closePath();

  // 拱門外圍加一圈比周邊岩石淺、比洞口本身暖的石框(比黑洞口寬/高
  // 各多一截，貼在洞口正後方一點點露出邊緣)，純粹是「洞口在哪」的
  // 視覺提示——石堆跟黑洞口本身的顏色都偏冷灰/純黑，中間差一層
  // 對比色，洞口才不會被周圍的石頭淹沒。靜態材質，沒有 emissive。
  const frameHalfWidth = archHalfWidth + 0.35;
  const frame = new THREE.Shape();
  frame.moveTo(-frameHalfWidth, 0);
  frame.lineTo(-frameHalfWidth, 0.85);
  frame.quadraticCurveTo(-frameHalfWidth * 0.86, 2.55, 0, 2.8);
  frame.quadraticCurveTo(frameHalfWidth * 0.86, 2.55, frameHalfWidth, 0.85);
  frame.lineTo(frameHalfWidth, 0);
  frame.closePath();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x726c5c,
    roughness: 0.95,
    flatShading: true,
  });
  const frameMesh = new THREE.Mesh(new THREE.ShapeGeometry(frame), frameMat);
  frameMesh.position.set(entranceCenterX, 0.02, entranceZ - 0.05);
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  frameMesh.renderOrder = 3;
  group.add(frameMesh);

  const opening = new THREE.Mesh(new THREE.ShapeGeometry(arch), openingMat);
  opening.position.set(entranceCenterX, 0.03, entranceZ);
  opening.renderOrder = 4;
  group.add(opening);

  const innerFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(cave.entranceWidth + 0.35, 2.7),
    openingMat,
  );
  innerFloor.rotation.x = -Math.PI / 2;
  innerFloor.position.set(entranceCenterX, 0.035, entranceZ - 1.15);
  innerFloor.renderOrder = 4;
  group.add(innerFloor);

  // 2026-08-25：拱門口上方原本垂吊的鐘乳石(約 3 根)玩家反饋不要了，
  // 兩個洞窟(共用這個模板)都拿掉——只留下面的地面石筍跟苔蘚。
  // 地面石筍——刻意矮一截、留在入口兩側，不擋視線也不擋走路動線。
  [-halfEntrance - 0.3, halfEntrance + 0.3].forEach((offset, i) => {
    const height = 0.55 + hash2(i * 5.5, cave.width) * 0.3;
    const stalagmite = new THREE.Mesh(
      new THREE.ConeGeometry(0.14 + i * 0.02, height, 6),
      i % 2 === 0 ? darkRockMat : rockMat,
    );
    stalagmite.position.set(
      entranceCenterX + offset,
      height / 2,
      entranceZ - 0.6 - i * 0.3,
    );
    stalagmite.castShadow = true;
    stalagmite.renderOrder = 4;
    group.add(stalagmite);
  });

  // 崖面上幾叢苔蘚，扁平球體貼著石頭表面，純靜態不發光——洞口本身
  // 不能觸發互動，套可拿取道具那套 emissive 呼吸光效果會誤導玩家
  // 以為這裡能拿東西。
  for (let i = 0; i < 4; i++) {
    const seed = hash2(i * 11.3, cave.width + 2.2);
    const x = cave.x + 1 + seed * (cave.width - 2);
    if (Math.abs(x - entranceCenterX) < halfEntrance + 0.4) continue;
    const moss = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28 + hash2(i, seed) * 0.16, 0),
      mossRockMat,
    );
    moss.scale.set(1, 0.4, 1);
    moss.position.set(
      x,
      0.35 + hash2(seed, i * 2) * 0.6,
      cave.z + 0.6 + hash2(i, 3.3) * 1.4,
    );
    moss.rotation.y = seed * Math.PI;
    moss.receiveShadow = true;
    group.add(moss);
  }

  return group;
}

export function makeOldVillageStalactiteCaveEntrance() {
  return makeCaveRockEntrance(LAYOUT.oldVillage.stalactiteCave);
}

// 山之洞入口(2026-08-25)——跟 makeOldVillageStalactiteCaveEntrance()
// 共用同一個 makeCaveRockEntrance() 模板，只是餵進 LAYOUT.mountain.cave
// 這份座標，位置在山腳平台(foot)最北緣，見 layout-maps.ts 該處註解。

export function makeMountainCaveEntrance() {
  return makeCaveRockEntrance(LAYOUT.mountain.cave);
}

export function makeWesternMountainTerrain(rows) {
  const group = new THREE.Group();
  const xSegments = 16;
  const zSegments = 36;
  // 草地主地板的實際西緣是 x=-0.5；坡地多壓進去 0.25 格，避免兩片
  // 幾何之間露出天空細縫。這段重疊位於地圖外，不會吃掉可行走草地。
  // 2026-08-26：兩個端點搬進 LAYOUT.mountainBand，makeMountainGateway()
  // 的裝飾石梯要用同一組數字算山坡高度，不能各自寫一份。
  const eastX = LAYOUT.mountainBand.slopeEastX;
  const westX = LAYOUT.mountainBand.slopeWestX;
  // 山脈只略微越過北側懸崖，不再一路鋪到 z=-34、侵入北方海景。
  const northZ = NORTH_CLIFF_Z - 3.2;
  const southZ = rows + SOUTH_TERRAIN_EXTENSION + 24;
  const positions = [];
  const colors = [];
  const indices = [];
  // 顏色跟山區地圖(mountain)自己的背景山體(見 build-map.ts 的
  // mountainMesh vertexColors)同一組數值，兩張地圖的遠景山看起來才
  // 是同一座山，不是各自配色。
  const low = new THREE.Color(0x555b53);
  const high = new THREE.Color(0x7d8070);
  for (let iz = 0; iz <= zSegments; iz++) {
    const tz = iz / zSegments;
    const z = THREE.MathUtils.lerp(northZ, southZ, tz);
    for (let ix = 0; ix <= xSegments; ix++) {
      const tx = ix / xSegments;
      const edgeNotch = ix === 0 ? hash2(iz * 3.7, 21.4) * 0.2 : 0;
      const lateralRidge =
        Math.sin(z * 0.19 + tx * 9.5) * 0.65 * tx * (1 - tx) +
        (hash2(ix * 7.3, iz * 5.9) - 0.5) * 0.7 * tx;
      const x =
        THREE.MathUtils.lerp(eastX - edgeNotch, westX, tx) + lateralRidge;
      const broadRidge = Math.sin(z * 0.13 + tx * 7.2) * (0.8 + tx * 3.8);
      const brokenFace = (hash2(ix * 5.7, iz * 8.3) - 0.5) * (0.5 + tx * 5.2);
      const rockBands = Math.sin(tx * 22 + z * 0.075) * (0.2 + tx * 1.15);
      const rugged =
        (broadRidge + brokenFace + rockBands) * Math.pow(tx, 0.72) * 0.45;
      // 坡度由 LAYOUT 統一控制；舊版 tx^0.28*58 在山腳會突然抬升，
      // 視覺接近直壁。現在用水平距離×tan(角度)形成穩定的 30° 緩坡。
      const horizontalRun = (eastX - westX) * tx;
      const y =
        PLATEAU_Y +
        0.08 +
        horizontalRun *
          Math.tan(THREE.MathUtils.degToRad(LAYOUT.mountainBand.slopeDegrees)) +
        rugged;
      positions.push(x, y, z);
      const shade = low
        .clone()
        .lerp(high, Math.min(1, tx * 0.9 + Math.abs(rugged) * 0.18));
      colors.push(shade.r, shade.g, shade.b);
    }
  }
  for (let iz = 0; iz < zSegments; iz++) {
    for (let ix = 0; ix < xSegments; ix++) {
      const a = iz * (xSegments + 1) + ix;
      const b = a + 1;
      const c = a + xSegments + 1;
      const d = c + 1;
      // ix 往西遞增（world x 反而遞減），所以一般 x/z 網格常用的環繞
      // 在這裡會把法線翻到地底。兩種棋盤對角線都統一由上方看為正面。
      if ((ix + iz) % 2) indices.push(a, b, c, b, d, c);
      else indices.push(a, d, c, a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const slope = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 1,
      side: THREE.DoubleSide,
      // 夜間環境光很低，保留極弱的反射底色，避免近山腳整片沉入黑色；
      // 仍使用受光材質，不改成 MeshBasicMaterial。
      emissive: 0x11150f,
      emissiveIntensity: 0.3,
    }),
  );
  slope.receiveShadow = true;
  slope.castShadow = true;
  group.add(slope);

  // 第一人稱會從高台高度看見山坡東緣下方；補一片只涵蓋實際山腳的側牆，
  // 將坡面接到世界底部。範圍由 LAYOUT 控制，避免再次散落寫死座標。
  const fillMinZ = northZ;
  const fillMaxZ = southZ;
  const footFillTopY = PLATEAU_Y + 0.12;
  const footFillBottomY = LAYOUT.mountainBand.footFillBottomY;
  const footFillHeight = footFillTopY - footFillBottomY;
  const footFillDepth = fillMaxZ - fillMinZ;
  const footFillWidth = eastX - westX + 0.2;
  const footFill = new THREE.Mesh(
    new THREE.BoxGeometry(footFillWidth, footFillHeight, footFillDepth),
    new THREE.MeshStandardMaterial({
      color: low,
      roughness: 1,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  footFill.position.set(
    (westX + eastX) / 2,
    footFillBottomY + footFillHeight / 2,
    (fillMinZ + fillMaxZ) / 2,
  );
  footFill.castShadow = true;
  footFill.receiveShadow = true;
  group.add(footFill);

  // 山壁背板——擋在起伏山坡後面的一片實心背景牆，防止稜線在某些角度
  // /z 值剛好出現低點時，鏡頭直接看穿到後面的星空(破圖)。跟這個專案
  // 其他「地板/水面蓋住星空」的做法同一套：transparent+opacity:1+
  // depthWrite:false，星空先畫，這片背板後畫、用不透明色蓋掉星空，
  // 不是靠深度測試擋（深度測試擋得住的話，前面那片本來就是不透明
  // 材質，山壁本身早該擋住，不會再破圖）。side:DoubleSide 是因為
  // 這個固定俯角鏡頭不保證只從東側看過來。
  const backdropHeight = 90;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(southZ - northZ, backdropHeight),
    new THREE.MeshStandardMaterial({
      color: high.clone().lerp(low, 0.3),
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    }),
  );
  backdrop.rotation.y = Math.PI / 2;
  backdrop.position.set(
    westX - 3,
    PLATEAU_Y - 10 + backdropHeight / 2,
    (northZ + southZ) / 2,
  );
  backdrop.renderOrder = 1;
  group.add(backdrop);

  // 島緣外側的碎岩帶，打散筆直接縫並形成概念圖那種山腳峭壁。
  for (let i = 0; i < 42; i++) {
    const t = i / 41;
    const z = THREE.MathUtils.lerp(northZ, southZ, t);
    const seed = hash2(i * 4.9, 17.3);
    const rock = makeStone(-0.85 - seed * 0.75, z + (seed - 0.5) * 1.8, seed);
    rock.position.y = PLATEAU_Y + 0.22 + seed * 0.3;
    rock.scale.set(2.2 + seed * 2.1, 2.8 + seed * 3.2, 2 + seed * 2.4);
    group.add(rock);
  }
  return group;
}

export function makeSteepStoneStairs(options: {
  x: number;
  z: number;
  y: number;
  directionX: number;
  directionZ: number;
  steps: number;
  run: number;
  dropPerStep: number;
  width: number;
}) {
  const group = new THREE.Group();
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xaa916b,
    flatShading: true,
    roughness: 1,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0x747269,
    flatShading: true,
    roughness: 1,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x694f36,
    flatShading: true,
    roughness: 0.95,
  });
  const directionLength =
    Math.hypot(options.directionX, options.directionZ) || 1;
  const directionX = options.directionX / directionLength;
  const directionZ = options.directionZ / directionLength;
  const sideX = directionZ;
  const sideZ = -directionX;
  for (let i = 0; i < options.steps; i++) {
    const seed = hash2(i * 4.73 + options.x, options.z * 1.91);
    const top = options.y - i * options.dropPerStep;
    const x = options.x + directionX * options.run * i;
    const z = options.z + directionZ * options.run * i;
    const treadDepth = options.run * (1.18 + (seed - 0.5) * 0.12);
    const stepWidth = options.width * (0.94 + seed * 0.1);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepWidth, 0.24 + seed * 0.08, treadDepth),
      i % 2 === 0 ? stepMat : edgeMat,
    );
    step.position.set(x, top - 0.14, z);
    step.rotation.y = Math.atan2(directionX, directionZ) + (seed - 0.5) * 0.035;
    step.castShadow = true;
    step.receiveShadow = true;
    step.renderOrder = 10;
    group.add(step);
    if (i > 0 && i % 2 === 0) {
      [-1, 1].forEach((side) => {
        const rockSeed = hash2(i * 3.7, side * 8.1 + options.z);
        const rock = makeStone(
          x + sideX * side * (options.width * 0.58 + rockSeed * 0.12),
          z + sideZ * side * (options.width * 0.58 + rockSeed * 0.12),
          rockSeed,
        );
        rock.position.y = top + 0.04;
        rock.scale.setScalar(0.8 + rockSeed * 0.55);
        group.add(rock);
      });
    }
  }
  const railHeight = 0.62;
  [-1, 1].forEach((side) => {
    let previous: THREE.Vector3 | null = null;
    for (let i = 0; i < options.steps; i++) {
      const x =
        options.x +
        directionX * options.run * i +
        sideX * side * options.width * 0.58;
      const z =
        options.z +
        directionZ * options.run * i +
        sideZ * side * options.width * 0.58;
      const top = options.y - i * options.dropPerStep;
      const current = new THREE.Vector3(x, top + railHeight, z);
      if (i % 2 === 0 || i === options.steps - 1) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.055, railHeight, 6),
          railMat,
        );
        post.position.set(x, top + railHeight / 2, z);
        post.castShadow = true;
        post.renderOrder = 12;
        group.add(post);
      }
      if (previous) {
        const delta = current.clone().sub(previous);
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(delta.length(), 0.055, 0.055),
          railMat,
        );
        bar.position.copy(previous).add(current).multiplyScalar(0.5);
        bar.quaternion.setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          delta.clone().normalize(),
        );
        bar.castShadow = true;
        bar.renderOrder = 12;
        group.add(bar);
      }
      previous = current;
    }
  });
  group.userData.seasonalMaterials = { stepMat, edgeMat };
  return group;
}

export function makeMountainGateway() {
  const gateway = LAYOUT.mountainGateway;
  // 2026-08-26 三次調整：上一版讓每階下降量貼著山坡地形的 30° 緩坡
  // 走，副作用是「樓底(最靠近草地、玩家最先看到的那階)」被墊到跟
  // 山坡同高，離真正的草地地面還有一截，看起來像第一階特別高。
  // 玩家要求跟住家那組(homeStoneStairs)統一角度(60°)/寬度，這裡改
  // 成：樓底(i = steps-1，最後一階)直接釘在真正的地面高度，樓梯用
  // 固定 60° 往山裡爬升——起點(i=0，最深/最高那階)的 y 用「地面
  // 高度 + 總落差」反推，不是從地面往下算。
  //
  // 60° 比山坡本身的 30° 陡，樓梯爬升速度比山坡本身快，理論上爬得
  // 越遠、樓梯表面跟山坡表面的落差就越大(這裡是樓梯浮在山坡上方，
  // 不是鑽進去)——两个角度不同，全程貼合是做不到的，只能靠縮短
  // 水平總長(visualRun×(visualSteps-1))把落差壓在不明顯的範圍，
  // 樓底附近(玩家視線焦點)保證貼地，最深那一兩階飄高一點在陡峭
  // 石梯本來就常見，不算破圖。
  const dropPerStep = gateway.visualRun * STAIR_SLOPE_TAN;
  const groundY = PLATEAU_Y + 0.08;
  const topY = groundY + dropPerStep * (gateway.visualSteps - 1);
  const visualTopX =
    gateway.visualBottomX - gateway.visualRun * (gateway.visualSteps - 1);
  return makeSteepStoneStairs({
    x: visualTopX,
    z: gateway.visualZ,
    y: topY,
    directionX: 1,
    directionZ: 0,
    steps: gateway.visualSteps,
    run: gateway.visualRun,
    dropPerStep,
    width: DECORATIVE_STAIR_WIDTH,
  });
}

// 天梯——山之洞第25層(=MOUNTAIN_MINE_FLOOR_MAX)上樓樓梯的專屬
// 造型，跟其他 makeMineStaircase/makeSteepStoneStairs 那套「看起來
// 是實體階梯」完全不同調性：玩家要的是「透明懸空發七彩光、無把
// 手」，所以整個反著做——沒有扶手(本來就沒有 rail 的迴圈)、沒有
// 支撐柱(懸空，踏面本身就是唯一的幾何，底下什麼都不放)、材質是
// 半透明+高強度自發光，不是不透光的石材。踏面沿螺旋線一階一階往
// 上疊，色相依階數均勻分布一整圈色環(七彩)，不是單一顏色。
//
// 2026-08-25 剛做出這個函式時，這裡的註解誤寫成「第30層」——
// Zeppelin 2026-08-26 回報這是筆誤，task.md 的原始設計稿寫的是
// 「山之洞第25層的上樓樓梯」，25 正是 MOUNTAIN_MINE_FLOOR_MAX(見
// mine.ts)，已經改正並接進 build-map.ts：頂層(mountainMineUpStairs()
// 回傳 null 那個分支)改成呼叫這個函式放在原本上樓梯會在的角落
// (MOUNTAIN_STAIR_A/B，從 mine.ts 匯出)。目前純視覺，沒有另外接
// 事件觸發——那要等「雲上天宮」(task.md 另一項，還沒構思完成)
// 定案才會真的變成可以往上走的樓梯。
