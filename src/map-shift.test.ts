import test from "node:test";
import assert from "node:assert/strict";
import { expandTileGrid, shiftCoordinates, shiftCoordinatesDeep } from "./map-shift";

function makeGrid(rows: number, cols: number, fillValue = 0): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(fillValue));
}

test("往北擴張：新增列在陣列前端，原本的內容整個往後推", () => {
  const tiles = [[1, 2], [3, 4]];
  const moved = expandTileGrid(tiles, "north", 2, 0);
  assert.equal(moved, 2);
  assert.deepEqual(tiles, [
    [0, 0],
    [0, 0],
    [1, 2],
    [3, 4],
  ]);
});

test("往南擴張：新增列在陣列尾端，原本內容座標不變", () => {
  const tiles = [[1, 2], [3, 4]];
  expandTileGrid(tiles, "south", 1, 9);
  assert.deepEqual(tiles, [
    [1, 2],
    [3, 4],
    [9, 9],
  ]);
});

test("往西擴張：每一列前面補新格子", () => {
  const tiles = [[1, 2], [3, 4]];
  expandTileGrid(tiles, "west", 1, 0);
  assert.deepEqual(tiles, [
    [0, 1, 2],
    [0, 3, 4],
  ]);
});

test("往東擴張：每一列後面補新格子", () => {
  const tiles = [[1, 2], [3, 4]];
  expandTileGrid(tiles, "east", 1, 0);
  assert.deepEqual(tiles, [
    [1, 2, 0],
    [3, 4, 0],
  ]);
});

test("跟 layout-maps.ts 實際做過的操作對照：NORTH_EXPANSION=5 往北 + X_OFFSET=15 往西，兩次呼叫可疊加", () => {
  const tiles = makeGrid(3, 4, 7); // 模擬「原始手刻地圖」
  const northMoved = expandTileGrid(tiles, "north", 5, 0);
  const westMoved = expandTileGrid(tiles, "west", 15, 0);
  assert.equal(northMoved, 5);
  assert.equal(westMoved, 15);
  assert.equal(tiles.length, 3 + 5);
  assert.equal(tiles[0].length, 4 + 15);
  // 原本手刻的內容（值=7）現在應該落在 [5..7][15..18]
  for (let z = 5; z < 8; z++) {
    for (let x = 15; x < 19; x++) {
      assert.equal(tiles[z][x], 7, `(${x},${z}) 應該還是原始內容 7`);
    }
  }
});

test("收縮（負數 amount）會被夾住，不會縮到負的列數", () => {
  const tiles = makeGrid(2, 2);
  const moved = expandTileGrid(tiles, "north", -10);
  assert.equal(moved, -2, "最多只能縮掉現有的 2 列");
  assert.equal(tiles.length, 0);
});

test("shiftCoordinates：批次位移一組物件的 x/z，往北擴張要搭配 dz", () => {
  const objs = [
    { x: 10, z: 20, label: "a" },
    { x1: 1, z1: 2, x2: 3, z2: 4 },
    { fromX: 5, fromZ: 6, toX: 7, toZ: 8, steps: 3 },
  ];
  shiftCoordinates(objs, 15, 5); // 對應 X_OFFSET=15、NORTH_EXPANSION=5
  assert.deepEqual(objs[0], { x: 25, z: 25, label: "a" });
  assert.deepEqual(objs[1], { x1: 16, z1: 7, x2: 18, z2: 9 });
  assert.deepEqual(objs[2], { fromX: 20, fromZ: 11, toX: 22, toZ: 13, steps: 3 });
});

test("shiftCoordinates：不認得的鍵完全不動，可以放心混著丟", () => {
  const objs = [{ width: 3, elevation: 2, seed: 0.5 }];
  shiftCoordinates(objs, 100, 100);
  assert.deepEqual(objs[0], { width: 3, elevation: 2, seed: 0.5 });
});

test("shiftCoordinatesDeep：巢狀物件跟陣列裡的座標都會被找到並位移——對照 LAYOUT.oldVillage.houses 這種形狀", () => {
  const region = {
    livingGate: { x: 33, z: 0, width: 3 },
    houses: [
      { x: 5, z: 4, role: "school" },
      { x: 11, z: 4, role: "hospital" },
    ],
    plazaStairs: [{ z: 7, fromX: 25, toX: 28, steps: 6 }],
  };
  shiftCoordinatesDeep(region, 10, 3);
  assert.equal(region.livingGate.x, 43);
  assert.equal(region.livingGate.z, 3);
  assert.equal(region.houses[0].x, 15);
  assert.equal(region.houses[1].x, 21);
  assert.equal(region.plazaStairs[0].fromX, 35);
  assert.equal(region.plazaStairs[0].toX, 38);
  assert.equal(region.plazaStairs[0].z, 10);
});

test("shiftCoordinatesDeep：只傳單一地圖的 LAYOUT 子物件，不會動到其他地圖", () => {
  const layout = {
    house: { x: 20, z: 9 },
    oldVillage: { livingGate: { x: 33, z: 0 } },
  };
  shiftCoordinatesDeep(layout.oldVillage, 10, 0);
  assert.equal(layout.oldVillage.livingGate.x, 43);
  assert.equal(layout.house.x, 20, "house 不該被 oldVillage 的搬移影響");
});
