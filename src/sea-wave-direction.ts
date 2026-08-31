export type WaveDirection = { x: number; z: number };

const CARDINAL_DIRECTIONS: readonly WaveDirection[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

const SHORE_BLEND_DISTANCE = 16;

function getGridShorewardDirection(
  tiles: number[][],
  x: number,
  z: number,
  fallback: WaveDirection,
): WaveDirection {
  const maxDistance = Math.max(tiles.length, ...tiles.map((row) => row.length));
  const hits: Array<{ direction: WaveDirection; distance: number }> = [];

  CARDINAL_DIRECTIONS.forEach((direction) => {
    for (let distance = 1; distance <= maxDistance; distance++) {
      const sampleX = x + direction.x * distance;
      const sampleZ = z + direction.z * distance;
      if (sampleZ < 0 || sampleZ >= tiles.length) continue;
      const row = tiles[sampleZ];
      if (sampleX < 0 || sampleX >= row.length) continue;
      if (row[sampleX] === 9) continue;
      hits.push({ direction, distance });
      break;
    }
  });

  if (!hits.length) return { ...fallback };
  const nearestDistance = Math.min(...hits.map((hit) => hit.distance));
  let directionX = 0;
  let directionZ = 0;
  hits.forEach((hit) => {
    const excessDistance = hit.distance - nearestDistance;
    if (excessDistance > SHORE_BLEND_DISTANCE) return;
    const weight = Math.exp(-excessDistance / 6);
    directionX += hit.direction.x * weight;
    directionZ += hit.direction.z * weight;
  });
  const length = Math.hypot(directionX, directionZ);
  if (length < 0.001) return { ...fallback };
  return { x: directionX / length, z: directionZ / length };
}

export function getShorewardSeaWaveDirection(
  tiles: number[][],
  worldX: number,
  worldZ: number,
  fallback: WaveDirection,
): WaveDirection {
  // 不可先 round 到單一 tile：跨過半格時方向會瞬間換軸，海面上會形成
  // 一條筆直斷層。四個相鄰格各自求岸向後再雙線性插值，方向場才連續。
  const x0 = Math.floor(worldX);
  const z0 = Math.floor(worldZ);
  const tx = worldX - x0;
  const tz = worldZ - z0;
  const d00 = getGridShorewardDirection(tiles, x0, z0, fallback);
  const d10 = getGridShorewardDirection(tiles, x0 + 1, z0, fallback);
  const d01 = getGridShorewardDirection(tiles, x0, z0 + 1, fallback);
  const d11 = getGridShorewardDirection(tiles, x0 + 1, z0 + 1, fallback);
  const topX = d00.x + (d10.x - d00.x) * tx;
  const topZ = d00.z + (d10.z - d00.z) * tx;
  const bottomX = d01.x + (d11.x - d01.x) * tx;
  const bottomZ = d01.z + (d11.z - d01.z) * tx;
  const directionX = topX + (bottomX - topX) * tz;
  const directionZ = topZ + (bottomZ - topZ) * tz;
  const length = Math.hypot(directionX, directionZ);
  if (length < 0.001) return { ...fallback };
  return { x: directionX / length, z: directionZ / length };
}
