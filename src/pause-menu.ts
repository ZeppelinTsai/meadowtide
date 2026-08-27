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

type PauseStep = "menu" | "loadSlots" | "tutorial" | "tutorialCards" | "system";

const WALKING_TUTORIAL = [
  { kicker: "基本操作", title: "開始行走", text: "使用方向鍵移動主角。斜向輸入也能自然地穿過田間與村道。", keys: ["W A S D", "左搖桿"], image: "/assets/tutorial/walking-1.png", alt: "主角在農場道路上行走" },
  { kicker: "加快腳步", title: "奔跑探索", text: "按住奔跑鍵再移動，可以更快抵達村莊、山區與港口。", keys: ["Shift + WASD", "手把奔跑鍵"], image: "/assets/tutorial/walking-2.png", alt: "主角沿著海岸快速奔跑" },
  { kicker: "觀察四周", title: "調整視角", text: "轉動視角確認前方道路與可互動物件；靠近目標後依畫面提示互動。", keys: ["滑鼠", "右搖桿", "E／手把互動鍵"], image: "/assets/tutorial/walking-3.png", alt: "主角面向村莊中的互動目標" },
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[pause-menu] Missing #${id}`);
  return element as T;
}

export function initPauseMenu() {
  const overlay = byId<HTMLElement>("pauseMenu");
  const resumeButton = byId<HTMLButtonElement>("pauseResumeBtn");
  const loadButton = byId<HTMLButtonElement>("pauseLoadBtn");
  const tutorialButton = byId<HTMLButtonElement>("pauseTutorialBtn");
  const systemButton = byId<HTMLButtonElement>("pauseSystemBtn");
  const quitButton = byId<HTMLButtonElement>("pauseQuitBtn");
  const quitMessage = byId<HTMLElement>("pauseQuitMessage");
  const loadSlotsList = byId<HTMLElement>("pauseLoadSlotsList");
  const loadSlotsBackButton = byId<HTMLButtonElement>(
    "pauseLoadSlotsBackBtn",
  );
  const muteButton = byId<HTMLButtonElement>("pauseMuteBtn");
  const systemBackButton = byId<HTMLButtonElement>("pauseSystemBackBtn");
  const tutorialBackButton = byId<HTMLButtonElement>("pauseTutorialBackBtn");
  const tutorialCardsBackButton = byId<HTMLButtonElement>("pauseTutorialCardsBackBtn");
  const tutorialTopicButton = document.querySelector<HTMLButtonElement>("[data-tutorial-topic=walking]")!;
  const tutorialCarousel = byId<HTMLElement>("pauseTutorialCarousel");
  const tutorialImage = byId<HTMLImageElement>("pauseTutorialImage");
  const tutorialImageFallback = byId<HTMLElement>("pauseTutorialImageFallback");
  const tutorialCardKicker = byId<HTMLElement>("pauseTutorialCardKicker");
  const tutorialCardTitle = byId<HTMLElement>("pauseTutorialCardTitle");
  const tutorialCardText = byId<HTMLElement>("pauseTutorialCardText");
  const tutorialKeys = byId<HTMLElement>("pauseTutorialKeys");
  const tutorialPageNumber = byId<HTMLElement>("pauseTutorialPageNumber");
  const tutorialDots = byId<HTMLElement>("pauseTutorialDots");
  const tutorialPrevButton = byId<HTMLButtonElement>("pauseTutorialPrevBtn");
  const tutorialNextButton = byId<HTMLButtonElement>("pauseTutorialNextBtn");

  let open = false;
  let step: PauseStep = "menu";
  let tutorialPage = 0;
  let lastTutorialScroll = 0;

  function renderTutorialPage() {
    const page = WALKING_TUTORIAL[tutorialPage];
    tutorialCardKicker.textContent = page.kicker;
    tutorialCardTitle.textContent = page.title;
    tutorialCardText.textContent = page.text;
    tutorialPageNumber.textContent = `${tutorialPage + 1} / ${WALKING_TUTORIAL.length}`;
    tutorialKeys.replaceChildren(...page.keys.map((label) => {
      const key = document.createElement("kbd");
      key.textContent = label;
      return key;
    }));
    tutorialImage.hidden = true;
    tutorialImageFallback.hidden = false;
    tutorialImage.alt = page.alt;
    tutorialImage.onload = () => {
      tutorialImage.hidden = false;
      tutorialImageFallback.hidden = true;
    };
    tutorialImage.onerror = () => {
      console.warn(`[玩法教學] 找不到截圖：${page.image}`);
      tutorialImage.hidden = true;
      tutorialImageFallback.hidden = false;
    };
    tutorialImage.src = page.image;
    tutorialDots.replaceChildren(...WALKING_TUTORIAL.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "pauseTutorialDot" + (index === tutorialPage ? " active" : "");
      dot.setAttribute("aria-label", `前往第 ${index + 1} 頁`);
      dot.addEventListener("click", () => {
        tutorialPage = index;
        renderTutorialPage();
      });
      return dot;
    }));
  }

  function changeTutorialPage(direction: number) {
    tutorialPage = (tutorialPage + direction + WALKING_TUTORIAL.length) % WALKING_TUTORIAL.length;
    renderTutorialPage();
  }

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
    if (nextStep === "tutorialCards") {
      renderTutorialPage();
      requestAnimationFrame(() => tutorialCarousel.focus());
    }
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
  tutorialButton.addEventListener("click", () => setStep("tutorial"));
  tutorialBackButton.addEventListener("click", () => setStep("menu"));
  tutorialTopicButton.addEventListener("click", () => {
    tutorialPage = 0;
    setStep("tutorialCards");
  });
  tutorialCardsBackButton.addEventListener("click", () => setStep("tutorial"));
  tutorialPrevButton.addEventListener("click", () => changeTutorialPage(-1));
  tutorialNextButton.addEventListener("click", () => changeTutorialPage(1));
  tutorialCarousel.addEventListener("wheel", (event) => {
    event.preventDefault();
    const now = performance.now();
    if (now - lastTutorialScroll < 280 || Math.abs(event.deltaY) < 8) return;
    lastTutorialScroll = now;
    changeTutorialPage(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
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
    if (open && step === "tutorialCards" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      changeTutorialPage(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key !== "Escape" || event.repeat) return;
    if (!gameState.player) return; // 標題畫面階段還沒有玩家，不處理
    if (gameState.cutsceneActive) return; // 過場演出中不開暫停選單
    if (dialogQueue.length || activeChoice) return; // 對話/選擇進行中不開
    if (isInventoryOpen()) {
      // Esc 順手兼資訊選單的關閉鍵，比只能按 Q 關閉更符合直覺。
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
      setStep(step === "tutorialCards" ? "tutorial" : "menu");
    } else {
      closePauseMenu();
    }
  });
}
