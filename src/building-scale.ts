export type ScaledBuilding = {
  x: number;
  z: number;
  w?: number;
  d?: number;
  doorX?: number;
  visualScale?: number;
};

export function getScaledBuildingBounds(
  building: ScaledBuilding,
  fallbackScale = 1,
) {
  const width = building.w || 1;
  const depth = building.d || 1;
  const scale = building.visualScale || fallbackScale;
  const centerX = building.x + (width - 1) / 2;
  const centerZ = building.z + (depth - 1) / 2;
  const halfWidth = (width * 0.96 * scale) / 2;
  const halfDepth = (depth * 0.96 * scale) / 2;
  return {
    scale,
    width,
    depth,
    centerX,
    centerZ,
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minZ: centerZ - halfDepth,
    maxZ: centerZ + halfDepth,
    doorHalfWidth: Math.max(0.48, 0.16 * scale + 0.24),
    originalFrontZ: building.z + depth - 0.5,
  };
}

export function isPointBlockedByScaledBuilding(
  building: ScaledBuilding,
  x: number,
  z: number,
  fallbackScale = 1,
) {
  const bounds = getScaledBuildingBounds(building, fallbackScale);
  const tx = Math.round(x);
  const tz = Math.round(z);
  const insideOriginal =
    tx >= building.x &&
    tx < building.x + bounds.width &&
    tz >= building.z &&
    tz < building.z + bounds.depth;
  const insideVisual =
    x >= bounds.minX &&
    x <= bounds.maxX &&
    z >= bounds.minZ &&
    z <= bounds.maxZ;
  if (!insideOriginal && !insideVisual) return false;
  const inDoorCorridor =
    bounds.scale > 1 &&
    building.doorX !== undefined &&
    Math.abs(x - building.doorX) <= bounds.doorHalfWidth &&
    z >= bounds.originalFrontZ;
  return !inDoorCorridor;
}
