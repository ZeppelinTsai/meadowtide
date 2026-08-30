import { activeChoice, dialogQueue } from "./dialogue";
import { gameState } from "./game-state";
import { isInventoryOpen, setInventoryOpen } from "./inventory-ui";
import { setTimePauseSource } from "./time-pause";
import { loadMap } from "./build-map";

const overlay = document.getElementById("mapOverlay") as HTMLDivElement;
const closeButton = document.getElementById("mapClose") as HTMLButtonElement;
const quickButton = document.getElementById(
  "quickMapMenuBtn",
) as HTMLButtonElement;
let open = false;

const MAP_DESTINATIONS = {
  mountain: { x: 15, z: 53 },
  livingArea: { x: 21, z: 20 },
  oldVillage: { x: 125, z: 10 },
  port: { x: 5, z: 14 },
} as const;

function setMapOpen(next: boolean) {
  open = next;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", String(!open));
  overlay.dataset.gameMenu = open ? "open" : "closed";
  setTimePauseSource("menu", open);
  if (open) requestAnimationFrame(() => closeButton.focus());
}

function travelFromMap(mapId: keyof typeof MAP_DESTINATIONS) {
  if (!open || !gameState.player || gameState.cutsceneActive) return;
  const destination = MAP_DESTINATIONS[mapId];
  setMapOpen(false);
  loadMap(mapId, destination, () => {
    gameState.facing = "down";
    gameState.player.rotation.y = Math.PI;
  });
}
function canOpenMap() {
  const pauseOpen = document
    .getElementById("pauseMenu")
    ?.classList.contains("open");
  return (
    gameState.player &&
    !gameState.cutsceneActive &&
    !dialogQueue.length &&
    !activeChoice &&
    !pauseOpen
  );
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
overlay
  .querySelectorAll<HTMLButtonElement>("[data-map-destination]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const mapId = button.dataset
        .mapDestination as keyof typeof MAP_DESTINATIONS;
      if (mapId in MAP_DESTINATIONS) travelFromMap(mapId);
    });
  });
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
