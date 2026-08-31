export type WaveDirection = { x: number; z: number };

const CARDINAL_DIRECTIONS: readonly WaveDirection[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

export function getShorewardSeaWaveDirection(
  tiles: number[][],
  worldX: number,
  worldZ: number,
  fallback: WaveDirection,
): WaveDirection {
  const x = Math.round(worldX);
  const z = Math.round(worldZ);
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
    if (excessDistance > 4) return;
    const weight = 1 / (1 + excessDistance * excessDistance);
    directionX += hit.direction.x * weight;
    directionZ += hit.direction.z * weight;
  });
  const length = Math.hypot(directionX, directionZ);
  if (length < 0.001) return { ...fallback };
  return { x: directionX / length, z: directionZ / length };
}
