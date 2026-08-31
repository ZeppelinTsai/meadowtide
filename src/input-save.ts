import { executeContextInteraction, consumeLegacyPrimaryBypass, consumeLegacySecondaryBypass } from "./context-interaction-ui";
import { isPrimaryInteractionKey } from "./context-interaction";
import { exportAnimalInteractionState, restoreAnimalInteractionState } from "./animal-interactions";
import {
  gameState,
  inventory,
  cropState,
  TIME_CONFIG,
  SEASON_NAMES,
  WEATHER_NAMES,
  getSeasonDay,
  getSeasonPeriod,
  METEOR_SHOWER_SCHEDULE,
  rollWeatherForSeason,
  growCropsForNewDay,
  nearWater,
  plantSeed,
  harvestCrop,
  CAST_ANIM_DURATION,
  isOysterRackInteractionTile,
  setOysterRackSlots,
  oysterRackState,
  harvestOysterRack,
  FEEDER_VISUAL,
  FEEDER_CAPACITY,
  harvestPastureGrass,
  hasTool,
  pastureDepletedTiles,
  WOOD_NODES,
  STONE_NODES,
  harvestGatherNode,
  refreshGatherNodes,
  cookMeal,
} from "./game-state";
import { updateSeasonAndDate } from "./game-clock";
import { getLocale, translateText } from "./i18n";
import {
  FishTierDef,
  FishTierKey,
  FISH_TIERS,
  actualQteCount,
  buildQteSequence,
  judgeDirectionPress,
  tensionDeltaFor,
  TENSION_MAX,
  TENSION_DELTA,
  QteDirection,
  QteEvent,
} from "./fishing";
import {
  vibrateGamepad,
  FISHING_HAPTICS,
  vibrateFishingHaptic,
  vibrateDirectionalPull,
  vibrateRushSpin,
} from "./gamepad-haptics";
import {
  ORE_NODES,
  harvestOreNode,
  MOUNTAIN_ORE_NODES,
  harvestMountainOreNode,
} from "./mine";
import {
  playRandomSfx,
  CHOP_WOOD_SFX,
  MINE_ORE_SFX,
  FISH_CAST_SFX,
  FISH_REEL_SFX,
} from "./sfx";
import {
  carpenterQuest,
  FARMLAND_TILES,
  chefQuest,
  REST_CHAIR,
  MAPS,
} from "./layout-maps";
import { tryShareChefMeal, mergeChefMealIntoChatLine } from "./chef-quest";
import {
  isPrologueFishingTutorialActive,
  previewPrologue,
  reportPrologueFishingFailure,
  reportPrologueFishingSuccess,
} from "./prologue";
import {
  isFirstPersonModeActive,
  recordFirstPersonCameraShot,
  toggleFirstPersonMode,
} from "./first-person-camera";
import {
  beginCameraAdjustMode,
  endCameraAdjustMode,
  isCameraAdjustModeActive,
  recordCameraAdjustShot,
} from "./cutscene-camera";
import { animalGroup, animals, npcGroup, npcs } from "./npc-runtime";
import { npcLine } from "./npc-defs";
import {
  dialogQueue,
  advanceDialogSequence,
  showDialog,
  showDialogSequence,
  dialogEl,
  activeChoice,
  handleChoiceDigitKey,
  advanceChoicePage,
} from "./dialogue";
import { loadMap, isBlocked, events, syncPlayerAppearance } from "./build-map";
import { isInventoryOpen } from "./inventory-ui";
import {
  updateAvenueTreeColors,
  updateSeasonalTreeColors,
  updateSeasonalGroundColors,
  makeBobber,
  makeFishProp,
  makeChipDebris,
  makeOreChipDebris,
} from "./props";
import { syncFarmVisuals } from "./farm-visuals";
import {
  exportRelationships,
  getRelationship,
  restoreRelationships,
} from "./affection";
import { completeNpcDailyConversation } from "./affection-ui";
import { weatherIconSvg } from "./weather-icons";
import { SAVE_SLOT_COUNT, saveSlotForDigitCode } from "./save-slot-config";
import { exportStoryState, restoreStoryState } from "./story/story-state";
import {
  exportNpcNameRevealState,
  restoreNpcNameRevealState,
} from "./npc-name-reveal";
import {
  scene,
  renderer,
  clearMeteors,
  scheduleNextMeteor,
  updateCameraFrustum,
  meteorPool,
  getMeteorShowerHudLabel,
  groundY,
} from "./scene-sky";
import {
  gatherNodeMeshes,
  oreNodeMeshes,
  setThresholdMarkersVisible,
} from "./scene-registries";

export const SAVE_KEY_PREFIX = "meadowtide.save.";
// 手動存檔共 10 格：slot 參數為 "slot1".."slot10"，"default" 是
// 舊版單一存檔的名字，只留給 migrateLegacyDefaultSave() 讀一次搬家用，
// 新程式碼不應該再直接寫 "default"。
export { SAVE_SLOT_COUNT } from "./save-slot-config";

// 「目前在玩哪一格」——決定 Shift+數字快速存檔沒指定格數時(目前沒有這種
// 用法，但保留擴充彈性)跟每日 06:00 自動存檔要存進哪一格。開新遊戲/讀取
// 某一格都會呼叫 setActiveSaveSlot() 更新；預設 1 是給「還沒真的選過
// 存檔格」的情況兜底(目前開新遊戲固定用第 1 格，還沒有讓玩家開局選格數
// 的介面，見 docs/decisions/save-slots.md)。
let activeSaveSlot = 1;
export function getActiveSaveSlot() {
  return activeSaveSlot;
}
export function setActiveSaveSlot(slot: number) {
  activeSaveSlot = Math.min(SAVE_SLOT_COUNT, Math.max(1, Math.round(slot) || 1));
}

// 舊版只有一個 "default" 存檔；多格系統上線後只讀一次，把裡面的內容
// 搬進第 1 格，搬完就刪掉舊 key——之後只認 autosave/slot1..slot10，
// 不會有兩份資料同時存在造成「到底哪份才是最新」的疑惑。呼叫端要在任何
// 讀 slot 資料之前先呼叫這個(目前只有 title-screen.ts 的
// initTitleScreen() 開局呼叫一次)。
export function migrateLegacyDefaultSave() {
  try {
    const legacyKey = SAVE_KEY_PREFIX + "default";
    const slot1Key = SAVE_KEY_PREFIX + "slot1";
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null && localStorage.getItem(slot1Key) === null) {
      localStorage.setItem(slot1Key, legacy);
      localStorage.removeItem(legacyKey);
      console.info("[存檔] 舊版存檔已搬進第 1 格。");
    }
  } catch (err) {
    // localStorage 不可用(例如無痕模式擋掉)時安靜放棄，不要打斷開局。
  }
}

export interface SaveSlotSummary {
  saveName: string;
  slot: number | null;
  sourceSlot: number;
  isAutosave: boolean;
  exists: boolean;
  currentDay?: number;
  currentSeason?: number;
  currentMapName?: string;
  playerName?: string;
}

export interface TitlePreviewTime {
  currentDay: number;
  currentSeason: number;
  currentPhase: number;
  currentWeather: string;
  elapsed: number;
}

export function getTitlePreviewTime(): TitlePreviewTime {
  if (gameState.player) return {
    currentDay: gameState.currentDay,
    currentSeason: gameState.currentSeason,
    currentPhase: gameState.currentPhase,
    currentWeather: gameState.currentWeather,
    elapsed: gameState.elapsed,
  };
  let latest: (TitlePreviewTime & { savedAt: number }) | null = null;
  for (const saveName of ["autosave", ...Array.from({ length: SAVE_SLOT_COUNT }, (_, i) => "slot" + (i + 1))]) {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + saveName);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const candidate = {
        currentDay: Number(data.currentDay) || 0,
        currentSeason: Number(data.currentSeason) || 0,
        currentPhase: Number(data.currentPhase) || 0,
        currentWeather: data.currentWeather || "clear",
        elapsed: Number(data.elapsed) || 0,
        savedAt: Number(data.savedAt) || Number(data.elapsed) || 0,
      };
      if (!latest || candidate.savedAt > latest.savedAt) latest = candidate;
    } catch {}
  }
  return latest ?? { currentDay: 0, currentSeason: 0, currentPhase: 10 / 24, currentWeather: "clear", elapsed: 0 };
}

// 給共用讀取清單使用：autosave 與 10 格手動存檔各自有沒有資料、摘要(第幾天/
// 季節/在哪張地圖)。故意不讀 elapsed 算到分鐘，摘要只求一眼看出「這格
// 大概是哪次進度」，不是精確時間戳記。
export function getSaveSlotSummaries(): SaveSlotSummary[] {
  const summaries: SaveSlotSummary[] = [];
  const targets = [
    { saveName: "autosave", slot: null, isAutosave: true },
    ...Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => ({
      saveName: "slot" + (index + 1),
      slot: index + 1,
      isAutosave: false,
    })),
  ];
  targets.forEach((target) => {
    const raw = localStorage.getItem(SAVE_KEY_PREFIX + target.saveName);
    if (!raw) {
      summaries.push({
        ...target,
        sourceSlot: target.slot ?? 1,
        exists: false,
      });
      return;
    }
    try {
      const data = JSON.parse(raw);
      summaries.push({
        ...target,
        sourceSlot: Math.min(
          SAVE_SLOT_COUNT,
          Math.max(1, Number(data.activeSaveSlot) || target.slot || 1),
        ),
        exists: true,
        currentDay: Number(data.currentDay) || 0,
        currentSeason: Number(data.currentSeason) || 0,
        currentMapName: data.currentMapName || "livingArea",
        playerName:
          typeof data.playerProfile?.name === "string" && data.playerProfile.name.trim()
            ? data.playerProfile.name.trim().slice(0, 16)
            : "牧場主",
      });
    } catch (err) {
      summaries.push({
        ...target,
        sourceSlot: target.slot ?? 1,
        exists: false,
      });
    }
  });
  return summaries;
}

export function saveGame(slot = "default") {
  npcs.forEach((npc) => getRelationship(npc.id));
  const data = {
    version: 14,
    savedAt: Date.now(),
    playerProfile: {
      name: gameState.playerName,
      appearance: gameState.playerAppearance,
    },
    activeSaveSlot,
    elapsed: gameState.elapsed,
    currentDay: gameState.currentDay,
    currentPhase: gameState.currentPhase,
    currentSeason: gameState.currentSeason,
    currentWeather: gameState.currentWeather,
    weatherSchedules: JSON.parse(JSON.stringify(gameState.weatherSchedules)),
    currentMapName: gameState.currentMapName,
    player: gameState.player
      ? {
          x: gameState.player.position.x,
          z: gameState.player.position.z,
          facing: gameState.facing,
        }
      : null,
    inventory: JSON.parse(JSON.stringify(inventory)),
    ownedAnimals: [...(gameState.ownedAnimals || [])],
    animalInteractions: exportAnimalInteractionState(),
    crops: JSON.parse(JSON.stringify(cropState)),
    npcMemory: npcs.map((npc) => ({ id: npc.id, memory: npc.memory })),
    relationships: exportRelationships(),
    story: exportStoryState(),
    npcNameRevealStages: exportNpcNameRevealState(),
    carpenterQuest: { ...carpenterQuest },
    oysterRackState: JSON.parse(JSON.stringify(oysterRackState)),
    oysterRackSlots: gameState.oysterRackSlots,
    feederUnits: gameState.feederUnits,
    pastureGrazeSettledDay: gameState.pastureGrazeSettledDay,
    pastureGrazedToday: gameState.pastureGrazedToday,
    feederSettledDay: gameState.feederSettledDay,
    pastureDepletedTiles: { ...pastureDepletedTiles },
    gatherSpawnSlot: gameState.gatherSpawnSlot,
    woodNodes: JSON.parse(JSON.stringify(WOOD_NODES)),
    stoneNodes: JSON.parse(JSON.stringify(STONE_NODES)),
    // 洞窟樓層+礦石節點——不像 woodNodes/stoneNodes 有「刷新時段」欄位，
    // 單純存目前樓層跟該層的採集狀態；讀檔時只還原資料，實際地磚/模型
    // 由 loadMap() 的 regenerateMineFloor() 保險呼叫重新生成(見
    // build-map.ts)，這裡不用另外存 tiles。
    mineFloor: gameState.mineFloor,
    oreNodes: JSON.parse(JSON.stringify(ORE_NODES)),
    // 山之洞是完全獨立的一組狀態(見 mine.ts 該段開頭註解)，樓層/礦點
    // 分開存，互不影響鐘乳石洞窟那份。
    mountainMineFloor: gameState.mountainMineFloor,
    mountainOreNodes: JSON.parse(JSON.stringify(MOUNTAIN_ORE_NODES)),
  };
  localStorage.setItem(SAVE_KEY_PREFIX + slot, JSON.stringify(data));
  return data;
}

function legacyKnownNpcIds(data: any): string[] {
  const ids = new Set<string>();
  const completedEvents = Array.isArray(data.story?.completedEvents)
    ? data.story.completedEvents
    : [];
  if (
    completedEvents.includes("main.prologue.arrival") ||
    (Number(data.currentDay) || 0) > 0
  ) {
    ids.add("mayor");
    ids.add("captain");
  }
  if (data.carpenterQuest?.stage && data.carpenterQuest.stage !== "not_started") {
    ids.add("carpenter");
  }
  if (data.chefQuest?.stage && data.chefQuest.stage !== "not_started") {
    ids.add("chef");
  }
  return [...ids];
}
export function loadGame(
  slot = "default",
  options: { initializeTargetMap?: boolean } = {},
) {
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
  if (!raw) return false;
  const data = JSON.parse(raw);
  // v6 以前没有 story 栏位；restore 会补齐默认值，不让旧存档失效。
  restoreStoryState(data.story);
  restoreNpcNameRevealState(
    data.npcNameRevealStages,
    legacyKnownNpcIds(data),
  );
  gameState.playerName = typeof data.playerProfile?.name === "string" && data.playerProfile.name.trim()
    ? data.playerProfile.name.trim().slice(0, 16)
    : "牧場主";
  gameState.playerAppearance = data.playerProfile?.appearance === "male"
    ? "male"
    : "female";
  if (gameState.player) syncPlayerAppearance();
  gameState.elapsed = Math.max(0, Number(data.elapsed) || 0);
  updateSeasonAndDate();
  gameState.prevDay = gameState.currentDay;
  gameState.weatherSchedules = data.weatherSchedules || {};
  gameState.currentWeather =
    data.currentWeather ||
    rollWeatherForSeason(gameState.currentSeason, gameState.currentDay);
  const savedTools = data.inventory?.tools;
  Object.assign(inventory, data.inventory || {});
  inventory.tools = {
    wateringCan: typeof savedTools?.wateringCan === "boolean" ? savedTools.wateringCan : true,
    hoe: typeof savedTools?.hoe === "boolean" ? savedTools.hoe : true,
    dualAxe: typeof savedTools?.dualAxe === "boolean" ? savedTools.dualAxe : true,
    sickle: typeof savedTools?.sickle === "boolean" ? savedTools.sickle : true,
    fishingRod: typeof savedTools?.fishingRod === "boolean" ? savedTools.fishingRod : true,
    milker: typeof savedTools?.milker === "boolean" ? savedTools.milker : true,
    shears: typeof savedTools?.shears === "boolean" ? savedTools.shears : true,
    brush: typeof savedTools?.brush === "boolean" ? savedTools.brush : true,
  };
  inventory.pearls = {
    white: Math.max(0, Number(data.inventory?.pearls?.white) || 0),
    pink: Math.max(0, Number(data.inventory?.pearls?.pink) || 0),
    purple: Math.max(0, Number(data.inventory?.pearls?.purple) || 0),
    black: Math.max(0, Number(data.inventory?.pearls?.black) || 0),
    gold: Math.max(0, Number(data.inventory?.pearls?.gold) || 0),
  };
  inventory.storage = Object.fromEntries(
    Object.entries(data.inventory?.storage || {}).flatMap(([itemId, amount]) => {
      const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
      return safeAmount > 0 ? [[itemId, safeAmount]] : [];
    }),
  );
  if (data.inventory?.animalProducts) Object.assign(inventory.animalProducts, data.inventory.animalProducts);
  // ownedAnimals 加入前的舊存檔來自「六隻動物預設存在」版本；缺欄位時
  // 保留原有動物，只有新遊戲與明確存成空陣列的存檔維持零隻。
  gameState.ownedAnimals = Array.isArray(data.ownedAnimals)
    ? data.ownedAnimals.filter((id: unknown): id is string =>
        typeof id === "string" && animals.some((animal) => animal.id === id),
      )
    : animals.map((animal) => animal.id);
  animalGroup.visible =
    (data.currentMapName || "livingArea") === "livingArea" &&
    gameState.ownedAnimals.length > 0;
  animals.forEach((animal) => {
    animal.mesh.visible = gameState.ownedAnimals.includes(animal.id);
  });
  restoreAnimalInteractionState(data.animalInteractions);
  gameState.feederUnits = Number.isFinite(data.feederUnits)
    ? Math.max(0, Math.min(FEEDER_CAPACITY, data.feederUnits))
    : gameState.feederUnits;
  gameState.pastureGrazeSettledDay = Number.isFinite(
    data.pastureGrazeSettledDay,
  )
    ? data.pastureGrazeSettledDay
    : -1;
  gameState.pastureGrazedToday = Boolean(data.pastureGrazedToday);
  gameState.feederSettledDay = Number.isFinite(data.feederSettledDay)
    ? data.feederSettledDay
    : -1;
  Object.keys(pastureDepletedTiles).forEach(
    (key) => delete pastureDepletedTiles[key],
  );
  Object.assign(pastureDepletedTiles, data.pastureDepletedTiles || {});
  Object.keys(cropState).forEach((key) => delete cropState[key]);
  Object.assign(cropState, data.crops || {});
  (data.npcMemory || []).forEach((savedNpc) => {
    const npc = npcs.find((candidate) => candidate.id === savedNpc.id);
    if (npc) npc.memory = savedNpc.memory;
  });
  if (data.relationships) {
    restoreRelationships(data.relationships);
  } else {
    restoreRelationships(
      Object.fromEntries(
        (data.npcMemory || []).map((savedNpc) => [
          savedNpc.id,
          { points: Math.max(0, Number(savedNpc.memory) || 0) },
        ]),
      ),
    );
  }
  if (data.carpenterQuest) {
    Object.assign(carpenterQuest, data.carpenterQuest);
    if (carpenterQuest.stage === "en_route_village")
      carpenterQuest.stage = "escorting";
    const carpenterNpc = npcs.find((n) => n.id === "carpenter");
    if (carpenterNpc)
      carpenterNpc.mesh.visible =
        carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done" ||
        carpenterQuest.stage === "moved_in" ||
        ((carpenterQuest.stage === "construction" ||
          carpenterQuest.stage === "ready_for_move_in") &&
          data.currentMapName === "oldVillage");
    const escortMap =
      data.currentMapName === "port" || data.currentMapName === "oldVillage";
    npcGroup.visible =
      data.currentMapName === "livingArea" ||
      data.currentMapName === "oldVillage" ||
      ((carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
        escortMap);
    if (
      (carpenterQuest.stage === "escorting" ||
        carpenterQuest.stage === "village_scene_done") &&
      escortMap
    ) {
      const mayorNpc = npcs.find((n) => n.id === "mayor");
      if (mayorNpc) mayorNpc.mesh.visible = true;
    }
  }
  Object.keys(oysterRackState).forEach((key) => delete oysterRackState[key]);
  Object.assign(oysterRackState, data.oysterRackState || {});
  setOysterRackSlots(data.oysterRackSlots);
  if (Array.isArray(data.woodNodes) && Array.isArray(data.stoneNodes)) {
    gameState.gatherSpawnSlot = Number(data.gatherSpawnSlot);
    WOOD_NODES.splice(0, WOOD_NODES.length, ...data.woodNodes);
    STONE_NODES.splice(0, STONE_NODES.length, ...data.stoneNodes);
  } else {
    refreshGatherNodes(true);
  }
  gameState.mineFloor = Number.isFinite(data.mineFloor) ? data.mineFloor : 1;
  if (Array.isArray(data.oreNodes)) {
    ORE_NODES.splice(0, ORE_NODES.length, ...data.oreNodes);
  }
  gameState.mountainMineFloor = Number.isFinite(data.mountainMineFloor)
    ? data.mountainMineFloor
    : 1;
  if (Array.isArray(data.mountainOreNodes)) {
    MOUNTAIN_ORE_NODES.splice(
      0,
      MOUNTAIN_ORE_NODES.length,
      ...data.mountainOreNodes,
    );
  }
  const finishRestoringVisualState = () => {
    updateAvenueTreeColors();
    updateSeasonalTreeColors();
    updateSeasonalGroundColors();
    growCropsForNewDay();
    syncFarmVisuals();
    clearMeteors();
    scheduleNextMeteor(true);
    updateHud();
  };

  // 標題畫面讀檔時尚未建立玩家或正式場景，必須走完整的 loadMap 流程。
  // 只呼叫 buildMap 會留下 player=null，遊戲迴圈便會持續顯示黑畫面。
  if (options.initializeTargetMap) {
    const targetMap = data.currentMapName || "livingArea";
    const restoredPosition = data.player || MAPS[targetMap].playerStart;
    if (data.player) gameState.facing = data.player.facing || gameState.facing;
    loadMap(targetMap, restoredPosition, finishRestoringVisualState);
    return true;
  }
  if (data.player) {
    const targetMap = data.currentMapName || "livingArea";
    if (targetMap !== gameState.currentMapName) {
      loadMap(targetMap, { x: data.player.x, z: data.player.z });
    } else if (gameState.player) {
      const savedPositionIsBlocked = collidesAt(
        targetMap,
        data.player.x,
        data.player.z,
      );
      const restoredPosition = savedPositionIsBlocked
        ? MAPS[targetMap].playerStart
        : data.player;
      gameState.player.position.x = restoredPosition.x;
      gameState.player.position.z = restoredPosition.z;
      gameState.playerGridPos = {
        x: Math.round(restoredPosition.x),
        z: Math.round(restoredPosition.z),
      };
    }
    gameState.facing = data.player.facing || gameState.facing;
    if (
      carpenterQuest.stage === "escorting" ||
      carpenterQuest.stage === "village_scene_done"
    ) {
      // 跟 build-map.ts loadMap() 的 escort 重置邏輯一致：疊在主角腳下、
      // 用主角當下算好的世界座標 Y，不要用側邊固定偏移 + 寫死 y=0
      // （那組數字跟地形無關，讀檔一進 oldVillage/port 就會穿模）。
      const mayorNpc = npcs.find((n) => n.id === "mayor");
      const carpenterNpc = npcs.find((n) => n.id === "carpenter");
      if (mayorNpc)
        mayorNpc.mesh.position.set(
          data.player.x,
          gameState.player.position.y,
          data.player.z,
        );
      if (carpenterNpc)
        carpenterNpc.mesh.position.set(
          data.player.x,
          gameState.player.position.y,
          data.player.z,
        );
    }
  }
  finishRestoringVisualState();
  return true;
}
(window as any).saveGame = saveGame;
(window as any).loadGame = loadGame;
addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !event.repeat) {
    event.preventDefault();
    toggleFirstPersonMode();
  } else if (event.key === "F8") {
    // 序幕(開場第一天演出)預覽熱鍵——不清存檔也能重播，見 prologue.ts。
    // 只能在已經站在港口地圖時使用，因為演出要借用 makePortScene() 蓋
    // 好的渡輪/跳板參照(prologueRefs)，還沒進過港口地圖就不會有。
    event.preventDefault();
    if (gameState.currentMapName !== "port") {
      console.warn("[序幕預覽] 請先走到港口地圖再按 F8 重播開場");
    } else {
      previewPrologue();
    }
  } else if (event.key === "F4") {
    // 鏡頭調整模式(cutscene-camera.ts)——開發用，方向鍵平移鏡頭焦點、
    // 滾輪/雙指照舊縮放，C 鍵記一顆鏡頭，再按一次 F4 關閉。搭配 F8
    // 重播序幕，邊看畫面邊試鏡頭構圖。
    event.preventDefault();
    if (!gameState.player) return;
    if (isCameraAdjustModeActive()) {
      endCameraAdjustMode();
      updateCameraFrustum();
    } else {
      beginCameraAdjustMode(
        gameState.player.position.x,
        gameState.player.position.z,
      );
    }
  } else if (event.key.toLowerCase() === "c") {
    if (isCameraAdjustModeActive()) {
      event.preventDefault();
      recordCameraAdjustShot();
    } else if (isFirstPersonModeActive()) {
      event.preventDefault();
      recordFirstPersonCameraShot();
    }
  }
});

// Shift+1~9 存到第 1~9 格，Shift+0 存到第 10 格；不按 Shift 直接讀取。
// 用 event.code 判斷 Digit0..Digit9，避免 Shift 改變 event.key。跟二選一提示的數字鍵
// 選項共用同一批鍵位，靠 activeChoice/dialogQueue/isInventoryOpen 這三個
// 既有守衛擋開，對話框開著時數字鍵照舊只選對話選項，不會誤觸存讀檔；
// cutsceneActive 期間也擋掉，過場演出中不該被存讀檔打斷。讀檔沒有二次
// 確認——Zeppelin 明確要求「直接讀」，不要跳確認框。
addEventListener("keydown", (event) => {
  const slotNum = saveSlotForDigitCode(event.code);
  if (slotNum === null) return;
  if (
    !gameState.player ||
    gameState.titlePresentationActive ||
    gameState.cutsceneActive ||
    isInventoryOpen() ||
    dialogQueue.length ||
    activeChoice
  )
    return;
  event.preventDefault();
  if (event.shiftKey) {
    setActiveSaveSlot(slotNum);
    saveGame("slot" + slotNum);
    console.info(`[存檔] 已儲存到第 ${slotNum} 格`);
  } else {
    const ok = loadGame("slot" + slotNum);
    if (ok) {
      setActiveSaveSlot(slotNum);
      console.info(`[讀檔] 已載入第 ${slotNum} 格`);
    } else {
      console.info(`[讀檔] 第 ${slotNum} 格沒有存檔`);
    }
  }
});

export const keys = {};
addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

function releaseAllGameplayKeys() {
  Object.keys(keys).forEach((key) => (keys[key] = false));
  gameState.ePressed = false;
}
addEventListener("blur", releaseAllGameplayKeys);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAllGameplayKeys();
});

addEventListener("keydown", (event) => {
  if (gameState.cutsceneActive) return;
  if (event.key.toLowerCase() === "r" && !event.repeat && !consumeLegacySecondaryBypass() && executeContextInteraction("secondary")) { event.preventDefault(); return; }
  if (
    event.key.toLowerCase() !== "r" ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    isInventoryOpen() ||
    dialogQueue.length ||
    activeChoice ||
    gameState.currentMapName !== "livingArea" ||
    !hasTool("sickle")
  )
    return;
  event.preventDefault();
  const { x, z } = gameState.playerGridPos;
  const result = harvestPastureGrass(x, z);
  if (result === "not-grass") return;
  gameState.harvestFeedback =
    result === "harvested"
      ? {
          kind: "success",
          title: "收割牧草",
          text:
            "投餵機 +1（" +
            gameState.feederUnits +
            "／" +
            FEEDER_CAPACITY +
            "）",
          until: gameState.elapsed + 2.6,
        }
      : {
          kind: "empty",
          title: result === "feeder-full" ? "投餵機已滿" : "牧草生長中",
          text:
            result === "feeder-full"
              ? "目前存量：99／99"
              : "收割後需要三天長回來",
          until: gameState.elapsed + 2.6,
        };
});
// 二選一提示的數字鍵選擇/翻頁——跟上面 E 鍵/WASD 分開一個監聽，純粹只
// 在 activeChoice 有值時吃鍵，其他時候完全不影響移動/互動。數字鍵選當前
// 頁看到的選項；選項超過一頁(CHOICE_PAGE_SIZE=3)時 Tab 鍵循環翻頁——
// preventDefault 是因為 Tab 預設會把瀏覽器焦點移出畫布，會讓後續鍵盤
// 輸入吃不到。
addEventListener("keydown", (event) => {
  if (gameState.cutsceneActive) return;
  if (event.key.toLowerCase() === "f" && !event.repeat && !event.ctrlKey && !event.metaKey && executeContextInteraction("tertiary")) event.preventDefault();
});

addEventListener("keydown", (e) => {
  if (handleChoiceDigitKey(e.key)) {
    e.preventDefault();
    return;
  }
  if (e.key === "Tab" && activeChoice) {
    if (advanceChoicePage()) e.preventDefault();
  }
});
// 2026-08-27：Zeppelin 反饋鏡頭調整模式(F4)能拉近的極限不夠，希望至少
// 跟第一人稱(first-person-camera.ts)貼近角色的程度一樣近，用來試演出
// 構圖。下限原本是 2(camera.top/bottom = ±2，畫面總高度 4 世界單位)，
// 先降到 0.5、再降到 0.25(整張臉框滿)。追問「能特寫到瞳孔嗎」，確認
// 後 Zeppelin 澄清：不是真的要看瞳孔這個部件，是「儘可能特寫到看得清楚
// 眼睛」，而且目前低模眼睛(沒有分虹膜/瞳孔、沒有貼圖，見
// humanoid.ts)之後模型可能會換掉——換句話說現在不用因為顧慮目前模型在
// 極限特寫下不好看而保守，相機能拉多近就拉多近，畫面粗糙是模型的事，
// 之後模型換了自然會變好看。這個系統是正交相機，`zoom` 只是決定
// camera.top/bottom 這個frustum半高，沒有「太近會撞到角色」這種物理
// 限制(camDist 在 game-loop.ts 另外算，永遠維持 >=16 個世界單位遠，
// 跟 zoom 無關)，理論上可以趨近 0 沒有下限；只是數字趨近 0 沒有意義
// (frustum 趨近 0 大小，等於整個畫面只剩一個點)。降到 0.05(總高度
// 0.1 世界單位，這顆角色單眼含眉毛的高度大概就在這個量級)當作「已經
// 沒有再往下的實際用途」的下限，比技術上的 0 更安全、也已經遠遠超過
// 一般構圖會用到的範圍。
// docs/decisions/camera-zoom.md 的 2/5/10/20 官方級距不變——那是給
// 「寫進事件程式碼」的鏡頭選的固定值，這裡放寬的是手動試鏡頭時能碰到
// 的範圍下限，兩者不衝突。
const ZOOM_MIN = 0.05;
function setCameraZoom(zoom) {
  if (isCameraAdjustModeActive()) {
    // F4 是開發用自由視角：不套用各地圖的正常最大縮放限制。只保留大於零
    // 的技術性下限，避免正交相機 frustum 退化成零面積。
    gameState.zoom = Math.max(0.001, zoom);
    updateCameraFrustum();
    if (import.meta.env.DEV) console.info(`[zoom] ${gameState.zoom.toFixed(3)}`);
    return;
  }
  const maxZoom = gameState.currentMapName === "port" ? 20 : 18;
  gameState.zoom = Math.max(ZOOM_MIN, Math.min(maxZoom, zoom));
  updateCameraFrustum();
  // 2026-08-26 Zeppelin 要求：滾輪調 zoom 時印出目前值，方便試序幕
  // 演出(prologue.ts)該用哪個 zoom 時直接看 console 記下來，不用自己
  // 心算滾了幾格。開發用途，production build 這個 if 會被靜態消掉。
  if (import.meta.env.DEV) {
    console.info(`[zoom] ${gameState.zoom.toFixed(2)}`);
  }
}
// 2026-08-27：原本是「每次滾輪固定加減 e.deltaY*0.01」的線性 step——
// zoom 範圍還是 2~18 時感覺剛好，但下限放寬到 0.05 之後(見上面
// ZOOM_MIN 那段註解，現在整個範圍是 0.05~20，400 倍跨度)，同一個固定
// step 在低 zoom 那端就太粗了：從 0.05 開始只要滾一格(deltaY 一般
// ±100 上下)就直接跳過 1，遠距離那端反而滾好幾格才有感覺，調不出貼臉
// 特寫需要的細微差異。改成乘法(依目前 zoom 等比例縮放，而不是固定加
// 減量)：deltaY 每 1000 對應約 2.7 倍(e^1≈2.72)，玩家常見的一格滾輪
// (deltaY≈±100)大概是 ±10% 左右——不管現在 zoom 是 0.05 還是 18，同一
// 格滾輪感覺到的「相對」縮放幅度一致，這也是觸控雙指縮放
// (pinchStartZoom*pinchStartDistance/distance，本來就是比例縮放)一直
// 以來的做法，滾輪這裡只是補齊同一套邏輯。
addEventListener("wheel", (e) => {
  // Menus own wheel input; never zoom the hidden world behind a scrollable UI.
  if (
    gameState.titlePresentationActive ||
    isInventoryOpen() ||
    document.querySelector('[data-game-menu="open"]') ||
    (e.target instanceof Element &&
      e.target.closest(
        "#titleScreen, #pauseMenu, #inventoryOverlay, #mapOverlay",
      ))
  )
    return;
  setCameraZoom(gameState.zoom * Math.exp(e.deltaY * 0.001));
});

let pinchStartDistance = 0;
let pinchStartZoom = gameState.zoom;
function touchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}
renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 2) return;
    pinchStartDistance = touchDistance(e.touches);
    pinchStartZoom = gameState.zoom;
    e.preventDefault();
  },
  { passive: false },
);
renderer.domElement.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length !== 2 || pinchStartDistance <= 0) return;
    const distance = touchDistance(e.touches);
    if (distance > 0) {
      setCameraZoom((pinchStartZoom * pinchStartDistance) / distance);
    }
    e.preventDefault();
  },
  { passive: false },
);
const endPinch = () => {
  pinchStartDistance = 0;
};
renderer.domElement.addEventListener("touchend", endPinch);
renderer.domElement.addEventListener("touchcancel", endPinch);

function cancelFishing() {
  if (gameState.fishingState === "idle") return;
  gameState.fishingState = "idle";
  gameState.fishingQte = null;
  gameState.pendingFishTier = null;
  if (gameState.bobberMesh) { scene.remove(gameState.bobberMesh); gameState.bobberMesh = null; }
  if (gameState.player?.parts?.rod) gameState.player.parts.rod.visible = false;
  if (isPrologueFishingTutorialActive()) reportPrologueFishingFailure();
}

// Fishing mouse aliases: left click acts as E while biting; right click cancels fishing.
addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || !gameState.player || gameState.titlePresentationActive) return;
  const action = (event.button === 0 && gameState.fishingState === "biting") || (event.button === 2 && gameState.fishingState !== "idle");
  if (!action) return;
  event.preventDefault(); event.stopPropagation();
  if (event.button === 2) { cancelFishing(); return; }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keyup", { key: "e", bubbles: true }));
}, true);
addEventListener("contextmenu", (event) => { if (gameState.fishingState !== "idle") { event.preventDefault(); event.stopPropagation(); } }, true);

// A dialogue line uses the same primary-action semantics as E, but a world
// pointer handler cannot receive clicks reliably when the dialogue UI covers
// the canvas. Listen at window level and consume the primary pointer action
// (mouse left button, single-finger touch, or pen) while a non-choice dialogue
// sequence is active. Interactive controls
// keep their own click behavior so selecting a choice never advances twice.
addEventListener("pointerdown", (event) => {
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    !gameState.player ||
    gameState.titlePresentationActive ||
    isInventoryOpen() ||
    activeChoice ||
    !dialogQueue.length
  )
    return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (
    target?.closest(
      'button, input, select, textarea, a, [role="button"], [contenteditable="true"]',
    )
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  advanceDialogSequence();
});

addEventListener("keydown", (e) => {
  // The title transition can briefly have no usable world player. Primary aliases
  // must also stay with focused UI controls and never pass through an open menu.
  if (
    !isPrimaryInteractionKey(e.key) ||
    gameState.ePressed ||
    !gameState.player
  )
    return;
  if (
    gameState.titlePresentationActive ||
    document.querySelector('[data-game-menu="open"]')
  )
    return;
  const target = e.target instanceof HTMLElement ? e.target : null;
  const isConfirmAlias = e.key.toLowerCase() !== "e";
  if (
    isConfirmAlias &&
    target?.closest(
      'button, input, select, textarea, a, [role="button"], [contenteditable="true"]',
    )
  )
    return;
  if (isConfirmAlias) e.preventDefault();
  gameState.ePressed = true;

  if (isInventoryOpen()) return;

  // 選項提示開著的時候 E 鍵完全不處理——只認數字鍵/滑鼠點擊(見下面另一
  // 個 keydown 監聽)，不然 E 會被底下的 dialogQueue 判斷或其他互動邏輯
  // 接手，玩家可能還沒選就誤觸別的東西。
  if (activeChoice) return;

  // 對話正在進行中：E 只用來往下推句子，不觸發任何其他動作
  if (dialogQueue.length) {
    advanceDialogSequence();
    return;
  }

  // 過場只保留對話推進；世界互動（包含釣魚、播種、採集與 NPC 閒聊）全部鎖定。
  // 教學若需要玩家自由操作，應先結束 cutsceneActive 再進入玩法等待階段。
  if (gameState.cutsceneActive) return;

  if (gameState.isSitting) {
    gameState.isSitting = false;
    return;
  }

  if (!consumeLegacyPrimaryBypass() && executeContextInteraction("primary")) return;

  if (
    gameState.currentMapName === "livingArea" &&
    gameState.fishingState === "idle" &&
    Math.hypot(
      gameState.player.position.x - REST_CHAIR.x,
      gameState.player.position.z - REST_CHAIR.z,
    ) <= 1.25
  ) {
    gameState.isSitting = true;
    gameState.isMoving = false;
    gameState.player.position.set(
      REST_CHAIR.x,
      groundY(REST_CHAIR.x, REST_CHAIR.z) - 0.03,
      REST_CHAIR.z,
    );
    gameState.player.rotation.y = REST_CHAIR.playerRotation;
    gameState.playerGridPos = {
      x: Math.round(REST_CHAIR.x),
      z: Math.round(REST_CHAIR.z),
    };
    return;
  }

  const scripted = events
    .filter(
      (ev) => ev.map === gameState.currentMapName && ev.trigger === "interact",
    )
    .filter(
      (ev) =>
        Math.abs(ev.x - gameState.playerGridPos.x) +
          Math.abs(ev.z - gameState.playerGridPos.z) <=
        1,
    );
  if (scripted.length) {
    scripted.forEach((ev) => ev.action());
    return;
  }

  if (
    (gameState.currentMapName === "livingArea" ||
      gameState.currentMapName === "oldVillage") &&
    carpenterQuest.stage !== "escorting" &&
    carpenterQuest.stage !== "village_scene_done"
  ) {
    // 木匠護送中村長與木匠會沿玩家走過的軌跡跟在身後，距離必然落在一般
    // NPC 對話半徑內。此時 E／A 是前方互動，不應被身後跟隨者攔截；
    // 護送事件自己的觸碰對話走上面的 scripted events，不受這裡影響。
    const nearby = npcs.find((n) => {
      if (!n.mesh.visible) return false; // 木匠抵達前不算「在場」，不能對話
      if (n.map !== gameState.currentMapName) return false;
      const dx = gameState.player.position.x - n.mesh.position.x,
        dz = gameState.player.position.z - n.mesh.position.z;
      return Math.sqrt(dx * dx + dz * dz) <= 1.3;
    });
    if (nearby) {
      const chatLine = npcLine(nearby);
      // 閒聊台詞永遠都會顯示；共餐條件如果剛好也同時成立，用「對了……」
      // 接在後面串成一組，不是讓共餐搶走閒聊——玩家單純想打招呼時不該
      // 連一句「哈囉」都聽不到。
      const merged = mergeChefMealIntoChatLine(chatLine);
      const onConversationComplete = () =>
        completeNpcDailyConversation(nearby.id);
      if (merged) showDialogSequence(merged, onConversationComplete);
      else showDialogSequence([chatLine], onConversationComplete);
      return;
    }
  }

  if (gameState.currentMapName === "livingArea" && tryShareChefMeal()) {
    return;
  }

  // 牡蠣架的沙灘互動格緊貼海邊，這個判定一定要排在下面的 nearWater()
  // 釣魚判定之前——不然站在那格按 E 一定會被釣魚搶走(那格 nearWater()
  // 必然是 true)，之前就是這樣才會站在牡蠣架旁邊按 E 卻跳出釣魚提示、
  // 牡蠣完全採不到。
  if (gameState.currentMapName === "livingArea") {
    const { x: oysterX, z: oysterZ } = gameState.playerGridPos;
    const onOysterRack = isOysterRackInteractionTile(oysterX, oysterZ);
    if (onOysterRack) {
      harvestOysterRack(oysterX, oysterZ);
      return;
    }
  }

  // 動物投餵機只負責查看存量；牧草必須在牧場格上按 R／手把 B 收割，
  // 不再保留按 E 免費補滿的測試捷徑。
  if (
    gameState.currentMapName === "livingArea" &&
    Math.hypot(
      gameState.player.position.x - FEEDER_VISUAL.x,
      gameState.player.position.z - FEEDER_VISUAL.z,
    ) <= FEEDER_VISUAL.interactionRadius
  ) {
    gameState.harvestFeedback = {
      kind: gameState.feederUnits > 0 ? "success" : "empty",
      title: "自動投餵機",
      text: "牧草存量：" + gameState.feederUnits + "／" + FEEDER_CAPACITY,
      until: gameState.elapsed + 2.6,
    };
    return;
  }

  // 木材/石頭採集點——玩家預設已經拿到斧頭，站在採集點旁邊(曼哈頓距離
  // <=1，跟上面 scripted interact events 同一種判定)按 E 就會揮斧採集。
  // 兩種資源座標清單分開存，但共用同一套「今天採過了嗎」邏輯
  // (harvestGatherNode)，採集成功會順便丟出幾片木屑/碎石飛散演出。
  if (
    gameState.currentMapName === "mountain" ||
    gameState.currentMapName === "livingArea"
  ) {
    const { x: gx, z: gz } = gameState.playerGridPos;
    const nearNode = (n: {
      x: number;
      z: number;
      map: string;
      collected?: boolean;
    }) =>
      n.map === gameState.currentMapName &&
      !n.collected &&
      Math.abs(n.x - gx) + Math.abs(n.z - gz) <= 1;
    const woodNode = WOOD_NODES.find(nearNode);
    const stoneNode = !woodNode && STONE_NODES.find(nearNode);
    const gatherNode = woodNode || stoneNode;
    if (gatherNode && hasTool("dualAxe")) {
      const kind = woodNode ? "wood" : "stone";
      const granted = harvestGatherNode(kind, gatherNode.x, gatherNode.z);
      if (granted > 0) {
        if (kind === "wood") playRandomSfx(CHOP_WOOD_SFX);
        const harvestedNode = woodNode || stoneNode;
        const meshEntry = gatherNodeMeshes.find(
          (entry) => entry.nodeId === harvestedNode.id,
        );
        if (meshEntry) meshEntry.group.visible = false;
        for (let i = 0; i < 3; i++) {
          const chip = makeChipDebris(kind, Math.random());
          chip.position.set(
            gatherNode.x + (Math.random() - 0.5) * 0.3,
            gameState.player.position.y + 0.3,
            gatherNode.z + (Math.random() - 0.5) * 0.3,
          );
          scene.add(chip);
          gameState.gatherChipAnims.push({
            mesh: chip,
            vx: (Math.random() - 0.5) * 1.4,
            vy: 1.6 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 1.4,
            start: gameState.elapsed,
            duration: 0.6,
          });
        }
      }
      return;
    }
  }

  // 鐘乳石洞窟礦石——跟木材/石頭同一種鄰接判定(曼哈頓距離<=1)，但獨立
  // 一份清單/邏輯(mine.ts)，不跟地表採集共用：採到的種類/顏色都吃目前
  // 樓層對應的礦石階層，跟日夜時段無關，換樓層才會重灑。
  if (gameState.currentMapName === "stalactiteCave") {
    const { x: mx, z: mz } = gameState.playerGridPos;
    const oreNode = ORE_NODES.find(
      (n) => !n.collected && Math.abs(n.x - mx) + Math.abs(n.z - mz) <= 1,
    );
    if (oreNode && hasTool("dualAxe")) {
      const result = harvestOreNode(oreNode.x, oreNode.z);
      if (result.amount > 0 && result.tier) {
        playRandomSfx(MINE_ORE_SFX);
        const meshEntry = oreNodeMeshes.find(
          (entry) => entry.nodeId === oreNode.id,
        );
        if (meshEntry) meshEntry.group.visible = false;
        for (let i = 0; i < 3; i++) {
          const chip = makeOreChipDebris(
            result.tier.accentColor,
            Math.random(),
          );
          chip.position.set(
            oreNode.x + (Math.random() - 0.5) * 0.3,
            gameState.player.position.y + 0.3,
            oreNode.z + (Math.random() - 0.5) * 0.3,
          );
          scene.add(chip);
          gameState.gatherChipAnims.push({
            mesh: chip,
            vx: (Math.random() - 0.5) * 1.4,
            vy: 1.6 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 1.4,
            start: gameState.elapsed,
            duration: 0.6,
          });
        }
      }
      return;
    }
  }

  // 山之洞礦石——跟鐘乳石洞窟同一套鄰接判定，只是換一份獨立的節點
  // 清單/採收函式(mine.ts)，兩個洞窟的礦點/收成互不影響。
  if (gameState.currentMapName === "mountainCave") {
    const { x: mx, z: mz } = gameState.playerGridPos;
    const oreNode = MOUNTAIN_ORE_NODES.find(
      (n) => !n.collected && Math.abs(n.x - mx) + Math.abs(n.z - mz) <= 1,
    );
    if (oreNode && hasTool("dualAxe")) {
      const result = harvestMountainOreNode(oreNode.x, oreNode.z);
      if (result.amount > 0 && result.tier) {
        playRandomSfx(MINE_ORE_SFX);
        const meshEntry = oreNodeMeshes.find(
          (entry) => entry.nodeId === oreNode.id,
        );
        if (meshEntry) meshEntry.group.visible = false;
        for (let i = 0; i < 3; i++) {
          const chip = makeOreChipDebris(
            result.tier.accentColor,
            Math.random(),
          );
          chip.position.set(
            oreNode.x + (Math.random() - 0.5) * 0.3,
            gameState.player.position.y + 0.3,
            oreNode.z + (Math.random() - 0.5) * 0.3,
          );
          scene.add(chip);
          gameState.gatherChipAnims.push({
            mesh: chip,
            vx: (Math.random() - 0.5) * 1.4,
            vy: 1.6 + Math.random() * 0.6,
            vz: (Math.random() - 0.5) * 1.4,
            start: gameState.elapsed,
            duration: 0.6,
          });
        }
      }
      return;
    }
  }

  // 廚房爐台——房子裡按 E 就直接開煮(見 MAPS.house.furniture 的
  // stove)，跟採集點同一種曼哈頓距離<=1 判定，不用另外做選單。
  if (gameState.currentMapName === "house") {
    const { x: hx, z: hz } = gameState.playerGridPos;
    const stove = (MAPS.house.furniture || []).find(
      (item) => item.type === "stove",
    );
    if (stove && Math.abs(stove.x - hx) + Math.abs(stove.z - hz) <= 1) {
      cookMeal();
      return;
    }
  }

  if (nearWater()) {
    if (gameState.fishingState === "idle") {
      playRandomSfx(FISH_CAST_SFX);
      gameState.fishingState = "casting";
      gameState.fishingTimer = 0;
      gameState.biteWaitTime = 1.4 + Math.random() * 2.6;
      gameState.bobberMesh = makeBobber();
      scene.add(gameState.bobberMesh);
      gameState.castAnimEnd = gameState.elapsed + CAST_ANIM_DURATION;
      if (gameState.player.parts.rod) gameState.player.parts.rod.visible = true;
    } else if (gameState.fishingState === "casting") {
      // 2026-08-26：上鉤前(還在等待期)按 E 可以取消收竿——原本設計是
      // 「casting 中途按 E 沒有作用，心急沒有用」，Zeppelin 要求改成可
      // 以隨時反悔，跟走離水邊自動取消(game-loop.ts)是同一套清理動作，
      // 差別只在這是玩家主動觸發、不用等狀態機判斷。
      gameState.fishingState = "idle";
      if (gameState.bobberMesh) {
        scene.remove(gameState.bobberMesh);
        gameState.bobberMesh = null;
      }
      if (gameState.player.parts.rod)
        gameState.player.parts.rod.visible = false;
      if (isPrologueFishingTutorialActive()) reportPrologueFishingFailure();
    } else if (gameState.fishingState === "biting") {
      // 魚階在咬鉤那一刻(game-loop.ts 的 casting→biting 轉換)就抽好
      // 存在 pendingFishTier，這裡只決定要不要進入拉扯期。
      const tier = gameState.pendingFishTier;
      gameState.pendingFishTier = null;
      if (!tier) {
        // 理論上不該發生(biting 一定先經過咬鉤那一刻)，防禦性處理成
        // 直接收穫，不要卡死狀態機。
        resolveFishCatch(FISH_TIERS.trash);
        return;
      }
      const qteCount = actualQteCount(tier, gameState.rodLevel);
      if (qteCount <= 0) {
        // 竿具等級已經把這個階級「畢業」掉(或本來就是垃圾魚)：跟原本
        // 行為一樣直接收穫，不進拉扯期。
        resolveFishCatch(tier);
        return;
      }
      playRandomSfx(FISH_REEL_SFX);
      gameState.fishingState = "reeling";
      const sequence = buildQteSequence(tier, qteCount);
      gameState.fishingQte = {
        tier,
        sequence,
        index: 0,
        windowStart: gameState.elapsed,
        tension: 0,
        perfectCount: 0,
        rushPressed: false,
        judged: false,
      };
      // 2026-08-26「往主角反方向拉」手感要求：第一個事件一開始就給一下
      // 「魚正在拉線」的觸感，不用等玩家按鍵或超時才有反應。
      triggerFishingEventOnsetHaptic(sequence[0], tier.key);
    }
    return;
  }

  if (gameState.currentMapName !== "livingArea") return;
  const { x, z } = gameState.playerGridPos;
  const onFarmland = FARMLAND_TILES.some(([fx, fz]) => fx === x && fz === z);
  if (onFarmland) {
    const key = `${x},${z}`;
    if (cropState[key] && cropState[key].stage >= 2) harvestCrop(x, z);
    else if (!cropState[key]) plantSeed(x, z);
  }
});
addEventListener("keyup", (e) => {
  if (isPrimaryInteractionKey(e.key)) gameState.ePressed = false;
});

// ==============================================================
// 2026-08-26 釣魚 QTE：拉扯期(reeling)核心邏輯——收穫演出抽成
// resolveFishCatch()(咬鉤直接秒收/QTE 序列跑完都呼叫這個)，方向輸入
// 走專屬 keydown 監聽(edge-trigger，跟上面 WASD 移動用的 `keys` held-
// state 分開)，逐幀超時檢查走 advanceFishingQte()(game-loop.ts 每幀
// 呼叫)。詳細規則見 claude/釣魚QTE系統設計筆記v1.md(專案文件)。
// ==============================================================

// 每個 QTE 事件「開始」那一刻(不是判定結果出來那一刻)觸發一次震動——
// 代表魚正在拉線的觸感：direction 事件是「往哪個方向拉」(見
// vibrateDirectionalPull)，rush 事件是「轉圈亂拉」(見 vibrateRushSpin)。
// 判定結果(完美/成功/方向錯誤/沒按/暴衝安全/暴衝誤觸)是另一次獨立的
// 震動，兩次中間那段等待窗刻意不震——安靜的空檔就是「暫停」的觸感，
// 不是漏寫。呼叫點：fishingQte 剛建立時(第一個事件)、
// advanceFishingQteAfterJudge() 換下一個事件時。
function triggerFishingEventOnsetHaptic(event: QteEvent, tierKey: FishTierKey) {
  if (event.kind === "rush") vibrateRushSpin(tierKey);
  else vibrateDirectionalPull(event.fishDirection!, tierKey);
}

// 收穫演出：跟原本「按 E 直接收穫」完全一樣的音效/丟魚簍/拋物線動畫，
// 抽成獨立函式方便兩個呼叫點共用(竿具等級把 QTE 次數扣到 0 時直接收穫、
// 或是走完整個拉扯期序列成功時)。
export function resolveFishCatch(tier: FishTierDef) {
  playRandomSfx(FISH_REEL_SFX);
  // 垃圾魚維持原本零 QTE（本來就是「撿了就走」的等級），
  // 真的釣到魚才給一次收穫震動，不然搖桿會震到膩。
  if (tier.key !== "trash") vibrateFishingHaptic("catchSuccess", tier.key);
  inventory.fish++;
  inventory.fishByTier[tier.key] = (inventory.fishByTier[tier.key] || 0) + 1;
  gameState.fishingState = "idle";
  const catchFrom = gameState.bobberMesh
    ? gameState.bobberMesh.position.clone()
    : gameState.player.position.clone();
  if (gameState.bobberMesh) {
    scene.remove(gameState.bobberMesh);
    gameState.bobberMesh = null;
  }
  if (gameState.player.parts.rod) gameState.player.parts.rod.visible = false;
  gameState.fishFeedback = {
    text:
      tier.key === "trash" ? "釣到一些垃圾……" : `釣到一隻魚！（${tier.label}）`,
    until: gameState.elapsed + 1.4,
  };
  const flyingFish = makeFishProp(Math.random() * 100);
  flyingFish.scale.setScalar(1.7);
  scene.add(flyingFish);
  gameState.catchAnim = {
    mesh: flyingFish,
    from: catchFrom,
    start: gameState.elapsed,
    duration: 0.7,
  };
  if (isPrologueFishingTutorialActive()) reportPrologueFishingSuccess();
}

function clampTension(t: number): number {
  return Math.max(0, Math.min(TENSION_MAX, t));
}

// 一次事件判定完(不管是被按鍵即時判定、還是逐幀超時判定)之後的收尾：
// 張力爆錶就斷線失敗；序列跑完(index 到底)就收穫；否則開下一個事件的
// 判定窗。
function advanceFishingQteAfterJudge() {
  const qte = gameState.fishingQte;
  if (!qte) return;
  if (qte.tension >= TENSION_MAX) {
    vibrateFishingHaptic("lineBreak", qte.tier.key);
    gameState.fishingState = "idle";
    gameState.fishingQte = null;
    if (gameState.bobberMesh) {
      scene.remove(gameState.bobberMesh);
      gameState.bobberMesh = null;
    }
    if (gameState.player.parts.rod) gameState.player.parts.rod.visible = false;
    gameState.fishFeedback = {
      text: "斷線了……牠掙脫跑了",
      until: gameState.elapsed + 1.4,
    };
    if (isPrologueFishingTutorialActive()) reportPrologueFishingFailure();
    return;
  }
  qte.index++;
  if (qte.index >= qte.sequence.length) {
    const tier = qte.tier;
    gameState.fishingQte = null;
    resolveFishCatch(tier);
    return;
  }
  qte.windowStart = gameState.elapsed;
  qte.judged = false;
  qte.rushPressed = false;
  triggerFishingEventOnsetHaptic(qte.sequence[qte.index], qte.tier.key);
}

// 逐幀超時檢查——game-loop.ts 的釣魚狀態機推進在 fishingState==="reeling"
// 時每幀呼叫這個。按鍵即時判定(見下面的專屬 keydown 監聽)已經處理過的
// 事件(qte.judged===true)這裡直接跳過，等 index 換到下一個事件才會
// 重新開始算超時。
export function advanceFishingQte() {
  const qte = gameState.fishingQte;
  if (!qte || gameState.fishingState !== "reeling") return;
  if (qte.judged) return;
  const event = qte.sequence[qte.index];
  const windowElapsed = gameState.elapsed - qte.windowStart;
  if (windowElapsed < event.windowSeconds) return;
  qte.judged = true;
  if (event.kind === "rush") {
    // 暴衝全程沒被按到＝正確放線，張力小降。
    vibrateFishingHaptic("rushSafe", qte.tier.key);
    qte.tension = clampTension(qte.tension + TENSION_DELTA.rushSafe);
  } else {
    vibrateFishingHaptic("miss", qte.tier.key);
    qte.tension = clampTension(
      qte.tension +
        tensionDeltaFor(judgeDirectionPress(event.fishDirection!, null, 0)),
    );
  }
  advanceFishingQteAfterJudge();
}

const QTE_KEY_TO_DIRECTION: Record<string, QteDirection> = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};
// 拉扯期方向輸入——跟上面 WASD 移動用的 `keys` held-state 分開監聽，這裡
// 要的是「這個判定窗內的第一下按鍵」(edge-trigger)，不是「現在按著」，
// 兩者語意不同不能共用同一份狀態；reeling 以外完全不做事，不影響移動/
// 其他互動。
addEventListener("keydown", (e) => {
  if (gameState.fishingState !== "reeling" || !gameState.fishingQte) return;
  const qte = gameState.fishingQte;
  if (qte.judged) return;
  const dir = QTE_KEY_TO_DIRECTION[e.key.toLowerCase()];
  if (!dir) return;
  e.preventDefault();
  const event = qte.sequence[qte.index];
  qte.judged = true;
  if (event.kind === "rush") {
    // 暴衝正確做法是完全不按——按了任何一個方向鍵就算誤拉，不比對方向。
    qte.rushPressed = true;
    vibrateFishingHaptic("rushFail", qte.tier.key);
    qte.tension = clampTension(qte.tension + TENSION_DELTA.rushFail);
  } else {
    const pressRatio = Math.min(
      1,
      Math.max(0, (gameState.elapsed - qte.windowStart) / event.windowSeconds),
    );
    const judgement = judgeDirectionPress(
      event.fishDirection!,
      dir,
      pressRatio,
    );
    if (judgement === "perfect") qte.perfectCount++;
    vibrateFishingHaptic(judgement, qte.tier.key);
    qte.tension = clampTension(qte.tension + tensionDeltaFor(judgement));
  }
  advanceFishingQteAfterJudge();
});

// 自由移動的碰撞判斷：玩家當成一個小正方形，四個角落分別去查
// 「這個角落現在在哪個格子、那格能不能走」，任何一個角落撞到就擋住，
// 這樣貼著牆邊走的時候是滑過去，不是整個人卡住
export function collidesAt(mapName, x, z, half = 0.22) {
  const corners = [
    [x - half, z - half],
    [x + half, z - half],
    [x - half, z + half],
    [x + half, z + half],
  ];
  return corners.some(([cx, cz]) => isBlocked(mapName, cx, cz));
}

// 廚師的碼頭/民宿觸碰點還沒有座標，proving/renovating 這段機制沒辦法
// 靠正常流程走到——先掛一個可直接改寫的除錯掛鉤，在主控台打
// __chefQuest.stage = "proving" 就能單獨測試共餐判定跟天數延遲，
// 不用等座標定案。這裡掛的是活物件本身（不是快照），改了會直接
// 影響遊戲狀態；座標接上、正式走過抵達事件之後留著也無妨。
// chef-quest.ts 裡在開發模式下把這個物件的欄位包成 getter/setter，
// 每次在主控台改動都會同步存進 localStorage，下次開發伺服器整頁
// 重新載入（改任何檔案幾乎都會觸發）時會自動讀回來——不用每次都
// 重新打一次 __chefQuest.stage = "proving"。
(window as any).__chefQuest = chefQuest;
// 所有地圖切換點的黃色門檻標記共用一個開關：除錯階段用得到、確認
// 座標之後想全部藏起來，不用一個一個地圖改 tile 資料，主控台打
// __setThresholdMarkersVisible(false) 就好，重新整理後也會維持
// （靠 thresholdMarkersVisible 這個模組層級變數，跟 buildMap()
// 每次重建地圖時套用的是同一份）。
(window as any).__setThresholdMarkersVisible = setThresholdMarkersVisible;
(window as any).__gameState = () => ({
  playerGridPos: gameState.playerGridPos,
  currentMapName: gameState.currentMapName,
  facing: gameState.facing,
  isMoving: gameState.isMoving,
  nightFactor: (window as any).__nightFactor || 0,
  season: SEASON_NAMES[gameState.currentSeason],
  weather: WEATHER_NAMES[gameState.currentWeather],
  musicMuted: gameState.musicMuted,
  dialogVisible:
    dialogEl.style.display !== "none" && dialogEl.style.display !== "",
  day: gameState.currentDay,
  seasonDay: getSeasonDay(),
  period: getSeasonPeriod(),
  time: gameState.currentPhase * TIME_CONFIG.gameHoursPerDay,
  activeMeteors: meteorPool.filter((meteor) => meteor.active).length,
  inventory: { ...inventory },
  fishingState: gameState.fishingState,
  npcs: npcs.map((n) => ({
    id: n.id,
    memory: n.memory,
    relationship: getRelationship(n.id),
    pos: { x: n.mesh.position.x, z: n.mesh.position.z },
  })),
  crops: JSON.parse(JSON.stringify(cropState)),
});

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 依「遊戲日」推星期；第 1 天當週日，之後循環。 */
function weekdayLabelForDay(day: number): string {
  const idx = (((Math.max(1, Math.floor(day)) - 1) % 7) + 7) % 7;
  return `${WEEKDAY_NAMES[idx]}`;
}

/**
 * 讀未來某天的天氣。優先用已排程的 weatherSchedules，
 * 沒有就用 rollWeatherForSeason 即時算（與實際跨日時一致即可）。
 */
function weatherForDay(day: number): string {
  const key = String(day);
  const scheduled = gameState.weatherSchedules?.[key];
  if (typeof scheduled === "string" && scheduled) return scheduled;
  // 若 schedules 結構是 { [day]: weather } 以外的寫法，再對齊 game-state 調整
  try {
    return rollWeatherForSeason(gameState.currentSeason, day);
  } catch {
    return gameState.currentWeather;
  }
}
export const hudEl = document.getElementById("hud");
const hudDateEl = document.getElementById("hudDate");
const hudTimeEl = document.getElementById("hudTime");
const hudWeatherDays = Array.from(
  document.querySelectorAll<HTMLElement>("#hudWeatherRow .hud-weather-day"),
);

export function updateHud() {
  if (!hudEl || !hudDateEl || !hudTimeEl) return;

  const gameHour = gameState.currentPhase * TIME_CONFIG.gameHoursPerDay;
  const hh = Math.floor(gameHour) % TIME_CONFIG.gameHoursPerDay;
  const mm = Math.floor((gameHour - Math.floor(gameHour)) * 60);

  // 除錯用 dataset 維持
  hudEl.dataset.activeMeteors = String(
    meteorPool.filter((meteor) => meteor.active).length,
  );
  hudEl.dataset.nightFactor = ((window as any).__nightFactor || 0).toFixed(3);

  // 標題：春季 ・ 第 3 日（上旬）・ 週二
  // 改成春月3日(二)
  const seasonName = translateText(SEASON_NAMES[gameState.currentSeason] ?? "");
  const seasonDay = getSeasonDay();
  const period = getSeasonPeriod();
  const weekday = weekdayLabelForDay(gameState.currentDay);
  const locale = getLocale();
  hudDateEl.innerHTML = locale === "en"
    ? `${seasonName} ${seasonDay}<span>(${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][gameState.currentDay % 7]})</span>`
    : locale === "ja"
      ? `${seasonName}${seasonDay}日<span>(${["日", "月", "火", "水", "木", "金", "土"][gameState.currentDay % 7]})</span>`
      : seasonName + `月${seasonDay}日` + `<span>(${weekday})</span>`;

  // 大字時間
  hudTimeEl.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

  hudEl.classList.toggle("hud--muted", Boolean(gameState.musicMuted));

  // 今天 / 明天 / 後天
  const meteorShowerLabel = getMeteorShowerHudLabel();
  hudWeatherDays.forEach((dayEl) => {
    const offset = Number(dayEl.dataset.offset) || 0;
    const day = gameState.currentDay + offset;
    const weatherKey =
      offset === 0 ? gameState.currentWeather : weatherForDay(day);
    const label = translateText(WEATHER_NAMES[weatherKey] ?? weatherKey);

    const emojiEl = dayEl.querySelector(".hud-weather-emoji");
    const labelEl = dayEl.querySelector(".hud-weather-label");
    const showerForDay = METEOR_SHOWER_SCHEDULE[getSeasonDay(day)];
    const iconKey = showerForDay
      ? (showerForDay.phase === "peak" ? "meteor-peak" : "meteor-shower")
      : weatherKey;
    if (emojiEl) emojiEl.innerHTML = weatherIconSvg(iconKey);
    if (labelEl) {
      // 流星雨只掛在「今天」
      labelEl.innerHTML =
        offset === 0 && meteorShowerLabel
          ? `${label}<br><b style="color:#a9d8ff;font-size:18px">${translateText(meteorShowerLabel)}</b>`
          : label;
    }
  });
}
