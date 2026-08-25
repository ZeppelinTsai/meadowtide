import assert from "node:assert/strict";
import test from "node:test";
import { LAYOUT, MAPS, oldVillageSouthwestSeaEndX } from "./layout-maps";
import { createTransitionEvents } from "./map-transitions";

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
  assert.equal(LAYOUT.oldVillage.portGate.x, 76);
  assert.equal(LAYOUT.port.oldVillageGate.x, 0);
  assert.equal(LAYOUT.oldVillage.portGate.height, LAYOUT.port.oldVillageGate.height);
  for (let z = 30; z <= 47; z++) {
    assert.equal(MAPS.oldVillage.tiles[z][76], 3, `oldVillage (76,${z})`);
    assert.equal(MAPS.port.tiles[z][0], 3, `port (0,${z})`);
    assert.equal(MAPS.oldVillage.tiles[z][75], 8, `oldVillage 抵達格 (75,${z})`);
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
