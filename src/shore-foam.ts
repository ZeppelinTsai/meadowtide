export type ShoreTileGrid = readonly (readonly number[])[];

function boundedRange(start: number, end: number) {
  return {
    start: Math.ceil(Math.min(start, end)),
    end: Math.floor(Math.max(start, end)),
  };
}

/**
 * 從最終 tile 找指定欄最南側的「沙地 8、下一格是海 9」邊界。
 * 回傳沙地格的 z；視覺層可據此把浪花放在格線外側。
 */
export function findSouthernShoreSandZ(
  tiles: ShoreTileGrid,
  x: number,
  minZ = 0,
  maxZ = tiles.length - 2,
) {
  const range = boundedRange(minZ, maxZ);
  let shoreZ: number | null = null;
  for (let z = Math.max(0, range.start); z <= range.end; z++) {
    if (tiles[z]?.[x] === 8 && tiles[z + 1]?.[x] === 9) shoreZ = z;
  }
  return shoreZ;
}

/**
 * 從最終 tile 找指定列最西側的「沙地 8、前一格是海 9」邊界。
 * 回傳沙地格的 x；地圖外不視為海，避免在開放邊界憑空生成浪花。
 */
export function findWesternShoreSandX(
  tiles: ShoreTileGrid,
  z: number,
  minX = 1,
  maxX = (tiles[z]?.length ?? 1) - 1,
) {
  const range = boundedRange(minX, maxX);
  for (let x = Math.max(1, range.start); x <= range.end; x++) {
    if (tiles[z]?.[x] === 8 && tiles[z]?.[x - 1] === 9) return x;
  }
  return null;
}
