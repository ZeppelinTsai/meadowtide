import { gameState } from "./game-state";
import { INDOOR_MAPS } from "./environment";

// storyEvent：2026-09-01 event-system Phase 1 補的第五個來源，給
// story/story-runtime-browser.ts 的 pauseTime binding 專用。不能沿用既有
// "event"，因為 syncAutomaticPauseSources() 每次呼叫都會用 #dialog 的
// 顯示狀態覆蓋 "event"——手動在「沒有對話框開著」的鏡頭/演出空檔呼叫
// setTimePauseSource("event", true) 會在下一次任何地方呼叫
// isWorldTimePaused()/isGameplayPaused() 時被自動同步邏輯蓋掉，等於白設。
// "storyEvent" 沒有被 syncAutomaticPauseSources() 動到，設了就會一直生效
// 到明確關掉為止。見 docs/decisions/event-system.md Phase 1 紀錄。
// rubyEvent：2026-09-03 露比個人事件補的第六個來源。不能沿用
// "guidedGameplay"——day2-morning-event.ts 的 updateDayTwoWalkFollowers()
// 每幀都會呼叫 setTimePauseSource("guidedGameplay", dayTwoMorningEvent.phase
// !== "idle" && phase !== "complete")，木匠事件結束後 phase 永遠停在
// "complete"，這行每幀都會把 "guidedGameplay" 設回 false，跟露比事件自己
// 想維持的 true 打架（誰的呼叫在那一幀比較晚跑誰贏，行為不穩定）。開一個
// 獨立的鍵，不跟木匠事件共用，兩邊互不干擾——跟這個檔案原本 "storyEvent"
// 不沿用 "event" 是同一個理由（見上面那段註解）。
export type TimePauseSource =
  | "event"
  | "inventory"
  | "interior"
  | "menu"
  | "storyEvent"
  | "guidedGameplay"
  | "rubyEvent";

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
    activeSources.has("storyEvent") ||
    isLegacyPauseEnabled()
  );
}

export function getTimePauseSources() {
  syncAutomaticPauseSources();
  return [...activeSources];
}