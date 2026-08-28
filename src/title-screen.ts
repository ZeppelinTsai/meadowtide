import * as THREE from "three";
import { buildMap, fadeIn, loadMap } from "./build-map";
import { loadGame, migrateLegacyDefaultSave, setActiveSaveSlot } from "./input-save";
import { renderSaveSlotButtons } from "./save-slot-ui";
import { initializeMusic } from "./music";
import { hasSaveData, startPrologueScene } from "./prologue";
import { mountSystemSettings } from "./system-settings-ui";
import { pollGamepad } from "./gamepad-input";
import { gameState } from "./game-state";
import { makeFemaleHeroPlayer, makeMaleHeroPlayer } from "./humanoid";
import { resetStoryState } from "./story/story-state";

type TitleStep = "splash" | "menu" | "profileName" | "appearance" | "system" | "loadSlots";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[title-screen] Missing #${id}`);
  return element as T;
}

function renderAppearancePreview(
  image: HTMLImageElement,
  makeModel: () => THREE.Object3D,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(240, 280, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff5dd, 0x47616b, 1.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.15);
  keyLight.position.set(-2, 3, -3);
  scene.add(keyLight);
  const model = makeModel();
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const halfHeight = Math.max(size.y * 0.62, 0.62);
  const halfWidth = Math.max(size.x * 0.62, halfHeight * (240 / 280));
  const camera = new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 10);
  camera.position.set(center.x, center.y, center.z - 3);
  camera.lookAt(center);
  renderer.render(scene, camera);
  image.src = renderer.domElement.toDataURL("image/png");
  renderer.dispose();
}

export function initTitleScreen() {
  // 開局第一件事：舊版單一 "default" 存檔搬進 slot1，之後所有讀存檔
  // 判斷與清單都只認 autosave/slot1..slot10，
  // 這行要跑在它們之前，見 input-save.ts 的 migrateLegacyDefaultSave()。
  migrateLegacyDefaultSave();

  const titleScreen = byId<HTMLElement>("titleScreen");
  const continueButton = byId<HTMLButtonElement>("titleContinueBtn");
  const newGameButton = byId<HTMLButtonElement>("titleNewGameBtn");
  const systemButton = byId<HTMLButtonElement>("titleSystemBtn");
  const quitButton = byId<HTMLButtonElement>("titleQuitBtn");
  const quitMessage = byId<HTMLElement>("titleQuitMessage");
  const playerNameInput = byId<HTMLInputElement>("titlePlayerNameInput");
  const nameConfirmButton = byId<HTMLButtonElement>("titleNameConfirmBtn");
  const nameBackButton = byId<HTMLButtonElement>("titleNameBackBtn");
  const maleAppearanceButton = byId<HTMLButtonElement>("titleMaleAppearanceBtn");
  const femaleAppearanceButton = byId<HTMLButtonElement>("titleFemaleAppearanceBtn");
  const appearanceBackButton = byId<HTMLButtonElement>("titleAppearanceBackBtn");
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
      if (nextStep === "profileName") playerNameInput.focus();
      if (nextStep === "appearance") maleAppearanceButton.focus();
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

  function startNewGame(appearance: "male" | "female") {
    // 目前開新遊戲固定寫進第 1 格——還沒有「開局先選要存去哪一格」的
    // 介面，之後真的要做「遊戲中隨時選單」時(Zeppelin 已經說之後要在
    // Esc/手把預設鍵位放，見 pause-menu.ts)可以再讓這裡改成可選。
    setActiveSaveSlot(1);
    resetStoryState();
    gameState.playerName = playerNameInput.value.trim().slice(0, 16);
    gameState.playerAppearance = appearance;
    hideTitleScreen();
    buildMap("port");
    loadMap("port", undefined);
    startPrologueScene();
  }

  function openProfileName() {
    playerNameInput.value = "";
    nameConfirmButton.disabled = true;
    setStep("profileName");
  }

  function confirmPlayerName() {
    const name = playerNameInput.value.trim();
    if (!name) return;
    playerNameInput.value = name.slice(0, 16);
    setStep("appearance");
  }

  function chooseAppearance(appearance: "male" | "female") {
    maleAppearanceButton.setAttribute("aria-checked", String(appearance === "male"));
    femaleAppearanceButton.setAttribute("aria-checked", String(appearance === "female"));
    startNewGame(appearance);
  }

  function loadFromSlot(saveName: string, sourceSlot: number) {
    hideTitleScreen();
    setActiveSaveSlot(sourceSlot);
    if (!loadGame(saveName, { initializeTargetMap: true })) {
      console.warn(`[title-screen] 讀取 ${saveName} 失敗：找不到存檔`);
      fadeIn();
    }
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
  newGameButton.addEventListener("click", openProfileName);
  playerNameInput.addEventListener("input", () => {
    nameConfirmButton.disabled = !playerNameInput.value.trim();
  });
  playerNameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || nameConfirmButton.disabled) return;
    event.preventDefault();
    confirmPlayerName();
  });
  nameConfirmButton.addEventListener("click", confirmPlayerName);
  nameBackButton.addEventListener("click", () => setStep("menu"));
  appearanceBackButton.addEventListener("click", () => setStep("profileName"));
  maleAppearanceButton.addEventListener("click", () => chooseAppearance("male"));
  femaleAppearanceButton.addEventListener("click", () => chooseAppearance("female"));
  continueButton.addEventListener("click", openLoadSlots);
  systemButton.addEventListener("click", () => setStep("system"));
  systemBackButton.addEventListener("click", () => setStep("menu"));
  loadSlotsBackButton.addEventListener("click", () => setStep("menu"));
  quitButton.addEventListener("click", attemptQuit);

  renderAppearancePreview(
    byId<HTMLImageElement>("titleMaleAppearancePreview"),
    makeMaleHeroPlayer,
  );
  renderAppearancePreview(
    byId<HTMLImageElement>("titleFemaleAppearancePreview"),
    makeFemaleHeroPlayer,
  );

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
