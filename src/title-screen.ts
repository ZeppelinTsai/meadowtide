import { buildMap, fadeIn, loadMap } from "./build-map";
import { loadGame, migrateLegacyDefaultSave, setActiveSaveSlot } from "./input-save";
import { renderSaveSlotButtons } from "./save-slot-ui";
import { initializeMusic } from "./music";
import { hasSaveData, startPrologueScene } from "./prologue";
import { mountSystemSettings } from "./system-settings-ui";
import { pollGamepad } from "./gamepad-input";

type TitleStep = "splash" | "menu" | "system" | "loadSlots";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[title-screen] Missing #${id}`);
  return element as T;
}

export function initTitleScreen() {
  // 開局第一件事：舊版單一 "default" 存檔搬進 slot1，之後所有讀存檔
  // 判斷與清單都只認 autosave/slot1..slot9，
  // 這行要跑在它們之前，見 input-save.ts 的 migrateLegacyDefaultSave()。
  migrateLegacyDefaultSave();

  const titleScreen = byId<HTMLElement>("titleScreen");
  const continueButton = byId<HTMLButtonElement>("titleContinueBtn");
  const newGameButton = byId<HTMLButtonElement>("titleNewGameBtn");
  const systemButton = byId<HTMLButtonElement>("titleSystemBtn");
  const quitButton = byId<HTMLButtonElement>("titleQuitBtn");
  const quitMessage = byId<HTMLElement>("titleQuitMessage");
  const systemBackButton = byId<HTMLButtonElement>("titleSystemBackBtn");
  const systemSettings = byId<HTMLElement>("titleSystemSettings");
  const loadSlotsList = byId<HTMLElement>("titleLoadSlotsList");
  const loadSlotsBackButton = byId<HTMLButtonElement>(
    "titleLoadSlotsBackBtn",
  );
  let step: TitleStep = "splash";
  let titleActive = true;
  let titleGamepadReleased = false;

  function setStep(nextStep: TitleStep) {
    step = nextStep;
    titleScreen.dataset.step = nextStep;
    requestAnimationFrame(() => {
      if (nextStep === "menu") newGameButton.focus();
      if (nextStep === "system") {
        const firstSetting = mountSystemSettings(systemSettings);
        firstSetting?.focus();
      }
      if (nextStep === "loadSlots") {
        const firstEnabled = loadSlotsList.querySelector<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        (firstEnabled || loadSlotsBackButton).focus();
      }
    });
  }

  function enterMenu() {
    if (step !== "splash") return;
    initializeMusic();
    continueButton.hidden = !hasSaveData();
    setStep("menu");
  }

  function hideTitleScreen() {
    titleActive = false;
    titleScreen.classList.add("titleScreen--hidden");
    window.setTimeout(() => {
      titleScreen.style.display = "none";
    }, 400);
  }

  function startNewGame() {
    // 目前開新遊戲固定寫進第 1 格——還沒有「開局先選要存去哪一格」的
    // 介面，之後真的要做「遊戲中隨時選單」時(Zeppelin 已經說之後要在
    // Esc/手把預設鍵位放，見 pause-menu.ts)可以再讓這裡改成可選。
    setActiveSaveSlot(1);
    hideTitleScreen();
    buildMap("port");
    loadMap("port", undefined);
    startPrologueScene();
  }

  function loadFromSlot(saveName: string, sourceSlot: number) {
    hideTitleScreen();
    setActiveSaveSlot(sourceSlot);
    buildMap("livingArea");
    loadMap("livingArea", undefined);
    window.setTimeout(() => {
      if (!loadGame(saveName)) {
        console.warn(`[title-screen] 讀取 ${saveName} 失敗：找不到存檔`);
      }
      fadeIn();
    }, 500);
  }

  function openLoadSlots() {
    renderSaveSlotButtons(loadSlotsList, loadFromSlot);
    setStep("loadSlots");
  }

  function attemptQuit() {
    window.close();
    quitMessage.hidden = false;
  }

  document.addEventListener("keydown", enterMenu);
  document.addEventListener("pointerdown", enterMenu);
  newGameButton.addEventListener("click", startNewGame);
  continueButton.addEventListener("click", openLoadSlots);
  systemButton.addEventListener("click", () => setStep("system"));
  systemBackButton.addEventListener("click", () => setStep("menu"));
  loadSlotsBackButton.addEventListener("click", () => setStep("menu"));
  quitButton.addEventListener("click", attemptQuit);

  setStep("splash");
  // 主遊戲 animate() 在 player 尚未建立時會提早返回，因此標題畫面必須
  // 自己輪詢手把。A 由既有 UI confirm 路徑轉成 Enter；其他按鈕也能符合
  // 「按任意鍵開始」，進主選單後同一輪詢繼續負責方向與 A 確認。
  const pollTitleGamepad = () => {
    if (!titleActive) return;
    const anyButtonPressed = Array.from(navigator.getGamepads?.() || []).some(
      (pad) => pad?.buttons.some((button) => button.pressed),
    );
    if (step === "splash") {
      if (anyButtonPressed) enterMenu();
    } else if (!titleGamepadReleased) {
      // 越過 splash 的那顆按鈕必須先放開，否則按住 A 會在下一幀立刻
      // 啟動已聚焦的「開始新遊戲」，Y／Start 也可能洩漏成遊戲快捷鍵。
      titleGamepadReleased = !anyButtonPressed;
    } else {
      pollGamepad();
    }
    requestAnimationFrame(pollTitleGamepad);
  };
  requestAnimationFrame(pollTitleGamepad);
}
