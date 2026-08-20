import * as THREE from "three";
import { hash2 } from "./utils";
import { gameState } from "./game-state";
import { TILE, PLATEAU_Y, NORTH_CLIFF_Z, SOUTH_TERRAIN_EXTENSION, makeWaterSparklePoints } from "./scene-sky";
import {
  LAYOUT,
  SHRINE_PATH_START_X,
  SHRINE_PATH_LENGTH,
  SHRINE_PATH_ELEVATION,
} from "./layout-maps";
import { windowMats, waterSurfaceMaterials, waterSkyUnderlayMaterials, outdoorLampLights, foamMeshes, windmillRotors, pastureGrassBlades, avenueLeafMaterials, seasonalTreeLeafMaterials, seasonalGroundMaterials, GRASS_STAGE_HEIGHTS, EAST_SEA_WAVE_DIRECTION, gangplankMeshes } from "./scene-registries";
import { randomPasturePoint } from "./npc-runtime";

// 7) 樹 / 建築 / 地形（沿用 v11）
      // ==============================================================
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
        const leaf1 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.36, 0),
          leafMat,
        );
        leaf1.position.y = 0.62 * scale;
        leaf1.scale.setScalar(scale);
        leaf1.castShadow = true;
        const leaf2 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.26, 0),
          leafMat,
        );
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
        return new THREE.Color(AVENUE_SEASON_COLORS[gameState.currentSeason]).offsetHSL(
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
            new THREE.CylinderGeometry(
              radius * 0.62,
              radius,
              direction.length(),
              6,
            ),
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
        const groundColor = gameState.currentSeason === 3 ? 0xe8eef2 : 0x6ab04c;
        seasonalGroundMaterials.forEach((material) => {
          material.color.setHex(groundColor);
          material.roughness = gameState.currentSeason === 3 ? 0.82 : 1;
        });
        pastureGrassBlades.forEach((tuft) => {
          tuft.userData.grassMaterial.color.copy(
            gameState.currentSeason === 3
              ? tuft.userData.winterGrassColor
              : tuft.userData.baseGrassColor,
          );
          tuft.userData.grassMaterial.roughness =
            gameState.currentSeason === 3 ? 0.78 : 1;
        });
      }
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
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.24, 0.05),
            winMat,
          );
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
        doorL.position.set(doorX - centerX - 0.13, doorHeight / 2, (depth / 2) * 0.98);
        const doorR = doorL.clone();
        doorR.position.x = doorX - centerX + 0.13;
        group.add(doorL, doorR);
        // 閣樓圓窗——穀倉的招牌特徵，跟主屋的方窗做出區別
        const loft = new THREE.Mesh(
          new THREE.CircleGeometry(0.14, 10),
          new THREE.MeshStandardMaterial({ color: 0x241a14 }),
        );
        loft.position.set(
          doorX - centerX,
          wallHeight - 0.12,
          (depth / 2) * 0.981,
        );
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
        const mat = new THREE.MeshStandardMaterial({
          color: 0x4f9e46,
          flatShading: true,
        });
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.02, 0.14, 4),
            mat,
          );
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
        const mat = new THREE.MeshStandardMaterial({
          color: gameState.currentSeason === 3 ? winterGrassColor : grassColor,
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
        g.userData.growth = seed * 3;
        g.userData.stage = -1;
        g.userData.grassMaterial = mat;
        g.userData.baseGrassColor = grassColor;
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
      export function chooseAnimalPastureTarget(animal) {
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
            return {
              x: grass.position.x + Math.cos(jitterAngle) * jitterRadius,
              z: grass.position.z + Math.sin(jitterAngle) * jitterRadius,
            };
          }
        }
        return randomPasturePoint();
      }
      export function tryEatPastureGrass(animal) {
        if (animal.type === "chicken") return false;
        const grass = findLongGrassNear(
          animal.mesh.position.x,
          animal.mesh.position.z,
          0.55,
        );
        if (!grass) return false;
        grass.userData.growth = 0;
        setPastureGrassStage(grass, 0);
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
        const style =
          ORCHARD_FRUIT_STYLES[typeIndex % ORCHARD_FRUIT_STYLES.length];
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

      // 牡蠣養殖架——浮筏＋垂繩，珍珠系統的採集點。跟碼頭(makeDock)同一套
      // 木板材質，浮筏四角加圓形浮球撐著漂在水面上，繩子垂下去掛著一串串
      // 牡蠣殼(用 IcosahedronGeometry 湊不規則的殼形，跟 makeStone 同招)。
      export function makeOysterRack(x, z) {
        const group = new THREE.Group();
        const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45 });
        const raftSize = 1.3;
        for (let i = 0; i < 4; i++) {
          const plank = new THREE.Mesh(
            new THREE.BoxGeometry(raftSize, 0.07, 0.28),
            plankMat,
          );
          plank.position.set(0, 0.32, -raftSize / 2 + 0.35 + i * 0.3);
          plank.castShadow = true;
          plank.receiveShadow = true;
          group.add(plank);
        }
        const buoyMat = new THREE.MeshStandardMaterial({ color: 0xd9482f });
        [
          [-raftSize / 2, -raftSize / 2],
          [raftSize / 2, -raftSize / 2],
          [-raftSize / 2, raftSize / 2],
          [raftSize / 2, raftSize / 2],
        ].forEach(([bx, bz]) => {
          const buoy = new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 8, 6),
            buoyMat,
          );
          buoy.position.set(bx, 0.28, bz);
          buoy.castShadow = true;
          group.add(buoy);
        });
        const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3a3226 });
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0x5c5a52,
          flatShading: true,
          roughness: 0.9,
        });
        [-0.4, 0, 0.4].forEach((rx, i) => {
          const rope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5),
            ropeMat,
          );
          rope.position.set(rx, 0.05, 0);
          group.add(rope);
          for (let s = 0; s < 3; s++) {
            const shell = new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.07 + hash2(i, s) * 0.03, 0),
              shellMat,
            );
            shell.position.set(
              rx + (hash2(s, i) - 0.5) * 0.08,
              -0.12 - s * 0.09,
              (hash2(i * 3, s) - 0.5) * 0.08,
            );
            shell.rotation.set(hash2(s, 1) * 6, hash2(s, 2) * 6, hash2(s, 3) * 6);
            shell.castShadow = true;
            group.add(shell);
          }
        });
        group.position.set(x, 0, z);
        return group;
      }

      // 休息區野餐組——桌子＋兩張長椅，樹蔭直接借用 makeTree
      export function makePicnicSet(x, z) {
        const group = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a });
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.06, 0.5),
          woodMat,
        );
        top.position.y = 0.38;
        top.castShadow = true;
        group.add(top);
        [-0.35, 0.35].forEach((lx) => {
          const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.38, 0.5),
            woodMat,
          );
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
          const flower = makeFlower(
            fx,
            fz,
            FLOWER_COLORS[i % FLOWER_COLORS.length],
          );
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
        const bowl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.27, 0.19, 0.2, 10),
          darkMat,
        );
        bowl.position.y = 0.53;
        bowl.castShadow = true;
        grill.add(bowl);
        const grate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.025, 12),
          new THREE.MeshStandardMaterial({
            color: 0x777777,
            metalness: 0.65,
            roughness: 0.45,
          }),
        );
        grate.position.y = 0.65;
        grill.add(grate);
        [-0.14, 0.14].forEach((lx) =>
          [-0.09, 0.09].forEach((lz) => {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.022, 0.48, 5),
              darkMat,
            );
            leg.position.set(lx, 0.25, lz);
            grill.add(leg);
          }),
        );
        grill.position.set(4.15, 1.55, 0.2);
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
        g.add(
          makeBench(
            area.chair.offsetX,
            area.chair.offsetZ,
            area.chair.rotation,
          ),
        );

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
      export function makeCargoShip() {
        const group = new THREE.Group();
        const hullMat = new THREE.MeshStandardMaterial({
          color: 0x3a4a52,
          flatShading: true,
        });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 1.15), hullMat);
        hull.position.y = 0.25;
        hull.castShadow = true;
        hull.receiveShadow = true;
        group.add(hull);
        // 船艏比船身高一截的甲板室，商船常見的弧形艏樓輪廓（用方塊簡化表示）
        const bow = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.68, 1.05),
          hullMat,
        );
        bow.position.set(1.7, 0.44, 0);
        bow.castShadow = true;
        group.add(bow);
        // 船艏尖端——斜切的方塊代替直上直下的平頭船首，側面看才有破浪船艏
        // 該有的斜角輪廓。
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.85), hullMat);
        stem.position.set(2.15, 0.12, 0);
        stem.rotation.z = -0.5;
        stem.castShadow = true;
        group.add(stem);
        // 艏斜桅——斜斜地從船艏往前伸出，最快讓人一眼認出「這是一艘船」
        // 而不是一個長方形箱子的細節之一。
        const bowspritMat = new THREE.MeshStandardMaterial({ color: 0x6b5138 });
        const bowsprit = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.05, 0.9, 6),
          bowspritMat,
        );
        bowsprit.rotation.z = Math.PI / 2.5;
        bowsprit.position.set(2.55, 0.5, 0);
        bowsprit.castShadow = true;
        group.add(bowsprit);
        // 船艙／駕駛室，偏向船尾一側
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 0.55, 0.9),
          new THREE.MeshStandardMaterial({ color: 0xd8d4c8 }),
        );
        cabin.position.set(-1.35, 0.5 + 0.275, 0);
        cabin.castShadow = true;
        group.add(cabin);
        // 煙囪——商船/貨輪最有辨識度的剪影之一，加一道淺色環帶避免看起來
        // 像單色水管。
        const funnelMat = new THREE.MeshStandardMaterial({
          color: 0x8a2f2a,
          flatShading: true,
        });
        const funnel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.19, 0.5, 10),
          funnelMat,
        );
        funnel.position.set(-1.55, 0.5 + 0.55 + 0.25, 0);
        funnel.castShadow = true;
        group.add(funnel);
        const funnelBand = new THREE.Mesh(
          new THREE.CylinderGeometry(0.185, 0.185, 0.1, 10),
          new THREE.MeshStandardMaterial({ color: 0xe8e4da }),
        );
        funnelBand.position.set(-1.55, 0.5 + 0.55 + 0.42, 0);
        group.add(funnelBand);
        // 吊臂——普通漁船不會有這個，是「貨運商船」最直接的視覺標記
        const craneMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        const craneBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6),
          craneMat,
        );
        craneBase.position.set(-0.75, 0.5 + 0.55 + 0.25, 0);
        craneBase.castShadow = true;
        group.add(craneBase);
        const craneArm = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.07, 0.07),
          craneMat,
        );
        craneArm.position.set(-0.75 + 0.55, 0.5 + 0.55 + 0.48, 0);
        craneArm.rotation.z = -0.15;
        craneArm.castShadow = true;
        group.add(craneArm);
        // 甲板上堆疊的貨箱，尺寸/角度各自錯開，看起來才不會像複製貼上
        const crateMat = new THREE.MeshStandardMaterial({
          color: 0x9c6b3a,
          flatShading: true,
        });
        [
          [-0.5, 0.15],
          [-0.1, -0.2],
          [0.35, 0.1],
        ].forEach(([cx, cz], i) => {
          const size = 0.34 + hash2(i, cx) * 0.1;
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(size, size, size),
            crateMat,
          );
          crate.position.set(cx, 0.5 + size / 2, cz);
          crate.rotation.y = i * 0.5 + hash2(cx, cz);
          crate.castShadow = true;
          group.add(crate);
        });
        // 舷緣扶手——沿船身兩側各一條細長橫桿，補上甲板邊界的輪廓線，避免
        // 船身看起來像一塊光禿禿的箱子。
        const railMat = new THREE.MeshStandardMaterial({ color: 0x2c3a40 });
        [-1, 1].forEach((side) => {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(3.3, 0.05, 0.04),
            railMat,
          );
          rail.position.set(-0.05, 0.53, side * 0.55);
          group.add(rail);
        });
        // 船身兩側的舷窗——小圓孔，暗色，暗示「這裡面是船艙」，不需要真的
        // 打光就看得出深淺差異。
        const portholeMat = new THREE.MeshStandardMaterial({ color: 0x14181a });
        for (let i = 0; i < 5; i++) {
          [-1, 1].forEach((side) => {
            const porthole = new THREE.Mesh(
              new THREE.CircleGeometry(0.08, 8),
              portholeMat,
            );
            porthole.rotation.y = side > 0 ? 0 : Math.PI;
            porthole.position.set(-1 + i * 0.5, 0.25, side * 0.576);
            group.add(porthole);
          });
        }
        // 船尾旗桿＋小三角旗，補上船身輪廓最頂端的一點細節與動態感。
        const flagpoleMat = new THREE.MeshStandardMaterial({ color: 0x5a4632 });
        const flagpole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6),
          flagpoleMat,
        );
        flagpole.position.set(-1.75, 0.5 + 0.55 + 0.4, 0);
        flagpole.castShadow = true;
        group.add(flagpole);
        const flag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.26, 0.16),
          new THREE.MeshStandardMaterial({
            color: 0xd6483a,
            side: THREE.DoubleSide,
            flatShading: true,
          }),
        );
        flag.position.set(-1.61, 0.5 + 0.55 + 0.6, 0);
        group.add(flag);
        return group;
      }

      // 跳板——連接碼頭跟渡輪甲板，靠港時放下、啟航/行駛中收起。本地 +X
      // 為由碼頭朝渡輪的方向，長度由呼叫端算好傳入(見 makePortScene)；呼叫
      // 端另外決定實際擺放位置與坡度，這裡只管「一段木板棧橋」本身的造型。
      export function makeGangplank(length) {
        const group = new THREE.Group();
        const plankMat = new THREE.MeshStandardMaterial({
          color: 0x8a6a45,
          roughness: 0.92,
        });
        const plankCount = Math.max(3, Math.round(length / 0.5));
        const plankLength = length / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const plank = new THREE.Mesh(
            new THREE.BoxGeometry(plankLength + 0.02, 0.06, 0.62),
            plankMat,
          );
          plank.position.set((i + 0.5) * plankLength, 0.03, 0);
          plank.castShadow = true;
          plank.receiveShadow = true;
          group.add(plank);
        }
        // 兩側扶手：一條橫向欄杆＋等距欄杆柱，只用簡單圓柱堆出來，跟其他
        // 道具(如 makeBench 的椅腳)同一套低多邊形風格。
        const railMat = new THREE.MeshStandardMaterial({ color: 0x5a4632 });
        [-0.31, 0.31].forEach((zOffset) => {
          const rail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, length, 6),
            railMat,
          );
          rail.rotation.z = Math.PI / 2;
          rail.position.set(length / 2, 0.34, zOffset);
          rail.castShadow = true;
          group.add(rail);
          const postCount = Math.max(2, Math.round(length));
          for (let i = 0; i <= postCount; i++) {
            const post = new THREE.Mesh(
              new THREE.CylinderGeometry(0.02, 0.02, 0.34, 5),
              railMat,
            );
            post.position.set((i / postCount) * length, 0.17, zOffset);
            post.castShadow = true;
            group.add(post);
          }
        });
        return group;
      }

      // 參考港灣圖的完整港區組件：石造內港、北側商店、中央渡輪與東側小艇棧橋。
      // 沙灘不在這裡重做，仍由 port tiles 的 8 走共用 makeSand() 管線。
      export function makePortScene() {
        const group = new THREE.Group();
        const port = LAYOUT.port;
        const concreteMat = new THREE.MeshStandardMaterial({
          color: 0xa39b8c,
          roughness: 0.96,
        });
        const stairMats = [0x786858, 0x695a4c, 0x594b40].map(
          (color) =>
            new THREE.MeshStandardMaterial({ color, roughness: 0.98 }),
        );
        const waterMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.2,
          metalness: 0.1,
          flatShading: true,
          transparent: false,
          opacity: 1,
          side: THREE.DoubleSide,
        });
        const waterDepthMat = new THREE.MeshStandardMaterial({
          color: 0x174968,
          roughness: 1,
          metalness: 0,
          side: THREE.DoubleSide,
        });
        waterSurfaceMaterials.push(waterMat);
        waterSkyUnderlayMaterials.push(waterDepthMat);
        const addWater = (x, z, width, depth) => {
          const geometry = new THREE.PlaneGeometry(
            width,
            depth,
            Math.max(2, Math.ceil(width)),
            Math.max(2, Math.ceil(depth)),
          );
          const water = new THREE.Mesh(
            geometry,
            waterMat,
          );
          const colors = new Float32Array(
            geometry.attributes.position.count * 3,
          );
          for (let i = 0; i < geometry.attributes.position.count; i++)
            colors.set([0.18, 0.43, 0.68], i * 3);
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          const depthMask = new THREE.Mesh(geometry.clone(), waterDepthMat);
          depthMask.rotation.x = -Math.PI / 2;
          depthMask.position.set(
            x + (width - 1) / 2,
            0.025,
            z + (depth - 1) / 2,
          );
          depthMask.receiveShadow = true;
          group.add(depthMask);
          water.rotation.x = -Math.PI / 2;
          water.position.set(x + (width - 1) / 2, 0.09, z + (depth - 1) / 2);
          water.receiveShadow = true;
          geometry.userData.basePositions = Float32Array.from(
            geometry.attributes.position.array,
          );
          gameState.portWaterMeshes.push(water);
          group.add(water);
          group.add(
            makeWaterSparklePoints(
              x,
              x + width,
              z,
              z + depth,
              Math.max(10, Math.min(55, Math.round((width * depth) / 10))),
              0.055,
            ),
          );

          // 每塊水面自己撒一批星光點，數量跟面積成比例，小水塘不會跟大船塢
          // 一樣密。
        };
        addWater(
          port.basin.x,
          port.basin.z,
          port.basin.width,
          port.basin.height,
        );
        addWater(
          port.smallBoatDock.x,
          port.basin.z - 1,
          port.width - port.smallBoatDock.x,
          port.height - (port.basin.z - 1),
        );
        const oceanViewEdge = port.width + port.oceanViewPadding;
        addWater(14, 0, oceanViewEdge - 14, port.beachDepth + 1);
        addWater(
          port.width,
          port.beachDepth + 1,
          port.oceanViewPadding,
          port.height - port.beachDepth - 1,
        );
        addWater(
          port.width - port.oceanExpansion,
          port.beachDepth + 1,
          port.oceanExpansion,
          port.basin.z - port.beachDepth - 2,
        );
        addWater(
          0,
          port.height - port.oceanExpansion,
          port.smallBoatDock.x,
          port.oceanExpansion,
        );
        addWater(
          0,
          port.height,
          oceanViewEdge,
          port.oceanViewPadding,
        );

        for (let z = 0; z <= port.beachDepth; z += 2) {
          const foam = makeFoam(13.65, z, 700 + z * 1.37);
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
          port.width - port.oceanExpansion,
          port.basin.z - port.beachDepth - 2,
        );
        addPlatform(
          0,
          port.basin.z - 1,
          port.smallBoatDock.x,
          1,
        );
        addPlatform(0, port.basin.z, port.basin.x, port.basin.height);
        addPlatform(
          0,
          port.southQuay.z,
          port.smallBoatDock.x,
          port.southQuay.height,
        );
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

        // 三面碼頭牆把水面讀成內凹船塢；高度略高於水面，避免共平面閃爍。
        // 北西角高台的 L 形扶手。放在格子外緣，保留傳送格與走道空間。
        const safetyRailMat = new THREE.MeshStandardMaterial({
          color: 0x4f5554,
          roughness: 0.82,
          metalness: 0.18,
        });
        const addSafetyRail = (
          x1: number,
          z1: number,
          x2: number,
          z2: number,
        ) => {
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
          rail.position.set(
            (x1 + x2) / 2,
            port.elevation + 0.72,
            (z1 + z2) / 2,
          );
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

        const basinCenterX =
          port.basin.x + (port.basin.width - 1) / 2;
        const basinCenterZ =
          port.basin.z + (port.basin.height - 1) / 2;
        [
          [port.basin.x - 0.55, basinCenterZ, 0.48, port.basin.height + 1],
          [basinCenterX, port.basin.z - 0.55, port.basin.width + 1, 0.48],
          [
            basinCenterX,
            port.basin.z + port.basin.height - 0.55,
            port.basin.width + 1,
            0.48,
          ],
        ].forEach(([x, z, width, depth]) => {
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
        for (
          let x = port.basin.x;
          x < port.basin.x + port.basin.width;
          x += 4
        ) {
          bollards.push([x, port.basin.z - 0.8]);
          bollards.push([x, port.basin.z + port.basin.height - 0.3]);
        }
        for (
          let z = port.basin.z + 1;
          z < port.basin.z + port.basin.height;
          z += 4
        )
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

        // 既有商船幾何放大為港灣主渡輪；保持頭朝本地 +X 的船體慣例。
        const ferry = makeCargoShip();
        ferry.scale.set(2.05, 1.7, 1.7);
        ferry.position.set(port.ferry.x, 0.15, port.ferry.z);
        ferry.rotation.y = 0.03;
        group.add(ferry);

        // 木棧板跳板——把渡輪跟碼頭實際連起來，不再是各自獨立的兩組裝飾。
        // 長度/坡度依碼頭牆頂(port.elevation)跟渡輪甲板高度現場算出來，
        // LAYOUT 數字之後微調也不用跟著手動改這裡。ferryHullHalfWidth 抓的
        // 是渡輪 hull 局部半寬(見 makeCargoShip 的 3.6 寬 hull)乘上這裡的
        // scale.x，換算出離碼頭最近那一側船殼的世界座標。靠港時顯示、
        // 啟航/行駛中收起，由 game-loop.ts 依日夜切換 gangplankMeshes 的
        // .visible，不用重蓋地圖。
        const ferryHullHalfWidth = (3.6 / 2) * ferry.scale.x;
        const gangplankStartX = port.basin.x - 0.3;
        const gangplankEndX = port.ferry.x - ferryHullHalfWidth;
        const gangplankLength = gangplankEndX - gangplankStartX;
        const gangplankStartY = port.elevation;
        const gangplankEndY = ferry.position.y + 0.5 * ferry.scale.y;
        const gangplank = makeGangplank(gangplankLength);
        gangplank.rotation.z = Math.atan2(
          gangplankEndY - gangplankStartY,
          gangplankLength,
        );
        gangplank.position.set(gangplankStartX, gangplankStartY, port.ferry.z);
        gangplankMeshes.push(gangplank);
        group.add(gangplank);

        const dock = makeDock();
        dock.position.set(port.smallBoatDock.x, 0.13, port.smallBoatDock.z);
        dock.rotation.y = Math.PI / 2;
        group.add(dock);

        const marker = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28, 0),
          new THREE.MeshStandardMaterial({
            color: 0xe53935,
            emissive: 0x5a0808,
          }),
        );
        marker.position.set(
          port.carpenterMeet.x,
          port.elevation + 1.5,
          port.carpenterMeet.z,
        );
        marker.rotation.z = Math.PI / 4;
        marker.castShadow = true;
        group.add(marker);
        return group;
      }

      // 女神祠堂的鳥居——這輪只求「一眼認得出是鳥居」的簡單造型：兩根柱子
      // +兩道橫樑(上樑較寬、下樑較窄，鳥居的招牌比例)，朱紅色。退潮步道跟
      // 祠堂本身的機制之後再接，這裡純粹是佔位地標。
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

        const woodMat = new THREE.MeshStandardMaterial({ color: 0x59483a, roughness: 1 });
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.035), woodMat);
        door.position.set(0, 0.21, d / 2 + 0.02);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.055, 0.055), woodMat);
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
          columns.push([
            x,
            centerZ - 0.48,
            0.72 * taper + 0.22,
            1.28 * taper + 0.58,
          ]);
          columns.push([
            x + 0.2,
            centerZ + 0.48,
            0.62 * taper + 0.18,
            1.08 * taper + 0.42,
          ]);
          if (step < 6 && step % 2 === 0) {
            columns.push([
              x + 0.48,
              centerZ,
              0.55 * taper + 0.2,
              1.15 * taper + 0.5,
            ]);
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
      export const FLOWER_COLORS = [0xf25f8c, 0xf5c542, 0xffffff, 0x8f6ff5];
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
      export function makeFoam(x, z, seed) {
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
        g.userData = {
          seed,
          crest,
          wash,
          bumps,
          baseX: x,
          baseZ: z,
          waveDirection: EAST_SEA_WAVE_DIRECTION,
        };
        return g;
      }
      export function makeCropMesh(stage) {
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
          fruit.position.set(
            Math.cos(a) * 0.09,
            0.2 + i * 0.02,
            Math.sin(a) * 0.09,
          );
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

        const door = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.62, 0.08),
          woodMat,
        );
        door.position.set(0, 0.34, 1.01);
        group.add(door);

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

      export function makeWesternMountainTerrain(rows) {
        const group = new THREE.Group();
        const xSegments = 16;
        const zSegments = 36;
        // 草地主地板的實際西緣是 x=-0.5；坡地多壓進去 0.25 格，避免兩片
        // 幾何之間露出天空細縫。這段重疊位於地圖外，不會吃掉可行走草地。
        const eastX = -0.25;
        const westX = -34;
        // 山脈只略微越過北側懸崖，不再一路鋪到 z=-34、侵入北方海景。
        const northZ = NORTH_CLIFF_Z - 3.2;
        const southZ = rows + SOUTH_TERRAIN_EXTENSION + 24;
        const positions = [];
        const colors = [];
        const indices = [];
        // 東側近景稍亮、較有植被色；往西升高後才逐漸轉成冷灰岩色。
        const low = new THREE.Color(0x849276);
        const high = new THREE.Color(0x626b74);
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
              THREE.MathUtils.lerp(eastX - edgeNotch, westX, tx) +
              lateralRidge;
            const broadRidge =
              Math.sin(z * 0.13 + tx * 7.2) * (0.8 + tx * 3.8);
            const brokenFace =
              (hash2(ix * 5.7, iz * 8.3) - 0.5) * (0.5 + tx * 5.2);
            const rockBands =
              Math.sin(tx * 22 + z * 0.075) * (0.2 + tx * 1.15);
            const rugged =
              (broadRidge + brokenFace + rockBands) * Math.pow(tx, 0.52);
            const y =
              PLATEAU_Y + 0.08 + Math.pow(tx, 0.28) * 42 + rugged;
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
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colors, 3),
        );
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

        // 島緣外側的碎岩帶，打散筆直接縫並形成概念圖那種山腳峭壁。
        for (let i = 0; i < 42; i++) {
          const t = i / 41;
          const z = THREE.MathUtils.lerp(northZ, southZ, t);
          const seed = hash2(i * 4.9, 17.3);
          const rock = makeStone(
            -0.85 - seed * 0.75,
            z + (seed - 0.5) * 1.8,
            seed,
          );
          rock.position.y = PLATEAU_Y + 0.22 + seed * 0.3;
          rock.scale.set(2.2 + seed * 2.1, 2.8 + seed * 3.2, 2 + seed * 2.4);
          group.add(rock);
        }
        return group;
      }

      export function makeMountainGateway() {
        const group = new THREE.Group();
        const gateway = LAYOUT.mountainGateway;
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
        for (let i = 0; i < gateway.steps; i++) {
          const top = PLATEAU_Y + i * gateway.risePerStep;
          const x = gateway.startX - i;
          const z = gateway.startZ - i;
          const step = new THREE.Mesh(
            new THREE.BoxGeometry(
              gateway.width,
              0.28 + i * 0.08,
              gateway.width,
            ),
            i === gateway.steps - 1 ? edgeMat : stepMat,
          );
          step.position.set(x, top - (0.14 + i * 0.04), z);
          step.rotation.y = -0.08 + (hash2(i, 4.2) - 0.5) * 0.07;
          step.castShadow = true;
          step.receiveShadow = true;
          group.add(step);
          if (i > 0) {
            [-1, 1].forEach((side) => {
              const seed = hash2(i * 3.7, side * 8.1);
              const rock = makeStone(
                x + side * (gateway.width * 0.58 + seed * 0.12),
                z - side * (gateway.width * 0.44) + (seed - 0.5) * 0.25,
                seed,
              );
              rock.position.y = top + 0.04;
              rock.scale.setScalar(1.25 + seed * 0.8);
              group.add(rock);
            });
          }
        }
        return group;
      }

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
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.24, 0.24),
            hide,
          );
          body.position.y = 0.22;
          body.castShadow = true;
          g.add(body);
          const spot = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.1, 0.02),
            spotMat,
          );
          spot.position.set(0.04, 0.27, 0.13);
          g.add(spot);
          const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.15, 0.15),
            hide,
          );
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
          const body = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.16, 0),
            wool,
          );
          body.scale.set(1.3, 1, 1.1);
          body.position.y = 0.2;
          body.castShadow = true;
          g.add(body);
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.075, 8, 6),
            dark,
          );
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
          const body = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 6),
            feather,
          );
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

      export function makeSeedPouch() {
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
      export function makeFishProp(seed) {
        // 純粹的氛圍裝飾：壓扁的橢圓身體 + 三角尾鰭；色盤用 seed 決定，
        // 同一張地圖每次重整仍會得到一致、但彼此不同的魚色。
        const palette = [
          0xd9a441, 0x8fa8c9, 0x5fa8a0, 0xd97c67, 0xb59bd8, 0xd5d1b8, 0x668fc4,
        ];
        const color =
          palette[
            Math.floor(hash2(seed, seed * 3.3) * palette.length) %
              palette.length
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
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 4),
          bodyMat,
        );
        body.scale.set(2, 1.1, 0.64); // 魚身整體放大兩倍
        const tail = new THREE.Mesh(
          new THREE.ConeGeometry(0.035, 0.06, 4),
          tailMat,
        );
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
            Math.hypot(
              targetX - f.mesh.position.x,
              targetZ - f.mesh.position.z,
            ) / f.swimSpeed,
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
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          bulbMat,
        );
        bulb.position.y = 0.3;
        group.add(bulb);
        const light = new THREE.PointLight(0xffdd99, 0, 2.4, 2);
        light.position.y = 0.3;
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
        const arm = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.07, 0.42),
          metal,
        );
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
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 8, 6),
          bulbMat,
        );
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
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.06, 0.36),
          woodMat,
        );
        seat.position.y = 0.32;
        seat.castShadow = true;
        seat.receiveShadow = true;
        group.add(seat);
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.4, 0.06),
          woodMat,
        );
        back.position.set(0, 0.52, -0.15);
        back.castShadow = true;
        group.add(back);
        [-0.36, 0.36].forEach((legX) => {
          const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.32, 0.32),
            metal,
          );
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
            win = new THREE.Mesh(
              new THREE.BoxGeometry(0.5, 0.42, 0.06),
              winMat,
            );
            win.position.set(0, 0.78, 0.49);
          } else if (windowSide === "south") {
            win = new THREE.Mesh(
              new THREE.BoxGeometry(0.5, 0.42, 0.06),
              winMat,
            );
            win.position.set(0, 0.78, -0.49);
          } else if (windowSide === "east") {
            win = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.42, 0.5),
              winMat,
            );
            win.position.set(-0.49, 0.78, 0);
          } else {
            win = new THREE.Mesh(
              new THREE.BoxGeometry(0.06, 0.42, 0.5),
              winMat,
            );
            win.position.set(0.49, 0.78, 0);
          }
          g.add(win);
          windowMats.push(winMat);
        }
        g.position.set(x, 0, z);
        return g;
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
        }
        return g;
      }

      // ==============================================================
