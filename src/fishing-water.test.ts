import assert from "node:assert/strict";
import test from "node:test";
import { MAPS } from "./layout-maps";
import { isFishingWaterTile, isNearFishingWater } from "./fishing-water";

function firstTile(value: number) {
  const tiles = MAPS.livingArea.tiles;
  for (let z = 0; z < tiles.length; z++) {
    for (let x = 0; x < tiles[z].length; x++) {
      if (tiles[z][x] === value) return { x, z };
    }
  }
  throw new Error(`livingArea is missing tile ${value}`);
}

test("tile 6 lake and tile 9 sea are both fishable", () => {
  const lake = firstTile(6);
  const sea = firstTile(9);
  assert.equal(isFishingWaterTile("livingArea", lake.x, lake.z), true);
  assert.equal(isFishingWaterTile("livingArea", sea.x, sea.z), true);
});

test("walkable shore can detect nearby fishable water", () => {
  const tiles = MAPS.livingArea.tiles;
  for (let z = 0; z < tiles.length; z++) {
    for (let x = 0; x < tiles[z].length; x++) {
      if (tiles[z][x] === 0 && isNearFishingWater("livingArea", x, z)) return;
    }
  }
  assert.fail("livingArea has no walkable shore beside fishable water");
});

test("dry inland tiles are not treated as fishable water", () => {
  assert.equal(isFishingWaterTile("livingArea", 21, 21), false);
  assert.equal(isNearFishingWater("livingArea", 21, 21), false);
});
