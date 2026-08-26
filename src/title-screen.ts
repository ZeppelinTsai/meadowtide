import { buildMap, fadeIn, loadMap } from "./build-map";
import { gameState } from "./game-state";
import { loadGame } from "./input-save";
import { initializeMusic, setMusicMuted } from "./music";
import { hasSaveData, startPrologueScene } from "./prologue";

type TitleStep = "splash" | "menu" | "system";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`[title-screen] Missing #${id}`);
  return element as T;
}

export function initTitleScreen() {
  const titleScreen = byId<HTMLElement>("titleScreen");
  const continueButton = byId<HTMLButtonElement>("titleContinueBtn");
  const newGameButton = byId<HTMLButtonElement>("titleNewGameBtn");
  const systemButton = byId<HTMLButtonElement>("titleSystemBtn");
  const quitButton = byId<HTMLButtonElement>("titleQuitBtn");
  const quitMessage = byId<HTMLElement>("titleQuitMessage");
  const systemBackButton = byId<HTMLButtonElement>("titleSystemBackBtn");
  const muteButton = byId<HTMLButtonElement>("titleMuteBtn");
  let step: TitleStep = "splash";

  function setStep(nextStep: TitleStep) {
    step = nextStep;
    titleScreen.dataset.step = nextStep;
    requestAnimationFrame(() => {
      if (nextStep === "menu") newGameButton.focus();
      if (nextStep === "system") muteButton.focus();
    });
  }

  function updateMuteLabel() {
    muteButton.textContent = gameState.musicMuted ? "音樂：關" : "音樂：開";
  }

  function enterMenu() {
    if (step !== "splash") return;
    initializeMusic();
    continueButton.hidden = !hasSaveData();
    updateMuteLabel();
    setStep("menu");
  }

  function hideTitleScreen() {
    titleScreen.classList.add("titleScreen--hidden");
    window.setTimeout(() => {
      titleScreen.style.display = "none";
    }, 400);
  }

  function startNewGame() {
    hideTitleScreen();
    buildMap("port");
    loadMap("port", undefined);
    startPrologueScene();
  }

  function continueGame() {
    hideTitleScreen();
    buildMap("livingArea");
    loadMap("livingArea", undefined);
    window.setTimeout(() => {
      if (!loadGame()) console.warn("[title-screen] 無法讀取存檔");
      fadeIn();
    }, 500);
  }

  function toggleMute() {
    setMusicMuted(!gameState.musicMuted);
    updateMuteLabel();
  }

  function attemptQuit() {
    window.close();
    quitMessage.hidden = false;
  }

  document.addEventListener("keydown", enterMenu);
  document.addEventListener("pointerdown", enterMenu);
  newGameButton.addEventListener("click", startNewGame);
  continueButton.addEventListener("click", continueGame);
  systemButton.addEventListener("click", () => setStep("system"));
  systemBackButton.addEventListener("click", () => setStep("menu"));
  muteButton.addEventListener("click", toggleMute);
  quitButton.addEventListener("click", attemptQuit);

  setStep("splash");
}
