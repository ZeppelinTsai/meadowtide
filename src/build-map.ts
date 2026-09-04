import * as THREE from "three";
import { rebuildSeatTargets } from "./seat-system";
import { hash2 } from "./utils";
import {
  gameState,
  getSeasonGrassTone,
  SEASON_GRASS_TONES,
  pastureGrassStageAt,
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
  CARPENTER_DOORSTEP,
  GENERAL_STORE_DOORSTEP,
  ARTIST_EVENT_WAIT_POS,
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
  LANDMARK_TORII_SCALE,
} from "./layout-maps";
import {
  handleCarpenterDockTouch,
  handleCarpenterDoorstepTouch,
} from "./carpenter-quest";
import { handleArtistWaitTouch } from "./day2-morning-event";
import {
  windowMats,
  waterSurfaceMaterials,
  fishingWaterMeshes,
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

  thresholdMarkerMeshes,
  thresholdMarkersVisible,
  gatherNodeMeshes,
  flowerNodeMeshes,
  mushroomNodeMeshes,
  oreNodeMeshes,
  celestialSparkleMaterials,
  southIndoorWallMeshes,
} from "./scene-registries";

import { getShorewardSeaWaveDirection } from "./sea-wave-direction";
import { createConnectedTileSeaGeometry } from "./tile-sea-geometry";
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
  MOUNTAIN_MINE_SIZE,
  MOUNTAIN_MINE_FLOOR_MAX,
  MOUNTAIN_ORE_NODES,
  mountainMineUpStairs,
  mountainMineDownStairs,
  regenerateMountainMineFloor,
  regenerateMountainMineFloorTiles,
  MOUNTAIN_STAIR_A,
  MOUNTAIN_STAIR_B,
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
import { makeGoddess, makeHeroPlayer, makeMountainGuardian } from "./humanoid";
import {
  markRuntimePlayerMesh,
  removeStalePlayerMeshes,
} from "./player-mesh-lifecycle";
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
  setPastureGrassStage,
  makeFlower,
  makeFruitTree,
  makeOysterRack,
  makeRestArea,
  makePortScene,
  makeToriiGate,
  makeMountainSummitShrine,
  makeShrineHall,
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
  makeMountainCaveEntrance,
  makeWesternMountainTerrain,
  makeMountainGateway,
  makeSteepStoneStairs,
  makeFishProp,
  makeLamp,
  makeCeilingLamp,
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
  makeEasel,
  makeShipWheelEmblem,
  makeHangingSignboard,
  makeWoodPile,
  makeStonePile,
  makeAnimalFeeder,
  makeBeehive,
  makeOreNode,
  makeMineStaircase,
  makeMinePitRecess,
  makeCelestialSpiralStaircase,
  makeCelestialSparkles,
} from "./props";
import { syncFarmVisuals, syncFlowerBedVisuals } from "./farm-visuals";
import { createTransitionEvents, type TransitionLink } from "./map-transitions";
import { getNpcNameStage } from "./npc-name-reveal";
import {
  getActiveOysterRackLayouts,
  WOOD_NODES,
  STONE_NODES,
  FLOWER_NODES,
  MUSHROOM_NODES,
  FEEDER_VISUAL,
  isPointInsideFeeder,
  refreshGatherNodes,
  BEEHIVE_VISUAL,
  isPointInsideBeehive,
  isBeehiveUnlocked,
} from "./game-state";
import { makeFlowerCluster } from "./wildflowers";
import { makeMushroomCluster } from "./mushrooms";

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
  fishingWaterMeshes.length = 0;
  waterSkyUnderlayMaterials.length = 0;
  outdoorLampLights.length = 0;
  seasonalTreeLeafMaterials.length = 0;
  seasonalGroundMaterials.length = 0;
  mountainSeasonalMaterials.length = 0;
  thresholdMarkerMeshes.length = 0;
  gatherNodeMeshes.length = 0;
  flowerNodeMeshes.length = 0;
  mushroomNodeMeshes.length = 0;
  oreNodeMeshes.length = 0;
  celestialSparkleMaterials.length = 0;
  southIndoorWallMeshes.length = 0;
  // 場景專屬物件可能在前面的 port／oldVillage 分支建好；動畫登記表必須
  // 在任何場景建置之前清空，不能等到共用海面收尾才清，否則模型看得到、
  // animate() 卻收不到登記項目，浪花或水面會完全靜止。
  foamMeshes.length = 0;

  const map = MAPS[mapName];
  const rows = map.tiles.length,
    cols = map.tiles[0].length;

  let plateauGroup = gameState.mapGroup;

  if (mapName === "house" || mapName === "generalStore") {
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
    // 2026-09-03：這片沙灘裝飾跟崖底亂石本來是相對 NORTH_CLIFF_Z 手動
    // 對齊的寫死數字，牧草地北擴/NORTH_CLIFF_Z 再往北推 5 格時要一起
    // 動，不然會留在半路、跟新的懸崖線脫節。
    const sandFringe = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xe8d29a }),
    );
    sandFringe.rotation.x = -Math.PI / 2;
    sandFringe.position.set(5, 0.01, -7.1 - 5);
    gameState.mapGroup.add(sandFringe);
    for (let i = 0; i < 6; i++) {
      const bx = hash2(i * 5.1, 2.2),
        bz = hash2(i * 2.7, 6.6);
      const boulder = makeStone(bx * 11, -6.2 - 5 - bz * 1.5, bx);
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
    gameState.oysterGlowMats.length = 0;
    if (!gameState.titlePresentationActive) {
      getActiveOysterRackLayouts().forEach(({ visual }) => {
        const oysterRack = makeOysterRack(visual.x, visual.z);
        oysterRack.group.position.y = groundY(visual.x, visual.z);
        gameState.mapGroup.add(oysterRack.group);
        gameState.oysterGlowMats.push(oysterRack.glowMat);
      });
    }

    // 女神祠堂步道——墊高浮出海面的沙洲，不是逐格貼平的沙灘(那段已在
    // 上面的 tile===8 迴圈裡跳過)，這裡一次蓋掉整段。
    gameState.mapGroup.add(makeShrinePathCauseway());

    // 固定在高台上的東西(建築、農地、湖、牧草、遠山)統一掛在這個群組下面，
    // 整組往上抬 PLATEAU_Y，不用逐一調整每個物件的座標
    plateauGroup = new THREE.Group();
    plateauGroup.position.y = PLATEAU_Y;
    gameState.mapGroup.add(plateauGroup);
  } else if (mapName === "port") {
    // 港區也要跟城鎮/生活區一起走季節地表更新；冬天的地面應該覆上一層雪色，
    // 不要一直停在固定的石板棕灰。這塊底板仍然是裸露地面，所以可以沿用
    // starSafe 的透明蓋層手法，讓星空在白雪地上仍然正確被遮住。
    const portGroundMat = addMapFloorPatch({
      width: cols,
      depth: rows,
      color: getSeasonGrassTone().ground,
      roughness: 0.96,
      starSafe: true,
    });
    seasonalGroundMaterials.push(portGroundMat);
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
    } else if (mapName === "mountainCave") {
      // 山之洞內部地板——跟鐘乳石洞窟同一套「不登記進 seasonalGroundMaterials
      // +依樓層礦石階層混色」寫法，唯一差別是挖空的那一格改成
      // mountainMineDownStairs()(山之洞的「淺處/出口」方向，模組配置見
      // mine.ts 山之洞那段開頭的長註解)，不是 mineDownStairs()。這個函式
      // 永遠有值(山之洞的出口方向樓梯每層都存在，包含第 1 層跟頂層)，
      // 下面的 else 分支理論上摸不到，保留只是跟鐘乳石洞窟同一套模板、
      // 不特別精簡。
      const mountainFloorTier =
        ORE_TIERS[mineTierForFloor(gameState.mountainMineFloor) - 1];
      const mountainFloorColor = new THREE.Color(0x3a3d38).lerp(
        new THREE.Color(mountainFloorTier.color),
        0.16,
      );
      const mountainPit = mountainMineDownStairs(gameState.mountainMineFloor);
      if (mountainPit) {
        if (mountainPit.z > 0) {
          addMapFloorPatch({
            x: 0,
            z: 0,
            width: cols,
            depth: mountainPit.z,
            color: mountainFloorColor,
            roughness: 1,
          });
        }
        if (mountainPit.z < rows - 1) {
          addMapFloorPatch({
            x: 0,
            z: mountainPit.z + 1,
            width: cols,
            depth: rows - mountainPit.z - 1,
            color: mountainFloorColor,
            roughness: 1,
          });
        }
        if (mountainPit.x > 0) {
          addMapFloorPatch({
            x: 0,
            z: mountainPit.z,
            width: mountainPit.x,
            depth: 1,
            color: mountainFloorColor,
            roughness: 1,
          });
        }
        if (mountainPit.x < cols - 1) {
          addMapFloorPatch({
            x: mountainPit.x + 1,
            z: mountainPit.z,
            width: cols - mountainPit.x - 1,
            depth: 1,
            color: mountainFloorColor,
            roughness: 1,
          });
        }
      } else {
        addMapFloorPatch({
          width: cols,
          depth: rows,
          color: mountainFloorColor,
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
      // 2026-08-26：depthWrite:false 原本是為了避免相鄰台地/樓梯接縫
      // z-fighting，但第一人稱貼地視角會從近乎水平的掠射角看向台地
      // 側面/底部——這種角度下深度緩衝區精度本來就差，depthWrite:false
      // 讓台地從來不寫入自己的真實深度，後面畫的東西（甚至只是遠處的
      // 平面地板/天空）在掠射角下深度測試會跟台地「打成平手」甚至
      // 蓋過去，看起來像台地/房子的地基整塊透空、看穿到底下的空地
      // (Zeppelin 回報「房子底下是空的」「每一層平台都一樣」)。改用
      // polygonOffset 達到同樣的防閃爍效果：一樣把台地表面在深度上
      // 稍微推近鏡頭一點點，避開跟相鄰面共平面的 z-fighting，但這次
      // 深度緩衝區有正確寫入，後面畫的東西才會被正常擋住，不會再穿幫。
      const terraceMat = new THREE.MeshStandardMaterial({
        color: 0x8f8779,
        roughness: 0.98,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const northPlatformWallMat = new THREE.MeshStandardMaterial({
        color: 0x343638,
        flatShading: true,
        roughness: 0.98,
      });
      const northPlatformTopMat = new THREE.MeshStandardMaterial({
        color: 0x8f8779,
        roughness: 0.98,
      });
      // BoxGeometry 材質順序：+X, -X, +Y, -Y, +Z, -Z。
      // 頂面沿用可走台地灰色，垂直牆面則作為玄武岩柱群後方的深色岩芯。
      const northPlatformMaterials = [
        northPlatformWallMat,
        northPlatformWallMat,
        northPlatformTopMat,
        northPlatformWallMat,
        northPlatformWallMat,
        northPlatformWallMat,
      ];
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
        material: THREE.Material | THREE.Material[] = terraceMat,
      ) => {
        const terrace = new THREE.Mesh(
          new THREE.BoxGeometry(width, elevation, depth),
          material,
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
      // 2026-08-26：上台地/中台地原本整塊鋪到 westEdge+0.5(=58)，但
      // plazaStairs[0]/[1] 的候選判定範圍是 fromX-0.5~toX+0.5(=54.5~
      // 58.5)——兩段樓梯的 fromX 都是 55，台地鋪到 58 會整塊蓋過樓梯
      // fromX(55)到 westEdge(57.5)之間那一大截，把階梯的立體幾何蓋成
      // 一片同高的平面(Zeppelin 回報「把右側下去到廣場的樓梯蓋住了」)。
      //
      // 不能整塊台地都縮寬到 plazaStairsFromX——樓梯只佔自己那幾排 z
      // (plazaStairs[0] 是 z:6.5~9.5、[1] 是 z:15.5~19.5)，台地在其餘
      // z 範圍(沒有樓梯)還是要鋪滿到 westEdge，不然又會在樓梯以外的
      // 地方鏤空。改成各自拆成兩塊：樓梯z範圍以外維持原寬度(鋪到
      // westEdge)，樓梯z範圍內縮寬到 plazaStairsFromX，跟樓梯本身的
      // 階梯box在x方向剛好交棒、不重疊。
      // 2026-08-26 二次修正：上一版把 narrowWidth 對齊到樓梯「候選判定」
      // 的邊界(fromX-0.5=54.5)，但 plazaStairs 的候選判定刻意比實際階梯
      // 幾何寬 0.5(給站位判斷用的緩衝)，階梯本身的實心 box 實際只從
      // fromX(55)開始——對齊候選邊界反而在台地跟階梯之間留了 0.5 格
      // 真空(Zeppelin：「x到155還是出現縫隙」「可能要用0.5當單位」，
      // 猜對了方向但這裡少加、不是少減)。narrowWidth 改成對齊階梯實際
      // 幾何邊界 fromX，不是候選判定邊界 fromX-0.5。
      const plazaStairsFromX = LAYOUT.oldVillage.plazaStairs[0].fromX;
      const fullWidth = LAYOUT.oldVillage.terraces.westEdge + 0.5 - townWestX;
      const narrowWidth = plazaStairsFromX - townWestX + 0.5;
      addTerrace(
        0,
        7,
        LAYOUT.oldVillage.terraces.upper.elevation,
        townWestX,
        fullWidth,
      );
      addTerrace(
        7,
        3,
        LAYOUT.oldVillage.terraces.upper.elevation,
        townWestX,
        narrowWidth,
      );
      addTerrace(
        10,
        6,
        LAYOUT.oldVillage.terraces.middle.elevation,
        townWestX,
        fullWidth,
      );
      addTerrace(
        16,
        4,
        LAYOUT.oldVillage.terraces.middle.elevation,
        townWestX,
        narrowWidth,
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
      // Box A(廣場東側，樓梯以東)。2026-08-26 三次修正：前兩版都把
      // 整塊 Box A(z:0~20，單一一塊)一起搬西緣，結果只顧到樓梯所在的
      // z 範圍(6.5~9.5、15.5~19.5)、卻忘了 Box A 其餘 z 範圍(沒有樓梯)
      // 原本西緣本來就該對齊 westEdge(57.5，跟上面 upper/middle 台地
      // 的 fullWidth 那兩塊交棒)，不是樓梯的 toX(58)——整塊搬過去反而
      // 在沒有樓梯的那些 z 範圍多鑿出一條 0.5 格縫(這正是 Zeppelin 這輪
      // 「x到155還是出現縫隙」的另一半成因，跟 narrowWidth 那個坑是同一
      // 類但不同位置)。改成比照 upper/middle 台地的拆法，一樣拆四塊：
      // 沒有樓梯的 z 範圍鋪到 westEdge(跟西側台地同一條交界線)，樓梯
      // 所在的 z 範圍縮進到 toX(跟樓梯實際幾何交棒)。
      const plazaStairsToX = LAYOUT.oldVillage.plazaStairs[0].toX;
      // 左緣 = xParam-0.5，想要左緣落在 westEdge(57.5)，xParam 要
      // +0.5，不是 +1(+1 會讓左緣多推到 58，等於沒拆這塊)。
      const westEdgeParam = LAYOUT.oldVillage.terraces.westEdge + 0.5;
      const stairEdgeParam = plazaStairsToX + 0.5;
      addTerrace(
        0,
        7,
        groundElevation,
        westEdgeParam,
        LAYOUT.oldVillage.width - westEdgeParam,
      );
      addTerrace(
        7,
        3,
        groundElevation,
        stairEdgeParam,
        LAYOUT.oldVillage.width - stairEdgeParam,
      );
      addTerrace(
        10,
        6,
        groundElevation,
        westEdgeParam,
        LAYOUT.oldVillage.width - westEdgeParam,
      );
      addTerrace(
        16,
        4,
        groundElevation,
        stairEdgeParam,
        LAYOUT.oldVillage.width - stairEdgeParam,
      );
      addTerrace(
        20,
        7,
        groundElevation,
        townWestX + 3,
        LAYOUT.oldVillage.width - (townWestX + 3),
      );
      // 2026-08-26：Zeppelin 回報 (129~132,30) 跟 (134~158,30) 都還是有
      // 縫隙——這塊 Box C 原本 z=27,depth=3，真實範圍只到 [26.5,29.5]。
      // 但 oldVillageGroundY() 判定「z>=southBeach.z(=30)才算沙灘(回傳
      // 0)」，也就是說 z 還沒到 30 之前(包含 29.5~30 這 0.5 格)，邏輯
      // 上仍然是墊高地面(groundElevation)——這半格剛好不在 Box C 的
      // 涵蓋範圍內，也還沒到沙灘，就是真的鏤空。depth 從 3 改成 3.5，
      // 涵蓋到 [26.5,30]，剛好跟沙灘判定的邊界(z=30)以及 westStairs 最後
      // 一段(fromZ=30)無縫交棒，不再多蓋也不再少蓋。
      addTerrace(
        27,
        3.5,
        groundElevation,
        townWestX,
        LAYOUT.oldVillage.width - townWestX,
      );
      // 2026-08-26：Zeppelin 回報 (130,25) 樓梯底下是空的——上面那塊 Box B
      // 刻意從 townWestX+3 開始，跳過 westStairs 中間那一段(fromZ19~26)
      // 佔用的西緣三格，理由是「樓梯自己的階梯 box 已經是實心幾何，這裡
      // 整塊蓋過去會穿插/蓋住台階」。但階梯每一階的 box 只從
      // baseElevation(=1，跟這塊廣場同高)往上蓋，baseElevation 本身
      // 到 y=0 之間完全没有東西填——樓梯正下方那塊被跳過的西緣三格因此
      // 是真的镂空，不是穿幫。這裡單獨補一塊只墊到 baseElevation 高度
      // 的實心地基，範圍精確對齊樓梯本身的 x/z。
      //
      // 2026-08-26 修正：第一版用 z=20、depth=toZ-20(=6)，算成
      // addTerrace 的 z/depth 之後，實際涵蓋的是 true z:[19.5,25.5]
      // (addTerrace 內部跟 x 一樣，中心點是 z+(depth-1)/2，實際左右緣
      // 是 z-0.5 / z+depth-0.5)，比樓梯自己的候選範圍(toZ=26，即真正
      // 到 26.5)整整少了最後 1 格，z=26 那一整排还是鏤空——這正是
      // Zeppelin 抓到「(129,26)底下也是空的」的原因。改成 z=20、
      // depth=7，真正涵蓋到 [19.5,26.5]，剛好跟上面 middle 台地(到
      // 19.5)、下面 Box C(z=27，真正從 26.5 開始)無縫交棒。
      {
        const midWestStair = LAYOUT.oldVillage.westStairs[2];
        addTerrace(
          20,
          7,
          midWestStair.baseElevation,
          midWestStair.x,
          midWestStair.width,
        );
      }
      const northPlatform = LAYOUT.oldVillage.northBeachPlatform;
      northPlatform.segments.forEach((segment) =>
        addTerrace(
          segment.z,
          segment.depth,
          northPlatform.elevation,
          segment.x,
          segment.width,
          northPlatformMaterials,
        ),
      );
      // 參考生活區玄武岩岬角的柱狀節理，沿平台真正外露的格邊生成岩柱。
      // 由 segments 算輪廓，平台尺寸改動時不必另維護一套牆面座標；南側保留
      // 現有三格樓梯入口。深色岩芯填住柱縫，碎岩與少量植被則打散方盒輪廓。
      const platformCells = new Set<string>();
      northPlatform.segments.forEach((segment) => {
        for (let z = segment.z; z < segment.z + segment.depth; z++)
          for (let x = segment.x; x < segment.x + segment.width; x++)
            platformCells.add(`${x},${z}`);
      });
      const platformBasalt = new THREE.Group();
      const basaltMats = [0x303336, 0x3f3b38, 0x504640, 0x625149].map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            flatShading: true,
            roughness: 0.98,
          }),
      );
      const cliffPlantMats = [0x355c37, 0x477444, 0x668653].map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            flatShading: true,
            roughness: 1,
          }),
      );
      const platformStair = LAYOUT.oldVillage.westStairs.find(
        (stair) =>
          stair.baseElevation === 0 &&
          stair.elevation === northPlatform.elevation,
      );
      const edgeDirections = [
        { dx: 1, dz: 0 },
        { dx: -1, dz: 0 },
        { dx: 0, dz: 1 },
        { dx: 0, dz: -1 },
      ];
      let basaltIndex = 0;
      platformCells.forEach((key) => {
        const [x, z] = key.split(",").map(Number);
        edgeDirections.forEach(({ dx, dz }) => {
          if (platformCells.has(`${x + dx},${z + dz}`)) return;
          const isStairOpening =
            dz === 1 &&
            platformStair &&
            x >= platformStair.x &&
            x < platformStair.x + platformStair.width;
          if (isStairOpening) return;
          for (let columnIndex = 0; columnIndex < 2; columnIndex++) {
            const seed = hash2(
              x * 7.3 + z * 3.1 + basaltIndex,
              z * 8.7 - x * 2.9 + columnIndex,
            );
            const tangentX = dz === 0 ? 0 : columnIndex === 0 ? -0.23 : 0.23;
            const tangentZ = dx === 0 ? 0 : columnIndex === 0 ? -0.23 : 0.23;
            const radius = 0.29 + seed * 0.1;
            const height = northPlatform.elevation * (0.84 + seed * 0.18);
            const column = new THREE.Mesh(
              new THREE.CylinderGeometry(
                radius * (0.84 + seed * 0.08),
                radius,
                height,
                5 + (basaltIndex % 2),
                1,
              ),
              basaltMats[basaltIndex % basaltMats.length],
            );
            column.position.set(
              x + dx * 0.48 + tangentX + (seed - 0.5) * 0.08,
              height / 2 - 0.03,
              z + dz * 0.48 + tangentZ + (seed - 0.5) * 0.08,
            );
            column.rotation.y = seed * Math.PI;
            column.rotation.x = (hash2(seed, 2.7) - 0.5) * 0.055;
            column.rotation.z = (hash2(seed, 6.3) - 0.5) * 0.055;
            column.castShadow = true;
            column.receiveShadow = true;
            platformBasalt.add(column);

            if (basaltIndex % 3 === 0) {
              const ledge = new THREE.Mesh(
                new THREE.IcosahedronGeometry(radius * (0.68 + seed * 0.22), 0),
                basaltMats[(basaltIndex + 1) % basaltMats.length],
              );
              ledge.position.set(
                column.position.x + dx * 0.08,
                height * (0.62 + seed * 0.24),
                column.position.z + dz * 0.08,
              );
              ledge.scale.y = 0.45 + seed * 0.18;
              ledge.rotation.set(seed * 0.5, seed * 2.8, seed * 0.35);
              ledge.castShadow = true;
              ledge.receiveShadow = true;
              platformBasalt.add(ledge);
            }
            if (basaltIndex % 5 === 0) {
              const plant = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.16 + seed * 0.1, 1),
                cliffPlantMats[basaltIndex % cliffPlantMats.length],
              );
              plant.position.set(
                column.position.x - dx * 0.04,
                Math.min(northPlatform.elevation + 0.03, height + 0.05),
                column.position.z - dz * 0.04,
              );
              plant.scale.set(1.25, 0.55, 1.25);
              plant.castShadow = true;
              platformBasalt.add(plant);
            }
            basaltIndex++;
          }
        });
      });
      gameState.mapGroup.add(platformBasalt);
      // 2026-08-26「波上宮開工」：素色長方體佔位換成完整建模的主殿
      // (makeShrineHall()，props.ts)——朱紅牆身+米白長押+深色四坡頂+
      // 千木+迴廊列柱+雙開木門，尺寸/位置一樣完全吃 LAYOUT 的 cube 資料，
      // 不用同步改這裡。
      const platformCube = northPlatform.cube;
      const shrineHall = makeShrineHall(platformCube);
      shrineHall.position.set(
        platformCube.x + (platformCube.width - 1) / 2,
        northPlatform.elevation,
        platformCube.z + (platformCube.depth - 1) / 2,
      );
      gameState.mapGroup.add(shrineHall);

      const platformTorii = makeToriiGate();
      platformTorii.scale.setScalar(northPlatform.torii.scale);
      platformTorii.position.set(
        northPlatform.torii.x,
        northPlatform.elevation,
        northPlatform.torii.z,
      );
      gameState.mapGroup.add(platformTorii);
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
      // 扶手必須保留正常深度測試；關閉後，平台後方的欄杆會穿透立方體與
      // 地形顯示，視覺上像浸入海面。欄杆本身已高於平台，不需要強制置頂。
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
          // 柱子中心在 ground+0.43、高 0.7，底面其實停在 ground+0.08，
          // 沒有真的碰到地面(Zeppelin 回報「所有扶手都懸空沒接地」)。
          // 中心點跟頂部(接橫桿的位置)不動，只把高度拉到 0.86，底面
          // 正好落在 ground+0，插進地面看起來才不會浮空。
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.055, 0.86, 6),
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

      // 舊城鎮海面依最終 tile 9 合成單一靜態網格；不做頂點浪動畫與白峰上色。
      const oldVillageWaterMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
      });
      const oldVillageWaterDepthMat = new THREE.MeshStandardMaterial({
        color: 0x245f7f,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      waterSurfaceMaterials.push(oldVillageWaterMat);
      waterSkyUnderlayMaterials.push(oldVillageWaterDepthMat);
      const oldVillageWaterCells: Array<{ x: number; z: number }> = [];
      const addOldVillageWater = (wx, wz, width, depth) => {
        for (let waterZ = wz; waterZ < wz + depth; waterZ++) {
          for (let waterX = wx; waterX < wx + width; waterX++) {
            oldVillageWaterCells.push({ x: waterX, z: waterZ });
          }
        }
      };
      const buildOldVillageWater = () => {
        const geometry = createConnectedTileSeaGeometry(
          oldVillageWaterCells,
        );
        const depthMask = new THREE.Mesh(
          geometry.clone(),
          oldVillageWaterDepthMat,
        );
        depthMask.position.y = 0.025;
        depthMask.receiveShadow = true;
        gameState.mapGroup.add(depthMask);
        const water = new THREE.Mesh(geometry, oldVillageWaterMat);
        water.position.y = 0.09;
        water.receiveShadow = true;
        fishingWaterMeshes.push(water);
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
      buildOldVillageWater();

      // 舊城鎮原有的南岸與西岸拍岸泡沫；海面本身仍保持靜態。
      const southFoamStartX = oldVillageWestBeachStartX(
        LAYOUT.oldVillage.westBeach.z + 1,
      );
      const southFoamEndX =
        LAYOUT.oldVillage.southBeach.x + LAYOUT.oldVillage.southBeach.width - 2;
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
          LAYOUT.oldVillage.westBeach.x + LAYOUT.oldVillage.westBeach.width - 1,
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
      plateauGroup.add(makeMountainCaveEntrance());
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
          (platform === mountain.summit &&
            z < centerZ &&
            x >= mountain.summitLookout.x - 0.5 &&
            x <= mountain.summitLookout.x + mountain.summitLookout.width - 0.5);
        // 住家傳送點的石梯(homeStoneStairs)自己會蓋一組扶手(makeSteepStoneStairs)，
        // 跟其他單純門檻(isTransferOpening，沒有自帶扶手)不是同一種東西——
        // 沿用圓形門檻那套，圓弧邊界跟直線樓梯兩側扶手端點對不齊，看起來
        // 像斷開一截、樓梯憑空浮在原地。改用跟 lowerStair/upperStair 同一種
        // 「固定方形收邊」手法(isStairJoin 系列)：那組是南北向樓梯用 z 頭尾
        // 比對，這裡樓梯是東西向(directionX=1)，改成比對 z 帶(樓梯寬度)＋只
        // 認東側(x > centerX)，才不會跟西側平台邊界同一段 z 混在一起誤觸發。
        const homeStairs = mountain.homeStoneStairs;
        const isHomeStairJoin = (x: number, z: number, sideMargin = 0) =>
          platform === mountain.waist &&
          x > centerX &&
          z >= homeStairs.z - homeStairs.width / 2 - sideMargin &&
          z <= homeStairs.z + homeStairs.width / 2 + sideMargin;
        const isHomeStairShoulder = (x: number, z: number) =>
          isHomeStairJoin(x, z, shoulderWidth);
        const isOpening = (x: number, z: number) =>
          isStairOpening(x, z) ||
          isTransferOpening(x, z) ||
          isHomeStairJoin(x, z);
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
            isTransferOpeningShoulder(flatX, flatZ) ||
            isHomeStairShoulder(flatX, flatZ)
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
            isStairShoulder(topX, topZ) ||
            isTransferOpening(topX, topZ) ||
            isHomeStairShoulder(topX, topZ)
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
            isTransferOpening(midpointX, midpointZ) ||
            isHomeStairShoulder(midpointX, midpointZ)
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
      const bench = makeBench(summitCenterX - 5, summitCenterZ - 2, Math.PI, true);
      bench.position.y += mountain.summit.elevation;
      gameState.mapGroup.add(bench);
      const summitShrine = mountain.summitShrine;
      const summitShrineModel = makeMountainSummitShrine();
      summitShrineModel.position.set(
        summitShrine.x,
        mountain.summit.elevation,
        summitShrine.z,
      );
      gameState.mapGroup.add(summitShrineModel);

      // 山頂石標旁補一座小鳥居，呼應概念圖山頂那座小神社的意象；跟
      // 女神祠堂共用同一個 makeToriiGate()，不用另外做新造型。
      const summitTorii = makeToriiGate();
      summitTorii.scale.setScalar(LANDMARK_TORII_SCALE);
      summitTorii.position.set(
        mountain.skyPalaceGate.trigger.x,
        mountain.summit.elevation,
        mountain.skyPalaceGate.trigger.z,
      );
      gameState.mapGroup.add(summitTorii);

      // 靜態守護者放在小型神壇左側；純裝飾，不參與互動或排程。
      const mountainGuardian = makeMountainGuardian();
      mountainGuardian.position.set(
        summitShrine.x + summitShrine.guardianOffsetX,
        mountain.summit.elevation,
        summitShrine.z,
      );
      // 人形預設面朝本地 -Z；旋轉 180 度後面向地圖下方（+Z）。
      mountainGuardian.rotation.y = Math.PI;
      gameState.mapGroup.add(mountainGuardian);

      // 山腳平台補概念圖裡的長椅+營火+木欄杆+告示牌，這輪先只放在
      // 山腳一處，不是每個平台都鋪滿——山腰/山頂已經有樹/石標/長椅
      // 撐場面，山腳這批是唯一還缺裝飾的地方。
      // 座標刻意選在步道(=)東側的草地上(x=11~17)，避開(18,36)那棵既有
      // 的樹，也不蓋在主要動線上，看起來像特地圍起來的休息角落。
      const footRestX = mountain.foot.x + Math.floor(mountain.foot.width / 2);
      const footRestZ = mountain.foot.z + Math.floor(mountain.foot.depth / 2);
      const footBench = makeBench(footRestX + 2, footRestZ, Math.PI / 2, true);
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
      // 野花節點——跟木材/石頭同一套模式、同一批區域(不含 summit，山頂
      // 已經有神社/鳥居等地標，花叢會被擋到，2026-09-01 決定不放)。
      FLOWER_NODES.filter((n) => n.map === "mountain").forEach((n) => {
        if (!n.species) return;
        const cluster = makeFlowerCluster(n.species, n.x, n.z);
        cluster.position.y = mountainGroundY(n.x, n.z);
        cluster.visible = !n.collected;
        gameState.mapGroup.add(cluster);
        flowerNodeMeshes.push({ group: cluster, nodeId: n.id, map: "mountain" });
      });
      // 蘑菇節點——跟野花同一批區域，同一套渲染模式，只是每區只有 1 個。
      MUSHROOM_NODES.filter((n) => n.map === "mountain").forEach((n) => {
        if (!n.mushroomSpecies) return;
        const cluster = makeMushroomCluster(n.mushroomSpecies, n.x, n.z);
        cluster.position.y = mountainGroundY(n.x, n.z);
        cluster.visible = !n.collected;
        gameState.mapGroup.add(cluster);
        mushroomNodeMeshes.push({ group: cluster, nodeId: n.id, map: "mountain" });
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
  if (mapName === "mountainCave") {
    // 山之洞採礦系統(mine.ts)——跟鐘乳石洞窟同一套渲染邏輯，只是換成
    // gameState.mountainMineFloor/mountainMineUpStairs/
    // mountainMineDownStairs/MOUNTAIN_ORE_NODES 這組獨立狀態。上/下樓梯
    // 造型分派(makeMineStaircase("up",…)疊箱子、"down"+挖坑)完全沒改，
    // 「模組對調」是靠 mountainMineUpStairs()/mountainMineDownStairs()
    // 的角落公式互換角色達成的(見 mine.ts 山之洞那段開頭的長註解)——這
    // 裡上樓梯(疊箱子)現在對應「往深處/山頂」，跟鐘乳石洞窟上樓梯對應
    // 「往淺處/出口」正好相反；下樓梯(挖坑)現在對應「往淺處/出口」。
    const mountainFloor = gameState.mountainMineFloor;
    const mountainTier = ORE_TIERS[mineTierForFloor(mountainFloor) - 1];

    // 頂層(MOUNTAIN_MINE_FLOOR_MAX)沒有更深了，跟 tile 資料(mine.ts 的
    // makeMountainMineFloorTiles())用同一個 mountainMineUpStairs() 判斷。
    const mountainUp = mountainMineUpStairs(mountainFloor);
    if (mountainUp) {
      const upStair = makeMineStaircase("up", mountainTier.accentColor);
      upStair.position.set(mountainUp.x, 0, mountainUp.z);
      upStair.rotation.y = mineStairRotation("up");
      plateauGroup.add(upStair);
    } else {
      // 2026-08-26「天梯」：頂層(MOUNTAIN_MINE_FLOOR_MAX=25)本身沒有
      // 真正的上樓梯(上面 mountainUp 為 null，維持「頂層是死路」的碰撞/
      // 事件邏輯完全不動)，純視覺放一座 makeCelestialSpiralStaircase()
      // (transparent、懸空、發七彩光、無扶手，props.ts)在「如果有上樓梯
      // 會在哪個角落」那個位置——用跟 mountainMineUpStairs() 同一條奇偶
      // 公式(MOUNTAIN_STAIR_A/B，從 mine.ts 匯出)算角落，不用另外複製
      // 一份魔術數字。之前 props.ts 的註解誤寫「第30層」，是筆誤，設計
      // 稿(task.md)寫的是「山之洞第25層的上樓樓梯」——25 正是
      // MOUNTAIN_MINE_FLOOR_MAX，兩者本來就該是同一個數字。這裡先只是
      // 純裝飾(暗示「此處通往雲上天宮，但現在還沒開通」)，沒有另外接
      // 事件觸發——雲上天宮本身還沒建，之後那個任務定案要接通時，再回
      // 來把 mountainMineUpStairs()/上面的 if(mountainUp) 分支一起改成
      // 真正可以往上走的邏輯，這裡不用先動。
      const celestialCorner =
        mountainFloor % 2 === 1 ? MOUNTAIN_STAIR_B : MOUNTAIN_STAIR_A;
      // 2026-08-26 玩家實測回報三點：(1) 轉 180 度——原本的朝向從這個
      // 角落看過去繞錯邊；(2) 階梯密度調高兩倍——每階角度/每階爬升
      // 同時砍半(角度 40°→20°、爬升 0.3→0.15)，同樣的爬升/角度範圍
      // 內塞進兩倍階梯，疏密感翻倍，單圈半徑沒變；(3) 往上蓋到玩家
      // 視線範圍——先試過 70 階(總爬升 10.5，原本 4.2 的 2.5 倍)，
      // 玩家實機看過回報「改 1.5 倍梯數應該剛剛好」，改成 42 階
      // (0.15/階 x 42=總爬升 6.3，是原本 4.2 的 1.5 倍——這裡「1.5倍」
      // 取的是相對『兩倍密度、高度不變』那個中繼版本(28 階)的 1.5 倍，
      // 不是直接把 70 打 1.5 折，這樣算出來的總高度倍率剛好也是
      // 1.5 倍，兩種算法在這裡殊途同歸)。
      // (4) 寬度調整成三倍——加寬的是 treadWidth(每一階踏面沿著行進
      // 方向的寬度，不是螺旋半徑 radius，半徑維持 0.9 不動)，從預設
      // 0.62 改成 1.86。密度加倍後每階角度只有 20 度，弧長間距
      // (radius*angleStepRad≈0.31)遠小於 1.86，踏面彼此會明顯疊在
      // 一起——這是預期內的，材質本來就是半透明+關閉深度寫入
      // (上面 stepMats 那段的 depthWrite:false)，就是為了讓一整排疊
      // 起來的踏面融合成一條連續發光緞帶，不會因為互相遮蔽出現硬邊。
      // 2026-08-26 第三輪：「效果不錯，現在複製往上延長三倍，然後看
      // 能不能加點閃耀特效」——「複製」照字面直接做：同一組參數(含
      // rotationDegrees:180)呼叫 3 次，只有 baseY 往上疊，疊出來是 3
      // 座完全相同的螺旋堆疊在一起(不是把角度也接續算下去、做成一條
      // 連續大螺旋)——單座總爬升 6.3，3 座疊起來總高度 18.9。
      //
      // 2026-08-27 玩家實測回報「複製三個會導致無法接連」——問題就出在
      // 上一段講的「不是把角度也接續算下去」：3 座全部用同一個
      // rotationDegrees(=180)，也就是每一座的第 0 階角度都相同，只有
      // baseY 不同。但單一座內部的角度是從 i=0 掃到 i=steps-1(=41)，
      // 掃過 41×20=820 度，對 360 取餘是 100 度——也就是「爬完一座
      // 天梯後，實際站的角度位置」比「這座的起點角度」多轉了 100 度。
      // 下一座卻是原地從跟第一座一模一樣的起點角度(180 度)重新開始，
      // 兩座之間憑空多出一段 100 度、完全沒有踏面的空隙，玩家爬到
      // 第一座頂端根本接不到第二座——這就是回報的「無法接連」。
      // (baseY 那段疊高度的算法本身沒問題：第 N 座的第 0 階，高度
      // 正好接在第 N-1 座最後一階之後再加一階，本來就是連續的；只有
      // 角度沒有跟著接續，兩者對不上。)
      //
      // 修法：不能讓每一座的 rotationDegrees 都相同，下一座的起點角度
      // 要接著上一座的終點角度、往同一個方向繼續轉，用跟單座內部
      // 「每階多轉 angleStepDegrees」同一條規則往外推——把 N 座想成
      // 同一條連續螺旋只是分批建立 mesh，第 N 座的第 0 階在角度上必須
      // 等於「假設沒有分段，連續數到第 N 座第 0 階應該在的角度」，算
      // 出來是每複製一份要多轉 steps × angleStepDegrees(=42×20=840，
      // 對 360 取餘 =120 度)，不是玩家原本猜測的 90 度——90 度只是
      // 縮小了對不齊的落差，兩座踏面仍然不會真正相接；只有精算出來的
      // 120 度才會讓相鄰兩座首尾剛好差一個 angleStepDegrees，跟座內
      // 每階的間距完全一致，接起來才會是真正連續、沒有斷點的一條
      // 螺旋緞帶。角度遞增的方向沿用原本每階角度遞增(+angleStepDegrees)
      // 同一個轉向，跟玩家講的「逆時針」是同一個方向，只是把猜測的
      // 90 度換成精算出來的 120 度。
      //
      // 高度改 5 倍：原本 3 座疊出的總高度是 18.9，玩家要求改成 5 倍
      // (=94.5)。維持「每一份 6.3」(=42 階 × 0.15/階)這個單位不變，
      // 把複製份數從 3 改成 15(=3×5)疊出 94.5——沿用原本「複製 N 份」
      // 這個機制，只把 N 從 3 改成 15；配合上面角度接續的修正公式，
      // 15 份會連成一條完整不斷開的螺旋，不是 15 座互相獨立、各自
      // 斷開的堆疊。
      const celestialSteps = 42;
      const celestialAngleStepDegrees = 20;
      const celestialRisePerStep = 0.15;
      const celestialSegmentRise = celestialSteps * celestialRisePerStep;
      const celestialCopies = 15;
      const celestialTotalHeight = celestialSegmentRise * celestialCopies;
      // 每複製一份要多轉的角度——見上面註解的推導，等於「單座內部
      // 掃過的完整角度」(steps × angleStepDegrees)對 360 取餘。
      const celestialContinuationDegrees =
        (celestialSteps * celestialAngleStepDegrees) % 360;
      for (let segment = 0; segment < celestialCopies; segment++) {
        const { group: celestialStaircase } = makeCelestialSpiralStaircase({
          x: celestialCorner.x,
          z: celestialCorner.z,
          baseY: segment * celestialSegmentRise,
          steps: celestialSteps,
          radius: 0.9,
          risePerStep: celestialRisePerStep,
          angleStepDegrees: celestialAngleStepDegrees,
          rotationDegrees: 180 + segment * celestialContinuationDegrees,
          treadWidth: 1.86,
        });
        plateauGroup.add(celestialStaircase);
      }
      // 閃耀特效——散落在整座(3倍高之後)天梯周圍的星點，材質/貼圖沿用
      // scene-sky.ts 星空那套(makeCelestialSparkles() 內部說明)。
      // seed 用 celestialCorner.x 讓兩個角落(奇偶樓層)灑出的星點位置不同，
      // 不會每次都長一樣。材質存進 celestialSparkleMaterials(見
      // scene-registries.ts)，animate() 逐幀更新 opacity 做出閃爍。
      const { group: celestialSparkles, materials: celestialSparkleMats } =
        makeCelestialSparkles({
          x: celestialCorner.x,
          z: celestialCorner.z,
          baseY: 0,
          height: celestialTotalHeight,
          radius: 0.9,
          count: 150,
          seed: celestialCorner.x,
        });
      plateauGroup.add(celestialSparkles);
      celestialSparkleMaterials.push(...celestialSparkleMats);
    }
    // 出口方向永遠存在(包含第 1 層，用來走出洞口)，不像上樓梯要判斷
    // 頂層，這裡不用 if 包起來。
    const mountainDown = mountainMineDownStairs(mountainFloor);
    const pitRockColor = new THREE.Color(0x2a2c27).lerp(
      new THREE.Color(mountainTier.color),
      0.12,
    );
    const pit = makeMinePitRecess(pitRockColor);
    pit.position.set(mountainDown.x, 0, mountainDown.z);
    plateauGroup.add(pit);
    const downStair = makeMineStaircase("down", mountainTier.color);
    downStair.position.set(mountainDown.x, 0, mountainDown.z);
    downStair.rotation.y = mineStairRotation("down");
    plateauGroup.add(downStair);

    // 礦石節點——跟鐘乳石洞窟同一套「靠近按 E 就沒了」的採集慣例，登記進
    // 同一份 oreNodeMeshes(nodeId 前綴不同，見 mine.ts，不會跟鐘乳石洞窟
    // 的節點撞名)。
    MOUNTAIN_ORE_NODES.forEach((n) => {
      const node = makeOreNode(
        n.x,
        n.z,
        mountainTier.color,
        mountainTier.accentColor,
        n.colorSeed,
      );
      node.visible = !n.collected;
      plateauGroup.add(node);
      oreNodeMeshes.push({ group: node, nodeId: n.id });
    });

    // 天花板垂幾根鐘乳石當氣氛裝飾——「先套用同樣模板就好」，先不因為是
    // 「山之洞」就換一套裝飾，跟鐘乳石洞窟同一份決定性灑點寫法，種子
    // 位移錯開(+190/+70)避免跟鐘乳石洞窟同樓層數字灑出同一批座標。
    const mountainDecorRockMat = new THREE.MeshStandardMaterial({
      color: 0x33362f,
      roughness: 1,
      flatShading: true,
    });
    for (let i = 0; i < 26; i++) {
      const nx = hash2(mountainFloor * 9.3 + i * 4.1 + 190, i * 2.2);
      const nz = hash2(i * 6.7 + 70, mountainFloor * 5.1 + i * 1.3);
      const x = 3 + Math.floor(nx * (MOUNTAIN_MINE_SIZE - 6));
      const z = 3 + Math.floor(nz * (MOUNTAIN_MINE_SIZE - 6));
      if (
        mountainUp &&
        Math.abs(x - mountainUp.x) + Math.abs(z - mountainUp.z) < 3
      )
        continue;
      if (Math.abs(x - mountainDown.x) + Math.abs(z - mountainDown.z) < 3)
        continue;
      const len = 0.5 + hash2(x, z) * 0.6;
      const stalactite = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 + hash2(z, x) * 0.05, len, 6),
        mountainDecorRockMat,
      );
      stalactite.rotation.z = Math.PI;
      stalactite.position.set(x, 2.3 - len / 2, z);
      stalactite.castShadow = true;
      plateauGroup.add(stalactite);
    }
  }
  if (mapName === "oldVillage") {
    const goddessPosition = LAYOUT.oldVillage.goddess;
    const goddess = makeGoddess();
    goddess.position.set(
      goddessPosition.x,
      oldVillageGroundY(goddessPosition.x, goddessPosition.z),
      goddessPosition.z,
    );
    // 人形預設面朝本地 -Z；旋轉 180 度後面向地圖下方（+Z）。
    goddess.rotation.y = Math.PI;
    plateauGroup.add(goddess);

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
    const bench1 = makeBench(bench1Pos.x, bench1Pos.z, 0, true);
    const bench2 = makeBench(bench2Pos.x, bench2Pos.z, Math.PI, true);
    bench1.position.y += oldVillageGroundY(bench1Pos.x, bench1Pos.z);
    bench2.position.y += oldVillageGroundY(bench2Pos.x, bench2Pos.z);
    [bench1, bench2].forEach((prop) =>
      prop.traverse((child: any) => {
        if (child.isMesh) child.renderOrder = 2;
      }),
    );
    plateauGroup.add(bench1, bench2);

    // 城鎮 10 棟房子的門口/屋頂裝飾——每個對應 LAYOUT.oldVillage.houses
    // 裡的一個 role，讓房子從外觀就看得出用途(社區中心/醫院/醫生/
    // 護士/海洋學家/雜貨店兼行政中心/藝術家/民宿)，木匠家(role:
    // "carpenter")跟植物學家家(role:"botanist")都不在這裡處理：木匠
    // 維持劇情自己的施工牌/發光窗戶邏輯，植物學家家目前還沒有對應的
    // 門口裝飾(2026-09-05 她的房子才剛補進 houses[]，之後想加花缽/
    // 種子袋之類的道具再回頭補這個區塊)。
    // 2026-09-05：原本這裡有一個 role:"teacher" 的書本裝飾區塊，那個
    // role 已經隨這次城鎮重新配置一起退場(原本掛著這個 role 的房子
    // 改成海洋學家家了)，一併移除，不要留著吃不到 house 的死程式碼。
    const villageHouseByRole = (role) =>
      LAYOUT.oldVillage.houses.find((h) => h.role === role);
    const villageHouseFront = (h) => ({
      centerX: h.x + (h.w - 1) / 2,
      centerZ: h.z + (h.d - 1) / 2,
      frontZ: h.z + (h.d - 1) / 2 + (h.d / 2) * 0.98,
    });

    const communityCenter = villageHouseByRole("communityCenter");
    if (communityCenter) {
      const { centerX, centerZ, frontZ } = villageHouseFront(communityCenter);
      const cupola = makeBellCupola(centerX, centerZ);
      cupola.position.y = 1.3 + 0.85 + oldVillageGroundY(centerX, centerZ);
      plateauGroup.add(cupola);
      const flagX = centerX - communityCenter.w / 2 + 0.3;
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
  gameState.houseCeilingLampLights = [];
  gameState.houseCeilingLampBulbMats = [];
  if (mapName === "house" || mapName === "generalStore") {
    // 桌燈跟著餐桌一起搬到新格局的位置(x=11,z=6，見 layout-maps.ts 的
    // house.furniture)，2026-08-26 房子放大前後桌子座標不一樣，這裡要
    // 跟著換，不然燈會插在空地上、桌子底下沒燈。
    const lamp = makeLamp();
    lamp.group.position.set(11, 0.45, 6); // 桌上，桌面高度約 0.45
    plateauGroup.add(lamp.group);
    gameState.houseLampLight = lamp.light;
    gameState.houseLampBulbMat = lamp.bulbMat;

    // 2026-08-26 新增頂燈——掛在天花板高度(牆高 1.4，稍微退一點避免跟
    // 牆頂共面 z-fighting)。2026-09-03：Zeppelin 反饋單一盞(x=8 置中)
    // 太暗，尤其是隔間另一側(house 臥室／generalStore 雜貨店那半邊)
    // 幾乎照不到，改成隔間(x=7)左右各一盞：x=3 蓋西側(house 臥室／
    // generalStore 雜貨店貨架區)，x=11 蓋東側(house 餐廳／generalStore
    // 休憩區兼接待中心)，兩盞都跟原本一樣 z=6、距地板 1.36，
    // distance=7 個別涵蓋自己那一側。
    [3, 11].forEach((lampX) => {
      const ceilingLamp = makeCeilingLamp();
      ceilingLamp.group.position.set(lampX, 1.36, 6);
      plateauGroup.add(ceilingLamp.group);
      gameState.houseCeilingLampLights.push(ceilingLamp.light);
      gameState.houseCeilingLampBulbMats.push(ceilingLamp.bulbMat);
    });
  }

  avenueLeafMaterials.length = 0;
  map.tiles.forEach((row, z) => {
    row.forEach((tile, x) => {
      if (tile === 1 && (mapName === "house" || mapName === "generalStore")) {
        const winEntry = (map.windows || []).find(
          (w) => w.x === x && w.z === z,
        );
        const interiorWall = makeInteriorWall(
          x,
          z,
          winEntry ? winEntry.side : null,
        );
        plateauGroup.add(interiorWall);
        // z 是 tiles 陣列最後一列＝南牆＝離攝影機最近那排，登記進
        // southIndoorWallMeshes 讓 game-loop.ts 依鏡頭模式切換可見度
        // (見 scene-registries.ts 該常數上面的說明)。2026-08-27 玩家
        // 反饋「最左右兩個要顯示」——南牆兩端跟東西牆交接的那兩塊
        // 牆角(x=0/x=row.length-1)故意不登記，保持一直顯示，讓房間
        // 兩側邊界/牆角深度感還在，只把中間那段(真正擋住視線的部分)
        // 交給鏡頭模式切換。
        if (z === map.tiles.length - 1 && x !== 0 && x !== row.length - 1)
          southIndoorWallMeshes.push(interiorWall);
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
        // 同上面 house 分支的登記邏輯：z 是這張地圖 tiles 陣列的最後一
        // 列就是南牆，交給 game-loop.ts 依鏡頭模式切換可見度；跟 house
        // 分支一樣，兩端牆角(x=0/x=row.length-1)不登記、一直顯示。
        if (z === map.tiles.length - 1 && x !== 0 && x !== row.length - 1)
          southIndoorWallMeshes.push(wall);
      } else if (tile === 1 && mapName === "mountainCave") {
        // 山之洞牆體——跟鐘乳石洞窟同一套「純方塊+粗糙岩灰材質」寫法，
        // 只是牆色改混當層(gameState.mountainMineFloor)的礦石階層色。
        const mountainWallTier =
          ORE_TIERS[mineTierForFloor(gameState.mountainMineFloor) - 1];
        const mountainWallColor = new THREE.Color(0x4a4d47).lerp(
          new THREE.Color(mountainWallTier.color),
          0.22,
        );
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.98, 2.3, TILE * 0.98),
          new THREE.MeshStandardMaterial({
            color: mountainWallColor,
            roughness: 1,
            flatShading: true,
          }),
        );
        wall.position.set(x, 1.15, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        plateauGroup.add(wall);
        // 同上，登記南牆給 game-loop.ts 切換可見度；兩端牆角同樣不登記。
        if (z === map.tiles.length - 1 && x !== 0 && x !== row.length - 1)
          southIndoorWallMeshes.push(wall);
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
          // 跟上面 terraceMat 同一個道理、同一個修法：石板步道(tile===5)
          // 逐格貼在台地上，接縫處一樣需要防 z-fighting，但不能再用
          // depthWrite:false（會製造出一模一樣的「看穿地板」問題）。
          const pathMat = m.material as THREE.Material & {
            polygonOffset?: boolean;
            polygonOffsetFactor?: number;
            polygonOffsetUnits?: number;
          };
          pathMat.polygonOffset = true;
          pathMat.polygonOffsetFactor = -1;
          pathMat.polygonOffsetUnits = -1;
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
        const insideArea = (area) =>
          x >= area.x &&
          x < area.x + area.width &&
          z >= area.z &&
          z < area.z + area.height;
        if (insideArea(LAYOUT.restArea) || insideArea(LAYOUT.garden)) return;
        if (x >= 14 && x <= 16) return; // 坡道走廊留乾淨，不要長裝飾把路擋亂
        const r = hash2(x * 3.1, z * 7.7);
        const gy = groundY(x, z);
        // 2026-09-04 Zeppelin 要求：花田(LAYOUT.garden)附近的草地多擺一些
        // 純裝飾小花——花田本身(insideArea 那行)不長任何裝飾，保持乾淨
        // 好種植，但外圍留一圈緩衝帶，把裝飾花的機率大幅拉高，看起來像
        // 花從花田自然「溢出」到周圍草地，離花田越遠再退回原本的機率，
        // 不是整張地圖平均往上調（那樣會讓其他區域也一起變擁擠）。石頭
        // 的機率寬度(0.03)保持不變，只是門檻跟著花的門檻一起平移，不然
        // 花田附近機率整段往上抬之後，石頭反而會被排擠到幾乎抽不到。
        const GARDEN_FLOWER_MARGIN = 5;
        const nearGarden =
          x >= LAYOUT.garden.x - GARDEN_FLOWER_MARGIN &&
          x < LAYOUT.garden.x + LAYOUT.garden.width + GARDEN_FLOWER_MARGIN &&
          z >= LAYOUT.garden.z - GARDEN_FLOWER_MARGIN &&
          z < LAYOUT.garden.z + LAYOUT.garden.height + GARDEN_FLOWER_MARGIN;
        const flowerThreshold = nearGarden ? 0.26 : 0.14;
        if (r < 0.1) {
          const m = makeGrassTuft(x + (r - 0.5) * 0.4, z + (r - 0.5) * 0.4, r);
          m.position.y += gy;
          gameState.mapGroup.add(m);
        } else if (r < flowerThreshold) {
          const m = makeFlower(
            x + (r - 0.5) * 0.4,
            z + (r - 0.5) * 0.4,
            FLOWER_COLORS[Math.floor(r * 100) % 4],
          );
          m.position.y += gy;
          gameState.mapGroup.add(m);
        } else if (r < flowerThreshold + 0.03) {
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
        // 2026-09-04：跟牧草地北擴一樣，這片東側海面(緊貼東側海岸線的
        // 海面網格)北緣本來是寫死 -7，NORTH_CLIFF_Z/NORTH_TERRAIN_EXTENSION
        // 那次北擴 5 格時漏掉沒跟著動，導致新北側平台再往北一點就看不到
        // 海面。同步 -5，維持跟其他北擴地形一致的緩衝量。
        minZ = -7 - 5;
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
      const waveDirections = new Float32Array((posArray.length / 3) * 2);
      for (let i = 0; i < posArray.length / 3; i++) {
        const direction = getShorewardSeaWaveDirection(
          MAPS.livingArea.tiles,
          posArray[i * 3],
          posArray[i * 3 + 2],
          EAST_SEA_WAVE_DIRECTION,
        );
        waveDirections[i * 2] = direction.x;
        waveDirections[i * 2 + 1] = direction.z;
      }
      geo.userData = { basePositions: posArray.slice(), waveDirections };

      const oceanDepthMask = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshStandardMaterial({
          color: 0x245f7f,
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
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          // 深水（北邊主海域）幾乎不透明，跟淺水（湖、港口船塢）區分開——
          // 水深當作簡化過的透明度依據，不用真的算深度貼圖。
          opacity: 0.88,
        }),
      );
      waterSurfaceMaterials.push(
        gameState.oceanMesh.material as THREE.MeshBasicMaterial,
      );
      // 頂點座標已經是世界座標（每排西緣各自不同，不能再用單一中心點套用
      // PlaneGeometry 的本地座標系），mesh 本身只需要負責 y 的抬高量。
      // y 抬高一點：波浪的位移量如果蓋過地面（y=0）就會被不透明的地面擋住，
      // 變成海面中間破一個洞。留出安全間距讓波浪永遠浮在地面之上
      gameState.oceanMesh.position.set(0, 0.13, 0);
      gameState.oceanMesh.receiveShadow = true;
      fishingWaterMeshes.push(gameState.oceanMesh);
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
          const tuft = makeWindGrass(jx, jz, seed);
          tuft.userData.tileX = gx;
          tuft.userData.tileZ = gz;
          setPastureGrassStage(tuft, pastureGrassStageAt(gx, gz));
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

    // 蜂箱——初始無，storyState.flags["beehive.unlocked"] 為 true 才會
    // 蓋出來(預計第三天植物學家事件解鎖，見 game-state.ts 該段開頭註解)；
    // 沒解鎖前這裡完全不放模型，isBlocked() 那邊的碰撞判定
    // (isPointInsideBeehive)本身也會因為同一個 flag 自動放行，兩邊不用
    // 各自維護一份「有沒有解鎖」的判斷。
    if (isBeehiveUnlocked()) {
      plateauGroup.add(makeBeehive(BEEHIVE_VISUAL.x, BEEHIVE_VISUAL.z));
    }

    // 生活區採集點：靠西側山景的開闊草地，每個半日批次各 5 木、5 石。
    WOOD_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      const pile = makeWoodPile(n.x, n.z);
      if (n.id.startsWith("prologue-farm-")) {
        pile.position.x += (hash2(n.x * 1.73, n.z * 2.11) - 0.5) * 0.34;
        pile.position.z += (hash2(n.x * 2.47, n.z * 1.39) - 0.5) * 0.34;
        pile.rotation.y = hash2(n.x * 3.17, n.z * 2.83) * Math.PI * 2;
      }
      pile.visible = !n.collected;
      plateauGroup.add(pile);
      gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "livingArea" });
    });
    STONE_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      const pile = makeStonePile(n.x, n.z);
      if (n.id.startsWith("prologue-farm-")) {
        pile.position.x += (hash2(n.x * 2.19, n.z * 1.61) - 0.5) * 0.34;
        pile.position.z += (hash2(n.x * 1.31, n.z * 2.93) - 0.5) * 0.34;
        pile.rotation.y = hash2(n.x * 2.71, n.z * 3.43) * Math.PI * 2;
      }
      pile.visible = !n.collected;
      plateauGroup.add(pile);
      gatherNodeMeshes.push({ group: pile, nodeId: n.id, map: "livingArea" });
    });
    // 野花節點——生活區山腳(mountainSide)，跟木材/石頭同一套模式。
    FLOWER_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      if (!n.species) return;
      const cluster = makeFlowerCluster(n.species, n.x, n.z);
      cluster.visible = !n.collected;
      plateauGroup.add(cluster);
      flowerNodeMeshes.push({ group: cluster, nodeId: n.id, map: "livingArea" });
    });
    // 蘑菇節點——生活區山腳，同一套模式。
    MUSHROOM_NODES.filter((n) => n.map === "livingArea").forEach((n) => {
      if (!n.mushroomSpecies) return;
      const cluster = makeMushroomCluster(n.mushroomSpecies, n.x, n.z);
      cluster.visible = !n.collected;
      plateauGroup.add(cluster);
      mushroomNodeMeshes.push({ group: cluster, nodeId: n.id, map: "livingArea" });
    });

    // 行道樹右側正式分成上下兩區：上方聚會／個人放鬆，下方小花園。
    // 2026-09-03：露比事件結尾那句「牧場不是有空地嗎？」正式接上，改由
    // flowerBedGroup(farm-visuals.ts)畫真正可種/可收的花圃。
    // 2026-09-04：Zeppelin 反饋 makeSmallGarden() 的草坪／碎石步道／
    // 鳥浴盆都是純裝飾、跟真正的花田(flowerBedGroup)疊在一起反而顯得
    // 多餘，整個拿掉，只留圍籬圈住同一塊地。makeSmallGarden() 函式本身
    // 留著沒刪，之後如果想在別處放同一套裝飾小花園還能直接用。
    plateauGroup.add(makeRestArea(LAYOUT.restArea));
    plateauGroup.add(
      makeFence(
        LAYOUT.garden.x,
        LAYOUT.garden.x + LAYOUT.garden.width - 1,
        LAYOUT.garden.z,
        LAYOUT.garden.z + LAYOUT.garden.height - 1,
      ),
    );

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
      lGeo.userData = {
        basePositions: posArray.slice(),
        baseColors: new Float32Array(colors),
      };

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
      fishingWaterMeshes.push(gameState.lakeMesh);
      plateauGroup.add(gameState.lakeMesh);
      const lakeSkyUnderlay = new THREE.Mesh(
        lGeo.clone(),
        new THREE.MeshStandardMaterial({
          color: 0x32799b,
          roughness: 1,
          metalness: 0,
          side: THREE.DoubleSide,
          // 淺湖底色刻意比海洋明亮，避免夜間俯視看起來像無底黑洞。
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
  rebuildSeatTargets(gameState.mapGroup, mapName);
  scene.add(gameState.mapGroup);
  gameState.currentMapName = mapName;
  npcGroup.position.y = 0;
  npcs.forEach((npc) => {
    if (
      npc.id === "chef" ||
      (npc.id === "artist" && getNpcNameStage("artist") === 0)
    ) {
      // 藝術家要等正式登島／招募事件解鎖；換圖不可把初始隱藏覆蓋掉。
      npc.mesh.visible = false;
    } else if (npc.id === "carpenter") {
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
  animalGroup.visible =
    mapName === "livingArea" && (gameState.ownedAnimals?.length ?? 0) > 0;
  syncFarmVisuals();
  syncFlowerBedVisuals();
}

export function syncPlayerAppearance() {
  const appearance = gameState.playerAppearance;
  removeStalePlayerMeshes(scene, gameState.player || null);
  if (gameState.player?.userData?.playerAppearance === appearance) {
    markRuntimePlayerMesh(gameState.player);
    if (gameState.player.parent !== scene) scene.add(gameState.player);
    return;
  }
  const previous = gameState.player;
  const replacement = markRuntimePlayerMesh(makeHeroPlayer(appearance));
  if (previous) {
    replacement.position.copy(previous.position);
    replacement.rotation.copy(previous.rotation);
    replacement.visible = previous.visible;
    previous.parent?.remove(previous);
  }
  gameState.player = replacement;
  scene.add(replacement);
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
  if (mapName === "livingArea" && isPointInsideBeehive(x, z)) return true;
  if (mapName === "mountain") {
    const shrine = LAYOUT.mountain.summitShrine;
    if (
      Math.abs(x - shrine.x) <= shrine.collisionHalfWidth &&
      Math.abs(z - shrine.z) <= shrine.collisionHalfDepth
    )
      return true;
  }
  if (mapName === "livingArea" && z < 0) {
    const onNorthPlateau =
      x >= 0 && x < LAYOUT.coast.rampX && z >= northCliffEdgeZ(x) + 0.62;
    return !onNorthPlateau;
  }
  if (tz < 0 || tz >= map.tiles.length || tx < 0 || tx >= map.tiles[0].length)
    return true;
  if (mapName === "oldVillage") {
    const cube = LAYOUT.oldVillage.northBeachPlatform.cube;
    if (
      x >= cube.x - 0.5 &&
      x <= cube.x + cube.width - 0.5 &&
      z >= cube.z - 0.5 &&
      z <= cube.z + cube.depth - 0.5
    )
      return true;
  }
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

// 依地圖名稱換算某座標的地面 Y——loadMap() 換圖時用這個決定玩家該站
// 在哪個高度，跟下面 loadMap() 內部這段算式共用同一份實作，避免兩處
// 各自維護一份容易長歪(這正是 input-save.ts 同圖讀檔那段漏掉補 Y、
// 玩家在港口讀檔陷進地板的成因——2026-09-04 Zeppelin 反饋)。
export function groundYForMap(mapName: string, x: number, z: number) {
  return mapName === "livingArea"
    ? groundY(x, z)
    : mapName === "port"
      ? portGroundY(x, z)
      : mapName === "oldVillage"
        ? oldVillageGroundY(x, z) + 0.03
        : mapName === "mountain"
          ? mountainGroundY(x, z) + (isOnMountainStair(x, z) ? 0.3 : 0.08)
          : 0;
}

export function loadMap(mapName, startPos, onLoaded?: () => void | false) {
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
    // 山之洞同一份保險：見上面鐘乳石洞窟那則註解，道理一樣，只是換成
    // 獨立的 mountainMineFloor/mountainCave 那組狀態。
    if (mapName === "mountainCave")
      regenerateMountainMineFloorTiles(gameState.mountainMineFloor);
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
    syncPlayerAppearance();
    gameState.player.position.x = gameState.playerGridPos.x;
    gameState.player.position.z = gameState.playerGridPos.z;
    gameState.player.position.y = groundYForMap(
      mapName,
      gameState.playerGridPos.x,
      gameState.playerGridPos.z,
    );
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
    const shouldFadeIn = onLoaded?.() !== false;
    if (shouldFadeIn) fadeIn();
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
    // 2026-08-25 左右各擴張 1 格：count 對齊 mountainGate/townGate 的
    // width(=3)，index 0/1/2 對應 x-1/x/x+1，兩側用同一個 index 取值，
    // 從舊城鎮左緣走進去就落在山路左緣、右緣對右緣，不會左右跳位。
    a: {
      map: "oldVillage",
      count: LAYOUT.oldVillage.mountainGate.width,
      triggerAt: (i) => ({
        x: LAYOUT.oldVillage.mountainGate.x + i - 1,
        z: LAYOUT.oldVillage.mountainGate.z,
      }),
      arrivalAt: (i) => ({
        x: LAYOUT.oldVillage.mountainArrival.x + i - 1,
        z: LAYOUT.oldVillage.mountainArrival.z,
      }),
    },
    b: {
      map: "mountain",
      count: LAYOUT.mountain.townGate.width,
      triggerAt: (i) => ({
        x: LAYOUT.mountain.townGate.x + i - 1,
        z: LAYOUT.mountain.townGate.z,
      }),
      arrivalAt: (i) => ({
        x: LAYOUT.mountain.townArrival.x + i - 1,
        z: LAYOUT.mountain.townArrival.z,
      }),
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

// 山之洞(向上爬版本)進出/換樓——跟鐘乳石洞窟那三個手寫 action 同一個
// 角色(進洞口重置樓層、踩樓梯依樓層決定換樓層或離開)，只是「往上」跟
// 「往下」的行為整個對調：這裡踩上樓梯(mountainMineUpStairs，疊箱子
// 造型)是純樓層前進(往深處/山頂，沒有提示)，踩下樓梯
// (mountainMineDownStairs，挖坑造型)才會問要不要直接回鎮上——跟鐘乳石
// 洞窟正好相反，原因見 mine.ts 山之洞那段開頭的長註解。
function enterMountainMine() {
  regenerateMountainMineFloor(1);
  loadMap("mountainCave", mountainMineDownStairs(1));
}
function goToTownFromMountainMine() {
  const cave = LAYOUT.mountain.cave;
  const mouthZ = cave.z + cave.depth - 1;
  loadMap("mountain", {
    x: cave.entranceX + Math.floor((cave.entranceWidth - 1) / 2),
    z: mouthZ + 1,
  });
}
// 純樓層前進，踩了就走，不彈提示——對應鐘乳石洞窟的 mineGoDown()，但
// 綁在 mountainMineUpStairs()(往深處/山頂)而不是 mineDownStairs()。
function mountainMineGoUp() {
  if (gameState.mountainMineFloor >= MOUNTAIN_MINE_FLOOR_MAX) return;
  regenerateMountainMineFloor(gameState.mountainMineFloor + 1);
  loadMap("mountainCave", mountainMineDownStairs(gameState.mountainMineFloor));
}
// 每層都問一次要不要直接回鎮上——對應鐘乳石洞窟的 mineGoUp()，但綁在
// mountainMineDownStairs()(往淺處/出口)而不是 mineUpStairs()，這正是
// 玩家要求的「對話選項邏輯要換」。
function mountainMineGoDown() {
  const atSurface = gameState.mountainMineFloor <= 1;
  showChoice(
    "要直接下山回鎮上嗎？",
    atSurface
      ? [
          { label: "回鎮上", value: "town" },
          { label: "繼續往上爬", value: "stay" },
        ]
      : [
          { label: "回鎮上", value: "town" },
          { label: "下一層", value: "step" },
        ],
    (choice) => {
      if (choice === "stay") return;
      if (choice === "town") {
        goToTownFromMountainMine();
        return;
      }
      regenerateMountainMineFloor(gameState.mountainMineFloor - 1);
      loadMap(
        "mountainCave",
        mountainMineUpStairs(gameState.mountainMineFloor) ||
          mountainMineDownStairs(gameState.mountainMineFloor),
      );
    },
  );
}

export const events = [
  ...worldTransitionEvents,
  // 山之洞第 25 層天梯區（43~45, 2~4）通往雲上天宮。低樓層同一組
  // 座標仍可能走得到，因此 getter 在非頂層回傳 -1，避免提前傳送。
  ...Array.from(
    {
      length:
        LAYOUT.mountainCave.skyPalaceGate.width *
        LAYOUT.mountainCave.skyPalaceGate.depth,
    },
    (_, index) => ({
      map: "mountainCave",
      get x() {
        return gameState.mountainMineFloor === MOUNTAIN_MINE_FLOOR_MAX
          ? LAYOUT.mountainCave.skyPalaceGate.x +
              (index % LAYOUT.mountainCave.skyPalaceGate.width)
          : -1;
      },
      get z() {
        return gameState.mountainMineFloor === MOUNTAIN_MINE_FLOOR_MAX
          ? LAYOUT.mountainCave.skyPalaceGate.z +
              Math.floor(index / LAYOUT.mountainCave.skyPalaceGate.width)
          : -1;
      },
      trigger: "touch",
      action: () => loadMap("skyPalace", { ...LAYOUT.skyPalace.caveArrival }),
    }),
  ),
  ...Array.from(
    {
      length: LAYOUT.skyPalace.caveGate.width * LAYOUT.skyPalace.caveGate.depth,
    },
    (_, index) => ({
      map: "skyPalace",
      x:
        LAYOUT.skyPalace.caveGate.x + (index % LAYOUT.skyPalace.caveGate.width),
      z:
        LAYOUT.skyPalace.caveGate.z +
        Math.floor(index / LAYOUT.skyPalace.caveGate.width),
      trigger: "touch",
      action: () => {
        gameState.mountainMineFloor = MOUNTAIN_MINE_FLOOR_MAX;
        loadMap("mountainCave", {
          ...LAYOUT.mountainCave.skyPalaceArrival,
        });
      },
    }),
  ),
  {
    map: "mountain",
    x: LAYOUT.mountain.skyPalaceGate.trigger.x,
    z: LAYOUT.mountain.skyPalaceGate.trigger.z,
    trigger: "touch",
    action: () =>
      loadMap("skyPalace", { ...LAYOUT.skyPalace.mountainGate.arrival }),
  },
  {
    map: "skyPalace",
    x: LAYOUT.skyPalace.mountainGate.trigger.x,
    z: LAYOUT.skyPalace.mountainGate.trigger.z,
    trigger: "touch",
    action: () =>
      loadMap("mountain", { ...LAYOUT.mountain.skyPalaceGate.arrival }),
  },
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
  // 山之洞洞口——跟鐘乳石洞窟同一套「沿入口寬度整排都能走進去」寫法，
  // 座標用 LAYOUT.mountain.cave 現值推導。
  ...Array.from({ length: LAYOUT.mountain.cave.entranceWidth }, (_, i) => ({
    map: "mountain",
    x: LAYOUT.mountain.cave.entranceX + i,
    z: LAYOUT.mountain.cave.z + LAYOUT.mountain.cave.depth - 1,
    trigger: "touch",
    action: () => enterMountainMine(),
  })),
  {
    // 上樓梯(疊箱子，往深處/山頂)——山之洞這裡可能不存在(頂層之後沒有
    // 更深了)，所以跟鐘乳石洞窟的下樓梯事件一樣用 ?? -1 安全預設。
    map: "mountainCave",
    get x() {
      return mountainMineUpStairs(gameState.mountainMineFloor)?.x ?? -1;
    },
    get z() {
      return mountainMineUpStairs(gameState.mountainMineFloor)?.z ?? -1;
    },
    trigger: "touch",
    action: () => mountainMineGoUp(),
  },
  {
    // 下樓梯(挖坑，往淺處/出口)——每層都存在(包含第 1 層，用來走出洞口)，
    // 不用 optional chaining，跟鐘乳石洞窟的上樓梯事件一樣。
    map: "mountainCave",
    get x() {
      return mountainMineDownStairs(gameState.mountainMineFloor).x;
    },
    get z() {
      return mountainMineDownStairs(gameState.mountainMineFloor).z;
    },
    trigger: "touch",
    action: () => mountainMineGoDown(),
  },
  {
    map: "livingArea",
    x: LAYOUT.house.doorX,
    z: LAYOUT.house.z + LAYOUT.house.d,
    trigger: "touch",
    action: () => loadMap("house", { ...MAPS.house.playerStart }),
  },
  // 2026-08-26 房子內部放大兩倍，門從舊格局的 (2,6)/(3,6)(8x7 格局最後
  // 一排)搬到新格局的 (7,13)/(8,13)(16x14 格局最後一排，見
  // layout-maps.ts 的 MAPS.house.tiles)，兩格門改用 Array.from 一次
  // 登記，不用複製貼上兩份幾乎一樣的物件。外部(LAYOUT.house，w/d/doorX)
  // 沒有變，落點公式不用動。
  ...Array.from({ length: 2 }, (_, i) => ({
    map: "house",
    x: 7 + i,
    z: 13,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: LAYOUT.house.doorX,
        z: LAYOUT.house.z + LAYOUT.house.d + 1,
      }),
  })),
  // 雜貨店——2026-09-03 Zeppelin 先指定了一組開發用捷徑傳送點(硬寫死
  // 舊城鎮(149,26)/(150,26))，跟 shrine (4,2) 那組「先送過去方便建模/
  // 測試」的做法同一套，方便當時雜貨店外觀還沒做好時先能測室內。
  // 2026-09-05：雜貨店外觀(role:"generalStore"那棟)其實已經做好一段
  // 時間了，這組捷徑座標卻一直沒回頭校準，z=26 離房子實際位置(z=13
  // 那排)差了 13 格，等於玩家踩到的傳送點跟門口實際看起來完全對不上。
  // 改用 GENERAL_STORE_DOORSTEP(layout-maps.ts，find(role) 動態算，房子
  // 之後再搬家這裡不用跟著手動改數字)算出真正貼在門口的兩格。室內門口
  // 踩回去對稱地跟兩個觸發點分別錯開一格，不會一踏出門就立刻反彈回來。
  ...Array.from({ length: 2 }, (_, i) => ({
    map: "oldVillage",
    x: Math.floor(GENERAL_STORE_DOORSTEP.x) + i,
    z: GENERAL_STORE_DOORSTEP.z,
    trigger: "touch",
    action: () => loadMap("generalStore", { ...MAPS.generalStore.playerStart }),
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    map: "generalStore",
    x: 7 + i,
    z: 13,
    trigger: "touch",
    action: () =>
      loadMap("oldVillage", {
        x: Math.floor(GENERAL_STORE_DOORSTEP.x) + i,
        z: GENERAL_STORE_DOORSTEP.z + 1,
      }),
  })),
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
  // 木匠抵達事件——港口使用 LAYOUT 定義的矩形觸發區，玩家從碼頭任一側
  // 靠近都能觸發；stage 仍會阻止同一事件重複播放。
  ...Array.from(
    {
      length:
        LAYOUT.port.carpenterMeet.width * LAYOUT.port.carpenterMeet.height,
    },
    (_, index) => ({
      map: "port",
      x:
        LAYOUT.port.carpenterMeet.x + (index % LAYOUT.port.carpenterMeet.width),
      z:
        LAYOUT.port.carpenterMeet.z +
        Math.floor(index / LAYOUT.port.carpenterMeet.width),
      trigger: "touch",
      action: () => handleCarpenterDockTouch(),
    }),
  ),
  {
    map: "oldVillage",
    x: CARPENTER_DOORSTEP.x,
    z: CARPENTER_DOORSTEP.z,
    trigger: "touch",
    action: () => handleCarpenterDoorstepTouch(),
  },
  // 露比個人事件——木匠事件結束後她站在 ARTIST_EVENT_WAIT_POS (142,17)
  // 等，玩家一走近就自動觸發（劇本是「玩家靠近」，不是特地按 E），跟
  // CARPENTER_DOORSTEP/CARPENTER_EVENT_WAIT_POS 同一招：觸碰點跟 NPC
  // 實際站的格子錯開一格（她南邊 z+1），玩家從南邊走過來時踩到觸碰點，
  // 不用真的疊到她的模型上面。
  {
    map: "oldVillage",
    x: ARTIST_EVENT_WAIT_POS.x,
    z: ARTIST_EVENT_WAIT_POS.z + 1,
    trigger: "touch",
    action: () => handleArtistWaitTouch(),
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
  {
    // 2026-08-26 暫時的開發用傳送點——task.md「海底龍宮建模」那段要求
    // 「為了方便先在[shrine] (4,2)加上傳送點直接送過去」，讓測試/後續
    // 建模海底龍宮時不用每次從舊城鎮沙灘走進鐘乳石洞窟、手動下 25 層。
    // 直接重生成第 25 層(鐘乳石洞窟目前的最深層，MINE_FLOOR_MAX，見
    // mine.ts)並落在該層的「上樓梯」位置——跟 mineGoDown() 換樓層時
    // 的落點規則完全一樣(loadMap("stalactiteCave", mineUpStairs(下一層)))，
    // 不是另外發明一個「抵達地點」，25 層本身现在還沒有專屬內容，跟其他
    // 樓層一樣是 regenerateMineFloor() 隨機生成的洞窟房間+礦點。這是
    // 開發用捷徑，不是正式玩法的一部分，之後龍宮真的做出來、有自己的
    // 進出方式時可以考慮拿掉或保留當隱藏彩蛋，先不用糾結。
    map: "shrine",
    x: 4,
    z: 2,
    trigger: "touch",
    action: () => {
      regenerateMineFloor(MINE_FLOOR_MAX);
      loadMap("stalactiteCave", mineUpStairs(MINE_FLOOR_MAX));
    },
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
  // 2026-08-26 上下(z)各擴張 1 格：index 0/1/2 對應 z-1/z/z+1，兩側用
  // 同一個 index 取值，跟舊城鎮/山區那組門一樣的道理，觸發格跟落點對齊，
  // 不會左右(這裡是上下)跳位。
  ...Array.from({ length: MOUNTAIN_GATE_BLOCKER.width }, (_, i) => ({
    map: "livingArea",
    x: MOUNTAIN_GATE_BLOCKER.x,
    z: MOUNTAIN_GATE_BLOCKER.z + i - 1,
    trigger: "touch",
    action: () =>
      loadMap("mountain", {
        x: LAYOUT.mountain.homeArrival.x,
        z: LAYOUT.mountain.homeArrival.z + i - 1,
      }),
  })),
  ...Array.from({ length: LAYOUT.mountain.homeGate.width }, (_, i) => ({
    map: "mountain",
    x: LAYOUT.mountain.homeGate.x,
    z: LAYOUT.mountain.homeGate.z + i - 1,
    trigger: "touch",
    action: () =>
      loadMap("livingArea", {
        x: MOUNTAIN_GATE_BLOCKER.x + 1,
        z: MOUNTAIN_GATE_BLOCKER.z + 1 + i - 1,
      }),
  })),
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
