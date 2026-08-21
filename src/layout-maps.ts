import { hash2 } from "./utils";

// ==============================================================
      // 統一佈局設定 —— 之後要調哪個區域的位置/大小，改這裡就好，不要再
      // 回頭找散落各處的絕對座標。房子、穀倉、牧場這次先不動，農田往西
      // 移、湖放大到接近 10×10、山搬進西側緩衝帶。要放在 MAPS 前面，因為
      // 下面 buildings 陣列會直接引用這裡的值
      // ==============================================================
      export const NORTH_EXPANSION = 5;
      export const LAYOUT = {
        // 北側新增 5 排：動物區留在新空間，其餘舊區域整體往南順延。
        house: { x: 20, z: 9 + NORTH_EXPANSION, w: 3, d: 2, doorX: 21, visualScale: 2, doorWorldHeight: 1.05 },
        barn: { x: 23, z: -2, w: 3, d: 2, doorX: 24, visualScale: 2, doorWorldHeight: 1.05 }, // 整座動物小屋向北移 3 格
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
        restArea: {
          x: 25,
          z: 24,
          width: 8,
          height: 6,
          chair: { offsetX: 2, offsetZ: 4, rotation: 0, playerRotation: Math.PI },
        },
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
          // 從 10 加到 16：女神祠堂步道往東延伸後幾乎頂到原本的陣列邊界，
          // 每排一定要留至少一格真的海(9)，海面西緣偵測(westXByZ，逐排找
          // row.indexOf(9))才不會因為整排都被改成沙灘而找不到海、退化成
          // 沿用鄰排的舊海岸線，導致海面網格蓋住新沙灘（曾經真的踩到這個坑）。
          oceanCols: 16,
        },
        mountainBand: { x: -7, width: 6 },
        mountainGateway: {
          startX: 3,
          startZ: 20,
          steps: 4,
          risePerStep: 0.2,
          width: 1.65,
          visualSteps: 10,
          visualRun: 0.12,
          visualDropPerStep: 1.35,
          visualWidth: 1.45,
        },
        oldVillage: {
          width: 47,
          height: 30,
          westExpansion: 6,
          houseVisualScale: 1.5,
          houseDoorWorldHeight: 1.05,
          livingGate: { x: 33, z: 0, width: 3 },
          livingAreaGate: { x: 20, z: 42, width: 3 },
          portGate: {
            x: 46,
            z: 4,
            height: 26,
            portX: 0,
            portZ: 4,
            portHeight: 26,
          },
          mountainRoad: { x: 3, z: 29, width: 3 },
          mountainGate: { x: 1, z: 0 },
          artVillageGate: { x: 3, z: 29 },
          artVillageSouthGate: { x: 36, z: 29, artX: 9, artZ: 0 },
          plaza: { x: 28, z: 4, width: 18, height: 22 },
          terraces: {
            upper: { maxZ: 9, elevation: 2 },
            middle: { minZ: 10, maxZ: 19, elevation: 1 },
            westEdge: 27.5,
          },
          mountainLanding: { x: 0, z: 0, width: 3, depth: 2, elevation: 3 },
          plazaStairs: [
            { z: 7, width: 3, fromX: 25, toX: 28, elevation: 2, steps: 6 },
            { z: 16, width: 3, fromX: 25, toX: 28, elevation: 1, steps: 6 },
          ],
          westStairs: [
            { x: 0, width: 3, fromZ: 2, toZ: 7, baseElevation: 2, elevation: 1, steps: 6 },
            { x: 0, width: 3, fromZ: 9, toZ: 16, baseElevation: 1, elevation: 1, steps: 7 },
            { x: 0, width: 3, fromZ: 19, toZ: 26, baseElevation: 0, elevation: 1, steps: 7 },
          ],
          carpenterHouse: { x: 6, z: 13, d: 3, doorX: 7 },
          // w/d/doorX/wallColor/roofColor/role：10 棟對應使用者定案的城鎮
          // 角色設定(4/3/3 三排)。role 純粹是資料標籤，給 build-map.ts 挑
          // 對應的門口裝飾用，也方便之後其他系統(NPC 排程等)用名字找到
          // 特定房子，不影響 makeBuilding/makeBarn 的渲染。w 加倍的三棟
          // (學校/雜貨店兼行政中心/民宿)是使用者指定的「雙倍寬度」門面
          // 建築；doorX 因此改成新的置中值(x+(w-1)/2)，其餘座標不動——
          // 佔地仍是單格 tile=1(見 makeOldVillageTiles)，不影響碰撞跟既有
          // 的城鎮<->生活區/港口/美術村事件。原本 3 棟的 style:"barn"(穀倉
          // 雙開門+閣樓圓窗)拿掉了：新角色沒有一棟適合穀倉造型，統一用
          // makeBuilding，靠顏色+門口裝飾物做區分。carpenterHouse(6,24)
          // 沒有 wallColor/roofColor，維持原本的 makeTownPlaceholder 佔位
          // ——那間是木匠事件用的「還沒整修好」空屋，施工告示牌/入住後的
          // 發光窗戶都是靠劇情 stage 另外疊上去的(見 build-map.ts)，太早
          // 把它做漂亮會跟「這間需要修」的敘事衝突，等木匠劇情真的做到
          // 那一步再回頭一起處理。
          houses: [
            // 學校——雙倍寬度，磚紅屋頂+暖色牆面，屋頂鐘塔+旗桿是最醒目
            // 的地標。
            {
              x: 5, z: 4, seed: 0.18, w: 4, d: 3, doorX: 6.5, role: "school",
              wallColor: 0xe4c9a0, roofColor: 0x7a2e2e,
            },
            // 醫院——白牆+藍灰屋頂的醫療配色，門口上方掛紅十字招牌。
            {
              x: 11, z: 4, seed: 0.34, w: 3, d: 3, doorX: 12, role: "hospital",
              wallColor: 0xf2f0ea, roofColor: 0x3a5a72,
            },
            // 醫生家——跟醫院同一套藍調但降一階彩度，門口掛小十字牌。
            {
              x: 16, z: 4, seed: 0.52, w: 3, d: 3, doorX: 17, role: "doctor",
              wallColor: 0xd7e3e6, roofColor: 0x4a5a5e,
            },
            // 護士家——淺薄荷綠牆+暖陶土屋頂，跟醫生家同組但用色區分開來。
            {
              x: 21, z: 4, seed: 0.68, w: 3, d: 3, doorX: 22, role: "nurse",
              wallColor: 0xdce8dc, roofColor: 0x8a5a42,
            },
            // 老師家——暖芥末黃牆面，門口一疊書本裝飾。
            {
              x: 6, z: 13, seed: 0.27, w: 3, d: 3, doorX: 7, role: "carpenter",
              wallColor: 0xd8c078, roofColor: 0x5a4530,
            },
            // 海洋學家家——藍綠牆面+風化灰藍屋頂，門口掛一個簡化船舵裝飾。
            {
              x: 12, z: 13, seed: 0.46, w: 3, d: 3, doorX: 13,
              role: "oceanographer", wallColor: 0x9fc4c9, roofColor: 0x33525c,
            },
            // 雜貨店兼行政中心——雙倍寬度，整個城鎮視覺上的商業/行政門面：
            // 遮陽棚+吊招牌。
            {
              x: 18, z: 13, seed: 0.73, w: 4, d: 3, doorX: 19.5,
              role: "generalStore", wallColor: 0xd9a94a, roofColor: 0x2f6b63,
            },
            // 木匠家——木匠事件用的「還沒整修好」空屋，見上方說明。
            {
              x: 6, z: 23, seed: 0.22, w: 3, d: 3, doorX: 7,
              role: "teacher", wallColor: 0xb8aa91, roofColor: 0x51443f,
            },
            // 藝術家家——粉調牆面+梅紫屋頂，門口擺一個簡化畫架。
            {
              x: 12, z: 23, seed: 0.57, w: 3, d: 3, doorX: 13,
              role: "artist", wallColor: 0xd6a0c4, roofColor: 0x5a3a6a,
            },
            // 民宿——雙倍寬度，門口一支吊招牌+一盞燈籠，比住宅群更有「迎賓」
            // 的存在感。
            {
              x: 18, z: 23, seed: 0.81, w: 4, d: 3, doorX: 19.5,
              role: "guesthouse", wallColor: 0xdcb894, roofColor: 0x4a3428,
            },
          ],
        },
        mountain: {
          width: 38,
          height: 68,
          townGate: { x: 5, z: 67 },
          homeGate: { x: 32, z: 34 },
          townArrival: { x: 5, z: 65 },
          homeArrival: { x: 30, z: 34 },
          homeStoneStairs: {
            x: 31.65,
            z: 34,
            steps: 12,
            run: 0.58,
            dropPerStep: 0.34,
            width: 1.85,
          },
          foot: { x: 4, z: 49, width: 27, depth: 19, elevation: 0 },
          waist: { x: 7, z: 26, width: 27, depth: 18, elevation: 3.2 },
          summit: { x: 11, z: 3, width: 19, depth: 16, elevation: 6.5 },
          lowerStair: { x: 21, width: 3, fromZ: 42, toZ: 51, baseElevation: 0, elevation: 3.2, steps: 14 },
          upperStair: { x: 12, width: 3, fromZ: 17, toZ: 28, baseElevation: 3.2, elevation: 3.3, steps: 16 },
          treeDensity: 0.42,
          plazas: {
            summit: [
              { x: 15, z: 7, width: 11, depth: 7 },
              { x: 13, z: 9, width: 15, depth: 3 },
            ],
            waist: [
              { x: 14, z: 31, width: 14, depth: 8 },
              { x: 11, z: 34, width: 20, depth: 3 },
              { x: 18, z: 29, width: 10, depth: 12 },
            ],
            foot: [
              { x: 10, z: 54, width: 14, depth: 9 },
              { x: 8, z: 57, width: 19, depth: 4 },
              { x: 14, z: 52, width: 9, depth: 13 },
            ],
          },
          trees: [
            [27, 56], [9, 57], [18, 63], [24, 52],
            [10, 31], [16, 29], [27, 31], [32, 38], [18, 39], [25, 37],
            [14, 8], [18, 6], [27, 11], [27, 14],
          ],
        },
        port: {
          width: 34,
          height: 50,
          oceanExpansion: 10,
          oceanViewPadding: 50,
          beachDepth: 10,
          elevation: 1,
          stairs: { x: 4, z: 8, width: 9, depth: 3 },
          livingGate: { x: 0, z: 0, width: 14 },
          livingAreaGate: { x: 34, z: 42, width: 14 },
          playerArrival: { x: 7, z: 11 },
          carpenterMeet: { x: 13, z: 28 },
          townGate: { x: 3, z: 29 },
          shopRoad: { z: 14, height: 5 },
          basin: { x: 6, z: 18, width: 15, height: 9 },
          ferry: { x: 13, z: 22 },
          southQuay: { z: 27, height: 3 },
          southBeach: { x: 0, z: 30, width: 21, depth: 10 },
          southBeachStairs: { x: 7, z: 29, width: 7, depth: 3 },
          smallBoatDock: { x: 21, z: 27, length: 9 },
          shops: [
            { x: 9, z: 12, w: 3, d: 2, seed: 0.22 },
            { x: 13, z: 12, w: 4, d: 2, seed: 0.47 },
            { x: 18, z: 12, w: 3, d: 2, seed: 0.73 },
          ],
        },
      };
      export const REST_CHAIR = {
        x: LAYOUT.restArea.x + LAYOUT.restArea.chair.offsetX,
        z: LAYOUT.restArea.z + LAYOUT.restArea.chair.offsetZ,
        rotation: LAYOUT.restArea.chair.rotation,
        playerRotation: LAYOUT.restArea.chair.playerRotation,
      };

      function makeMountainMapTiles() {
        const mountain = LAYOUT.mountain;
        const tiles = Array.from({ length: mountain.height }, () =>
          Array(mountain.width).fill(1),
        );
        const paint = (x, z, width, depth, tile = 0) => {
          for (let dz = z; dz < z + depth; dz++)
            for (let dx = x; dx < x + width; dx++)
              if (tiles[dz]?.[dx] !== undefined) tiles[dz][dx] = tile;
        };
        const path = (x, z, width, depth) => paint(x, z, width, depth, 5);
        paint(mountain.foot.x, mountain.foot.z, mountain.foot.width, mountain.foot.depth);
        paint(mountain.waist.x, mountain.waist.z, mountain.waist.width, mountain.waist.depth);
        paint(mountain.summit.x, mountain.summit.z, mountain.summit.width, mountain.summit.depth);
        // 山腳先沿平台內側來回折返，再接第一段長階梯；避免入口到階梯只剩一條直角走廊。
        path(mountain.townGate.x - 1, mountain.foot.z + 12, 3, 7);
        path(mountain.townGate.x - 1, mountain.foot.z + 11, 11, 3);
        path(mountain.townGate.x + 8, mountain.foot.z + 7, 3, 6);
        path(mountain.townGate.x + 8, mountain.foot.z + 6, mountain.lowerStair.x - mountain.townGate.x - 5, 3);
        path(mountain.lowerStair.x, mountain.foot.z + 2, 3, 6);
        path(mountain.lowerStair.x, mountain.lowerStair.fromZ, mountain.lowerStair.width, mountain.lowerStair.toZ - mountain.lowerStair.fromZ + 1);
        // 山腰的路往右繞過賞櫻平台，再折回左側的第二段階梯。
        path(mountain.lowerStair.x, mountain.waist.z + 14, 10, 3);
        path(mountain.waist.x + mountain.waist.width - 6, mountain.waist.z + 7, 3, 9);
        path(mountain.upperStair.x, mountain.waist.z + 6, mountain.waist.width - 9, 3);
        path(mountain.upperStair.x, mountain.waist.z, 3, 9);
        path(mountain.upperStair.x, mountain.upperStair.fromZ, mountain.upperStair.width, mountain.upperStair.toZ - mountain.upperStair.fromZ + 1);
        // 第三階直接抵達山頂，但山頂步道仍有一次轉折才到觀景中心。
        path(mountain.upperStair.x, mountain.summit.z + mountain.summit.depth - 5, 11, 3);
        path(mountain.summit.x + 9, mountain.summit.z + 5, 3, 8);
        path(mountain.summit.x + 9, mountain.summit.z + 4, 7, 3);
        Object.values(mountain.plazas).forEach((plazaParts) =>
          plazaParts.forEach((part) =>
            path(part.x, part.z, part.width, part.depth),
          ),
        );
        const protectedClearings = [
          {
            x: mountain.foot.x + Math.floor(mountain.foot.width / 2),
            z: mountain.foot.z + Math.floor(mountain.foot.depth / 2),
            radius: 4,
          },
          {
            x: mountain.summit.x + Math.floor(mountain.summit.width / 2),
            z: mountain.summit.z + Math.floor(mountain.summit.depth / 2),
            radius: 4,
          },
          { x: mountain.homeArrival.x, z: mountain.homeArrival.z, radius: 4.5 },
        ];
        for (let z = 0; z < mountain.height; z++) {
          for (let x = 0; x < mountain.width; x++) {
            if (tiles[z][x] !== 0) continue;
            if (
              protectedClearings.some(
                (clearing) =>
                  Math.hypot(x - clearing.x, z - clearing.z) <= clearing.radius,
              )
            ) continue;
            if (hash2(x * 5.17 + 12.3, z * 7.31 + 4.9) < mountain.treeDensity)
              tiles[z][x] = 2;
          }
        }
        tiles[mountain.townGate.z][mountain.townGate.x] = 3;
        tiles[mountain.homeGate.z][mountain.homeGate.x] = 3;
        mountain.trees.forEach(([x, z]) => {
          const insideClearing = protectedClearings.some(
            (clearing) =>
              Math.hypot(x - clearing.x, z - clearing.z) <= clearing.radius,
          );
          if (tiles[z]?.[x] === 0 && !insideClearing) tiles[z][x] = 2;
        });
        return tiles;
      }

      export function mountainGroundY(x: number, z: number) {
        const mountain = LAYOUT.mountain;
        const stairHeight = (stair) => {
          if (
            x < stair.x - 0.5 ||
            x > stair.x + stair.width - 0.5 ||
            z < stair.fromZ ||
            z > stair.toZ
          )
            return null;
          const stepDepth = (stair.toZ - stair.fromZ) / stair.steps;
          const stepIndex = Math.max(
            0,
            Math.min(
              stair.steps,
              Math.floor((stair.toZ - z) / stepDepth + 1e-6) + 1,
            ),
          );
          return (
            stair.baseElevation +
            stepIndex * (stair.elevation / stair.steps)
          );
        };
        for (const stair of [mountain.lowerStair, mountain.upperStair]) {
          const height = stairHeight(stair);
          if (height !== null) return height;
        }
        if (
          x >= mountain.summit.x - 0.5 &&
          x <= mountain.summit.x + mountain.summit.width - 0.5 &&
          z >= mountain.summit.z - 0.5 &&
          z <= mountain.summit.z + mountain.summit.depth - 0.5
        )
          return mountain.summit.elevation;
        if (
          x >= mountain.waist.x - 0.5 &&
          x <= mountain.waist.x + mountain.waist.width - 0.5 &&
          z >= mountain.waist.z - 0.5 &&
          z <= mountain.waist.z + mountain.waist.depth - 0.5
        )
          return mountain.waist.elevation;
        return 0;
      }

      export function isOnMountainStair(x: number, z: number) {
        const mountain = LAYOUT.mountain;
        return [mountain.lowerStair, mountain.upperStair].some(
          (stair) =>
            x >= stair.x - 0.5 &&
            x <= stair.x + stair.width - 0.5 &&
            z >= stair.fromZ &&
            z <= stair.toZ,
        );
      }

      export function portGroundY(x: number, z: number) {
        const port = LAYOUT.port;
        const stairs = port.stairs;
        const southStairs = port.southBeachStairs;
        if (x >= -0.5 && x <= 2.5 && z >= -0.5 && z <= 0.5)
          return port.elevation;
        if (z > 0.5 && z < 8 && x < 2.5) return port.elevation;
        if (z >= 8 && z <= 11.5 && x < 2.5) return port.elevation;
        const stairRow = Math.floor(z - stairs.z + 0.5);
        const extendsLeft = stairRow >= 0 && stairRow < stairs.depth;
        const onStairs =
          x >= stairs.x - (extendsLeft ? 1.5 : 0.5) &&
          x <= stairs.x + stairs.width - 0.5 &&
          z >= stairs.z - 0.5 &&
          z <= stairs.z + stairs.depth - 0.5;
        if (onStairs) {
          return Math.max(
            0,
            Math.min(
              port.elevation,
              ((z - stairs.z + 1) / stairs.depth) * port.elevation,
            ),
          );
        }
        const onSouthStairs =
          x >= southStairs.x - 0.5 &&
          x <= southStairs.x + southStairs.width - 0.5 &&
          z >= southStairs.z - 0.5 &&
          z <= southStairs.z + southStairs.depth - 0.5;
        if (onSouthStairs) {
          return Math.max(
            0,
            Math.min(
              port.elevation,
              ((southStairs.z + southStairs.depth - z) / southStairs.depth) *
                port.elevation,
            ),
          );
        }
        const southBeach = port.southBeach;
        if (
          x >= southBeach.x - 0.5 &&
          x <= southBeach.x + southBeach.width - 0.5 &&
          z >= southBeach.z - 0.5 &&
          z <= portSouthBeachEndZ(Math.round(x)) + 0.5
        )
          return 0;
        return z >= port.beachDepth + 0.5 ? port.elevation : 0;
      }

      // 南沙灘的海岸線以 x 為種子產生穩定的小幅凹凸。地圖、碰撞與水面
      // 都呼叫這個函式，避免沙格已經彎曲但水面仍維持一條直線。
      export function portSouthBeachEndZ(x: number) {
        const beach = LAYOUT.port.southBeach;
        const wave = Math.sin((x + 1.5) * 0.72) * 1.05;
        const noise = (hash2(x * 1.91, 73.4) - 0.5) * 1.1;
        const offset = Math.max(-1, Math.min(1, Math.round(wave + noise)));
        return beach.z + beach.depth - 1 + offset;
      }

      export function oldVillageGroundY(x: number, z: number) {
        const village = LAYOUT.oldVillage;
        const landing = village.mountainLanding;
        if (
          x >= landing.x - 0.5 &&
          x <= landing.x + landing.width - 0.5 &&
          z >= landing.z - 0.5 &&
          z <= landing.z + landing.depth
        )
          return landing.elevation;
        const westStair = village.westStairs.find(
          (candidate) =>
            x >= candidate.x - 0.5 &&
            x <= candidate.x + candidate.width - 0.5 &&
            z >= candidate.fromZ &&
            z <= candidate.toZ,
        );
        if (westStair) {
          const progress = Math.max(
            0,
            Math.min(1, (westStair.toZ - z) / (westStair.toZ - westStair.fromZ)),
          );
          return (
            westStair.baseElevation +
            Math.ceil(progress * westStair.steps - Number.EPSILON) *
              (westStair.elevation / westStair.steps)
          );
        }
        const stair = village.plazaStairs.find(
          (entry) =>
            z >= entry.z - 0.5 &&
            z <= entry.z + entry.width - 0.5 &&
            x >= entry.fromX - 0.5 &&
            x <= entry.toX + 0.5,
        );
        if (stair) {
          const progress = Math.max(
            0,
            Math.min(1, (stair.toX - x) / (stair.toX - stair.fromX)),
          );
          return (
            Math.ceil(progress * stair.steps - Number.EPSILON) *
            (stair.elevation / stair.steps)
          );
        }
        if (x > village.terraces.westEdge) return 0;
        if (z <= village.terraces.upper.maxZ)
          return village.terraces.upper.elevation;
        if (
          z >= village.terraces.middle.minZ &&
          z <= village.terraces.middle.maxZ
        )
          return village.terraces.middle.elevation;
        return 0;
      }

      export function isOnOldVillageStair(x: number, z: number) {
        const village = LAYOUT.oldVillage;
        const landing = village.mountainLanding;
        return (
          (x >= landing.x - 0.5 &&
            x <= landing.x + landing.width - 0.5 &&
            z >= landing.z - 0.5 &&
            z <= landing.z + landing.depth) ||
          village.westStairs.some(
            (stair) =>
              x >= stair.x - 0.5 &&
              x <= stair.x + stair.width - 0.5 &&
              z >= stair.fromZ &&
              z <= stair.toZ,
          ) ||
          village.plazaStairs.some(
            (stair) =>
              z >= stair.z - 0.5 &&
              z <= stair.z + stair.width - 0.5 &&
              x >= stair.fromX &&
              x <= stair.toX,
          )
        );
      }

      // 城鎮露台與樓梯的防墜扶手。線段同時供視覺與碰撞使用；樓梯口刻意
      // 留空，只封住能直接跨越高低差的邊緣。
      export const OLD_VILLAGE_RAILS = [
        {
          x1: 3, z1: 9.5, x2: 25, z2: 9.5,
          elevation: LAYOUT.oldVillage.terraces.upper.elevation,
        },
        {
          x1: 3, z1: 19.5, x2: 25, z2: 19.5,
          elevation: LAYOUT.oldVillage.terraces.middle.elevation,
        },
        { x1: LAYOUT.oldVillage.terraces.westEdge, z1: 0, x2: LAYOUT.oldVillage.terraces.westEdge, z2: 6.5 },
        { x1: LAYOUT.oldVillage.terraces.westEdge, z1: 10, x2: LAYOUT.oldVillage.terraces.westEdge, z2: 15.5 },
        ...LAYOUT.oldVillage.plazaStairs.flatMap((stair) => [
          { x1: stair.fromX, z1: stair.z - 0.5, x2: stair.toX, z2: stair.z - 0.5 },
          { x1: stair.fromX, z1: stair.z + stair.width - 0.5, x2: stair.toX, z2: stair.z + stair.width - 0.5 },
        ]),
        ...LAYOUT.oldVillage.westStairs.flatMap((stair) => [
          { x1: stair.x - 0.5, z1: stair.fromZ, x2: stair.x - 0.5, z2: stair.toZ },
          { x1: stair.x + stair.width - 0.5, z1: stair.fromZ, x2: stair.x + stair.width - 0.5, z2: stair.toZ },
        ]),
      ];

      export function isBlockedByOldVillageRail(x: number, z: number) {
        const thickness = 0.18;
        return OLD_VILLAGE_RAILS.some((rail) =>
          rail.x1 === rail.x2
            ? Math.abs(x - rail.x1) <= thickness &&
              z >= Math.min(rail.z1, rail.z2) &&
              z <= Math.max(rail.z1, rail.z2)
            : Math.abs(z - rail.z1) <= thickness &&
              x >= Math.min(rail.x1, rail.x2) &&
              x <= Math.max(rail.x1, rail.x2),
        );
      }

      function makePortTiles() {
        const p = LAYOUT.port;
        const tiles = Array.from({ length: p.height }, () =>
          new Array(p.width).fill(0),
        );

        // 北緣是生活區沙灘的延續，直接使用相同的 tile 8 / makeSand() 管線。
        for (let z = 0; z < p.beachDepth; z++) {
          const startX = z < p.beachDepth - 2 ? 3 : 4;
          for (let x = startX; x < p.width; x++) tiles[z][x] = 8;
        }
        for (let x = 20; x < p.width; x++) tiles[p.beachDepth][x] = 8;

        // 原北東側 x=14~23 的沙灘改為海；新增的右側十格也延續成外海。
        for (let z = 0; z <= p.beachDepth; z++) {
          for (let x = 14; x < p.width; x++) tiles[z][x] = 9;
        }
        for (let z = 0; z < p.height; z++) {
          for (let x = p.width - p.oceanExpansion; x < p.width; x++)
            tiles[z][x] = 9;
        }
        for (let z = p.height - p.oceanExpansion; z < p.height; z++) {
          for (let x = 0; x < p.width; x++) tiles[z][x] = 9;
        }

        // 港口南側低地沙灘。先完成外海配置再覆寫沙地，確保擴建後的
        // z=30~39 是可行走沙灘，而新增加的最南十列仍維持外海。
        for (
          let x = p.southBeach.x;
          x < p.southBeach.x + p.southBeach.width;
          x++
        ) {
          for (
            let z = p.southBeach.z;
            z <= p.southBeach.z + p.southBeach.depth;
            z++
          )
            tiles[z][x] = 9;
        }
        for (
          let x = p.southBeach.x;
          x < p.southBeach.x + p.southBeach.width;
          x++
        ) {
          const shoreEndZ = portSouthBeachEndZ(x);
          for (let z = p.southBeach.z; z <= shoreEndZ; z++) tiles[z][x] = 8;
        }

        // 中央內港、右側航道與南側外海；石造碼頭保留在四周的 0 格。
        for (let z = p.basin.z; z < p.basin.z + p.basin.height; z++) {
          for (let x = p.basin.x; x < p.basin.x + p.basin.width; x++)
            tiles[z][x] = 9;
        }
        for (let z = p.basin.z - 1; z < p.height; z++) {
          for (let x = 21; x < p.width; x++) tiles[z][x] = 9;
        }
        for (let x = 4; x < p.width; x++) tiles[p.height - 1][x] = 9;

        // 右側木棧橋伸入航道；終端附近停靠小艇。
        for (
          let z = p.smallBoatDock.z;
          z < p.smallBoatDock.z + p.smallBoatDock.length;
          z++
        )
          tiles[z][p.smallBoatDock.x] = 5;

        p.shops.forEach((shop) => {
          for (let z = shop.z; z < shop.z + shop.d; z++) {
            for (let x = shop.x; x < shop.x + shop.w; x++) tiles[z][x] = 1;
          }
        });
        for (let i = 0; i < p.livingGate.width; i++)
          tiles[p.livingGate.z][p.livingGate.x + i] = 3;
        return tiles;
      }

      function makeOldVillageTiles() {
        const village = LAYOUT.oldVillage;
        const tiles = Array.from({ length: village.height }, () =>
          new Array(village.width).fill(0),
        );
        const paint = (x, z, width, height, tile = 5) => {
          for (let dz = z; dz < z + height; dz++)
            for (let dx = x; dx < x + width; dx++) tiles[dz][dx] = tile;
        };

        // Cinque Terre-inspired hillside circulation: three terraces, narrow climbs,
        // and a broad civic space opening toward the old fishing port.
        const terraceRoadWidth = Math.floor(village.terraces.westEdge - 1);
        paint(2, 7, terraceRoadWidth, 3);
        paint(2, 16, terraceRoadWidth, 3);
        paint(2, 26, terraceRoadWidth, 3);
        // 樓梯本身由橫向道路與廣場覆蓋；不再額外鋪一條直向土色平台，
        // 避免樓梯兩旁露出突兀的方形路皮。
        paint(village.plaza.x, village.plaza.z, village.plaza.width, village.plaza.height);
        paint(village.livingGate.x, 0, village.livingGate.width, 5);
        paint(
          village.mountainLanding.x,
          village.mountainLanding.z,
          village.mountainLanding.width,
          8,
        );
        paint(3, 24, village.mountainRoad.width, 6);

        for (let x = 0; x < village.livingGate.width; x++)
          tiles[0][village.livingGate.x + x] = 3;
        for (let z = 0; z < village.portGate.height; z++)
          tiles[village.portGate.z + z][village.portGate.x] = 3;
        tiles[village.artVillageGate.z][village.artVillageGate.x] = 3;
        tiles[village.artVillageSouthGate.z][village.artVillageSouthGate.x] = 3;
        tiles[village.mountainGate.z][village.mountainGate.x] = 3;
        village.houses.forEach((house) => {
          const width = house.w ?? 1;
          const depth = house.d ?? 1;
          for (let z = house.z; z < house.z + depth; z++) {
            for (let x = house.x; x < house.x + width; x++) tiles[z][x] = 1;
          }
        });
        return tiles;
      }

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
              visualScale: LAYOUT.house.visualScale,
              doorWorldHeight: LAYOUT.house.doorWorldHeight,
            },
            {
              x: LAYOUT.barn.x,
              z: LAYOUT.barn.z,
              w: LAYOUT.barn.w,
              d: LAYOUT.barn.d,
              doorX: LAYOUT.barn.doorX,
              visualScale: LAYOUT.barn.visualScale,
              doorWorldHeight: LAYOUT.barn.doorWorldHeight,
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
        // 南側這輪接上美術村的新門檻(3,11)，之前留給「以後另一位居民」的
        // 路還沒動到——這一格只佔最後一排的 x=3，其餘南側空地依然沒畫、
        // 不佔座標。
        oldVillage: {
          tiles: makeOldVillageTiles(),
          placeholders: LAYOUT.oldVillage.houses,
          playerStart: { x: LAYOUT.oldVillage.livingGate.x + 1, z: 2 },
        },
        mountain: {
          tiles: makeMountainMapTiles(),
          playerStart: { ...LAYOUT.mountain.townArrival },
        },
        // 港口——左側石板廣場接舊城鎮；中央是三面石造碼頭包圍的內港與渡輪；
        // 北側商店背後的沙灘延續生活區；右側木棧橋停小艇。保留原本西界換圖、
        // 木匠事件(7,3)與美術村入口(3,15)。
        port: {
          tiles: makePortTiles(),
          playerStart: { ...LAYOUT.port.playerArrival },
        },
        // 美術村——這輪只求骨架能走通，不做藝術裝置的細節，內容先放幾個空屋
        // 佔位方塊。北側兩個門檻分別接舊城鎮跟港口各自的南側新門檻，呼應
        // 關係圖裡「美術區橫跨舊城鎮跟港口下方，雙向都能進入」的設計——
        // 兩個城鎮地圖各自獨立，這裡不是真的接在同一塊地上，只是敘事上/
        // 玩法上「往南都會走到這個共用的美術村」。
        artVillage: {
          tiles: [
            [0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          ],
          placeholders: [
            { x: 2, z: 2, seed: 0.2 },
            { x: 9, z: 2, seed: 0.65 },
            { x: 5, z: 5, seed: 0.45 },
          ],
          playerStart: { x: 6, z: 4 },
        },
        // 女神祠堂——生活區私人海岸沿著北側沙灘往北走到底的小平台，這輪
        // 只求「走得到、有地方站」，退潮限定的判定邏輯之後再接；先放一塊
        // 平台(沿用其他非 livingArea 地圖同一套平面地板)+一座鳥居佔位。
        shrine: {
          tiles: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 3, 0, 0, 0],
          ],
          playerStart: { x: 4, z: 4 },
        },
      };

      // 舊城鎮擴高：從 12 排(z=0~11)往南加 3 排到 15 排(z=0~14)，讓它可以
      // 跟港口(16 排，z=0~15)的西側整條邊界對齊、逐排走過去——不是單一
      // 傳送點，是連續多格都能互通。新加的三排目前只是空地，之後有內容
      // 再回頭補；用 push(往陣列尾端加)不是 unshift，既有的 z 座標(北側
      // 門檻、木匠空屋、美術村門檻)完全不用動。
      // 舊城鎮東側(x=13)跟港口西側(x=0)整條邊界都標成門檻(3)，冒出黃色
      // 標記；只對到 z=0~14(舊城鎮的範圍)，港口多出來的最後一排(z=15)
      // 沒有對應的舊城鎮列，不畫。
      for (let z = 0; z < LAYOUT.oldVillage.portGate.portHeight; z++) {
        MAPS.port.tiles[LAYOUT.oldVillage.portGate.portZ + z][
          LAYOUT.oldVillage.portGate.portX
        ] = 3;
      }

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

      // 西北山區入口目前只開放到前段階梯；最後一格是岩壁，保留未來切換山區地圖。
      export const MOUNTAIN_GATE_BLOCKER = {
        x: LAYOUT.mountainGateway.startX - (LAYOUT.mountainGateway.steps - 1),
        z: LAYOUT.mountainGateway.startZ - (LAYOUT.mountainGateway.steps - 1),
      };
      if (
        MOUNTAIN_GATE_BLOCKER.z >= 0 &&
        MOUNTAIN_GATE_BLOCKER.z < MAPS.livingArea.tiles.length
      ) {
        MAPS.livingArea.tiles[MOUNTAIN_GATE_BLOCKER.z][
          MOUNTAIN_GATE_BLOCKER.x
        ] = 3;
      }

      // 女神祠堂步道：原本的沙灘只到 x=46 左右就變成海(9)；在最北側三排
      // (z=0~2)把接下來 15 格海硬改成沙灘(8)，鑿出一條往東延伸的步道，
      // 通往這輪新設的祠堂入口。退潮限定的判斷邏輯還沒接，這條路現在是
      // 「一直都能走」，之後要接退潮機制時再讓這塊沙灘依情況顯示/隱藏。
      // 只覆寫這 3×15 格，不動其餘沙灘/海的既有生成邏輯；上面 coast.oceanCols
      // 已經加大過，這排改完後面仍留得下至少一格真的海，海岸線偵測才不會
      // 找不到海而跑掉。
      // 西端多含一格抬高入口；終點仍固定在 x=62，不改祠堂傳送位置。
      export const SHRINE_PATH_START_X = 46;
      export const SHRINE_PATH_LENGTH = 17;
      // 步道刻意墊高、浮出海面(不是跟一般沙灘一樣貼著水面)，視覺上像一條
      // 從海裡浮出來的沙洲步道；makeShrinePathCauseway()(build-map.ts)跟
      // groundY()(scene-sky.ts)都要讀同一個數字，保持高度跟碰撞地板對齊。
      export const SHRINE_PATH_ELEVATION = 0.5;
      for (let z = 0; z <= 2; z++) {
        for (let i = 0; i < SHRINE_PATH_LENGTH; i++) {
          MAPS.livingArea.tiles[z][SHRINE_PATH_START_X + i] = 8;
        }
      }
      // 步道西端的幾何從半格邊界開始，入口南側也補一格沙灘，避免沙灘與
      // 堤道之間殘留單格海水裂縫。
      MAPS.livingArea.tiles[2][SHRINE_PATH_START_X - 1] = 8;

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

      // 港口連通點已經改到南側(37~46,42)整排，這裡不再是門檻，改回原本的
      // 沙灘(8)，清掉殘留的黃色門檻視覺標記。
      MAPS.livingArea.tiles[20][40] = 8;

      // 舊城鎮連通點(x=20~22, z=42)——生活區最南端。
      [20, 21, 22].forEach((x) => {
        MAPS.livingArea.tiles[42][x] = 5;
      });
      // 清掉上一版誤往左鋪到 x=13~15 的南向支路；z=37 是既有橫路，保留。
      for (let z = 38; z <= 42; z++) {
        for (let x = 13; x <= 15; x++) MAPS.livingArea.tiles[z][x] = 0;
      }
      for (let z = 37; z < LAYOUT.oldVillage.livingAreaGate.z; z++) {
        for (let i = 0; i < LAYOUT.oldVillage.livingAreaGate.width; i++) {
          MAPS.livingArea.tiles[z][LAYOUT.oldVillage.livingAreaGate.x + i] = 5;
        }
      }
      for (let i = 0; i < LAYOUT.oldVillage.livingAreaGate.width; i++) {
        MAPS.livingArea.tiles[LAYOUT.oldVillage.livingAreaGate.z][
          LAYOUT.oldVillage.livingAreaGate.x + i
        ] = 3;
      }

      // 主角家放大後，原本位於正門左前方的舊樹會擋住門面與進出視線。
      // 座標從房屋資料推導，清除 tile 同時移除視覺與碰撞。
      export const HOUSE_FRONT_TREE = {
        x: LAYOUT.house.doorX - 2,
        z: LAYOUT.house.z + LAYOUT.house.d + 1,
      };
      MAPS.livingArea.tiles[HOUSE_FRONT_TREE.z][HOUSE_FRONT_TREE.x] = 0;
      // 港口連通點(x=37~46, z=42) 的門檻標記本身放在檔案後段，跟「南側
      // 延伸地形補沙灘/海資料」那段一起處理——要先把 z=37~42 補上真的
      // 沙灘/海，門檻才不會蓋在假資料上面。

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
      export const CARPENTER_HOUSE = { ...LAYOUT.oldVillage.carpenterHouse };
      export const CARPENTER_DOORSTEP = {
        x: LAYOUT.oldVillage.carpenterHouse.doorX,
        z: LAYOUT.oldVillage.carpenterHouse.z + LAYOUT.oldVillage.carpenterHouse.d,
      };
      export const CARPENTER_EVENT_WAIT_POS = {
        x: CARPENTER_DOORSTEP.x,
        z: CARPENTER_DOORSTEP.z + 1,
      };
      export const CARPENTER_MATERIALS = { wood: 10, stone: 5 };
      export const CARPENTER_CONSTRUCTION_DAYS = 2;
      export const carpenterQuest = {
        stage: "not_started",
        constructionStartDay: -1,
      };

      // events（地圖觸碰/互動事件表）需要 loadMap/handleCarpenterDockTouch/
      // handleCarpenterDoorstepTouch，這些函式所在的模組會遞移載入
      // scene-sky.ts（THREE.WebGLRenderer／document.getElementById 等 DOM/WebGL
      // 副作用），若放在這個檔案會讓 map-debug.ts 之類的純 Node 腳本無法單獨
      // import LAYOUT/MAPS。因此改放進 build-map.ts，見該檔案尾端。

      // ==============================================================
      // 廚師抵達——第二個角色，複製木匠那套「stage 字串 + 觸碰事件推進 +
      // showDialogSequence(onComplete)」框架，這次刻意不抽成共用系統
      // （只有兩個樣本，抽象容易抽錯方向，等第三個角色出現再回頭歸納）。
      // stage 一路往前推：
      //   not_started → 港口觸碰事件觸發碼頭見面
      //   arrived     → 民宿觸碰事件觸發現場看屋 + 她說出招募條件，
      //                 sharedMealCount 歸零開始累計
      //   proving     → 沒有天數門檻，等玩家在休息區、白天到傍晚的時段內、
      //                 帶著收成、旁邊有其他 NPC 在場時觸發「共餐」，累積到門檻次數
      //                 為止；期間再去敲門只回一句簡短反應，不重播整段開場
      //                 白——這是跟木匠事件唯一刻意不同的地方，木匠材料不夠
      //                 時 stage 會退回 en_route_village，導致下次敲門重播
      //                 整段對話，共餐要等好幾天，重播整段太煩。
      //   renovating  → 條件達成，她說廚房自己整理，等 CHEF_RENOVATION_DAYS 天
      //   ready_for_move_in → 天數到了，晚上回民宿觸發入住場景
      //   moved_in    → 廚師正式出現在 livingArea，恢復排程走動
      // CHEF_HOUSE/CHEF_DOORSTEP 故意還沒定義：她的家/行程座標要等這套流程
      // 定案、真的需要擺放時才決定，這裡先只放跟座標無關的 quest 狀態。
      // ==============================================================
      export const CHEF_MEAL_THRESHOLD = 3; // 累積這麼多次「共餐」才算證明給她看
      export const CHEF_MEAL_WINDOW_START = 6; // 只有這段時間內觸發的共餐才算數，
      export const CHEF_MEAL_WINDOW_END = 20; // 不限定哪一餐，整個白天到傍晚都算
      export const CHEF_RENOVATION_DAYS = 2; // 比木匠的 2 天蓋房子稍短：她只是整理廚房
      export const chefQuest = {
        stage: "not_started",
        renovatingStartDay: -1,
        sharedMealCount: 0,
        lastMealDay: -1, // 同一天只能算一次共餐，避免站著狂按 E 洗數字
      };

      // 生活區南側延伸地形(z=37~42)原本是純視覺、全部草地(0)：z=36 是真實
      // 地形資料(牆/沙灘/海)的最後一排，過了那排海面網格找不到真的海，會
      // 退化成固定座標往南延伸蓋住這片草地——玩家看到的是「海」，踩起來
      // 卻是草地(0，不擋路)，反過來也一樣：南側其餘看起來像草地的地方
      // 其實該是海，卻沒有真的擋路資料。這裡用跟 z<=36 同一組公式(coastShoreJitter
      // + BEACH_SAND_COLS/BEACH_BAND_WIDTH)把 z=37~42 也補上真的沙灘(8)/
      // 海(9)，讓這六排的視覺跟碰撞終於一致；放在檔案最後、所有列都已經
      // push 完成之後執行，才不會撞到「該列還不存在」的錯誤（跟上面女神
      // 祠堂步道那段踩過的坑一樣）。
      for (let z = 37; z <= 42; z++) {
        const row = MAPS.livingArea.tiles[z];
        const sandCols = Math.min(
          BEACH_BAND_WIDTH - 3,
          Math.max(3, BEACH_SAND_COLS + coastShoreJitter(z)),
        );
        const oceanCols = BEACH_BAND_WIDTH - sandCols;
        for (let i = 0; i < sandCols; i++) row[37 + i] = 8;
        for (let i = 0; i < oceanCols; i++) row[37 + sandCols + i] = 9;
      }
      // 港口連通點(37~46,42)蓋在剛補上的沙灘資料上面，門檻(3)覆寫掉那幾格
      // 的沙灘值，其餘沙灘/海維持剛算出來的樣子。
      for (
        let x = LAYOUT.port.livingAreaGate.x;
        x < LAYOUT.port.livingAreaGate.x + LAYOUT.port.livingAreaGate.width;
        x++
      ) {
        MAPS.livingArea.tiles[LAYOUT.port.livingAreaGate.z][x] = 3;
      }

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
