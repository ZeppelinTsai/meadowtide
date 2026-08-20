import * as THREE from "three";
import { hash2 } from "./utils";
import { gameState } from "./game-state";
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
  makeWaterSparklePoints,
} from "./scene-sky";
import {
  LAYOUT,
  MAPS,
  carpenterQuest,
  CARPENTER_HOUSE,
  isInsideLakeShape,
  AVENUE_TREE_KEYS,
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
  waterSparkleMaterials,
  outdoorLampLights,
  foamMeshes,
  windmillRotors,
  lakeShoreColliders,
  fishSchool,
  pastureGrassBlades,
  avenueLeafMaterials,
  seasonalTreeLeafMaterials,
  seasonalGroundMaterials,
  SEA_FISH_SCALE,
  LAKE_FISH_SCALE,
  EAST_SEA_WAVE_DIRECTION,
  NORTHEAST_SEA_WAVE_DIRECTION,
  thresholdMarkerMeshes,
  thresholdMarkersVisible,
} from "./scene-registries";
import {
  npcGroup,
  npcs,
  animalGroup,
  PASTURE,
  hasPastureGrassAt,
} from "./npc-runtime";
import { makeHeroPlayer } from "./humanoid";
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
  makeWesternMountainTerrain,
  makeMountainGateway,
  makeFishProp,
  makeLamp,
  makeStreetLamp,
  makeBench,
  makeFence,
  makeCampfireRing,
  makeInteriorWall,
  makeFurniture,
  updateSeasonalGroundColors,
  FLOWER_COLORS,
  makeFlagpole,
  makeBellCupola,
  makeMedicalSign,
  makeBookStack,
  makeEasel,
  makeShipWheelEmblem,
  makeHangingSignboard,
} from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import { OYSTER_RACK_VISUAL } from "./game-state";

// ==============================================================
// 10) 建場景
// ==============================================================
export function buildMap(mapName) {
  scene.remove(gameState.mapGroup);
  gameState.mapGroup = new THREE.Group();
  windowMats.length = 0;
  waterSurfaceMaterials.length = 0;
  waterSkyUnderlayMaterials.length = 0;
  waterSparkleMaterials.length = 0;
  outdoorLampLights.length = 0;
  seasonalTreeLeafMaterials.length = 0;
  seasonalGroundMaterials.length = 0;
  thresholdMarkerMeshes.length = 0;

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
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x6ab04c });
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
      gameState.mapGroup.add(slab);
    }
    const rampX = LAYOUT.coast.rampX;
    const lowlandX = rampX + LAYOUT.coast.rampWidth;
    groundSlab(0, rampX, PLATEAU_Y);
    const lowlandMat = new THREE.MeshStandardMaterial({
      color: 0x6ab04c,
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
    updateSeasonalGroundColors();

    // 右側沙灘也往北補齊，接住延伸後的海面與海堤，不留下綠色斷帶。
    // 第 0～2 排包含通往祠堂的沙洲，海格會被步道資料覆寫，因此不能只用
    // 第 0 排的 indexOf(9) 判斷海岸線。從北側數排中取第一個有效海岸；
    // 目前第 3 排就是玄武岩南側真正的海岸資料。
    const northOceanStartX = map.tiles
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
    // 海面本身保留半透明波光；下方用不透明深海層遮住相機星空，避免星星穿透水面。
    const northSeaMask = new THREE.Mesh(
      new THREE.PlaneGeometry(northSeaWidth + 0.4, northSeaDepth + 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x245574,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    northSeaMask.rotation.x = -Math.PI / 2;
    northSeaMask.position.set(
      northSeaCenterX,
      0.025,
      northSeaNearZ - northSeaDepth / 2,
    );
    northSeaMask.receiveShadow = true;
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
        opacity: 0.92,
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
    const oysterRaft = makeOysterRack(
      OYSTER_RACK_VISUAL.x,
      OYSTER_RACK_VISUAL.z,
    );
    oysterRaft.position.y = groundY(OYSTER_RACK_VISUAL.x, OYSTER_RACK_VISUAL.z);
    gameState.mapGroup.add(oysterRaft);

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
    // 因此與生活區沙灘保持同一套顏色與低模表面。
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(cols * TILE, 0.2, rows * TILE),
      new THREE.MeshStandardMaterial({
        color: 0xb8aa91,
        roughness: 0.96,
      }),
    );
    ground.position.set(
      (cols * TILE) / 2 - TILE / 2,
      -0.1,
      (rows * TILE) / 2 - TILE / 2,
    );
    ground.receiveShadow = true;
    gameState.mapGroup.add(ground);
    plateauGroup.add(makePortScene());
  } else {
    // oldVillage 這類獨立小地圖：跟 house 一樣是純平地，沒有懸崖/
    // 沙灘的高低差，plateauGroup 維持等於 gameState.mapGroup，不用另外墊高。
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(cols * TILE, 0.2, rows * TILE),
      new THREE.MeshStandardMaterial({
        color: mapName === "mountain" ? 0x596068 : 0x6ab04c,
        roughness: 1,
      }),
    );
    ground.position.set(
      (cols * TILE) / 2 - TILE / 2,
      -0.1,
      (rows * TILE) / 2 - TILE / 2,
    );
    ground.receiveShadow = true;
    gameState.mapGroup.add(ground);
    if (mapName === "oldVillage") {
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
      const addTerrace = (z, depth, elevation) => {
        const width = LAYOUT.oldVillage.terraces.westEdge + 0.5;
        const terrace = new THREE.Mesh(
          new THREE.BoxGeometry(width, elevation, depth),
          terraceMat,
        );
        terrace.position.set((width - 1) / 2, elevation / 2, z + (depth - 1) / 2);
        terrace.receiveShadow = true;
        terrace.castShadow = true;
        terrace.renderOrder = 1;
        gameState.mapGroup.add(terrace);
      };
      addTerrace(0, 10, LAYOUT.oldVillage.terraces.upper.elevation);
      addTerrace(10, 10, LAYOUT.oldVillage.terraces.middle.elevation);
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
            height / 2,
            stair.z + 1,
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
            stair.x + 1,
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
    } else if (mapName === "mountain") {
      const mountain = LAYOUT.mountain;
      const cliffMat = new THREE.MeshStandardMaterial({
        color: 0x747875,
        roughness: 1,
        flatShading: true,
      });
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0x78945a,
        roughness: 0.98,
      });
      const addPlatform = (platform) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(
            platform.width,
            platform.elevation + 0.24,
            platform.depth,
          ),
          [cliffMat, cliffMat, grassMat, cliffMat, cliffMat, cliffMat],
        );
        mesh.position.set(
          platform.x + (platform.width - 1) / 2,
          (platform.elevation - 0.24) / 2 + 0.025,
          platform.z + (platform.depth - 1) / 2,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        gameState.mapGroup.add(mesh);
      };
      addPlatform(mountain.foot);
      addPlatform(mountain.waist);
      addPlatform(mountain.summit);

      const topMats = [0xd0b982, 0x9a835f].map(
        (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
      );
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x565755,
        roughness: 1,
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
          gameState.mapGroup.add(mesh);
        }
      });

      [
        [3, 32],
        [21, 34],
        [4, 18],
        [23, 19],
        [7, 3],
        [20, 4],
        [6, 29],
        [22, 29],
        [11, 13],
        [18, 13],
        [25, 31],
        [26, 36],
      ].forEach(([x, z], index) => {
        const rock = makeStone(x, z, hash2(index * 2.7, 8.4));
        rock.position.y += mountainGroundY(x, z);
        rock.scale.setScalar(1.1 + (index % 3) * 0.25);
        gameState.mapGroup.add(rock);
      });
      const bench = makeBench(13, 7, Math.PI);
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
      ring.position.set(16.5, mountain.summit.elevation + 0.12, 6.5);
      summitMarker.add(ring);
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.9, 6),
        markerStone,
      );
      post.position.set(16.5, mountain.summit.elevation + 0.55, 6.5);
      summitMarker.add(post);
      gameState.mapGroup.add(summitMarker);

      // 山頂石標旁補一座小鳥居，呼應概念圖山頂那座小神社的意象；跟
      // 女神祠堂共用同一個 makeToriiGate()，不用另外做新造型。
      const summitTorii = makeToriiGate();
      summitTorii.scale.setScalar(0.75);
      summitTorii.position.set(15, mountain.summit.elevation, 8.2);
      gameState.mapGroup.add(summitTorii);

      // 山腳平台補概念圖裡的長椅+營火+木欄杆+告示牌，這輪先只放在
      // 山腳一處，不是每個平台都鋪滿——山腰/山頂已經有樹/石標/長椅
      // 撐場面，山腳這批是唯一還缺裝飾的地方。
      // 座標刻意選在步道(=)東側的草地上(x=11~17)，避開(18,36)那棵既有
      // 的樹，也不蓋在主要動線上，看起來像特地圍起來的休息角落。
      const footBench = makeBench(14, 38, Math.PI / 2);
      footBench.position.y += mountainGroundY(14, 38);
      gameState.mapGroup.add(footBench);
      const campfire = makeCampfireRing(14, 36);
      campfire.position.y += mountainGroundY(14, 36);
      gameState.mapGroup.add(campfire);
      const foothillFence = makeFence(11, 17, 34, 39);
      foothillFence.position.y += mountainGroundY(14, 36);
      gameState.mapGroup.add(foothillFence);
      const signpost = makeConstructionSign(6, 41);
      signpost.position.y += mountainGroundY(6, 41);
      gameState.mapGroup.add(signpost);
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
  if (mapName === "oldVillage") {
    // 廣場(LAYOUT.oldVillage.plaza：x=22~32,z=4~25)裡放兩盞路燈、兩張
    // 長椅，位置刻意離廣場邊界(x=22/33、跟港口門的垂直通道)有一段
    // 緩衝，不會卡到既有的門檻/道路。
    const plazaShiftX = LAYOUT.oldVillage.plaza.x - 22;
    const lamp1 = makeStreetLamp(25 + plazaShiftX, 8, 1);
    const lamp2 = makeStreetLamp(29 + plazaShiftX, 18, -1);
    [lamp1, lamp2].forEach((prop) =>
      prop.traverse((child: any) => {
        if (child.isMesh) child.renderOrder = 2;
      }),
    );
    plateauGroup.add(lamp1, lamp2);
    const bench1 = makeBench(26 + plazaShiftX, 12, 0);
    const bench2 = makeBench(30 + plazaShiftX, 14, Math.PI);
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
      } else if (tile === 2) {
        // 山腰平台(waist)這幾棵改用行道樹(makeAvenueTree)——那個模型
        // 本來就跟著季節變色(春粉紅/夏綠/秋橙紅/冬白)，剛好對應概念圖
        // 「賞櫻賞楓區域」：不用另外做櫻花/楓葉專用樹種，同一批樹春天
        // 看起來是賞櫻、秋天自然變成賞楓，比寫死單一顏色更合理。
        const inMountainWaist =
          mapName === "mountain" &&
          z >= LAYOUT.mountain.waist.z &&
          z < LAYOUT.mountain.waist.z + LAYOUT.mountain.waist.depth;
        const m =
          (mapName === "livingArea" && AVENUE_TREE_KEYS.has(`${x},${z}`)) ||
          inMountainWaist
            ? makeAvenueTree(x, z)
            : makeTree(x, z);
        m.position.y +=
          mapName === "livingArea"
            ? groundY(x, z)
            : mapName === "mountain"
              ? mountainGroundY(x, z)
              : 0;
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
  foamMeshes.length = 0;
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
        }),
      );
      oceanDepthMask.position.y = 0.025;
      oceanDepthMask.receiveShadow = true;
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
          opacity: 0.92,
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
      gameState.mapGroup.add(
        makeWaterSparklePoints(minX, minX + 32, dataMinZ, dataMaxZ, 95, 0.075),
      );

      // 星光倒影散布在真實資料涵蓋的海域(dataMinZ~dataMaxZ)，不撒到
      // 純視覺延伸的南側/遠海——那邊玩家平常看不到，撒了也是浪費。

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
          opacity: 0.9,
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
        }),
      );
      lakeSkyUnderlay.position.set(centerX, 0.035, centerZ);
      plateauGroup.add(lakeSkyUnderlay);
      waterSkyUnderlayMaterials.push(
        lakeSkyUnderlay.material as THREE.MeshStandardMaterial,
      );
      plateauGroup.add(
        makeWaterSparklePoints(
          centerX - radiusX,
          centerX + radiusX,
          centerZ - radiusZ,
          centerZ + radiusZ,
          34,
          0.065,
          (x, z) => isInsideLakeShape(x, z, 0.3),
        ),
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

  scene.add(gameState.mapGroup);
  gameState.currentMapName = mapName;
  npcGroup.visible =
    mapName === "livingArea" ||
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
        mapName === "oldVillage"
          ? LAYOUT.oldVillage.houseVisualScale
          : 1,
      ),
    )
  )
    return true;
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
    gameState.zoom = Math.min(
      gameState.zoom,
      mapName === "port" ? 20 : mapName === "mountain" ? 22 : 18,
    );
    updateCameraFrustum();
    buildMap(mapName);
    const pos = startPos || MAPS[mapName].playerStart;
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
      npcGroup.position.y = 0;
      const aunt = npcs.find((n) => n.id === "aunt");
      const carpenter = npcs.find((n) => n.id === "carpenter");
      [aunt, carpenter].forEach((npc, index) => {
        if (!npc) return;
        npc.mesh.visible = true;
        npc.mesh.position.set(pos.x + (index ? 1 : -1), gameState.player.position.y, pos.z + 1.4 + index * 0.7);
        npc.path = null;
        npc.lastTargetKey = null;
      });
    } else {
      npcGroup.position.y = PLATEAU_Y;
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
export const events = [
  {
    map: "livingArea",
    x: LAYOUT.house.doorX,
    z: LAYOUT.house.z + LAYOUT.house.d,
    trigger: "touch",
    action: () => loadMap("house", { x: 3, z: 5 }),
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
  ...Array.from({ length: LAYOUT.port.livingAreaGate.width }, (_, i) => ({
    map: "livingArea",
    x: LAYOUT.port.livingAreaGate.x + i,
    z: LAYOUT.port.livingAreaGate.z,
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
        x: LAYOUT.port.livingAreaGate.x + i,
        z: LAYOUT.port.livingAreaGate.z - 1,
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
    action: () => loadMap("shrine", { x: 4, z: 4 }),
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
  ...Array.from({ length: LAYOUT.oldVillage.livingAreaGate.width }, (_, i) => ({
    map: "livingArea",
    x: LAYOUT.oldVillage.livingAreaGate.x + i,
    z: LAYOUT.oldVillage.livingAreaGate.z,
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
        x: LAYOUT.oldVillage.livingAreaGate.x + i,
        z: LAYOUT.oldVillage.livingAreaGate.z - 1,
      }),
  })),
  {
    map: "oldVillage",
    x: LAYOUT.oldVillage.mountainGate.x,
    z: LAYOUT.oldVillage.mountainGate.z,
    trigger: "touch",
    action: () => loadMap("mountain", { x: 4, z: 41 }),
  },
  {
    map: "mountain",
    x: LAYOUT.mountain.townGate.x,
    z: LAYOUT.mountain.townGate.z,
    trigger: "touch",
    action: () => loadMap("oldVillage", { x: 1, z: 1 }),
  },
  {
    map: "livingArea",
    x: MOUNTAIN_GATE_BLOCKER.x,
    z: MOUNTAIN_GATE_BLOCKER.z,
    trigger: "touch",
    action: () =>
      loadMap("mountain", {
        x: LAYOUT.mountain.homeGate.x - 1,
        z: LAYOUT.mountain.homeGate.z,
      }),
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
  // 美術村 <-> 舊城鎮（南側新門檻）／港口（南側新門檻），兩邊都通
  {
    map: "oldVillage",
    x: LAYOUT.oldVillage.artVillageGate.x,
    z: LAYOUT.oldVillage.artVillageGate.z,
    trigger: "touch",
    action: () => loadMap("artVillage", { x: 3, z: 1 }),
  },
  {
    map: "artVillage",
    x: 3,
    z: 0,
    trigger: "touch",
    action: () =>
      loadMap("oldVillage", {
        x: LAYOUT.oldVillage.artVillageGate.x,
        z: LAYOUT.oldVillage.artVillageGate.z - 1,
      }),
  },
  {
    map: "oldVillage",
    x: LAYOUT.oldVillage.artVillageSouthGate.x,
    z: LAYOUT.oldVillage.artVillageSouthGate.z,
    trigger: "touch",
    action: () =>
      loadMap("artVillage", {
        x: LAYOUT.oldVillage.artVillageSouthGate.artX,
        z: LAYOUT.oldVillage.artVillageSouthGate.artZ + 1,
      }),
  },
  {
    map: "artVillage",
    x: LAYOUT.oldVillage.artVillageSouthGate.artX,
    z: LAYOUT.oldVillage.artVillageSouthGate.artZ,
    trigger: "touch",
    action: () =>
      loadMap("oldVillage", {
        x: LAYOUT.oldVillage.artVillageSouthGate.x,
        z: LAYOUT.oldVillage.artVillageSouthGate.z - 1,
      }),
  },
  // 舊城鎮(東側 x=13)<-> 港口(西側 x=0)：整條邊界都能走過去，不是單一
  // 傳送點——沿邊每一排各自登記一組雙向觸發，逐格對應同一個 z。
  // 舊城鎮擴高到 15 排(z=0~14)才跟港口(16 排)的西側邊界對得起來，
  // 港口多出來的最後一排(z=15)沒有對應的舊城鎮列，不參與這組。
  ...Array.from({ length: LAYOUT.oldVillage.portGate.height }, (_, i) => ({
    map: "oldVillage",
    x: LAYOUT.oldVillage.portGate.x,
    z: LAYOUT.oldVillage.portGate.z + i,
    trigger: "touch",
    action: () =>
      loadMap("port", {
        x: LAYOUT.oldVillage.portGate.portX + 1,
        z: LAYOUT.oldVillage.portGate.portZ + i,
      }),
  })),
  ...Array.from({ length: LAYOUT.oldVillage.portGate.portHeight }, (_, i) => i)
    .filter(
      (i) =>
        !(
          LAYOUT.oldVillage.portGate.portX === LAYOUT.port.livingGate.x &&
          LAYOUT.oldVillage.portGate.portZ + i === LAYOUT.port.livingGate.z
        ),
    )
    .map((i) => ({
      map: "port",
      x: LAYOUT.oldVillage.portGate.portX,
      z: LAYOUT.oldVillage.portGate.portZ + i,
      trigger: "touch",
      action: () =>
        loadMap("oldVillage", {
          x: LAYOUT.oldVillage.portGate.x - 1,
          z: LAYOUT.oldVillage.portGate.z + i,
        }),
    })),
];
