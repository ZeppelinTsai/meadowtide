import * as THREE from "three";

export const WORLD_RENDER_ORDER = {
  sky: -100,
  opaque: 0,
  waterDepth: 20,
  waterSurface: 30,
  effects: 40,
} as const;

export function configureOpaqueWorldMaterial<T extends THREE.Material>(material: T): T {
  material.transparent = false;
  material.opacity = 1;
  material.depthTest = true;
  material.depthWrite = true;
  material.needsUpdate = true;
  return material;
}

export function configureWaterDepthMaterial<T extends THREE.Material>(material: T): T {
  return configureOpaqueWorldMaterial(material);
}

export function configureTransparentWorldMaterial<T extends THREE.Material>(material: T): T {
  material.transparent = true;
  material.depthTest = true;
  material.depthWrite = false;
  material.needsUpdate = true;
  return material;
}

export function configureSkyMaterial<T extends THREE.Material>(material: T): T {
  material.depthTest = false;
  material.depthWrite = false;
  material.needsUpdate = true;
  return material;
}

export function applyWaterRenderContract(
  surfaces: THREE.Material[],
  depthMasks: THREE.Material[],
) {
  surfaces.forEach(configureTransparentWorldMaterial);
  depthMasks.forEach(configureWaterDepthMaterial);
}
