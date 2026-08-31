import test from "node:test";
import assert from "node:assert/strict";
import { getShorewardSeaWaveDirection } from "./sea-wave-direction";
import { createConnectedTileSeaGeometry } from "./tile-sea-geometry";

const surroundedIsland = [
  [9, 9, 9, 9, 9],
  [9, 9, 0, 9, 9],
  [9, 0, 0, 0, 9],
  [9, 9, 0, 9, 9],
  [9, 9, 9, 9, 9],
];

test("waves on each side move toward the island shore", () => {
  assert.deepEqual(getShorewardSeaWaveDirection(surroundedIsland, 2, 0, { x: -1, z: 0 }), { x: 0, z: 1 });
  assert.deepEqual(getShorewardSeaWaveDirection(surroundedIsland, 2, 4, { x: -1, z: 0 }), { x: 0, z: -1 });
  assert.deepEqual(getShorewardSeaWaveDirection(surroundedIsland, 0, 2, { x: -1, z: 0 }), { x: 1, z: 0 });
  assert.deepEqual(getShorewardSeaWaveDirection(surroundedIsland, 4, 2, { x: -1, z: 0 }), { x: -1, z: 0 });
});

test("corner waves blend two nearby shore directions", () => {
  const direction = getShorewardSeaWaveDirection(surroundedIsland, 1, 1, { x: -1, z: 0 });
  assert.ok(direction.x > 0);
  assert.ok(direction.z > 0);
  assert.ok(Math.abs(Math.hypot(direction.x, direction.z) - 1) < 0.0001);
});

test("direction remains continuous across tile boundaries", () => {
  const before = getShorewardSeaWaveDirection(surroundedIsland, 0.49, 0, {
    x: -1,
    z: 0,
  });
  const after = getShorewardSeaWaveDirection(surroundedIsland, 0.51, 0, {
    x: -1,
    z: 0,
  });
  const dot = before.x * after.x + before.z * after.z;
  assert.ok(dot > 0.99, `direction jumped across boundary: ${dot}`);
});

test("open water without cardinal land uses the provided fallback", () => {
  assert.deepEqual(getShorewardSeaWaveDirection([[9]], 0, 0, { x: 0, z: -1 }), { x: 0, z: -1 });
});

test("adjacent sea tiles share boundary vertices", () => {
  const geometry = createConnectedTileSeaGeometry(
    [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
    ],
  );
  const subdivisions = 1;
  assert.equal(
    geometry.attributes.position.count,
    (subdivisions * 2 + 1) * (subdivisions + 1),
  );
  assert.equal(geometry.index?.count, 2 * subdivisions * subdivisions * 6);
  const positions = geometry.attributes.position;
  let sharedEdgeVertices = 0;
  for (let i = 0; i < positions.count; i++) {
    if (Math.abs(positions.getX(i) - 0.5) < 1e-6) sharedEdgeVertices++;
  }
  assert.equal(sharedEdgeVertices, subdivisions + 1);
});
