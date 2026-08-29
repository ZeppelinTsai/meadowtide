import { MAPS } from "./layout-maps";

export const FISHING_WATER_TILES = new Set([6, 9]);

export function isFishingWaterTile(mapName: string, x: number, z: number) {
  const map = MAPS[mapName];
  const tile = map?.tiles?.[Math.round(z)]?.[Math.round(x)];
  return FISHING_WATER_TILES.has(tile);
}

export function isNearFishingWater(
  mapName: string,
  x: number,
  z: number,
  radius = 1.6,
) {
  const minX = Math.floor(x - radius);
  const maxX = Math.ceil(x + radius);
  const minZ = Math.floor(z - radius);
  const maxZ = Math.ceil(z + radius);
  for (let tileZ = minZ; tileZ <= maxZ; tileZ++) {
    for (let tileX = minX; tileX <= maxX; tileX++) {
      if (Math.hypot(tileX - x, tileZ - z) > radius) continue;
      if (isFishingWaterTile(mapName, tileX, tileZ)) return true;
    }
  }
  return false;
}
