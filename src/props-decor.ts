// props.ts 拆分：招牌/家具/小型裝飾類 make* 函式（旗桿、路燈、長椅、圍籬……）。
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
import { makeStone, makeFlower, makeTree } from "./props-nature";
import { makeFishProp } from "./props-resources";

export function makeFlagpole(x, z, height, flagColor) {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a4632 });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, height, 6),
    poleMat,
  );
  pole.position.y = height / 2;
  pole.castShadow = true;
  group.add(pole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.2),
    new THREE.MeshStandardMaterial({
      color: flagColor,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  flag.position.set(0.17, height - 0.16, 0);
  group.add(flag);
  group.position.set(x, 0, z);
  return group;
}

// 鐘塔——學校屋頂正中央的小尖塔+一顆鐘，最快跟其他住宅屋頂區分開來
// 的地標細節。呼叫端負責把 y 疊到屋頂高度上面。

export function makeBellCupola(x, z) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.32, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xe4c9a0 }),
  );
  base.position.y = 0.16;
  base.castShadow = true;
  group.add(base);
  const roofGeo = new THREE.ConeGeometry(0.32, 0.3, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({ color: 0x7a2e2e, flatShading: true }),
  );
  roof.position.y = 0.32 + 0.15;
  roof.castShadow = true;
  group.add(roof);
  const bell = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.13, 8),
    new THREE.MeshStandardMaterial({
      color: 0xb8974a,
      metalness: 0.4,
      roughness: 0.5,
    }),
  );
  bell.position.y = 0.14;
  bell.rotation.x = Math.PI;
  group.add(bell);
  group.position.set(x, 0, z);
  return group;
}

// 醫療十字招牌——白底紅十字，醫院門口用大尺寸掛在門楣上方，醫生/
// 護士家門口用小尺寸當門牌，三個地方共用同一個組件、只差 scale。

export function makeMedicalSign(x, z, rotY = 0, scale = 1) {
  const group = new THREE.Group();
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.42 * scale, 0.3 * scale, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf5f2ea }),
  );
  group.add(plaque);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xc23b3b });
  const vertical = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale, 0.22 * scale, 0.03),
    crossMat,
  );
  vertical.position.z = 0.02;
  const horizontal = new THREE.Mesh(
    new THREE.BoxGeometry(0.22 * scale, 0.08 * scale, 0.03),
    crossMat,
  );
  horizontal.position.z = 0.02;
  group.add(vertical, horizontal);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// 書本疊——老師家門口的一疊書，薄方塊交錯堆疊，顏色/角度各自錯開
// 避免看起來像複製貼上。

export function makeBookStack(x, z, rotY = 0) {
  const group = new THREE.Group();
  const colors = [0x6a3a2f, 0x2f4a5a, 0x5a6a3a, 0x7a5a2f];
  let y = 0;
  colors.forEach((color, i) => {
    const h = 0.05 + hash2(i, x) * 0.02;
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.34 - i * 0.02, h, 0.24),
      new THREE.MeshStandardMaterial({ color, flatShading: true }),
    );
    book.position.y = y + h / 2;
    book.rotation.y = (hash2(i, z) - 0.5) * 0.3;
    book.castShadow = true;
    group.add(book);
    y += h;
  });
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// 畫架——三支斜腳撐起一塊畫布，藝術家家門口的裝飾。

export function makeEasel(x, z, rotY = 0) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5138 });
  [
    [-0.14, 0],
    [0.14, 0],
    [0, -0.14],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5),
      woodMat,
    );
    leg.position.set(lx, 0.25, lz);
    leg.rotation.x = lz !== 0 ? 0.35 : 0;
    leg.rotation.z = lz === 0 ? (lx > 0 ? -0.25 : 0.25) : 0;
    leg.castShadow = true;
    group.add(leg);
  });
  const canvas = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.44, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf2ede0 }),
  );
  canvas.position.set(0, 0.5, -0.06);
  canvas.rotation.x = -0.12;
  canvas.castShadow = true;
  group.add(canvas);
  const dab = new THREE.Mesh(
    new THREE.CircleGeometry(0.06, 8),
    new THREE.MeshStandardMaterial({ color: 0xd6483a, flatShading: true }),
  );
  dab.position.set(0.05, 0.52, -0.045);
  dab.rotation.x = -0.12;
  group.add(dab);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// 船舵造型的牆飾——TorusGeometry 當輪圈，幾支細圓柱當輻條，海洋學家
// 家專屬裝飾，貼平在牆面上。

export function makeShipWheelEmblem(x, z, rotY = 0) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5138 });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.025, 6, 12),
    woodMat,
  );
  group.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4),
      woodMat,
    );
    spoke.rotation.z = (i / 6) * Math.PI * 2;
    group.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a4a52 }),
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

// 吊招牌——一支伸出的橫桿+鏈條+吊掛的木牌，雜貨店跟民宿共用同一個
// 組件，只是板子顏色不同，掛在門口正上方。

export function makeHangingSignboard(x, z, rotY = 0, boardColor = 0x5a3a2a) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2f2b28 });
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.03, 0.03),
    metal,
  );
  bracket.position.set(0.15, 0, 0.05);
  group.add(bracket);
  const chainL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4),
    metal,
  );
  chainL.position.set(0.05, -0.09, 0.05);
  const chainR = chainL.clone();
  chainR.position.x = 0.25;
  group.add(chainL, chainR);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.22, 0.03),
    new THREE.MeshStandardMaterial({ color: boardColor }),
  );
  board.position.set(0.15, -0.28, 0.05);
  board.castShadow = true;
  group.add(board);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

export function makePicnicSet(x, z) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), woodMat);
  top.position.y = 0.38;
  top.castShadow = true;
  group.add(top);
  [-0.35, 0.35].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.5), woodMat);
    leg.position.set(lx, 0.19, 0);
    group.add(leg);
  });
  [-0.45, 0.45].forEach((bz) => {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.06, 0.18),
      woodMat,
    );
    bench.position.set(0, 0.24, bz);
    bench.castShadow = true;
    group.add(bench);
  });
  group.position.set(x, 0, z);
  return group;
}

// 花園苗圃——一塊土色底 + 一叢花，重用 makeFlower

export const FLOWER_COLORS = [0xf25f8c, 0xf5c542, 0xffffff, 0x8f6ff5];

export function makeGardenBed(x, z, seed) {
  const group = new THREE.Group();
  const soil = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.05, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x6b4a30 }),
  );
  soil.position.y = 0.02;
  group.add(soil);
  for (let i = 0; i < 5; i++) {
    const fx = (hash2(seed + i, i) - 0.5) * 0.9,
      fz = (hash2(i, seed + i) - 0.5) * 0.6;
    const flower = makeFlower(fx, fz, FLOWER_COLORS[i % FLOWER_COLORS.length]);
    flower.position.y = 0.05;
    group.add(flower);
  }
  group.position.set(x, 0, z);
  return group;
}

export function makeRestArea(area) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(area.width - 0.25, 0.045, area.height - 0.25),
    new THREE.MeshStandardMaterial({ color: 0xc9b98d, roughness: 0.95 }),
  );
  base.position.set((area.width - 1) / 2, 0.02, (area.height - 1) / 2);
  base.receiveShadow = true;
  g.add(base);

  // 中央聚會桌與長椅。
  g.add(makePicnicSet(2.1, 2.4));
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8c6240 });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x34302d,
    metalness: 0.35,
    roughness: 0.7,
  });

  // 有爐盆、烤網與四腳的烤肉架。
  const grill = new THREE.Group();

  // 1. 腳架：長度 0.48，中心點設在 y = 0.24，底部剛好貼齊地面 (y = 0)，頂端在 y = 0.48
  [-0.14, 0.14].forEach((lx) =>
    [-0.09, 0.09].forEach((lz) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, 0.48, 5),
        darkMat,
      );
      leg.position.set(lx, 0.24, lz); // 修正：0.25 -> 0.24
      leg.castShadow = true;
      grill.add(leg);
    }),
  );

  // 2. 爐盆：高 0.2，底部貼齊腳架頂端 (y = 0.44)，中心點設在 y = 0.54 (頂端到 y = 0.64)
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.19, 0.2, 10),
    darkMat,
  );
  bowl.position.y = 0.54; // 修正：0.53 -> 0.54
  bowl.castShadow = true;
  grill.add(bowl);

  // 3. 烤網：厚度 0.025，中心點設在 y = 0.6525，剛好貼平在爐盆上緣
  const grate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.025, 12),
    new THREE.MeshStandardMaterial({
      color: 0x777777,
      metalness: 0.65,
      roughness: 0.45,
    }),
  );
  grate.position.y = 0.6525; // 修正：0.65 -> 0.6525
  grate.castShadow = true;
  grill.add(grate);

  grill.position.set(4.15, 0, 0.2);
  g.add(grill);

  function makeLounger(px, pz, rotation) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.07, 1.05),
      woodMat,
    );
    seat.position.y = 0.22;
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.07, 0.72),
      woodMat,
    );
    back.position.set(0, 0.5, -0.55);
    back.rotation.x = -0.7;
    back.castShadow = true;
    chair.add(back);
    [-0.24, 0.24].forEach((lx) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.24, 0.045),
        woodMat,
      );
      leg.position.set(lx, 0.12, 0.2);
      chair.add(leg);
    });
    chair.position.set(px, 0, pz);
    chair.rotation.y = rotation;
    g.add(chair);
  }
  makeLounger(5.7, 1.55, -0.18);
  makeLounger(5.85, 3.45, 0.18);

  // 可交互座椅；位置只由 LAYOUT.restArea.chair 提供。
  g.add(makeBench(area.chair.offsetX, area.chair.offsetZ, area.chair.rotation));

  // 靠海側留一棵遮蔭樹，讓個人休息區讀起來更舒適。
  const shade = makeTree(6.65, 4.5);
  shade.scale.setScalar(1.35);
  g.add(shade);
  g.position.set(area.x, 0, area.z);
  return g;
}

export function makeSmallGarden(area) {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(area.width - 0.25, 0.04, area.height - 0.25),
    new THREE.MeshStandardMaterial({ color: 0x78a95b, roughness: 1 }),
  );
  lawn.position.set((area.width - 1) / 2, 0.018, (area.height - 1) / 2);
  lawn.receiveShadow = true;
  g.add(lawn);

  // 中央碎石步道把上下兩排花圃分開，入口對準行道樹間的空隙。
  const path = new THREE.Mesh(
    new THREE.BoxGeometry(area.width - 0.4, 0.035, 0.75),
    new THREE.MeshStandardMaterial({ color: 0xc8b897, roughness: 1 }),
  );
  path.position.set((area.width - 1) / 2, 0.045, (area.height - 1) / 2);
  path.receiveShadow = true;
  g.add(path);
  [
    [1.2, 1.3],
    [3.25, 1.3],
    [5.3, 1.3],
    [1.2, 4.8],
    [3.25, 4.8],
    [5.3, 4.8],
  ].forEach(([bx, bz], i) => g.add(makeGardenBed(bx, bz, 20 + i)));

  // 小型鳥浴盆／花園焦點。
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xb8b6ad,
    roughness: 0.85,
  });
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.42, 8),
    stoneMat,
  );
  pedestal.position.set(6.55, 0.21, 3);
  g.add(pedestal);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.18, 0.09, 10),
    stoneMat,
  );
  basin.position.set(6.55, 0.46, 3);
  basin.castShadow = true;
  g.add(basin);
  g.position.set(area.x, 0, area.z);
  return g;
}

// 碼頭＋小船——木棧板延伸到海面上，旁邊停一艘簡化的船身

export function makeConstructionSign(x, z) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b5b4a }),
  );
  post.position.y = 0.3;
  post.castShadow = true;
  group.add(post);
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.28, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xd9a441 }),
  );
  plank.position.y = 0.55;
  plank.castShadow = true;
  group.add(plank);
  group.position.set(x, 0, z);
  return group;
}

export function makeWoodPile(x, z) {
  const group = new THREE.Group();
  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4a30,
    flatShading: true,
    roughness: 0.92,
  });
  const logs = [
    {
      x: -0.14,
      y: 0.09,
      z: -0.08,
      rotY: 0.12,
      len: 0.56,
      r: 0.09,
      mat: barkMat,
    },
    {
      x: 0.09,
      y: 0.09,
      z: 0.04,
      rotY: -0.28,
      len: 0.5,
      r: 0.085,
      mat: barkMat,
    },
    {
      x: 0.02,
      y: 0.09,
      z: 0.17,
      rotY: 0.46,
      len: 0.42,
      r: 0.08,
      mat: barkMat,
    },
  ];
  logs.forEach((l) => {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(l.r, l.r * 0.92, l.len, 7),
      l.mat,
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = l.rotY;
    log.position.set(l.x, l.y, l.z);
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
  });
  group.position.set(x, 0, z);
  return group;
}

// 石頭採集點——一小叢裸露的岩石，比崖邊裝飾用的 makeStone() 大一圈、
// 堆成一叢方便一眼看出是採集點，不另外加發光提示。

export function makeStonePile(x, z) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a86,
    flatShading: true,
    roughness: 0.95,
  });
  const lightRockMat = new THREE.MeshStandardMaterial({
    color: 0xb9c4c9,
    flatShading: true,
    roughness: 0.88,
  });
  const rocks = [
    { x: -0.1, z: 0.06, r: 0.17, seed: 0.3, mat: rockMat },
    { x: 0.13, z: -0.04, r: 0.15, seed: 0.7, mat: rockMat },
    { x: -0.02, z: 0.16, r: 0.12, seed: 1.1, mat: rockMat },
    { x: 0.03, z: -0.02, r: 0.19, seed: 1.6, mat: lightRockMat },
  ];
  rocks.forEach((r) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r.r, 0), r.mat);
    mesh.position.set(r.x, r.r * 0.72, r.z);
    mesh.rotation.set(r.seed * 5, r.seed * 3, r.seed * 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  group.position.set(x, 0, z);
  return group;
}

// 採集成功時飛出去的小木屑/碎石——跟 makeFishProp() 那顆「飛向玩家」
// 的魚同等級的簡單一次性演出道具，input-save.ts 建立、丟進
// gameState.gatherChipAnims，game-loop.ts 逐幀更新拋物線再移除。

export function makeChipDebris(kind, seed) {
  const mat = new THREE.MeshStandardMaterial({
    color: kind === "wood" ? 0x8a6440 : 0x9a9a94,
    flatShading: true,
  });
  const chip = new THREE.Mesh(
    kind === "wood"
      ? new THREE.BoxGeometry(0.05, 0.05, 0.12)
      : new THREE.TetrahedronGeometry(0.06, 0),
    mat,
  );
  chip.rotation.set(seed * 6, seed * 4, seed * 2);
  chip.castShadow = true;
  return chip;
}

// 動物小屋左牆的自動加工／投餵設備：長槽沿整面側牆延伸，右側輸送管
// 穿入小屋，表示加工後會直接送進室內餵食槽。

export function makeFence(minX, maxX, minZ, maxZ) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9c7a52 });
  function post(x, z) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.36, 6),
      postMat,
    );
    p.position.set(x, 0.18, z);
    p.castShadow = true;
    g.add(p);
  }
  function railX(x1, x2, z) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(x2 - x1, 0.04, 0.04),
      railMat,
    );
    r.position.set((x1 + x2) / 2, 0.24, z);
    g.add(r);
  }
  function railZ(z1, z2, x) {
    const r = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, z2 - z1),
      railMat,
    );
    r.position.set(x, 0.24, (z1 + z2) / 2);
    g.add(r);
  }
  for (let x = minX; x <= maxX; x++) {
    post(x, minZ);
    post(x, maxZ);
  }
  for (let z = minZ; z <= maxZ; z++) {
    post(minX, z);
    post(maxX, z);
  }
  for (let x = minX; x < maxX; x++) {
    railX(x, x + 1, minZ);
    railX(x, x + 1, maxZ);
  }
  for (let z = minZ; z < maxZ; z++) {
    railZ(z, z + 1, minX);
    railZ(z, z + 1, maxX);
  }
  return g;
}

// 動物——牛、羊、雞，都用最少的幾何圖形拼出可辨識的外形，
// 沒有走路動畫（跟低模人形不同層級），純粹靠位置平移 + 面向旋轉

export function makeLamp() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.04, 8),
    dark,
  );
  base.position.y = 0.02;
  group.add(base);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6),
    dark,
  );
  pole.position.y = 0.15;
  group.add(pole);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: new THREE.Color(0xffdd88),
    emissiveIntensity: 0,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbMat);
  bulb.position.y = 0.3;
  group.add(bulb);
  const light = new THREE.PointLight(0xffdd99, 0, 2.4, 2);
  light.position.y = 0.3;
  group.add(light);
  return { group, bulbMat, light };
}

// 天花板頂燈——房子放大之後桌燈(makeLamp，distance 只有 2.4)照不到
// 整個空間，這裡另外做一組吊掛式頂燈，掛在天花板附近往下垂，
// distance 拉大到 7 涵蓋主空間；材質/開關邏輯(bulbMat 隨 nightFactor
// 發光、light.intensity 隨 nightFactor)跟桌燈同一套，只是掛的位置
// 跟照明範圍不同。group 原點對齊天花板掛點，子物件用負 y 往下垂吊，
// 呼叫端只要把 group 擺在天花板高度(~1.35~1.4)就好。

export function makeCeilingLamp() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6),
    dark,
  );
  mount.position.y = -0.05;
  group.add(mount);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0x4a4438,
    roughness: 0.9,
  });
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.16, 10, 1, true),
    shadeMat,
  );
  shade.rotation.x = Math.PI;
  shade.position.y = -0.14;
  shade.castShadow = true;
  group.add(shade);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: new THREE.Color(0xffdd88),
    emissiveIntensity: 0,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bulbMat);
  bulb.position.y = -0.2;
  group.add(bulb);
  const light = new THREE.PointLight(0xffdd99, 0, 7, 1.6);
  light.position.y = -0.2;
  group.add(light);
  return { group, bulbMat, light };
}

export function makeStreetLamp(x, z, towardRoad) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0x30383b,
    flatShading: true,
    roughness: 0.78,
  });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.17, 0.12, 8),
    metal,
  );
  base.position.y = 0.06;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.065, 1.55, 8),
    metal,
  );
  pole.position.y = 0.82;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.42), metal);
  arm.position.set(0, 1.56, towardRoad * 0.16);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.18, 8, 1, true),
    metal,
  );
  shade.position.set(0, 1.48, towardRoad * 0.34);
  shade.rotation.x = Math.PI;
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffedb0,
    emissive: new THREE.Color(0xffc96b),
    emissiveIntensity: 0,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), bulbMat);
  bulb.position.set(0, 1.43, towardRoad * 0.34);
  const light = new THREE.PointLight(0xffc978, 0, 4.2, 2);
  light.position.copy(bulb.position);
  [base, pole, arm, shade].forEach((mesh) => {
    mesh.castShadow = true;
  });
  group.add(base, pole, arm, shade, bulb, light);
  group.position.set(x, 0, z);
  windowMats.push(bulbMat);
  outdoorLampLights.push(light);
  return group;
}

// 廣場長椅——兩片木板(座面/椅背)+ 兩支金屬椅腳，跟路燈同一套低模語彙
// (簡單方塊拼接)，facing 決定椅背朝哪個方向(玩家會從椅背對面走近)。

export function makeBench(x, z, facing = 0) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a45,
    flatShading: true,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x2f2b28,
    flatShading: true,
  });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.36), woodMat);
  seat.position.y = 0.32;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.06), woodMat);
  back.position.set(0, 0.52, -0.15);
  back.castShadow = true;
  group.add(back);
  [-0.36, 0.36].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.32), metal);
    leg.position.set(legX, 0.16, 0);
    leg.castShadow = true;
    group.add(leg);
  });
  group.position.set(x, 0, z);
  group.rotation.y = facing;
  return group;
}

// 簡單的營火——一圈石頭圍住一塊燒黑的地面，概念圖山腳平台那個小
// 篝火造型。純裝飾，沒有真的火焰粒子效果。

export function makeCampfireRing(x, z) {
  const group = new THREE.Group();
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.01;
  group.add(ash);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a86,
    flatShading: true,
  });
  const STONE_COUNT = 10;
  for (let i = 0; i < STONE_COUNT; i++) {
    const angle = (i / STONE_COUNT) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.09 + hash2(i, 3.1) * 0.03, 0),
      stoneMat,
    );
    stone.position.set(Math.cos(angle) * 0.4, 0.06, Math.sin(angle) * 0.4);
    stone.rotation.set(hash2(i, 1) * 6, hash2(i, 2) * 6, hash2(i, 3) * 6);
    stone.castShadow = true;
    group.add(stone);
  }
  // 燒焦的木柴堆在中央
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2e24 });
  [0, 1, 2].forEach((i) => {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6),
      logMat,
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.05;
    group.add(log);
  });
  group.position.set(x, 0, z);
  return group;
}

export function makeFurniture(item) {
  const g = new THREE.Group();
  if (item.type === "bed") {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.14, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
    );
    frame.position.y = 0.08;
    frame.castShadow = true;
    g.add(frame);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.16, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xf2f0e8 }),
    );
    mattress.position.y = 0.22;
    mattress.castShadow = true;
    mattress.receiveShadow = true;
    g.add(mattress);
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.06, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xdb5f86 }),
    );
    blanket.position.set(0, 0.33, 0.35);
    g.add(blanket);
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    );
    pillow.position.set(0, 0.33, -0.68);
    g.add(pillow);
  } else if (item.type === "table") {
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.06, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x9c7248 }),
    );
    top.position.y = 0.42;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4a30 });
    [
      [-0.32, -0.32],
      [0.32, -0.32],
      [-0.32, 0.32],
      [0.32, 0.32],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6),
        legMat,
      );
      leg.position.set(lx, 0.2, lz);
      leg.castShadow = true;
      g.add(leg);
    });
  } else if (item.type === "chair") {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a }),
    );
    seat.position.y = 0.28;
    seat.castShadow = true;
    g.add(seat);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x8a5a3a }),
    );
    back.position.set(0, 0.5, -0.18);
    back.castShadow = true;
    g.add(back);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24 });
    [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.28, 5),
        legMat,
      );
      leg.position.set(lx, 0.14, lz);
      g.add(leg);
    });
    if (item.rot) g.rotation.y = item.rot;
  } else if (item.type === "rug") {
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.02, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xc9576b }),
    );
    rug.position.y = 0.015;
    rug.receiveShadow = true;
    g.add(rug);
  } else if (item.type === "stove") {
    // 通用料理系統的互動點——爐台本體+一口鍋，鍋底一圈常亮的暖色
    // emissive 代表爐火，不用另外做真的火焰粒子。跟採集點的
    // 「今天能不能用」發光不同，這裡沒有每日限制(食材夠不夠才是
    // 唯一限制)，所以固定亮著，不用 game-loop.ts 逐幀調整。
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.46, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x4a4a4d, flatShading: true }),
    );
    body.position.y = 0.23;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const stovetop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.05, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2c2c2e,
        roughness: 0.7,
        emissive: new THREE.Color(0xff7a3c),
        emissiveIntensity: 0.4,
      }),
    );
    stovetop.position.y = 0.48;
    g.add(stovetop);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.14, 0.16, 10),
      new THREE.MeshStandardMaterial({
        color: 0x6b6f76,
        metalness: 0.3,
        roughness: 0.6,
      }),
    );
    pot.position.y = 0.58;
    pot.castShadow = true;
    g.add(pot);
    const potHandleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c });
    [-0.14, 0.14].forEach((hx) => {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 5),
        potHandleMat,
      );
      handle.position.set(hx, 0.58, 0);
      g.add(handle);
    });
  } else if (item.type === "counter") {
    // 流理台——純裝飾，跟爐台湊出「廚房一角」；上面擺一顆砧板+兩顆
    // 蔬果球體，暗示這裡是備料檯，不用真的做寫實食材模型。
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.44, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xc9a877, flatShading: true }),
    );
    top.position.y = 0.22;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xdac496 }),
    );
    board.position.set(-0.08, 0.45, 0.05);
    board.receiveShadow = true;
    g.add(board);
    [
      { x: 0.16, z: -0.08, color: 0xd2483a },
      { x: 0.2, z: 0.08, color: 0xe0a934 },
    ].forEach((v) => {
      const veg = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 7, 6),
        new THREE.MeshStandardMaterial({ color: v.color, flatShading: true }),
      );
      veg.position.set(v.x, 0.5, v.z);
      veg.castShadow = true;
      g.add(veg);
    });
  }
  return g;
}

// ==============================================================
// 鐘乳石洞窟採礦系統(mine.ts)的模型——沿用木材/石頭採集點
// (makeStonePile 那套「岩石堆+castShadow」)的做法，但額外嵌幾顆
// 依礦石階層上色的晶粒當辨識重點，純材質顏色分辨、不用 emissive
// 發光(跟木材/石頭堆同一個理由：不是「今天採過沒」需要提示的東西)。
// ==============================================================
