import assert from "node:assert/strict";
import test from "node:test";
import { findReachablePath } from "./navigation";

test("不可走點會選目前連通區內最近的可達格", () => {
  const blocked = new Set(["3,2"]);
  const path = findReachablePath(
    { x: 0, z: 2 },
    { x: 3, z: 2 },
    5,
    5,
    (x, z) => blocked.has(`${x},${z}`),
  );
  assert.deepEqual(path?.[path.length - 1], { x: 2, z: 2 });
});

test("不會隔著完整牆選幾何上較近但不連通的格", () => {
  const path = findReachablePath(
    { x: 0, z: 1 },
    { x: 4, z: 1 },
    5,
    3,
    (x) => x === 2,
  );
  assert.deepEqual(path?.[path.length - 1], { x: 1, z: 1 });
});

test("互動半徑會停在目標旁的最短可達格", () => {
  const path = findReachablePath(
    { x: 0, z: 0 },
    { x: 3, z: 0 },
    5,
    3,
    () => false,
    1,
  );
  assert.deepEqual(path?.[path.length - 1], { x: 2, z: 0 });
});
