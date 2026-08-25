import * as THREE from "three";
import { hash2 } from "./utils";
import {
  gameState,
  getSeasonGrassTone,
  SEASON_GRASS_TONES,
} from "./game-state";
import {
  scene,
  TILE,
  PLATEAU_Y,
  NORTH_CLIFF_Z,
  SOUTH_TERRAIN_EXTENSION,
  NORTH_TERRAIN_EXTENSION,
  northCliffEdgeZ,
  groundY,
  updateCameraFrustum,
} from "./scene-sky";
import {
  LAYOUT,
  MAPS,
  carpenterQuest,
  CARPENTER_HOUSE,
  isInsideLakeShape,
  AVENUE_TREE_KEYS,
  LAKE_SHADE_TREE_TILES,
  TOWN_Z_START,
  RAMP_CORRIDOR_MIN_Z,
  RAMP_CORRIDOR_MAX_Z,
  COAST_ROAD_CENTER_Z,
  COAST_ROAD_HALF_WIDTH,
  lakeEdgeFactor,
  POUCH_POS,
  CARPENTER_DOORSTEP,
  SHRINE_PATH_START_X,
  SHRINE_PATH_LENGTH,
  SHRINE_PATH_ELEVATION,
  portGroundY,
  oldVillageGroundY,
  oldVillageSouthBeachEndZ,
  oldVillageWestBeachStartX,
  mountainGroundY,
  isOnMountainStair,
  MOUNTAIN_GATE_BLOCKER,
  OLD_VILLAGE_RAILS,
  isBlockedByOldVillageRail,
} from "./layout-maps";
import {
  handleCarpenterDockTouch,
  handleCarpenterDoorstepTouch,
} from "./carpenter-quest";
import {
  windowMats,
  waterSurfaceMaterials,
  waterSkyUnderlayMaterials,
  outdoorLampLights,
  foamMeshes,
  windmillRotors,
  lakeShoreColliders,
  fishSchool,
  pastureGrassBlades,
  avenueLeafMaterials,
  seasonalTreeLeafMaterials,
  seasonalGroundMaterials,
  mountainSeasonalMaterials,
  SEA_FISH_SCALE,
  LAKE_FISH_SCALE,
  EAST_SEA_WAVE_DIRECTION,
  SOUTH_SEA_WAVE_DIRECTION,
  WEST_SEA_WAVE_DIRECTION,
  NORTHEAST_SEA_WAVE_DIRECTION,
  thresholdMarkerMeshes,
  thresholdMarkersVisible,
  gatherNodeMeshes,
  oreNodeMeshes,
} from "./scene-registries";
import {
  findSouthernShoreSandZ,
  findWesternShoreSandX,
} from "./shore-foam";
import {
  MINE_SIZE,
  MINE_FLOOR_MAX,
  ORE_TIERS,
  ORE_NODES,
  mineUpStairs,
  mineDownStairs,
  mineTierForFloor,
  mineStairRotation,
  regenerateMineFloor,
  regenerateMineFloorTiles,
} from "./mine";
import {
  npcGroup,
  npcs,
  animalGroup,
  PASTURE,
  hasPastureGrassAt,
} from "./npc-runtime";
// 這個 import 刻意放在 scene-sky/npc-runtime 之後：build-map.ts 是
// main.ts 第一個載入的模組，dialogue.ts 會 import npc-runtime.ts，
// npc-runtime.ts 又會在模組頂層讀 scene-sky.ts 的 scene/PLATEAU_Y——
// 如果這行排在 scene-sky 的 import 之前，就會搶先透過 dialogue.ts 把
// npc-runtime.ts 拉進來，早於 scene-sky.ts 本身被求值，导致
// farm-visuals.ts/npc-runtime.ts 模組頂層讀到的 scene/PLATEAU_Y 還在
// TDZ，丟出「Cannot access 'PLATEAU_Y' before initialization」(實測
// 撞過一次)。排在這裡確保 scene-sky.ts 早就由上面幾個 import 完整求值
// 過，不會再繞回循環。
import { showChoice } from "./dialogue";
import { makeHeroPlayer, makeMountainGuardian } from "./humanoid";
import { isPointBlockedByScaledBuilding } from "./building-scale";
import {
  makeTree,
  makeAvenueTree,
  makeBuilding,
  makeBarn,
  makePath,
  makeLakeShoreRock,
  makeGrassTuft,
  makeWindGrass,
  makeFlower,
  makeFruitTree,
  makeWaterfallPlaceholder,
  makeOysterRack,
  makeRestArea,
  makeSmallGarden,
  makePortScene,
  makeToriiGate,
  makeShrinePathCauseway,
  makeTownPlaceholder,
  makeConstructionSign,
  makeStone,
  makeBasaltHeadland,
  makeSand,
  makeFoam,
  makeRedWindmill,
  makeMountain,
  makeOldVillageStalactiteCaveEntrance,
  makeWesternMountainTerrain,
  makeMountainGateway,
  makeSteepStoneStairs,
  makeFishProp,
  makeLamp,
  makeStreetLamp,
  makeBench,
  makeFence,
  makeCampfireRing,
  makeInteriorWall,
  makeFurniture,
  updateSeasonalGroundColors,
  makeWoodPlankTexture,
  FLOWER_COLORS,
  makeFlagpole,
  makeBellCupola,
  makeMedicalSign,
  makeBookStack,
  makeEasel,
  makeShipWheelEmblem,
  makeHangingSignboard,
  makeWoodPile,
  makeStonePile,
  makeAnimalFeeder,
  makeOreNode,
  makeMineStaircase,
  makeMinePitRecess,
} from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import { createTransitionEvents, type TransitionLink } from "./map-transitions";
import {
  OYSTER_RACK_VISUAL,
  WOOD_NODES,
  STONE_NODES,
  FEEDER_VISUAL,
  isPointInsideFeeder,
  refreshGatherNodes,
} from "./game-state";

// 地圖底板，可選「星空穿透」寫法：transparent+opacity:1+depthWrite:false，
// 不是只關掉 depthWrite。純關 depthWrite（保留 opaque）會讓地板完全不擋深度，
// 星空/銀河連沙灘/廣場這些「應該不透光」的地方都會透出來，不是只有水面
// 半透明處。改成跟星空同一個 transparent 佇列、opacity 維持 1（視覺上還是
// 完全不透明），renderOrder 排在星空群組(-0.8~-0.5)之後、水面之前：星空
// 先畫→地板用不透明色蓋掉星空（沙灘/廣場正常不透光）→水面最後疊上去，
// 水面自己有正常寫深度，地板的深度測試會正確避開水面範圍不覆蓋它，水面
// 才能繼續透出星空。
//
// starSafe 只能套在「上面沒有其他東西」的裸露地板（例如海/沙灘正下方）。
// 舊城鎮的 terraceMat(石質台地/步道) 自己也是 depthWrite:false（避免相鄰
// 台階間的 z-fighting），一旦底板也進了 transparent 佇列，兩者的繪製順序
// 只看 renderOrder、opaque/transparent 佇列一定整批排在 transparent 佇列
// 之前——底板(transparent)因此永遠畫在 terraceMat(opaque) 之後，會把整片
// 石質地板/步道蓋成草地色，曾經因此把舊城鎮的石地板、步道全部吃成草地。
// 所以舊城鎮只有「南側新沙灘/海」這塊裸地板可以套 starSafe，城鎮本體(有
// terraceMat 蓋著的範圍)一定要用普通 opaque 地板，兩塊分開蓋、不要合成
// 一塊，靠 z 分界銜接。
function addMapFloorPatch({
  x = 0,
  z = 0,
  width,
  depth,
  color,
  roughness,
  starSafe = false,
}) {
  const material = new THREE.MeshStandardMaterial(
    starSafe
      ? { color, roughness, transparent: true, opacity: 1, depthWrite: false }
      : { color, roughness },
  );
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width * TILE, 0.2, depth * TILE),
    material,
  );
  floor.position.set(
    x * TILE + (width * TILE) / 2 - TILE / 2,
    -0.1,
    z * TILE + (depth * TILE) / 2 - TILE / 2,
  );
  floor.receiveShadow = true;
  if (starSafe) floor.renderOrder = 2;
  gameState.mapGroup.add(floor);
  return material;
}

// ==============================================================
// 10) 建場景
// ==============================================================
export function buildMap(mapName) {
  scene.remove(gameState.mapGroup);
  gameState.mapGroup = new THREE.Group();
  windowMats.length = 0;
  waterSurfaceMaterials.length = 0;
  waterSkyUnderlayMaterials.length = 0;
  outdoorLampLights.length = 0;
  seasonalTreeLeafMaterials.length = 0;
  seasonalGroundMaterials.length = 0;
  mountainSeasonalMaterials.length = 0;
  thresholdMarkerMeshes.length = 0;
  gatherNodeMeshes.length = 0;
  oreNodeMeshes.length = 0;
  // 場景專屬物件可能在前面的 port／oldVillage 分支建好；動畫登記表必須
  // 在任何場景建置之前清空，不能等到共用海面收尾才清，否則模型看得到、
  // animate() 卻收不到登記項目，浪花會完全靜止。
  foamMeshes.length = 0;

  const map = MAPS[mapName];
  const rows = map.tiles.length,
    cols = map.tiles[0].length;

  let plateauGroup = gameState.mapGroup;

  if (mapName === "house") {
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(cols * TILE, 0.2, rows * TILE),
      new THREE.MeshStandardMaterial({ color: 0xc9b48a }),
    );
    ground.position.set(
      (cols * TILE) / 2 - TILE / 2,
      -0.1,
      (rows * TILE) / 2 - TILE / 2,
    );
    ground.receiveShadow = true;
    gameState.mapGroup.add(ground);
  } else if (mapName === "livingArea") {
    // 地面拆成四塊：高台(x0-10) + 三格階梯緩坡(x11,12,13) + 低地沙灘/海(x14+)。
    // 相鄰方塊高度不同，交界處自然露出垂直側面，那就是「階梯」的視覺來源，
    // 不用額外建模階梯形狀
    // transparent:true + opacity:1 + depthWrite:false 是刻意的組合，不是
    // 疏漏：純粹只關掉 depthWrite（保持 opaque）會讓這片地板底下完全沒有
    // 深度資訊，導致掛在相機底下的星空/銀河在「整片草地」都透出來，不是
    // 只在湖面——地板需要繼續「擋住」星星，只是要用畫面覆蓋（後畫的不透明
    // 顏色蓋掉先畫的星星），不能用深度測試擋。opacity:1 讓草地視覺上維持
    // 完全不透明，renderOrder 排在星空群組(-0.8~-0.5)之後、湖水本身之前，
    // 星空先畫→草地蓋掉星空（看起來不透光）→湖水最後疊上去，湖水自己的
    // 深度已經正常寫入，草地的深度測試會正確避開湖面不覆蓋它，湖才能繼續
    // 透出星空。實測過這個組合：草地不透光、湖面透光，兩者互不影響。
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x6ab04c,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const zCenter = (rows * TILE) / 2 - TILE / 2;
    function groundSlab(xStart, xEnd, height) {
      const width = xEnd - xStart;
      const northExtension = NORTH_TERRAIN_EXTENSION;
      const depth = rows * TILE + northExtension + SOUTH_TERRAIN_EXTENSION;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.2, depth),
        grassMat,
      );
      slab.position.set(
        (xStart + xEnd) / 2 - 0.5,
        height - 0.1,
        zCenter + (SOUTH_TERRAIN_EXTENSION - northExtension) / 2,
      );
      slab.receiveShadow = true;
      slab.castShadow = true;
      slab.renderOrder = 2;
      gameState.mapGroup.add(slab);
    }
    const rampX = LAYOUT.coast.rampX;
    const lowlandX = rampX + LAYOUT.coast.rampWidth;
    groundSlab(0, rampX, PLATEAU_Y);
    // 跟 grassMat 同一套修法：這片地板蓋住沙洲步道/近海這一整塊區域，
    // 之前一直沒套用，就是「靠近女神祠堂那段海完全看不到星空」的真正
    // 原因——這片才是實際擋住深度的地板，不是 oceanDepthMask 本身。
    const lowlandMat = new THREE.MeshStandardMaterial({
      color: 0x6ab04c,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    seasonalGroundMaterials.push(grassMat, lowlandMat);
    const cliffMat2 = new THREE.MeshStandardMaterial({
      color: 0x8a8478,
      flatShading: true,
    });
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xbfa172 });
    for (
      let z = -NORTH_TERRAIN_EXTENSION;
      z < Math.min(rows, TOWN_Z_START);
      z++
    ) {
      const inCorridor = z >= RAMP_CORRIDOR_MIN_Z && z <= RAMP_CORRIDOR_MAX_Z;
      if (inCorridor) {
        // 走廊：三級台階，用路面色而不是草色，讀起來像「這是特地留的一條路」
        [
          [rampX, PLATEAU_Y * 0.75],
          [rampX + 1, PLATEAU_Y * 0.5],
          [rampX + 2, PLATEAU_Y * 0.25],
        ].forEach(([sx, sy]) => {
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.2, TILE),
            pathMat,
          );
          step.position.set(sx, sy - 0.1, z);
          step.receiveShadow = true;
          step.castShadow = true;
          gameState.mapGroup.add(step);
        });
      } else {
        // 懸崖：一整片垂直岩壁，從高台頂端封到海平面，這裡走不過去
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(3, PLATEAU_Y + 0.3, TILE * 0.96),
          cliffMat2,
        );
        wall.position.set(rampX + 1, PLATEAU_Y / 2 - 0.05, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        gameState.mapGroup.add(wall);
        // 崖底偶爾堆一顆放大的石頭，呼應參考圖那種亂石礁岸的感覺
        if (hash2(z * 3.1, 8.8) < 0.55) {
          const boulder = makeStone(
            rampX + hash2(z, 1) * 2.3,
            z + (hash2(z, 2) - 0.5) * 0.6,
            hash2(z, 3),
          );
          boulder.scale.setScalar(1.7 + hash2(z, 4) * 1.6);
          gameState.mapGroup.add(boulder);
        }
      }
    }
    // 斜坡三欄從城鎮擴充區開始延續原高度，補掉拉遠時的中央裂縫。
    const southRampStartZ = Math.min(rows, TOWN_Z_START);
    const southRampDepth = rows - southRampStartZ + SOUTH_TERRAIN_EXTENSION;
    [
      [rampX, PLATEAU_Y * 0.75],
      [rampX + 1, PLATEAU_Y * 0.5],
      [rampX + 2, PLATEAU_Y * 0.25],
    ].forEach(([sx, sy]) => {
      const apron = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.2, southRampDepth),
        cliffMat2,
      );
      apron.position.set(
        sx,
        sy - 0.1,
        southRampStartZ - 0.5 + southRampDepth / 2,
      );
      apron.receiveShadow = true;
      gameState.mapGroup.add(apron);
    });

    const extendedDepth =
      rows * TILE + NORTH_TERRAIN_EXTENSION + SOUTH_TERRAIN_EXTENSION;
    const lowland = new THREE.Mesh(
      new THREE.BoxGeometry(cols - lowlandX, 0.2, extendedDepth),
      lowlandMat,
    );
    lowland.position.set(
      lowlandX + (cols - lowlandX) / 2 - 0.5,
      -0.1,
      zCenter + (SOUTH_TERRAIN_EXTENSION - NORTH_TERRAIN_EXTENSION) / 2,
    );
    lowland.receiveShadow = true;
    lowland.renderOrder = 2;
    gameState.mapGroup.add(lowland);
    const southCoastStartZ = TOWN_Z_START - 0.5;
    const southCoastDepth = rows - TOWN_Z_START + SOUTH_TERRAIN_EXTENSION;
    const southBeach = new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.coast.sandCols, southCoastDepth),
      new THREE.MeshStandardMaterial({
        color: 0xe8d29a,
        roughness: 0.96,
      }),
    );
    southBeach.rotation.x = -Math.PI / 2;
    southBeach.position.set(
      lowlandX + LAYOUT.coast.sandCols / 2 - 0.5,
      0.015,
      southCoastStartZ + southCoastDepth / 2,
    );
    southBeach.receiveShadow = true;
    gameState.mapGroup.add(southBeach);

    // 右側沙灘也往北補齊，接住延伸後的海面與海堤，不留下綠色斷帶。
    // 第 0～2 排包含通往祠堂的沙洲，海格會被步道資料覆寫，因此不能只用
    // 第 0 排的 indexOf(9) 判斷海岸線。從北側數排中取第一個有效海岸；
    // 目前第 3 排就是玄武岩南側真正的海岸資料。
    const northOceanStartX =
      map.tiles
        .slice(0, 6)
        .map((row) => row.indexOf(9))
        .find((x) => x > lowlandX) ?? -1;
    if (northOceanStartX > lowlandX) {
      // 玄武岩岬角的西側柱群會比低地邊界再往西伸約 3 格；沙灘也必須
      // 鋪到岩腳下，否則遠景會在玄武岩與海灘之間露出一條綠色底板。
      const minX = lowlandX - 4.5;
      const maxX = northOceanStartX - 0.5;
      const northZ = -NORTH_TERRAIN_EXTENSION - 0.5;
      const southZ = -0.5;
      const cornerRadius = Math.min(2, (maxX - minX) * 0.4);
      // Shape 的 y 經 -90° 旋轉後會成為世界座標 -z。
      const northSandShape = new THREE.Shape();
      northSandShape.moveTo(minX, -southZ);
      northSandShape.lineTo(maxX, -southZ);
      northSandShape.lineTo(maxX, -northZ - cornerRadius);
      northSandShape.quadraticCurveTo(
        maxX,
        -northZ,
        maxX - cornerRadius,
        -northZ,
      );
      northSandShape.lineTo(minX, -northZ);
      northSandShape.closePath();
      const northSand = new THREE.Mesh(
        new THREE.ShapeGeometry(northSandShape, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8d29a }),
      );
      northSand.rotation.x = -Math.PI / 2;
      northSand.position.y = 0.015;
      gameState.mapGroup.add(northSand);
    }

    // 北側懸崖 + 遠方海景 —— 純背景，跟西側遠山同一招：z 是負的，isBlocked
    // 本來就會把超出邊界的座標判定為擋路，走不進去，不用額外寫碰撞。
    // 沒有真的把海延伸到北邊（那需要海面系統支援兩塊不相連的水域，成本
    // 不成比例），做的是懸崖峭壁 + 崖底沙灘沿 + 亂石 + 遠方海水色背景板，
    // 「沙灘在崖底止住」這個視覺效果做出來了，但沙灘本身不能走進去
    const northCliffStartX = -0.5;
    const northCliffEndX = LAYOUT.coast.rampX + LAYOUT.coast.rampWidth - 0.5;
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x8a8478,
      flatShading: true,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x594231,
      flatShading: true,
      roughness: 0.9,
    });
    const cliffEdge = [];
    for (let x = northCliffStartX; x < northCliffEndX; x += 1) {
      const centerX = x + 0.5;
      const edgeZ = northCliffEdgeZ(centerX);
      const wallHeight = PLATEAU_Y + 0.12 + hash2(centerX * 4.7, 2.3) * 0.28;
      const wallDepth = 0.48 + hash2(centerX * 2.9, 9.1) * 0.28;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(1.08, wallHeight, wallDepth),
        cliffMat,
      );
      wall.position.set(centerX, wallHeight / 2 - 0.08, edgeZ);
      wall.rotation.y = (hash2(centerX, 5.6) - 0.5) * 0.08;
      wall.castShadow = true;
      wall.receiveShadow = true;
      gameState.mapGroup.add(wall);
      cliffEdge.push({
        x: centerX,
        z: edgeZ + wallDepth * 0.42,
        top: wallHeight - 0.08,
      });
    }
    // 木製護欄跟著不規則崖線逐段連接；雙橫桿讓遠景仍看得清楚。
    cliffEdge.forEach((point, i) => {
      if (i % 2 === 0) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.075, 0.82, 6),
          railMat,
        );
        post.position.set(point.x, point.top + 0.4, point.z);
        post.castShadow = true;
        gameState.mapGroup.add(post);
      }
      if (i === cliffEdge.length - 1) return;
      const next = cliffEdge[i + 1];
      const dx = next.x - point.x,
        dz = next.z - point.z;
      const length = Math.hypot(dx, dz);
      [0.28, 0.62].forEach((railHeight) => {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(length + 0.06, 0.075, 0.075),
          railMat,
        );
        rail.position.set(
          (point.x + next.x) / 2,
          (point.top + next.top) / 2 + railHeight,
          (point.z + next.z) / 2,
        );
        rail.rotation.y = -Math.atan2(dz, dx);
        rail.castShadow = true;
        gameState.mapGroup.add(rail);
      });
    });
    const sandFringe = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xe8d29a }),
    );
    sandFringe.rotation.x = -Math.PI / 2;
    sandFringe.position.set(5, 0.01, -7.1);
    gameState.mapGroup.add(sandFringe);
    for (let i = 0; i < 6; i++) {
      const bx = hash2(i * 5.1, 2.2),
        bz = hash2(i * 2.7, 6.6);
      const boulder = makeStone(bx * 11, -6.2 - bz * 1.5, bx);
      boulder.scale.setScalar(1.4 + bz * 1.8);
      gameState.mapGroup.add(boulder);
    }
    // 北海只露出約三格深的動態海帶，後方留給天空／夜空；右端與東海重疊。
    // 西緣原本停在 x=-2.5，遠山/西側緩衝帶蓋不到那麼北的緯度，從西北角
    // 看過去會看到一塊藍色矩形在星空裡硬生生切一刀。東緣（跟東海融合
    // 那端）維持不動，只把西緣大幅延伸，藏到遠山背景範圍之外
    const northSeaEastX = LAYOUT.coast.rampX + LAYOUT.coast.rampWidth - 0.5;
    const northSeaWestX = -15;
    const northSeaWidth = northSeaEastX - northSeaWestX;
    const northSeaDepth = 3.2;
    const northSeaNearZ = NORTH_CLIFF_Z - 0.2;
    const northSeaCenterX = (northSeaEastX + northSeaWestX) / 2;
    const sgGeo = new THREE.PlaneGeometry(northSeaWidth, northSeaDepth, 30, 8);
    sgGeo.rotateX(-Math.PI / 2);
    const sgPos = sgGeo.attributes.position;
    const sgBase = new Float32Array(sgPos.count * 3);
    const sgColors = new Float32Array(sgPos.count * 3);
    const near = new THREE.Color(0x4a90c8),
      far = new THREE.Color(0x9fc4dd);
    // 保持北海帶的岸線筆直；東北角不再把頂點往南拉成圓弧海灣。
    for (let i = 0; i < sgPos.count; i++) {
      const t = Math.min(
        1,
        Math.max(0, (northSeaDepth / 2 - sgPos.getZ(i)) / northSeaDepth),
      );
      const worldX = sgPos.getX(i) + northSeaCenterX;
      const eastMixRaw = Math.max(
        0,
        Math.min(1, (worldX - (LAYOUT.coast.rampX - 2)) / 7),
      );
      const eastMix = eastMixRaw * eastMixRaw * (3 - 2 * eastMixRaw);
      sgBase[i * 3] = sgPos.getX(i);
      sgBase[i * 3 + 1] = sgPos.getY(i);
      sgBase[i * 3 + 2] = sgPos.getZ(i);
      const c = near
        .clone()
        .lerp(far, t)
        .lerp(new THREE.Color(0x2f6fae), eastMix);
      sgColors[i * 3] = c.r;
      sgColors[i * 3 + 1] = c.g;
      sgColors[i * 3 + 2] = c.b;
    }
    sgGeo.setAttribute("color", new THREE.BufferAttribute(sgColors, 3));
    sgGeo.userData = {
      basePositions: sgBase,
      baseColors: sgColors.slice(),
    };
    // 海面本身保留半透明波光；下方這片不透明深海層只負責顏色深度感，
    // 跟草地/港區地板同一套修法（transparent+opacity:1+depthWrite:false+
    // renderOrder），星空才穿得過去，不是靠這片「擋住」星星。
    const northSeaMask = new THREE.Mesh(
      new THREE.PlaneGeometry(northSeaWidth + 0.4, northSeaDepth + 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x245574,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    northSeaMask.rotation.x = -Math.PI / 2;
    northSeaMask.position.set(
      northSeaCenterX,
      0.025,
      northSeaNearZ - northSeaDepth / 2,
    );
    northSeaMask.receiveShadow = true;
    northSeaMask.renderOrder = 2;
    gameState.mapGroup.add(northSeaMask);
    waterSkyUnderlayMaterials.push(
      northSeaMask.material as THREE.MeshStandardMaterial,
    );

    gameState.seaGlimpseMesh = new THREE.Mesh(
      sgGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.23,
        metalness: 0.08,
        transparent: true,
        // 這是同一片北邊主海域的遠景，深度定位跟 oceanMesh 一致，幾乎不透明。
        opacity: 0.88,
        side: THREE.DoubleSide,
      }),
    );
    waterSurfaceMaterials.push(
      gameState.seaGlimpseMesh.material as THREE.MeshStandardMaterial,
    );
    gameState.seaGlimpseMesh.position.set(
      northSeaCenterX,
      0.13,
      northSeaNearZ - northSeaDepth / 2,
    );
    gameState.mapGroup.add(gameState.seaGlimpseMesh);

    // 北海與東海的接縫用一座天然玄武岩岬角遮住，造型參考城崎海岸的
    // 柱狀節理；由北側懸崖向東南伸入海中，低處另有碎浪包住礁腳。
    gameState.mapGroup.add(
      makeBasaltHeadland(northCliffEndX - 0.35, NORTH_CLIFF_Z - 0.12),
    );

    // 牡蠣養殖架——牧場自家海灘，跟沙灘/海一樣是低地(不掛在
    // plateauGroup 下面)，Y 軸用 groundY() 算，跟其他低地裝飾同一套。
    // makeOysterRack() 現在回傳 {group, glowMat}(跟 makeLamp() 回傳
    // {group, light, bulbMat} 同一招)，glowMat 存進 gameState 讓
    // animate() 依「今天採過了嗎」調亮暗——每次重建地圖都要重設一次，
    // 不然切地圖再切回來會抓到已經丟棄的舊材質物件。
    gameState.oysterGlowMat = null;
    const oysterRack = makeOysterRack(
      OYSTER_RACK_VISUAL.x,
      OYSTER_RACK_VISUAL.z,
    );
    oysterRack.group.position.y = groundY(
      OYSTER_RACK_VISUAL.x,
      OYSTER_RACK_VISUAL.z,
    );
    gameState.mapGroup.add(oysterRack.group);
    gameState.oysterGlowMat = oysterRack.glowMat;

    // 女神祠堂步道——墊高浮出海面的沙洲，不是逐格貼平的沙灘(那段已在
    // 上面的 tile===8 迴圈裡跳過)，這裡一次蓋掉整段。
    gameState.mapGroup.add(makeShrinePathCauseway());

    // 固定在高台上的東西(建築、農地、湖、牧草、遠山)統一掛在這個群組下面，
    // 整組往上抬 PLATEAU_Y，不用逐一調整每個物件的座標
    plateauGroup = new THREE.Group();
    plateauGroup.position.y = PLATEAU_Y;
    gameState.mapGroup.add(plateauGroup);
  } else if (mapName === "port") {
    // 港區使用石板廣場底板；北緣 tile 8 仍在下方逐格呼叫共用 makeSand()，
    // 因此與生活區沙灘保持同一套顏色與低模表面。港區的碼頭/樓梯材質都是
    // 正常寫深度的 opaque 材質，沒有 oldVillage terraceMat 那種
    // depthWrite:false 的台地，所以整片底板可以直接套 starSafe，不用分塊。
    addMapFloorPatch({
      width: cols,
      depth: rows,
      color: 0xb8aa91,
      roughness: 0.96,
      starSafe: true,
    });
    plateauGroup.add(makePortScene());
  } else {
    // oldVillage 這類獨立小地圖：跟 house 一樣是純平地，沒有懸崖/
    // 沙灘的高低差，plateauGroup 維持等於 gameState.mapGroup，不用另外墊高。
    if (mapName === "oldVillage") {
      // 城鎮本體(terraceMat 石質台地/步道蓋著的範圍)跟南側新沙灘/海、西側
      // 新沙灘/海分三塊蓋，靠 x/z 分界銜接——見 addMapFloorPatch 內註解，
      // 城鎮本體這塊絕對不能套 starSafe，套了會把 terraceMat 的石質地板/
      // 步道整片蓋成草地色(這正是「城鎮的石質地板跟步道不見了」的成因)。
      // 只有沒有 terraceMat 覆蓋的裸露沙灘/海(南側、西側)才需要星空穿透。
      // townWestX 是城鎮乾地的西緣，西側新沙灘(x<townWestX)整欄不管 z、
      // 全部歸西沙灘那塊(含西南角，跟南沙灘接壤的部分)，城鎮本體/南沙灘
      // 只需要再依 beachZ 切一刀，三塊剛好無縫拼滿整張地圖，互不重疊。
      const beachZ = LAYOUT.oldVillage.southBeach.z;
      const townWestX =
        LAYOUT.oldVillage.westBeach.x + LAYOUT.oldVillage.westBeach.width;
      const groundColor = getSeasonGrassTone().ground;
      const townFloorMat = addMapFloorPatch({
        x: townWestX,
        width: cols - townWestX,
        depth: beachZ,
        color: groundColor,
        roughness: 1,
      });
      const seaFloorMat = addMapFloorPatch({
        x: townWestX,
        z: beachZ,
        width: cols - townWestX,
        depth: rows - beachZ,
        color: groundColor,
        roughness: 1,
        starSafe: true,
      });
      const westBeachFloorMat = addMapFloorPatch({
        width: townWestX,
        depth: rows,
        color: groundColor,
        roughness: 1,
        starSafe: true,
      });
      // 之前這片地板沒登記進 seasonalGroundMaterials，導致舊城鎮/藝術村這類
      // 地圖的草地永遠停在建圖當下那個季節色，換季也不會跟著變——跟
      // livingArea 共用同一份季節色表跟登記表，才不會兩邊各自維護一份判斷。
      seasonalGroundMaterials.push(
        townFloorMat,
        seaFloorMat,
        westBeachFloorMat,
      );
    } else if (mapName === "stalactiteCave") {
      // 洞窟內部地板刻意不登記進 seasonalGroundMaterials——室內看不到
      // 天空，不該跟著戶外季節變色。改用當前樓層的礦石階層色跟基底岩灰
      // 混一點，樓層越深地板越偏該階層色，是「往下走氣氛在變」的其中
      // 一個線索(另外兩個是牆體色跟樓梯平台色，見下面對應位置)。
      const mineFloorTier =
        ORE_TIERS[mineTierForFloor(gameState.mineFloor) - 1];
      const mineFloorColor = new THREE.Color(0x3a3d38).lerp(
        new THREE.Color(mineFloorTier.color),
        0.16,
      );
      // 玩家又反饋一次：搞錯方向，其實是要往下爬，模組改回原樣——下樓梯
      // 那一格真的挖空(makeMinePitRecess 補洞壁/坑底)，上樓梯改回疊高
      // 箱子(不挖地板)。地板拆成「洞口那一整排」+「其餘兩排」三塊拼接，
      // 跟舊城鎮沙灘/海分三塊蓋同一種手法(見 addMapFloorPatch 開頭註解)；
      // 最底層(第 25 層)沒有下樓梯，照舊整片鋪。
      const mineDownPit = mineDownStairs(gameState.mineFloor);
      if (mineDownPit) {
        if (mineDownPit.z > 0) {
          addMapFloorPatch({
            x: 0,
            z: 0,
            width: cols,
            depth: mineDownPit.z,
            color: mineFloorColor,
            roughness: 1,
          });
        }
        if (mineDownPit.z < rows - 1) {
          addMapFloorPatch({
            x: 0,
            z: mineDownPit.z + 1,
            width: cols,
            depth: rows - mineDownPit.z - 1,
            color: mineFloorColor,
            roughness: 1,
          });
        }
        if (mineDownPit.x > 0) {
          addMapFloorPatch({
            x: 0,
            z: mineDownPit.z,
            width: mineDownPit.x,
            depth: 1,
            color: mineFloorColor,
            roughness: 1,
          });
        }
        if (mineDownPit.x < cols - 1) {
          addMapFloorPatch({
            x: mineDownPit.x + 1,
            z: mineDownPit.z,
            width: cols - mineDownPit.x - 1,
            depth: 1,
            color: mineFloorColor,
            roughness: 1,
          });
        }
      } else {
        addMapFloorPatch({
          width: cols,
          depth: rows,
          color: mineFloorColor,
          roughness: 1,
        });
      }
    } else if (mapName !== "mountain") {
      const groundMat = addMapFloorPatch({
        width: cols,
        depth: rows,
        color: getSeasonGrassTone().ground,
        roughness: 1,
      });
      seasonalGroundMaterials.push(groundMat);
    }
    if (mapName === "oldVillage") {
      plateauGroup.add(makeOldVillageStalactiteCaveEntrance());
      // 洞窟岩石後面補一片實心山峰，擋住鏡頭縮小時「石頭後面其實是空的」
      // 穿幫——makeOldVillageStalactiteCaveEntrance() 只在洞口周圍散低矮
      // 石頭(最高約 2.7)，沒有真的堆出山體量感，鏡頭拉遠一看石頭群後面
      // 就是空地/地圖邊界。這裡借用跟下面 mapName === "livingArea" 那段
      // 西側山脈同一套 makeMountain() 圓錐堆疊手法：沿洞窟寬度交錯排成
      // 多排，往北(z 變小，也就是玩家站在洞口往裡看過去的「後面」)堆約
      // 10 格深，前排矮、越往深處越高，做出一路往上升起的山勢；純視覺
      // 塞背景，跟 tile/collision 完全無關，不影響任何走位判定。
      {
        const cave = LAYOUT.oldVillage.stalactiteCave;
        const CAVE_BACKDROP_ROWS = 4;
        const CAVE_BACKDROP_DEPTH = 10;
        const backdropWidth = cave.width + 2;
        const backdropColumns = Math.ceil(backdropWidth / 1.6);
        for (let row = 0; row < CAVE_BACKDROP_ROWS; row++) {
          for (let col = 0; col <= backdropColumns; col++) {
            const s = hash2(
              col * 4.1 + row * 7.3 + 11,
              row * 2.6 + col * 1.1 + 5,
            );
            const bx =
              cave.x -
              1 +
              (col + (row % 2) * 0.5) * (backdropWidth / backdropColumns);
            const bz =
              cave.z -
              1 -
              (row / (CAVE_BACKDROP_ROWS - 1)) * (CAVE_BACKDROP_DEPTH - 1) -
              s * 1.3;
            const height = 2.6 + s * 2.4 + row * 0.6;
            plateauGroup.add(makeMountain(bx, bz, height, s));
          }
        }
      }
      const terraceMat = new THREE.MeshStandardMaterial({
        color: 0x8f8779,
        roughness: 0.98,
        depthWrite: false,
      });
      // 從地面(y=0)一路實心蓋到 elevation，不是只有一片薄薄的頂面——
      // 之前只做 0.18 厚的浮板，頂面高度沒錯，但浮板底下到地面之間
      // 完全沒有東西填滿，鏡頭有角度時會直接看穿那個空隙看到背景，
      // 讀起來像一塊脫離地面、穿模飄浮的灰色方塊。實心方塊從地面
      // 蓋到頂，側面本身就是懸崖面，不會露出下面的空洞。
      const addTerrace = (
        z,
        depth,
        elevation,
        xStart = 0,
        width = LAYOUT.oldVillage.terraces.westEdge + 0.5,
      ) => {
        const terrace = new THREE.Mesh(
          new THREE.BoxGeometry(width, elevation, depth),
          terraceMat,
        );
        terrace.position.set(
          xStart + (width - 1) / 2,
          elevation / 2,
          z + (depth - 1) / 2,
        );
        terrace.receiveShadow = true;
        terrace.castShadow = true;
        terrace.renderOrder = 1;
        gameState.mapGroup.add(terrace);
      };
      // townWestX：城鎮本體(乾地)實際的西緣——西側新沙灘(x=0~29)加入之後，
      // 原本這裡一路寫死的 0/3 這幾個西緣魔術數字全部不再等於地圖真正的
      // 西界，改成從 westBeach 推導，才不會跟沙灘重疊蓋出一塊浮在海面上
      // 的台地方塊。
      const townWestX =
        LAYOUT.oldVillage.westBeach.x + LAYOUT.oldVillage.westBeach.width;
      addTerrace(
        0,
        10,
        LAYOUT.oldVillage.terraces.upper.elevation,
        townWestX,
        LAYOUT.oldVillage.terraces.westEdge + 0.5 - townWestX,
      );
      addTerrace(
        10,
        10,
        LAYOUT.oldVillage.terraces.middle.elevation,
        townWestX,
        LAYOUT.oldVillage.terraces.westEdge + 0.5 - townWestX,
      );
      // 廣場往東(x>westEdge)墊到 groundElevation 之後，跟西側台地一樣需要
      // 一塊實心地基撐住，不然懸空的路面/建築會露出下面的空洞。分三塊蓋，
      // 刻意避開 westStairs 最後一段(z19~26，middle→廣場的樓梯)：
      // 那段樓梯自己的階梯 box 已經是實心幾何，這裡如果整塊蓋過去，樓梯的
      // 台階會被同高的平面台地穿插/蓋住，看起來像樓梯壞掉、高低層次錯亂
      // (這正是最近一次回報「第二層樓梯怪怪的」的成因)。
      //   1) 東側廣場(z0~19，西側同一段已經是 upper/middle 台地，不用重疊)
      //   2) 南側 z20~26，略過樓梯佔用的西緣三格
      //   3) 南側 z27~29(樓梯已經結束，這段鋪到城鎮西緣即可，不能再鋪進
      //      西側新沙灘，所以西緣改成 townWestX，不是地圖真正的 x=0)
      // 三塊都跟 middle 台地同高(groundElevation===middle.elevation)，
      // 接縫處同高、不會露出高低差。
      const groundElevation = LAYOUT.oldVillage.groundElevation;
      // Box A 西緣改到樓梯本身的終點(跟 plazaStairs.toX 對齊)，不是
      // westEdge——plazaStairs 最後 0.5 格原本會跟這塊台地重疊，同一種
      // 問題，一併修掉。
      const plazaStairsEndX = LAYOUT.oldVillage.plazaStairs[0].toX;
      addTerrace(
        0,
        20,
        groundElevation,
        plazaStairsEndX,
        LAYOUT.oldVillage.width - plazaStairsEndX,
      );
      addTerrace(
        20,
        7,
        groundElevation,
        townWestX + 3,
        LAYOUT.oldVillage.width - (townWestX + 3),
      );
      addTerrace(
        27,
        3,
        groundElevation,
        townWestX,
        LAYOUT.oldVillage.width - townWestX,
      );
      const mountainLanding = LAYOUT.oldVillage.mountainLanding;
      const mountainLandingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          mountainLanding.width,
          mountainLanding.elevation,
          mountainLanding.depth,
        ),
        terraceMat,
      );
      mountainLandingMesh.position.set(
        mountainLanding.x + (mountainLanding.width - 1) / 2,
        mountainLanding.elevation / 2,
        mountainLanding.z + (mountainLanding.depth - 1) / 2,
      );
      mountainLandingMesh.receiveShadow = true;
      mountainLandingMesh.castShadow = true;
      mountainLandingMesh.renderOrder = 1;
      gameState.mapGroup.add(mountainLandingMesh);

      const stairTopMats = [0xcdbf9d, 0x918472].map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            roughness: 0.96,
          }),
      );
      const stairSideMat = new THREE.MeshStandardMaterial({
        color: 0x625b54,
        roughness: 1,
      });
      LAYOUT.oldVillage.plazaStairs.forEach((stair) => {
        const stepDepth = (stair.toX - stair.fromX) / stair.steps;
        for (let step = 0; step < stair.steps; step++) {
          const height = ((step + 1) / stair.steps) * stair.elevation;
          const topMat = stairTopMats[step % stairTopMats.length];
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(stepDepth, height, stair.width),
            [
              stairSideMat,
              stairSideMat,
              topMat,
              stairSideMat,
              stairSideMat,
              stairSideMat,
            ],
          );
          mesh.position.set(
            stair.toX - (step + 0.5) * stepDepth,
            (stair.baseElevation || 0) + height / 2,
            stair.z + (stair.width - 1) / 2,
          );
          mesh.receiveShadow = true;
          mesh.castShadow = true;
          mesh.renderOrder = 2;
          gameState.mapGroup.add(mesh);
        }
      });
      LAYOUT.oldVillage.westStairs.forEach((stair) => {
        const stepDepth = (stair.toZ - stair.fromZ) / stair.steps;
        for (let step = 0; step < stair.steps; step++) {
          const height = ((step + 1) / stair.steps) * stair.elevation;
          const topMat = stairTopMats[step % stairTopMats.length];
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(stair.width, height, stepDepth),
            [
              stairSideMat,
              stairSideMat,
              topMat,
              stairSideMat,
              stairSideMat,
              stairSideMat,
            ],
          );
          mesh.position.set(
            stair.x + (stair.width - 1) / 2,
            stair.baseElevation + height / 2,
            stair.toZ - (step + 0.5) * stepDepth,
          );
          mesh.receiveShadow = true;
          mesh.castShadow = true;
          mesh.renderOrder = 2;
          gameState.mapGroup.add(mesh);
        }
      });

      const railPostMat = new THREE.MeshStandardMaterial({ color: 0x69503a });
      const railBarMat = new THREE.MeshStandardMaterial({ color: 0x8b6846 });
      // 扶手位於平台切面交界，略抬高並關閉深度測試，避免平台表面因視角
      // 與浮點誤差把細欄杆吃掉。
      railPostMat.depthTest = false;
      railBarMat.depthTest = false;
      OLD_VILLAGE_RAILS.forEach((rail) => {
        const length = Math.hypot(rail.x2 - rail.x1, rail.z2 - rail.z1);
        const segments = Math.max(1, Math.ceil(length / 0.8));
        let previous: THREE.Vector3 | null = null;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const x = THREE.MathUtils.lerp(rail.x1, rail.x2, t);
          const z = THREE.MathUtils.lerp(rail.z1, rail.z2, t);
          // 平台外緣正好落在高度分區之外，不能用邊界座標反查高度；有指定
          // elevation 的平台欄杆直接使用所屬平台高度。
          const ground =
            rail.elevation !== undefined
              ? rail.elevation
              : oldVillageGroundY(x, z);
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.055, 0.7, 6),
            railPostMat,
          );
          post.position.set(x, ground + 0.43, z);
          post.castShadow = true;
          post.renderOrder = 5;
          gameState.mapGroup.add(post);
          const current = new THREE.Vector3(x, ground + 0.6, z);
          if (previous) {
            const delta = current.clone().sub(previous);
            const bar = new THREE.Mesh(
              new THREE.BoxGeometry(delta.length(), 0.055, 0.055),
              railBarMat,
            );
            bar.position.copy(previous).add(current).multiplyScalar(0.5);
            bar.rotation.y = -Math.atan2(delta.z, delta.x);
            bar.rotation.z = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
            bar.castShadow = true;
            bar.renderOrder = 5;
            gameState.mapGroup.add(bar);
          }
          previous = current;
        }
      });

      // 南側新沙灘的海——跟港口南沙灘(makePortScene 的 addWater)同一套
      // 「每欄水面從實際岸線後開始」寫法，避免矩形水面蓋住鋸齒沙灘。波浪
      // 動畫沿用 gameState.portWaterMeshes 同一個登記表：game-loop.ts 的
      // 更新迴圈純讀 mesh 自己的 geometry/position，跟哪張地圖建的無關，
      // 兩張地圖從不會同時載入，共用同一個陣列不會互相污染，不用另外
      // 開一份幾乎一樣的更新邏輯。
      const oldVillageWaterMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.2,
        metalness: 0.1,
        flatShading: true,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const oldVillageWaterDepthMat = new THREE.MeshStandardMaterial({
        color: 0x174968,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      waterSurfaceMaterials.push(oldVillageWaterMat);
      waterSkyUnderlayMaterials.push(oldVillageWaterDepthMat);
      const addOldVillageWater = (wx, wz, width, depth) => {
        if (depth <= 0) return;
        const geometry = new THREE.PlaneGeometry(
          width,
          depth,
          Math.max(2, Math.ceil(width)),
          Math.max(2, Math.ceil(depth)),
        );
        const colors = new Float32Array(geometry.attributes.position.count * 3);
        for (let i = 0; i < geometry.attributes.position.count; i++)
          colors.set([0.18, 0.43, 0.68], i * 3);
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const depthMask = new THREE.Mesh(
          geometry.clone(),
          oldVillageWaterDepthMat,
        );
        depthMask.rotation.x = -Math.PI / 2;
        depthMask.position.set(
          wx + (width - 1) / 2,
          0.025,
          wz + (depth - 1) / 2,
        );
        depthMask.receiveShadow = true;
        gameState.mapGroup.add(depthMask);
        const water = new THREE.Mesh(geometry, oldVillageWaterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.set(wx + (width - 1) / 2, 0.09, wz + (depth - 1) / 2);
        water.receiveShadow = true;
        geometry.userData.basePositions = Float32Array.from(
          geometry.attributes.position.array,
        );
        gameState.portWaterMeshes.push(water);
        gameState.mapGroup.add(water);
      };
      // 直接由最終 tile 9 掃描水面。先前南海、西海與切除區各畫一批透明
      // water mesh，重疊處會變成淺藍矩形殘影；現在每列連續海格只生成一次，
      // 水面、碰撞與不規則岸線自然共用 MAPS 的同一份結果。
      for (let z = 0; z < MAPS.oldVillage.tiles.length; z++) {
        const row = MAPS.oldVillage.tiles[z];
        let x = 0;
        while (x < row.length) {
          if (row[x] !== 9) {
            x++;
            continue;
          }
          const startX = x;
          while (x < row.length && row[x] === 9) x++;
          addOldVillageWater(startX, z, x - startX, 1);
        }
      }

      // 舊城鎮的南岸與西岸共用生活區的「衝上岸→碎開→退回」浪花模型。
      // 端點只用 LAYOUT 算範圍，真正落點仍從最終 tile 8/9 鄰接邊界取得。
      const southFoamStartX = oldVillageWestBeachStartX(
        LAYOUT.oldVillage.westBeach.z + 1,
      );
      const southFoamEndX =
        LAYOUT.oldVillage.southBeach.x +
        LAYOUT.oldVillage.southBeach.width -
        2;
      const southFoamEndZ = oldVillageSouthBeachEndZ(southFoamEndX);
      for (let x = southFoamStartX; x <= southFoamEndX; x += 2) {
        const shoreZ = findSouthernShoreSandZ(
          MAPS.oldVillage.tiles,
          x,
          LAYOUT.oldVillage.southBeach.z,
          southFoamEndZ,
        );
        if (shoreZ === null) continue;
        const foam = makeFoam(x, shoreZ + 0.65, 1200 + x * 1.37, {
          waveDirection: SOUTH_SEA_WAVE_DIRECTION,
          rotationY: Math.PI / 2,
        });
        foamMeshes.push(foam);
        gameState.mapGroup.add(foam);
      }
      for (
        let z = LAYOUT.oldVillage.westBeach.z + 1;
        z <= southFoamEndZ;
        z += 2
      ) {
        const shoreX = findWesternShoreSandX(
          MAPS.oldVillage.tiles,
          z,
          LAYOUT.oldVillage.westBeach.x,
          LAYOUT.oldVillage.westBeach.x +
            LAYOUT.oldVillage.westBeach.width -
            1,
        );
        if (shoreX === null) continue;
        const foam = makeFoam(shoreX - 0.65, z, 1500 + z * 1.37, {
          waveDirection: WEST_SEA_WAVE_DIRECTION,
        });
        foamMeshes.push(foam);
        gameState.mapGroup.add(foam);
      }
    } else if (mapName === "mountain") {
      const mountain = LAYOUT.mountain;
      const cliffMat = new THREE.MeshStandardMaterial({
        color: 0x514a3f,
        roughness: 1,
        flatShading: true,
        side: THREE.DoubleSide,
      });
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0x78945a,
        roughness: 0.98,
        side: THREE.DoubleSide,
      });
      mountainSeasonalMaterials.push(
        {
          material: grassMat,
          baseColor: 0x78945a,
          winterColor: 0xf1f5f7,
          // 山區草地跟其他草地共用同一張全域秋色表，不是這裡另外挑一個秋色——
          // 之前漏了這欄，山頂草地換季時樹葉變紅了、地板還是夏天的綠。
          autumnColor: SEASON_GRASS_TONES.autumn.ground,
        },
        { material: cliffMat, baseColor: 0x514a3f, winterColor: 0xd9e1e6 },
      );
      const mountainRailPostMat = new THREE.MeshStandardMaterial({
        color: 0x5f4935,
        roughness: 0.95,
      });
      const mountainRailBarMat = new THREE.MeshStandardMaterial({
        color: 0x9b7650,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      const railHeight = 0.72;
      const addMountainRailSegment = (
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        addPost = true,
      ) => {
        if (addPost) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.065, railHeight, 6),
            mountainRailPostMat,
          );
          post.position.set(ax, ay + railHeight / 2, az);
          post.castShadow = true;
          post.renderOrder = 11;
          gameState.mapGroup.add(post);
        }
        const start = new THREE.Vector3(ax, ay + railHeight, az);
        const end = new THREE.Vector3(bx, by + railHeight, bz);
        const delta = end.clone().sub(start);
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(delta.length(), 0.085, 0.085),
          mountainRailBarMat,
        );
        bar.position.copy(start).add(end).multiplyScalar(0.5);
        bar.quaternion.setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          delta.clone().normalize(),
        );
        bar.castShadow = true;
        bar.renderOrder = 11;
        gameState.mapGroup.add(bar);
      };
      const mountainPositions: number[] = [];
      const mountainColors: number[] = [];
      const mountainIndices: number[] = [];
      const summitLeft = mountain.summit.x - 0.5;
      const summitRight = mountain.summit.x + mountain.summit.width - 0.5;
      const summitNorth = mountain.summit.z - 0.5;
      const summitSouth = mountain.summit.z + mountain.summit.depth - 0.5;
      const waistLeft = mountain.waist.x - 0.5;
      const waistRight = mountain.waist.x + mountain.waist.width - 0.5;
      const waistNorth = mountain.waist.z - 0.5;
      const waistSouth = mountain.waist.z + mountain.waist.depth - 0.5;
      const footLeft = mountain.foot.x - 0.5;
      const footRight = mountain.foot.x + mountain.foot.width - 0.5;
      const footNorth = mountain.foot.z - 0.5;
      const footSouth = mountain.foot.z + mountain.foot.depth - 0.5;
      const worldLeft = -8;
      const worldRight = mountain.width + 7;
      const summitY = mountain.summit.elevation + 0.08;
      const waistY = mountain.waist.elevation + 0.08;
      const footY = mountain.foot.elevation + 0.08;

      // 舊版每段斜面只用「四角雙線性插值 + 中央一個 edgeFade 拱起」，不管
      // 隆起量調多大，整片看起來都還是一塊平滑的斜面（一個包子貼在方形
      // 斜坡上），這才是「很方」的真正原因——斜坡本身的大形狀還是四角
      // 決定的矩形。這一版改成：緊貼鄰接面（平台邊、樓梯缺口、相鄰斜面）
      // 的那幾邊維持 0 隆起（貼合、不露縫），但只要有一邊是「地圖外緣的
      // 自由邊」（worldLeft/worldRight、地圖最北/最南），隆起就直接開到底、
      // 而且用好幾組不同頻率、不同相位的稜線疊加（不是單一中央凸起），
      // 才會在自由邊那一側長出好幾座斷斷續續的山頭，不是一片平滑斜面。
      const axisOpen = (t: number, free1: boolean, free2: boolean) => {
        // t=0 端若不是自由邊（free1=false），要在靠近 t=0 的地方壓回 0，
        // 貼合鄰接面；t=1 端同理看 free2。兩邊都自由就整段開好開滿。
        const startFactor = free1 ? 1 : Math.min(1, t / 0.15);
        const endFactor = free2 ? 1 : Math.min(1, (1 - t) / 0.15);
        return Math.min(startFactor, endFactor);
      };
      const addMountainSlope = (
        x1: number,
        x2: number,
        z1: number,
        z2: number,
        y00: number,
        y10: number,
        y01: number,
        y11: number,
      ) => {
        const freeX1 = x1 === worldLeft;
        const freeX2 = x2 === worldRight;
        const freeZ1 = z1 === -9;
        const freeZ2 = z2 === mountain.height + 8;
        const xSegments = Math.max(8, Math.ceil(Math.abs(x2 - x1) / 0.9));
        const zSegments = Math.max(8, Math.ceil(Math.abs(z2 - z1) / 0.9));
        const base = mountainPositions.length / 3;
        // 每段斜面自己的雜訊/相位種子，避免不同段落的稜線花紋重複、或
        // 左右兩側鏡射出完全對稱的山頭。
        const seedX = x1 * 3.7 + z1 * 1.3;
        const seedZ = z1 * 4.1 - x1 * 0.9;
        const phaseA = hash2(seedX, 5.1) * Math.PI * 2;
        const phaseB = hash2(seedZ, 9.7) * Math.PI * 2;
        const freqA = 4.5 + hash2(seedX, 2.2) * 3;
        const freqB = 3.5 + hash2(seedZ, 6.4) * 3;
        for (let iz = 0; iz <= zSegments; iz++) {
          const tz = iz / zSegments;
          const zOpen = axisOpen(tz, freeZ1, freeZ2);
          for (let ix = 0; ix <= xSegments; ix++) {
            const tx = ix / xSegments;
            const x = THREE.MathUtils.lerp(x1, x2, tx);
            const z = THREE.MathUtils.lerp(z1, z2, tz);
            const north = THREE.MathUtils.lerp(y00, y10, tx);
            const south = THREE.MathUtils.lerp(y01, y11, tx);
            const baseY = THREE.MathUtils.lerp(north, south, tz);
            const xOpen = axisOpen(tx, freeX1, freeX2);
            const envelope = xOpen * zOpen;
            // 兩組不同頻率/相位的稜線疊加，才會沿著自由邊斷斷續續冒出好幾
            // 座山頭，而不是單一一個中央凸起；再加一點細碎雜訊做岩面粗糙感。
            const ridgeA =
              Math.sin(tx * freqA + phaseA) *
              Math.cos(tz * freqB * 0.7 + phaseB) *
              0.72;
            const ridgeB =
              Math.cos(tx * freqB + phaseB) *
              Math.sin(tz * freqA * 0.6 + phaseA) *
              0.46;
            const jitter =
              (hash2(ix * 7.3 + seedX, iz * 6.1 + seedZ) - 0.5) * 0.42;
            const roundedBulge =
              Math.sin(tx * Math.PI) * Math.sin(tz * Math.PI) * 0.9;
            const relief =
              Math.pow(envelope, 0.72) * (0.42 + ridgeA + ridgeB + jitter) +
              roundedBulge;
            const y = baseY + relief;
            mountainPositions.push(x, y, z);
            const shade = new THREE.Color(0x555b53).lerp(
              new THREE.Color(0x7d8070),
              Math.max(0, Math.min(1, 0.28 + envelope * 0.5 + jitter * 0.2)),
            );
            mountainColors.push(shade.r, shade.g, shade.b);
          }
        }
        const rowLength = xSegments + 1;
        for (let iz = 0; iz < zSegments; iz++) {
          for (let ix = 0; ix < xSegments; ix++) {
            const a = base + iz * rowLength + ix;
            const b = a + 1;
            const c = a + rowLength;
            const d = c + 1;
            if ((ix + iz) % 2) mountainIndices.push(a, b, c, b, d, c);
            else mountainIndices.push(a, d, c, a, b, d);
          }
        }
      };

      const addMountainDome = () => {
        const xSegments = 72;
        const zSegments = 72;
        const xMin = worldLeft;
        const xMax = worldRight;
        const zMin = -9;
        const zMax = mountain.height + 8;
        const base = mountainPositions.length / 3;
        const centerX = mountain.summit.x + (mountain.summit.width - 1) / 2;
        const summitCenterZ =
          mountain.summit.z + (mountain.summit.depth - 1) / 2;
        const waistCenterZ = mountain.waist.z + (mountain.waist.depth - 1) / 2;
        const footCenterZ = mountain.foot.z + (mountain.foot.depth - 1) / 2;
        const profileAt = (z: number) => {
          if (z <= summitCenterZ) {
            const t = Math.max(
              0,
              Math.min(1, (z - zMin) / (summitCenterZ - zMin)),
            );
            return {
              height: THREE.MathUtils.lerp(0.25, summitY, t),
              halfWidth: THREE.MathUtils.lerp(5, 15, t),
            };
          }
          if (z <= waistCenterZ) {
            const t = (z - summitCenterZ) / (waistCenterZ - summitCenterZ);
            return {
              height: THREE.MathUtils.lerp(summitY, waistY, t),
              halfWidth: THREE.MathUtils.lerp(15, 19, t),
            };
          }
          if (z <= footCenterZ) {
            const t = (z - waistCenterZ) / (footCenterZ - waistCenterZ);
            return {
              height: THREE.MathUtils.lerp(waistY, footY + 0.2, t),
              halfWidth: THREE.MathUtils.lerp(19, 22, t),
            };
          }
          const t = Math.max(
            0,
            Math.min(1, (z - footCenterZ) / (zMax - footCenterZ)),
          );
          return {
            height: THREE.MathUtils.lerp(footY + 0.2, 0.05, t),
            halfWidth: THREE.MathUtils.lerp(22, 24, t),
          };
        };
        for (let iz = 0; iz <= zSegments; iz++) {
          const tz = iz / zSegments;
          const z = THREE.MathUtils.lerp(zMin, zMax, tz);
          const profile = profileAt(z);
          for (let ix = 0; ix <= xSegments; ix++) {
            const tx = ix / xSegments;
            const x = THREE.MathUtils.lerp(xMin, xMax, tx);
            const radial = Math.min(
              1,
              Math.abs(x - centerX) / profile.halfWidth,
            );
            const dome = Math.pow(Math.max(0, 1 - radial * radial), 0.48);
            const envelope = Math.sin(tx * Math.PI) * Math.sin(tz * Math.PI);
            const broad = Math.sin(x * 0.34 + z * 0.11) * 0.22;
            const broken = (hash2(ix * 5.7, iz * 8.3) - 0.5) * 0.22;
            const y = Math.max(
              -0.12,
              profile.height * dome + (broad + broken) * envelope,
            );
            mountainPositions.push(x, y, z);
            const shade = new THREE.Color(0x535a52).lerp(
              new THREE.Color(0x7b806f),
              Math.max(0, Math.min(1, 0.2 + dome * 0.58 + broken)),
            );
            mountainColors.push(shade.r, shade.g, shade.b);
          }
        }
        const rowLength = xSegments + 1;
        const shouldRender = (x: number, z: number) => {
          if (
            z >= mountain.height - 1 &&
            Math.abs(x - mountain.townGate.x) <= 1.4
          )
            return false;
          if (
            x >= mountain.width - 1 &&
            Math.abs(z - mountain.homeGate.z) <= 1.5
          )
            return false;
          const tileX = Math.round(x);
          const tileZ = Math.round(z);
          if (
            tileZ >= 0 &&
            tileZ < map.tiles.length &&
            tileX >= 0 &&
            tileX < map.tiles[0].length
          )
            return map.tiles[tileZ][tileX] === 1;
          const profile = profileAt(z);
          return Math.abs(x - centerX) < profile.halfWidth;
        };
        for (let iz = 0; iz < zSegments; iz++) {
          for (let ix = 0; ix < xSegments; ix++) {
            const tx = (ix + 0.5) / xSegments;
            const tz = (iz + 0.5) / zSegments;
            const x = THREE.MathUtils.lerp(xMin, xMax, tx);
            const z = THREE.MathUtils.lerp(zMin, zMax, tz);
            if (!shouldRender(x, z)) continue;
            const a = base + iz * rowLength + ix;
            const b = a + 1;
            const c = a + rowLength;
            const d = c + 1;
            if ((ix + iz) % 2) mountainIndices.push(a, b, c, b, d, c);
            else mountainIndices.push(a, d, c, a, b, d);
          }
        }
      };

      // 三層平台左右各是一整片連續山坡；靠平台處低，往地圖外形成高山脊。
      // 保留三層平台與樓梯，不再產生包圍平台的連續斜坡山體。
      const mountainGeometry = new THREE.BufferGeometry();
      mountainGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(mountainPositions, 3),
      );
      mountainGeometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(mountainColors, 3),
      );
      mountainGeometry.setIndex(mountainIndices);
      mountainGeometry.computeVertexNormals();
      const mountainMesh = new THREE.Mesh(
        mountainGeometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1,
          flatShading: true,
          side: THREE.DoubleSide,
          emissive: 0x11150f,
          emissiveIntensity: 0.28,
          depthWrite: false,
        }),
      );
      mountainMesh.castShadow = true;
      mountainMesh.receiveShadow = true;
      mountainMesh.renderOrder = 0;
      gameState.mapGroup.add(mountainMesh);
      // 跟生活區西側山壁（makeWesternMountainTerrain）一樣，在山壁外緣散一圈
      // 大石頭打散筆直的地圖邊界，避免整座山的最外圍看起來像切齊的方形。
      const addPlatform = (platform, bottomY: number) => {
        const segments = 48;
        const centerX = platform.x + (platform.width - 1) / 2;
        const centerZ = platform.z + (platform.depth - 1) / 2;
        const halfWidth = platform.width / 2;
        const halfDepth = platform.depth / 2;
        const positions: number[] = [centerX, platform.elevation, centerZ];
        const indices: number[] = [];
        const seed = platform.x * 0.73 + platform.z * 1.37;
        // isStairJoin 系列要先算好，才能在「生成外圈頂點」那一步直接判斷
        // 每個頂點是否落在樓梯接合區——先前的版本是頂點先照隨機外輪廓算完，
        // 樓梯缺口/裙帶收邊/方形收邊都是事後在既有頂點上做二次處理，缺口
        // 本身的邊界仍然是隨機外輪廓的一部分，跟旁邊另外貼上去的固定方形
        // 收邊（shoulderWidth）對不齊，這才是「樓梯接縫還有一點點瑕疵」
        // 真正的根源。這一版把樓梯寬度+肩寬直接烤進外圈頂點生成，接合區
        // 內完全不套用 irregularity，其餘外圈才維持原本的不規則山頭輪廓。
        const platformNorth = platform.z - 0.5;
        const platformSouth = platform.z + platform.depth - 0.5;
        const stairs = [mountain.lowerStair, mountain.upperStair];
        const shoulderWidth = 1.6;
        const isStairJoin = (x: number, z: number, sideMargin = 0) =>
          stairs.some((stair) => {
            const insideStairWidth =
              x >= stair.x - 0.52 - sideMargin &&
              x <= stair.x + stair.width - 0.48 + sideMargin;
            if (!insideStairWidth) return false;
            const joinsNorthEdge =
              z < centerZ &&
              stair.fromZ <= platformNorth + 2.5 &&
              stair.toZ >= platformNorth - 2.5;
            const joinsSouthEdge =
              z >= centerZ &&
              stair.fromZ <= platformSouth + 2.5 &&
              stair.toZ >= platformSouth - 2.5;
            return joinsNorthEdge || joinsSouthEdge;
          });
        const isStairOpening = (x: number, z: number) => isStairJoin(x, z);
        const isStairShoulder = (x: number, z: number) =>
          isStairJoin(x, z, shoulderWidth);
        // 山腳/山腰的城鎮門與山頂觀景台開口——跟樓梯開口一樣，牆面/裙帶
        // 在這個範圍內都不該生成，不然平台外圈的岩壁會整圈封死，看起來
        // 走不出去/走不上觀景台，即使 tile 碰撞其實是通的。
        // 山頂開口這裡之前是用「跟觀景台圓心的距離 < 半徑+0.35」的模糊門檻，
        // 跟觀景台自己的矩形範圍對不齊——兩套判斷各自一份公式，門檻抓得
        // 不夠準確時，summit 外圈的岩壁/裙帶還是會有一小段蓋在觀景台的
        // 實際地板範圍上，看起來像走不上去。改成直接比對觀景台矩形的
        // x 範圍(跟 mountainGroundY() 用同一組邊界)，兩邊不會再各自漂移。
        const isTransferOpening = (x: number, z: number) =>
          (platform === mountain.foot &&
            Math.hypot(x - mountain.townGate.x, z - mountain.townGate.z) <
              2.2) ||
          (platform === mountain.waist &&
            Math.hypot(x - mountain.homeGate.x, z - mountain.homeGate.z) <
              2.2) ||
          (platform === mountain.summit &&
            z < centerZ &&
            x >= mountain.summitLookout.x - 0.5 &&
            x <= mountain.summitLookout.x + mountain.summitLookout.width - 0.5);
        const isOpening = (x: number, z: number) =>
          isStairOpening(x, z) || isTransferOpening(x, z);
        // 跟樓梯的 isStairShoulder 同一個道理：開口本身(isTransferOpening)只
        // 決定牆面/扶手在哪裡不生成，但外圈頂點原本還是套用 irregularity
        // 隨機抖動，開口兩側最後一段扶手的端點就會落在抖動過的位置，跟
        // 觀景台自己那圈固定矩形扶手的端點對不上，看起來像扶手斷開一截。
        // 開口範圍外再加一點緩衝一起拉平(不抖動)，端點才會穩定貼齊觀景台。
        const isTransferOpeningShoulder = (x: number, z: number) =>
          platform === mountain.summit &&
          z < centerZ &&
          x >= mountain.summitLookout.x - 1.5 &&
          x <= mountain.summitLookout.x + mountain.summitLookout.width + 1.5;
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dz = Math.sin(angle);
          const rectangleRadius =
            1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dz) / halfDepth);
          const flatX = centerX + dx * rectangleRadius;
          const flatZ = centerZ + dz * rectangleRadius;
          // 樓梯接合區（含肩寬緩衝）跟山頂觀景台開口（含緩衝）都直接用未加
          // 抖動的矩形邊界；區外才套用不規則抖動的山頭輪廓。
          if (
            isStairShoulder(flatX, flatZ) ||
            isTransferOpeningShoulder(flatX, flatZ)
          ) {
            positions.push(flatX, platform.elevation, flatZ);
            continue;
          }
          const irregularity =
            1.1 +
            Math.sin(angle * 3 + seed) * 0.045 +
            Math.sin(angle * 7 - seed * 0.6) * 0.035 +
            (hash2(i * 3.17, seed) - 0.5) * 0.05;
          positions.push(
            centerX + dx * rectangleRadius * irregularity,
            platform.elevation,
            centerZ + dz * rectangleRadius * irregularity,
          );
        }
        for (let i = 0; i < segments; i++) {
          const outerIndex = 1 + i;
          const outerX = positions[outerIndex * 3];
          const outerZ = positions[outerIndex * 3 + 2];
          const radialX = outerX - centerX;
          const radialZ = outerZ - centerZ;
          const radialLength = Math.max(0.001, Math.hypot(radialX, radialZ));
          const inset = Math.min(2.2, radialLength * 0.25);
          const innerScale = (radialLength - inset) / radialLength;
          positions.push(
            centerX + radialX * innerScale,
            platform.elevation,
            centerZ + radialZ * innerScale,
          );
        }
        for (let i = 0; i < segments; i++) {
          const topIndex = 1 + i;
          const topX = positions[topIndex * 3];
          const topZ = positions[topIndex * 3 + 2];
          const radialX = topX - centerX;
          const radialZ = topZ - centerZ;
          const radialLength = Math.max(0.001, Math.hypot(radialX, radialZ));
          // 90° 是直壁；梯地裙擺改成相對水平面 45°～60°。
          // 固定種子讓每段坡角略有差異，但每次載入都維持相同輪廓。
          // 一般邊緣維持原本 45–60° 的不規則山坡；只有樓梯接合處
          // 收成 90° 垂直，避免向外張的裙帶切進踏面。
          const skirtAngleDegrees = THREE.MathUtils.lerp(
            45,
            60,
            hash2(Math.floor(i / 3) * 2.41 + seed, seed * 4.73),
          );
          const skirtRun =
            isStairShoulder(topX, topZ) || isTransferOpening(topX, topZ)
              ? 0
              : (platform.elevation - bottomY) /
                Math.tan(THREE.MathUtils.degToRad(skirtAngleDegrees));
          positions.push(
            topX + (radialX / radialLength) * skirtRun,
            bottomY,
            topZ + (radialZ / radialLength) * skirtRun,
          );
        }
        const railSuppressed = Array.from({ length: segments }, (_, i) => {
          const next = (i + 1) % segments;
          const outerA = 1 + i;
          const outerB = 1 + next;
          const midpointX = (positions[outerA * 3] + positions[outerB * 3]) / 2;
          const midpointZ =
            (positions[outerA * 3 + 2] + positions[outerB * 3 + 2]) / 2;
          return (
            isStairShoulder(midpointX, midpointZ) ||
            isTransferOpening(midpointX, midpointZ)
          );
        });
        // 舊版這裡會另外掃一次 summit 外圈、找出跟觀景台缺口相鄰的兩個
        // transition 點，事後再用 addMountainRailSegment 把 summit 欄杆
        // 缺口跟觀景台欄杆橋接起來。現在 isTransferOpening 直接比對觀景台
        // 矩形邊界(見上面)，summit 自己的欄杆(下面 railSuppressed 那段
        // 通用邏輯)本來就會精準停在 x=lookout.x-0.5/x=lookout.x+width-0.5，
        // 跟觀景台欄杆的端點完全對齊，不再需要另外橋接一段。
        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          const innerA = 1 + segments + i;
          const innerB = 1 + segments + next;
          indices.push(0, innerB, innerA);
        }
        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          const outerA = 1 + i;
          const outerB = 1 + next;
          const innerA = 1 + segments + i;
          const innerB = 1 + segments + next;
          const midpointX = (positions[outerA * 3] + positions[outerB * 3]) / 2;
          const midpointZ =
            (positions[outerA * 3 + 2] + positions[outerB * 3 + 2]) / 2;
          if (isStairOpening(midpointX, midpointZ)) continue;
          indices.push(innerA, outerB, outerA, innerA, innerB, outerB);
        }
        const topIndexCount = indices.length;
        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          const topA = 1 + i;
          const topB = 1 + next;
          const bottomA = 1 + segments * 2 + i;
          const bottomB = 1 + segments * 2 + next;
          // 樓梯精確寬度挖開垂直樓基（實心階梯本身會補住缺口），城鎮門/
          // 觀景台開口這裡也要一併挖開——裙帶牆面之前只認樓梯，門/觀景台
          // 那圈仍然整片封死，地板雖然是通的，但視覺上像被石壁擋住走不
          // 上去；isOpening 把兩種開口都算進去才會真的看得到出口。
          if (
            isOpening(
              (positions[topA * 3] + positions[topB * 3]) / 2,
              (positions[topA * 3 + 2] + positions[topB * 3 + 2]) / 2,
            )
          )
            continue;
          indices.push(topA, bottomA, topB, topB, bottomA, bottomB);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setIndex(indices);
        geometry.clearGroups();
        geometry.addGroup(0, topIndexCount, 0);
        geometry.addGroup(topIndexCount, indices.length - topIndexCount, 1);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, [grassMat, cliffMat]);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.renderOrder = 2;
        gameState.mapGroup.add(mesh);

        for (let i = 0; i < segments; i++) {
          const next = (i + 1) % segments;
          const outerA = 1 + i;
          const outerB = 1 + next;
          const ax = positions[outerA * 3];
          const az = positions[outerA * 3 + 2];
          const bx = positions[outerB * 3];
          const bz = positions[outerB * 3 + 2];
          if (railSuppressed[i]) continue;
          addMountainRailSegment(
            ax,
            platform.elevation,
            az,
            bx,
            platform.elevation,
            bz,
          );
        }

        // 樓梯接點使用固定方形收邊，不沿用平台外圈的隨機輪廓。
        // 左右蓋片只往平台內側延伸，中央完整保留樓梯寬度的方形缺口，
        // 因此視覺接縫會精確貼齊樓梯，不再產生斜三角面。
        stairs.forEach((stair) => {
          const joinsNorthEdge =
            stair.fromZ <= platformNorth + 2.5 &&
            stair.toZ >= platformNorth - 2.5;
          const joinsSouthEdge =
            stair.fromZ <= platformSouth + 2.5 &&
            stair.toZ >= platformSouth - 2.5;
          const landingDepth = 2.4;
          const stairLeft = stair.x - 0.5;
          const stairRight = stair.x + stair.width - 0.5;
          const addSquareLanding = (edgeZ: number, inward: number) => {
            [
              stairLeft - shoulderWidth / 2,
              stairRight + shoulderWidth / 2,
            ].forEach((x) => {
              const landingShoulder = new THREE.Mesh(
                new THREE.BoxGeometry(shoulderWidth, 0.035, landingDepth),
                grassMat,
              );
              landingShoulder.position.set(
                x,
                // 外圈頂點在樓梯接合區已經是精確的 platform.elevation（無抖動、
                // 無額外偏移），這裡只留極小的 epsilon 避免跟它 z-fighting，
                // 不能再用舊的 +0.012（那個量級足以在接縫處露出一條台階）。
                platform.elevation + 0.004,
                edgeZ + (inward * landingDepth) / 2,
              );
              landingShoulder.receiveShadow = true;
              landingShoulder.renderOrder = 7;
              gameState.mapGroup.add(landingShoulder);
            });
          };
          if (joinsNorthEdge) addSquareLanding(platformNorth, 1);
          if (joinsSouthEdge) addSquareLanding(platformSouth, -1);
        });
      };
      // 三層各自都是完整梯形山體，裙擺全部延伸到鏡頭底部之外。
      const mountainSkirtBottomY = -Math.max(24, mountain.height * 0.55);
      const summitSkirtBottomY = -Math.max(42, mountain.height * 0.9);
      addPlatform(mountain.foot, mountainSkirtBottomY);
      addPlatform(mountain.waist, mountainSkirtBottomY);
      addPlatform(mountain.summit, summitSkirtBottomY);

      const lookout = mountain.summitLookout;
      const lookoutLeftX = lookout.x - 0.5;
      const lookoutRightX = lookout.x + lookout.width - 0.5;
      const lookoutNorthZ = lookout.z - 0.5;
      // 南緣精確等於 summit 北緣(summit.z-0.5=2.5，跟 mountainGroundY()/
      // isTransferOpening 用同一個邊界)，兩片地板在這裡剛好相接、中間不留
      // 裙帶也不放扶手——這正是修掉「主角無法從山頂走到觀景台」的關鍵：
      // 舊版用圓形(centerX/joinZ/radius)描述觀景台，跟 summit 本身的矩形
      // 邊界是兩組不同公式，continuous 座標移動時 mountainGroundY() 在圓形
      // 邊緣跟矩形邊緣中間有一小段(z 介於 2~2.5)兩邊公式都沒接住，直接
      // 掉回預設高度 0，跟站立處落差瞬間變成 6.5，超過 canTraverseVillageHeight()
      // 的 0.7 落差上限，移動就被擋住。現在兩邊都用同一種
      // 「x-0.5 ~ x+width-0.5」矩形寫法、邊界數字完全對齊，不會再出現這種
      // 兩份公式各自漂移出的死角。
      const lookoutSouthZ = lookout.z + lookout.depth - 0.5;
      const lookoutY = mountain.summit.elevation + 0.018;
      const lookoutWidthUnits = lookoutRightX - lookoutLeftX;
      const lookoutDepthUnits = lookoutSouthZ - lookoutNorthZ;
      const LOOKOUT_PLANK_COUNT = 6;
      const LOOKOUT_PLANK_WORLD_WIDTH = 0.5;
      const lookoutWoodTexture = makeWoodPlankTexture({
        plankCount: LOOKOUT_PLANK_COUNT,
        seed: lookout.x * 1.7 + lookout.z,
      });
      // 板子沿長邊(世界 X)方向鋪，跨短邊(世界 Z，觀景台深度)一片片排開；
      // repeat.y 抓成「深度 ÷ 每片板實際寬度」，板寬才不會隨觀景台尺寸跑掉。
      lookoutWoodTexture.repeat.set(
        lookoutWidthUnits / 3,
        lookoutDepthUnits / (LOOKOUT_PLANK_COUNT * LOOKOUT_PLANK_WORLD_WIDTH),
      );
      const lookoutWoodMat = new THREE.MeshStandardMaterial({
        map: lookoutWoodTexture,
        color: 0xffffff,
        roughness: 0.92,
        polygonOffset: true,
        polygonOffsetFactor: -7,
        polygonOffsetUnits: -7,
      });
      // 材質改用貼圖後 color 只當濾鏡，維持白色才不會把木紋貼圖染色；
      // 冬天改套一層霜白色調在貼圖上，做出積雪棧板的效果。
      mountainSeasonalMaterials.push({
        material: lookoutWoodMat,
        baseColor: 0xffffff,
        winterColor: 0xcfe0e6,
      });
      const lookoutTopGeometry = new THREE.PlaneGeometry(
        lookoutWidthUnits,
        lookoutDepthUnits,
      );
      lookoutTopGeometry.rotateX(-Math.PI / 2);
      const lookoutTopMesh = new THREE.Mesh(lookoutTopGeometry, lookoutWoodMat);
      lookoutTopMesh.position.set(
        (lookoutLeftX + lookoutRightX) / 2,
        lookoutY,
        (lookoutNorthZ + lookoutSouthZ) / 2,
      );
      lookoutTopMesh.receiveShadow = true;
      lookoutTopMesh.renderOrder = 3;
      gameState.mapGroup.add(lookoutTopMesh);

      // 北/西/東三面裙帶下探到跟其他平台一樣的懸崖底部，南面(接山頂平台)
      // 完全不建裙帶——沿用跟平台裙帶同一顆 cliffMat，不用另外註冊季節材質。
      const addLookoutSkirt = (ax, az, bx, bz) => {
        const positions = [
          ax,
          lookoutY,
          az,
          bx,
          lookoutY,
          bz,
          bx,
          summitSkirtBottomY,
          bz,
          ax,
          summitSkirtBottomY,
          az,
        ];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        geometry.setIndex([0, 2, 1, 0, 3, 2]);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, cliffMat);
        mesh.receiveShadow = true;
        mesh.renderOrder = 3;
        gameState.mapGroup.add(mesh);
      };
      addLookoutSkirt(
        lookoutLeftX,
        lookoutNorthZ,
        lookoutRightX,
        lookoutNorthZ,
      ); // 北緣，懸崖外緣
      addLookoutSkirt(lookoutLeftX, lookoutSouthZ, lookoutLeftX, lookoutNorthZ); // 西緣
      addLookoutSkirt(
        lookoutRightX,
        lookoutNorthZ,
        lookoutRightX,
        lookoutSouthZ,
      ); // 東緣

      // 扶手沿北/西/東三邊排列，南面(接山頂步道)開放不放扶手，跟裙帶同一個
      // 開口。summit 平台自己的外圈扶手(addPlatform 內的通用邏輯)現在會
      // 精準停在 lookoutLeftX/lookoutRightX，跟這裡的扶手端點完全對齊，
      // 不需要再另外算一段橋接扶手。
      const addLookoutRailEdge = (ax, az, bx, bz) => {
        const length = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.round(length / 1.4));
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps,
            t1 = (i + 1) / steps;
          addMountainRailSegment(
            THREE.MathUtils.lerp(ax, bx, t0),
            mountain.summit.elevation,
            THREE.MathUtils.lerp(az, bz, t0),
            THREE.MathUtils.lerp(ax, bx, t1),
            mountain.summit.elevation,
            THREE.MathUtils.lerp(az, bz, t1),
          );
        }
      };
      addLookoutRailEdge(
        lookoutLeftX,
        lookoutSouthZ,
        lookoutLeftX,
        lookoutNorthZ,
      );
      addLookoutRailEdge(
        lookoutLeftX,
        lookoutNorthZ,
        lookoutRightX,
        lookoutNorthZ,
      );
      addLookoutRailEdge(
        lookoutRightX,
        lookoutNorthZ,
        lookoutRightX,
        lookoutSouthZ,
      );

      const topMats = [0xd0b982, 0x9a835f].map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            roughness: 1,
            polygonOffset: true,
            polygonOffsetFactor: -6,
            polygonOffsetUnits: -6,
          }),
      );
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x514a3f,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      });
      topMats.forEach((material, index) =>
        mountainSeasonalMaterials.push({
          material,
          baseColor: [0xd0b982, 0x9a835f][index],
          winterColor: index === 0 ? 0xf5f7f8 : 0xe1e7ea,
        }),
      );
      mountainSeasonalMaterials.push({
        material: sideMat,
        baseColor: 0x514a3f,
        winterColor: 0xd5dde2,
      });
      [mountain.lowerStair, mountain.upperStair].forEach((stair) => {
        const depth = (stair.toZ - stair.fromZ) / stair.steps;
        for (let step = 0; step < stair.steps; step++) {
          const height = ((step + 1) / stair.steps) * stair.elevation;
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(stair.width, height, depth),
            [sideMat, sideMat, topMats[step % 2], sideMat, sideMat, sideMat],
          );
          mesh.position.set(
            stair.x + 1,
            stair.baseElevation + height / 2,
            stair.toZ - (step + 0.5) * depth,
          );
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.renderOrder = 8;
          gameState.mapGroup.add(mesh);
        }
        // 扶手略往踏面外側退，避免與方形平台收邊及階梯盒共面而被遮蔽。
        const leftX = stair.x - 0.68;
        const rightX = stair.x + stair.width - 0.32;
        [leftX, rightX].forEach((railX) => {
          for (let step = 0; step < stair.steps; step++) {
            const y1 =
              stair.baseElevation +
              (step / stair.steps) * stair.elevation +
              0.08;
            const y2 =
              stair.baseElevation +
              ((step + 1) / stair.steps) * stair.elevation +
              0.08;
            const z1 =
              stair.toZ - (step / stair.steps) * (stair.toZ - stair.fromZ);
            const z2 =
              stair.toZ -
              ((step + 1) / stair.steps) * (stair.toZ - stair.fromZ);
            addMountainRailSegment(
              railX,
              y1,
              z1,
              railX,
              y2,
              z2,
              step % 2 === 0,
            );
          }
        });
      });

      const homeStairs = mountain.homeStoneStairs;
      const homeStoneStairGroup = makeSteepStoneStairs({
        x: homeStairs.x,
        z: homeStairs.z,
        y: mountain.waist.elevation + 0.08,
        directionX: 1,
        directionZ: 0,
        steps: homeStairs.steps,
        run: homeStairs.run,
        dropPerStep: homeStairs.dropPerStep,
        width: homeStairs.width,
      });
      const homeStairMaterials = homeStoneStairGroup.userData.seasonalMaterials;
      mountainSeasonalMaterials.push(
        {
          material: homeStairMaterials.stepMat,
          baseColor: 0xaa916b,
          winterColor: 0xf0f3f5,
        },
        {
          material: homeStairMaterials.edgeMat,
          baseColor: 0x747269,
          winterColor: 0xd6dde2,
        },
      );
      gameState.mapGroup.add(homeStoneStairGroup);

      const summitCenterX =
        mountain.summit.x + Math.floor(mountain.summit.width / 2);
      const summitCenterZ =
        mountain.summit.z + Math.floor(mountain.summit.depth / 2);
      const bench = makeBench(summitCenterX - 5, summitCenterZ - 2, Math.PI);
      bench.position.y += mountain.summit.elevation;
      gameState.mapGroup.add(bench);
      const summitMarker = new THREE.Group();
      const markerStone = new THREE.MeshStandardMaterial({
        color: 0x8f8b80,
        roughness: 1,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.11, 8, 18),
        markerStone,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(
        summitCenterX + 2.5,
        mountain.summit.elevation + 0.12,
        summitCenterZ - 2.5,
      );
      summitMarker.add(ring);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.9, 6),
        markerStone,
      );
      post.position.set(
        summitCenterX + 2.5,
        mountain.summit.elevation + 0.55,
        summitCenterZ - 2.5,
      );
      summitMarker.add(post);
      gameState.mapGroup.add(summitMarker);

      // 山頂石標旁補一座小鳥居，呼應概念圖山頂那座小神社的意象；跟
      // 女神祠堂共用同一個 makeToriiGate()，不用另外做新造型。
      const summitTorii = makeToriiGate();
      summitTorii.scale.setScalar(0.75);
      summitTorii.position.set(
        summitCenterX,
        mountain.summit.elevation,
        summitCenterZ + 3.2,
      );
      gameState.mapGroup.add(summitTorii);

      // 鳥居側邊的靜態守護者角色，面朝鳥居；純裝飾，不參與互動/排程。放在
      // 鳥居正後方會被上樑在畫面上重疊擋住，改成站在旁側才看得清楚全身。
      const mountainGuardian = makeMountainGuardian();
      mountainGuardian.position.set(
        summitCenterX - 1.7,
        mountain.summit.elevation,
        summitCenterZ + 3.2,
      );
      mountainGuardian.rotation.y = -Math.PI / 2;
      gameState.mapGroup.add(mountainGuardian);

      // 山腳平台補概念圖裡的長椅+營火+木欄杆+告示牌，這輪先只放在
      // 山腳一處，不是每個平台都鋪滿——山腰/山頂已經有樹/石標/長椅
      // 撐場面，山腳這批是唯一還缺裝飾的地方。
      // 座標刻意選在步道(=)東側的草地上(x=11~17)，避開(18,36)那棵既有
      // 的樹，也不蓋在主要動線上，看起來像特地圍起來的休息角落。
      const footRestX = mountain.foot.x + Math.floor(mountain.foot.width / 2);
      const footRestZ = mountain.foot.z + Math.floor(mountain.foot.depth / 2);
      const footBench = makeBench(footRestX + 2, footRestZ, Math.PI / 2);
      footBench.position.y += mountainGroundY(footRestX + 2, footRestZ);
      gameState.mapGroup.add(footBench);
      const campfire = makeCampfireRing(footRestX, footRestZ);
      campfire.position.y += mountainGroundY(footRestX, footRestZ);
      gameState.mapGroup.add(campfire);
      const foothillFence = makeFence(
        footRestX - 3,
        footRestX + 3,
        footRestZ - 2,
        footRestZ + 3,
      );
      foothillFence.position.y += mountainGroundY(footRestX, footRestZ);
      gameState.mapGroup.add(foothillFence);
      const signpost = makeConstructionSign(
        mountain.townGate.x + 2,
        mountain.townGate.z - 3,
      );
      signpost.position.y += mountainGroundY(
        mountain.townGate.x + 2,
        mountain.townGate.z - 3,
      );
      gameState.mapGroup.add(signpost);

      // 木材/石頭採集點——放在山腳既有樹叢邊緣，呼應「山上樹木邊緣」的
      // 需求；跟生活區那批(見上面 livingArea 分支)共用同一套資料/邏輯。
      WOOD_NODES.filter((n) => n.map === "mountain").forEach((n) => {
        const pile = makeWoodPile(n.x, n.z);
        pile.position.y = mountainGroundY(n.x, n.z);
        pile.visible = !n.collected;
        gameState.mapGroup.add(pile);
        gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "mountain" });
      });
      STONE_NODES.filter((n) => n.map === "mountain").forEach((n) => {
        const pile = makeStonePile(n.x, n.z);
        pile.position.y = mountainGroundY(n.x, n.z);
        pile.visible = !n.collected;
        gameState.mapGroup.add(pile);
        gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "mountain" });
      });
    }
  }

  (map.buildings || []).forEach((b) =>
    plateauGroup.add(b.style === "barn" ? makeBarn(b) : makeBuilding(b)),
  );
  (map.placeholders || []).forEach((p) => {
    // p.wallColor 存在代表這輪升級過的完整建築(makeBuilding/makeBarn，
    // 有窗/門/煙囪)；沒有的話(目前只剩木匠事件那間空屋)維持原本的
    // 純色佔位方塊，佔地格子(tiles 裡的 1)完全不受影響。
    const townHouse =
      p.wallColor !== undefined
        ? p.style === "barn"
          ? makeBarn(p)
          : makeBuilding({
              ...p,
              visualScale:
                mapName === "oldVillage"
                  ? LAYOUT.oldVillage.houseVisualScale
                  : p.visualScale,
              doorWorldHeight:
                mapName === "oldVillage"
                  ? LAYOUT.oldVillage.houseDoorWorldHeight
                  : p.doorWorldHeight,
            })
        : makeTownPlaceholder(p.x, p.z, p.seed);
    townHouse.position.y +=
      mapName === "oldVillage" ? oldVillageGroundY(p.x, p.z) : 0;
    if (mapName === "oldVillage") {
      townHouse.traverse((child: any) => {
        if (child.isMesh) child.renderOrder = 2;
      });
    }
    plateauGroup.add(townHouse);
    // 木匠事件的空屋：不是新蓋一棟，是拿 oldVillage 既有佔位空屋之一
    // 疊視覺狀態——施工中立牌，或入住後補一顆跟其他房子同一套
    // windowMats 系統驅動的發光窗戶，晚上自動跟著 nightFactor 亮。
    if (
      mapName === "oldVillage" &&
      p.x === CARPENTER_HOUSE.x &&
      p.z === CARPENTER_HOUSE.z
    ) {
      if (
        carpenterQuest.stage === "construction" ||
        carpenterQuest.stage === "ready_for_move_in"
      ) {
        const sign = makeConstructionSign(p.x + 0.6, p.z + 0.1);
        sign.position.y += oldVillageGroundY(p.x, p.z);
        plateauGroup.add(sign);
      } else if (carpenterQuest.stage === "moved_in") {
        const winMat = new THREE.MeshStandardMaterial({
          color: 0x2b3a55,
          emissive: new THREE.Color(0xffcf7a),
          emissiveIntensity: 0,
        });
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.05),
          winMat,
        );
        win.position.set(p.x, 0.55 + oldVillageGroundY(p.x, p.z), p.z + 0.44);
        plateauGroup.add(win);
        windowMats.push(winMat);
      }
    }
  });
  if (mapName === "shrine") {
    // 佔位地標：鳥居立在入口門檻(4,5)正北邊，玩家從南側走進來會直接
    // 穿過鳥居。退潮限定的判定邏輯之後再接，這輪只確保走得到、有
    // 地方站。
    const torii = makeToriiGate();
    torii.position.set(4, 0, 3);
    plateauGroup.add(torii);
  }
  if (mapName === "stalactiteCave") {
    // 採礦系統(mine.ts)——樓層對應礦石階層(1~5)決定這裡的配色，往下走
    // 越接近自己的世界觀那兩階(星晶/神晶)。座標是房間本地格子(50x50)，
    // 跟舊城鎮那邊的洞口座標無關；洞口進來時的樓層重置在 events 表的
    // enterMine()，這裡只管「當前樓層長怎樣」。
    const mineFloor = gameState.mineFloor;
    const tier = ORE_TIERS[mineTierForFloor(mineFloor) - 1];

    // 樓梯——上樓永遠存在(第 1 層的上樓梯改成走出洞口回舊城鎮，動作在
    // events 表的 mineGoUp() 判斷樓層再決定要不要真的換地圖)；下樓在
    // MINE_FLOOR_MAX 不存在，這裡跟 tile 資料(mine.ts 的
    // makeMineFloorTiles())用同一個 mineDownStairs() 判斷，不會兜不攏。
    // 玩家反饋來回調整過兩次，最後確認：上樓梯用疊高箱子造型(不挖地板)，
    // 下樓梯用凹陷坑洞造型(direction="down"，配合上面地板挖空的同一格)。
    const up = mineUpStairs(mineFloor);
    const upStair = makeMineStaircase("up", tier.accentColor);
    upStair.position.set(up.x, 0, up.z);
    upStair.rotation.y = mineStairRotation("up");
    plateauGroup.add(upStair);
    const down = mineDownStairs(mineFloor);
    if (down) {
      // 坑洞本體(洞壁+坑底)先擺，樓梯模型疊在上面同一個位置——對應
      // 上面地板拆成三塊拼接時挖空的同一格。
      const pitRockColor = new THREE.Color(0x2a2c27).lerp(
        new THREE.Color(tier.color),
        0.12,
      );
      const pit = makeMinePitRecess(pitRockColor);
      pit.position.set(down.x, 0, down.z);
      plateauGroup.add(pit);
      const downStair = makeMineStaircase("down", tier.color);
      downStair.position.set(down.x, 0, down.z);
      downStair.rotation.y = mineStairRotation("down");
      plateauGroup.add(downStair);
    }

    // 礦石節點——跟木材/石頭同一套「靠近按 E 就沒了」的採集慣例，登記進
    // oreNodeMeshes 讓 input-save.ts 採集成功時可以直接把對應的 group
    // 藏起來，不用整層重建。
    ORE_NODES.forEach((n) => {
      const node = makeOreNode(
        n.x,
        n.z,
        tier.color,
        tier.accentColor,
        n.colorSeed,
      );
      node.visible = !n.collected;
      plateauGroup.add(node);
      oreNodeMeshes.push({ group: node, nodeId: n.id });
    });

    // 天花板垂幾根鐘乳石當氣氛裝飾，用樓層數決定性灑點(同一層每次重進
    // 都長一樣)，純視覺不擋路，避開樓梯附近讓動線乾淨。
    const decorRockMat = new THREE.MeshStandardMaterial({
      color: 0x33362f,
      roughness: 1,
      flatShading: true,
    });
    for (let i = 0; i < 26; i++) {
      const nx = hash2(mineFloor * 9.3 + i * 4.1, i * 2.2);
      const nz = hash2(i * 6.7, mineFloor * 5.1 + i * 1.3);
      const x = 3 + Math.floor(nx * (MINE_SIZE - 6));
      const z = 3 + Math.floor(nz * (MINE_SIZE - 6));
      if (Math.abs(x - up.x) + Math.abs(z - up.z) < 3) continue;
      if (down && Math.abs(x - down.x) + Math.abs(z - down.z) < 3) continue;
      const len = 0.5 + hash2(x, z) * 0.6;
      const stalactite = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 + hash2(z, x) * 0.05, len, 6),
        decorRockMat,
      );
      stalactite.rotation.z = Math.PI;
      stalactite.position.set(x, 2.3 - len / 2, z);
      stalactite.castShadow = true;
      plateauGroup.add(stalactite);
    }
  }
  if (mapName === "oldVillage") {
    // 廣場(LAYOUT.oldVillage.plaza：x=22~32,z=4~25)裡放兩盞路燈、兩張
    // 長椅，位置刻意離廣場邊界(x=22/33、跟港口門的垂直通道)有一段
    // 緩衝，不會卡到既有的門檻/道路。
    const plazaShiftX = LAYOUT.oldVillage.plaza.x - 22;
    const lamp1Pos = { x: 25 + plazaShiftX, z: 8 };
    const lamp2Pos = { x: 29 + plazaShiftX, z: 18 };
    const lamp1 = makeStreetLamp(lamp1Pos.x, lamp1Pos.z, 1);
    const lamp2 = makeStreetLamp(lamp2Pos.x, lamp2Pos.z, -1);
    // 廣場墊高到 groundElevation 之後，路燈/長椅底座也要跟著抬高，不然
    // 廣場墊高後這幾樣家具會維持在舊的 y=0，看起來像陷進地面。跟房子
    // (townHouse.position.y += oldVillageGroundY(...))同一套做法。
    lamp1.position.y += oldVillageGroundY(lamp1Pos.x, lamp1Pos.z);
    lamp2.position.y += oldVillageGroundY(lamp2Pos.x, lamp2Pos.z);
    [lamp1, lamp2].forEach((prop) =>
      prop.traverse((child: any) => {
        if (child.isMesh) child.renderOrder = 2;
      }),
    );
    plateauGroup.add(lamp1, lamp2);
    const bench1Pos = { x: 26 + plazaShiftX, z: 12 };
    const bench2Pos = { x: 30 + plazaShiftX, z: 14 };
    const bench1 = makeBench(bench1Pos.x, bench1Pos.z, 0);
    const bench2 = makeBench(bench2Pos.x, bench2Pos.z, Math.PI);
    bench1.position.y += oldVillageGroundY(bench1Pos.x, bench1Pos.z);
    bench2.position.y += oldVillageGroundY(bench2Pos.x, bench2Pos.z);
    [bench1, bench2].forEach((prop) =>
      prop.traverse((child: any) => {
        if (child.isMesh) child.renderOrder = 2;
      }),
    );
    plateauGroup.add(bench1, bench2);

    // 城鎮 10 棟房子的門口/屋頂裝飾——每個對應 LAYOUT.oldVillage.houses
    // 裡的一個 role，讓房子從外觀就看得出用途(學校/醫院/醫生/護士/
    // 老師/海洋學家/雜貨店兼行政中心/藝術家/民宿)，木匠家(role:
    // "carpenter")不在這裡處理，維持劇情自己的施工牌/發光窗戶邏輯。
    const villageHouseByRole = (role) =>
      LAYOUT.oldVillage.houses.find((h) => h.role === role);
    const villageHouseFront = (h) => ({
      centerX: h.x + (h.w - 1) / 2,
      centerZ: h.z + (h.d - 1) / 2,
      frontZ: h.z + (h.d - 1) / 2 + (h.d / 2) * 0.98,
    });

    const school = villageHouseByRole("school");
    if (school) {
      const { centerX, centerZ, frontZ } = villageHouseFront(school);
      const cupola = makeBellCupola(centerX, centerZ);
      cupola.position.y = 1.3 + 0.85 + oldVillageGroundY(centerX, centerZ);
      plateauGroup.add(cupola);
      const flagX = centerX - school.w / 2 + 0.3;
      const flagZ = frontZ + 0.35;
      const flagpole = makeFlagpole(flagX, flagZ, 1.8, 0x7a2e2e);
      flagpole.position.y += oldVillageGroundY(flagX, flagZ);
      plateauGroup.add(flagpole);
    }

    const hospital = villageHouseByRole("hospital");
    if (hospital) {
      const { frontZ } = villageHouseFront(hospital);
      const sign = makeMedicalSign(hospital.doorX, frontZ + 0.03, 0, 1.5);
      sign.position.y = 1.55 + oldVillageGroundY(hospital.doorX, frontZ);
      plateauGroup.add(sign);
    }

    [villageHouseByRole("doctor"), villageHouseByRole("nurse")].forEach(
      (house) => {
        if (!house) return;
        const { frontZ } = villageHouseFront(house);
        const signX = house.doorX + 0.45;
        const sign = makeMedicalSign(signX, frontZ + 0.02, 0, 0.7);
        sign.position.y = 0.9 + oldVillageGroundY(signX, frontZ);
        plateauGroup.add(sign);
      },
    );

    const teacher = villageHouseByRole("teacher");
    if (teacher) {
      const { frontZ } = villageHouseFront(teacher);
      const booksX = teacher.doorX + 0.5,
        booksZ = frontZ + 0.25;
      const books = makeBookStack(booksX, booksZ);
      books.position.y += oldVillageGroundY(booksX, booksZ);
      plateauGroup.add(books);
    }

    const oceanographer = villageHouseByRole("oceanographer");
    if (oceanographer) {
      const { frontZ } = villageHouseFront(oceanographer);
      const wheelX = oceanographer.doorX - 0.5;
      const wheel = makeShipWheelEmblem(wheelX, frontZ + 0.02);
      wheel.position.y = 0.85 + oldVillageGroundY(wheelX, frontZ);
      plateauGroup.add(wheel);
    }

    const generalStore = villageHouseByRole("generalStore");
    if (generalStore) {
      const { centerX, frontZ } = villageHouseFront(generalStore);
      const sign = makeHangingSignboard(
        generalStore.doorX - 0.18,
        frontZ + 0.05,
        0,
        0xd9a94a,
      );
      sign.position.y = 1.55 + oldVillageGroundY(generalStore.doorX, frontZ);
      plateauGroup.add(sign);
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(generalStore.w * TILE - 0.3, 0.06, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x2f6b63 }),
      );
      awning.rotation.x = -0.18;
      awning.position.set(
        centerX,
        1.0 + oldVillageGroundY(centerX, frontZ),
        frontZ + 0.35,
      );
      plateauGroup.add(awning);
    }

    const artist = villageHouseByRole("artist");
    if (artist) {
      const { frontZ } = villageHouseFront(artist);
      const easelX = artist.doorX - 0.55,
        easelZ = frontZ + 0.3;
      const easel = makeEasel(easelX, easelZ, 0.3);
      easel.position.y += oldVillageGroundY(easelX, easelZ);
      plateauGroup.add(easel);
    }

    const guesthouse = villageHouseByRole("guesthouse");
    if (guesthouse) {
      const { centerX, frontZ } = villageHouseFront(guesthouse);
      const sign = makeHangingSignboard(
        guesthouse.doorX - 0.18,
        frontZ + 0.05,
        0,
        0x4a3428,
      );
      sign.position.y = 1.55 + oldVillageGroundY(guesthouse.doorX, frontZ);
      plateauGroup.add(sign);
      const lanternX = centerX - guesthouse.w / 2 + 0.3;
      const lanternZ = frontZ + 0.4;
      const lantern = makeStreetLamp(lanternX, lanternZ, 1);
      lantern.scale.setScalar(0.6);
      lantern.position.y += oldVillageGroundY(lanternX, lanternZ);
      plateauGroup.add(lantern);
    }
  }
  (map.furniture || []).forEach((item) => {
    const w = item.w || 1,
      d = item.d || 1;
    const mesh = makeFurniture(item);
    mesh.position.set(item.x + (w - 1) / 2, 0, item.z + (d - 1) / 2);
    plateauGroup.add(mesh);
  });

  gameState.houseLampLight = null;
  gameState.houseLampBulbMat = null;
  if (mapName === "house") {
    const lamp = makeLamp();
    lamp.group.position.set(5, 0.45, 2); // 桌上，桌面高度約 0.45
    plateauGroup.add(lamp.group);
    gameState.houseLampLight = lamp.light;
    gameState.houseLampBulbMat = lamp.bulbMat;
  }

  avenueLeafMaterials.length = 0;
  map.tiles.forEach((row, z) => {
    row.forEach((tile, x) => {
      if (tile === 1 && mapName === "house") {
        const winEntry = (map.windows || []).find(
          (w) => w.x === x && w.z === z,
        );
        plateauGroup.add(
          makeInteriorWall(x, z, winEntry ? winEntry.side : null),
        );
      } else if (tile === 1 && mapName === "stalactiteCave") {
        // 洞窟牆體只求「看起來是石壁」，不像 house 那樣做門窗開口——
        // 純方塊+粗糙岩灰材質，跟外面洞口(makeOldVillageStalactiteCaveEntrance)
        // 同一色系但不共用材質實例(那邊有窗戶/發光邏輯，這裡不需要)。牆色
        // 也混一點當層礦石階層色，跟地板呼應。
        const mineWallTier =
          ORE_TIERS[mineTierForFloor(gameState.mineFloor) - 1];
        const mineWallColor = new THREE.Color(0x4a4d47).lerp(
          new THREE.Color(mineWallTier.color),
          0.22,
        );
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.98, 2.3, TILE * 0.98),
          new THREE.MeshStandardMaterial({
            color: mineWallColor,
            roughness: 1,
            flatShading: true,
          }),
        );
        wall.position.set(x, 1.15, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        plateauGroup.add(wall);
      } else if (tile === 2) {
        // 山腰平台(waist)這幾棵改用行道樹(makeAvenueTree)——那個模型
        // 本來就跟著季節變色(春粉紅/夏綠/秋橙紅/冬白)，剛好對應概念圖
        // 「賞櫻賞楓區域」：不用另外做櫻花/楓葉專用樹種，同一批樹春天
        // 看起來是賞櫻、秋天自然變成賞楓，比寫死單一顏色更合理。
        const isLakeShadeTree =
          mapName === "livingArea" &&
          LAKE_SHADE_TREE_TILES.some(
            ([treeX, treeZ]) => treeX === x && treeZ === z,
          );
        const m =
          mapName === "mountain" ||
          (mapName === "livingArea" &&
            (AVENUE_TREE_KEYS.has(`${x},${z}`) || isLakeShadeTree))
            ? makeAvenueTree(x, z)
            : makeTree(x, z);
        m.position.y +=
          mapName === "livingArea"
            ? groundY(x, z)
            : mapName === "mountain"
              ? mountainGroundY(x, z)
              : 0;
        if (isLakeShadeTree) {
          const bottomTree =
            LAKE_SHADE_TREE_TILES[LAKE_SHADE_TREE_TILES.length - 1];
          if (!bottomTree || bottomTree[0] !== x || bottomTree[1] !== z)
            m.position.x += LAYOUT.lake.shadeTreeVisualShiftX;
        }
        if (mapName === "mountain" && z <= 5) m.scale.setScalar(1.45);
        // 山頂中央那棵(12,5)是概念圖裡「山頂巨木」的位置，額外放大、
        // 蓋過其他山頂樹，一眼就能認出是地標。
        if (mapName === "mountain" && x === 12 && z === 5)
          m.scale.setScalar(2.3);
        gameState.mapGroup.add(m);
      } else if (tile === 3) {
        const threshold = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.9, 0.06, TILE * 0.9),
          new THREE.MeshStandardMaterial({ color: 0xf5c542 }),
        );
        threshold.position.set(
          x,
          0.03 +
            (mapName === "livingArea"
              ? groundY(x, z)
              : mapName === "oldVillage"
                ? oldVillageGroundY(x, z)
                : mapName === "port"
                  ? portGroundY(x, z)
                  : mapName === "mountain"
                    ? mountainGroundY(x, z)
                    : 0),
          z,
        );
        threshold.visible = thresholdMarkersVisible;
        thresholdMarkerMeshes.push(threshold);
        gameState.mapGroup.add(threshold);
      } else if (tile === 5) {
        const isOldVillageStair =
          mapName === "oldVillage" &&
          (LAYOUT.oldVillage.plazaStairs.some(
            (stair) =>
              x >= stair.fromX &&
              x < stair.toX &&
              z >= stair.z &&
              z < stair.z + stair.width,
          ) ||
            LAYOUT.oldVillage.westStairs.some(
              (stair) =>
                x >= stair.x &&
                x < stair.x + stair.width &&
                z >= stair.fromZ &&
                z < stair.toZ,
            ));
        const isMountainStair =
          mapName === "mountain" &&
          [LAYOUT.mountain.lowerStair, LAYOUT.mountain.upperStair].some(
            (stair) =>
              x >= stair.x &&
              x < stair.x + stair.width &&
              z >= stair.fromZ &&
              z < stair.toZ,
          );
        if (isOldVillageStair || isMountainStair) return;
        const m = makePath(x, z);
        if (mapName === "mountain") {
          const materials = Array.isArray(m.material)
            ? m.material
            : [m.material];
          materials.forEach((material) =>
            mountainSeasonalMaterials.push({
              material: material as THREE.MeshStandardMaterial,
              baseColor: (
                material as THREE.MeshStandardMaterial
              ).color.getHex(),
              winterColor: 0xf0f3f4,
            }),
          );
        }
        m.position.y +=
          mapName === "livingArea"
            ? groundY(x, z)
            : mapName === "oldVillage"
              ? oldVillageGroundY(x, z)
              : mapName === "mountain"
                ? mountainGroundY(x, z)
                : 0;
        if (mapName === "oldVillage") {
          (m.material as THREE.Material).depthWrite = false;
          m.renderOrder = 1;
        }
        gameState.mapGroup.add(m);
      }
      // tile === 6（湖）不逐格建置，改成迴圈結束後蓋成一整片有波紋的水面
      else if (tile === 8) {
        // 女神祠堂步道那一段不用逐格貼平沙灘——它墊高浮出海面，用迴圈
        // 外那塊 makeShrinePathCauseway() 一次蓋掉整段，這裡跳過即可。
        const inShrinePath =
          mapName === "livingArea" &&
          z <= 2 &&
          x >= SHRINE_PATH_START_X &&
          x < SHRINE_PATH_START_X + SHRINE_PATH_LENGTH;
        if (inShrinePath) return;
        gameState.mapGroup.add(makeSand(x, z));
        const r = hash2(x * 4.3, z * 2.1);
        if (r < 0.12)
          gameState.mapGroup.add(
            makeStone(x + (r - 0.5) * 0.3, z + (r - 0.5) * 0.3, r * 0.6),
          );
      }
      // tile === 9（海）不逐格建置，迴圈結束後另外蓋成一整片海面，才能做波浪動畫
      else if (tile === 0 && mapName === "livingArea") {
        if (x === POUCH_POS.x && z === POUCH_POS.z) return;
        const insideArea = (area) =>
          x >= area.x &&
          x < area.x + area.width &&
          z >= area.z &&
          z < area.z + area.height;
        if (insideArea(LAYOUT.restArea) || insideArea(LAYOUT.garden)) return;
        if (x >= 14 && x <= 16) return; // 坡道走廊留乾淨，不要長裝飾把路擋亂
        const r = hash2(x * 3.1, z * 7.7);
        const gy = groundY(x, z);
        if (r < 0.1) {
          const m = makeGrassTuft(x + (r - 0.5) * 0.4, z + (r - 0.5) * 0.4, r);
          m.position.y += gy;
          gameState.mapGroup.add(m);
        } else if (r < 0.14) {
          const m = makeFlower(
            x + (r - 0.5) * 0.4,
            z + (r - 0.5) * 0.4,
            FLOWER_COLORS[Math.floor(r * 100) % 4],
          );
          m.position.y += gy;
          gameState.mapGroup.add(m);
        } else if (r < 0.17) {
          const m = makeStone(x + (r - 0.5) * 0.4, z + (r - 0.5) * 0.4, r);
          m.position.y += gy;
          gameState.mapGroup.add(m);
        }
      }
    });
  });

  // 海面：支援頂點著色（浪頭捲到最高點時自動染白模擬碎浪），網格加密讓
  // 捲浪的幾何細節看得出來；只涵蓋 tile 9 的範圍，動畫在 animate() 逐頂點更新
  windmillRotors.length = 0;
  gameState.oceanMesh = null;
  gameState.portWaterMeshes = [];
  gameState.lakeMesh = null;
  lakeShoreColliders.length = 0;
  gameState.seaGlimpseMesh = null;
  fishSchool.length = 0;
  pastureGrassBlades.length = 0;
  if (mapName === "livingArea") {
    // 海面不再是一塊矩形 PlaneGeometry——那樣不管沙灘/海怎麼抖動，海面
    // 西緣永遠是直線，會整片蓋掉抖動出來的沙灘。改成逐排(z)照當排實際
    // 沙灘/海分界點織一條緞帶狀網格，西緣（岸邊）跟著陣列裡的抖動走，
    // 東緣（外海）維持平直即可，看不到也不需要不規則
    const westXByZ = [];
    let globalMaxX = -Infinity;
    for (let z = 0; z < map.tiles.length; z++) {
      const row = map.tiles[z];
      const firstOceanX = row.indexOf(9);
      if (firstOceanX === -1) {
        westXByZ[z] = null;
        continue;
      }
      westXByZ[z] = firstOceanX - 0.5;
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] === 9) {
          globalMaxX = Math.max(globalMaxX, x + 0.5);
          break;
        }
      }
    }
    const validZ = westXByZ.reduce((acc, v, z) => {
      if (v !== null) acc.push(z);
      return acc;
    }, []);
    if (validZ.length) {
      const dataMinZ = validZ[0],
        dataMaxZ = validZ[validZ.length - 1],
        minZ = -7;
      const maxZ = rows - 1 + SOUTH_TERRAIN_EXTENSION;
      const minX = Math.min(...westXByZ.filter((v) => v !== null));
      // 海的可玩／碰撞範圍仍由 tile 決定；網格向東額外延伸，最大拉遠也看不到盡頭。
      const maxX = globalMaxX + 90;
      const width = maxX - minX,
        depth = maxZ - minZ;

      const westXAt = (z) => {
        if (z <= dataMinZ) return westXByZ[dataMinZ];
        const southShoreX =
          LAYOUT.coast.rampX +
          LAYOUT.coast.rampWidth +
          LAYOUT.coast.sandCols -
          0.5;
        if (z >= dataMaxZ) {
          const blend = Math.min(1, (z - dataMaxZ) / 3);
          return THREE.MathUtils.lerp(westXByZ[dataMaxZ], southShoreX, blend);
        }
        const zLo = Math.max(dataMinZ, Math.min(dataMaxZ, Math.floor(z)));
        const zHi = Math.min(dataMaxZ, zLo + 1);
        const wLo = westXByZ[zLo],
          wHi = westXByZ[zHi] != null ? westXByZ[zHi] : wLo;
        const t = zHi === zLo ? 0 : (z - zLo) / (zHi - zLo);
        return wLo + (wHi - wLo) * t;
      };

      const ZSUB = 2; // 每個 tile 排再細分幾段，波浪動畫才夠滑順
      const rowsZ = [];
      for (let z = minZ; z < dataMaxZ; z++) {
        for (let s = 0; s < ZSUB; s++) rowsZ.push(z + s / ZSUB);
      }
      // 南側延伸使用較疏的列，降低每幀海浪頂點更新成本。
      for (let z = dataMaxZ; z < maxZ; z += 2) rowsZ.push(z);
      rowsZ.push(maxZ);
      // 遠海不需要維持每格三分割，限制橫向細分數避免延伸後浪費效能。
      const COLS = Math.max(48, Math.min(108, Math.round(width * 1.1)));

      // 欄位用固定世界座標（每一排都是同一組 x），不要照各排西緣重新內插
      // ——內插會讓相鄰排的同一欄位落在不同的絕對 x，格子被拉斜，疊上波浪
      // 動畫的正弦相位後會出現對角條紋。改成每排只把落在陸地那側的頂點
      // 「夾」到該排的西緣，退化成貼齊邊界的窄三角形，欄位本身不歪斜
      const positions = [],
        colors = [];
      rowsZ.forEach((z) => {
        const westX = westXAt(z);
        for (let c = 0; c <= COLS; c++) {
          const t = c / COLS;
          const gridX = minX + (maxX - minX) * t;
          positions.push(Math.max(gridX, westX), 0, z);
          colors.push(0.18, 0.43, 0.68); // 0x2f6fae
        }
      });
      const indices = [];
      const rowLen = COLS + 1;
      for (let r = 0; r < rowsZ.length - 1; r++) {
        for (let c = 0; c < COLS; c++) {
          const i0 = r * rowLen + c,
            i1 = r * rowLen + c + 1;
          const i2 = (r + 1) * rowLen + c,
            i3 = (r + 1) * rowLen + c + 1;
          indices.push(i0, i2, i1, i1, i2, i3);
        }
      }

      // 幫每個頂點記錄「原始座標」：波浪位移一定要從固定的原始位置重算，
      // 不能直接在目前位置上疊加，不然每幀都會愈飄愈遠。顏色則用來畫浪頭泡沫
      const posArray = new Float32Array(positions);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 3),
      );
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geo.userData = { basePositions: posArray.slice() };

      const oceanDepthMask = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshStandardMaterial({
          color: 0x174968,
          roughness: 1,
          metalness: 0,
          // 跟草地/港區地板同一套修法（transparent+opacity:1+depthWrite:
          // false+renderOrder），不是只關 depthWrite。只關 depthWrite（維持
          // opaque）理論上也該讓星空穿過去，但實測這片海這樣單獨關掉沒有
          //效果——原因還沒完全查清楚，直接套用已經證實有效的完整組合。
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      );
      oceanDepthMask.position.y = 0.025;
      oceanDepthMask.receiveShadow = true;
      oceanDepthMask.renderOrder = 2;
      gameState.mapGroup.add(oceanDepthMask);
      waterSkyUnderlayMaterials.push(
        oceanDepthMask.material as THREE.MeshStandardMaterial,
      );

      gameState.oceanMesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.2,
          metalness: 0.1,
          flatShading: true,
          transparent: true,
          // 深水（北邊主海域）幾乎不透明，跟淺水（湖、港口船塢）區分開——
          // 水深當作簡化過的透明度依據，不用真的算深度貼圖。
          opacity: 0.88,
        }),
      );
      waterSurfaceMaterials.push(
        gameState.oceanMesh.material as THREE.MeshStandardMaterial,
      );
      // 頂點座標已經是世界座標（每排西緣各自不同，不能再用單一中心點套用
      // PlaneGeometry 的本地座標系），mesh 本身只需要負責 y 的抬高量。
      // y 抬高一點：波浪的位移量如果蓋過地面（y=0）就會被不透明的地面擋住，
      // 變成海面中間破一個洞。留出安全間距讓波浪永遠浮在地面之上
      gameState.oceanMesh.position.set(0, 0.13, 0);
      gameState.oceanMesh.receiveShadow = true;
      gameState.mapGroup.add(gameState.oceanMesh);

      // 沙灘跟海交界處放幾組會捲上岸、碎開、又退回去的浪花——原本每一
      // 排(z)都放一組，太密集、疊起來一片白，改成每兩排放一組
      map.tiles.forEach((row, z) => {
        if (z % 2 !== 0) return;
        const shoreX = row.findIndex((t) => t === 9);
        if (shoreX > 0) {
          const foam = makeFoam(shoreX - 0.35, z, z * 1.37);
          foamMeshes.push(foam);
          gameState.mapGroup.add(foam);
        }
      });
      const extendedShoreX =
        LAYOUT.coast.rampX +
        LAYOUT.coast.rampWidth +
        LAYOUT.coast.sandCols -
        0.5;
      for (let z = dataMaxZ + 2; z <= maxZ; z += 2) {
        const foam = makeFoam(extendedShoreX + 0.15, z, z * 1.37);
        foamMeshes.push(foam);
        gameState.mapGroup.add(foam);
      }

      // 海魚使用大範圍的長直線巡游；安全邊界取所有海岸線中最靠右的一排，
      // 避免沿 z 直游時切進凹凸不規則的沙灘。
      fishSchool.length = 0;
      const FISH_COUNT = 6;
      const safeSeaMinX = Math.max(...westXByZ.filter((v) => v !== null)) + 0.7;
      for (let i = 0; i < FISH_COUNT; i++) {
        const s1 = hash2(i * 3.1, i * 7.7),
          s2 = hash2(i * 5.3, i * 2.9);
        const cx = safeSeaMinX + s1 * Math.max(0.2, maxX - 0.7 - safeSeaMinX);
        const cz = minZ + 0.7 + s2 * Math.max(0.2, depth - 1.4);
        const mesh = makeFishProp(i);
        const scale = SEA_FISH_SCALE * (0.78 + hash2(i, 19.7) * 0.48);
        mesh.scale.setScalar(scale);
        mesh.position.set(cx, gameState.oceanMesh.position.y - 0.045, cz);
        gameState.mapGroup.add(mesh);
        const fish = {
          mesh,
          phase: s1 * Math.PI * 2,
          swimSpeed: 0.34 + s2 * 0.32,
          curveAmount: 0.18 + s1 * 0.32,
          baseY: gameState.oceanMesh.position.y - 0.045,
          depthAmp: 0.012 + s1 * 0.025,
          bounds: {
            minX: safeSeaMinX,
            maxX: maxX - 0.7,
            minZ: minZ + 0.7,
            maxZ: maxZ - 0.7,
          },
          route: null,
          // 一定要用 effectElapsed(不受暫停/快轉影響的真實時間)，跟
          // game-loop.ts 巡游迴圈裡判斷「該起步了嗎」用的是同一個時鐘。
          // 之前誤用 gameState.elapsed(遊戲時鐘，快轉 N 天會一次跳很多)
          // ——只要在魚第一次巡游前用過快轉，pauseUntil 就會被推到遠超過
          // effectElapsed 的天文數字，魚从此再也不會觸發新路線，只剩
          // 原地輕微的深度浮動，看起來像「魚不會動」。
          pauseUntil: gameState.effectElapsed + s2 * 1.5,
        };
        fishSchool.push(fish);
      }
    }

    // 每格以三個完全散點的合併草叢覆蓋，不再使用固定 2×2 排列；高度由跨格
    // 的低頻波形混合細微亂數，避免同一 tile 四叢同高造成棋盤式分隔。
    for (let gx = PASTURE.minX; gx <= PASTURE.maxX; gx++) {
      for (let gz = PASTURE.minZ; gz <= PASTURE.maxZ; gz++) {
        if (!hasPastureGrassAt(gx, gz)) continue;
        for (let i = 0; i < 3; i++) {
          const seed = hash2(gx * 7.1 + i * 2.3, gz * 5.9 + i * 4.7);
          const jx = gx + (hash2(gx + i * 11.3, gz * 2.1 + i) - 0.5) * 0.94;
          const jz = gz + (hash2(gz + i * 13.7, gx * 3.4 + i) - 0.5) * 0.94;
          const broadGrowth =
            1.5 +
            Math.sin(jx * 0.43 + jz * 0.18) * 0.62 +
            Math.cos(jz * 0.37 - jx * 0.12) * 0.48 +
            (seed - 0.5) * 0.34;
          const tuft = makeWindGrass(jx, jz, seed);
          tuft.userData.growth = Math.max(0.08, Math.min(2.98, broadGrowth));
          tuft.rotation.y = seed * Math.PI * 2;
          const widthScale = 0.88 + hash2(seed * 8.4, 1.7) * 0.28;
          tuft.scale.x = widthScale;
          tuft.scale.z = widthScale;
          plateauGroup.add(tuft);
          pastureGrassBlades.push(tuft);
        }
      }
    }

    // 依山傍海：海在東側，山放在西側邊界外，人站在房子附近往兩邊看
    // 會同時感覺到背後有山、前面有海——這是純景觀，不能走進去
    plateauGroup.add(makeWesternMountainTerrain(rows));
    plateauGroup.add(makeMountainGateway());

    const MOUNTAIN_COUNT = 14;
    for (let i = 0; i < MOUNTAIN_COUNT; i++) {
      const s = hash2(i * 9.7, i * 3.1);
      const mz = (i / (MOUNTAIN_COUNT - 1)) * (rows - 1);
      const height = 1.6 + s * 1.9;
      plateauGroup.add(
        makeMountain(
          LAYOUT.mountainBand.x + s * (LAYOUT.mountainBand.width - 1),
          mz,
          height,
          s,
        ),
      );
    }

    // 小屋右側果園：3×4 共 12 棵，間距加大並為每棵配置不同果色與葉色。
    for (let ox = 0; ox < LAYOUT.orchard.columns; ox++) {
      for (let oz = 0; oz < LAYOUT.orchard.rows; oz++) {
        const index = ox * LAYOUT.orchard.rows + oz;
        const fx =
          LAYOUT.orchard.x +
          ox * LAYOUT.orchard.spacingX +
          (hash2(ox, oz) - 0.5) * 0.2;
        const fz =
          LAYOUT.orchard.z +
          oz * LAYOUT.orchard.spacingZ +
          (hash2(oz, ox) - 0.5) * 0.2;
        plateauGroup.add(makeFruitTree(fx, fz, hash2(fx, fz), index));
      }
    }
    plateauGroup.add(makeRedWindmill(LAYOUT.windmill));

    // 動物投餵機——放在牧場邊、穀倉門口西側，跟穀倉保持一點距離，不擋
    // 動物早晚進出的三格門口空地(見 npc-runtime.ts 的 hasPastureGrassAt)。
    plateauGroup.add(makeAnimalFeeder(FEEDER_VISUAL));

    // 生活區採集點：靠西側山景的開闊草地，每個半日批次各 5 木、5 石。
    WOOD_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      const pile = makeWoodPile(n.x, n.z);
      pile.visible = !n.collected;
      plateauGroup.add(pile);
      gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "livingArea" });
    });
    STONE_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      const pile = makeStonePile(n.x, n.z);
      pile.visible = !n.collected;
      plateauGroup.add(pile);
      gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "livingArea" });
    });

    // 瀑布——湖西側邊緣，靜態占位，還沒做真的水流動畫
    plateauGroup.add(
      makeWaterfallPlaceholder(LAYOUT.lake.x + 0.5, LAYOUT.lake.z + 3),
    );

    // 行道樹右側正式分成上下兩區：上方聚會／個人放鬆，下方小花園。
    plateauGroup.add(makeRestArea(LAYOUT.restArea));
    plateauGroup.add(makeSmallGarden(LAYOUT.garden));

    // 海堤入口左右各一盞路燈，燈頭朝向道路中央。
    const lampX = LAYOUT.coast.rampX - 1.15;
    plateauGroup.add(
      makeStreetLamp(
        lampX,
        COAST_ROAD_CENTER_Z - COAST_ROAD_HALF_WIDTH - 0.55,
        1,
      ),
    );
    plateauGroup.add(
      makeStreetLamp(
        lampX,
        COAST_ROAD_CENTER_Z + COAST_ROAD_HALF_WIDTH + 0.55,
        -1,
      ),
    );

    // 湖：不再是矩形平面，改成手刻的極座標網格——從中心點往外拉幾圈同心圓，
    // 每個角度的半徑疊加幾層不同頻率的正弦波，做出雲朵/天然湖泊那種不規則
    // 但平滑的輪廓，不是幾個角的多邊形。三角化方式是標準的「相鄰兩圈連成
    // 三角形」做法，中心密、邊緣疏，整片仍然是一個網格，波紋動畫照樣能用
    const lakeCells = [];
    map.tiles.forEach((row, z) =>
      row.forEach((t, x) => {
        if (t === 6) lakeCells.push({ x, z });
      }),
    );
    if (lakeCells.length) {
      const centerX = LAYOUT.lake.x + (LAYOUT.lake.width - 1) / 2;
      const centerZ = LAYOUT.lake.z + (LAYOUT.lake.height - 1) / 2;
      const seed = hash2(centerX * 1.7, centerZ * 2.3) * 20;
      const radiusX = LAYOUT.lake.width * 0.35;
      const radiusZ = LAYOUT.lake.height * 0.35;

      const ANGLE_SEG = 32,
        RING_SEG = 7;
      const angleRadius = [];
      for (let a = 0; a <= ANGLE_SEG; a++) {
        const theta = (a / ANGLE_SEG) * Math.PI * 2;
        angleRadius.push(lakeEdgeFactor(theta));
      }
      angleRadius[ANGLE_SEG] = angleRadius[0]; // 頭尾接起來，輪廓才會閉合

      const positions = [];
      const colors = [];
      for (let ring = 0; ring <= RING_SEG; ring++) {
        const ringFrac = ring / RING_SEG;
        for (let a = 0; a <= ANGLE_SEG; a++) {
          const theta = (a / ANGLE_SEG) * Math.PI * 2;
          const r = angleRadius[a] * ringFrac;
          positions.push(
            Math.cos(theta) * radiusX * r,
            0,
            Math.sin(theta) * radiusZ * r,
          );
          // 中心偏深藍，邊緣淡成偏綠的淺水色——湖底透光的感覺
          const edge = ringFrac;
          colors.push(0.13 + edge * 0.3, 0.36 + edge * 0.32, 0.52 + edge * 0.2);
        }
      }
      const indices = [];
      const rowLen = ANGLE_SEG + 1;
      for (let ring = 0; ring < RING_SEG; ring++) {
        for (let a = 0; a < ANGLE_SEG; a++) {
          const i0 = ring * rowLen + a,
            i1 = ring * rowLen + a + 1;
          const i2 = (ring + 1) * rowLen + a,
            i3 = (ring + 1) * rowLen + a + 1;
          indices.push(i0, i2, i1, i1, i2, i3);
        }
      }

      const posArray = new Float32Array(positions);
      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
      lGeo.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 3),
      );
      lGeo.setIndex(indices);
      lGeo.computeVertexNormals();
      lGeo.userData = { basePositions: posArray.slice() };

      gameState.lakeMesh = new THREE.Mesh(
        lGeo,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.16,
          metalness: 0.12,
          transparent: true,
          // 湖是淺水，比北邊主海域(0.88)透明得多，星空才透得出來；0.6 試過
          // 還是看不出效果，再往下調到 0.35。
          opacity: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      waterSurfaceMaterials.push(
        gameState.lakeMesh.material as THREE.MeshStandardMaterial,
      );
      gameState.lakeMesh.position.set(centerX, 0.1, centerZ);
      gameState.lakeMesh.receiveShadow = true; // 房子跟樹的影子可以真的落在水面上
      plateauGroup.add(gameState.lakeMesh);
      const lakeSkyUnderlay = new THREE.Mesh(
        lGeo.clone(),
        new THREE.MeshStandardMaterial({
          color: 0x174968,
          roughness: 1,
          metalness: 0,
          side: THREE.DoubleSide,
          // 不寫深度，理由同 oceanDepthMask。
          depthWrite: false,
        }),
      );
      lakeSkyUnderlay.position.set(centerX, 0.035, centerZ);
      plateauGroup.add(lakeSkyUnderlay);
      waterSkyUnderlayMaterials.push(
        lakeSkyUnderlay.material as THREE.MeshStandardMaterial,
      );

      // 湖是橢圓形，用 isInsideLakeShape 篩掉外接矩形四個角落，星光點
      // 才不會漂在湖岸旁的草地上。

      // 大石完整圍住湖岸，間距小於石頭直徑，讓相鄰石塊自然重疊、沒有缺口。
      const SHORE_ROCK_COUNT = 72;
      for (let i = 0; i < SHORE_ROCK_COUNT; i++) {
        const theta = (i / SHORE_ROCK_COUNT) * Math.PI * 2 + 0.04;
        const edge = lakeEdgeFactor(theta);
        const jitter = (hash2(i * 5.7, seed + i) - 0.5) * 0.12;
        const rockX =
          centerX + Math.cos(theta) * (radiusX * edge + 0.26 + jitter);
        const rockZ =
          centerZ + Math.sin(theta) * (radiusZ * edge + 0.26 + jitter);
        const isSeat = i % 10 === 0;
        plateauGroup.add(
          makeLakeShoreRock(
            rockX,
            rockZ,
            hash2(seed + i * 3.1, i * 7.9),
            isSeat,
          ),
        );
        lakeShoreColliders.push({
          x: rockX,
          z: rockZ,
          radius: isSeat ? 0.38 : 0.3,
        });
      }

      // 幾片睡蓮葉，浮在水面上——低成本但很有效的「這是一座湖」視覺訊號
      const padCount = 3;
      for (let i = 0; i < padCount; i++) {
        const pr = hash2(seed + i * 4.1, i * 1.3);
        const pa = hash2(i * 7.7, seed + i * 2.9) * Math.PI * 2;
        const distX = radiusX * (0.15 + pr * 0.45);
        const distZ = radiusZ * (0.15 + pr * 0.45);
        const pad = new THREE.Mesh(
          new THREE.CircleGeometry(0.09 + pr * 0.05, 8),
          new THREE.MeshStandardMaterial({
            color: 0x3f9142,
            flatShading: true,
            side: THREE.DoubleSide,
          }),
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(
          centerX + Math.cos(pa) * distX,
          0.135,
          centerZ + Math.sin(pa) * distZ,
        );
        plateauGroup.add(pad);
      }

      // 湖中魚群使用湖心內縮後的安全矩形，能長距離橫游／縱游又不越岸。
      const LAKE_FISH_COUNT = 5;
      for (let i = 0; i < LAKE_FISH_COUNT; i++) {
        const s1 = hash2(40 + i * 3.7, 12 + i * 6.1);
        const s2 = hash2(70 + i * 5.3, 21 + i * 2.9);
        const angle = (i / LAKE_FISH_COUNT) * Math.PI * 2 + s1 * 0.5;
        const cx = centerX + Math.cos(angle) * radiusX * (0.12 + s1 * 0.22);
        const cz = centerZ + Math.sin(angle) * radiusZ * (0.12 + s2 * 0.22);
        const mesh = makeFishProp(100 + i);
        const scale = LAKE_FISH_SCALE * (0.8 + hash2(100 + i, 31.4) * 0.42);
        mesh.scale.setScalar(scale);
        mesh.position.set(cx, gameState.lakeMesh.position.y - 0.045, cz);
        plateauGroup.add(mesh);
        const fish = {
          mesh,
          phase: s2 * Math.PI * 2,
          swimSpeed: 0.24 + s2 * 0.23,
          curveAmount: 0.1 + s1 * 0.18,
          baseY: gameState.lakeMesh.position.y - 0.045,
          depthAmp: 0.008 + s2 * 0.014,
          bounds: {
            minX: centerX - radiusX * 0.45,
            maxX: centerX + radiusX * 0.45,
            minZ: centerZ - radiusZ * 0.45,
            maxZ: centerZ + radiusZ * 0.45,
          },
          route: null,
          // 同上：跟 game-loop.ts 的巡游判斷用同一個不受暫停/快轉影響的時鐘。
          pauseUntil: gameState.effectElapsed + s1 * 2,
        };
        fishSchool.push(fish);
      }
    }
  }

  // 所有地圖共用同一個季節上色收尾：不管哪個分支各自登記了哪些草地/地面
  // 材質(seasonalGroundMaterials/mountainSeasonalMaterials/
  // pastureGrassBlades)，這裡統一套一次目前季節色，不必每個分支自己記得
  // 呼叫——舊城鎮那片地板先前就是漏了這一步，換季後仍停在建圖當下的顏色。
  updateSeasonalGroundColors();
  scene.add(gameState.mapGroup);
  gameState.currentMapName = mapName;
  npcGroup.position.y = mapName === "livingArea" ? PLATEAU_Y : 0;
  npcs.forEach((npc) => {
    if (npc.id === "carpenter") {
      npc.mesh.visible =
        (carpenterQuest.stage === "moved_in" && npc.map === mapName) ||
        ((carpenterQuest.stage === "construction" ||
          carpenterQuest.stage === "ready_for_move_in") &&
          mapName === "oldVillage");
    } else {
      npc.mesh.visible = npc.map === mapName;
    }
  });
  npcGroup.visible =
    mapName === "livingArea" ||
    mapName === "oldVillage" ||
    ((carpenterQuest.stage === "escorting" ||
      carpenterQuest.stage === "village_scene_done") &&
      (mapName === "port" || mapName === "oldVillage"));
  animalGroup.visible = mapName === "livingArea";
  syncFarmVisuals();
}

export function isBlocked(mapName, x, z) {
  const map = MAPS[mapName];
  const tx = Math.round(x),
    tz = Math.round(z);
  // 北側延伸高台允許負 z；先檢查位於該區的小屋，避免提前返回漏掉碰撞。
  // 建筑视觉缩放不改变地图格，但碰撞必须覆盖放大后的墙体；正面门廊保留
  // 一条通往原门槛的通道，否则放大的主屋/动物小屋会把入口包进墙内。
  const visualBuildings = [
    ...(map.buildings || []),
    ...(map.placeholders || []),
  ];
  if (
    visualBuildings.some((building) =>
      isPointBlockedByScaledBuilding(
        building,
        x,
        z,
        mapName === "oldVillage" ? LAYOUT.oldVillage.houseVisualScale : 1,
      ),
    )
  )
    return true;
  if (mapName === "livingArea" && isPointInsideFeeder(x, z)) return true;
  if (mapName === "livingArea" && z < 0) {
    const onNorthPlateau =
      x >= 0 && x < LAYOUT.coast.rampX && z >= northCliffEdgeZ(x) + 0.62;
    return !onNorthPlateau;
  }
  if (tz < 0 || tz >= map.tiles.length || tx < 0 || tx >= map.tiles[0].length)
    return true;
  if (mapName === "oldVillage" && isBlockedByOldVillageRail(x, z)) return true;
  if (mapName === "port" && tz === LAYOUT.port.beachDepth) {
    const stairs = LAYOUT.port.stairs;
    const insideStairs = tx >= stairs.x && tx < stairs.x + stairs.width;
    const onRaisedNorthApron = tx >= 0 && tx < stairs.x;
    if (!insideStairs && !onRaisedNorthApron) return true;
  }
  if (
    mapName === "livingArea" &&
    lakeShoreColliders.some(
      (rock) => Math.hypot(x - rock.x, z - rock.z) < rock.radius,
    )
  )
    return true;
  if (mapName === "livingArea" && isInsideLakeShape(x, z)) return true;
  const t = map.tiles[tz][tx];
  if (t === 6) return true;
  if (t === 1 || t === 2 || t === 9) return true;
  if (map.furniture) {
    return map.furniture.some((f) => {
      if (f.nonBlocking) return false;
      const w = f.w || 1,
        d = f.d || 1;
      return tx >= f.x && tx < f.x + w && tz >= f.z && tz < f.z + d;
    });
  }
  return false;
}

export function loadMap(mapName, startPos) {
  gameState.isSitting = false;
  fadeOut(() => {
    // 06:00／18:00 只代表「下一次換圖可刷新」。必須等目標地圖真的不同才
    // 套用最新時段，避免採集點在玩家眼前重生；洞窟同 map 換樓也不算換圖。
    if (mapName !== gameState.currentMapName) refreshGatherNodes();
    gameState.zoom = Math.min(
      gameState.zoom,
      mapName === "port" ? 20 : mapName === "mountain" ? 22 : 18,
    );
    updateCameraFrustum();
    // 存讀檔還原到洞窟中途樓層時會直接呼叫 loadMap("stalactiteCave", …)，
    // 不會經過 enterMine()/mineGoUp()/mineGoDown()——這裡補一次保險，只重
    // 建地磚(純樓層函式，重算不會弄丟東西)，不能呼叫會連礦石節點一起
    // 重灑的完整版，不然剛從存檔讀回來的 ORE_NODES collected 狀態會被
    // 蓋掉。三個換樓動作各自已經呼叫過完整版，這裡重覆呼叫地磚版只是
    // 多算一次同樣的結果，不會有副作用。
    if (mapName === "stalactiteCave")
      regenerateMineFloorTiles(gameState.mineFloor);
    buildMap(mapName);
    const requestedPos = startPos || MAPS[mapName].playerStart;
    const isSafePlayerPosition = (x: number, z: number) =>
      ![
        [-0.22, -0.22],
        [0.22, -0.22],
        [-0.22, 0.22],
        [0.22, 0.22],
      ].some(([dx, dz]) => isBlocked(mapName, x + dx, z + dz));
    const nearestSafePosition = () => {
      if (isSafePlayerPosition(requestedPos.x, requestedPos.z))
        return requestedPos;
      const originX = Math.round(requestedPos.x);
      const originZ = Math.round(requestedPos.z);
      for (let radius = 1; radius <= 16; radius++) {
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
            const x = originX + dx;
            const z = originZ + dz;
            if (isSafePlayerPosition(x, z)) return { x, z };
          }
        }
      }
      return MAPS[mapName].playerStart;
    };
    const pos = nearestSafePosition();
    gameState.playerGridPos = { x: pos.x, z: pos.z };
    if (!gameState.player) {
      gameState.player = makeHeroPlayer();
      scene.add(gameState.player);
    }
    gameState.player.position.x = gameState.playerGridPos.x;
    gameState.player.position.z = gameState.playerGridPos.z;
    gameState.player.position.y =
      mapName === "livingArea"
        ? groundY(gameState.playerGridPos.x, gameState.playerGridPos.z)
        : mapName === "port"
          ? portGroundY(gameState.playerGridPos.x, gameState.playerGridPos.z)
          : mapName === "oldVillage"
            ? oldVillageGroundY(
                gameState.playerGridPos.x,
                gameState.playerGridPos.z,
              ) + 0.03
            : mapName === "mountain"
              ? mountainGroundY(
                  gameState.playerGridPos.x,
                  gameState.playerGridPos.z,
                ) +
                (isOnMountainStair(
                  gameState.playerGridPos.x,
                  gameState.playerGridPos.z,
                )
                  ? 0.3
                  : 0.08)
              : 0;
    if (
      (carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
      (mapName === "port" || mapName === "oldVillage")
    ) {
      const mayor = npcs.find((n) => n.id === "mayor");
      const carpenter = npcs.find((n) => n.id === "carpenter");
      // 換地圖會讓 escort 的軌跡（carpenterEscortTrail）整條重置，重新從
      // 兩人「當下位置」開始記錄；如果這裡把兩人擺在側邊/前方的偏移座標，
      // 重置後的軌跡起點就不在主角實際走過的路徑上，直到主角走出取樣距離
      // 之前，兩人都會照著這個離題的假起點穿模。所以跟主角疊在同一點最保險。
      [mayor, carpenter].forEach((npc) => {
        if (!npc) return;
        npc.mesh.visible = true;
        npc.mesh.position.set(pos.x, gameState.player.position.y, pos.z);
        npc.path = null;
        npc.lastTargetKey = null;
      });
    }
    fadeIn();
  });
}

export const fadeEl = document.getElementById("fade") as HTMLElement;
export function fadeOut(cb) {
  fadeEl.style.opacity = "1";
  setTimeout(cb, 400);
}
export function fadeIn() {
  setTimeout(() => (fadeEl.style.opacity = "0"), 50);
}

// events（地圖觸碰/互動事件表）搬自 layout-maps.ts：這裡才有 loadMap 跟
// handleCarpenterDockTouch/handleCarpenterDoorstepTouch 可以直接引用，
// 保持 layout-maps.ts 是純資料（不牽動 THREE.WebGLRenderer／DOM），
// map-debug.ts 才能單獨 import LAYOUT/MAPS 不必啟動整個渲染管線。
const WORLD_MAP_TRANSITIONS: TransitionLink[] = [
  {
    id: "old-village-mountain",
    a: {
      map: "oldVillage",
      triggerAt: () => LAYOUT.oldVillage.mountainGate,
      arrivalAt: () => LAYOUT.oldVillage.mountainArrival,
    },
    b: {
      map: "mountain",
      triggerAt: () => LAYOUT.mountain.townGate,
      arrivalAt: () => LAYOUT.mountain.townArrival,
    },
  },
];
const worldTransitionEvents = createTransitionEvents(
  WORLD_MAP_TRANSITIONS,
  (map, arrival) => loadMap(map, { ...arrival }),
);

// 鐘乳石洞窟進出/換樓——不是走 WORLD_MAP_TRANSITIONS 那套「單純幾何對應」
// 的產生器，因為進洞口要順便重置樓層、踩樓梯要依目前樓層決定是換樓層
// 還是離開地圖，這些都是有狀態的分支，用手寫 action 比硬塞進通用產生
// 器直接。三個動作都會呼叫 regenerateMineFloor()，樓層資料/礦石節點在
// loadMap() 之前就準備好，buildMap() 讀到的永遠是當前樓層該有的內容。
function enterMine() {
  regenerateMineFloor(1);
  loadMap("stalactiteCave", mineUpStairs(1));
}
function goToTownFromMine() {
  const cave = LAYOUT.oldVillage.stalactiteCave;
  const mouthZ = cave.z + cave.depth - 1;
  loadMap("oldVillage", {
    x: cave.entranceX + Math.floor((cave.entranceWidth - 1) / 2),
    z: mouthZ + 1,
  });
}
// 不管在第幾層，踩上樓梯都先問一次要不要直接回鎮上——touch 事件只在
// 玩家剛好踩進這一格的那一幀觸發一次(見 game-loop.ts 的
// roundedX/roundedZ 沒變就不重觸發)，不會因為玩家站著不動而連續彈窗。
// 原本只有第 1 層(唯一真正「離開洞窟」的樓層)會問，玩家反饋每一層都
// 該問，改成用 showChoice()(見 dialogue.ts)取代原生 confirm()——順便
// 是「選項 UI」的第一個實際用例，之後想做的另一個「往上爬」洞窟一樣
// 能直接沿用同一個 showChoice()，不用另外發明。
function mineGoUp() {
  const atSurface = gameState.mineFloor <= 1;
  showChoice(
    "要直接回鎮上嗎？",
    atSurface
      ? [
          { label: "回鎮上", value: "town" },
          { label: "繼續挖礦", value: "stay" },
        ]
      : [
          { label: "回鎮上", value: "town" },
          { label: "往上一層", value: "step" },
        ],
    (choice) => {
      if (choice === "stay") return;
      if (choice === "town") {
        goToTownFromMine();
        return;
      }
      regenerateMineFloor(gameState.mineFloor - 1);
      loadMap(
        "stalactiteCave",
        mineDownStairs(gameState.mineFloor) ||
          mineUpStairs(gameState.mineFloor),
      );
    },
  );
}
function mineGoDown() {
  if (gameState.mineFloor >= MINE_FLOOR_MAX) return;
  regenerateMineFloor(gameState.mineFloor + 1);
  loadMap("stalactiteCave", mineUpStairs(gameState.mineFloor));
}

export const events = [
  ...worldTransitionEvents,
  // 洞口(entranceX~entranceX+entranceWidth)沿線 3 格都能走進去，座標用
  // LAYOUT.oldVillage.stalactiteCave 現值推導，洞窟之後再拓寬/搬動也不用
  // 回來改這裡。
  ...Array.from(
    { length: LAYOUT.oldVillage.stalactiteCave.entranceWidth },
    (_, i) => ({
      map: "oldVillage",
      x: LAYOUT.oldVillage.stalactiteCave.entranceX + i,
      z:
        LAYOUT.oldVillage.stalactiteCave.z +
        LAYOUT.oldVillage.stalactiteCave.depth -
        1,
      trigger: "touch",
      action: () => enterMine(),
    }),
  ),
  {
    map: "stalactiteCave",
    get x() {
      return mineUpStairs(gameState.mineFloor).x;
    },
    get z() {
      return mineUpStairs(gameState.mineFloor).z;
    },
    trigger: "touch",
    action: () => mineGoUp(),
  },
  {
    map: "stalactiteCave",
    get x() {
      return mineDownStairs(gameState.mineFloor)?.x ?? -1;
    },
    get z() {
      return mineDownStairs(gameState.mineFloor)?.z ?? -1;
    },
    trigger: "touch",
    action: () => mineGoDown(),
  },
  {
    map: "livingArea",
    x: LAYOUT.house.doorX,
    z: LAYOUT.house.z + LAYOUT.house.d,
    trigger: "touch",
    action: () => loadMap("house", { ...MAPS.house.playerStart }),
  },
  {
    map: "house",
    x: 2,
    z: 6,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: LAYOUT.house.doorX,
        z: LAYOUT.house.z + LAYOUT.house.d + 1,
      }),
  },
  {
    map: "house",
    x: 3,
    z: 6,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: LAYOUT.house.doorX,
        z: LAYOUT.house.z + LAYOUT.house.d + 1,
      }),
  },
  // 生活區南側海岸(x=37~46，z=42 整排，地圖最南端) <-> 港口北端
  // (碼頭附近)——z=37~42 這段南側延伸地形已經在 layout-maps.ts 補上
  // 真的沙灘/海資料(coastShoreJitter 那段)，不再是純視覺蓋住的假
  // 草地，可以放回原本要求的最南端。
  ...Array.from({ length: LAYOUT.livingArea.portGate.width }, (_, i) => ({
    map: "livingArea",
    x: LAYOUT.livingArea.portGate.x + i,
    z: LAYOUT.livingArea.portGate.z,
    trigger: "touch",
    action: () =>
      loadMap("port", {
        x: LAYOUT.port.livingGate.x + i,
        z: LAYOUT.port.livingGate.z + 1,
      }),
  })),
  ...Array.from({ length: LAYOUT.port.livingGate.width }, (_, i) => ({
    map: "port",
    x: LAYOUT.port.livingGate.x + i,
    z: LAYOUT.port.livingGate.z,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: LAYOUT.livingArea.portGate.x + i,
        z: LAYOUT.livingArea.portGate.z - 1,
      }),
  })),
  // 港口<->舊城鎮的直接連通已經拆掉：舊城鎮現在改從生活區南側直接
  // 進入（見下面 oldVillage(7,0) 那組），不用再繞經港口。
  // 木匠抵達事件——港口碼頭見面 + 舊城鎮空屋門口(往返兩段劇情共用同一格)
  {
    map: "port",
    x: LAYOUT.port.carpenterMeet.x,
    z: LAYOUT.port.carpenterMeet.z,
    trigger: "touch",
    action: () => handleCarpenterDockTouch(),
  },
  {
    map: "oldVillage",
    x: CARPENTER_DOORSTEP.x,
    z: CARPENTER_DOORSTEP.z,
    trigger: "touch",
    action: () => handleCarpenterDoorstepTouch(),
  },
  // 生活區私人海岸北端 <-> 女神祠堂（骨架先接通，退潮限定判斷之後再加）
  // 觸發點整排(x=60,z=0~2)都能走進去，不是只有單一格。
  ...[0, 1, 2].map((z) => ({
    map: "livingArea",
    x: SHRINE_PATH_START_X + SHRINE_PATH_LENGTH - 1,
    z,
    trigger: "touch",
    action: () => loadMap("shrine", { ...MAPS.shrine.playerStart }),
  })),
  {
    map: "shrine",
    x: 4,
    z: 5,
    trigger: "touch",
    action: () =>
      // 落點刻意跟上面往返觸發點同一欄(x=60)：loadMap() 直接把
      // playerGridPos 設成這個座標，不是透過移動判斷觸發，所以落在
      // 觸發格本身不會立刻反彈回祠堂——跟其他連通點「落點跟觸發點
      // 錯開一格」的慣例不同，這裡照這輪的要求刻意對齊。
      loadMap("livingArea", {
        x: SHRINE_PATH_START_X + SHRINE_PATH_LENGTH - 1,
        z: 1,
      }),
  },
  // 生活區南側路(x=20~22，房子那條南北向大路)<-> 舊城鎮，直接落在
  // 原本「舊城鎮往港口」的那個門檻(7,0)——那條路現在改指向這裡，
  // 不再通往港口。門檻放回 z=42(生活區最南端)：這個 x 範圍離海很遠，
  // 沒有港口那組「海面網格視覺延伸蓋住草地」的問題，不用像港口那組
  // 挪到 z=36。
  ...Array.from({ length: LAYOUT.livingArea.oldVillageGate.width }, (_, i) => ({
    map: "livingArea",
    x: LAYOUT.livingArea.oldVillageGate.x + i,
    z: LAYOUT.livingArea.oldVillageGate.z,
    trigger: "touch",
    action: () =>
      loadMap("oldVillage", {
        x: LAYOUT.oldVillage.livingGate.x + i,
        z: 1,
      }),
  })),
  ...Array.from({ length: LAYOUT.oldVillage.livingGate.width }, (_, i) => ({
    map: "oldVillage",
    x: LAYOUT.oldVillage.livingGate.x + i,
    z: LAYOUT.oldVillage.livingGate.z,
    trigger: "touch",
    // 跟女神祠堂那組同樣的道理：loadMap() 直接設 playerGridPos，落在
    // 觸發格本身不會立刻反彈，所以往返可以共用同一個(7,0)。
    action: () =>
      loadMap("livingArea", {
        x: LAYOUT.livingArea.oldVillageGate.x + i,
        z: LAYOUT.livingArea.oldVillageGate.z - 1,
      }),
  })),
  {
    map: "livingArea",
    x: MOUNTAIN_GATE_BLOCKER.x,
    z: MOUNTAIN_GATE_BLOCKER.z,
    trigger: "touch",
    action: () => loadMap("mountain", { ...LAYOUT.mountain.homeArrival }),
  },
  {
    map: "mountain",
    x: LAYOUT.mountain.homeGate.x,
    z: LAYOUT.mountain.homeGate.z,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: MOUNTAIN_GATE_BLOCKER.x + 1,
        z: MOUNTAIN_GATE_BLOCKER.z + 1,
      }),
  },
  // 舊城鎮東側 <-> 港口西側：沿邊逐格登記雙向觸發並對應同一個 z；
  // 目前由 z=4 一路連通到 z=47，包含指定的兩側沙灘區 z=30~47。
  ...Array.from({ length: LAYOUT.oldVillage.portGate.height }, (_, i) => ({
    map: "oldVillage",
    x: LAYOUT.oldVillage.portGate.x,
    z: LAYOUT.oldVillage.portGate.z + i,
    trigger: "touch",
    action: () =>
      loadMap("port", {
        x: LAYOUT.port.oldVillageGate.x + 1,
        z: LAYOUT.port.oldVillageGate.z + i,
      }),
  })),
  ...Array.from({ length: LAYOUT.port.oldVillageGate.height }, (_, i) => i)
    .filter(
      (i) =>
        !(
          LAYOUT.port.oldVillageGate.x === LAYOUT.port.livingGate.x &&
          LAYOUT.port.oldVillageGate.z + i === LAYOUT.port.livingGate.z
        ),
    )
    .map((i) => ({
      map: "port",
      x: LAYOUT.port.oldVillageGate.x,
      z: LAYOUT.port.oldVillageGate.z + i,
      trigger: "touch",
      action: () =>
        loadMap("oldVillage", {
          x: LAYOUT.oldVillage.portGate.x - 1,
          z: LAYOUT.oldVillage.portGate.z + i,
        }),
    })),
];
