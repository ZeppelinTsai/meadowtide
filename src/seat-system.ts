import * as THREE from "three";
import { gameState } from "./game-state";

export type SeatTarget = { id: string; map: string; object: THREE.Object3D };

const seats: SeatTarget[] = [];
let returnPose: { x: number; y: number; z: number; rotationY: number } | null = null;

export function rebuildSeatTargets(root: THREE.Object3D, map: string) {
  seats.length = 0;
  let index = 0;
  root.traverse((object) => {
    if (object.userData.sittable !== true) return;
    seats.push({ id: `${map}:seat:${index++}`, map, object });
  });
}

export function seatTargetsForMap(map: string) {
  return seats.filter((seat) => seat.map === map && seat.object.visible);
}

export function sitOnSeat(seat: SeatTarget) {
  if (!gameState.player || gameState.isSitting || seat.map !== gameState.currentMapName) return false;
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  seat.object.getWorldPosition(position);
  seat.object.getWorldQuaternion(rotation);
  const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation);
  returnPose = {
    x: gameState.player.position.x,
    y: gameState.player.position.y,
    z: gameState.player.position.z,
    rotationY: gameState.player.rotation.y,
  };
  gameState.isSitting = true;
  gameState.isMoving = false;
  gameState.player.position.x = position.x;
  gameState.player.position.z = position.z;
  gameState.player.rotation.y = Math.atan2(-facing.x, -facing.z);
  gameState.playerGridPos = { x: Math.round(position.x), z: Math.round(position.z) };
  return true;
}

export function standFromSeat() {
  if (!gameState.isSitting) return false;
  gameState.isSitting = false;
  if (returnPose && gameState.player) {
    gameState.player.position.set(returnPose.x, returnPose.y, returnPose.z);
    gameState.player.rotation.y = returnPose.rotationY;
    gameState.playerGridPos = { x: Math.round(returnPose.x), z: Math.round(returnPose.z) };
  }
  returnPose = null;
  return true;
}

export function resetSeatState() {
  seats.length = 0;
  returnPose = null;
  gameState.isSitting = false;
}
