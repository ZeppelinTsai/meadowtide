import test from "node:test";
import assert from "node:assert/strict";
import {
  repaintRegion,
  rectCells,
  resetRegionPaintRegistry,
} from "./region-paint";

function makeGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

test("repaintRegion 畫上新格子", () => {
  resetRegionPaintRegistry();
  const tiles = makeGrid(5, 5);
  repaintRegion(tiles, "farm-paths", rectCells(1, 1, 2, 2), 5);
  assert.equal(tiles[1][1], 5);
  assert.equal(tiles[1][2], 5);
  assert.equal(tiles[2][1], 5);
  assert.equal(tiles[2][2], 5);
  assert.equal(tiles[0][0], 0);
});

test("重新呼叫同一個 regionId 到新位置時，舊格子會被清掉——這是農田原本缺的那一步", () => {
  resetRegionPaintRegistry();
  const tiles = makeGrid(6, 6);
  repaintRegion(tiles, "farm-paths", rectCells(0, 0, 2, 2), 5);
  assert.equal(tiles[0][0], 5);
  assert.equal(tiles[1][1], 5);

  // 農田搬家：LAYOUT.farm.x/z 改了，新位置在右下角
  repaintRegion(tiles, "farm-paths", rectCells(4, 4, 2, 2), 5);
  assert.equal(tiles[4][4], 5);
  assert.equal(tiles[5][5], 5);
  // 舊位置必須清乾淨，不能留下死路
  assert.equal(tiles[0][0], 0, "舊位置(0,0)沒有被清掉，會變成死資料");
  assert.equal(tiles[1][1], 0, "舊位置(1,1)沒有被清掉，會變成死資料");
});

test("不同 regionId 互不干擾——farm-paths 搬家不會清掉 roads 畫的同數值格子", () => {
  resetRegionPaintRegistry();
  const tiles = makeGrid(6, 6);
  // 模擬「farm 走道」與「一般道路」共用 tile 值 5 的真實情境
  repaintRegion(tiles, "roads", [[3, 0], [3, 1], [3, 2]], 5);
  repaintRegion(tiles, "farm-paths", rectCells(0, 0, 2, 2), 5);

  // farm 搬家
  repaintRegion(tiles, "farm-paths", rectCells(4, 4, 2, 2), 5);

  // 路不該被動到（cells 是 [x, z]，tiles 索引順序是 tiles[z][x]）
  assert.equal(tiles[0][3], 5, "roads 不該被 farm-paths 的搬家影響");
  assert.equal(tiles[1][3], 5);
  assert.equal(tiles[2][3], 5);
  // farm 舊格子清掉、新格子畫上
  assert.equal(tiles[0][0], 0);
  assert.equal(tiles[4][4], 5);
});

test("清除舊格子時使用自訂 clearTileValue（例如清成海洋而不是草地）", () => {
  resetRegionPaintRegistry();
  const tiles = makeGrid(4, 4);
  repaintRegion(tiles, "lake", rectCells(0, 0, 2, 2), 6);
  repaintRegion(tiles, "lake", rectCells(2, 2, 2, 2), 6, /* clearTileValue */ 9);
  assert.equal(tiles[0][0], 9, "舊湖水位置應該被清成呼叫端指定的值");
  assert.equal(tiles[2][2], 6);
});

test("超出邊界的座標會被安全跳過，不會丟例外", () => {
  resetRegionPaintRegistry();
  const tiles = makeGrid(3, 3);
  assert.doesNotThrow(() => {
    repaintRegion(tiles, "edge-case", [[-1, -1], [1, 1], [10, 10]], 7);
  });
  assert.equal(tiles[1][1], 7);
});

test("resetRegionPaintRegistry 清空所有登記，之後同一個 regionId 不會誤清", () => {
  const tiles = makeGrid(4, 4);
  repaintRegion(tiles, "farm-paths", rectCells(0, 0, 2, 2), 5);
  resetRegionPaintRegistry();
  const freshTiles = makeGrid(4, 4);
  repaintRegion(freshTiles, "farm-paths", rectCells(2, 2, 1, 1), 5);
  // 新地圖從頭建置，不該因為登記表殘留舊地圖(tiles)的座標而清到不相干的
  // 陣列（這裡用 freshTiles 驗證：舊地圖的 tiles 完全沒被動到）
  assert.equal(tiles[0][0], 5, "reset 前畫在舊 tiles 上的東西不該被 reset 影響");
  assert.equal(freshTiles[2][2], 5);
});
