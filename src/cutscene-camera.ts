import { gameState } from "./game-state";

// ==============================================================
// 過場鏡頭系統：把「鏡頭要看哪裡、拉多近」從 game-loop.ts 原本「鏡頭永遠
// 自動跟玩家(或序幕船身)」的邏輯裡暫時接管過來，播放一組手動排好的
// 鏡頭清單(焦點+zoom+停留時間)，播完自動交還控制權——跟序幕借用
// gameState.cutsceneActive 鎖住 WASD 移動是同一種「暫時接管、事後歸還」
// 的模式，只是這裡接管的是鏡頭，不是玩家位置。
//
// 2026-08-26 跟 Zeppelin 確認過範圍：鏡頭傾角維持 scene-sky.ts 的
// TILT_RAD 固定值不變，不做真正自由旋轉/側拍的攝影機——所以一顆鏡頭
// 只需要三個數字：看向哪個世界座標(focusX/focusZ)、zoom 拉多近(套用
// docs/decisions/camera-zoom.md 的 2/5/10/20 級距，不要在這裡發明新的
// zoom 數字)。細節見 docs/decisions/cutscene-camera.md。
// ==============================================================

export interface CameraShot {
  focusX: number;
  focusZ: number;
  zoom: number;
  duration: number; // 秒；0 = 硬切(不補間)
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

let shots: CameraShot[] = [];
let shotIndex = -1;
let shotElapsed = 0;
let fromFocusX = 0;
let fromFocusZ = 0;
let fromZoom = 5;
let onComplete: (() => void) | null = null;

export function isCameraShotsPlaying(): boolean {
  return shotIndex >= 0 && shotIndex < shots.length;
}

/**
 * 開始播放一組鏡頭清單。currentFocusX/Z/Zoom 是「鏡頭現在在哪」，第一顆
 * 鏡頭會從這個位置補間過去，避免開場就是一次硬切。
 */
export function playCameraShots(
  list: CameraShot[],
  currentFocusX: number,
  currentFocusZ: number,
  currentZoom: number,
  done?: () => void,
) {
  if (!list.length) {
    done?.();
    return;
  }
  shots = list;
  shotIndex = 0;
  shotElapsed = 0;
  fromFocusX = currentFocusX;
  fromFocusZ = currentFocusZ;
  fromZoom = currentZoom;
  onComplete = done ?? null;
}

export function stopCameraShots() {
  shots = [];
  shotIndex = -1;
  shotElapsed = 0;
  onComplete = null;
}

/**
 * game-loop.ts 每幀呼叫。有清單在播就回傳這一幀該用的鏡頭值；沒有在播
 * 時回傳 null，呼叫端此時應該退回原本「自動跟玩家/船」的鏡頭邏輯，
 * 對現有行為完全沒有副作用。
 */
export function updateCameraShots(
  dt: number,
): { focusX: number; focusZ: number; zoom: number } | null {
  if (!isCameraShotsPlaying()) return null;
  const shot = shots[shotIndex];
  shotElapsed += dt;
  const t = shot.duration <= 0 ? 1 : Math.min(1, shotElapsed / shot.duration);
  const eased = easeInOutQuad(t);
  const focusX = fromFocusX + (shot.focusX - fromFocusX) * eased;
  const focusZ = fromFocusZ + (shot.focusZ - fromFocusZ) * eased;
  const zoom = fromZoom + (shot.zoom - fromZoom) * eased;
  if (t >= 1) {
    fromFocusX = shot.focusX;
    fromFocusZ = shot.focusZ;
    fromZoom = shot.zoom;
    shotIndex++;
    shotElapsed = 0;
    if (shotIndex >= shots.length) {
      const cb = onComplete;
      stopCameraShots();
      cb?.();
    }
  }
  return { focusX, focusZ, zoom };
}

// ==============================================================
// 鏡頭調整模式(開發用)：F4 開關。開著的時候方向鍵平移焦點、滾輪照舊
// 縮放(沿用 input-save.ts 既有的 setCameraZoom()，本來就會把 zoom 印到
// console)，C 鍵把目前焦點+zoom 記一顆鏡頭下來，整份清單重印在
// console，可以直接複製貼進事件程式碼裡的 CameraShot[] 清單。用途：
// 不用靠猜數字，配合 F8 重播序幕、邊看畫面邊調，試到滿意再定案成程式碼
// 裡的固定鏡頭清單。
//
// 目前只在「有過場鎖住移動」的情境下安全——方向鍵在 game-loop.ts 平常
// 也拿來當 WASD 的替代移動鍵，cutsceneActive 為 true 時那段移動判定
// 整個不會執行，方向鍵才不會同時變成「玩家又在走」。之後如果要在一般
// 走動時也開這個模式，得先處理這個輸入搶用的問題。
// ==============================================================

let adjustModeActive = false;
let adjustFocusX = 0;
let adjustFocusZ = 0;
let recordedShots: CameraShot[] = [];

export function isCameraAdjustModeActive(): boolean {
  return adjustModeActive;
}

export function beginCameraAdjustMode(startFocusX: number, startFocusZ: number) {
  stopCameraShots(); // 兩種接管模式互斥，開手動模式前先確保沒有清單在播
  adjustModeActive = true;
  adjustFocusX = startFocusX;
  adjustFocusZ = startFocusZ;
  recordedShots = [];
  console.info(
    "[鏡頭調整模式] 已開啟——方向鍵平移、滾輪/雙指縮放、C 記一顆鏡頭、F4 再按一次關閉。",
  );
}

export function endCameraAdjustMode() {
  adjustModeActive = false;
  console.info("[鏡頭調整模式] 已關閉，鏡頭交還自動跟隨。");
}

const ADJUST_PAN_SPEED = 9; // 世界單位/秒

export function updateCameraAdjustMode(
  dt: number,
  panLeft: boolean,
  panRight: boolean,
  panUp: boolean,
  panDown: boolean,
): { focusX: number; focusZ: number; zoom: number } | null {
  if (!adjustModeActive) return null;
  if (panLeft) adjustFocusX -= ADJUST_PAN_SPEED * dt;
  if (panRight) adjustFocusX += ADJUST_PAN_SPEED * dt;
  if (panUp) adjustFocusZ -= ADJUST_PAN_SPEED * dt;
  if (panDown) adjustFocusZ += ADJUST_PAN_SPEED * dt;
  return { focusX: adjustFocusX, focusZ: adjustFocusZ, zoom: gameState.zoom };
}

export function recordCameraAdjustShot(duration = 1.5) {
  if (!adjustModeActive) return;
  recordedShots.push({
    focusX: adjustFocusX,
    focusZ: adjustFocusZ,
    zoom: gameState.zoom,
    duration,
  });
  const body = recordedShots
    .map(
      (s) =>
        `  { focusX: ${s.focusX.toFixed(2)}, focusZ: ${s.focusZ.toFixed(2)}, zoom: ${s.zoom.toFixed(2)}, duration: ${s.duration} },`,
    )
    .join("\n");
  console.info(
    `[鏡頭調整模式] 已記錄第 ${recordedShots.length} 顆鏡頭，目前清單：\n[\n${body}\n]`,
  );
}
