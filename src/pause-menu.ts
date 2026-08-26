import { gameState } from "./game-state";
import { dialogQueue, activeChoice } from "./dialogue";
import { isInventoryOpen, setInventoryOpen } from "./inventory-ui";
import { loadGame, setActiveSaveSlot } from "./input-save";
import { renderSaveSlotButtons } from "./save-slot-ui";
import { setMusicMuted } from "./music";

// ==============================================================
// 遊戲中 Esc 暫停選單——2026-08-26 Zeppelin 要求「參照主選單或背包做好
// 臨時選單」，所以架構直接照抄 title-screen.ts 的 data-step 切換步驟
// 那套(menu/loadSlots/system 三步)，按鈕沿用同一份 .titleMenuBtn／
// .titleSlotBtn CSS，讀存檔清單也共用 save-slot-ui.ts，不重寫一份。
//
// 會不會暫停遊戲時間/擋 WASD，完全交給 time-pause.ts 既有的
// syncAutomaticPauseSources() 機制——它本來就會抓
// document.querySelector('[data-game-menu="open"]') 自動視為「有選單
// 開著」，跟 inventory-ui.ts 是同一招，這裡不用再自己另外處理暫停/擋
// 移動的邏輯。
// ==============================================================

type PauseStep = "menu" | "loadSlots" | "system";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[pause-menu] Missing #${id}`);
  return element as T;
}

export function initPauseMenu() {
  const overlay = byId<HTMLElement>("pauseMenu");
  const resumeButton = byId<HTMLButtonElement>("pauseResumeBtn");
  const loadButton = byId<HTMLButtonElement>("pauseLoadBtn");
  const systemButton = byId<HTMLButtonElement>("pauseSystemBtn");
  const quitButton = byId<HTMLButtonElement>("pauseQuitBtn");
  const quitMessage = byId<HTMLElement>("pauseQuitMessage");
  const loadSlotsList = byId<HTMLElement>("pauseLoadSlotsList");
  const loadSlotsBackButton = byId<HTMLButtonElement>(
    "pauseLoadSlotsBackBtn",
  );
  const muteButton = byId<HTMLButtonElement>("pauseMuteBtn");
  const systemBackButton = byId<HTMLButtonElement>("pauseSystemBackBtn");

  let open = false;
  let step: PauseStep = "menu";

  function updateMuteLabel() {
    muteButton.textContent = gameState.musicMuted ? "音樂：關" : "音樂：開";
  }

  function setStep(nextStep: PauseStep) {
    step = nextStep;
    overlay.dataset.step = nextStep;
    if (nextStep === "loadSlots") {
      renderSaveSlotButtons(loadSlotsList, loadFromSlotInGame);
    }
    if (nextStep === "system") updateMuteLabel();
  }

  function openPauseMenu() {
    if (open) return;
    open = true;
    setStep("menu");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    overlay.dataset.gameMenu = "open";
    requestAnimationFrame(() => resumeButton.focus());
  }

  function closePauseMenu() {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.gameMenu = "closed";
  }

  function loadFromSlotInGame(slotNum: number) {
    // 跟 title-screen.ts 的 loadFromSlot() 不同：這裡已經在遊戲裡、地圖
    // 跟 gameState.player 都已經存在，不用先 buildMap()/loadMap() 打地基
    // 再等 500ms——loadGame() 自己遇到存檔地圖跟目前不同時，內部就會呼叫
    // loadMap() 處理過場淡出，同一張地圖則直接原地搬玩家座標。
    setActiveSaveSlot(slotNum);
    const ok = loadGame("slot" + slotNum);
    if (!ok) {
      console.warn(`[暫停選單] 讀取第 ${slotNum} 格失敗：找不到存檔`);
    }
    closePauseMenu();
  }

  function toggleMute() {
    setMusicMuted(!gameState.musicMuted);
    updateMuteLabel();
  }

  resumeButton.addEventListener("click", closePauseMenu);
  loadButton.addEventListener("click", () => setStep("loadSlots"));
  loadSlotsBackButton.addEventListener("click", () => setStep("menu"));
  systemButton.addEventListener("click", () => setStep("system"));
  systemBackButton.addEventListener("click", () => setStep("menu"));
  muteButton.addEventListener("click", toggleMute);
  // 結束遊戲跟標題畫面那顆按鈕行為一致：分頁沒辦法被網頁自己強制關掉
  // (除非分頁本身是用 window.open() 開的)，盡力嘗試、其餘交給
  // window.close() 失敗時分頁本來就還開著，玩家自己按返回就好，不用
  // 額外的收尾訊息(標題畫面那份已經在講同一件事，這裡沒有獨立的訊息
  // 節點可以借用，不重複做一個)。
  quitButton.addEventListener("click", () => {
    // 跟標題畫面的結束遊戲按鈕同一套保底寫法：分頁沒辦法被網頁自己強制
    // 關掉(除非分頁本身是用 window.open() 開的)，盡量嘗試、不管有沒有
    // 成功都顯示收尾訊息，不然按下去沒反應會讓人以為按鈕壞了。
    window.close();
    quitMessage.hidden = false;
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePauseMenu();
  });

  addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.repeat) return;
    if (!gameState.player) return; // 標題畫面階段還沒有玩家，不處理
    if (gameState.cutsceneActive) return; // 過場演出中不開暫停選單
    if (dialogQueue.length || activeChoice) return; // 對話/選擇進行中不開
    if (isInventoryOpen()) {
      // Esc 順手兼背包的關閉鍵，比只能按 Q 關閉更符合直覺，兩邊不衝突。
      event.preventDefault();
      setInventoryOpen(false);
      return;
    }
    event.preventDefault();
    if (!open) {
      openPauseMenu();
    } else if (step !== "menu") {
      // 在讀取進度/系統子畫面時先退回主選單，不是直接整個關掉——跟
      // title-screen.ts 的返回按鈕邏輯一致，多一層才不會誤觸直接跳出。
      setStep("menu");
    } else {
      closePauseMenu();
    }
  });
}
