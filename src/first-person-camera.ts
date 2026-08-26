import * as THREE from "three";
import { gameState } from "./game-state";
import { getGamepadLookInput } from "./gamepad-input";
import { renderer, scene } from "./scene-sky";

const firstPersonCamera = new THREE.PerspectiveCamera(
  65,
  innerWidth / innerHeight,
  0.05,
  220,
);
firstPersonCamera.rotation.order = "YXZ";
// 相機本身不必在 scene 裡才能拿來 render，但掛在相機底下的星空／日月／雲
// 必須由 scene graph 遍歷；否則第一人稱啟用後那些子物件會整組消失。
scene.add(firstPersonCamera);

const LOOK_SPEED = 1.9;
const MOUSE_SENSITIVITY = 0.0022;
const EYE_HEIGHT = 0.82;
const MAX_PITCH = THREE.MathUtils.degToRad(82);

let active = false;
let yaw = 0;
let pitch = 0;
let playerWasVisible = true;

export function isFirstPersonModeActive() {
  return active;
}

export function toggleFirstPersonMode() {
  if (!gameState.player) return;
  active = !active;
  gameState.isMoving = false;
  if (active) {
    playerWasVisible = gameState.player.visible;
    gameState.player.visible = false;
    yaw = gameState.player.rotation.y;
    pitch = 0;
    renderer.domElement.requestPointerLock?.();
  } else {
    gameState.player.visible = playerWasVisible;
    if (document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock?.();
    }
  }
}

export function updateFirstPersonCamera(dt: number) {
  if (!active || !gameState.player) return;
  const look = getGamepadLookInput();
  yaw -= look.x * LOOK_SPEED * dt;
  pitch -= look.y * LOOK_SPEED * dt;
  pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);

  firstPersonCamera.aspect = innerWidth / innerHeight;
  firstPersonCamera.updateProjectionMatrix();
  firstPersonCamera.position.set(
    gameState.player.position.x,
    gameState.player.position.y + EYE_HEIGHT,
    gameState.player.position.z,
  );
  firstPersonCamera.rotation.set(pitch, yaw, 0);
  firstPersonCamera.updateMatrixWorld();
}

export function getGameplayCamera(defaultCamera: THREE.Camera) {
  return active ? firstPersonCamera : defaultCamera;
}

addEventListener("mousemove", (event) => {
  if (!active || document.pointerLockElement !== renderer.domElement) return;
  yaw -= event.movementX * MOUSE_SENSITIVITY;
  pitch -= event.movementY * MOUSE_SENSITIVITY;
  pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
});

addEventListener("resize", () => {
  firstPersonCamera.aspect = innerWidth / innerHeight;
  firstPersonCamera.updateProjectionMatrix();
});
