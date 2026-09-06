#!/usr/bin/env node
import {
  LAYOUT,
  MAPS,
  MOUNTAIN_BASE_WIDTH,
  MOUNTAIN_WEST_EXPANSION,
} from "../src/layout-maps";

const mountain = LAYOUT.mountain;
const map = MAPS.mountain;
const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) errors.push(message);
}

assert(
  map.tiles[0]?.length === MOUNTAIN_BASE_WIDTH + MOUNTAIN_WEST_EXPANSION,
  `山區寬度應為 ${MOUNTAIN_BASE_WIDTH + MOUNTAIN_WEST_EXPANSION}，實際為 ${map.tiles[0]?.length}`,
);
assert(map.tiles.length === mountain.height, "山區高度與 LAYOUT 不一致");
assert(mountain.skyPalaceGate.trigger.x === 21, "山頂鳥居傳送點未移到新位置");
assert(mountain.skyPalaceGate.arrival.x === 21, "山頂傳送抵達點未移到新位置");
assert(mountain.summitShrine.x === 17.5, "山神/小神壇未移到新位置");
assert(mountain.summitBenchOffsetX === 5, "山頂椅子未右移 10 格");

for (const zone of ["foot", "waist", "summit"] as const) {
  const platform = mountain[zone];
  assert(platform.x >= 0, `${zone} 平台西界越過地圖左界：${platform.x}`);
  assert(
    platform.x + platform.width <= map.tiles[0].length,
    `${zone} 平台東界越過地圖右界：${platform.x + platform.width - 1}`,
  );
  const walkableCells = [];
  for (let z = platform.z; z < platform.z + platform.depth; z++) {
    for (let x = platform.x; x < platform.x + platform.width; x++) {
      if (map.tiles[z]?.[x] === 0 || map.tiles[z]?.[x] === 5)
        walkableCells.push({ x, z });
    }
  }
  assert(walkableCells.length > 0, `${zone} 平台沒有可走格`);
  console.log(
    `${zone}: x=${platform.x}..${platform.x + platform.width - 1}, ` +
      `z=${platform.z}..${platform.z + platform.depth - 1}, ` +
      `walkable=${walkableCells.length}`,
  );
}

for (const [x, z] of mountain.trees) {
  const onPlatform = (["foot", "waist", "summit"] as const).some((zone) => {
    const platform = mountain[zone];
    return (
      x >= platform.x &&
      x < platform.x + platform.width &&
      z >= platform.z &&
      z < platform.z + platform.depth
    );
  });
  assert(onPlatform, `樹木 (${x},${z}) 不在三層平台範圍內`);
}

const treeClearanceRects = [
  {
    x: mountain.cave.entranceX - 2,
    z: mountain.cave.entranceStartZ - 2,
    width: mountain.cave.entranceWidth + 4,
    depth: mountain.cave.z + mountain.cave.depth - mountain.cave.entranceStartZ + 2,
  },
  { x: 24, z: 51, width: 3, depth: 3 },
  { x: 24, z: 49, width: 8, depth: 4 },
  { x: 14, z: 12, width: 5, depth: 4 },
  { x: 31, z: 12, width: 5, depth: 4 },
  ...[mountain.lowerStair, mountain.upperStair].map((stair) => ({
    x: stair.x - 2,
    z: stair.fromZ - 2,
    width: stair.width + 4,
    depth: stair.toZ - stair.fromZ + 5,
  })),
];
for (const clearance of treeClearanceRects) {
  for (let z = clearance.z; z < clearance.z + clearance.depth; z++) {
    for (let x = clearance.x; x < clearance.x + clearance.width; x++) {
      assert(
        map.tiles[z]?.[x] !== 2,
        `樹木淨空區仍有樹：(${x},${z})`,
      );
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `mountain expansion ok: west +${MOUNTAIN_WEST_EXPANSION}, ` +
    `map=${map.tiles[0].length}x${map.tiles.length}, trees=${mountain.trees.length}`,
);
