// 視角切換／拍照按鈕——quickItemHud 正上方疊同風格按鈕；切換視角永遠
// 顯示，拍照與按住連續縮放的 −/+ 只在第一人稱時顯示。跟 quick-item-ui.ts
// 的 root 同一種「自己建 DOM、掛到
// document.body」寫法，不進 index.html 靜態標記，避免另外改版面結構。
import { gameState } from "./game-state";
import {
  isFirstPersonModeActive,
  toggleFirstPersonMode,
  zoomFirstPerson,
} from "./first-person-camera";
import { isPhotoFlashActive, requestTakePhoto } from "./photo";
import {
  getEffectiveControllerLayout,
  getLastInputDevice,
  onInputPresentationChanged,
} from "./input-device";

const root = document.createElement("section");
root.id = "viewControlsHud";
root.setAttribute("aria-label", "視角與拍照控制");
root.innerHTML = `
  <div id="photoZoomControls" aria-label="相機縮放">
    <button type="button" class="view-control-button" data-photo-zoom="out" aria-label="縮小"></button>
    <button type="button" class="view-control-button" data-photo-zoom="in" aria-label="放大"></button>
  </div>
  <button type="button" id="photoButton" class="view-control-button" aria-label="拍照">拍照</button>
  <button type="button" id="viewToggleButton" class="view-control-button" aria-label="切換第一人稱／第三人稱視角">切換視角</button>
`;
document.body.appendChild(root);

// 拍照瞬間的閃光——一塊蓋滿全螢幕、只在拍照那一下淡出的白色圖層，跟
// 相機快門的視覺回饋同一個概念，purely 裝飾用，不吃任何輸入事件。
const flash = document.createElement("div");
flash.id = "photoFlash";
flash.setAttribute("aria-hidden", "true");
document.body.appendChild(flash);

const photoButton = root.querySelector<HTMLButtonElement>("#photoButton")!;
const photoZoomControls = root.querySelector<HTMLElement>("#photoZoomControls")!;
const viewToggleButton = root.querySelector<HTMLButtonElement>(
  "#viewToggleButton",
)!;

function refreshControlLabels() {
  const gamepad = getLastInputDevice() === "gamepad";
  const nintendo = getEffectiveControllerLayout() === "nintendo";
  const zoomOut = root.querySelector<HTMLButtonElement>('[data-photo-zoom="out"]')!;
  const zoomIn = root.querySelector<HTMLButtonElement>('[data-photo-zoom="in"]')!;
  zoomOut.innerHTML = `− <small>${gamepad ? (nintendo ? "ZL" : "LT") : "滾輪"}</small>`;
  zoomIn.innerHTML = `<small>${gamepad ? (nintendo ? "ZR" : "RT") : "滾輪"}</small> ＋`;
  photoButton.innerHTML = `拍照 <small>${gamepad ? (nintendo ? "R" : "RB") : "長按畫面"}</small>`;
  viewToggleButton.innerHTML = `切換視角 <small>${gamepad ? (nintendo ? "L" : "LB") : "Tab"}</small>`;
}
refreshControlLabels();
onInputPresentationChanged(refreshControlLabels);
addEventListener("controller-layout-changed", refreshControlLabels);

photoButton.addEventListener("click", () => requestTakePhoto());
viewToggleButton.addEventListener("click", () => toggleFirstPersonMode());

let heldZoomDirection = 0;
let previousZoomFrame = 0;
for (const button of root.querySelectorAll<HTMLButtonElement>("[data-photo-zoom]")) {
  const direction = button.dataset.photoZoom === "out" ? 1 : -1;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    heldZoomDirection = direction;
    previousZoomFrame = performance.now();
    zoomFirstPerson(direction * 70);
    button.setPointerCapture(event.pointerId);
  });
  const release = () => { heldZoomDirection = 0; };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

let lastSignature = "";
let flashWasActive = false;

function render() {
  const now = performance.now();
  if (heldZoomDirection) {
    const dt = Math.min(50, now - previousZoomFrame);
    zoomFirstPerson(heldZoomDirection * dt * 1.4);
    previousZoomFrame = now;
  }
  const titlePresentation =
    document.body.classList.contains("title-presentation");
  const hudSuppressed =
    document.body.classList.contains("cutscene-presentation") ||
    Boolean(document.querySelector('[data-game-menu="open"], .game-menu.open'));
  const firstPerson = isFirstPersonModeActive();
  const signature = [
    Boolean(gameState.player),
    titlePresentation,
    hudSuppressed,
    firstPerson,
  ].join("|");
  if (signature !== lastSignature) {
    lastSignature = signature;
    root.hidden = titlePresentation || hudSuppressed || !gameState.player;
    photoButton.hidden = !firstPerson;
    photoZoomControls.hidden = !firstPerson;
    viewToggleButton.classList.toggle("is-active", firstPerson);
  }
  const flashActive = isPhotoFlashActive();
  if (flashActive !== flashWasActive) {
    flashWasActive = flashActive;
    flash.classList.toggle("show", flashActive);
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
