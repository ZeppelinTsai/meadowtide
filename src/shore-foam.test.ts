import assert from "node:assert/strict";
import test from "node:test";
import { LAYOUT, MAPS } from "./layout-maps";
import {
  findSouthernShoreSandZ,
  findWesternShoreSandX,
} from "./shore-foam";

test("港口南岸浪花讀取最終沙／海 tile 邊界", () => {
  const beach = LAYOUT.port.southBeach;
  for (let x = beach.x + 1; x < beach.x + beach.width; x++) {
    const z = findSouthernShoreSandZ(
      MAPS.port.tiles,
      x,
      beach.z,
      beach.z + beach.depth - 1,
    );
    assert.notEqual(z, null, `港口南岸 x=${x} 應有沙海邊界`);
    assert.equal(MAPS.port.tiles[z!][x], 8);
    assert.equal(MAPS.port.tiles[z! + 1][x], 9);
  }
});

test("舊城鎮浪花端點跟著擴張後的最終 tile", () => {
  const village = LAYOUT.oldVillage;
  const southStartX = findWesternShoreSandX(
    MAPS.oldVillage.tiles,
    village.westBeach.z + 1,
    village.westBeach.x,
    village.westBeach.x + village.westBeach.width - 1,
  );
  assert.equal(southStartX, 116);
  assert.equal(
    findSouthernShoreSandZ(
      MAPS.oldVillage.tiles,
      village.southBeach.x + village.southBeach.width - 2,
      village.southBeach.z,
      village.southBeach.z + village.southBeach.depth - 1,
    ),
    47,
  );
});
