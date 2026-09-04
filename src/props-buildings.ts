// props.ts 拆分：建築/結構類 make* 函式（房屋、碼頭、貨船、神社、礦坑階梯……）。
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
  lighthouseBeamRotors,
  lighthouseBeamMaterials,
  pastureGrassBlades,
  avenueLeafMaterials,
  seasonalTreeLeafMaterials,
  seasonalGroundMaterials,
  mountainSeasonalMaterials,
  GRASS_STAGE_HEIGHTS,
  SOUTH_SEA_WAVE_DIRECTION,


  gangplankMeshes,
  prologueRefs,
} from "./scene-registries";

import { createConnectedTileSeaGeometry } from "./tile-sea-geometry";
import { randomPasturePoint } from "./npc-runtime";

// 木棧板材質——canvas 現畫木紋貼圖，跟 scene-sky.ts/weather-particles.ts
// 同一套「3D 世界不接外部圖片，程式生成貼圖」規則。畫一塊正方形貼圖，
// 靠 texture.repeat 依實際世界尺寸鋪滿，不用每個呼叫端各自重畫一次。
// 目前給山頂觀景台用；之後棧橋/碼頭甲板要類似木板質感也能直接共用。
import { makeFoam, makeSand } from "./props-nature";
import { findSouthernShoreSandZ } from "./shore-foam";

export function makeWoodPlankTexture({
  plankColor = 0xa9825a,
  seamColor = 0x5a3d24,
  plankCount = 6,
  seed = 0,
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `#${new THREE.Color(plankColor).getHexString()}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const plankHeight = canvas.height / plankCount;
  // 每片板子單獨加一點明暗差異，不然整塊貼圖看起來還是一片死板的單色。
  for (let i = 0; i < plankCount; i++) {
    const shade = (hash2(seed + i * 3.1, i * 1.7) - 0.5) * 0.28;
    ctx.fillStyle =
      shade < 0 ? `rgba(0,0,0,${-shade})` : `rgba(255,255,255,${shade})`;
    ctx.fillRect(0, i * plankHeight, canvas.width, plankHeight);
  }
  // 縱向細木紋，弱化貼圖被拉伸鋪滿時的重複感。
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 48; i++) {
    const x = hash2(seed + i * 7.3, 2.1) * canvas.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  // 板縫——這才是「明顯木板材質」的關鍵，沒有這條線只會看起來是一片
  // 普通木頭色地板，不會被讀成一片一片的甲板。
  ctx.strokeStyle = `#${new THREE.Color(seamColor).getHexString()}`;
  ctx.lineWidth = 4;
  for (let i = 0; i <= plankCount; i++) {
    const y = i * plankHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// 7) 樹 / 建築 / 地形（沿用 v11）
// ==============================================================

export function makeBuilding({
  x,
  z,
  w,
  d,
  doorX,
  wallColor = 0xe8ddc7,
  roofColor = 0xa8402f,
  skipWindowGlow = false,
  visualScale = 1,
  doorWorldHeight = null,
}) {
  const group = new THREE.Group();
  const centerX = x + (w - 1) / 2,
    centerZ = z + (d - 1) / 2;
  const width = w * TILE,
    depth = d * TILE;
  const wallHeight = 1.3,
    roofHeight = 0.85;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.96, wallHeight, depth * 0.96),
    new THREE.MeshStandardMaterial({ color: wallColor }),
  );
  wall.position.y = wallHeight / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  // 屋頂：45° 旋轉「烤進」geometry 本身，而不是設在 mesh.rotation 上。
  // 原本的寫法是「先縮放、再旋轉」，非等比縮放遇上旋轉會產生剪切(shear)，
  // 把方形屋頂拉成菱形，跟牆體對不齊。geometry.rotateY() 直接改頂點資料，
  // 之後 mesh 上只剩縮放、沒有旋轉，縮放才會沿著 X/Z 軸乖乖拉伸。
  const roofGeo = new THREE.ConeGeometry(1, roofHeight, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({
      color: roofColor,
      flatShading: true,
    }),
  );
  roof.scale.set(width * 0.72, 1, depth * 0.72);
  roof.position.y = wallHeight + roofHeight / 2;
  roof.castShadow = true;
  group.add(roof);
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a5a4a }),
  );
  chimney.position.set(width * 0.28, wallHeight + 0.35, -depth * 0.22);
  chimney.castShadow = true;
  group.add(chimney);
  const doorHeight = doorWorldHeight ? doorWorldHeight / visualScale : 0.55;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, doorHeight, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x4a2f1f }),
  );
  door.position.set(doorX - centerX, doorHeight / 2, (depth / 2) * 0.98);
  group.add(door);
  // skipWindowGlow：某些空屋(例如木匠事件用的那間)有自己一套跟劇情
  // stage 綁定的發光邏輯，窗戶不該一蓋好就自動加入全域 windowMats、
  // 每晚自動亮——那樣會蓋掉「還沒有人住」這件事本身的意義。
  function makeWindow(px, pz, rotY) {
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a55,
      emissive: new THREE.Color(0xffcf7a),
      emissiveIntensity: 0,
    });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.05), winMat);
    win.position.set(px, 0.7, pz);
    win.rotation.y = rotY;
    group.add(win);
    if (!skipWindowGlow) windowMats.push(winMat);
  }
  makeWindow(doorX - centerX - width * 0.32, (depth / 2) * 0.98, 0);
  makeWindow(doorX - centerX + width * 0.32, (depth / 2) * 0.98, 0);
  makeWindow((-width / 2) * 0.98, 0, Math.PI / 2);
  group.position.set(centerX, 0, centerZ);
  group.scale.setScalar(visualScale);
  return group;
}

// 穀倉 — 跟 makeBuilding 同一套「佔地範圍→算中心→算屋頂」邏輯，只是外觀
// 換成穀倉常見的紅牆、深色屋頂、雙開木門、閣樓圓窗，跟主屋一眼就能分辨

export function makeBarn({
  x,
  z,
  w,
  d,
  doorX,
  wallColor = 0x9c4a3a,
  roofColor = 0x4a3428,
  visualScale = 1,
  doorWorldHeight = null,
}) {
  const group = new THREE.Group();
  const centerX = x + (w - 1) / 2,
    centerZ = z + (d - 1) / 2;
  const width = w * TILE,
    depth = d * TILE;
  const wallHeight = 1.15,
    roofHeight = 0.7;
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.96, wallHeight, depth * 0.96),
    new THREE.MeshStandardMaterial({ color: wallColor }),
  );
  wall.position.y = wallHeight / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const roofGeo = new THREE.ConeGeometry(1, roofHeight, 4);
  roofGeo.rotateY(Math.PI / 4); // 同樣先把旋轉烤進 geometry，避免非等比縮放產生剪切
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({
      color: roofColor,
      flatShading: true,
    }),
  );
  roof.scale.set(width * 0.72, 1, depth * 0.72);
  roof.position.y = wallHeight + roofHeight / 2;
  roof.castShadow = true;
  group.add(roof);
  // 雙開穀倉門，比一般房子的門寬很多，中間留一條縫
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2f2018 });
  const doorHeight = doorWorldHeight ? doorWorldHeight / visualScale : 0.62;
  const doorL = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, doorHeight, 0.06),
    doorMat,
  );
  doorL.position.set(
    doorX - centerX - 0.13,
    doorHeight / 2,
    (depth / 2) * 0.98,
  );
  const doorR = doorL.clone();
  doorR.position.x = doorX - centerX + 0.13;
  group.add(doorL, doorR);
  // 閣樓圓窗——穀倉的招牌特徵，跟主屋的方窗做出區別
  const loft = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0x241a14 }),
  );
  loft.position.set(doorX - centerX, wallHeight - 0.12, (depth / 2) * 0.981);
  group.add(loft);
  group.position.set(centerX, 0, centerZ);
  group.scale.setScalar(visualScale);
  return group;
}

// 以下幾個是城鎮建築的門口/屋頂裝飾，跟 makeBench/makeStreetLamp 同一套
// 慣例——各自吃 (x,z,...) 直接定位，呼叫端(build-map.ts 的
// oldVillage 區塊)只需要再疊上 oldVillageGroundY() 的高度差。每個都
// 對應 LAYOUT.oldVillage.houses 裡一個 role，讓城鎮的每棟房子從外觀
// 就看得出用途，不用進去才知道是誰住的。

// 旗桿——一支木桿+一面小三角旗，學校前庭用。

export function makeDock() {
  const group = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45 });
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.06, 0.9),
      plankMat,
    );
    plank.position.set(i * 0.95, 0.05, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  const boat = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.22, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x9c5a3a }),
  );
  boat.position.set(3.2, 0.02, 0.65);
  boat.rotation.y = 0.3;
  boat.castShadow = true;
  group.add(boat);
  return group;
}

// 城鎮港口的商船——刻意比木匠抵達那艘小船大上一圈、外形也更「商用」：
// 斜切艏尖＋艏斜桅、加高船艏、煙囪、舷緣扶手、舷窗、甲板堆貨箱、船艙
// 旁一支吊臂、船尾旗桿，這些細節組合起來最快讓人看懂「這是載貨進出
// 的商船」而不是一塊長方形箱子。純視覺裝飾，停在木棧板延伸出去的
// 海面上，不佔用任何 tiles 格子，不影響碰撞判定。
// 序幕開場主角乘船而來的那艘船，跟 makePortScene() 裡靠港的補給渡輪
// 是同一個模型——依 Zeppelin 的要求整艘重畫成「離島登陸艇」造型，
// 不再是尖船首的傳統商船：船頭又寬又平，中央整片跳板直接朝碼頭放
// 下，牛羊從船頭直進直出，不用在甲板上轉彎；駕駛艙移到船尾，中段
// 是固定的大型動物欄位，船尾保留乘客座椅、雞籠跟貨物。
//
// 本地座標系維持沿用舊版商船的慣例：+X 一路都是「靠碼頭那一端」
// (原本是船尾側，現在整艘船頭尾互換，靠碼頭這端改放船頭跳板)，
// 所以 makePortScene() 那邊算跳板落地座標的公式完全不用改，換的
// 只有「這一端現在長什麼樣子」。局部 Y=0.5 固定是甲板高度(沿用
// 舊版 hull.position.y=0.25 + 高度 0.5 的組合)，makePortScene()
// 用 `0.5 * ferry.scale.y` 硬算跳板落點也是靠這個不變量，這裡沒
// 改動甲板高度，所以那段公式一樣有效。

export function makeCargoShip() {
  const group = new THREE.Group();
  const mat = (color) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true });
  const creamMat = mat(0xe6dcc0),
    deckMat = mat(0xa9895c);
  const tealMat = mat(0x5f8a7e),
    tealDarkMat = mat(0x466b62);
  const waterlineMat = mat(0x6b2a22);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xaed4dc,
    flatShading: true,
    emissive: 0x1c2f33,
    emissiveIntensity: 0.25,
  });
  const woodMat = mat(0x8a6a45),
    crateMat = mat(0x9c6b3a);
  const metalMat = mat(0x5d6260),
    tireMat = mat(0x1c1c1c);
  const ringWhiteMat = mat(0xe8e2d4),
    ringRedMat = mat(0xa8362a);
  const roofRedMat = mat(0x8a3f2e);

  // 船體——單一 BoxGeometry 但用材質陣列給頂面單獨換成木甲板色，
  // 不用另外疊一層甲板 mesh。材質陣列順序是 [+x,-x,+y,-y,+z,-z]。
  const hullLength = 3.6,
    hullBeam = 1.5,
    hullHeight = 0.5;
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength, hullHeight, hullBeam),
    [creamMat, creamMat, deckMat, creamMat, creamMat, creamMat],
  );
  hull.position.y = hullHeight / 2;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  // 吃水線深紅色寬帶——沿船身底部一整圈，尺寸故意比 hull 略大一點
  // 避免共平面閃爍(z-fighting)。
  const waterline = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength + 0.02, 0.16, hullBeam + 0.02),
    waterlineMat,
  );
  waterline.position.y = 0.08;
  group.add(waterline);
  // 舷緣上緣的墨綠鑲邊——薄薄一條卡在甲板邊界，呼應船身其餘鐵灰
  // 鑲邊的配色語言。
  const gunwaleCap = new THREE.Mesh(
    new THREE.BoxGeometry(hullLength + 0.02, 0.06, hullBeam + 0.02),
    tealMat,
  );
  gunwaleCap.position.y = hullHeight - 0.03;
  group.add(gunwaleCap);

  // ------------------------------------------------------------
  // 船頭(local -X，靠碼頭那端)：寬平船頭牆本身就是 hull 的端面，
  // 不用另外做尖船首。船頭轉角本身的護欄柱併進下面那組「兩側連續
  // 護欄」一起產生(見該段落)，這裡不用再重複放一組。跳板本身由
  // makePortScene() 用 makeGangplank() 另外接上去，不含在這個
  // 函式裡；跳板放下時整個船頭前緣依然是開放的，護欄只包住左右
  // 兩側，不會擋到牛羊直進。
  // ------------------------------------------------------------
  // 錨＋錨鏈——掛在船頭一側，垂到接近吃水線，補上「這是一艘真的
  // 出過海的船」的細節。
  const anchorX = -1.75,
    anchorZ = 0.62;
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.01, 4, 8),
      metalMat,
    );
    link.position.set(anchorX, hullHeight - 0.02 - i * 0.075, anchorZ);
    link.rotation.set(Math.PI / 2, i % 2 === 0 ? 0 : Math.PI / 2, 0);
    group.add(link);
  }
  const anchorShank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6),
    metalMat,
  );
  anchorShank.position.set(anchorX, hullHeight - 0.44, anchorZ);
  group.add(anchorShank);
  const anchorStock = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.02, 0.02),
    metalMat,
  );
  anchorStock.position.set(anchorX, hullHeight - 0.35, anchorZ);
  group.add(anchorStock);
  [-1, 1].forEach((side) => {
    const fluke = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.13, 4),
      metalMat,
    );
    fluke.position.set(anchorX + side * 0.06, hullHeight - 0.56, anchorZ);
    fluke.rotation.z = side * 0.9;
    group.add(fluke);
  });

  // ------------------------------------------------------------
  // 中段：固定的大型動物欄位——三面圍欄(左/右/後)，前方(靠船頭
  // 這側)刻意不設欄杆，讓牛羊從跳板直接走進來，不用在甲板上轉彎。
  // ------------------------------------------------------------
  const penFrontX = -1.1,
    penBackX = 0.0,
    penHalfZ = 0.5;
  [penFrontX, penBackX].forEach((x) => {
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.32, 6),
        woodMat,
      );
      post.position.set(x, hullHeight + 0.16, side * penHalfZ);
      post.castShadow = true;
      group.add(post);
    });
  });
  [-1, 1].forEach((side) => {
    [0.06, 0.24].forEach((railY) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(penBackX - penFrontX, 0.03, 0.03),
        woodMat,
      );
      rail.position.set(
        (penFrontX + penBackX) / 2,
        hullHeight + railY,
        side * penHalfZ,
      );
      group.add(rail);
    });
  });
  [0.06, 0.24].forEach((railY) => {
    const backRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, penHalfZ * 2),
      woodMat,
    );
    backRail.position.set(penBackX, hullHeight + railY, 0);
    group.add(backRail);
  });
  // 欄位裡的小飼料槽，暗示這格是專門固定給大型動物用的。
  const trough = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.1, 0.28),
    woodMat,
  );
  trough.position.set(-0.15, hullHeight + 0.05, 0);
  group.add(trough);

  // ------------------------------------------------------------
  // 中後段：遮陽棚長椅區——乘客座位，鏽紅色斜頂棚。
  // ------------------------------------------------------------
  const benchPosts = [
    [0.18, -0.55],
    [0.18, 0.55],
    [0.7, -0.55],
    [0.7, 0.55],
  ];
  benchPosts.forEach(([x, z]) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6),
      tealMat,
    );
    post.position.set(x, hullHeight + 0.25, z);
    post.castShadow = true;
    group.add(post);
  });
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.05, 1.2),
    roofRedMat,
  );
  canopy.position.set(0.44, hullHeight + 0.53, 0);
  canopy.rotation.x = 0.06;
  canopy.castShadow = true;
  group.add(canopy);
  const benchSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.06, 0.28),
    woodMat,
  );
  benchSeat.position.set(0.44, hullHeight + 0.14, -0.35);
  group.add(benchSeat);
  const benchBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 0.05),
    woodMat,
  );
  benchBack.position.set(0.44, hullHeight + 0.26, -0.5);
  group.add(benchBack);

  // ------------------------------------------------------------
  // 船尾：駕駛艙(帶窗)、雞籠、貨箱——原本商船的煙囪/吊臂拿掉，
  // 整組換成「船尾駕駛室」的配置。
  // ------------------------------------------------------------
  const cabinFrontX = 0.85,
    cabinBackX = 1.65,
    cabinHalfZ = 0.65;
  const cabinWall = new THREE.Mesh(
    new THREE.BoxGeometry(cabinBackX - cabinFrontX, 0.55, cabinHalfZ * 2),
    creamMat,
  );
  cabinWall.position.set((cabinFrontX + cabinBackX) / 2, hullHeight + 0.275, 0);
  cabinWall.castShadow = true;
  group.add(cabinWall);
  // 朝船頭方向的三片窗——駕駛時視線望向跳板/牛羊欄位那一側。
  for (let i = 0; i < 3; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18), windowMat);
    win.position.set(cabinFrontX - 0.001, hullHeight + 0.34, -0.4 + i * 0.4);
    win.rotation.y = -Math.PI / 2;
    group.add(win);
  }
  const cabinRoof = new THREE.Mesh(
    new THREE.BoxGeometry(
      cabinBackX - cabinFrontX + 0.1,
      0.06,
      cabinHalfZ * 2 + 0.1,
    ),
    tealMat,
  );
  cabinRoof.position.set((cabinFrontX + cabinBackX) / 2, hullHeight + 0.58, 0);
  cabinRoof.castShadow = true;
  group.add(cabinRoof);
  // 屋頂管線＋小圓燈，補一點「這是駕駛室」的機械感剪影。
  [-0.15, 0.15].forEach((z) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6),
      tealDarkMat,
    );
    pipe.position.set(cabinBackX - 0.12, hullHeight + 0.72, z);
    pipe.castShadow = true;
    group.add(pipe);
  });
  const roofLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    mat(0xd8d4c8),
  );
  roofLamp.position.set(cabinFrontX + 0.12, hullHeight + 0.64, 0);
  group.add(roofLamp);
  // 短天線桅杆，頂端一顆小紅燈——船尾最高點的剪影收尾。
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.4, 6),
    woodMat,
  );
  mast.position.set(cabinBackX - 0.15, hullHeight + 0.79, 0);
  mast.castShadow = true;
  group.add(mast);
  const antenna = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.012, 0.012),
    metalMat,
  );
  antenna.position.set(cabinBackX - 0.15, hullHeight + 0.95, 0);
  group.add(antenna);
  const mastLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 6, 4),
    ringRedMat,
  );
  mastLight.position.set(cabinBackX - 0.15, hullHeight + 1.0, 0);
  group.add(mastLight);

  // 救生圈——掛在駕駛室側牆，白底紅十字條紋，低多邊形版本用一個
  // 白色 Torus 疊兩條紅色細長方塊十字交叉代替寫實的救生圈紋樣。
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.02, 6, 12),
    ringWhiteMat,
  );
  ring.position.set(1.15, hullHeight + 0.35, cabinHalfZ + 0.02);
  group.add(ring);
  [0, Math.PI / 2].forEach((rot) => {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.24, 0.015),
      ringRedMat,
    );
    stripe.position.set(1.15, hullHeight + 0.35, cabinHalfZ + 0.025);
    stripe.rotation.z = rot;
    group.add(stripe);
  });

  // 雞籠——簡化成木框+線框感的骨架箱，裡面兩顆白色橢球代表雞。
  const cageX = 1.75,
    cageZ = -0.42;
  const cageFrameMat = woodMat;
  [
    [-0.1, -0.1],
    [0.1, -0.1],
    [-0.1, 0.1],
    [0.1, 0.1],
  ].forEach(([dx, dz]) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5),
      cageFrameMat,
    );
    post.position.set(cageX + dx, hullHeight + 0.11, cageZ + dz);
    group.add(post);
  });
  [0, 0.22].forEach((y) => {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.015, 0.24),
      cageFrameMat,
    );
    frame.position.set(cageX, hullHeight + y, cageZ);
    group.add(frame);
  });
  [
    [-0.04, -0.03],
    [0.05, 0.04],
  ].forEach(([dx, dz]) => {
    const chicken = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 7, 5),
      mat(0xf0ead8),
    );
    chicken.scale.set(1, 0.85, 1.15);
    chicken.position.set(cageX + dx, hullHeight + 0.08, cageZ + dz);
    group.add(chicken);
  });

  // 貨箱——堆在船尾另一側，尺寸/角度沿用舊版做法錯開避免複製貼上感。
  [
    [1.75, 0.35],
    [1.62, 0.5],
  ].forEach(([cx, cz], i) => {
    const size = 0.26 + hash2(i, cx) * 0.08;
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      crateMat,
    );
    crate.position.set(cx, hullHeight + size / 2, cz);
    crate.rotation.y = i * 0.6 + hash2(cx, cz);
    crate.castShadow = true;
    group.add(crate);
  });

  // ------------------------------------------------------------
  // 兩側輪胎緩衝——登陸艇/交通船很典型的靠泊緩衝物，掛在船身兩側
  // 吃水線附近。
  // ------------------------------------------------------------
  const tireXs = [-1.3, -0.5, 0.4, 1.3];
  tireXs.forEach((x) => {
    [-1, 1].forEach((side) => {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.05, 6, 10),
        tireMat,
      );
      tire.position.set(x, hullHeight * 0.55, side * (hullBeam / 2 + 0.03));
      tire.castShadow = true;
      group.add(tire);
    });
  });

  // ------------------------------------------------------------
  // 兩側連續護欄——2026-08-26 Zeppelin 反饋加的，同一天再回報一次
  // 「上下欄杆延長到船頭」：起點從欄位前緣(penFrontX)再往前推到
  // railFrontX(貼著船頭轉角，取代原本單獨那兩根轉角柱)，一路接到
  // 駕駛室牆面(cabinFrontX)，跟欄位自己那圈矮圍欄疊在一起(欄位
  // 圍欄矮、這條護欄高，內外兩層都看得到)。船頭最前緣(跳板開口
  // 本身)沒有欄杆——護欄只沿著左右兩側走，不會擋到牛羊直進。上下
  // 兩條橫桿(0.15/0.32)加柱子，船身左右兩側對稱各一組。
  // ------------------------------------------------------------
  const railFrontX = -1.75;
  [-1, 1].forEach((side) => {
    [0.15, 0.32].forEach((railY) => {
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, cabinFrontX - railFrontX, 6),
        tealMat,
      );
      rail.rotation.z = Math.PI / 2;
      rail.position.set(
        (railFrontX + cabinFrontX) / 2,
        hullHeight + railY,
        side * (hullBeam / 2 - 0.02),
      );
      rail.castShadow = true;
      group.add(rail);
    });
    const postCount = 9;
    for (let i = 0; i <= postCount; i++) {
      const t = railFrontX + (i / postCount) * (cabinFrontX - railFrontX);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5),
        tealMat,
      );
      post.position.set(t, hullHeight + 0.17, side * (hullBeam / 2 - 0.02));
      post.castShadow = true;
      group.add(post);
    }
  });
  return group;
}

// 跳板——連接碼頭跟船，靠港時放下、啟航/行駛中收起。本地 +X 為由
// 碼頭朝船的方向，長度由呼叫端算好傳入(見 makePortScene)；呼叫端
// 另外決定實際擺放位置與坡度，這裡只管「一段木板棧橋」本身的造型。
// `width` 預設沿用舊版小艇跳板的寬度，登陸艇改款後 makePortScene()
// 改傳整艘船船頭寬度的比例，讓牛羊能整片走上跳板，不用另外開一支
// 新函式。

export function makeGangplank(length, width = 0.62) {
  const group = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({
    color: 0x8a6a45,
    roughness: 0.92,
  });
  const plankCount = Math.max(3, Math.round(length / 0.5));
  const plankLength = length / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankLength + 0.02, 0.06, width),
      plankMat,
    );
    plank.position.set((i + 0.5) * plankLength, 0.03, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  // 兩側扶手：一條橫向欄杆＋等距欄杆柱，只用簡單圓柱堆出來，跟其他
  // 道具(如 makeBench 的椅腳)同一套低多邊形風格。
  // 2026-08-26 Zeppelin 反饋「跳板方向還是反了」，第一次試法是把扶手
  // 整組永久改裝到板子反面(local y 全部乘 -1)。結果證實那樣改是錯的
  // 方向：序幕「立起貼船頭」跟平常「放下停靠」這兩個狀態的
  // rotation.z 本來就不一樣(RAMP_RAISED_ROTATION_Z vs
  // gangplankRestRotationZ)，同一個固定局部位移在兩種轉角下會對應到
  // 不同的世界方向，永久改一邊等於必定弄壞另一邊(這裡改完的確立起時
  // 對了，但放下停靠——本來就沒壞過的狀態——反而變錯，證實了這點)。
  // 改法：扶手/欄杆柱位置照原樣蓋在板子上方(local y=+0.34/+0.17，
  // 板面本身是 y=0.03)，但額外存一份 gangplankRailBaseY 到
  // userData，讓 prologue.ts 可以在「立起貼船頭」那幾個階段動態把這些
  // 特定子物件搬到反面、放下停靠時再搬回來(見 prologue.ts 的
  // setGangplankRailFlip())，兩種狀態各自要哪面就給哪面，不用整組
  // 永久二選一。
  const railMat = new THREE.MeshStandardMaterial({ color: 0x5a4632 });
  [-width / 2, width / 2].forEach((zOffset) => {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, length, 6),
      railMat,
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(length / 2, 0.34, zOffset);
    rail.userData.gangplankRailBaseY = 0.34;
    rail.castShadow = true;
    group.add(rail);
    const postCount = Math.max(2, Math.round(length));
    for (let i = 0; i <= postCount; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5),
        railMat,
      );
      post.position.set((i / postCount) * length, 0.17, zOffset);
      post.userData.gangplankRailBaseY = 0.17;
      post.castShadow = true;
      group.add(post);
    }
  });
  return group;
}

// 參考港灣圖的完整港區組件：石造內港、北側商店、中央渡輪與東側小艇棧橋。
// 沙灘不在這裡重做，仍由 port tiles 的 8 走共用 makeSand() 管線。

// 港口防波堤末端的小型燈塔。原點位於海平面，岩石與圓形基座先把塔身托出
// 水面；西側(本地 -X)留一扇門朝向 x=21 的既有可走防波堤。
function makePortLighthouse(area: { x: number; z: number; scale?: number }) {
  const lighthouse = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x777b78,
    roughness: 1,
    flatShading: true,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xe8e3d4,
    roughness: 0.88,
    flatShading: true,
  });
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xa83b2d,
    roughness: 0.84,
    flatShading: true,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x4f5554,
    roughness: 0.76,
    metalness: 0.22,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x49372d,
    roughness: 0.94,
  });

  [
    [-0.5, 0.05, 0.25, 0.38],
    [0.46, 0.03, 0.18, 0.34],
    [0.16, 0.02, -0.48, 0.31],
    [-0.2, 0.01, -0.42, 0.28],
  ].forEach(([x, y, z, scale], index) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), stoneMat);
    rock.position.set(x, y, z);
    rock.rotation.set(index * 0.31, index * 0.73, index * 0.17);
    rock.scale.y = 0.72;
    rock.castShadow = true;
    lighthouse.add(rock);
  });

  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.76, 0.28, 12),
    stoneMat,
  );
  foundation.position.y = 0.25;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  lighthouse.add(foundation);

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.5, 1.62, 12),
    whiteMat,
  );
  tower.position.y = 1.17;
  tower.castShadow = true;
  tower.receiveShadow = true;
  lighthouse.add(tower);

  [0.45, 1.88].forEach((y, index) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(index ? 0.39 : 0.51, index ? 0.39 : 0.51, 0.1, 12),
      redMat,
    );
    band.position.y = y;
    lighthouse.add(band);
  });

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.27), darkMat);
  door.position.set(-0.47, 0.76, 0);
  lighthouse.add(door);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: new THREE.Color(0xffb347),
    emissiveIntensity: 0,
  });
  const windowMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.2, 0.18),
    windowMat,
  );
  windowMesh.position.set(-0.37, 1.43, 0);
  lighthouse.add(windowMesh);
  windowMats.push(windowMat);

  const gallery = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.54, 0.12, 16),
    stoneMat,
  );
  gallery.position.y = 2.02;
  gallery.castShadow = true;
  lighthouse.add(gallery);

  const railRadius = 0.48;
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.34, 5),
      metalMat,
    );
    post.position.set(
      Math.cos(angle) * railRadius,
      2.22,
      Math.sin(angle) * railRadius,
    );
    lighthouse.add(post);
  }
  [2.12, 2.35].forEach((y) => {
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(railRadius, 0.018, 5, 20),
      metalMat,
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y;
    lighthouse.add(rail);
  });

  const lanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.48, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffd98a,
      emissive: new THREE.Color(0xffbd55),
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.68,
    }),
  );
  lanternGlass.position.y = 2.34;
  lighthouse.add(lanternGlass);
  windowMats.push(lanternGlass.material as THREE.MeshStandardMaterial);

  const lanternLight = new THREE.PointLight(0xffc266, 0, 8, 1.7);
  lanternLight.position.y = 2.36;
  lighthouse.add(lanternLight);
  outdoorLampLights.push(lanternLight);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.52, 10), redMat);
  roof.position.y = 2.83;
  roof.castShadow = true;
  lighthouse.add(roof);
  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6),
    metalMat,
  );
  finial.position.y = 3.16;
  lighthouse.add(finial);

  // 半透明錐體只在夜間顯示；整個群組繞 Y 軸緩慢旋轉，成為港口導航光束。
  const beamRotor = new THREE.Group();
  beamRotor.position.y = 2.36;
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe0a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 7, 16, 1, true),
    beamMat,
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 3.5;
  beamRotor.add(beam);
  lighthouse.add(beamRotor);
  lighthouseBeamRotors.push(beamRotor);
  lighthouseBeamMaterials.push(beamMat);

  lighthouse.position.set(area.x, 0, area.z);
  lighthouse.scale.setScalar(area.scale ?? 1);
  return lighthouse;
}
export function makePortScene() {
  const group = new THREE.Group();
  const port = LAYOUT.port;
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0xa39b8c,
    roughness: 0.96,
  });
  const stairMats = [0x786858, 0x695a4c, 0x594b40].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.98 }),
  );
  const southStairMats = [0xd8c89f, 0xa99470].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.98 }),
  );
  const waterMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    // 港區船塢是淺水，比北邊主海域(0.88)透明得多，星空才透得出來。
    opacity: 0.6,
  });
  const waterDepthMat = new THREE.MeshStandardMaterial({
    color: 0x245f7f,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    // 不寫深度：這片是貼在水面正下方的不透明底色，寫深度的話會擋住
    // 掛在相機底下、固定在很遠處的星空/銀河，上面水面調透明也沒用。
    depthWrite: false,
  });
  waterSurfaceMaterials.push(waterMat);
  waterSkyUnderlayMaterials.push(waterDepthMat);
  const waterCellKeys = new Set<string>();
  const addWater = (x, z, width, depth) => {
    for (let waterZ = z; waterZ < z + depth; waterZ++) {
      for (let waterX = x; waterX < x + width; waterX++) {
        waterCellKeys.add(`${waterX},${waterZ}`);
      }
    }
  };
  const buildConnectedWater = () => {
    const cells = [...waterCellKeys].map((key) => {
      const [x, z] = key.split(",").map(Number);
      return { x, z };
    });
    const geometry = createConnectedTileSeaGeometry(
      cells,
    );
    const depthMask = new THREE.Mesh(geometry.clone(), waterDepthMat);
    depthMask.position.y = 0.025;
    depthMask.receiveShadow = true;
    group.add(depthMask);
    const water = new THREE.Mesh(geometry, waterMat);
    water.position.y = 0.09;
    water.receiveShadow = true;
    group.add(water);
  };
  addWater(port.basin.x, port.basin.z, port.basin.width, port.basin.height);
  const oceanViewEdge = port.width + port.oceanViewPadding;
  addWater(14, 0, oceanViewEdge - 14, port.beachDepth + 1);
  // 船塢東側到外海原本切成三塊各自獨立的矩形(船塢旁水域/外海/外擴
  // 銜接帶)，邊界彼此不完全對齊，畫面上會看到一條「近海」跟「外海」
  // 的明顯分隔線。改成單一矩形，從船塢邊緣直接鋪到外海視覺延伸的
  // 盡頭，跟外海用同一塊水面、同一組頂點，不會再有中間那道縫。
  addWater(
    port.smallBoatDock.x,
    port.beachDepth + 1,
    oceanViewEdge - port.smallBoatDock.x,
    port.height - port.beachDepth - 1,
  );
  // 南側水面逐欄從實際岸線後開始，讓沙灘凹凸不會被矩形水面蓋住。
  for (
    let x = port.southBeach.x;
    x < port.southBeach.x + port.southBeach.width;
    x++
  ) {
    const waterStartZ = portSouthBeachEndZ(x) + 1;
    addWater(x, waterStartZ, 1, port.height - waterStartZ);
  }
  addWater(0, port.height, oceanViewEdge, port.oceanViewPadding);
  buildConnectedWater();

  // 港口原有拍岸泡沫：西側直岸與南側不規則沙灘各自沿岸排列。
  for (let z = 0; z <= port.beachDepth; z += 2) {
    const foam = makeFoam(13.65, z, 700 + z * 1.37);
    foamMeshes.push(foam);
    group.add(foam);
  }
  for (
    let x = port.southBeach.x + 1;
    x < port.southBeach.x + port.southBeach.width;
    x += 2
  ) {
    const shoreZ = findSouthernShoreSandZ(
      MAPS.port.tiles,
      x,
      port.southBeach.z,
      port.southBeach.z + port.southBeach.depth - 1,
    );
    if (shoreZ === null) continue;
    const foam = makeFoam(x, shoreZ + 0.65, 900 + x * 1.37, {
      waveDirection: SOUTH_SEA_WAVE_DIRECTION,
      rotationY: Math.PI / 2,
    });
    foamMeshes.push(foam);
    group.add(foam);
  }

  const addPlatform = (x, z, width, depth) => {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(width, port.elevation, depth),
      concreteMat,
    );
    slab.position.set(
      x + (width - 1) / 2,
      port.elevation / 2 - 0.01,
      z + (depth - 1) / 2,
    );
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
  };
  // z=0 的生活區入口（x=3 起）維持沙灘高度；只有左側 x=0~2
  // 延續抬高的港面，避免入口門檻被平台墊高。
  addPlatform(0, 0, 3, 1);
  addPlatform(0, 1, 3, 7);
  addPlatform(0, 8, 3, 1);
  addPlatform(0, 9, 3, 1);
  addPlatform(0, 10, 3, 1);
  addPlatform(
    0,
    port.beachDepth + 1,
    port.eastOceanCutout.x,
    port.basin.z - port.beachDepth - 2,
  );
  addPlatform(0, port.basin.z - 1, port.smallBoatDock.x, 1);
  addPlatform(0, port.basin.z, port.basin.x, port.basin.height);
  addPlatform(0, port.southQuay.z, port.smallBoatDock.x, port.southQuay.height);
  for (let i = 0; i < port.stairs.depth; i++) {
    const stepHeight = (port.elevation * (i + 1)) / port.stairs.depth;
    const extendsLeft = true;
    const stepX = port.stairs.x - (extendsLeft ? 1 : 0);
    const stepWidth = port.stairs.width + (extendsLeft ? 1 : 0);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepWidth, stepHeight, 1),
      stairMats[i],
    );
    step.position.set(
      stepX + (stepWidth - 1) / 2,
      stepHeight / 2,
      port.stairs.z + i,
    );
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // 南碼頭通往新沙灘的雙色階梯；高度與 portGroundY() 共用同一份
  // LAYOUT 資料，讓角色腳底、視覺台階與碰撞坡度保持一致。
  for (let i = 0; i < port.southBeachStairs.depth; i++) {
    const stepHeight =
      (port.elevation * (port.southBeachStairs.depth - i)) /
      port.southBeachStairs.depth;
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(port.southBeachStairs.width, stepHeight, 1),
      i === 0 ? concreteMat : southStairMats[(i - 1) % southStairMats.length],
    );
    step.position.set(
      port.southBeachStairs.x + (port.southBeachStairs.width - 1) / 2,
      stepHeight / 2,
      port.southBeachStairs.z + i,
    );
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // 三面碼頭牆把水面讀成內凹船塢；高度略高於水面，避免共平面閃爍。
  // 北西角高台的 L 形扶手。放在格子外緣，保留傳送格與走道空間。
  const safetyRailMat = new THREE.MeshStandardMaterial({
    color: 0x4f5554,
    roughness: 0.82,
    metalness: 0.18,
  });
  const addSafetyRail = (x1: number, z1: number, x2: number, z2: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.abs(dx) > 0 ? length : 0.1,
        0.1,
        Math.abs(dz) > 0 ? length : 0.1,
      ),
      safetyRailMat,
    );
    rail.position.set((x1 + x2) / 2, port.elevation + 0.72, (z1 + z2) / 2);
    rail.castShadow = true;
    group.add(rail);

    const postCount = Math.max(1, Math.ceil(length / 2));
    for (let i = 0; i <= postCount; i++) {
      const t = i / postCount;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.82, 0.11),
        safetyRailMat,
      );
      post.position.set(
        THREE.MathUtils.lerp(x1, x2, t),
        port.elevation + 0.4,
        THREE.MathUtils.lerp(z1, z2, t),
      );
      post.castShadow = true;
      group.add(post);
    }
  };
  addSafetyRail(2.5, -0.5, 2.5, 10.5);
  addSafetyRail(-0.5, -0.5, 2.5, -0.5);

  const addSouthStairRail = (x: number) => {
    const stairs = port.southBeachStairs;
    const railHeight = 0.78;
    for (let i = 0; i <= stairs.depth; i++) {
      const groundHeight = (port.elevation * (stairs.depth - i)) / stairs.depth;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, railHeight, 0.11),
        safetyRailMat,
      );
      post.position.set(x, groundHeight + railHeight / 2, stairs.z + i);
      post.castShadow = true;
      group.add(post);
    }

    const dz = stairs.depth;
    const dy = -port.elevation;
    const railLength = Math.hypot(dz, dy);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, railLength),
      safetyRailMat,
    );
    rail.rotation.x = -Math.atan2(dy, dz);
    rail.position.set(
      x,
      port.elevation / 2 + railHeight,
      stairs.z + stairs.depth / 2,
    );
    rail.castShadow = true;
    group.add(rail);
  };
  addSouthStairRail(port.southBeachStairs.x - 0.55);
  addSouthStairRail(
    port.southBeachStairs.x + port.southBeachStairs.width - 0.45,
  );

  const basinCenterX = port.basin.x + (port.basin.width - 1) / 2;
  const basinCenterZ = port.basin.z + (port.basin.height - 1) / 2;
  // 2026-08-26：Zeppelin 反饋跳板左邊「接不上碼頭、會穿模」——查到真正
  // 原因：西側這道船塢矮牆(下面 wallSegments 第一筆)整條沿 Z 軸貫通，
  // X 範圍 [port.basin.x-0.79, port.basin.x-0.31]、高度到
  // port.elevation+0.27，正好卡在跳板碼頭端(gangplankStartX≈
  // port.basin.x-0.52)的路徑正中間——跳板落地點的 X/Y 都落在這道牆的
  // 實心箱體內，等於直接穿過牆身，不是坡度或位置算錯。改成把西牆從
  // 一整條拆成兩段，中間在 port.ferry.z 這裡挖一個 rampGapHalfZ(=1.5，
  // 比跳板本身寬度 1.5*ferry.scale.z=2.55 略寬一點的半寬)的缺口讓
  // 跳板通過，比讓船一直墊更高去跨過矮牆乾淨——真實碼頭的護欄/矮牆
  // 本來就會在跳板/舷梯的位置留缺口。
  const rampGapHalfZ = 1.5;
  const westWallZStart = basinCenterZ - (port.basin.height + 1) / 2;
  const westWallZEnd = basinCenterZ + (port.basin.height + 1) / 2;
  const rampGapStartZ = port.ferry.z - rampGapHalfZ;
  const rampGapEndZ = port.ferry.z + rampGapHalfZ;
  const wallSegments = [
    [basinCenterX, port.basin.z - 0.55, port.basin.width + 1, 0.48],
    [
      basinCenterX,
      port.basin.z + port.basin.height - 0.55,
      port.basin.width + 1,
      0.48,
    ],
  ];
  if (rampGapStartZ - westWallZStart > 0.1) {
    const depth = rampGapStartZ - westWallZStart;
    wallSegments.push([
      port.basin.x - 0.55,
      westWallZStart + depth / 2,
      0.48,
      depth,
    ]);
  }
  if (westWallZEnd - rampGapEndZ > 0.1) {
    const depth = westWallZEnd - rampGapEndZ;
    wallSegments.push([
      port.basin.x - 0.55,
      rampGapEndZ + depth / 2,
      0.48,
      depth,
    ]);
  }
  wallSegments.forEach(([x, z, width, depth]) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.48, depth),
      concreteMat,
    );
    wall.position.set(x, port.elevation + 0.03, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  });

  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0x5a5e59,
    roughness: 0.82,
  });
  const bollards = [];
  for (let x = port.basin.x; x < port.basin.x + port.basin.width; x += 4) {
    bollards.push([x, port.basin.z - 0.8]);
    bollards.push([x, port.basin.z + port.basin.height - 0.3]);
  }
  for (let z = port.basin.z + 1; z < port.basin.z + port.basin.height; z += 4)
    bollards.push([port.basin.x - 0.85, z]);
  bollards.forEach(([x, z]) => {
    const bollard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.15, 0.38, 8),
      bollardMat,
    );
    bollard.position.set(x, port.elevation + 0.25, z);
    bollard.castShadow = true;
    group.add(bollard);
  });

  port.shops.forEach((shop, index) => {
    const shopGroup = new THREE.Group();
    shopGroup.position.y = port.elevation;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(shop.w - 0.18, 1.28, shop.d - 0.18),
      new THREE.MeshStandardMaterial({
        color: [0xc79b69, 0xb97f52, 0xd2ae79][index],
        roughness: 0.9,
      }),
    );
    const centerX = shop.x + (shop.w - 1) / 2;
    const frontZ = shop.z + shop.d / 2;
    body.position.set(centerX, 0.64, shop.z + 0.1);
    body.castShadow = true;
    body.receiveShadow = true;
    shopGroup.add(body);

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, shop.w + 0.24, 3),
      new THREE.MeshStandardMaterial({ color: 0x277d83, roughness: 0.86 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.scale.z = shop.d * 0.68;
    roof.position.set(centerX, 1.49, shop.z + 0.05);
    roof.castShadow = true;
    shopGroup.add(roof);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(shop.w - 0.3, 0.06, 0.68),
      new THREE.MeshStandardMaterial({
        color: index === 1 ? 0x226f78 : 0x319098,
      }),
    );
    awning.rotation.x = -0.18;
    awning.position.set(centerX, 0.94, frontZ + 0.15);
    awning.castShadow = true;
    shopGroup.add(awning);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.78, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x573d2d }),
    );
    door.position.set(centerX, 0.39, frontZ + 0.02);
    shopGroup.add(door);
    [-0.78, 0.78].forEach((offset) => {
      if (Math.abs(offset) > shop.w / 2 - 0.5) return;
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x8bc8d0,
        emissive: new THREE.Color(0xffcf7a),
        emissiveIntensity: 0,
      });
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.42, 0.05),
        winMat,
      );
      win.position.set(centerX + offset, 0.63, frontZ + 0.025);
      shopGroup.add(win);
      windowMats.push(winMat);
    });
    group.add(shopGroup);
  });

  // 登陸艇式渡輪——2026-08-26 整艘重畫(見 makeCargoShip() 開頭
  // 註解)，船頭(local -X)寬平朝碼頭，跳板從船頭整片放下，牛羊
  // 直進直出。scale/rotation 沿用舊版數字沒動，因為船頭本來就在
  // 碼頭那一端，改款只換了「那一端長什麼樣子」。
  //
  // 2026-08-26：Zeppelin 反饋跳板看起來陷進碼頭——原本 0.15 算
  // 出來的船甲板高度(≈1.0)跟碼頭平台頂(≈0.99)幾乎一樣高，理論上
  // 該是平的，但實際進遊戲看跳板卻陷進碼頭，代表這個攝影機視角
  // 下船身要蓋掉碼頭正面實際需要的高度比算出來的更高(可能是
  // 這個固定視角本身的透視關係，不是單純算錯)。改成 0.45(+0.3)。
  //
  // 同一天再問「修改哪邊參數」才能讓跳板傾斜角度更明顯、接碼頭
  // 那端往上翹——答案就是這裡：跳板全程沒有自己的角度參數，
  // 坡度是下面 `gangplankEndY - gangplankStartY` 現場算出來的，
  // 兩個端點分別鎖定「船甲板實際高度」跟「碼頭平台實際高度」，
  // 這樣才能保證跳板兩端真的分別接在船跟碼頭上，不會浮空或
  // 插進去。所以能調的不是角度本身，是這兩個端點的高度差——這裡
  // 再往上加到 0.65(+0.2)，高度差從 0.3 加大到 0.5，跳板斜度
  // 跟著變明顯(碼頭端固定不動、船那端墊更高，看起來就是「接碼頭
  // 的那端往上翹起」)。如果還想要更斜，就是這個 0.65 繼續加。
  const ferry = makeCargoShip();
  ferry.scale.set(2.05, 1.7, 1.7);
  ferry.position.set(port.ferry.x, 0.45, port.ferry.z);
  ferry.rotation.y = 0.03;
  group.add(ferry);

  // 船頭跳板——把船跟碼頭實際連起來，不再是各自獨立的兩組裝飾。
  // 長度/坡度依碼頭牆頂(port.elevation)跟船甲板高度現場算出來，
  // LAYOUT 數字之後微調也不用跟著手動改這裡。ferryHullHalfLength
  // 抓的是船 hull 局部半長(見 makeCargoShip 的 hullLength=3.6)
  // 乘上這裡的 scale.x，換算出離碼頭最近那一端(現在是船頭)的世界
  // 座標。
  //
  // 2026-08-26：Zeppelin 反饋要先看「放下」的樣子，這裡改成不再
  // push 進 gangplankMeshes——舊版渡輪的跳板會依 game-loop.ts 的
  // 日夜切換收放(夜間視為已啟航)，但登陸艇改款後這艘船的定位比較
  // 像固定停靠的交通船，跳板先常駐放下，之後如果要做「收起」的
  // 狀態(出航動畫之類)再另外接開關，不差這一版。
  //
  // 同一天再回報：跳板寬度要再擴張，「90 度收起來的時候才能把船
  // 綁起來」——暗示之後跳板會做成可以立起來當船頭艙門用，立起時
  // 要能蓋住整個船頭寬度、順便當繫船的地方，所以寬度不能只對應
  // 開口本身。1.1 改成 1.6，比船體 hullBeam(1.5) 略寬一點，立起
  // 來才能整個蓋住船頭而不留縫。這輪還沒做「立起收放」的實際互動
  // /動畫，純粹是先把寬度留夠，之後真的要做收放開關時尺寸不用
  // 重算。
  const ferryHullHalfLength = (3.6 / 2) * ferry.scale.x;
  // 2026-08-26：Zeppelin 反饋「讓板子直接放在地面」——查了一下，
  // 碼頭這塊石造平台是 addPlatform(0, port.basin.z, port.basin.x,
  // port.basin.height) 生出來的 BoxGeometry，實際涵蓋範圍只到
  // x = port.basin.x - 0.5 為止(平台寬度=port.basin.x，中心點
  // 位在 (width-1)/2，往外推半個 box 寬)。原本 -0.3 落在平台
  // 邊緣外 0.2 格的位置，等於懸在水面上、沒有真的踩在地面。改成
  // -0.5 對齊實際平台邊緣，再往內縮 0.02 避免貼齊出現共平面接縫。
  const gangplankStartX = port.basin.x - 0.52;
  const gangplankEndX = port.ferry.x - ferryHullHalfLength;
  const gangplankLength = gangplankEndX - gangplankStartX;
  const gangplankStartY = port.elevation;
  const gangplankEndY = ferry.position.y + 0.5 * ferry.scale.y;
  // 2026-08-26：Zeppelin 反饋跳板有點吃模——碼頭端的板面本來就跟
  // 平台頂只差 0.03~0.04(makeGangplank 木板局部 y=0.03)，角度
  // 一斜過去很容易在接縫處共平面閃爍。RAMP_LIFT 把整條跳板(起點
  // /終點一起)平移抬高一點點，純粹是視覺淨空，不改變坡度(角度
  // 還是用平移前的真實高度差算)。
  //
  // 寬度也順便修正：makeGangplank() 這個 group 是直接 add 進場景，
  // 沒有跟著 ferry 那組 scale(2.05,1.7,1.7) 一起縮放，所以上一輪
  // 傳的 1.6 是「跟船殼局部寬度 hullBeam(1.5) 差不多」沒錯，但
  // 船殼經過 scale.z=1.7 放大後，實際世界寬度是 1.5*1.7=2.55，
  // 比跳板寬了快一倍——這才是「跳板比船身窄」的真正原因。改成
  // `1.5 * ferry.scale.z` 現場算，兩邊之後如果又調整 hullBeam
  // 或 scale 都不用手動同步這個數字。
  const RAMP_LIFT = 0.06;
  const gangplank = makeGangplank(gangplankLength, 1.5 * ferry.scale.z);
  gangplank.rotation.z = Math.atan2(
    gangplankEndY - gangplankStartY,
    gangplankLength,
  );
  gangplank.position.set(
    gangplankStartX,
    gangplankStartY + RAMP_LIFT,
    port.ferry.z,
  );
  group.add(gangplank);
  // 序幕(開場第一天演出)要在遊戲開局操控這艘船跟跳板本身(從外海駛入、
  // 跳板從立起放下)，這裡把剛蓋好的參照跟這個跳板「本來就該停在」的
  // 角度存進 prologueRefs(scene-registries.ts)，src/prologue.ts 只讀
  // 這份、不用自己重新算一次跳板坡度或船隻停靠座標。
  prologueRefs.ferry = ferry;
  prologueRefs.gangplank = gangplank;
  prologueRefs.ferryRestX = ferry.position.x;
  prologueRefs.gangplankRestRotationZ = gangplank.rotation.z;
  prologueRefs.gangplankRestPosition = gangplank.position.clone();

  const dock = makeDock();
  dock.position.set(port.smallBoatDock.x, 0.13, port.smallBoatDock.z);
  dock.rotation.y = Math.PI / 2;
  group.add(dock);

  group.add(makePortLighthouse(port.lighthouse));


  return group;
}

// 女神祠堂的鳥居——這輪只求「一眼認得出是鳥居」的簡單造型：兩根柱子
// +兩道橫樑(上樑較寬、下樑較窄，鳥居的招牌比例)，朱紅色。退潮步道跟
// 祠堂本身的機制之後再接，這裡純粹是佔位地標。

// 山頂的小型神壇（祠／hokora）。正面朝本地 +Z，和地圖畫面「下方」
// 一致；原點位於石基座底部中央，呼叫端只需設定世界座標。
export function makeMountainSummitShrine() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8f8b80,
    roughness: 1,
    flatShading: true,
  });
  const vermillionMat = new THREE.MeshStandardMaterial({
    color: 0xb33b2a,
    roughness: 0.88,
  });
  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xe8ddc7,
    roughness: 0.94,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x3a241c,
    roughness: 0.96,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd5ac42,
    emissive: new THREE.Color(0x5a3108),
    emissiveIntensity: 0.16,
    roughness: 0.55,
  });
  const addBox = (
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // 兩階石座，讓小神壇即使在遠鏡頭也有清楚輪廓。
  addBox(1.45, 0.16, 1.05, 0, 0.08, 0, stoneMat);
  addBox(1.16, 0.16, 0.84, 0, 0.24, -0.02, stoneMat);

  // 米白內龕、朱紅柱框與前方供台。
  addBox(0.86, 0.82, 0.54, 0, 0.73, -0.1, plasterMat);
  [-0.48, 0.48].forEach((x) =>
    addBox(0.11, 0.92, 0.11, x, 0.76, 0.2, vermillionMat),
  );
  addBox(1.08, 0.12, 0.14, 0, 1.19, 0.2, vermillionMat);
  addBox(0.76, 0.08, 0.34, 0, 0.47, 0.38, darkWoodMat);
  addBox(0.38, 0.43, 0.04, 0, 0.79, 0.185, darkWoodMat);

  const sacredMirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.035, 12),
    goldMat,
  );
  sacredMirror.rotation.x = Math.PI / 2;
  sacredMirror.position.set(0, 0.84, 0.22);
  sacredMirror.castShadow = true;
  group.add(sacredMirror);

  // 兩片式切妻屋頂：屋脊沿 X，坡面向前後（±Z）落下。不能再用四角
  // ConeGeometry 旋轉 45 度，俯視投影會變菱形且四角罩不住龕體。
  const roofAngle = Math.PI / 6;
  const roofPanelDepth = 0.82;
  [-1, 1].forEach((side) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.1, roofPanelDepth),
      darkWoodMat,
    );
    panel.rotation.x = side * roofAngle;
    panel.position.set(0, 1.38, side * 0.31);
    panel.castShadow = true;
    group.add(panel);
  });
  addBox(1.08, 0.09, 0.1, 0, 1.59, 0, goldMat);

  return group;
}

export function makeToriiGate() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb33b2a,
    flatShading: true,
  });
  const pillarHeight = 1.4,
    pillarSpacing = 1.3;
  [-1, 1].forEach((side) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, pillarHeight, 8),
      mat,
    );
    pillar.position.set((side * pillarSpacing) / 2, pillarHeight / 2, 0);
    pillar.castShadow = true;
    group.add(pillar);
  });
  // 上樑(笠木)：比柱距寬一截、兩端微微翹起，鳥居最有辨識度的部分
  const topBeam = new THREE.Mesh(
    new THREE.BoxGeometry(pillarSpacing + 0.7, 0.18, 0.32),
    mat,
  );
  topBeam.position.set(0, pillarHeight + 0.05, 0);
  topBeam.castShadow = true;
  group.add(topBeam);
  const underBeam = new THREE.Mesh(
    new THREE.BoxGeometry(pillarSpacing + 0.34, 0.1, 0.16),
    mat,
  );
  underBeam.position.set(0, pillarHeight - 0.18, 0);
  underBeam.castShadow = true;
  group.add(underBeam);
  // 下樑(貫)：連接兩柱中段，鳥居結構的第二道橫樑
  const midBeam = new THREE.Mesh(
    new THREE.BoxGeometry(pillarSpacing + 0.06, 0.09, 0.09),
    mat,
  );
  midBeam.position.set(0, pillarHeight * 0.55, 0);
  midBeam.castShadow = true;
  group.add(midBeam);
  return group;
}

// 波上宮風主殿——2026-08-26 補上細節版，取代 northBeachPlatform.cube
// 原本的素色長方體佔位(build-map.ts 之前直接畫一個 BoxGeometry)。跟
// makeBuilding()/makeBarn() 同一套「方塊拼接、無貼圖、靠顏色分材質」
// 美術語言，由下往上疊：石灰基座(plinth)→朱紅牆身→米白長押(上緣
// 飾帶)→深色四坡頂(沿用 makeBuilding() 的「先把 45° 旋轉烤進
// geometry、mesh 上只留縮放」技巧，避免非等比縮放對已旋轉的形狀
// 產生剪切；出簷比例拉大到 0.85，比一般房子(0.72)更誇張，主殿要有
// 氣勢)，屋脊加一對交叉千木(chigi)做出神社剪影的辨識度，正面(+z，
// 鳥居/樓梯那一側，見 LAYOUT 註解的南北座標慣例)加迴廊列柱跟雙開
// 木門。內部完全不做(這裡本來就設定「無法住人的簡化神社」)。
//
// 牆身色刻意跟 makeToriiGate() 用同一顆朱紅(0xb33b2a)，主殿跟鳥居
// 才會是視覺上同一組建築，不是兩個各自配色的東西。
//
// 尺寸/位置完全吃呼叫端傳進來的 cube(即
// LAYOUT.oldVillage.northBeachPlatform.cube，{x,z,width,depth,
// height})——height 當作牆身高度，之後改 LAYOUT 的座標/大小這裡會
// 自動跟著變，不用同步改這個函式。回傳的 group 原點在主殿底部中心
// (跟 makeToriiGate() 一樣)，呼叫端自己 position.set(cube.x+
// (cube.width-1)/2, elevation, cube.z+(cube.depth-1)/2)。

export function makeShrineHall(cube) {
  const group = new THREE.Group();
  const width = cube.width * TILE,
    depth = cube.depth * TILE;
  const vermillion = 0xb33b2a;
  const plinthHeight = 0.16,
    wallHeight = cube.height,
    roofHeight = 1.0;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.06, plinthHeight, depth * 1.06),
    new THREE.MeshStandardMaterial({ color: 0x6b655d, flatShading: true }),
  );
  plinth.position.y = plinthHeight / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.94, wallHeight, depth * 0.94),
    new THREE.MeshStandardMaterial({ color: vermillion }),
  );
  wall.position.y = plinthHeight + wallHeight / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // 長押(上緣米白飾帶)：嵌在牆頂，比牆身略寬，露出一圈邊緣，
  // 顏色跟 makeBuilding() 的預設牆色(0xe8ddc7)同一顆，呼應「一般
  // 房子是米白牆」的既有配色語言。
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.98, 0.14, depth * 0.98),
    new THREE.MeshStandardMaterial({ color: 0xe8ddc7 }),
  );
  trim.position.y = plinthHeight + wallHeight - 0.07;
  trim.castShadow = true;
  group.add(trim);

  // 四坡頂：旋轉烤進 geometry 本身，mesh 上只留縮放，理由跟
  // makeBuilding() 完全一樣(非等比縮放遇上已旋轉的 mesh 會剪切)。
  const roofGeo = new THREE.ConeGeometry(1, roofHeight, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshStandardMaterial({ color: 0x2c3a45, flatShading: true }),
  );
  roof.scale.set(width * 0.85, 1, depth * 0.85);
  roof.position.y = plinthHeight + wallHeight + roofHeight / 2;
  roof.castShadow = true;
  group.add(roof);

  // 千木(chigi)：屋脊尖端交叉的兩根木條，神社建築最好辨認的剪影
  // 特徵，一根左傾一根右傾交叉成 X，卡在屋頂正中央尖端附近。
  const chigiMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20 });
  [-1, 1].forEach((side) => {
    const chigi = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.62, 0.07),
      chigiMat,
    );
    chigi.position.y = plinthHeight + wallHeight + roofHeight - 0.05;
    chigi.rotation.z = (side * Math.PI) / 7;
    chigi.castShadow = true;
    group.add(chigi);
  });

  // 正面(+z，鳥居/樓梯那一側)迴廊列柱：四根朱紅圓柱貼著牆面外側，
  // 高度跟牆身齊平，暗示這是一圈有頂的迴廊而不是實心牆貼到底。
  const pillarMat = new THREE.MeshStandardMaterial({ color: vermillion });
  const pillarZ = (depth / 2) * 1.02;
  [-0.36, -0.12, 0.12, 0.36].forEach((t) => {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, wallHeight, 8),
      pillarMat,
    );
    pillar.position.set(width * t, plinthHeight + wallHeight / 2, pillarZ);
    pillar.castShadow = true;
    group.add(pillar);
  });

  // 正面雙開木門，卡在牆面中央——跟 makeBarn() 的雙開穀倉門同一種
  // 做法，兩片薄板中間留縫。
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2018 });
  const doorHeight = wallHeight * 0.72;
  [-1, 1].forEach((side) => {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.16, doorHeight, 0.05),
      doorMat,
    );
    door.position.set(
      side * width * 0.09,
      plinthHeight + doorHeight / 2,
      (depth / 2) * 0.94,
    );
    group.add(door);
  });

  return group;
}

// 城區佔位建築——純色平面方塊，沒有窗戶屋頂細節，先卡出聚落的輪廓

export function makeTownPlaceholder(x, z, seed) {
  const group = new THREE.Group();
  const colors = [0xc9bda3, 0xbba17d, 0xa98e79, 0xd0c2a2, 0x9f9582];
  const roofColors = [0x884d39, 0x6f493c, 0x536f68, 0x795747];
  const w = 0.85 + seed * 0.4,
    h = 0.72 + hash2(seed, x) * 0.48,
    d = 0.85;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color: colors[Math.floor(seed * 100) % colors.length],
      roughness: 0.98,
    }),
  );
  box.position.y = h / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(w * 0.78, 0.34, 4),
    new THREE.MeshStandardMaterial({
      color: roofColors[Math.floor(seed * 17) % roofColors.length],
      roughness: 1,
    }),
  );
  roof.position.y = h + 0.13;
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = d / w;
  roof.castShadow = true;
  group.add(roof);

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x59483a,
    roughness: 1,
  });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.42, 0.035),
    woodMat,
  );
  door.position.set(0, 0.21, d / 2 + 0.02);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 0.055, 0.055),
    woodMat,
  );
  beam.position.set(0, h * 0.58, d / 2 + 0.025);
  group.add(door, beam);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x78929a,
    emissive: new THREE.Color(0xffc875),
    emissiveIntensity: 0,
  });
  [-0.27, 0.27].forEach((wx) => {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.2, 0.025),
      windowMat,
    );
    window.position.set(wx * w, h * 0.68, d / 2 + 0.025);
    group.add(window);
  });
  windowMats.push(windowMat);
  group.position.set(x, 0, z);
  group.rotation.y = (hash2(seed * 9, z) - 0.5) * 0.08;
  return group;
}

// 施工中標記——先用一根柱子+一塊告示牌卡位，不做真的施工動畫。
// 木匠事件的空屋在「construction」跟「ready_for_move_in」兩個 stage 都會立這個牌子。

export function makeBasaltHeadland(originX, originZ) {
  const group = new THREE.Group();
  const heightScale = 1.742;
  const rockMaterials = [0x3f3b38, 0x504640, 0x625149, 0x393b3d].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: 0.96,
      }),
  );
  const columns = [
    [0.0, 0.0, 1.15, 2.7],
    [0.8, 0.15, 1.05, 2.35],
    [1.55, 0.38, 1.2, 2.55],
    [2.35, 0.62, 1.08, 2.2],
    [3.15, 0.92, 1.0, 1.95],
    [4.0, 1.22, 0.92, 1.65],
    [4.75, 1.55, 0.78, 1.25],
    [5.4, 1.88, 0.62, 0.92],
    [0.25, 0.92, 1.08, 2.25],
    [1.1, 1.12, 1.22, 2.45],
    [1.95, 1.35, 1.12, 2.15],
    [2.8, 1.58, 1.04, 1.82],
    [3.65, 1.82, 0.86, 1.48],
    [4.4, 2.05, 0.7, 1.05],
    [0.55, 1.85, 0.9, 1.7],
    [1.45, 2.02, 1.02, 1.9],
    [2.35, 2.18, 0.86, 1.5],
    [3.15, 2.34, 0.72, 1.15],
  ];
  // 從原本岬角尖端向東延伸二十格；越靠外海越低、越窄，避免變成等寬堤防。
  for (let step = 0; step < 20; step++) {
    const x = 6.0 + step;
    const taper = 1 - step / 24;
    const centerZ = 1.95 + Math.sin(step * 0.58) * 0.22;
    columns.push([x, centerZ - 0.48, 0.72 * taper + 0.22, 1.28 * taper + 0.58]);
    columns.push([
      x + 0.2,
      centerZ + 0.48,
      0.62 * taper + 0.18,
      1.08 * taper + 0.42,
    ]);
    if (step < 6 && step % 2 === 0) {
      columns.push([x + 0.48, centerZ, 0.55 * taper + 0.2, 1.15 * taper + 0.5]);
    }
  }
  // 北緣再向 -Z 擴三格。靠陸端保留完整三格寬度，接近岬角尖端時逐層
  // 收窄，並用錯位與高度差打散格線感。
  for (let step = 0; step < 23; step++) {
    const x = 0.25 + step * 1.08;
    const lengthTaper = Math.max(0.18, 1 - step / 27);
    const northRows = step < 14 ? 3 : step < 19 ? 2 : 1;
    for (let row = 1; row <= northRows; row++) {
      const seed = hash2(step * 4.9, row * 8.3);
      columns.push([
        x + (seed - 0.5) * 0.34,
        -row * 0.92 + Math.sin(step * 0.47 + row) * 0.16,
        0.52 + lengthTaper * 0.38 - row * 0.035,
        0.72 + lengthTaper * 1.34 + (seed - 0.5) * 0.28,
      ]);
    }
  }
  // 西側再嵌入原有懸崖三格：這一段較高、較厚，並跨過新舊地形接線，
  // 讓岬角像從島體自然延續出來，而不是貼在懸崖旁的獨立造景。
  for (let westStep = 1; westStep <= 3; westStep++) {
    for (let row = -3; row <= 2; row++) {
      const seed = hash2(westStep * 7.7, row * 5.1 + 13.4);
      const edgeTaper = row === -3 || row === 2 ? 0.78 : 1;
      columns.push([
        -westStep * 0.96 + (seed - 0.5) * 0.24,
        row * 0.92 + Math.sin(westStep * 0.8 + row) * 0.14,
        (0.78 + seed * 0.22) * edgeTaper,
        (2.05 + seed * 0.72 - westStep * 0.1) * edgeTaper,
      ]);
    }
  }
  columns.forEach(([x, z, radius, height], index) => {
    height *= heightScale;
    const seed = hash2(originX + index * 2.7, originZ - index * 4.1);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * (0.82 + seed * 0.12),
        radius,
        height,
        5 + (index % 3),
        1,
      ),
      rockMaterials[index % rockMaterials.length],
    );
    column.position.set(
      x + (seed - 0.5) * 0.22,
      height / 2 - 0.02,
      z + (hash2(index * 5.3, 7.1) - 0.5) * 0.2,
    );
    column.rotation.y = seed * Math.PI;
    column.rotation.x = (hash2(index, 3.9) - 0.5) * 0.09;
    column.rotation.z = (hash2(index, 8.2) - 0.5) * 0.07;
    column.castShadow = true;
    column.receiveShadow = true;
    group.add(column);

    if (index % 2 === 0) {
      const cap = new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius * (0.58 + seed * 0.16), 0),
        rockMaterials[(index + 1) % rockMaterials.length],
      );
      cap.position.set(
        column.position.x + (seed - 0.5) * 0.3,
        height + radius * 0.08,
        column.position.z,
      );
      cap.scale.y = 0.42 + seed * 0.18;
      cap.rotation.set(seed * 0.4, seed * 2.4, seed * 0.25);
      cap.castShadow = true;
      cap.receiveShadow = true;
      group.add(cap);
    }
  });

  const foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [
    [1.2, 2.85, 1.45, 0.32],
    [2.75, 2.95, 1.65, 0.3],
    [4.25, 2.65, 1.35, 0.27],
    [5.35, 2.25, 0.95, 0.22],
    [7.0, 2.85, 1.6, 0.28],
    [9.0, 2.72, 1.7, 0.27],
    [11.0, 2.78, 1.65, 0.25],
    [13.0, 2.62, 1.45, 0.22],
    [15.0, 2.5, 1.1, 0.19],
    [17.0, 2.72, 1.35, 0.2],
    [19.0, 2.58, 1.3, 0.19],
    [21.0, 2.66, 1.2, 0.18],
    [23.0, 2.5, 1.05, 0.17],
    [25.0, 2.42, 0.85, 0.15],
    [2.0, -3.25, 1.45, 0.22],
    [5.0, -3.18, 1.6, 0.22],
    [8.0, -3.1, 1.55, 0.21],
    [11.0, -3.0, 1.4, 0.2],
    [15.0, -2.25, 1.2, 0.18],
    [20.0, -1.35, 0.95, 0.16],
  ].forEach(([x, z, width, depth], index) => {
    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 14),
      foamMaterial.clone(),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(x, 0.285 + index * 0.002, z);
    foam.scale.set(width, depth, 1);
    foam.renderOrder = 3;
    group.add(foam);
  });
  group.position.set(originX, 0, originZ);
  return group;
}

export function makeCelestialSpiralStaircase(options: {
  x: number;
  z: number;
  baseY: number;
  steps: number;
  radius: number;
  risePerStep: number;
  angleStepDegrees: number;
  // 整圈螺旋繞著 (x,z) 這個中心點的起始朝向偏移——每一階的座標
  // 本來就是直接算成世界座標(不是先建在原點再靠 group.rotation
  // 轉)，所以「整座天梯轉幾度」沒辦法靠外面對回傳的 group 設
  // rotation.y 做到(那樣會繞著地圖原點轉，不是繞著天梯自己中心
  // 轉，整座會飛到別的地方去)，只能在算每一階角度時疊加這個
  // 偏移量。預設 0，不影響原本沒指定這個參數的呼叫端。
  rotationDegrees?: number;
  treadWidth?: number;
  treadDepth?: number;
}) {
  const group = new THREE.Group();
  const treadWidth = options.treadWidth ?? 0.62;
  const treadDepth = options.treadDepth ?? 0.34;
  const angleStep = THREE.MathUtils.degToRad(options.angleStepDegrees);
  const baseAngle = THREE.MathUtils.degToRad(options.rotationDegrees ?? 0);
  const stepMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < options.steps; i++) {
    // 色相依階數在一整圈(0~1)均勻分布，繞完一圈剛好回到接近起點的
    // 色相，視覺上是一條連續的七彩螺旋，不是隨機跳色。
    const hue = (i / options.steps) % 1;
    const color = new THREE.Color().setHSL(hue, 0.82, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false, // 半透明疊在一起，不用深度寫入避免互相遮蔽出現硬邊
    });
    stepMats.push(mat);
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(treadWidth, 0.05, treadDepth),
      mat,
    );
    const angle = i * angleStep + baseAngle;
    step.position.set(
      options.x + Math.cos(angle) * options.radius,
      options.baseY + i * options.risePerStep,
      options.z + Math.sin(angle) * options.radius,
    );
    // 踏面切線方向對齊螺旋前進方向，跟站在階梯上的視角一致，不是
    // 每一階都同一個朝向死板地疊上去。
    step.rotation.y = -angle;
    step.renderOrder = 15;
    group.add(step);
    // 每一階下緣加一圈細細的發光邊框，強化「浮空發光」而不是「一塊
    // 半透明方塊」的觀感——邊框不透明、比踏面本體更亮一點。
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(treadWidth + 0.03, 0.015, treadDepth + 0.03),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.85,
      }),
    );
    rim.position.copy(step.position);
    rim.position.y -= 0.03;
    rim.rotation.y = step.rotation.y;
    rim.renderOrder = 15;
    group.add(rim);
  }
  // 特地不加扶手/支撐柱——「無把手」+「懸空」是需求明講的重點，
  // 其他樓梯範本(makeSteepStoneStairs/makeMineStaircase)那套自動
  // 生成扶手的邏輯完全不套用在這裡。
  return { group, stepMats };
}

// 天梯的閃耀特效(2026-08-26，Zeppelin 實測回報「看能不能加點閃耀
// 特效」)——散落在天梯螺旋體積周圍的一群發光星點，材質/貼圖直接
// 沿用 scene-sky.ts 夜空那套 STAR_SPARKLE_TEXTURE/STAR_SPARKLE_
// COLORS(四角十字星芒+柔光暈的貼圖，跟滿天星星同一顆)，維持整
// 個場景「星芒」視覺語言一致，不用另外設計一套貼圖。跟星空那套
// 不同的是：這裡的點是掛在世界座標(sizeAttenuation: true，會隨
// 距離縮放)，不是掛在攝影機上的天空穹頂(那套 sizeAttenuation:
// false，因為星星要「無論多遠看起來都一樣大」)——天梯的閃光是
// 場景裡的實體特效，應該跟其他道具一樣受景深影響。
//
// 回傳的 materials 陣列要外部(build-map.ts)存起來，每幀更新
// opacity 做出閃爍——這裡只負責建立幾何/材質，不含動畫邏輯，跟
// 這個檔案其他 make 開頭函式的分工一致(props.ts 不碰 gameState/
// requestAnimationFrame，動畫都由呼叫端在 game-loop.ts 驅動)。

export function makeCelestialSparkles(options: {
  x: number;
  z: number;
  baseY: number;
  height: number;
  radius: number;
  count?: number;
  seed?: number;
}) {
  const group = new THREE.Group();
  const count = options.count ?? 48;
  const phaseGroups = 6;
  const seed = options.seed ?? 0;
  const groupPositions: number[][] = Array.from(
    { length: phaseGroups },
    () => [],
  );
  const groupColors: number[][] = Array.from({ length: phaseGroups }, () => []);
  for (let i = 0; i < count; i++) {
    // 決定性亂數(hash2)——跟這個檔案其他灑點函式(玄武岩柱群、
    // 植被)同一套寫法，重算幾次都是同一批位置，不會每次重進地圖
    // 星點就整批跳動。散落範圍是一個以 (x,z) 為軸心、半徑
    // options.radius*1.6(比螺旋本體寬一點，星光飄在階梯外圍而不是
    // 只貼著踏面)、高度從 baseY 到 baseY+height 的圓柱體積。
    const ra = hash2(seed + i * 3.7, i * 1.9);
    const rr = hash2(i * 2.3, seed + i * 5.1);
    const ry = hash2(seed + i * 7.7 + 11, i * 4.3);
    const angle = ra * Math.PI * 2;
    const dist = options.radius * (0.35 + rr * 1.25);
    const px = options.x + Math.cos(angle) * dist;
    const pz = options.z + Math.sin(angle) * dist;
    const py = options.baseY + ry * options.height;
    const phaseGroup = i % phaseGroups;
    groupPositions[phaseGroup].push(px, py, pz);
    const color = new THREE.Color(
      STAR_SPARKLE_COLORS[(i * 3 + seed) % STAR_SPARKLE_COLORS.length],
    );
    groupColors[phaseGroup].push(color.r, color.g, color.b);
  }
  const materials: THREE.PointsMaterial[] = groupPositions.map(
    (positions, phaseIndex) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(groupColors[phaseIndex], 3),
      );
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        vertexColors: true,
        map: STAR_SPARKLE_TEXTURE,
        size: 0.32 + (phaseIndex % 3) * 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      points.renderOrder = 16;
      group.add(points);
      return material;
    },
  );
  return { group, materials };
}

export function makeInteriorWall(x, z, windowSide) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(TILE * 0.98, 1.4, TILE * 0.98),
    new THREE.MeshStandardMaterial({ color: 0xefe6d8 }),
  );
  wall.position.y = 0.7;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  if (windowSide) {
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x2b3a55,
      emissive: new THREE.Color(0xffcf7a),
      emissiveIntensity: 0,
    });
    // 座標是「朝房間內側」的那一面，不是朝地圖外面的那一面——牆的外側
    // 本來就沒人站在那邊看，窗戶裝在那一面等於誰都看不到，之前裝反了
    let win;
    if (windowSide === "north") {
      win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), winMat);
      win.position.set(0, 0.78, 0.49);
    } else if (windowSide === "south") {
      win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), winMat);
      win.position.set(0, 0.78, -0.49);
    } else if (windowSide === "east") {
      win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.5), winMat);
      win.position.set(-0.49, 0.78, 0);
    } else {
      win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.5), winMat);
      win.position.set(0.49, 0.78, 0);
    }
    g.add(win);
    windowMats.push(winMat);
  }
  g.position.set(x, 0, z);
  return g;
}

export function makeMineStaircase(direction, tierColor) {
  const group = new THREE.Group();
  const stairTopMats = [0xcdbf9d, 0x918472].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.96 }),
  );
  const stairSideMat = new THREE.MeshStandardMaterial({
    color: 0x625b54,
    roughness: 1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: tierColor,
    flatShading: true,
    roughness: 0.5,
    metalness: 0.2,
  });

  const stepCount = 4;
  const stepWidth = 0.7;
  const totalRun = 0.8;
  const totalRise = 0.8;
  const stepDepth = totalRun / stepCount;
  const baseY = direction === "up" ? 0 : -1;

  for (let i = 0; i < stepCount; i++) {
    const order = direction === "up" ? i : stepCount - 1 - i;
    const height = ((order + 1) / stepCount) * totalRise;
    const topMat = stairTopMats[i % stairTopMats.length];
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(stepWidth, height, stepDepth),
      [
        stairSideMat,
        stairSideMat,
        topMat,
        stairSideMat,
        stairSideMat,
        stairSideMat,
      ],
    );
    const z = -totalRun / 2 + (i + 0.5) * stepDepth;
    step.position.set(0, baseY + height / 2, z);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  if (direction === "up") {
    // 最高一階頂端貼一條階層色，暗示「往上還有」，跟牆體/地板同一
    // 組配色系統對齊。
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(stepWidth + 0.06, 0.03, stepDepth + 0.02),
      accentMat,
    );
    rim.position.set(0, totalRise + 0.02, totalRun / 2 - stepDepth / 2);
    rim.castShadow = true;
    rim.receiveShadow = true;
    group.add(rim);
  } else {
    // 下樓在坑口邊緣描一圈細框標出洞口輪廓(四段細長條拼成方框)，
    // 不是整片實心板蓋住洞口——真正的洞由 makeMinePitRecess 挖出來。
    const frameThickness = 0.07;
    [
      { w: 1.0, d: frameThickness, x: 0, z: -0.465 },
      { w: 1.0, d: frameThickness, x: 0, z: 0.465 },
      { w: frameThickness, d: 1.0, x: -0.465, z: 0 },
      { w: frameThickness, d: 1.0, x: 0.465, z: 0 },
    ].forEach((seg) => {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(seg.w, 0.05, seg.d),
        accentMat,
      );
      bar.position.set(seg.x, 0.015, seg.z);
      bar.castShadow = true;
      bar.receiveShadow = true;
      group.add(bar);
    });
  }

  return group;
}

// 下樓梯挖出的 1×1×1 坑洞本體——四片洞壁+坑底，配合 build-map.ts
// 把該格地板拆成「洞口以外」三塊拼接(picture-frame 分割，跟舊城鎮
// 沙灘/海三塊拼接同一種手法，見 addMapFloorPatch 開頭註解)，是真的
// 挖空一格，不是貼一張黑色平面騙深度。

export function makeMinePitRecess(rockColor) {
  const group = new THREE.Group();
  const base = new THREE.Color(rockColor);
  const wallMat = new THREE.MeshStandardMaterial({
    color: base,
    flatShading: true,
    roughness: 0.95,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: base.clone().multiplyScalar(0.55),
    flatShading: true,
    roughness: 1,
  });
  const wallThickness = 0.08;
  const pitFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1 - wallThickness, 0.06, 1 - wallThickness),
    floorMat,
  );
  pitFloor.position.set(0, -0.97, 0);
  pitFloor.receiveShadow = true;
  group.add(pitFloor);
  [
    { w: 1, d: wallThickness, x: 0, z: -0.46 },
    { w: 1, d: wallThickness, x: 0, z: 0.46 },
    { w: wallThickness, d: 1 - wallThickness * 2, x: -0.46, z: 0 },
    { w: wallThickness, d: 1 - wallThickness * 2, x: 0.46, z: 0 },
  ].forEach((seg) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(seg.w, 1, seg.d),
      wallMat,
    );
    wall.position.set(seg.x, -0.5, seg.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  });
  return group;
}

// ==============================================================
