import * as THREE from "three";
import { buildMap, fadeIn, loadMap } from "./build-map";
import {
  getSaveSlotSummaries,
  getTitlePreviewTime,
  loadGame,
  migrateLegacyDefaultSave,
  setActiveSaveSlot,
} from "./input-save";
import { renderSaveSlotButtons } from "./save-slot-ui";
import { saveSlotForDigitCode } from "./save-slot-config";
import { initializeMusic, setTitleMusicPeriod } from "./music";
import { hasSaveData, startPrologueScene } from "./prologue";
import { mountSystemSettings } from "./system-settings-ui";
import { pollGamepad } from "./gamepad-input";
import { gameState, inventory } from "./game-state";
import { makeFemaleHeroPlayer, makeMaleHeroPlayer } from "./humanoid";
import { resetStoryState } from "./story/story-state";
import { resetNpcNameRevealState } from "./npc-name-reveal";
import { resetAnimalInteractionState } from "./animal-interactions";
import { scene } from "./scene-sky";
import { hideLoadingScreen } from "./loading-screen";
import { animalGroup, animals } from "./npc-runtime";
import {
  setPresentationCamera,
  type PresentationCameraState,
} from "./first-person-camera";

type TitleStep =
  "splash" | "menu" | "profileName" | "appearance" | "system" | "loadSlots";

type TitlePeriod = "day" | "afternoon" | "night";
type TitleScenePreset = {
  period: TitlePeriod;
  startHour: number;
  camera: PresentationCameraState;
};

// 可擴充的時段展示範本；日期、季節、天氣與精確時刻仍優先讀取存檔。
export const TITLE_SCENE_PRESETS: readonly TitleScenePreset[] = [
  {
    period: "day",
    startHour: 6,
    camera: {
      positionX: 18.27,
      positionY: 2.38,
      positionZ: 8.01,
      yaw: -7.276,
      pitch: 0.103,
      fov: 65,
    },
  },
  {
    period: "afternoon",
    startHour: 12,
    camera: {
      positionX: 18.27,
      positionY: 2.38,
      positionZ: 8.01,
      yaw: -7.276,
      pitch: 0.103,
      fov: 65,
    },
  },
  {
    period: "night",
    startHour: 18,
    camera: {
      positionX: 18.27,
      positionY: 2.38,
      positionZ: 8.01,
      yaw: -7.276,
      pitch: 0.103,
      fov: 65,
    },
  },
];

function getTitleScenePreset(hour: number) {
  if (hour >= 18 || hour < 6) return TITLE_SCENE_PRESETS[2];
  if (hour >= 12) return TITLE_SCENE_PRESETS[1];
  return TITLE_SCENE_PRESETS[0];
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[title-screen] Missing #${id}`);
  return element as T;
}

function renderAppearancePreview(
  image: HTMLImageElement,
  makeModel: () => THREE.Object3D,
) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
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
  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    10,
  );
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
  document.body.classList.add("title-presentation");
  gameState.titlePresentationActive = true;
  const previewTime = getTitlePreviewTime();
  const previewHour = previewTime.currentPhase * 24;
  const titlePreset = getTitleScenePreset(previewHour);
  setTitleMusicPeriod(titlePreset.period);
  const previous = {
    player: gameState.player,
    currentMapName: gameState.currentMapName,
    currentDay: gameState.currentDay,
    currentSeason: gameState.currentSeason,
    currentPhase: gameState.currentPhase,
    currentWeather: gameState.currentWeather,
    elapsed: gameState.elapsed,
  };
  gameState.currentDay = previewTime.currentDay;
  gameState.currentSeason = previewTime.currentSeason;
  gameState.currentPhase = previewTime.currentPhase;
  gameState.currentWeather = previewTime.currentWeather as any;
  gameState.elapsed = previewTime.elapsed;
  buildMap("livingArea");
  // 標題只展示自然環境。只能暫時隱藏整個群組，不能把模型從群組移除；
  // 否則讀取舊存檔後，06:00 作息只會切 visible，無法讓已脫離場景樹的動物出現。
  animalGroup.visible = false;
  if (!gameState.player) {
    // 主迴圈在沒有玩家時會直接跳過；使用完整主角模型作為不顯示、不存檔的展示驅動器。
    gameState.player = makeMaleHeroPlayer();
    scene.add(gameState.player);
  }
  const titlePresentationPlayer = gameState.player;
  gameState.player.visible = false;
  setPresentationCamera(titlePreset.camera);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      titleScreen.classList.add("titleSceneReady");
      void hideLoadingScreen();
    }),
  );
  const continueButton = byId<HTMLButtonElement>("titleContinueBtn");
  const newGameButton = byId<HTMLButtonElement>("titleNewGameBtn");
  const systemButton = byId<HTMLButtonElement>("titleSystemBtn");
  const quitButton = byId<HTMLButtonElement>("titleQuitBtn");
  const quitMessage = byId<HTMLElement>("titleQuitMessage");
  const playerNameInput = byId<HTMLInputElement>("titlePlayerNameInput");
  const nameConfirmButton = byId<HTMLButtonElement>("titleNameConfirmBtn");
  const nameBackButton = byId<HTMLButtonElement>("titleNameBackBtn");
  const maleAppearanceButton = byId<HTMLButtonElement>(
    "titleMaleAppearanceBtn",
  );
  const femaleAppearanceButton = byId<HTMLButtonElement>(
    "titleFemaleAppearanceBtn",
  );
  const appearanceBackButton = byId<HTMLButtonElement>(
    "titleAppearanceBackBtn",
  );
  const systemBackButton = byId<HTMLButtonElement>("titleSystemBackBtn");
  const systemSettings = byId<HTMLElement>("titleSystemSettings");
  const loadSlotsList = byId<HTMLElement>("titleLoadSlotsList");
  const loadSlotsBackButton = byId<HTMLButtonElement>("titleLoadSlotsBackBtn");
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
    document.body.classList.remove("title-presentation");
    gameState.titlePresentationActive = false;
    setTitleMusicPeriod(null);
    setPresentationCamera(null);
    if (titlePresentationPlayer !== previous.player)
      titlePresentationPlayer.parent?.remove(titlePresentationPlayer);
    gameState.player = previous.player;
    gameState.currentMapName = previous.currentMapName;
    gameState.currentDay = previous.currentDay;
    gameState.currentSeason = previous.currentSeason;
    gameState.currentPhase = previous.currentPhase;
    gameState.currentWeather = previous.currentWeather;
    gameState.elapsed = previous.elapsed;
    // 防範舊版標題流程或熱更新已經把動物模型拆離群組；正式 loadMap()
    // 隨後會依目標地圖決定 animalGroup.visible。
    animals.forEach((animal) => {
      if (animal.mesh.parent !== animalGroup) animalGroup.add(animal.mesh);
    });
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
    resetNpcNameRevealState();
    resetAnimalInteractionState();
    gameState.oysterRackSlots = 1;
    inventory.pearls.white = 0;
    inventory.pearls.pink = 0;
    inventory.pearls.purple = 0;
    inventory.pearls.black = 0;
    inventory.pearls.gold = 0;
    inventory.tools.wateringCan = true;
    inventory.tools.hoe = true;
    inventory.tools.dualAxe = true;
    inventory.tools.sickle = true;
    inventory.tools.fishingRod = true;
    inventory.tools.milker = false;
    inventory.tools.shears = false;
    inventory.tools.brush = false;
    gameState.playerName = playerNameInput.value.trim().slice(0, 16);
    gameState.playerAppearance = appearance;
    // 標題畫面淡出前先在底下鋪全黑，避免 loadMap 尚未完成、序章尚未把
    // 渡輪搬到外海時，普通港口場景從兩層淡出之間閃現一幀。
    const fade = byId<HTMLElement>("fade");
    fade.style.transition = "none";
    fade.style.opacity = "1";
    hideTitleScreen();
    loadMap("port", undefined, () => {
      // 玩家與港口參照都建立完成後才開序章；回傳 false 要求 loadMap
      // 不自行 fadeIn，淡入時機交給序章的一秒專屬轉場。
      startPrologueScene({ alreadyFaded: true, loadMap });
      return false;
    });
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
    maleAppearanceButton.setAttribute(
      "aria-checked",
      String(appearance === "male"),
    );
    femaleAppearanceButton.setAttribute(
      "aria-checked",
      String(appearance === "female"),
    );
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

  function handleTitleKeyDown(event: KeyboardEvent) {
    if (!titleActive) return;
    if (step === "splash") {
      enterMenu();
      return;
    }
    if (step !== "menu" && step !== "loadSlots") return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const slot = saveSlotForDigitCode(event.code);
    if (slot === null) return;
    const summary = getSaveSlotSummaries().find(
      (candidate) => !candidate.isAutosave && candidate.slot === slot,
    );
    if (!summary?.exists) return;
    event.preventDefault();
    loadFromSlot(summary.saveName, summary.sourceSlot);
  }

  document.addEventListener("keydown", handleTitleKeyDown);
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
  maleAppearanceButton.addEventListener("click", () =>
    chooseAppearance("male"),
  );
  femaleAppearanceButton.addEventListener("click", () =>
    chooseAppearance("female"),
  );
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
    setTitleMusicPeriod(
      getTitleScenePreset(gameState.currentPhase * 24).period,
    );
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
