// 視角切換／拍照按鈕——2026-09-05 Zeppelin 要求：quickItemHud 正上方疊
// 兩顆同風格按鈕，「切換視角」永遠顯示、「拍照」只在第一人稱時才出現，
// 拍照放最上面。跟 quick-item-ui.ts 的 root 同一種「自己建 DOM、掛到
// document.body」寫法，不進 index.html 靜態標記，避免另外改版面結構。
import { gameState } from "./game-state";
import { isFirstPersonModeActive, toggleFirstPersonMode } from "./first-person-camera";
import { isPhotoFlashActive, requestTakePhoto } from "./photo";

const root = document.createElement("section");
root.id = "viewControlsHud";
root.setAttribute("aria-label", "視角與拍照控制");
root.innerHTML = `
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
const viewToggleButton = root.querySelector<HTMLButtonElement>(
  "#viewToggleButton",
)!;

photoButton.addEventListener("click", () => requestTakePhoto());
viewToggleButton.addEventListener("click", () => toggleFirstPersonMode());

let lastSignature = "";
let flashWasActive = false;

function render() {
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
