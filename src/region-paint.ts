// region-paint.ts
//
// 問題背景（來自 layout-maps.ts 的真實案例）：
// 湖搬家前有手動清除舊湖水的步驟：
//     MAPS.livingArea.tiles.forEach(row => row.forEach((tile, x) => {
//       if (tile === 6) row[x] = 0;
//     }));
// 這招之所以「湖」用得安全，是因為 tile===6 這個數值在整張地圖上只有湖會
// 用，「清掉所有 tile===6」不會誤刪別的東西。但農田的走道用的是 tile===5，
// 這個值同時也被道路、樓梯、行道樹間隙共用——一旦你把 LAYOUT.farm 搬到
// 新位置，不能再用「清掉所有 tile===5」這招（會把馬路一起清掉），所以
// 農田完全沒有對應的清除步驟，搬家後舊走道會變成殘留的死資料，跟湖以前
// 踩過的坑是同一種問題。
//
// 這個模組提供的是更通用、不依賴「tile 數值剛好獨一無二」這個運氣的做法：
// 用一個登記表記住「這個區域上次實際畫了哪些格子」，下次要重畫這個區域
// 時，先把登記表裡記下的舊格子清空，再畫新的、同時更新登記表。不管這個
// 區域用的 tile 數值有沒有跟別人共用，都不會誤刪或漏刪。

export type TileGrid = number[][];

const registry: Record<string, Set<string>> = {};

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

function inBounds(tiles: TileGrid, x: number, z: number): boolean {
  return z >= 0 && z < tiles.length && x >= 0 && x < (tiles[0]?.length ?? 0);
}

/**
 * 安全重繪一個具名區域：
 * 1. 先把這個 regionId 上次畫過的格子清回 clearTileValue（預設 0＝可走地面）
 * 2. 再把新的 cells 畫成 newTileValue
 * 3. 更新登記表，下次呼叫同一個 regionId 才知道要清哪裡
 *
 * regionId 命名建議跟 LAYOUT 裡的區域同名，例如 "farm-paths"、
 * "lake"、"avenue-trees"，同一個區域一律用同一個 regionId 呼叫，
 * 不同區域絕對不要共用 regionId（會互相清掉對方畫的格子）。
 *
 * 超出地圖邊界的座標會被直接跳過，不會丟錯——地圖擴張時（見
 * map-shift.ts 的 expandTileGrid）常常會有暫時性的邊界不一致，這裡
 * 刻意寬容處理。
 */
export function repaintRegion(
  tiles: TileGrid,
  regionId: string,
  cells: Array<[number, number]>,
  newTileValue: number,
  clearTileValue = 0,
): void {
  const previous = registry[regionId];
  if (previous) {
    for (const key of previous) {
      const [x, z] = key.split(",").map(Number);
      if (inBounds(tiles, x, z)) tiles[z][x] = clearTileValue;
    }
  }

  const nextKeys = new Set<string>();
  for (const [x, z] of cells) {
    if (!inBounds(tiles, x, z)) continue;
    tiles[z][x] = newTileValue;
    nextKeys.add(cellKey(x, z));
  }
  registry[regionId] = nextKeys;
}

/** 把矩形 {x, z, width, height} 展開成 repaintRegion 要的 cells 陣列。 */
export function rectCells(
  x: number,
  z: number,
  width: number,
  height: number,
): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let dz = 0; dz < height; dz++)
    for (let dx = 0; dx < width; dx++) cells.push([x + dx, z + dz]);
  return cells;
}

/**
 * 清空整個登記表。用途：地圖重新從頭建置一次時（例如 buildMap() 每次都是
 * 全新跑一輪 layout-maps.ts 的邏輯），或是在測試裡確保每個 test case
 * 互不干擾。
 */
export function resetRegionPaintRegistry(): void {
  for (const key of Object.keys(registry)) delete registry[key];
}

/** 純測試/除錯用：目前登記表記得某個 regionId 畫了哪些格子。 */
export function getRegionCells(regionId: string): Set<string> | undefined {
  return registry[regionId];
}
