import assert from "node:assert/strict";
import test from "node:test";
import { LAYOUT, MAPS } from "./layout-maps";
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
    [MAPS.oldVillage.tiles, LAYOUT.oldVillage.southBeachArrival, LAYOUT.oldVillage.southBeachGate, "舊城鎮南灘"],
    [MAPS.port.tiles, LAYOUT.port.southBeachArrival, LAYOUT.port.southBeachGate, "港口南灘"],
  ] as const;
  for (const [tiles, arrival, gate, label] of routes)
    assert.equal(hasWalkableRoute(tiles, arrival, gate), true, `${label} 的中間地磚必須連通`);
});
