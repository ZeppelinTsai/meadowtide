import * as THREE from "three";
export type SeaCell = { x: number; z: number };

// 港口與舊城鎮使用靜態海面；每格只需一個面，避免浪動畫移除後仍浪費頂點。
export function createConnectedTileSeaGeometry(
  cells: Iterable<SeaCell>,
  subdivisions = 1,
) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const vertexIndices = new Map<string, number>();
  const vertex = (gridX: number, gridZ: number) => {
    const key = `${gridX},${gridZ}`;
    const existing = vertexIndices.get(key);
    if (existing !== undefined) return existing;
    const index = positions.length / 3;
    vertexIndices.set(key, index);
    positions.push(gridX / subdivisions, 0, gridZ / subdivisions);
    colors.push(0.18, 0.43, 0.68);
    return index;
  };
  for (const cell of cells) {
    const startX = cell.x * subdivisions - subdivisions / 2;
    const startZ = cell.z * subdivisions - subdivisions / 2;
    for (let dz = 0; dz < subdivisions; dz++) {
      for (let dx = 0; dx < subdivisions; dx++) {
        const i00 = vertex(startX + dx, startZ + dz);
        const i10 = vertex(startX + dx + 1, startZ + dz);
        const i01 = vertex(startX + dx, startZ + dz + 1);
        const i11 = vertex(startX + dx + 1, startZ + dz + 1);
        indices.push(i00, i01, i10, i10, i01, i11);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  const positionArray = new Float32Array(positions);
  geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
