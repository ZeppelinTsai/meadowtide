import assert from "node:assert/strict";
import test from "node:test";
import { LAYOUT, MAPS, OLD_VILLAGE_OCEAN_EXPANSION, PORT_OCEAN_EXPANSION, oldVillageSouthwestSeaEndX } from "./layout-maps";
import { createTransitionEvents } from "./map-transitions";

import { OLD_VILLAGE_RAILS } from './layout-maps';

function hasWalkableRoute(
  tiles: number[][],
  start: { x: number; z: number },
  goal: { x: number; z: number },
) {
  const queue = [start];
  const seen = new Set([`${start.x},${start.z}`]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.x === goal.x && current.z === goal.z) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx;
      const z = current.z + dz;
      const tile = tiles[z]?.[x];
      if (tile === undefined || [1, 2, 6, 9].includes(tile)) continue;
      const key = `${x},${z}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ x, z });
      }
    }
  }
  return false;
}

test("端點物件平移後，既有 event getter 與目的地會讀到新座標", () => {
  const a = { gate: { x: 2, z: 3 }, arrival: { x: 2, z: 4 } };
  const b = { gate: { x: 8, z: 9 }, arrival: { x: 7, z: 9 } };
  const calls: Array<{ map: string; x: number; z: number }> = [];
  const events = createTransitionEvents(
    [{
      id: "a-b",
      a: { map: "a", triggerAt: () => a.gate, arrivalAt: () => a.arrival },
      b: { map: "b", triggerAt: () => b.gate, arrivalAt: () => b.arrival },
    }],
    (map, point) => calls.push({ map, ...point }),
  );

  a.gate.x += 5;
  b.arrival.z += 4;
  assert.equal(events[0].x, 7);
  events[0].action();
  assert.deepEqual(calls[0], { map: "b", x: 7, z: 13 });
});

test("多格邊界逐格配對，且可排除與其他連線重疊的格", () => {
  const events = createTransitionEvents(
    [{
      id: "edge",
      a: {
        map: "a",
        count: 3,
        triggerAt: (i) => ({ x: i, z: 0 }),
        arrivalAt: (i) => ({ x: i, z: 1 }),
      },
      b: {
        map: "b",
        count: 3,
        triggerAt: (i) => ({ x: 0, z: i }),
        arrivalAt: (i) => ({ x: 1, z: i }),
        skipIndex: (i) => i === 1,
      },
    }],
    () => undefined,
  );
  assert.equal(events.length, 5);
  assert.deepEqual(events.filter((event) => event.map === "b").map((event) => event.z), [0, 2]);
});

test("正式地圖的傳送抵達點到門檻之間都有連續可走地磚", () => {
  const routes = [
    [MAPS.mountain.tiles, LAYOUT.mountain.townArrival, LAYOUT.mountain.townGate, "山區→舊城鎮"],
    [MAPS.oldVillage.tiles, LAYOUT.oldVillage.mountainArrival, LAYOUT.oldVillage.mountainGate, "舊城鎮→山區"],
  ] as const;
  for (const [tiles, arrival, gate, label] of routes)
    assert.equal(hasWalkableRoute(tiles, arrival, gate), true, `${label} 的中間地磚必須連通`);
});

test("舊城鎮與港口 z=30~47 邊界都是雙向傳送用黃色門檻", () => {
  assert.equal(LAYOUT.oldVillage.portGate.x, MAPS.oldVillage.tiles[0].length - 1);
  assert.equal(LAYOUT.port.oldVillageGate.x, 0);
  assert.equal(LAYOUT.oldVillage.portGate.height, LAYOUT.port.oldVillageGate.height);
  for (let z = 30; z <= 47; z++) {
    assert.equal(MAPS.oldVillage.tiles[z][LAYOUT.oldVillage.portGate.x], 3, `oldVillage (${LAYOUT.oldVillage.portGate.x},${z})`);
    assert.equal(MAPS.port.tiles[z][0], 3, `port (0,${z})`);
    assert.equal(MAPS.oldVillage.tiles[z][LAYOUT.oldVillage.portGate.x - 1], 8, `oldVillage 抵達格 (${LAYOUT.oldVillage.portGate.x - 1},${z})`);
    assert.equal(MAPS.port.tiles[z][1], 8, `port 抵達格 (1,${z})`);
  }
});

test("舊城鎮西南刪除區核心是海，外緣保持不規則", () => {
  for (let z = 38; z < MAPS.oldVillage.tiles.length; z++) {
    for (let x = 11; x <= 16; x++)
      assert.equal(MAPS.oldVillage.tiles[z][x], 9, `上段核心 (${x},${z})`);
    if (z >= 45)
      for (let x = 17; x <= 29; x++)
        assert.equal(MAPS.oldVillage.tiles[z][x], 9, `下段核心 (${x},${z})`);
  }
  const edges = new Set(
    Array.from({ length: MAPS.oldVillage.tiles.length - 38 }, (_, i) =>
      oldVillageSouthwestSeaEndX(38 + i),
    ),
  );
  assert.ok(edges.size > 2, "海岸外緣不能是筆直方框");
});

test("舊城鎮鐘乳石洞窟山體有碰撞，中央入口保持可走", () => {
  const cave = LAYOUT.oldVillage.stalactiteCave;
  assert.equal(MAPS.oldVillage.tiles[cave.z][cave.x], 1);
  for (let z = cave.entranceStartZ; z < cave.z + cave.depth; z++)
    for (let x = cave.entranceX; x < cave.entranceX + cave.entranceWidth; x++)
      assert.equal(MAPS.oldVillage.tiles[z][x], 8, `洞口 (${x},${z})`);
});
test("舊城鎮西側與南側各擴充 100 格海面", () => {
  const tiles = MAPS.oldVillage.tiles;
  assert.equal(tiles[0].length, 77 + OLD_VILLAGE_OCEAN_EXPANSION.west);
  assert.equal(tiles.length, 64 + OLD_VILLAGE_OCEAN_EXPANSION.south);
  for (let z = 0; z < 64; z++)
    for (let x = 0; x < OLD_VILLAGE_OCEAN_EXPANSION.west; x++) {
      const beach = LAYOUT.oldVillage.northBeach;
      const edge = LAYOUT.oldVillage.northBeachSouthEdge;
      const fringe = LAYOUT.oldVillage.northBeachOuterFringe;
      const edgeIndex = x - edge.x;
      const isSouthEdgeSand =
        edgeIndex >= 0 &&
        edgeIndex < edge.endOffsets.length &&
        z >= edge.z - 1 &&
        z <= edge.z + edge.endOffsets[edgeIndex];
      const northIndex = x - beach.x;
      const isNorthFringeSand =
        northIndex >= 0 &&
        northIndex < fringe.northDepths.length &&
        z < beach.z &&
        z >= beach.z - fringe.northDepths[northIndex];
      const westIndex = z - beach.z;
      const isWestFringeSand =
        westIndex >= 0 &&
        westIndex < fringe.westDepths.length &&
        x < beach.x &&
        x >= beach.x - fringe.westDepths[westIndex];
      if (
        (x >= beach.x &&
          x < beach.x + beach.width &&
          z >= beach.z &&
          z < beach.z + beach.height) ||
        isSouthEdgeSand ||
        isNorthFringeSand ||
        isWestFringeSand
      )
        continue;
      assert.equal(tiles[z][x], 9, `西側新增海面 (${x},${z})`);
    }
  const northBeach = LAYOUT.oldVillage.northBeach;
  const eastSeaCutout = LAYOUT.oldVillage.northBeachEastSeaCutout;
  const isEastSeaCutout = (x: number, z: number) =>
    x >= eastSeaCutout.x &&
    x < eastSeaCutout.x + eastSeaCutout.width &&
    z >= eastSeaCutout.z &&
    z < eastSeaCutout.z + eastSeaCutout.height;
  const isNorthBeachSeaTrim = (x: number, z: number) =>
    LAYOUT.oldVillage.northBeachSeaTrims.some(
      (trim) => trim.x === x && z <= trim.maxZ,
    );
  for (let z = northBeach.z; z < LAYOUT.oldVillage.northBeachSouthEdge.z - 1; z++)
    for (let x = northBeach.x; x < northBeach.x + northBeach.width; x++)
      assert.equal(tiles[z][x], 8);
  assert.deepEqual(northBeach, { x: 95, z: 11, width: 11, height: 26 });
  const outerFringe = LAYOUT.oldVillage.northBeachOuterFringe;
  assert.equal(outerFringe.northDepths.length, 11);
  const sideFringeLength =
    LAYOUT.oldVillage.northBeachSouthEdge.z - northBeach.z;
  assert.equal(outerFringe.westDepths.length, sideFringeLength);
  assert.equal(outerFringe.eastDepths.length, sideFringeLength);
  outerFringe.northDepths.forEach((depth, index) => {
    assert.ok(depth >= 0 && depth <= 2);
    for (let offset = 1; offset <= depth; offset++)
      assert.equal(tiles[northBeach.z - offset][northBeach.x + index], 8);
  });
  for (const [side, depths] of [
    [-1, outerFringe.westDepths],
    [1, outerFringe.eastDepths],
  ] as const) {
    depths.forEach((depth, index) => {
      assert.ok(depth >= 0 && depth <= 2);
      for (let offset = 1; offset <= depth; offset++) {
        const x = side < 0
          ? northBeach.x - offset
          : northBeach.x + northBeach.width - 1 + offset;
        assert.equal(
          tiles[northBeach.z + index][x],
          isEastSeaCutout(x, northBeach.z + index) ||
            isNorthBeachSeaTrim(x, northBeach.z + index)
            ? 9
            : 8,
        );
      }
    });
  }
  const platform = LAYOUT.oldVillage.northBeachPlatform;
  assert.equal(platform.elevation, 3);
  assert.deepEqual(platform.segments, [
    { x: 97, z: 13, width: 7, depth: 8 },
    { x: 97, z: 21, width: 7, depth: 6 },
    { x: 104, z: 21, width: 1, depth: 2 },
    { x: 96, z: 27, width: 8, depth: 2 },
    { x: 97, z: 29, width: 7, depth: 3 },
  ]);
  assert.deepEqual(platform.torii, { x: 100, z: 28, scale: 1.4 });
  assert.deepEqual(platform.cube, {
    x: 98,
    z: 15,
    width: 5,
    depth: 6,
    height: 1.6,
  });
  const platformRails = OLD_VILLAGE_RAILS.filter(
    (rail) => rail.elevation === platform.elevation,
  );
  assert.ok(
    platformRails.some(
      (rail) =>
        rail.x1 === 96.5 && rail.z1 === 12.5 && rail.x2 === 103.5 && rail.z2 === 12.5,
    ),
  );
  assert.ok(
    platformRails.some(
      (rail) =>
        rail.x1 === 96.5 && rail.z1 === 31.5 && rail.x2 === 98.5 && rail.z2 === 31.5,
    ),
  );
  assert.ok(
    platformRails.some(
      (rail) =>
        rail.x1 === 101.5 && rail.z1 === 31.5 && rail.x2 === 103.5 && rail.z2 === 31.5,
    ),
  );
  const eastFill = LAYOUT.oldVillage.northBeachEastFill;
  assert.deepEqual(eastFill, { x: 105, z: 35, width: 11, height: 2 });
  const eastShelf = LAYOUT.oldVillage.northBeachEastShelf;
  assert.equal(eastShelf.x, 105);
  assert.equal(eastShelf.z, 34);
  assert.equal(eastShelf.northDepths.length, 13);
  eastShelf.northDepths.forEach((depth, index) => {
    const x = eastShelf.x + index;
    assert.ok(depth >= 1 && depth <= 3);
    for (let z = eastShelf.z - depth + 1; z <= eastShelf.z; z++)
      assert.equal(
        tiles[z][x],
        isEastSeaCutout(x, z) || isNorthBeachSeaTrim(x, z) ? 9 : 8,
        `北側沙灘不規則延伸 (${x},${z}) 應符合最終岸線`,
      );
  });
  assert.deepEqual(eastSeaCutout, { x: 107, z: 32, width: 6, height: 1 });
  for (let x = eastSeaCutout.x; x < eastSeaCutout.x + eastSeaCutout.width; x++)
    assert.equal(tiles[eastSeaCutout.z][x], 9, `東側切口 (${x},${eastSeaCutout.z}) 應為海`);
  assert.deepEqual(LAYOUT.oldVillage.northBeachSandCorrections, [
    { x: 101, z: 36 },
    { x: 100, z: 34 },
  ]);
  for (const cell of LAYOUT.oldVillage.northBeachSandCorrections)
    assert.equal(tiles[cell.z][cell.x], 8, `沙灘修正 (${cell.x},${cell.z}) 應為沙灘`);
  assert.deepEqual(LAYOUT.oldVillage.northBeachSeaTrims, [
    { x: 107, maxZ: 34 },
    { x: 93, maxZ: 33 },
  ]);
  for (const trim of LAYOUT.oldVillage.northBeachSeaTrims)
    for (let z = 0; z <= trim.maxZ; z++)
      assert.notEqual(tiles[z][trim.x], 8, `退岸線 (${trim.x},${z}) 不應殘留沙灘`);
  const southEdge = LAYOUT.oldVillage.northBeachSouthEdge;
  assert.equal(southEdge.x, 95);
  southEdge.endOffsets.forEach((offset, index) => {
    const x = southEdge.x + index;
    const endZ = southEdge.z + offset;
    for (let z = southEdge.z - 1; z <= southEdge.z + 1; z++) {
      const correctedToSand = LAYOUT.oldVillage.northBeachSandCorrections.some(
        (cell) => cell.x === x && cell.z === z,
      );
      assert.equal(tiles[z][x], correctedToSand || z <= endZ ? 8 : 9);
    }
  });
  const platformStair =
    LAYOUT.oldVillage.westStairs[LAYOUT.oldVillage.westStairs.length - 1];
  assert.deepEqual(platformStair, {
    x: 99,
    width: 3,
    fromZ: 31,
    toZ: 34,
    baseElevation: 0,
    elevation: 3,
    steps: 6,
  });
  for (let z = 64; z < tiles.length; z++)
    for (let x = 0; x < tiles[z].length; x++)
      assert.equal(tiles[z][x], 9, `南側新增海面 (${x},${z})`);
  assert.equal(LAYOUT.oldVillage.stalactiteCave.x, 120);
  assert.equal(LAYOUT.oldVillage.stalactiteCave.entranceX, 124);
  assert.equal(LAYOUT.oldVillage.houses[0].doorX, 136.5);
});
test("港口東側擴充 50 格外海且既有座標不移動", () => {
  const tiles = MAPS.port.tiles;
  assert.equal(tiles[0].length, 34 + PORT_OCEAN_EXPANSION.east);
  assert.equal(LAYOUT.port.width, tiles[0].length);
  assert.deepEqual(MAPS.port.playerStart, LAYOUT.port.playerArrival);
  for (let z = LAYOUT.port.eastOceanCutout.z; z < LAYOUT.port.eastOceanCutout.z + LAYOUT.port.eastOceanCutout.height; z++)
    for (let x = LAYOUT.port.eastOceanCutout.x; x < tiles[z].length; x++)
      assert.equal(tiles[z][x], 9, `port east cutout (${x},${z})`);
  for (const row of tiles)
    for (let x = row.length - PORT_OCEAN_EXPANSION.east; x < row.length; x++)
      assert.equal(row[x], 9, `port east ocean x=${x}`);
});
