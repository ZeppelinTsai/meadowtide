import { activeChoice, dialogQueue } from "./dialogue";
import { gameState } from "./game-state";
import { isInventoryOpen, setInventoryOpen } from "./inventory-ui";
import { setTimePauseSource } from "./time-pause";

const overlay = document.getElementById("mapOverlay") as HTMLDivElement;
const closeButton = document.getElementById("mapClose") as HTMLButtonElement;
const quickButton = document.getElementById("quickMapMenuBtn") as HTMLButtonElement;
let open = false;

function setMapOpen(next: boolean) {
  open = next;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", String(!open));
  overlay.dataset.gameMenu = open ? "open" : "closed";
  setTimePauseSource("menu", open);
  if (open) requestAnimationFrame(() => closeButton.focus());
}

function canOpenMap() {
  const pauseOpen = document.getElementById("pauseMenu")?.classList.contains("open");
  return gameState.player && !gameState.cutsceneActive && !dialogQueue.length && !activeChoice && !pauseOpen;
}

export function toggleMapMenu() {
  if (open) {
    setMapOpen(false);
    return;
  }
  if (!canOpenMap()) return;
  if (isInventoryOpen()) setInventoryOpen(false);
  setMapOpen(true);
}

quickButton.addEventListener("click", toggleMapMenu);
closeButton.addEventListener("click", () => setMapOpen(false));
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) setMapOpen(false);
});
window.addEventListener("close-map-menu", () => setMapOpen(false));
addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m" && !event.repeat) {
    event.preventDefault();
    toggleMapMenu();
    return;
  }
  if (open && (event.key === "Escape" || event.key === "Backspace")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setMapOpen(false);
  }
});
