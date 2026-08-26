import { gameState } from "./game-state";
import { INDOOR_MAPS } from "./environment";

export type TimePauseSource = "event" | "inventory" | "interior" | "menu";

const activeSources = new Set<TimePauseSource>();

export function setTimePauseSource(source: TimePauseSource, active: boolean) {
  if (active) activeSources.add(source);
  else activeSources.delete(source);
}

function syncAutomaticPauseSources() {
  const dialog = document.getElementById("dialog");
  const eventOpen = Boolean(
    dialog && dialog.style.display !== "none" && dialog.style.display !== "",
  );
  const menuOpen = Boolean(
    document.querySelector('[data-game-menu="open"], .game-menu.open'),
  );
  setTimePauseSource("event", eventOpen);
  setTimePauseSource("menu", menuOpen);
  setTimePauseSource("interior", INDOOR_MAPS.has(gameState.currentMapName));
}

function isLegacyPauseEnabled() {
  return (window as any).__gamePaused === true;
}

export function isWorldTimePaused() {
  syncAutomaticPauseSources();
  return document.hidden || activeSources.size > 0 || isLegacyPauseEnabled();
}

export function isGameplayPaused() {
  syncAutomaticPauseSources();
  return (
    document.hidden ||
    activeSources.has("event") ||
    activeSources.has("inventory") ||
    activeSources.has("menu") ||
    isLegacyPauseEnabled()
  );
}

export function getTimePauseSources() {
  syncAutomaticPauseSources();
  return [...activeSources];
}