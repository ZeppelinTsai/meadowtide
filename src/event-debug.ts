import { gameState, inventory, WEATHER_NAMES, dayLength, TIME_CONFIG } from "./game-state";
import { MAPS, botanistQuest, oceanographerQuest, carpenterQuest, artistQuest, chefQuest, ARTIST_EVENT_WAIT_POS } from "./layout-maps";
import { captureGameSnapshot, restoreGameSnapshot, keys } from "./input-save";
import { getStoryEvent, listStoryEvents } from "./story/story-registry";
import { storyState } from "./story/story-state";
import { runStoryEvent } from "./story/story-runner";
import { createStoryRuntimeAdapter } from "./story/story-runtime-adapter";
import { createBrowserStoryRuntimeBindings } from "./story/story-runtime-browser";
import { setEventDebugSession, setEventDebugMenuOpen } from "./event-debug-state";
import { getRelationship, relationships } from "./affection";
import { npcs } from "./npc-runtime";
import { eventClockMoment } from "./event-clock-core";
import { lockEventClock } from "./event-clock";
import { loadMap } from "./build-map";
import { startPrologueScene, isPrologueActive, canQuickSaveDuringPrologue } from "./prologue";
import { startDayTwoMorningEvent, resetDayTwoMorningEvent, dayTwoMorningEvent, handleArtistWaitTouch } from "./day2-morning-event";
import { startDayThreeMorningEvent, resetBotanistEvent } from "./day3-morning-event";
import { startOceanographerEvent, resetOceanographerEvent } from "./oceanographer-event";
import { startChefDockScene, startChefHouseScene, startChefMoveInScene } from "./chef-quest";
import { startCarpenterMoveInScene } from "./carpenter-quest";
import { dialogQueue, activeChoice } from "./dialogue";
import { showLoadingScreen, hideLoadingScreen } from "./loading-screen";
import { setTimePauseSource } from "./time-pause";
import { handleUiFocusKeyDown, registerUiFocusRoot } from "./ui-focus-navigation";
import { parseDebugCommand, prepareDebugSnapshot, DEBUG_CATEGORIES } from "./event-debug-core";
import type { StoryEvent } from "./story/story-types";

const SESSION_KEY = "meadowtide.event-debug.session.v1";
type Snapshot = ReturnType<typeof captureGameSnapshot>;
type Session = { snapshot: Snapshot | null; eventId?: string; auto: boolean; restore?: boolean; command?: string };
let session: Session | null = null;
let menu: HTMLElement;
let output: HTMLElement;
let eventList: HTMLElement;
let autoInput: HTMLInputElement;
let filter = "all";
let selectedId = "";
let loading = false;

function report(message: string) {
  output.textContent = message;
  console.info("[Event Debug] " + message);
}
function persistAndReload(next: Session) {
  // Write successfully before changing anything; quota/storage failures keep the current game intact.
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  location.reload();
}
function baseline(): Snapshot | null {
  if (session) return session.snapshot;
  if (gameState.titlePresentationActive || !gameState.player) return null;
  if (gameState.cutsceneActive || dialogQueue.length || activeChoice ||
      (isPrologueActive() && !canQuickSaveDuringPrologue()) ||
      (dayTwoMorningEvent.phase !== "idle" && dayTwoMorningEvent.phase !== "complete") ||
      ["intro", "gatheringFlowers", "returning"].includes(artistQuest.stage) ||
      botanistQuest.stage === "intro" || oceanographerQuest.stage === "intro") {
    throw new Error("請等目前演出結束或回到安全存檔階段，再開始測試。");
  }
  return structuredClone(captureGameSnapshot());
}
function play(eventId: string, auto = true) {
  if (!getStoryEvent(eventId)) throw new Error("未知事件 ID：" + eventId);
  persistAndReload({ snapshot: baseline(), eventId, auto });
}
function restore() {
  if (!session) { report("目前沒有測試快照。"); return; }
  persistAndReload({ ...session, restore: true, command: undefined });
}
async function warp(mapId: string) {
  if (!Object.prototype.hasOwnProperty.call(MAPS, mapId)) throw new Error("未知地點：" + mapId);
  await showLoadingScreen();
  try { await new Promise<void>(resolve => loadMap(mapId, MAPS[mapId].playerStart, resolve)); }
  finally { await hideLoadingScreen(); }
}
async function execute(command: string) {
  const parsed = parseDebugCommand(command);
  if (parsed.name === "help") {
    report("event.play <id> [auto|ignore]；time.set HH:MM；date.set <第幾天，從1起>；warp <mapId>；affection.set <npcId> <0–800>；flag.set <id> <true|false>；weather.set <id>；snapshot.restore；event.list；location.list"); return;
  }
  if (parsed.name === "event.list") { report(listStoryEvents().map(e => `${e.id} — ${e.title}`).join("\n")); return; }
  if (parsed.name === "location.list") { report(Object.keys(MAPS).join("\n")); return; }
  if (parsed.name === "snapshot.restore") { restore(); return; }
  if (parsed.name === "event.play") { play(parsed.args[0], parsed.args[1] !== "ignore"); return; }
  if (parsed.name === "warp" && !Object.prototype.hasOwnProperty.call(MAPS, parsed.args[0])) throw new Error("未知地點：" + parsed.args[0]);
  if (parsed.name === "affection.set" && !npcs.some(n => n.id === parsed.args[0])) throw new Error("未知角色：" + parsed.args[0]);
  if (parsed.name === "weather.set" && !Object.prototype.hasOwnProperty.call(WEATHER_NAMES, parsed.args[0])) throw new Error("未知天氣：" + parsed.args[0]);
  if (!session) { persistAndReload({ snapshot: baseline(), auto: false, command }); return; }
  if (loading) throw new Error("場景載入中，請稍候。");
  switch (parsed.name) {
    case "time.set": { const [h, m] = parsed.args[0].split(":").map(Number); lockEventClock(gameState.currentDay, h + m / 60); break; }
    case "date.set": lockEventClock(Number(parsed.args[0]) - 1, gameState.currentPhase * 24); break;
    case "warp": await warp(parsed.args[0]); break;
    case "affection.set": getRelationship(parsed.args[0]).points = Number(parsed.args[1]); break;
    case "flag.set": storyState.flags[parsed.args[0]] = parsed.args[1] === "true"; break;
    case "weather.set": gameState.currentWeather = parsed.args[0]; gameState.previousWeather = parsed.args[0]; break;
  }
  report("已套用（僅測試狀態）：" + command);
}
function safely(action: () => unknown) {
  Promise.resolve().then(action).catch(error => { console.error("[Event Debug]", error); report(String(error.message || error)); });
}
function toggle(open = !menu.classList.contains("open")) {
  menu.classList.toggle("open", open);
  menu.hidden = !open;
  setEventDebugMenuOpen(open);
  menu.dataset.gameMenu = open ? "open" : "closed";
  for (const key of Object.keys(keys)) keys[key] = false;
  if (open) { renderEvents(); menu.querySelector<HTMLButtonElement>("button")?.focus(); }
}
function renderEvents() {
  eventList.replaceChildren();
  const events = listStoryEvents().filter(e => filter === "all" || (e.debug?.category || "special") === filter);
  if (!events.length) eventList.textContent = "目前沒有此分類的已實作事件。";
  for (const event of events) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${selectedId === event.id ? "▶ " : ""}${event.title} — ${event.id}`;
    button.setAttribute("aria-pressed", String(selectedId === event.id));
    button.onclick = () => {
      selectedId = event.id;
      report(`${event.summary}\n條件：${JSON.stringify(event.conditions)}${event.debug?.weather ? "；天氣：" + event.debug.weather : ""}`);
      eventList.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    };
    eventList.append(button);
  }
}
function createMenu() {
  registerUiFocusRoot("#eventDebugMenu.open");
  const style = document.createElement("style");
  style.textContent = `#eventDebugMenu{position:fixed;inset:3vh 3vw;z-index:100000;background:#172630;color:#fff;border:2px solid #bdd8cd;padding:20px;overflow:auto;font:18px/1.5 sans-serif}#eventDebugMenu[hidden]{display:none}#eventDebugMenu *{box-sizing:border-box;font-size:18px}#eventDebugMenu button,#eventDebugMenu input{font:inherit;padding:10px;background:#294653;color:white;border:1px solid #adc5c9}#eventDebugMenu button{cursor:pointer;text-align:left}#eventDebugMenu button:focus-visible,#eventDebugMenu input:focus-visible{outline:3px solid #ffe398;outline-offset:2px}#eventDebugMenu button[aria-pressed=true]{background:#546237}#eventDebugMenu .debug-row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}#eventDebugEvents{display:grid;gap:8px}#eventDebugOutput{white-space:pre-wrap;overflow-wrap:anywhere}#eventDebugCommand{width:100%}#eventDebugBadge{position:fixed;top:0;left:0;z-index:99999;background:#493425;color:#fff;padding:8px;font:18px sans-serif}`;
  document.head.append(style);
  menu = document.createElement("section"); menu.id = "eventDebugMenu"; menu.hidden = true;
  menu.setAttribute("role", "dialog"); menu.setAttribute("aria-label", "Event Debug Menu"); menu.setAttribute("aria-modal", "true");
  menu.innerHTML = `<div class="debug-row"><strong>Event Debug Menu · F9</strong><button id="eventDebugClose">關閉</button><button id="eventDebugRestore">還原快照／結束測試</button></div><p>測試中不寫入一般存檔。重播會重新載入快照；結束測試回到測試前進度。Day 7 賞櫻／夜港尚未實作。</p><div id="eventDebugFilters" class="debug-row"></div><div id="eventDebugEvents"></div><div class="debug-row"><label><input id="eventDebugAuto" type="checkbox" checked> 自動套用前置条件（取消＝忽略門檻；手刻演出仍保留內建時間／場地）</label><button id="eventDebugPlay">立即播放／重新播放</button></div><form id="eventDebugForm"><label for="eventDebugCommand">Console 指令（help 查看用法）</label><input id="eventDebugCommand" autocomplete="off" placeholder="event.play main.day2.arrivals auto"><button type="submit">執行指令</button></form><pre id="eventDebugOutput" role="status" aria-live="polite"></pre>`;
  document.body.append(menu);
  output = document.getElementById("eventDebugOutput")!;
  eventList = document.getElementById("eventDebugEvents")!;
  autoInput = document.getElementById("eventDebugAuto") as HTMLInputElement;
  const filters = document.getElementById("eventDebugFilters")!;
  for (const [id, title] of Object.entries(DEBUG_CATEGORIES)) {
    const b = document.createElement("button"); b.textContent = title; b.onclick = () => { filter = id; renderEvents(); }; filters.append(b);
  }
  document.getElementById("eventDebugClose")!.onclick = () => toggle(false);
  document.getElementById("eventDebugRestore")!.onclick = () => safely(restore);
  document.getElementById("eventDebugPlay")!.onclick = () => safely(() => play(selectedId, autoInput.checked));
  document.getElementById("eventDebugForm")!.onsubmit = e => { e.preventDefault(); safely(() => execute((document.getElementById("eventDebugCommand") as HTMLInputElement).value)); };
  // Capture at document before legacy bubble shortcuts; leave shared arrow navigation active.
  document.addEventListener("keydown", e => {
    if (e.key === "F9") { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) toggle(); return; }
    if (e.key === "F10" && !menu.classList.contains("open")) { e.preventDefault(); e.stopImmediatePropagation(); safely(() => play("dev.carpenter_dock_intro_draft")); return; }
    if (!menu.classList.contains("open")) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); toggle(false); return; }
    if (e.key.startsWith("Arrow")) handleUiFocusKeyDown(e);
    e.stopPropagation();
  }, true);
  // Mouse clicks in the overlay cannot trigger world interactions.
  menu.addEventListener("pointerdown", e => e.stopPropagation());
  selectedId = session?.eventId || listStoryEvents()[0]?.id || "";
  (window as any).eventDebug = { run: (command: string) => execute(command), play, restore, list: listStoryEvents };
  if (session) {
    const badge = document.createElement("button"); badge.id = "eventDebugBadge"; badge.textContent = "事件測試中 · F9 · 不寫入存檔"; badge.onclick = () => toggle(); document.body.append(badge);
  }
}
async function runSelected(event: StoryEvent, auto: boolean) {
  report("播放中：" + event.title);
  if (auto && event.debug?.weather) gameState.currentWeather = event.debug.weather;
  switch (event.id) {
    case "main.prologue.arrival":
      await warp("port"); startPrologueScene({ force: true, loadMap }); return;
    case "main.day2.arrivals": resetDayTwoMorningEvent(); startDayTwoMorningEvent(); return;
    case "character.botanist.arrival": resetBotanistEvent(); botanistQuest.stage = "not_started"; startDayThreeMorningEvent(); return;
    case "character.oceanographer.arrival": resetOceanographerEvent(); oceanographerQuest.stage = "not_started"; startOceanographerEvent(); return;
    case "character.artist.personal":
      artistQuest.stage = "waiting_oldVillage";
      await new Promise<void>(resolve => loadMap("oldVillage", ARTIST_EVENT_WAIT_POS, resolve));
      handleArtistWaitTouch(); return;
    case "character.chef.arrival": startChefDockScene(); return;
    case "character.chef.house": startChefHouseScene(); return;
    case "character.chef.movein": startChefMoveInScene(); return;
    case "character.carpenter.legacy_movein": startCarpenterMoveInScene(); return;
  }
  if (event.execution === "external") throw new Error("此手刻事件尚未接上測試入口：" + event.id);
  gameState.cutsceneActive = true;
  try {
    // Clone only the trigger gate: original steps, choices and rewards remain untouched.
    await runStoryEvent({ ...event, once: false, conditions: [] }, {
      mapId: gameState.currentMapName, day: gameState.currentDay, season: gameState.currentSeason,
      phase: gameState.currentPhase, relationships: Object.fromEntries(Object.entries(relationships).map(([id,r]) => [id,r.points])), inventory: Object.fromEntries(Object.entries(inventory).filter((entry): entry is [string, number] => typeof entry[1] === "number")),
    }, createStoryRuntimeAdapter(createBrowserStoryRuntimeBindings()), { allowManual: true });
    report("播放完成，可按 F9 重播：" + event.id);
  } finally {
    gameState.cutsceneActive = false; setTimePauseSource("storyEvent", false);
    await hideLoadingScreen();
  }
}

/** Returns true when a snapshot/test session replaces the normal title boot. */
export async function initEventDebug(): Promise<boolean> {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (raw) session = JSON.parse(raw);
  setEventDebugSession(Boolean(session));
  createMenu();
  if (!session) return false;
  if (session.restore && !session.snapshot) { sessionStorage.removeItem(SESSION_KEY); session = null; setEventDebugSession(false); document.getElementById("eventDebugBadge")?.remove(); return false; }
  loading = true;
  let launch: (() => unknown) | undefined;
  await showLoadingScreen();
  document.getElementById("titleScreen")!.classList.add("titleScreen--hidden");
  gameState.titlePresentationActive = false;
  document.body.classList.remove("title-presentation");
  try {
    const snapshot = structuredClone(session.snapshot || captureGameSnapshot());
    const event = session.eventId ? getStoryEvent(session.eventId) : undefined;
    if (!session.restore) {
      prepareDebugSnapshot(snapshot, event, session.auto, TIME_CONFIG.daysPerSeason);
      snapshot.elapsed = eventClockMoment(snapshot.currentDay, snapshot.currentPhase * 24, dayLength).elapsed;
    }
    await new Promise<void>(resolve => restoreGameSnapshot(snapshot, { initializeTargetMap: true, onRestored: resolve, preserveSnapshot: true }));
    if (session.restore) {
      sessionStorage.removeItem(SESSION_KEY); session = null; setEventDebugSession(false); document.getElementById("eventDebugBadge")?.remove(); report("已還原測試前進度。");
    } else {
      const command = session.command;
      // One-shot boot request, retained eventId enables repeated replay after manual refresh.
      if (command) { session.command = undefined; sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
      loading = false;
      if (event) launch = () => runSelected(event, session!.auto);
      else if (command) launch = () => execute(command);
    }
  } catch (error) { report("測試啟動失敗，可用 F9 還原快照：" + error); toggle(true); }
  finally { loading = false; await hideLoadingScreen(); }
  if (launch) safely(launch);
  return true;
}
