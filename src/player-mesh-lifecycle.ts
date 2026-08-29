import * as THREE from "three";

export function isPlayerMesh(object: THREE.Object3D) {
  return (
    object.userData.playerMeshRole === "runtime" ||
    object.userData.playerAppearance === "male" ||
    object.userData.playerAppearance === "female"
  );
}

export function markRuntimePlayerMesh(object: THREE.Object3D) {
  object.userData.playerMeshRole = "runtime";
  return object;
}

export function removeStalePlayerMeshes(
  root: THREE.Object3D,
  keep: THREE.Object3D | null = null,
) {
  const stale = root.children.filter(
    (child) => child !== keep && isPlayerMesh(child),
  );
  stale.forEach((child) => root.remove(child));
  return stale.length;
}
