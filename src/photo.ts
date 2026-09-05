// 第一人稱拍照系統——2026-09-05 Zeppelin 要求：限定第一人稱視角下才能
// 拍照，拍下的照片存進資訊選單「相簿」分頁(見 inventory-ui.ts)。
//
// 擷取時機的限制：主渲染器(scene-sky.ts 的 renderer)沒有開
// preserveDrawingBuffer——一般 3D 主渲染器都不開這個(有效能成本)，所以
// 沒辦法在任意時間點事後補讀畫面內容，只能在 renderer.render() 剛畫完、
// 下一次 render 清掉緩衝區之前，同一個事件迴圈 tick 內立刻讀
// canvas.toDataURL()。因此這裡採「請求→標記待處理→game-loop.ts 的
// animate() 在 renderer.render() 呼叫後立刻幫忙擷取」的兩段式設計，
// 而不是讓 requestTakePhoto() 自己直接擷取(那時候畫面可能還是上一幀)。
import { gameState, SEASON_NAMES } from "./game-state";
import { isFirstPersonModeActive } from "./first-person-camera";
import { renderer } from "./scene-sky";
import { isGameplayPaused } from "./time-pause";
import { activeChoice, dialogQueue } from "./dialogue";
import { isCameraAdjustModeActive } from "./cutscene-camera";

export interface PhotoRecord {
  id: string;
  dataUrl: string;
  day: number;
  season: number;
  capturedAtMs: number; // Date.now()，純粹給相簿排序/顯示用，跟遊戲內時間無關
}

const PHOTO_KEY_PREFIX = "meadowtide.photos.";
// localStorage 一般額度只有 5-10MB，還要跟存檔資料共用同一個 origin，
// 相片用縮圖尺寸(寬度上限)+JPEG 壓縮+張數上限三重限制，避免存爆。
const MAX_PHOTOS = 40;
const PHOTO_MAX_WIDTH = 640;
const PHOTO_JPEG_QUALITY = 0.82;
// 避免手把/按鈕連點瞬間重複拍好幾張幾乎一樣的照片。
const CAPTURE_COOLDOWN_MS = 700;

let pendingCapture = false;
let lastCaptureAtMs = 0;
let flashUntilMs = 0;
const listeners = new Set<() => void>();

function photoStorageKey(slot: number) {
  return PHOTO_KEY_PREFIX + slot;
}

export function getPhotos(slot: number): PhotoRecord[] {
  try {
    const raw = localStorage.getItem(photoStorageKey(slot));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePhotos(slot: number, photos: PhotoRecord[]) {
  try {
    localStorage.setItem(photoStorageKey(slot), JSON.stringify(photos));
  } catch (err) {
    console.warn("[拍照] 相片儲存失敗（localStorage 可能已滿）：", err);
  }
}

export function deletePhoto(slot: number, id: string) {
  savePhotos(
    slot,
    getPhotos(slot).filter((photo) => photo.id !== id),
  );
  listeners.forEach((listener) => listener());
}

// 相簿內容變動時通知 UI 重新渲染(拍照發生在 game-loop.ts 的 animate()
// 裡，跟 inventory-ui.ts 的渲染時機不同步，用事件解耦，不用互相 import)。
export function onPhotosChanged(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isPhotoFlashActive() {
  return performance.now() < flashUntilMs;
}

// 只限定第一人稱視角下才能拍照——見 index.html/view-controls-ui.ts 的
// 拍照按鈕只在第一人稱時顯示同一個限制，這裡是手把/按鈕共用的實際守門。
export function canTakePhoto() {
  return (
    Boolean(gameState.player) &&
    isFirstPersonModeActive() &&
    !gameState.titlePresentationActive &&
    !gameState.cutsceneActive &&
    gameState.fishingState === "idle" &&
    !dialogQueue.length &&
    !activeChoice &&
    !isCameraAdjustModeActive() &&
    !isGameplayPaused()
  );
}

export function requestTakePhoto(): boolean {
  if (!canTakePhoto() || pendingCapture) return false;
  const now = performance.now();
  if (now - lastCaptureAtMs < CAPTURE_COOLDOWN_MS) return false;
  lastCaptureAtMs = now;
  pendingCapture = true;
  return true;
}

// game-loop.ts 的 animate() 在 renderer.render(scene, gameplayCamera) 之後
// 立刻呼叫這支——見檔案開頭那則「擷取時機的限制」說明。
export function capturePendingPhotoIfAny(slot: number) {
  if (!pendingCapture) return;
  pendingCapture = false;
  try {
    const sourceCanvas = renderer.domElement;
    const scale = Math.min(1, PHOTO_MAX_WIDTH / sourceCanvas.width);
    const outWidth = Math.max(1, Math.round(sourceCanvas.width * scale));
    const outHeight = Math.max(1, Math.round(sourceCanvas.height * scale));
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);
    const dataUrl = out.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
    const photos = getPhotos(slot);
    photos.push({
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      dataUrl,
      day: gameState.currentDay,
      season: gameState.currentSeason,
      capturedAtMs: Date.now(),
    });
    while (photos.length > MAX_PHOTOS) photos.shift();
    savePhotos(slot, photos);
    listeners.forEach((listener) => listener());
    flashUntilMs = performance.now() + 220;
    gameState.harvestFeedback = {
      kind: "success",
      title: "拍照",
      text: "已存入相簿",
      until: gameState.elapsed + 2,
      shownAtMs: performance.now(),
    };
  } catch (err) {
    console.warn("[拍照] 擷取畫面失敗：", err);
  }
}

export function photoCaptionLabel(photo: PhotoRecord) {
  return `第 ${photo.day + 1} 天・${SEASON_NAMES[photo.season] ?? ""}季`;
}
