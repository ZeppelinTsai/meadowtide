export type GridPoint = { x: number; z: number };
const keyOf = (point: GridPoint) => `${point.x},${point.z}`;
function rebuildPath(end: GridPoint, cameFrom: Map<string, GridPoint>) {
  const path = [end]; let key = keyOf(end);
  while (cameFrom.has(key)) { const previous = cameFrom.get(key)!; path.unshift(previous); key = keyOf(previous); }
  return path;
}
export function findReachablePath(start: GridPoint, desired: GridPoint, cols: number, rows: number, isBlocked: (x: number, z: number, fromX?: number, fromZ?: number) => boolean, radius = 0): GridPoint[] | null {
  if (start.x < 0 || start.z < 0 || start.x >= cols || start.z >= rows || isBlocked(start.x, start.z)) return null;
  const queue: GridPoint[] = [start], visited = new Set([keyOf(start)]), cameFrom = new Map<string, GridPoint>();
  let best = start, bestDistance = Math.hypot(start.x - desired.x, start.z - desired.z); const initialDistance = bestDistance;
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index], distance = Math.hypot(current.x - desired.x, current.z - desired.z);
    if (distance < bestDistance) { best = current; bestDistance = distance; }
    if (distance <= radius || (radius === 0 && distance === 0)) return rebuildPath(current, cameFrom);
    for (const neighbor of [{ x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z }, { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 }]) {
      const key = keyOf(neighbor);
      if (visited.has(key) || neighbor.x < 0 || neighbor.z < 0 || neighbor.x >= cols || neighbor.z >= rows || isBlocked(neighbor.x, neighbor.z, current.x, current.z)) continue;
      visited.add(key); cameFrom.set(key, current); queue.push(neighbor);
    }
  }
  return bestDistance < initialDistance ? rebuildPath(best, cameFrom) : null;
}
