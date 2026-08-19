import * as THREE from "three";
import { hash2 } from "./utils";
import { loadMap } from "./build-map";
import {
  handleCarpenterDockTouch,
  handleCarpenterDoorstepTouch,
} from "./carpenter-quest";

// ==============================================================
      // 統一佈局設定 —— 之後要調哪個區域的位置/大小，改這裡就好，不要再
      // 回頭找散落各處的絕對座標。房子、穀倉、牧場這次先不動，農田往西
      // 移、湖放大到接近 10×10、山搬進西側緩衝帶。要放在 MAPS 前面，因為
      // 下面 buildings 陣列會直接引用這裡的值
      // ==============================================================
      export const NORTH_EXPANSION = 5;
      export const LAYOUT = {
        // 北側新增 5 排：動物區留在新空間，其餘舊區域整體往南順延。
        house: { x: 20, z: 9 + NORTH_EXPANSION, w: 3, d: 2, doorX: 21 },
        barn: { x: 23, z: -2, w: 3, d: 2, doorX: 24 }, // 整座動物小屋向北移 3 格
        pasture: { x: 17, z: -2, width: 15, height: 16 }, // 延伸到小屋左右，外緣由渲染做不規則化
        orchard: {
          x: 28,
          z: -1,
          columns: 3,
          rows: 4,
          spacingX: 2,
          spacingZ: 2.1,
        }, // 小屋右側 12 棵
        windmill: {
          x: 29,
          z: 13,
          w: 4,
          d: 4,
          visualX: 30.5,
          visualZ: 14.5,
          scale: 2,
        },
        houseRoad: { width: 3 },
        farmAccessRoad: { width: 3 },
        coastRoad: { width: 3 },
        restArea: { x: 25, z: 24, width: 8, height: 6 },
        garden: { x: 25, z: 31, width: 8, height: 7 },
        farm: {
          x: 5,
          z: 17 + NORTH_EXPANSION,
          columns: 3,
          rows: 4,
          plotSize: 3,
          gap: 1,
        }, // 3 欄 × 4 排，共 12 塊田
        lake: { x: 2, z: 0, width: 18, height: 17 }, // 整座湖西移 1 格、北移 3 格
        coast: {
          eastExpansion: 5,
          rampX: 34,
          rampWidth: 3,
          sandCols: 10,
          oceanCols: 10,
        },
        mountainBand: { x: -7, width: 6 },
        mountainGateway: {
          startX: 3,
          startZ: 20,
          steps: 4,
          risePerStep: 0.2,
          width: 1.65,
        },
      };

      export function lakeEdgeFactor(theta) {
        const centerX = LAYOUT.lake.x + (LAYOUT.lake.width - 1) / 2;
        const centerZ = LAYOUT.lake.z + (LAYOUT.lake.height - 1) / 2;
        const seed = hash2(centerX * 1.7, centerZ * 2.3) * 20;
        return (
          1 +
          0.2 * Math.sin(theta * 2 + seed) +
          0.12 * Math.sin(theta * 3 + seed * 1.6) +
          0.07 * Math.sin(theta * 5 + seed * 2.4)
        );
      }

      // 海岸線沙灘/海的分界不要是直線——每一排(z)算一個決定性的偏移量。故意
      // 只疊兩個低頻正弦波、振幅也收斂到 2 格內：頻率太高、振幅太大會讓相鄰
      // 排落差超過 1 格，邊界變成尖銳鋸齒，沿岸的浪花(makeFoam，一排一組)
      // 也會因為忽左忽右而斷成一塊塊，不像連續的海岸線。只動沙灘/海的交界，
      // 懸崖/沙灘那條邊維持筆直（那是碰撞用的山壁，搖它風險比較高）
      export function coastShoreJitter(z) {
        return Math.round(
          1.3 * Math.sin(z * 0.15 + 3.1) + 0.7 * Math.sin(z * 0.42 + 9.4),
        );
      }
      // 視覺湖岸、碰撞與釣魚判定共用同一個不規則橢圓輪廓。
      export function isInsideLakeShape(x, z, shoreInset = 0) {
        const centerX = LAYOUT.lake.x + (LAYOUT.lake.width - 1) / 2;
        const centerZ = LAYOUT.lake.z + (LAYOUT.lake.height - 1) / 2;
        const radiusX = LAYOUT.lake.width * 0.35 - shoreInset;
        const radiusZ = LAYOUT.lake.height * 0.35 - shoreInset;
        const nx = (x - centerX) / radiusX,
          nz = (z - centerZ) / radiusZ;
        const theta = Math.atan2(nz, nx);
        return Math.hypot(nx, nz) <= lakeEdgeFactor(theta);
      }

      // ==============================================================
      // 1) 地圖資料 — 故意在阿姨「家→田」的路上多種一棵樹 (4,5)，
      //    直線距離是最短路徑，但現在會被這棵樹擋住，逼 A* 繞路
      // ==============================================================
      export const MAPS = {
        livingArea: {
          tiles: [
            // 房子後面新開的一大塊地：z=0~6 是全新區域，穀倉搬過來這裡，
            // 牧場也在這，比舊的東側牧場大很多
            [2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            // 以下是原本的地圖，整段往下移了 7 格（z 全部 +7），內容本身沒變，
            // 只有舊穀倉的牆拆掉(1 改回 0)，因為穀倉搬到上面新區域去了
            [2, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 2],
            [0, 6, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [2, 6, 6, 6, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2],
            [0, 6, 6, 6, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 2, 0, 2, 0, 5, 0, 0, 0, 0, 2, 0, 0],
            [0, 0, 7, 7, 7, 0, 5, 0, 0, 0, 0, 2, 0, 0],
            [0, 0, 7, 7, 7, 0, 5, 0, 0, 0, 0, 0, 2, 0],
            [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 2, 0, 0],
            [0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2, 0],
          ],
          buildings: [
            {
              x: LAYOUT.house.x,
              z: LAYOUT.house.z,
              w: LAYOUT.house.w,
              d: LAYOUT.house.d,
              doorX: LAYOUT.house.doorX,
            },
            {
              x: LAYOUT.barn.x,
              z: LAYOUT.barn.z,
              w: LAYOUT.barn.w,
              d: LAYOUT.barn.d,
              doorX: LAYOUT.barn.doorX,
              style: "barn",
            },
          ],
          playerStart: { x: 21, z: 16 + NORTH_EXPANSION },
        },
        house: {
          tiles: [
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 0, 1, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 3, 3, 1, 1, 1, 1],
          ],
          // x=3、z=1~2 是一道隔間牆，z=3 故意留空當走道——這樣左上角自然圍出
          // 一間小臥室，跟右邊的主空間分開，不用另外寫「房間」的概念，純粹是
          // tiles 陣列裡多幾個 1。門也從 1 格拓寬成 2 格 (x=2,3)，見下方說明
          windows: [
            { x: 1, z: 0, side: "north" }, // 臥室窗
            { x: 5, z: 0, side: "north" }, // 主空間窗
            { x: 0, z: 4, side: "west" },
            { x: 7, z: 2, side: "east" },
            { x: 7, z: 4, side: "east" },
          ],
          // 家具是獨立於 tiles 的資料層，跟 livingArea 的 buildings 同一套邏輯：
          // tiles 只負責「牆在哪」，家具在哪、佔幾格、擋不擋路是這裡另外定義
          furniture: [
            { type: "bed", x: 1, z: 1, w: 1, d: 2 },
            { type: "table", x: 5, z: 2 },
            { type: "chair", x: 5, z: 3, rot: Math.PI },
            { type: "chair", x: 6, z: 2, rot: -Math.PI / 2 },
            { type: "rug", x: 3, z: 3, nonBlocking: true },
          ],
          playerStart: { x: 3, z: 5 },
        },
        // 舊城鎮——目前只做骨架：一塊廣場空地＋幾間空屋佔位方塊(makeTownPlaceholder)，
        // 沒有木匠工坊內裝。playerStart 設在北側，之後往北接港口商業街入口。
        // 南側跟山區之間預留了以後另一位居民要用的路，這裡不畫、不佔座標。
        oldVillage: {
          tiles: [
            [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          ],
          placeholders: [
            { x: 3, z: 4, seed: 0.4 },
            { x: 10, z: 4, seed: 0.6 },
            { x: 3, z: 8, seed: 0.25 },
            { x: 10, z: 8, seed: 0.75 },
          ],
          playerStart: { x: 7, z: 2 },
        },
        // 港口——北端候船碼頭(makeDock)，南端市場/倉庫佔位方塊，中間一條路連到
        // 南端的舊城鎮商業街入口。playerStart 在北端碼頭附近。
        port: {
          tiles: [
            [0, 0, 0, 0, 0, 8, 8, 8, 8, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 5, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
          ],
          placeholders: [
            { x: 4, z: 6, seed: 0.3 },
            { x: 10, z: 6, seed: 0.55 },
            { x: 4, z: 12, seed: 0.7 },
            { x: 10, z: 12, seed: 0.42 },
            { x: 4, z: 14, seed: 0.85 },
            { x: 10, z: 14, seed: 0.15 },
          ],
          playerStart: { x: 7, z: 4 },
        },
      };

      // ==============================================================
      // 1.4) 一次性往西擴 15 格安全空間，之後說「房子西 N」只要 N<=15
      //    就有現成的格子可以用，不用每次都插入陣列、重算全部座標
      // ==============================================================
      export const X_OFFSET = 15;
      MAPS.livingArea.tiles.forEach((row) =>
        row.unshift(...new Array(X_OFFSET).fill(0)),
      );

      // 向陣列前端正式加入北側五排，不使用非法的負 z 座標。
      // 舊小屋的 tile 會跟著舊地圖下移，所以先清掉，再依 LAYOUT 重建新位置。
      export const northRowWidth = MAPS.livingArea.tiles[0].length;
      MAPS.livingArea.tiles.unshift(
        ...Array.from({ length: NORTH_EXPANSION }, () =>
          new Array(northRowWidth).fill(0),
        ),
      );
      for (let z = 1 + NORTH_EXPANSION; z <= 3 + NORTH_EXPANSION; z++) {
        for (let x = LAYOUT.barn.x; x < LAYOUT.barn.x + LAYOUT.barn.w; x++)
          MAPS.livingArea.tiles[z][x] = 0;
      }
      for (let z = LAYOUT.barn.z; z < LAYOUT.barn.z + LAYOUT.barn.d; z++) {
        if (z < 0 || z >= MAPS.livingArea.tiles.length) continue;
        for (let x = LAYOUT.barn.x; x < LAYOUT.barn.x + LAYOUT.barn.w; x++)
          MAPS.livingArea.tiles[z][x] = 1;
      }
      // 清掉動物小屋門前偏左一格的樹；位置從穀倉門推導，不另寫絕對座標。
      MAPS.livingArea.tiles[LAYOUT.barn.z + LAYOUT.barn.d + 2][
        LAYOUT.barn.doorX - 1
      ] = 0;

      // 除錯工具找到最後一批死資料：x=17~19,z=13~14 還留著 tile=7，是很多輪
      // 之前那個 6 格小農田的殘骸。現在的 9 塊大農田系統完全不靠陣列裡的
      // tile=7 運作(渲染跟互動都讀 FARMLAND_TILES，不是陣列本身)，這幾格
      // 純粹是死資料，清掉
      [13, 14].forEach((z) => {
        [17, 18, 19].forEach((x) => {
          MAPS.livingArea.tiles[z + NORTH_EXPANSION][x] = 0;
        });
      });

      // 除錯工具抓到另一個舊帳：之前幾輪搬湖的位置，每次只有「在新位置寫水」，
      // 沒有把舊位置清回草地，這裡殘留了一小塊(x=16~18,z=8~10)。順手清掉
      [8, 9, 10].forEach((z) => {
        [16, 17, 18].forEach((x) => {
          MAPS.livingArea.tiles[z + NORTH_EXPANSION][x] = 0;
        });
      });

      // ==============================================================
      // 1.45) 先在陣列尾端補足農田空間；第四排田需要再增加四列。
      // ==============================================================
      (function extendBaseRowsForFarm() {
        const width = MAPS.livingArea.tiles[0].length; // 14，這時候還沒插緩衝欄/沙灘欄
        for (let i = 0; i < 13; i++)
          MAPS.livingArea.tiles.push(new Array(width).fill(0));
      })();

      // ==============================================================
      // 1.5) 在地圖右邊擴建一片海邊 — tile 8 = 沙灘（可走）、tile 9 = 海（不可走）。
      //    海面本身不在這裡逐格建置，而是在 buildMap() 裡另外蓋成一整片可
      //    變形的網格，這樣才能在 animate() 裡逐頂點做波浪動畫
      // ==============================================================
      // 原本的 3 格緩衝再增加 5 格，整條懸崖、沙灘與海面一起東移。
      MAPS.livingArea.tiles.forEach((row) =>
        row.splice(26, 0, ...new Array(3 + LAYOUT.coast.eastExpansion).fill(0)),
      );

      export const BEACH_SAND_COLS = LAYOUT.coast.sandCols;
      export const BEACH_OCEAN_COLS = LAYOUT.coast.oceanCols;
      export const BEACH_BAND_WIDTH = BEACH_SAND_COLS + BEACH_OCEAN_COLS;
      MAPS.livingArea.tiles.forEach((row, z) => {
        // 沙灘/海交界沿 z 抖動，總寬度固定不變（陣列仍是矩形），只有沙灘跟
        // 海各自佔幾格會跟著波動，海岸線才不會是一條直線
        const sandCols = Math.min(
          BEACH_BAND_WIDTH - 3,
          Math.max(3, BEACH_SAND_COLS + coastShoreJitter(z)),
        );
        const oceanCols = BEACH_BAND_WIDTH - sandCols;
        for (let i = 0; i < sandCols; i++) row.push(8);
        for (let i = 0; i < oceanCols; i++) row.push(9);
      });

      // ==============================================================
      // 1.55) 農田依 LAYOUT 排列大區塊(每塊 3×3，區塊間留 1 格路當 gap)，
      //    湖也順便放大——原本 3×3(9格) 放大到空間允許的極限
      // ==============================================================
      export const FARM_ORIGIN = LAYOUT.farm; // 農田左上角，現在西移到 x=3
      export const FARMLAND_TILES = [];
      export const FARM_BLOCK_STEP = FARM_ORIGIN.plotSize + FARM_ORIGIN.gap;
      export const FARM_MAX_X =
        FARM_ORIGIN.x +
        (FARM_ORIGIN.columns - 1) * FARM_BLOCK_STEP +
        FARM_ORIGIN.plotSize -
        1;
      export const FARM_MAX_Z =
        FARM_ORIGIN.z +
        (FARM_ORIGIN.rows - 1) * FARM_BLOCK_STEP +
        FARM_ORIGIN.plotSize -
        1;
      for (let bc = 0; bc < FARM_ORIGIN.columns; bc++) {
        for (let br = 0; br < FARM_ORIGIN.rows; br++) {
          for (let px = 0; px < FARM_ORIGIN.plotSize; px++) {
            for (let pz = 0; pz < FARM_ORIGIN.plotSize; pz++) {
              FARMLAND_TILES.push([
                FARM_ORIGIN.x + bc * FARM_BLOCK_STEP + px,
                FARM_ORIGIN.z + br * FARM_BLOCK_STEP + pz,
              ]);
            }
          }
        }
      }
      // 區塊間的走道完全由欄／排數推導，會自動貫穿整片農田。
      for (let bc = 1; bc < FARM_ORIGIN.columns; bc++) {
        const pathX = FARM_ORIGIN.x + bc * FARM_BLOCK_STEP - FARM_ORIGIN.gap;
        for (let z = FARM_ORIGIN.z; z <= FARM_MAX_Z; z++)
          MAPS.livingArea.tiles[z][pathX] = 5;
      }
      for (let br = 1; br < FARM_ORIGIN.rows; br++) {
        const pathZ = FARM_ORIGIN.z + br * FARM_BLOCK_STEP - FARM_ORIGIN.gap;
        for (let x = FARM_ORIGIN.x; x <= FARM_MAX_X; x++)
          MAPS.livingArea.tiles[pathZ][x] = 5;
      }

      // 湖再放大一輪，往「房子左上」拉：原本 5×4(20格)，現在 6×6(36格)。
      // 講清楚空間上的硬限制：房子在 x=5~7，西邊到地圖邊界(山區背景開始的
      // 地方)只有大概 5~6 格寬，9 格寬真的放不下，除非房子搬家或地圖再往
      // 西擴——這次先把牧場往東擠一點，把讓出來的空間全部給湖
      // 每次依 LAYOUT 重建湖泊前，先清掉所有舊湖水，避免搬遷後殘留死資料。
      MAPS.livingArea.tiles.forEach((row) =>
        row.forEach((tile, x) => {
          if (tile === 6) row[x] = 0;
        }),
      );
      for (let z = LAYOUT.lake.z; z < LAYOUT.lake.z + LAYOUT.lake.height; z++) {
        for (
          let x = LAYOUT.lake.x;
          x < LAYOUT.lake.x + LAYOUT.lake.width;
          x++
        ) {
          MAPS.livingArea.tiles[z][x] = isInsideLakeShape(x, z) ? 6 : 0;
        }
      }

      // 湖的外框清理可能掃到相鄰建築；地形完成後以 buildings 為唯一資料源重建
      // 完整佔地，確保主屋與穀倉的視覺、tile 碰撞永遠一致。
      MAPS.livingArea.buildings.forEach((building) => {
        for (let z = building.z; z < building.z + building.d; z++) {
          if (z < 0 || z >= MAPS.livingArea.tiles.length) continue;
          for (let x = building.x; x < building.x + building.w; x++) {
            MAPS.livingArea.tiles[z][x] = 1;
          }
        }
      });

      // 果園南側紅色風車占地。
      for (
        let z = LAYOUT.windmill.z;
        z < LAYOUT.windmill.z + LAYOUT.windmill.d;
        z++
      ) {
        for (
          let x = LAYOUT.windmill.x;
          x < LAYOUT.windmill.x + LAYOUT.windmill.w;
          x++
        ) {
          MAPS.livingArea.tiles[z][x] = 1;
        }
      }

      export const POUCH_POS = { x: LAYOUT.farm.x + 3, z: LAYOUT.farm.z + 1 }; // 農田走道上

      // ==============================================================
      // 1.6) 緩坡只留一條走廊開放(z=14~16)，其餘 z 的 x=14~16 變成擋路的懸崖
      //    （原本是 x=11~13，因為上面多插了 3 格草地緩衝，整個右移 3 格）
      // ==============================================================
      export const RAMP_CORRIDOR_MIN_Z = 14 + NORTH_EXPANSION;
      export const RAMP_CORRIDOR_MAX_Z = 16 + NORTH_EXPANSION;
      MAPS.livingArea.tiles.forEach((row, z) => {
        const rampX = LAYOUT.coast.rampX;
        if (z < RAMP_CORRIDOR_MIN_Z || z > RAMP_CORRIDOR_MAX_Z) {
          for (let x = rampX; x < rampX + LAYOUT.coast.rampWidth; x++)
            row[x] = 1;
        } else {
          for (let x = rampX; x < rampX + LAYOUT.coast.rampWidth; x++)
            row[x] = 0;
        }
      });

      // ==============================================================
      // 1.7) 城區——參考圖裡「下方城區」的位置卡位。純平面／方塊佔位，還沒做
      //    細節，先確保地圖南邊有路接得過去，佈局比例對了，之後再回頭精修
      // ==============================================================
      export const TOWN_ROWS = 6;
      export const TOWN_Z_START = MAPS.livingArea.tiles.length; // 現在是 25（農田南移後多佔了 3 排）
      (function extendTown() {
        const width = MAPS.livingArea.tiles[0].length;
        for (let i = 0; i < TOWN_ROWS; i++) {
          const row = new Array(width).fill(0);
          MAPS.livingArea.tiles.push(row);
        }
      })();

      // 清除農田右側邊緣的樹，以及主屋門正前方、與門同一直線的樹。
      MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.farm.x + 10] = 0;
      MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.house.doorX] = 0;

      // 牧草地保持開闊：清掉範圍內原始地圖的普通樹；果樹由果園系統獨立生成。
      for (
        let z = Math.max(0, LAYOUT.pasture.z);
        z < LAYOUT.pasture.z + LAYOUT.pasture.height;
        z++
      ) {
        for (
          let x = LAYOUT.pasture.x;
          x < LAYOUT.pasture.x + LAYOUT.pasture.width;
          x++
        ) {
          if (MAPS.livingArea.tiles[z][x] === 2)
            MAPS.livingArea.tiles[z][x] = 0;
        }
      }

      // 主屋門外道路以門中心對齊，寬三格並一路筆直延伸到地圖最南端。
      export const HOUSE_ROAD_X = LAYOUT.house.doorX;
      export const HOUSE_ROAD_START_Z = LAYOUT.house.z + LAYOUT.house.d + 1;
      export const HOUSE_ROAD_HALF_WIDTH = Math.floor(LAYOUT.houseRoad.width / 2);
      for (let z = HOUSE_ROAD_START_Z; z < MAPS.livingArea.tiles.length; z++) {
        for (
          let x = HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH;
          x <= HOUSE_ROAD_X + HOUSE_ROAD_HALF_WIDTH;
          x++
        ) {
          MAPS.livingArea.tiles[z][x] = 5;
        }
      }

      // 主屋門前道路往西分支；接近農田的北側入口向北加寬兩格，形成三格深的入口。
      // 農田本體四周另鋪一圈一格寬道路，南側不再繼續向城區延伸。
      // 路線全部由 LAYOUT 推導；之後移動房屋或農田時不需要重寫絕對座標。
      export const FARM_ACCESS_X = LAYOUT.farm.x - 1;
      export const FARM_ACCESS_NORTH_Z = LAYOUT.farm.z - 1;
      export const FARM_ACCESS_SOUTH_Z = FARM_MAX_Z + 1;
      export const FARM_ACCESS_EAST_X = FARM_MAX_X + 1;
      for (let dz = 0; dz < LAYOUT.farmAccessRoad.width; dz++) {
        const z = FARM_ACCESS_NORTH_Z - dz;
        for (
          let x = FARM_ACCESS_X;
          x <= HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH;
          x++
        ) {
          MAPS.livingArea.tiles[z][x] = 5;
        }
      }
      for (let z = FARM_ACCESS_NORTH_Z; z <= FARM_ACCESS_SOUTH_Z; z++) {
        MAPS.livingArea.tiles[z][FARM_ACCESS_X] = 5;
        MAPS.livingArea.tiles[z][FARM_ACCESS_EAST_X] = 5;
      }
      for (let x = FARM_ACCESS_X; x <= FARM_ACCESS_EAST_X; x++) {
        MAPS.livingArea.tiles[FARM_ACCESS_NORTH_Z][x] = 5;
        MAPS.livingArea.tiles[FARM_ACCESS_SOUTH_Z][x] = 5;
      }

      // 在海堤走廊位置向東鋪出三格寬支路，接到階梯前；階梯本身由地形系統渲染。
      export const COAST_ROAD_CENTER_Z = Math.floor(
        (RAMP_CORRIDOR_MIN_Z + RAMP_CORRIDOR_MAX_Z) / 2,
      );
      export const COAST_ROAD_HALF_WIDTH = Math.floor(LAYOUT.coastRoad.width / 2);
      for (
        let z = COAST_ROAD_CENTER_Z - COAST_ROAD_HALF_WIDTH;
        z <= COAST_ROAD_CENTER_Z + COAST_ROAD_HALF_WIDTH;
        z++
      ) {
        for (
          let x = HOUSE_ROAD_X - HOUSE_ROAD_HALF_WIDTH;
          x < LAYOUT.coast.rampX;
          x++
        ) {
          MAPS.livingArea.tiles[z][x] = 5;
        }
      }

      // 略過最上方左右各兩棵，從農田起點往南四格後開始種植行道樹。
      export const AVENUE_TREE_TILES = [];
      for (
        let z = LAYOUT.farm.z + 4;
        z < MAPS.livingArea.tiles.length;
        z += 2
      ) {
        [HOUSE_ROAD_X - 2, HOUSE_ROAD_X + 2].forEach((x) => {
          AVENUE_TREE_TILES.push([x, z]);
          MAPS.livingArea.tiles[z][x] = 2;
        });
      }
      export const AVENUE_TREE_KEYS = new Set(
        AVENUE_TREE_TILES.map(([x, z]) => `${x},${z}`),
      );
      export const SOUTHERNMOST_AVENUE_TREE_Z = Math.max(
        ...AVENUE_TREE_TILES.map(([, z]) => z),
      );
      // 清掉休息區入口旁的舊樹，讓人能從行道樹間穿進兩個新區域。
      MAPS.livingArea.tiles[LAYOUT.farm.z + 1][LAYOUT.restArea.x - 1] = 0;

      // 東側沙灘上開一個踏入點，銜接港口地圖北端；此時沙灘/海面已經鋪好，
      // 這一格原本是沙灘(8)，改成門檻(3)只是換個踩踏標記，還是能走。
      MAPS.livingArea.tiles[20][40] = 3;

      // ==============================================================
      // 木匠抵達——第一個真正的劇情事件，之後招募其他角色可以複製這個
      // 「stage 字串 + 觸碰事件推進 + showDialogSequence(onComplete)」的框架。
      // stage 一路往前推，不會回頭，觸發點自己檢查 stage 就能防止重複觸發：
      //   not_started      → 港口觸碰事件觸發碼頭見面
      //   en_route_village → 舊城鎮空屋觸碰事件觸發抵達空屋 + 材料檢查
      //   construction     → 空屋旁顯示施工中標記，等 CARPENTER_CONSTRUCTION_DAYS 天
      //   ready_for_move_in→ 天數到了，晚上回空屋觸發入住場景
      //   moved_in         → 木匠正式出現在 livingArea，恢復原本的排程走動
      // 宣告要放在 events 陣列前面：events 是一般陣列常值，裡面的座標會立刻
      // 求值（不像函式內容那樣延後執行），晚宣告會直接撞到 TDZ 錯誤。
      // ==============================================================
      export const CARPENTER_HOUSE = { x: 3, z: 4 }; // oldVillage.placeholders 裡指定給木匠的那一間
      export const CARPENTER_DOORSTEP = { x: 3, z: 5 }; // 空屋正前方，兩段劇情共用同一個觸碰點
      export const CARPENTER_MATERIALS = { wood: 10, stone: 5 };
      export const CARPENTER_CONSTRUCTION_DAYS = 2;
      export const carpenterQuest = {
        stage: "not_started",
        constructionStartDay: -1,
      };

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
        // 生活區東側海岸 <-> 港口北端(碼頭附近)
        {
          map: "livingArea",
          x: 40,
          z: 20,
          trigger: "touch",
          action: () => loadMap("port", { x: 7, z: 4 }),
        },
        {
          map: "port",
          x: 7,
          z: 2,
          trigger: "touch",
          action: () => loadMap("livingArea", { x: 35, z: 20 }),
        },
        // 港口南端(市場/倉庫) <-> 舊城鎮
        {
          map: "port",
          x: 7,
          z: 15,
          trigger: "touch",
          action: () => loadMap("oldVillage", { x: 7, z: 2 }),
        },
        {
          map: "oldVillage",
          x: 7,
          z: 0,
          trigger: "touch",
          action: () => loadMap("port", { x: 7, z: 13 }),
        },
        // 木匠抵達事件——港口碼頭見面 + 舊城鎮空屋門口(往返兩段劇情共用同一格)
        {
          map: "port",
          x: 7,
          z: 3,
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
      ];

      // ==============================================================
      // 2) A* 網格路徑規劃 — 只有上下左右四個方向，跟玩家移動同一套邏輯，
      //    這樣走出來的路徑「感覺」才會跟這個世界一致，不會忽然出現斜線
      // ==============================================================
      export function aStar(start, goal, cols, rows, isBlockedFn) {
        const key = (x, z) => `${x},${z}`;
        const goalKey = key(goal.x, goal.z);
        const heuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

        const gScore = new Map([[key(start.x, start.z), 0]]);
        const cameFrom = new Map();
        const open = [{ x: start.x, z: start.z, f: heuristic(start, goal) }];
        const closed = new Set();

        while (open.length) {
          open.sort((a, b) => a.f - b.f);
          const current = open.shift();
          const ck = key(current.x, current.z);
          if (ck === goalKey) {
            const path = [{ x: current.x, z: current.z }];
            let k = ck;
            while (cameFrom.has(k)) {
              const prev = cameFrom.get(k);
              path.unshift(prev);
              k = key(prev.x, prev.z);
            }
            return path;
          }
          closed.add(ck);
          const neighbors = [
            { x: current.x + 1, z: current.z },
            { x: current.x - 1, z: current.z },
            { x: current.x, z: current.z + 1 },
            { x: current.x, z: current.z - 1 },
          ];
          for (const nb of neighbors) {
            if (nb.x < 0 || nb.x >= cols || nb.z < 0 || nb.z >= rows) continue;
            if (isBlockedFn(nb.x, nb.z)) continue;
            const nk = key(nb.x, nb.z);
            if (closed.has(nk)) continue;
            const tentativeG = gScore.get(ck) + 1;
            if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
              gScore.set(nk, tentativeG);
              cameFrom.set(nk, { x: current.x, z: current.z });
              const f = tentativeG + heuristic(nb, goal);
              const existing = open.find((o) => o.x === nb.x && o.z === nb.z);
              if (existing) existing.f = f;
              else open.push({ x: nb.x, z: nb.z, f });
            }
          }
        }
        return null; // 找不到路（例如目標被完全封死）
      }
