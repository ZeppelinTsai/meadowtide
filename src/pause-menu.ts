import { gameState } from "./game-state";
import { dialogQueue, activeChoice } from "./dialogue";
import { isInventoryOpen, setInventoryOpen } from "./inventory-ui";
import {
  getActiveSaveSlot,
  loadGame,
  saveGame,
  setActiveSaveSlot,
} from "./input-save";
import { renderSaveSlotButtons } from "./save-slot-ui";
import { mountSystemSettings } from "./system-settings-ui";
import { translateText } from "./i18n";
import { canQuickSaveDuringPrologue } from "./prologue";
import { showUiToast } from "./ui-toast";

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
  { kicker: "第一章・基本操作", title: "移動與觀察", text: "用 WASD 或左搖桿移動；滑鼠與右搖桿控制鏡頭，滾輪或 LT／RT 調整遠近。", keys: ["W A S D", "左搖桿", "滑鼠／右搖桿"], image: "/assets/tutorial/walking-1.png", alt: "主角在農場道路上行走" },
  { kicker: "第一章・基本操作", title: "智慧型情境互動", text: "靠近目標時，左下會顯示當下可用動作。主要互動可用 E／Enter／Space，次要與第三互動使用 R／F；Nintendo 使用 Y／X／A，Xbox 使用 X／Y／B。", keys: ["E／R／F", "Nintendo Y／X／A", "Xbox X／Y／B"], image: "/assets/tutorial/walking-2.png", alt: "主角靠近可互動物件" },
  { kicker: "第一章・基本操作", title: "點擊行走與互動", text: "點擊或輕觸地面可自動繞開障礙前往；點擊物件會走到可操作位置並執行主要互動。手動移動會立即取消自動行走。", keys: ["滑鼠左鍵／單點", "點左下動作", "WASD 取消"], image: "/assets/tutorial/walking-2.png", alt: "主角自動走向可互動目標" },
  { kicker: "第一章・基本操作", title: "開啟選單", text: "M／L3 開啟地圖，Q／Nintendo Minus／Xbox View 開啟資訊選單，Esc／Start 開啟暫停選單。", keys: ["M／L3 地圖", "Q／Minus／View 資訊", "Esc／Start 暫停"], image: "/assets/tutorial/walking-3.png", alt: "遊戲中的地圖、資訊與暫停選單" },
  { kicker: "第一章・基本操作", title: "操作選單", text: "方向鍵、WASD、左搖桿或方向鍵移動焦點；Enter、Space 或 A 確認，Esc、Backspace 或 B 返回。", keys: ["方向鍵／WASD", "Enter／Space／A", "Esc／Backspace／B"], image: "/assets/tutorial/walking-3.png", alt: "在遊戲選單中移動焦點" },
  { kicker: "第一章・基本操作", title: "分頁與清單", text: "使用 Q／E、PageUp／PageDown 或 LB／RB 切換分頁；滑鼠滾輪可捲動長清單與教學卡片。", keys: ["Q／E", "LB／RB", "滑鼠滾輪"], image: "/assets/tutorial/walking-3.png", alt: "切換資訊選單分頁" },
  { kicker: "第一章・基本操作", title: "聲音設定", text: "總音量、音效與音樂大小可在系統選單調整；每次設定操作都會顯示提示。", keys: ["系統選單／聲音"], image: "/assets/tutorial/walking-3.png", alt: "調整遊戲音量設定" },
];

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[pause-menu] Missing #${id}`);
  return element as T;
}

export function initPauseMenu() {
  const overlay = byId<HTMLElement>("pauseMenu");
  const resumeButton = byId<HTMLButtonElement>("pauseResumeBtn");
  const saveButton = byId<HTMLButtonElement>("pauseSaveBtn");
  const loadButton = byId<HTMLButtonElement>("pauseLoadBtn");
  const tutorialButton = byId<HTMLButtonElement>("pauseTutorialBtn");
  const quickPauseButton = byId<HTMLButtonElement>("quickPauseMenuBtn");
  const systemButton = byId<HTMLButtonElement>("pauseSystemBtn");
  const titleButton = byId<HTMLButtonElement>("pauseTitleBtn");
  const quitButton = byId<HTMLButtonElement>("pauseQuitBtn");
  const quitMessage = byId<HTMLElement>("pauseQuitMessage");
  const loadSlotsList = byId<HTMLElement>("pauseLoadSlotsList");
  const loadSlotsBackButton = byId<HTMLButtonElement>(
    "pauseLoadSlotsBackBtn",
  );
  const systemSettings = byId<HTMLElement>("pauseSystemSettings");
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
    tutorialCardKicker.textContent = translateText(page.kicker);
    tutorialCardTitle.textContent = translateText(page.title);
    tutorialCardText.textContent = translateText(page.text);
    tutorialPageNumber.textContent = `${tutorialPage + 1} / ${WALKING_TUTORIAL.length}`;
    tutorialKeys.replaceChildren(...page.keys.map((label) => {
      const key = document.createElement("kbd");
      key.textContent = translateText(label);
      return key;
    }));
    tutorialImage.hidden = true;
    tutorialImageFallback.hidden = false;
    tutorialImage.alt = translateText(page.alt);
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

  function setStep(nextStep: PauseStep) {
    step = nextStep;
    overlay.dataset.step = nextStep;
    if (nextStep === "loadSlots") {
      renderSaveSlotButtons(loadSlotsList, loadFromSlotInGame);
    }
    if (nextStep === "system") {
      const firstSetting = mountSystemSettings(systemSettings);
      requestAnimationFrame(() => firstSetting?.focus());
    }
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

  function loadFromSlotInGame(saveName: string, sourceSlot: number) {
    // 跟 title-screen.ts 的 loadFromSlot() 不同：這裡已經在遊戲裡、地圖
    // 跟 gameState.player 都已經存在，不用先 buildMap()/loadMap() 打地基
    // 再等 500ms——loadGame() 自己遇到存檔地圖跟目前不同時，內部就會呼叫
    // loadMap() 處理過場淡出，同一張地圖則直接原地搬玩家座標。
    setActiveSaveSlot(sourceSlot);
    const ok = loadGame(saveName);
    if (!ok) {
      console.warn(`[暫停選單] 讀取 ${saveName} 失敗：找不到存檔`);
    }
    closePauseMenu();
  }

  resumeButton.addEventListener("click", closePauseMenu);
  saveButton.addEventListener("click", () => {
    if (!canQuickSaveDuringPrologue()) {
      showUiToast("無法儲存", "序章尚未到達可安全存檔的自由活動階段。");
      return;
    }
    const slot = getActiveSaveSlot();
    saveGame("slot" + slot);
    showUiToast("儲存進度", `已儲存到第 ${slot} 格。`);
    closePauseMenu();
  });
  quickPauseButton.addEventListener("click", () => {
    if (!gameState.player || gameState.cutsceneActive) return;
    if (dialogQueue.length || activeChoice || isInventoryOpen()) return;
    openPauseMenu();
  });
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
  titleButton.addEventListener("click", () => window.location.reload());
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
