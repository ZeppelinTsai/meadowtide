// props.ts 拆分：農牧/釣魚/採礦資源類 make* 函式（作物、動物、魚、礦石……）。
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

export function makeOysterRack(x, z) {
  const group = new THREE.Group();
  const raftSize = 1.3;
  const deckY = 0.32;
  const poleRadius = 0.035;

  // 竹枝顏色每根都帶一點深淺差異(用 hash2 取偏移)，不要整批同一個
  // 棕色，不然遠看會像一塊塑膠板，不像泡過海水、曬過太陽的真竹竿。
  const poleBaseColor = new THREE.Color(0x8f7248);
  const poleDarkColor = new THREE.Color(0x5f4a2c);
  function makePole(len, seed, axis) {
    const mat = new THREE.MeshStandardMaterial({
      color: poleBaseColor.clone().lerp(poleDarkColor, hash2(seed, 4.4) * 0.7),
      roughness: 0.95,
    });
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(poleRadius, poleRadius * 0.85, len, 6),
      mat,
    );
    pole.rotation[axis === "x" ? "z" : "x"] = Math.PI / 2;
    pole.castShadow = true;
    pole.receiveShadow = true;
    return pole;
  }

  // 外框——細竹竿把四個浮桶串起來，raft 才不會看起來懸空散開。
  [-raftSize / 2, raftSize / 2].forEach((pz, i) => {
    const pole = makePole(raftSize, i, "x");
    pole.position.set(0, deckY, pz);
    group.add(pole);
  });
  [-raftSize / 2, raftSize / 2].forEach((px, i) => {
    const pole = makePole(raftSize, i + 2, "z");
    pole.position.set(px, deckY + 0.015, 0);
    group.add(pole);
  });
  // 內部交叉——兩根沿 x、兩根沿 z，疊出「井」字的窗格，中間刻意留空
  // 隙，才看得到底下的海面跟養殖繩，不是鋪滿的實心甲板。
  [-0.32, 0.32].forEach((pz, i) => {
    const pole = makePole(raftSize, i + 4, "x");
    pole.position.set(0, deckY + 0.03, pz);
    group.add(pole);
  });
  [-0.32, 0.32].forEach((px, i) => {
    const pole = makePole(raftSize, i + 6, "z");
    pole.position.set(px, deckY + 0.045, 0);
    group.add(pole);
  });

  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xd9482f });
  [
    [-raftSize / 2, -raftSize / 2],
    [raftSize / 2, -raftSize / 2],
    [-raftSize / 2, raftSize / 2],
    [raftSize / 2, raftSize / 2],
  ].forEach(([bx, bz]) => {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), buoyMat);
    buoy.position.set(bx, 0.28, bz);
    buoy.castShadow = true;
    group.add(buoy);
  });

  // 養殖繩＋牡蠣殼——沿著井字的交叉點垂下去，殼故意分成「趴在框上」
  // 跟「垂進水裡」兩層：框上那層從甲板縫隙直接看得到，水裡那層要湊
  // 近或角度夠斜才會露出來，呼應真的蚵架殼堆長在竹枝跟繩子上的樣子。
  // 框上那層額外用 glowShellMat(emissive 材質，做法跟窗戶/桌燈同招)，
  // 讓 game-loop.ts 能依照「今天採過了嗎」把它調亮/調暗——還沒採就
  // 微微發光提醒玩家，採完就跟一般的殼一樣暗下來。水裡那層維持普通
  // 材質，純粹當作養殖架平常就有牡蠣在長的背景裝飾，不受收成狀態影響。
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3a3226 });
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x8f9188,
    flatShading: true,
    roughness: 0.9,
  });
  const glowShellMat = new THREE.MeshStandardMaterial({
    color: 0xf3e8c8,
    flatShading: true,
    roughness: 0.6,
    emissive: new THREE.Color(0xffe9a8),
    emissiveIntensity: 0,
  });
  const clusterSpots = [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
    [0, 0],
  ];
  clusterSpots.forEach(([rx, rz], ci) => {
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.42, 5),
      ropeMat,
    );
    rope.position.set(rx, deckY - 0.16, rz);
    group.add(rope);
    // 趴在竹枝交叉點上的殼——甲板縫隙直接看得到，不用湊近角度
    for (let s = 0; s < 2; s++) {
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.06 + hash2(ci, s) * 0.025, 0),
        glowShellMat,
      );
      shell.position.set(
        rx + (hash2(s, ci) - 0.5) * 0.1,
        deckY + 0.05 + hash2(ci, s + 9) * 0.03,
        rz + (hash2(ci * 3, s) - 0.5) * 0.1,
      );
      shell.rotation.set(
        hash2(s, ci + 1) * 6,
        hash2(s, ci + 2) * 6,
        hash2(s, ci + 3) * 6,
      );
      shell.castShadow = true;
      group.add(shell);
    }
    // 垂進水裡那串——沿繩子往下長，貼著海面若隱若現
    for (let s = 0; s < 3; s++) {
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.06 + hash2(ci + s, s) * 0.03, 0),
        shellMat,
      );
      shell.position.set(
        rx + (hash2(s, ci + 5) - 0.5) * 0.08,
        deckY - 0.22 - s * 0.08,
        rz + (hash2(ci * 3, s + 5) - 0.5) * 0.08,
      );
      shell.rotation.set(
        hash2(s, ci + 4) * 6,
        hash2(s, ci + 5) * 6,
        hash2(s, ci + 6) * 6,
      );
      shell.castShadow = true;
      group.add(shell);
    }
  });

  group.position.set(x, 0, z);
  return { group, glowMat: glowShellMat };
}

export function makePearlProp(rarity: import("./pearl-system").PearlRarity) {
  const colors: Record<import("./pearl-system").PearlRarity, number> = {
    white: 0xf4f1df,
    pink: 0xf2a9ba,
    purple: 0x9267b2,
    black: 0x24242c,
    gold: 0xe5bd48,
  };
  const group = new THREE.Group();
  const pearl = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshStandardMaterial({
      color: colors[rarity],
      roughness: 0.18,
      metalness: rarity === "gold" ? 0.45 : 0.12,
      emissive: new THREE.Color(colors[rarity]),
      emissiveIntensity: rarity === "black" ? 0.08 : 0.16,
    }),
  );
  pearl.castShadow = true;
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: rarity === "black" ? 0.5 : 0.78,
    }),
  );
  highlight.position.set(-0.07, 0.08, 0.13);
  group.add(pearl, highlight);
  return group;
}
// 蜂箱——放在花田南側的獨立點狀結構，跟動物投餵機一樣是「單點座標＋
// interactionRadius」而不是農地那種多格清單(見 game-state.ts 的
// BEEHIVE_VISUAL/isPointInsideBeehive)。造型走傳統疊層蜂箱(bee skep 的
// 現代版，一層層往上縮)，尖頂加一圈小蜜蜂裝飾，遠遠就認得出跟投餵機
// /養殖架不是同一種設施。初期(gameState.ts 的 isBeehiveUnlocked()===
// false 時)build-map.ts 根本不會呼叫這個函式，不用在這裡自己判斷要不
// 要畫。
export function makeBeehive(x, z) {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xc9963f,
    flatShading: true,
    roughness: 0.85,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x8a5a2b,
    flatShading: true,
    roughness: 0.78,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x6b3f22,
    flatShading: true,
    roughness: 0.82,
  });

  // 三層疊箱，越往上越窄，模仿傳統蜂箱一層層加高的樣子。
  const tiers = [
    { size: 0.62, y: 0.16, height: 0.3 },
    { size: 0.5, y: 0.42, height: 0.24 },
    { size: 0.4, y: 0.62, height: 0.2 },
  ];
  tiers.forEach(({ size, y, height }, i) => {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(size, height, size),
      boxMat,
    );
    tier.position.y = y;
    tier.castShadow = true;
    tier.receiveShadow = true;
    group.add(tier);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.05, 0.04, size + 0.05),
      trimMat,
    );
    rim.position.y = y + height / 2 + 0.02;
    rim.castShadow = true;
    group.add(rim);
    if (i === 0) {
      // 底層開一個小小的出入口，面向南邊(玩家互動的方向)。
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.045, 8),
        new THREE.MeshStandardMaterial({ color: 0x2b1c10 }),
      );
      hole.position.set(0, y - height * 0.15, size / 2 + 0.001);
      group.add(hole);
    }
  });

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.34, 0.24, 4),
    roofMat,
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.86;
  roof.castShadow = true;
  group.add(roof);

  // 底座木架，墊高蜂箱離地一點，跟投餵機的腳架同一種語彙。
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.16, 0.05),
        trimMat,
      );
      leg.position.set(sx * 0.24, 0.08, sz * 0.24);
      leg.castShadow = true;
      group.add(leg);
    });
  });

  // 一圈小蜜蜂裝飾(扁球體+線框翅膀)，純視覺，繞著蜂箱慢慢轉的動畫留給
  // animate() 之後要做再接，這裡先固定擺三隻位置不同的意思意思。
  const beeBodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b2117,
    flatShading: true,
  });
  const beeWingMat = new THREE.MeshStandardMaterial({
    color: 0xf3efe4,
    transparent: true,
    opacity: 0.55,
  });
  [
    [0.32, 0.55, 0.1],
    [-0.28, 0.68, -0.18],
    [0.15, 0.78, 0.3],
  ].forEach(([bx, by, bz], i) => {
    const bee = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 6, 5),
      beeBodyMat,
    );
    body.scale.set(1, 0.85, 1.3);
    bee.add(body);
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), beeWingMat);
    wing.position.set(0, 0.02, 0);
    wing.rotation.x = -Math.PI / 2.4;
    bee.add(wing);
    bee.position.set(bx, by, bz);
    bee.rotation.y = hash2(i, 3.7) * Math.PI * 2;
    group.add(bee);
  });

  group.position.set(x, 0, z);
  return group;
}

// 休息區野餐組——桌子＋兩張長椅，樹蔭直接借用 makeTree

export function makeAnimalFeeder(config) {
  const { x, z, width, depth, height } = config;
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x4b4a43,
    flatShading: true,
    roughness: 0.82,
    metalness: 0.22,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x7a8a63,
    flatShading: true,
    roughness: 0.78,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xb69259,
    flatShading: true,
    roughness: 0.72,
  });

  [-1, 0, 1].forEach((row) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.42, 0.09),
      frameMat,
    );
    leg.position.set(0, 0.21, row * depth * 0.38);
    leg.castShadow = true;
    group.add(leg);
  });

  const trough = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.28, depth),
    trimMat,
  );
  trough.position.y = 0.5;
  trough.castShadow = true;
  trough.receiveShadow = true;
  group.add(trough);

  const processor = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.9, height * 0.62, depth * 0.78),
    panelMat,
  );
  processor.position.y = 0.72 + height * 0.31;
  processor.castShadow = true;
  processor.receiveShadow = true;
  group.add(processor);

  const hopper = new THREE.Mesh(
    new THREE.CylinderGeometry(width * 0.42, width * 0.34, height * 0.45, 4),
    panelMat,
  );
  hopper.rotation.y = Math.PI / 4;
  hopper.position.y = height * 1.18;
  hopper.castShadow = true;
  group.add(hopper);

  // 橫向輸送管從設備右側接進小屋左牆。
  const feedPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 1.05, 8),
    frameMat,
  );
  feedPipe.rotation.z = Math.PI / 2;
  feedPipe.position.set(0.52, 0.82, 0);
  feedPipe.castShadow = true;
  group.add(feedPipe);

  // 三個檢修面板讓長設備看起來是一整套加工機，而不是放大的單一漏斗。
  [-0.28, 0, 0.28].forEach((ratio) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.34, depth * 0.2),
      trimMat,
    );
    panel.position.set(-width * 0.47, 0.9, ratio * depth);
    group.add(panel);
  });
  group.position.set(x, 0, z);
  return group;
}

function makeRadishCropMesh(stage: number) {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x63a94f,
    flatShading: true,
  });
  if (stage === 0) {
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 4),
        leafMat,
      );
      leaf.scale.set(1.45, 0.35, 0.7);
      leaf.position.set(side * 0.035, 0.055, 0);
      leaf.rotation.z = side * 0.45;
      g.add(leaf);
    }
    return g;
  }
  if (stage === 2) {
    const root = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf1eee2, flatShading: true }),
    );
    root.scale.set(0.82, 1.1, 0.82);
    root.position.y = 0.07;
    g.add(root);
  }
  const leaves = stage === 1 ? 2 : 4;
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), leafMat);
    const angle = (i / leaves) * Math.PI * 2;
    leaf.scale.set(0.55, stage === 1 ? 0.9 : 1.35, 0.45);
    leaf.position.set(
      Math.cos(angle) * 0.055,
      stage === 1 ? 0.13 : 0.22,
      Math.sin(angle) * 0.055,
    );
    leaf.rotation.z = Math.cos(angle) * 0.42;
    leaf.rotation.x = Math.sin(angle) * 0.42;
    g.add(leaf);
  }
  return g;
}
export function makeCropMesh(
  stage,
  cropType: "radish" | "potato" | "tomato" = "radish",
) {
  if (stage === 0) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.1, 5),
      new THREE.MeshStandardMaterial({
        color: 0x5fae4a,
        flatShading: true,
      }),
    );
    m.position.y = 0.08;
    return m;
  }
  if (stage === 1) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.22, 5),
      new THREE.MeshStandardMaterial({ color: 0x3f9142 }),
    );
    stem.position.y = 0.11;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({
        color: 0x5fae4a,
        flatShading: true,
      }),
    );
    leaf.position.y = 0.22;
    g.add(stem, leaf);
    return g;
  }
  // 成熟株(stage >= 2)依 cropType 分開造型——這裡之前不管三種作物種了
  // 什麼，一律長成同一叢番茄，farm-visuals.ts 傳進來的 cropType 形同虛設；
  // 2026-09-01 Zeppelin 要求補上蘿蔔／馬鈴薯專屬外觀時才發現。三顆共用
  // stage 0/1(幼苗/發芽)的通用造型，只有成熟株才分岔，跟真實作物一樣——
  // 幼苗階段本來就看不太出差異，不用提早分岔。
  if (cropType === "radish") {
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf4d7b7, flatShading: true }),
    );
    bulb.scale.set(1, 1.3, 1);
    bulb.position.y = 0.09;
    g.add(bulb);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.14, 5),
      new THREE.MeshStandardMaterial({ color: 0x3f9142 }),
    );
    stem.position.y = 0.21;
    g.add(stem);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x5fae4a,
      flatShading: true,
    });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.045, 0),
        leafMat,
      );
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.04, 0.27, Math.sin(a) * 0.04);
      leaf.scale.set(1, 0.6, 1.4);
      g.add(leaf);
    }
    return g;
  }
  if (cropType === "potato") {
    const g = new THREE.Group();
    const tuber = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xb47b52, flatShading: true }),
    );
    tuber.scale.set(1.25, 0.85, 1.05);
    tuber.position.y = 0.075;
    g.add(tuber);
    const bumpMat = new THREE.MeshStandardMaterial({
      color: 0xc98f62,
      flatShading: true,
    });
    [
      [-0.04, -0.01],
      [0.03, 0.02],
    ].forEach(([x, z]) => {
      const bump = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 6, 5),
        bumpMat,
      );
      bump.position.set(x, 0.11, z);
      g.add(bump);
    });
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.12, 5),
      new THREE.MeshStandardMaterial({ color: 0x3f9142 }),
    );
    stem.position.y = 0.19;
    g.add(stem);
    const sproutMat = new THREE.MeshStandardMaterial({
      color: 0x5b9d46,
      flatShading: true,
    });
    [-1, 1].forEach((side) => {
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.035, 0),
        sproutMat,
      );
      leaf.position.set(side * 0.035, 0.24, 0);
      leaf.scale.set(1, 0.6, 1.3);
      g.add(leaf);
    });
    return g;
  }
  // tomato（既有造型，改成明確分支，不再是「其他情況一律用這個」的預設）
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.26, 5),
    new THREE.MeshStandardMaterial({ color: 0x3f9142 }),
  );
  stem.position.y = 0.13;
  g.add(stem);
  for (let i = 0; i < 3; i++) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xe0442f,
        flatShading: true,
      }),
    );
    const a = (i / 3) * Math.PI * 2;
    fruit.position.set(Math.cos(a) * 0.09, 0.2 + i * 0.02, Math.sin(a) * 0.09);
    g.add(fruit);
  }
  return g;
}
// 柵欄——純視覺，沒有真的擋人或擋動物，動物的活動範圍是用座標邊界算的，
// 不是靠柵欄物理擋住。純粹是圍出「這裡是牧草地」的視覺語彙
// 遠山——純背景裝飾，放在地圖西側邊界外（x 是負的，isBlocked 本來就會把
// 超出邊界的座標判定為擋路，不用額外寫碰撞）。顏色刻意調成偏藍灰、不飽和，
// 這是「空氣透視」的偷吃步：越遠的東西，人眼會自動感覺它偏藍偏淡，
// 不用真的做距離霧化計算，選對顏色就有「這座山很遠」的錯覺

export function makeRedWindmill(area) {
  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xb73535,
    flatShading: true,
    roughness: 0.88,
  });
  const darkRedMat = new THREE.MeshStandardMaterial({
    color: 0x76252a,
    flatShading: true,
    roughness: 0.92,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xf1dfbd,
    flatShading: true,
    roughness: 0.82,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3629,
    flatShading: true,
    roughness: 1,
  });

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 1.02, 2.35, 8),
    redMat,
  );
  tower.position.y = 1.18;
  // CylinderGeometry 的八邊形預設讓頂角朝向正面；轉半個分段，改成平面朝前。
  tower.rotation.y = Math.PI / 8;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.72, 8),
    darkRedMat,
  );
  roof.position.y = 2.68;
  roof.rotation.y = Math.PI / 8;
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.62, 0.08), woodMat);
  door.position.set(0, 0.34, 1.01);
  group.add(door);

  // 從塔身正面伸到扇葉輪轂的主軸。原本 rotor 整組懸在 z=1.2，塔身在
  // 這個高度的正面只到約 z=0.75，低角度看會明顯斷開；主軸後端刻意
  // 插進塔身、前端插進 hub，旋轉時也不會露出縫隙。
  const rotorAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.64, 10),
    woodMat,
  );
  rotorAxle.rotation.x = Math.PI / 2;
  rotorAxle.position.set(0, 2.14, 0.9);
  rotorAxle.castShadow = true;
  group.add(rotorAxle);

  const rotor = new THREE.Group();
  // 整組轉軸往塔身正面外推，保留葉片厚度與屋身間隙，避免旋轉時穿模。
  rotor.position.set(0, 2.14, 1.2);
  rotor.scale.setScalar(0.9);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = i * Math.PI * 0.5;
    const spar = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.42, 0.09),
      woodMat,
    );
    spar.position.y = 0.7;
    const sail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.82, 0.075),
      creamMat,
    );
    sail.position.set(0.12, 0.91, 0.02);
    sail.rotation.z = -0.08;
    sail.castShadow = true;
    arm.add(spar, sail);
    rotor.add(arm);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 0.22, 10),
    darkRedMat,
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.08;
  rotor.add(hub);
  group.add(rotor);
  windmillRotors.push(rotor);

  group.position.set(
    area.visualX ?? area.x + (area.w - 1) / 2,
    0,
    area.visualZ ?? area.z + (area.d - 1) / 2,
  );
  group.scale.setScalar(area.scale || 1);
  return group;
}

export function makeAnimal(type, seed = 0) {
  const g: any = new THREE.Group();
  const parts: any = {};
  // 同一物種的每隻動物用 seed 對主色調做小幅 HSL 偏移，讓牛/羊/雞彼此能
  // 一眼分辨出不同個體，深色的斑點/雞冠/喙不跟著變——那些是「該物種的
  // 標記」，變了反而認不出是同一種動物。
  const hueShift = (hash2(seed, 4.1) - 0.5) * 0.05;
  const satShift = (hash2(seed, 2.6) - 0.5) * 0.12;
  const lightShift = (hash2(seed, 9.7) - 0.5) * 0.2;
  function tint(hex) {
    return new THREE.Color(hex).offsetHSL(hueShift, satShift, lightShift);
  }
  // 跟人形角色同一招：腿是「髖部支點群組 + 往下掛的圓柱」，不是直接轉圓柱
  // 本身，這樣轉軸才會在髖部，甩起來才是「抬腿」而不是圓柱繞自己中心轉
  function makeLeg(mat, x, z, hipY, legLen, radius) {
    const pivot = new THREE.Group();
    pivot.position.set(x, hipY, z);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, legLen, 5),
      mat,
    );
    leg.position.y = -legLen / 2;
    leg.castShadow = true;
    pivot.add(leg);
    g.add(pivot);
    return pivot;
  }
  if (type === "cow") {
    const hide = new THREE.MeshStandardMaterial({ color: tint(0xf2ede0) });
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.24), hide);
    body.position.y = 0.22;
    body.castShadow = true;
    g.add(body);
    const spot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.1, 0.02),
      spotMat,
    );
    spot.position.set(0.04, 0.27, 0.13);
    g.add(spot);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), hide);
    head.position.set(0.28, 0.24, 0);
    head.castShadow = true;
    g.add(head);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a });
    // x>0 是前腳(靠近頭那側)，z 分左右——四隻腳分開存，走路才能對角同步擺動
    parts.legFL = makeLeg(legMat, 0.15, 0.08, 0.18, 0.18, 0.025);
    parts.legFR = makeLeg(legMat, 0.15, -0.08, 0.18, 0.18, 0.025);
    parts.legBL = makeLeg(legMat, -0.15, 0.08, 0.18, 0.18, 0.025);
    parts.legBR = makeLeg(legMat, -0.15, -0.08, 0.18, 0.18, 0.025);
  } else if (type === "sheep") {
    const wool = new THREE.MeshStandardMaterial({
      color: tint(0xf5f0e6),
      flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2420 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), wool);
    body.scale.set(1.3, 1, 1.1);
    body.position.y = 0.2;
    body.castShadow = true;
    body.userData.fullWoolColor = wool.color.clone();
    parts.woolBody = body;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), dark);
    head.position.set(0.19, 0.2, 0);
    g.add(head);
    parts.legFL = makeLeg(dark, 0.08, 0.06, 0.14, 0.14, 0.018);
    parts.legFR = makeLeg(dark, 0.08, -0.06, 0.14, 0.14, 0.018);
    parts.legBL = makeLeg(dark, -0.08, 0.06, 0.14, 0.14, 0.018);
    parts.legBR = makeLeg(dark, -0.08, -0.06, 0.14, 0.14, 0.018);
  } else {
    // chicken
    const feather = new THREE.MeshStandardMaterial({
      color: tint(0xf2f0e8),
      flatShading: true,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), feather);
    body.scale.set(1, 1.05, 1.2);
    body.position.y = 0.13;
    body.castShadow = true;
    g.add(body);
    const comb = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.05, 4),
      new THREE.MeshStandardMaterial({ color: 0xd9433a }),
    );
    comb.position.set(0.06, 0.21, 0);
    g.add(comb);
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.04, 4),
      new THREE.MeshStandardMaterial({ color: 0xe0a83a }),
    );
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.11, 0.14, 0);
    g.add(beak);
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe0a83a });
    parts.legL = makeLeg(legMat, -0.02, 0.03, 0.09, 0.09, 0.008);
    parts.legR = makeLeg(legMat, 0.03, -0.03, 0.09, 0.09, 0.008);
  }
  g.parts = parts;
  return g;
}

// 種子袋原本用一張畫著蘿蔔/馬鈴薯/番茄圖案的 canvas 貼紙(平面)當「牌子」，
// 平面永遠只有一個面看得到圖案，握持/縮圖/地圖三個情境各自的相機角度不同，
// 需要各自校正貼紙面向，跳來跳去、越校越亂。2026-09-01 Zeppelin 要求改成
// 真正的立體作物模型，直接放棄整張 drawSeedStickerCrop() canvas 繪圖(見
// docs/decisions/crop-models.md)：立體模型從大多數角度都認得出形狀，不需要
// 再為了「哪個面朝哪個相機」反覆調整旋轉角度。
export function makeSeedPouch(
  _labelColor = 0xe9d6a5,
  cropType: "radish" | "potato" | "tomato" = "radish",
) {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0x9c6b3a,
      flatShading: true,
    }),
  );
  bag.scale.set(1, 0.8, 1);
  bag.position.y = 0.14;
  g.add(bag);

  // 跟 farm-visuals.ts 種在農地裡的成熟作物共用同一顆 makeCropMesh()，
  // 縮小放在袋口——單一資料源，之後改造型兩邊會一起變，不用維護兩份。
  const crop = makeCropMesh(2, cropType);
  crop.scale.setScalar(0.55);
  crop.position.y = 0.2;
  g.add(crop);
  return g;
}

export function makeBobber() {
  // 紅白浮標，上半染紅是最快讓人一眼看懂「這是釣魚浮標」的配色，不用任何說明文字
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xd93b3b,
      flatShading: true,
    }),
  );
  top.position.y = 0.03;
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
    }),
  );
  bottom.position.y = -0.02;
  g.add(top, bottom);
  return g;
}

export function makeOysterProp() {
  const group = new THREE.Group();
  group.scale.setScalar(1.35);
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f897d,
    flatShading: true,
    roughness: 0.96,
  });
  const innerShellMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d1bd,
    flatShading: true,
    roughness: 0.82,
  });
  const meatMaterial = new THREE.MeshStandardMaterial({
    color: 0xead9ad,
    flatShading: true,
    roughness: 0.72,
  });

  const lowerShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16, 1),
    shellMaterial,
  );
  lowerShell.scale.set(1, 0.24, 0.72);
  lowerShell.rotation.y = -0.12;
  lowerShell.castShadow = true;

  const innerShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.135, 1),
    innerShellMaterial,
  );
  innerShell.scale.set(1, 0.2, 0.69);
  innerShell.position.y = 0.025;
  innerShell.rotation.y = -0.12;
  innerShell.castShadow = true;

  const meat = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.075, 1),
    meatMaterial,
  );
  meat.scale.set(1.05, 0.34, 0.78);
  meat.position.set(0.018, 0.06, -0.005);
  meat.castShadow = true;

  const mantle = new THREE.Mesh(
    new THREE.TorusGeometry(0.043, 0.012, 5, 10),
    new THREE.MeshStandardMaterial({
      color: 0xc6a76d,
      flatShading: true,
      roughness: 0.78,
    }),
  );
  mantle.rotation.x = Math.PI / 2;
  mantle.position.set(0.018, 0.082, -0.005);
  mantle.castShadow = true;

  group.add(lowerShell, innerShell, meat, mantle);
  return group;
}

// 蜂蜜——小罐子造型，跟 makeOysterProp 一樣是「揹包圖示尺寸」的小
// scale，靠 normalizeItemDisplayModel 統一縮放成揹包格大小，不用自己
// 算精確比例。玻璃罐用半透明材質，裡面一層琥珀色蜂蜜實體，蓋子用
// 木塞的顏色跟蜂箱本身(makeBeehive)的深棕色呼應。
export function makeHoneyProp() {
  const group = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xf6ecc9,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
    flatShading: true,
  });
  const honeyMat = new THREE.MeshStandardMaterial({
    color: 0xd98f1f,
    flatShading: true,
    roughness: 0.35,
  });
  const lidMat = new THREE.MeshStandardMaterial({
    color: 0x6b4326,
    flatShading: true,
    roughness: 0.8,
  });

  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.1, 0.2, 10),
    glassMat,
  );
  jar.position.y = 0.11;
  jar.castShadow = true;

  const honey = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.088, 0.16, 10),
    honeyMat,
  );
  honey.position.y = 0.1;

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.05, 10),
    glassMat,
  );
  neck.position.y = 0.235;

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.045, 10),
    lidMat,
  );
  lid.position.y = 0.28;
  lid.castShadow = true;

  group.add(jar, honey, neck, lid);
  return group;
}

export function makeFishProp(seed) {
  // 純粹的氛圍裝飾：壓扁的橢圓身體 + 三角尾鰭；色盤用 seed 決定，
  // 同一張地圖每次重整仍會得到一致、但彼此不同的魚色。
  const palette = [
    0xd9a441, 0x8fa8c9, 0x5fa8a0, 0xd97c67, 0xb59bd8, 0xd5d1b8, 0x668fc4,
  ];
  const color =
    palette[
      Math.floor(hash2(seed, seed * 3.3) * palette.length) % palette.length
    ];
  const bodyColor = new THREE.Color(color).offsetHSL(
    (hash2(seed, 7.1) - 0.5) * 0.05,
    0.04,
    0,
  );
  const tailColor = bodyColor.clone().offsetHSL(0, 0.03, -0.08);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    flatShading: true,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: tailColor,
    flatShading: true,
  });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), bodyMat);
  body.scale.set(2, 1.1, 0.64); // 魚身整體放大兩倍
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), tailMat);
  // 魚頭朝本地 +X；尾鰭放在 -X，尖端要朝 +X 接住身體、寬面朝後。
  tail.rotation.z = -Math.PI / 2;
  tail.position.x = -0.125; // 跟著加長後的魚身尾端後移
  g.add(body, tail);
  return g;
}

export function startFishRoute(f, now) {
  const horizontal = Math.random() < 0.5;
  const midX = (f.bounds.minX + f.bounds.maxX) / 2;
  const midZ = (f.bounds.minZ + f.bounds.maxZ) / 2;
  const spanX = f.bounds.maxX - f.bounds.minX;
  const spanZ = f.bounds.maxZ - f.bounds.minZ;
  let targetX, targetZ;
  if (horizontal) {
    // 大致游向目前所在位置的另一側，確保是長距離橫向巡游。
    targetX = f.mesh.position.x < midX ? f.bounds.maxX : f.bounds.minX;
    targetZ = midZ + (Math.random() - 0.5) * spanZ * 0.55;
  } else {
    targetX = midX + (Math.random() - 0.5) * spanX * 0.55;
    targetZ = f.mesh.position.z < midZ ? f.bounds.maxZ : f.bounds.minZ;
  }
  f.route = {
    fromX: f.mesh.position.x,
    fromZ: f.mesh.position.z,
    toX: targetX,
    toZ: targetZ,
    horizontal,
    start: now,
    duration: Math.max(
      2.5,
      Math.hypot(targetX - f.mesh.position.x, targetZ - f.mesh.position.z) /
        f.swimSpeed,
    ),
    curve: (Math.random() - 0.5) * f.curveAmount,
  };
}

// 室內家具 — 跟 livingArea 的 buildings 同一套「資料描述佔地範圍」的邏輯，
// type 決定長什麼樣子，buildMap() 只負責讀資料把它擺到對的位置
// 室內牆壁 — 之前房子內部完全沒渲染牆(只有碰撞判定)，牆是「隱形的」。
// 現在依 tiles 裡的 1 實際生成牆體方塊；windowSide 有值的話再疊一片
// emissive 窗戶貼在對應的外側面，material 丟進全域 windowMats，這樣
// 完全不用寫新邏輯，室內窗戶就會自動跟外面房子的窗一樣隨日夜發光
// 桌燈：晚上自動點亮，不用玩家做任何事。燈泡是 emissive 材質(跟窗戶同一招)，
// 另外加一顆真的 PointLight，這樣晚上房間裡不會只有窗戶在發光、地板卻是暗的

export function makeOreNode(x, z, color, accentColor, colorSeed) {
  const group = new THREE.Group();
  group.scale.setScalar(1.3);
  const baseColor = new THREE.Color(color);
  baseColor.offsetHSL((colorSeed - 0.5) * 0.06, 0, (colorSeed - 0.5) * 0.16);
  const rockMat = new THREE.MeshStandardMaterial({
    color: baseColor,
    flatShading: true,
    roughness: 0.85,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    flatShading: true,
    roughness: 0.5,
    metalness: 0.2,
  });
  const darkRockMat = new THREE.MeshStandardMaterial({
    color: 0x38393a,
    flatShading: true,
    roughness: 0.95,
  });
  const rocks = [
    { x: -0.1, z: 0.06, r: 0.17, seed: 0.3, mat: darkRockMat },
    { x: 0.13, z: -0.04, r: 0.15, seed: 0.7, mat: darkRockMat },
    { x: -0.02, z: 0.16, r: 0.12, seed: 1.1, mat: rockMat },
    { x: 0.03, z: -0.02, r: 0.19, seed: 1.6, mat: rockMat },
  ];
  rocks.forEach((r) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r.r, 0), r.mat);
    mesh.position.set(r.x, r.r * 0.72, r.z);
    mesh.rotation.set(r.seed * 5, r.seed * 3, r.seed * 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  const glints = [
    { x: -0.06, y: 0.16, z: 0.09, r: 0.06, seed: colorSeed },
    { x: 0.1, y: 0.13, z: 0.02, r: 0.05, seed: (colorSeed * 1.7) % 1 },
    { x: 0.0, y: 0.19, z: -0.06, r: 0.045, seed: (colorSeed * 2.3) % 1 },
  ];
  glints.forEach((g) => {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(g.r, 0),
      g.seed > 0.5 ? accentMat : rockMat,
    );
    mesh.position.set(g.x, g.y, g.z);
    mesh.rotation.set(g.seed * 4, g.seed * 6, g.seed * 2);
    mesh.castShadow = true;
    group.add(mesh);
  });
  group.position.set(x, 0, z);
  return group;
}

// 挖礦成功飛出去的碎屑，跟 makeChipDebris 同款但顏色吃礦石階層色，
// 不共用同一個函式是因為 makeChipDebris 的 kind 參數目前只認
// "wood"/"stone" 兩種，改成吃任意顏色比硬塞第三種 kind 字串更直接。

export function makeOreChipDebris(color, seed) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.7,
    metalness: 0.15,
  });
  const chip = new THREE.Mesh(new THREE.TetrahedronGeometry(0.06, 0), mat);
  chip.rotation.set(seed * 6, seed * 4, seed * 2);
  chip.castShadow = true;
  return chip;
}

// 洞窟樓梯——v1(疊箱子+扶手+平台)玩家反應看不出方向；v2(踏面/豎板
// 對比+凹陷平面)玩家反應還是像一塊匾額、不像樓梯。這版不再自己
// 發明造型，直接照抄舊城鎮 plazaStairs/westStairs 那套已經驗證能讀
// 出「這是樓梯」的手法(build-map.ts 裡 LAYOUT.oldVillage.plazaStairs
// .forEach 那段)：一階一顆疊高的箱子、底部貼平、高度依階數遞增、
// 頂面用淺色(跟石地板同一組米灰色)、側面用深色，天然靠輪廓讀出
// 階梯，不用扶手/招牌之類額外道具硬湊。這裡只是把「橫跨整片地形
// 的長樓梯」壓成「一格 tile 內」的迷你版。
//
// 上樓：箱體底部貼平所在樓層地板(baseY=0)往上疊，Z 對稱分布在
// 0 兩側，不再像 v1/v2 那樣手動位移——玩家要求「Z對準0即可」。
// 下樓：箱體底部貼平 build-map.ts 額外挖出的 1×1×1 坑洞底部
// (baseY=-1)，離坑口最近的一階最高、貼齊地板(order 跟 up 相反)，
// 越往深處階梯越矮越暗，看起來就是「地板破了個洞、洞裡有階梯往
// 下」，不是貼一張黑色平面騙深度；坑洞本體(洞壁+坑底)是另一個函式
// makeMinePitRecess，由 build-map.ts 一起擺在同一個位置。
