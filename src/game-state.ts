import * as THREE from "three";
import { hash2 } from "./utils";
import { LAYOUT, MAPS, MOUNTAIN_GATE_BLOCKER, FLOWER_BED_TILES } from "./layout-maps";
import { npcs, hasPastureGrassAt } from "./npc-runtime";
import { isNearFishingWater } from "./fishing-water";
import { syncFarmVisuals, syncFlowerBedVisuals } from "./farm-visuals";
import { createWeatherSchedule } from "./weather-schedule";
import { getScaledBuildingBounds } from "./building-scale";
import { cropTypeForSeedItem } from "./item-catalog";
import {
  allVillagersAtSixStars,
  normalizeOysterRackSlots,
  PEARL_DEFINITIONS,
  rollPearl,
  VILLAGER_IDS,
  type PearlRarity,
} from "./pearl-system";
import { getRelationship } from "./affection";
import { storyState } from "./story/story-state";
import type { ToolId } from "./tool-catalog";
import {
  type FlowerSpeciesId,
  flowerSpeciesLabel,
  isFlowerSpeciesId,
} from "./wildflowers";
import {
  type MushroomSpeciesId,
  mushroomSpeciesLabel,
} from "./mushrooms";
export { TOOL_DEFINITIONS, type ToolId } from "./tool-catalog";
export { MAX_EXTREME_WEATHER_PER_SEASON } from "./weather-schedule";

// ==============================================================
// 遷移筆記：這個檔案集中放「會被跨檔案讀寫的可變基本狀態」。原本單一
// script 裡這些都是隨手可寫的頂層 let，搬成 ES module 之後，其他檔案沒辦法
// 直接 reassign 一個 import 進來的 let（只能讀，不能 `importedLet = x`），
// 所以全部包進同一個可變物件 gameState，其他模組 import gameState 之後
// 用 `gameState.xxx = ...` 讀寫，效果等同原本「隨便哪個函式都能直接改」的
// 行為，只是多一層 `gameState.` 前綴。命名特地不叫 `state`，因為原始碼裡
// 好幾個函式(例如 harvestOysterRack)自己就宣告了區域變數叫 state，會撞名。
// ==============================================================
export const gameState = {
  playerName: "牧場主",
  playerAppearance: "female" as "male" | "female",
  // 2026-08-26 每日 06:00 自動存檔：game-clock.ts 的 updateGameClock()
  // 偵測到這一幀跨過了某一天的 06:00 就把這個設 true；game-loop.ts 的
  // animate() 每幀檢查，真的存完檔才清回 false。放在 gameState 上而不是
  // 用回呼/回傳值傳遞，是因為時間推進有兩個呼叫點(每幀正常前進、N 鍵
  // 快轉)，用共用旗標才不會漏接快轉那條路徑觸發的自動存檔。
  pendingAutosave: false,
  titlePresentationActive: false,
  currentDay: 0,
  currentPhase: 0, // 一天中的比例(0~1)，animate() 每幀更新，E 鍵事件也要讀
  currentSeason: 0, // 下面初始化時會用 getSeasonIndex(0) 覆蓋
  currentWeather: "clear" as string, // 下面初始化時會用 rollWeatherForSeason 覆蓋
  previousWeather: "clear" as string,
  weatherChangedAt: 0,
  // 每個 21 天季節預先產生完整天氣，才能保證極端天氣前後的過渡日。
  // key 是從遊戲開局起算的絕對季節編號，不只用 0~3 的季節索引。
  weatherSchedules: {} as Record<string, string[]>,
  fishingState: "idle" as string, // "idle" | "casting" | "biting" | "reeling"
  fishingTimer: 0,
  biteWaitTime: 0,
  biteWindowStart: 0,
  bobberMesh: null as THREE.Object3D | null,
  fishFeedback: null as {
    text: string;
    until: number;
    shownAtMs?: number;
  } | null,
  // 2026-08-26 釣魚 QTE：竿具等級——每級讓小/中/大魚的 QTE 次數扣 3
  // (下限 0)，魚霸主/特殊魚下限鎖 1，永遠留一次判定(見 src/fishing.ts
  // actualQteCount())。目前遊戲裡還沒有升級竿具的管道(商店/工作台之類
  // 都還沒接)，先給個可以手動調的欄位，介面接上後再串。
  rodLevel: 0,
  // 拉扯期(reeling)的完整 QTE 進行狀態；不在拉扯期時是 null。
  // sequence 由 buildQteSequence() 產生，index 指向目前正在判定的事件，
  // windowStart 是目前這個事件的判定窗開始時間(elapsed)，
  // rushPressed 記錄暴衝事件中玩家是否誤按過。perfectCount 純粹統計
  // 用，之後可能給「完美收竿」加成/成就用得到。
  fishingQte: null as {
    tier: import("./fishing").FishTierDef;
    sequence: import("./fishing").QteEvent[];
    index: number;
    windowStart: number;
    tension: number;
    perfectCount: number;
    rushPressed: boolean;
    judged: boolean;
  } | null,
  // 咬鉤(casting→biting)那一刻就先抽好魚階，存在這裡等玩家按 E
  // 決定收竿時使用；biting 逾時魚跑掉/離開水邊取消釣魚都要
  // 記得清掉，不然下一次咬鉤沒重新抽會拿到舊魚階。
  pendingFishTier: null as import("./fishing").FishTierDef | null,
  // 牡蠣架收成的 UI 回饋——跟 fishFeedback 同一套「elapsed 到期就清掉」
  // 的做法，animate() 每幀讀這個物件去更新 #harvestToast。
  harvestFeedback: null as {
    kind: "success" | "empty";
    title: string;
    text: string;
    count?: number;
    until: number;
    shownAtMs?: number;
  } | null,
  // 牡蠣架上「還沒收成」那批殼用的共用材質——makeOysterRack() 建好之後把
  // 材質丟回這裡，animate() 每幀根據 isOysterRackReady() 幫它調
  // emissiveIntensity，達到「還能採就發光、採完就暗下來」的效果。
  oysterGlowMats: [] as THREE.MeshStandardMaterial[],
  oysterRackSlots: 1,
  castAnimEnd: 0,
  catchAnim: null as {
    mesh: THREE.Object3D;
    from: THREE.Vector3;
    start: number;
    duration: number;
  } | null,
  zoom: 5,
  nextMeteorAt: Infinity,
  meteorBurstRemaining: 0,
  meteorBurstCooldownUntil: 0,
  moonPhaseTextureDay: -1, // 快取：只有換日才重畫月相貼圖，不用每幀重算 canvas
  elapsed: 0,
  effectElapsed: 0,
  audioContext: null as AudioContext | null,
  musicMuted: false,
  activeMusicKey: null as string | null,
  oceanMesh: null as THREE.Mesh | null, // 整片海面網格，animate() 裡逐頂點做波浪動畫
  lakeMesh: null as THREE.Mesh | null, // 湖面，跟海一樣是合併網格，只是波浪幅度小很多、沒有碎浪
  seaGlimpseMesh: null as THREE.Mesh | null, // 北邊的遠方海景背景板，會輕輕起伏
  mapGroup: new THREE.Group(),
  player: undefined as any,
  currentMapName: "livingArea",
  playerGridPos: { x: 0, z: 0 },
  facing: "down",
  isMoving: false,
  isSitting: false,
  // 開場第一天演出(序幕：主角乘船抵達港口)專用鎖：跟 isSitting/釣魚一樣
  // 讓 WASD 完全不生效，但刻意不透過 isGameTimePaused()(那個會讓
  // dt=0，連帶凍結船隻/跳板動畫的補間)，見 src/prologue.ts。
  cutsceneActive: false,
  // 序章播種教學的可用範圍；null 表示一般遊戲可使用所有農地。
  plantingBounds: null as null | {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  },
  houseLampLight: null as THREE.PointLight | null,
  houseLampBulbMat: null as THREE.MeshStandardMaterial | null,
  // 2026-08-26 加的頂燈(makeCeilingLamp)——桌燈(houseLampLight)範圍只有
  // 2.4，房子放大之後照不到整個空間，頂燈用更大的 distance 補主空間的
  // 整體照明，晝夜邏輯(game-loop.ts)跟桌燈同一套 nightFactor 開關。
  houseCeilingLampLight: null as THREE.PointLight | null,
  houseCeilingLampBulbMat: null as THREE.MeshStandardMaterial | null,
  ePressed: false,
  lastFrame: 0, // main.ts 啟動迴圈時會用 performance.now() 設一次
  prevDay: 0,
  animationFrameCount: 0,
  grassAnimationAccumulator: 0,
  hudUpdateAccumulator: 0,
  ownedAnimals: [] as string[],
  // 動物投餵機（放養式簡化模型，規格見 task.md）：早上放牧、傍晚投餵，
  // 一天各結算一次；兩個 SettledDay 記錄「這天有沒有結算過」，避免同一
  // 天內每一幀都重複結算。pastureGrazedToday 是給傍晚判斷用的「今天有
  // 沒有真的吃到放牧的草」，不是「今天有沒有結算過」。
  feederUnits: 20,
  pastureGrazeSettledDay: -1,
  pastureGrazedToday: false,
  feederSettledDay: -1,
  // 採集點（木材/石頭）跟牡蠣架共用同一顆 harvestFeedback 就好，不用
  // 另外開一個欄位——UI 只認 kind/title/text，來源是哪個系統不重要。
  // 這裡另外存一份「正在播放砍取動畫」的木屑/碎石清單，game-loop.ts
  // 逐幀更新位置、input-save.ts 負責在採集成功時建立。
  gatherChipAnims: [] as {
    mesh: THREE.Object3D;
    vx: number;
    vy: number;
    vz: number;
    start: number;
    duration: number;
  }[],
  // 砍木材的短暫動作狀態。effectElapsed 讓揮斧不受遊戲時間快轉影響；
  // 木材要等到 impacted 的命中幀才真正採收並隱藏。
  woodChopAnim: null as null | {
    nodeId: string;
    x: number;
    z: number;
    start: number;
    duration: number;
    impactAt: number;
    impacted: boolean;
  },
  gatherSpawnSlot: Number.MIN_SAFE_INTEGER,
  // 鐘乳石洞窟目前所在樓層(1~25)，只有在 stalactiteCave 地圖裡有意義；
  // 離開地圖不重置，下次從舊城鎮洞口走進去才會強制設回 1(見 mine.ts
  // 的 regenerateMineFloor 呼叫點)。
  mineFloor: 1,
  // 山之洞(往上爬版本)目前所在樓層——跟 mineFloor 是完全獨立的計數，
  // 兩個洞窟可以各自停在不同樓層互不影響，只有在 mountainCave 地圖裡
  // 有意義。同樣不會因為離開地圖被重置，下次從山區洞口走進去才會強制
  // 設回 1(見 mine.ts 的 regenerateMountainMineFloor 呼叫點)。
  mountainMineFloor: 1,
};

export const inventory = {
  tools: {
    wateringCan: true,
    hoe: true,
    // 2026-09-02 Zeppelin 決定：斧頭不再一開始就有，改成第二天早上
    // 劇本裡歐文送給玩家的劇情道具（見 day2-morning-event.ts，授予
    // 這一步還沒接上，下一輪山區採集教學那段才會真正呼叫）。這裡跟
    // resetPrologueStartingItems()（prologue.ts）的既有行為對齊——
    // 序章一開始就會把所有工具整組清成 false，這個靜態預設值本來就
    // 只在跳過序章之類的邊界情況才真的生效，改成 false 讓兩邊一致。
    dualAxe: false,
    sickle: true,
    fishingRod: true,
    milker: false,
    shears: false,
    brush: false,
  } as Record<ToolId, boolean>,
  seeds: 1,
  // seeds 是既有存檔的蘿蔔種子欄位；新增種類獨立保存，舊檔讀取時保留預設值。
  potatoSeeds: 1,
  tomatoSeeds: 1,
  heldItemId: null as string | null,
  harvested: 0,
  mushrooms: 0,
  fish: 0,
  // 2026-08-26 釣魚 QTE：各魚階累積捕獲數——inventory.fish 這個舊欄位
  // 繼續當「魚的總數」維持跟 chef-quest.ts 既有消耗邏輯相容(不用改任何
  // 現有的食譜/烹飪程式碼)，這份只是額外多記一份「哪個階級各釣到幾隻」
  // 的統計，先把資料存起來，魚圖鑑/稀有魚介面之後要用就不用重新設計
  // 存檔格式。
  fishByTier: {
    trash: 0,
    small: 0,
    medium: 0,
    large: 0,
    boss: 0,
    legendary: 0,
  } as Record<string, number>,
  wood: 10,
  stone: 5,
  // 野花——各物種獨立計數，跟 pearls 用同一種「id -> 數量」表寫法，
  // 避免 5 個相似欄位各自散開重複邏輯。999 堆疊上限只是設計意圖，
  // 這個專案目前所有資源都沒有實際的堆疊上限檢查(wood/stone/mushrooms
  // 等都一樣)，這裡刻意保持一致，不要為花單獨造一套上限機制。
  wildflowers: {
    wildDaisy: 0,
    redPoppy: 0,
    dandelion: 0,
    blueDayflower: 0,
    pinkWoodSorrel: 0,
  } as Record<FlowerSpeciesId, number>,
  oysters: 0,
  pearls: {
    white: 0,
    pink: 0,
    purple: 0,
    black: 0,
    gold: 0,
  } as Record<PearlRarity, number>,
  animalProducts: { milk: 0, wool: 0, egg: 0 },
  // 鐘乳石洞窟礦石——跟木材/石頭是不同系統(見 mine.ts)，5 階對應
  // 銅/銀/金/星晶/神晶，數值型別跟其他資源一致方便 HUD 共用格式化邏輯。
  copper: 0,
  silver: 0,
  gold: 0,
  starCrystal: 0,
  godCrystal: 0,
  // 料理成品——跟其他資源不同，種類不只一種，所以用「食譜 id -> 數量」
  // 的表，不是單一數字。哪個 id 對應哪道菜看下面的 RECIPES。
  dishes: {} as Record<string, number>,
  // 倉庫沿用物品 id，數量為 0 的項目不保存也不顯示。
  storage: {} as Record<string, number>,
  // 永久 recipe id；新遊戲預設不會料理，只能製作已由事件、NPC 或書架解鎖的食譜。
  learnedRecipes: [] as string[],
};

export function hasTool(toolId: ToolId) {
  return inventory.tools[toolId] === true;
}

export const cropState: Record<
  string,
  {
    stage: number;
    plantedDay: number;
    cropType?: import("./item-catalog").CropType;
  }
> = {};

export const TIME_CONFIG = Object.freeze({
  realSecondsPerGameHour: 30,
  gameHoursPerDay: 24,
  daysPerSeason: 21,
  seasons: Object.freeze(["spring", "summer", "autumn", "winter"]),
});

export const SEASON_NAMES = ["春", "夏", "秋", "冬"];
export const SEASON_DAYLIGHT = Object.freeze({
  spring: Object.freeze({ sunrise: 6, sunset: 18, peak: 18 }),
  summer: Object.freeze({ sunrise: 5, sunset: 19, peak: 21 }),
  autumn: Object.freeze({ sunrise: 6, sunset: 18, peak: 17 }),
  winter: Object.freeze({ sunrise: 7, sunset: 17, peak: 13.5 }),
});
// 全域草地/地面季節配色——所有草地相關材質(livingArea/舊城鎮地板、牧場
// 風吹草)都應該讀這張表，不要各自寫一份「冬天用A色否則用B色」的三元判斷，
// 避免兩處配色之後各自漂移。秋天刻意選介於楓紅與楓黃之間的暖橙色，代表
// 落葉混雜草地；牧場風吹草另外在 makeWindGrass() 用 seed 在楓紅／楓黃兩色
// 之間做逐叢差異，做出真正「紅黃混搭」的斑駁效果，不是整片單一顏色。
export const SEASON_GRASS_TONES = Object.freeze({
  spring: Object.freeze({ ground: 0x6ab04c, roughness: 1 }),
  summer: Object.freeze({ ground: 0x6ab04c, roughness: 1 }),
  autumn: Object.freeze({ ground: 0xc07a35, roughness: 0.88 }),
  winter: Object.freeze({ ground: 0xe8eef2, roughness: 0.82 }),
});
export const AUTUMN_GRASS_MAPLE_RED = 0xb5432a;
export const AUTUMN_GRASS_MAPLE_YELLOW = 0xe0a934;
// 給任何一叢草/一顆草簇用同一顆 seed 算出的秋色，楓紅／楓黃混色比例跟
// seed 綁定(不是 Math.random)，同一叢草每次重建場景顏色都一樣，不會
// 每次進地圖閃爍成不同色。makeWindGrass()/makeGrassTuft() 共用這個函式，
// 不要各自重寫一份 lerp 公式。
export function mapleAutumnColor(seed: number) {
  return new THREE.Color(AUTUMN_GRASS_MAPLE_RED)
    .lerp(
      new THREE.Color(AUTUMN_GRASS_MAPLE_YELLOW),
      hash2(seed * 3.7, seed * 1.3),
    )
    .offsetHSL(0, 0, (seed - 0.5) * 0.06);
}
export function getSeasonGrassTone(seasonIndex = gameState.currentSeason) {
  const snowWeather =
    gameState.currentWeather === "snow" ||
    gameState.currentWeather === "blizzard";
  if (snowWeather || seasonIndex === 3) {
    return Object.freeze({ ground: 0xf7f9fc, roughness: 0.62 });
  }
  const key = TIME_CONFIG.seasons[
    seasonIndex
  ] as keyof typeof SEASON_GRASS_TONES;
  return SEASON_GRASS_TONES[key];
}
export const METEOR_CONFIG = Object.freeze({
  maxActive: 20,
  normalMinPerHour: 0.35,
  normalMaxPerHour: 1.65,
  minDuration: 0.4,
  maxDuration: 1.2,
  dawnDuskBlendHours: 1,
  showerTrailScale: 1.35,
  showerDurationScale: 1.18,
});
export const METEOR_SHOWER_SCHEDULE = Object.freeze({
  11: Object.freeze({ phase: "approach", minPerHour: 4, maxPerHour: 7 }),
  12: Object.freeze({ phase: "rising", minPerHour: 8, maxPerHour: 12 }),
  13: Object.freeze({ phase: "rising", minPerHour: 8, maxPerHour: 12 }),
  14: Object.freeze({ phase: "peak", minPerHour: 18, maxPerHour: 26 }),
  15: Object.freeze({ phase: "fading", minPerHour: 6, maxPerHour: 9 }),
});
export const METEOR_SHOWER_PHASE_NAMES: Record<string, string> = Object.freeze({
  approach: "流星雨前夕",
  rising: "流星雨增強",
  peak: "流星雨高峰",
  fading: "流星雨漸弱",
});
export const FULL_MOON_SEASON_DAY = 14;
// 第一季前 7 天（教學週）強制晴天，避免新手教學被雨雪打斷。
export const TUTORIAL_WEEK_DAYS = 7;
export const dayLength =
  TIME_CONFIG.realSecondsPerGameHour * TIME_CONFIG.gameHoursPerDay;
export const WEATHER_NAMES: Record<string, string> = {
  clear: "晴",
  cloudy: "陰",
  rain: "雨",
  typhoon: "颱風",
  storm: "暴風雨",
  snow: "下雪",
  blizzard: "暴風雪",
};
export function getSeasonIndex(day = gameState.currentDay) {
  return (
    Math.floor(day / TIME_CONFIG.daysPerSeason) % TIME_CONFIG.seasons.length
  );
}
export function getSeasonDay(day = gameState.currentDay) {
  return (day % TIME_CONFIG.daysPerSeason) + 1;
}
export function getSeasonPeriod(day = gameState.currentDay) {
  const seasonDay = getSeasonDay(day);
  return seasonDay <= 7 ? "上旬" : seasonDay <= 14 ? "中旬" : "下旬";
}
// 第 0 天(遊戲開局)定為週日，之後每 7 天循環一次；純用 currentDay 換算，
// 不另外存一個會跟 currentDay 脫鉤的計數器。
export function getDayOfWeek(day = gameState.currentDay) {
  return day % 7;
}
export function isSunday(day = gameState.currentDay) {
  return getDayOfWeek(day) === 0;
}
export function getDaylightForSeason(seasonIndex = gameState.currentSeason) {
  const key = TIME_CONFIG.seasons[seasonIndex] as keyof typeof SEASON_DAYLIGHT;
  const daylight = SEASON_DAYLIGHT[key];
  return {
    sunriseHour: daylight.sunrise,
    sunsetHour: daylight.sunset,
    sunrise: daylight.sunrise / TIME_CONFIG.gameHoursPerDay,
    sunset: daylight.sunset / TIME_CONFIG.gameHoursPerDay,
    peak: daylight.peak,
  };
}
export function smoothstep01(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
export function getNightFactor(phase = gameState.currentPhase) {
  const hour = phase * TIME_CONFIG.gameHoursPerDay;
  const daylight = getDaylightForSeason();
  const blend = METEOR_CONFIG.dawnDuskBlendHours;
  if (hour < daylight.sunriseHour - blend || hour > daylight.sunsetHour + blend)
    return 1;
  if (hour <= daylight.sunriseHour + blend)
    return (
      1 - smoothstep01((hour - (daylight.sunriseHour - blend)) / (blend * 2))
    );
  if (hour >= daylight.sunsetHour - blend)
    return smoothstep01((hour - (daylight.sunsetHour - blend)) / (blend * 2));
  return 0;
}
export function isNightTime() {
  return getNightFactor() >= 0.55;
}

export function createSeasonWeatherSchedule(
  absoluteSeason: number,
  random: () => number = Math.random,
) {
  const firstAbsoluteDay = absoluteSeason * TIME_CONFIG.daysPerSeason;
  return createWeatherSchedule({
    absoluteSeason,
    daysPerSeason: TIME_CONFIG.daysPerSeason,
    seasonCount: TIME_CONFIG.seasons.length,
    isProtectedDay: (index) => {
      const seasonDay = index + 1;
      return (
        isSunday(firstAbsoluteDay + index) ||
        Boolean(METEOR_SHOWER_SCHEDULE[seasonDay]) ||
        (absoluteSeason === 0 && seasonDay <= TUTORIAL_WEEK_DAYS)
      );
    },
    random,
  });
}

export function rollWeatherForSeason(
  seasonIndex: number,
  day = gameState.currentDay,
) {
  const absoluteSeason = Math.floor(day / TIME_CONFIG.daysPerSeason);
  const scheduleKey = String(absoluteSeason);
  const schedule =
    gameState.weatherSchedules[scheduleKey] ||
    (gameState.weatherSchedules[scheduleKey] =
      createSeasonWeatherSchedule(absoluteSeason));
  const seasonDayIndex =
    ((day % TIME_CONFIG.daysPerSeason) + TIME_CONFIG.daysPerSeason) %
    TIME_CONFIG.daysPerSeason;
  // seasonIndex 保留在介面中，讓既有呼叫端不必改；排程以 absolute day 為準。
  void seasonIndex;
  return schedule[seasonDayIndex];
}
gameState.currentSeason = getSeasonIndex(0);
gameState.currentWeather = rollWeatherForSeason(gameState.currentSeason, 0);
gameState.previousWeather = gameState.currentWeather;
// 天氣切換緩衝：換日當下天氣字串還是瞬間換，但視覺強度(雨/雪/閃電/
// 天色)從這個時間點開始花 WEATHER_TRANSITION_SECONDS 秒淡入，不會整片
// 雨/雪瞬間冒出來。weatherChangedAt 在 beginNewDay() 換天氣時更新。
export const WEATHER_TRANSITION_SECONDS = 75;
export function weatherTransitionRamp() {
  return Math.min(
    1,
    (gameState.elapsed - gameState.weatherChangedAt) /
      WEATHER_TRANSITION_SECONDS,
  );
}
export const ANIMAL_INDOOR_WEATHER = new Set([
  "rain",
  "typhoon",
  "storm",
  "snow",
  "blizzard",
]);
export function isUnsafeAnimalWeather() {
  return ANIMAL_INDOOR_WEATHER.has(gameState.currentWeather);
}

// --- 釣魚狀態機：idle → casting（等待咬鉤）→ biting（有限時間內按 E 才算釣到）→ idle ---
export const CAST_ANIM_DURATION = 0.45;

export function nearWater() {
  if (!gameState.player) return false;
  return isNearFishingWater(
    gameState.currentMapName,
    gameState.player.position.x,
    gameState.player.position.z,
  );
}

export function nearAnyNpc() {
  return npcs.some((n) => {
    const dx = gameState.playerGridPos.x - n.mesh.position.x,
      dz = gameState.playerGridPos.z - n.mesh.position.z;
    if (Math.sqrt(dx * dx + dz * dz) <= 4) {
      return true;
    }
    return false;
  });
}
export function isFarmTileObstructed(x: number, z: number) {
  return [...WOOD_NODES, ...STONE_NODES].some(
    (node) =>
      !node.collected &&
      node.map === gameState.currentMapName &&
      node.x === x &&
      node.z === z,
  );
}

export function isPlantingAllowedAt(x: number, z: number) {
  const bounds = gameState.plantingBounds;
  const insideBounds =
    !bounds ||
    (x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ);
  return insideBounds && !isFarmTileObstructed(x, z);
}

export function plantSeed(x: number, z: number) {
  if (!isPlantingAllowedAt(x, z)) return;
  const key = `${x},${z}`;
  if (cropState[key]) return;
  const heldSeedId = inventory.heldItemId;
  const cropType = cropTypeForSeedItem(heldSeedId);
  if (!heldSeedId || !cropType) return;
  const seedCount =
    heldSeedId === "potatoSeeds"
      ? inventory.potatoSeeds
      : heldSeedId === "tomatoSeeds"
        ? inventory.tomatoSeeds
        : inventory.seeds;
  if (seedCount <= 0) return;
  cropState[key] = { stage: 0, plantedDay: gameState.currentDay, cropType };
  if (heldSeedId === "potatoSeeds") inventory.potatoSeeds--;
  else if (heldSeedId === "tomatoSeeds") inventory.tomatoSeeds--;
  else inventory.seeds--;
  const remaining =
    heldSeedId === "potatoSeeds"
      ? inventory.potatoSeeds
      : heldSeedId === "tomatoSeeds"
        ? inventory.tomatoSeeds
        : inventory.seeds;
  if (remaining <= 0) inventory.heldItemId = null;
  nearAnyNpc();
  syncFarmVisuals();
}
export function harvestCrop(x: number, z: number) {
  const key = `${x},${z}`;
  const c = cropState[key];
  if (!c || c.stage < 2) return;
  delete cropState[key];
  inventory.harvested++;
  nearAnyNpc();
  syncFarmVisuals();
}
export function growCropsForNewDay() {
  Object.values(cropState).forEach((c) => {
    c.stage = Math.min(2, gameState.currentDay - c.plantedDay);
  });
}

// ==============================================================
// 花田——資料結構/流程完全照抄上面 cropState/plantSeed/harvestCrop/
// growCropsForNewDay 那一套，差別只在每格記的是「玩家種下去的當下手上
// 拿的是哪種花」(species)，不是固定單一作物種類；沒有獨立的「種子」
// item，種的就是採來的花本身，跟劇本(day2-morning-event.ts 的露比事件)
// 「拿著花可以種、沒拿著可以收」對得上，收成直接退回同物種的花，
// 不用每次都爬山採，也是露比那句「我可能會常去找你」的機制對應。
// 固定 6 格座標見 layout-maps.ts 的 FLOWER_BED_TILES；沒有額外的
// 翻土/工具門檻，跟農地一樣直接種。
// ==============================================================
export const flowerBedState: Record<
  string,
  { stage: number; plantedDay: number; species: FlowerSpeciesId }
> = {};

export function isFlowerBedTile(x: number, z: number) {
  return FLOWER_BED_TILES.some(([fx, fz]) => fx === x && fz === z);
}

export function plantFlowerBed(x: number, z: number) {
  if (!isFlowerBedTile(x, z)) return;
  const key = `${x},${z}`;
  if (flowerBedState[key]) return;
  const heldItemId = inventory.heldItemId;
  if (!heldItemId || !isFlowerSpeciesId(heldItemId)) return;
  if ((inventory.wildflowers[heldItemId] ?? 0) <= 0) return;
  flowerBedState[key] = {
    stage: 0,
    plantedDay: gameState.currentDay,
    species: heldItemId,
  };
  inventory.wildflowers[heldItemId] = Math.max(
    0,
    (inventory.wildflowers[heldItemId] ?? 0) - 1,
  );
  if ((inventory.wildflowers[heldItemId] ?? 0) <= 0)
    inventory.heldItemId = null;
  nearAnyNpc();
  syncFlowerBedVisuals();
}

export function harvestFlowerBed(x: number, z: number) {
  const key = `${x},${z}`;
  const bed = flowerBedState[key];
  if (!bed || bed.stage < 2) return;
  delete flowerBedState[key];
  inventory.wildflowers[bed.species] =
    (inventory.wildflowers[bed.species] ?? 0) + 1;
  nearAnyNpc();
  syncFlowerBedVisuals();
}

export function growFlowerBedForNewDay() {
  Object.values(flowerBedState).forEach((bed) => {
    bed.stage = Math.min(2, gameState.currentDay - bed.plantedDay);
  });
}

// ==============================================================
// 牡蠣養殖架——珍珠系統的採集點，資料結構照抄 FARMLAND_TILES/cropState
// 那一套「位置清單 + 狀態物件」。跟農地不同的地方只有一點：農地的
// 座標同時是「站的格子」也是「畫面上那塊田的位置」，養殖架的浮筏在
// 海裡(玩家不能站上去)，所以拆成兩組座標——OYSTER_RACK_TILES 是玩家
// 站著按 E 採集的沙灘格；OYSTER_RACK_VISUAL 是浮筏本體畫在哪，跟風車
// 的 x/z(碰撞) vs visualX/visualZ(畫面) 是同一招。
// 這次先只放牧場自家海灘這一個點，之後真的要做文蛤/蝦池等其他養殖
// 項目時，往這個清單加新座標就好，不用另外設計系統。
// 每座架子各自記錄採收日；擴建數量同時提高所有已解鎖珍珠的掉落率。
// ==============================================================
// 這裡本來只列 (44,14) 一格，但玩家的碰撞箱半寬是 0.22(見
// input-save.ts 的 collidesAt)，往浮筏方向一路走到底，四個角落裡
// 最靠海那個角落會先撞到 x=46 的海(9)，實際會被擋在中心點約
// x=45.28，四捨五入之後 playerGridPos 落在 (45,14)，不是 (44,14)——
// 也就是玩家自然走到底、感覺「已經站在浮筏旁邊」的那格，反而不算數，
// 這才是「站不上去/採不到」的真正原因，不是判定寫錯。把最靠海這格
// 也一起算進採集點，兩格都能觸發，不用逼玩家往回退一步才踩得中。
export const OYSTER_RACK_LAYOUTS = [
  {
    visual: { x: 46, z: 14 },
    interactionTiles: [
      [44, 14],
      [45, 14],
    ],
  },
  {
    visual: { x: 46, z: 16 },
    interactionTiles: [
      [44, 16],
      [45, 16],
    ],
  },
  {
    visual: { x: 46, z: 18 },
    interactionTiles: [
      [44, 18],
      [45, 18],
    ],
  },
] as const;
export const OYSTER_RACK_VISUAL = OYSTER_RACK_LAYOUTS[0].visual;
export const OYSTER_RACK_TILES = OYSTER_RACK_LAYOUTS[0].interactionTiles;
export const OYSTER_HARVESTS_PER_DAY = 1;
export const OYSTER_YIELD_MIN = 3;
export const OYSTER_YIELD_MAX = 5;
export const oysterRackState: Record<
  string,
  { harvestsToday: number; lastHarvestDay: number }
> = {};

export function setOysterRackSlots(value: number) {
  gameState.oysterRackSlots = normalizeOysterRackSlots(value);
}

export function getActiveOysterRackLayouts() {
  return OYSTER_RACK_LAYOUTS.slice(
    0,
    normalizeOysterRackSlots(gameState.oysterRackSlots),
  );
}

function oysterRackLayoutAt(x: number, z: number) {
  return getActiveOysterRackLayouts().find((layout) =>
    layout.interactionTiles.some(
      ([tileX, tileZ]) => tileX === x && tileZ === z,
    ),
  );
}

export function isOysterRackInteractionTile(x: number, z: number) {
  return Boolean(oysterRackLayoutAt(x, z));
}

function pearlUnlocks() {
  const points = Object.fromEntries(
    VILLAGER_IDS.map((npcId) => [npcId, getRelationship(npcId).points]),
  );
  return {
    black: allVillagersAtSixStars(points),
    gold: storyState.flags["main.completed"] === true,
  };
}

export function harvestOysterRack(x: number, z: number) {
  const layout = oysterRackLayoutAt(x, z);
  if (!layout) return;
  const key = layout.visual.x + "," + layout.visual.z;
  const rackState =
    oysterRackState[key] ||
    (oysterRackState[key] = { harvestsToday: 0, lastHarvestDay: -1 });
  if (rackState.lastHarvestDay !== gameState.currentDay) {
    rackState.harvestsToday = 0;
    rackState.lastHarvestDay = gameState.currentDay;
  }
  if (rackState.harvestsToday >= OYSTER_HARVESTS_PER_DAY) {
    gameState.harvestFeedback = {
      kind: "empty",
      title: "牡蠣架",
      text: "今天已經巡視過了，明天再來看看。",
      until: gameState.elapsed + 2.6,
    };
    return;
  }

  const yieldCount =
    OYSTER_YIELD_MIN +
    Math.floor(Math.random() * (OYSTER_YIELD_MAX - OYSTER_YIELD_MIN + 1));
  inventory.oysters += yieldCount;
  rackState.harvestsToday++;

  const pearl = rollPearl(gameState.oysterRackSlots, pearlUnlocks());
  if (pearl) inventory.pearls[pearl] += 1;
  const pearlLabel = pearl
    ? PEARL_DEFINITIONS.find((entry) => entry.id === pearl)?.label
    : null;
  gameState.harvestFeedback = {
    kind: "success",
    title: "潮間帶巡視",
    text: "牡蠣 ×" + yieldCount + (pearlLabel ? "・" + pearlLabel + " ×1" : ""),
    count: yieldCount,
    until: gameState.elapsed + 2.6,
  };
}

export function isOysterRackReady(index = 0) {
  const layout = getActiveOysterRackLayouts()[index];
  if (!layout) return false;
  const key = layout.visual.x + "," + layout.visual.z;
  const rackState = oysterRackState[key];
  if (!rackState || rackState.lastHarvestDay !== gameState.currentDay)
    return true;
  return rackState.harvestsToday < OYSTER_HARVESTS_PER_DAY;
}

// ==============================================================
// 動物投餵機——放養式簡化模型，規格來源 task.md：
// - 最多存放 FEEDER_CAPACITY 單位，每單位不論動物數量都能餵一天。
// - 安全天氣時動物早上自己出去吃草（見 game-loop.ts 的
//   animalsShouldBeHome，沿用同一顆 isUnsafeAnimalWeather()）；上午 10 點
//   結算「今天吃到了嗎」：安全天氣就從還沒被吃過(或已經過了
//   FEEDER_REGRAZE_DAYS 天)的牧草格裡隨機挑一格標記「今天吃掉」，這一步
//   完全不動投餵機存量；天氣不好則整天不結算放牧，settlePastureGrazing()
//   直接回傳 false。
// - 下午 17 點結算：今天如果沒吃到放牧的草，才消耗一單位投餵機餵食
//   （出外吃草那天不消耗投餵機，兩種結算互斥、不疊加）。
// - 牧草格以「座標 -> 被收割／吃掉的遊戲日」為唯一資料源；視覺高度、
//   玩家收割與 10:00 放牧都讀同一份資料。當天短草、成長中顯示中草，
//   第三天恢復成熟，不再另跑 32 秒即時重生。
// ==============================================================
// 放在牧場邊、穀倉門口(BARN_DOOR)西側，跟穀倉保持距離，不擋動物早晚
// 進出的門口空地——座標選在生活區西側開闊草地，已用 map-debug 確認是
// 平坦草地(tile===0)、不在任何建築/牧草禁區範圍內。
const barnVisualBounds = getScaledBuildingBounds(LAYOUT.barn);
export const FEEDER_VISUAL = Object.freeze({
  x: barnVisualBounds.minX - 0.5,
  z: barnVisualBounds.centerZ,
  width: 0.9,
  depth: (barnVisualBounds.maxZ - barnVisualBounds.minZ) * 0.9,
  height: 1.45,
  interactionRadius: 2.25,
});
export function isPointInsideFeeder(x: number, z: number) {
  return (
    Math.abs(x - FEEDER_VISUAL.x) <= FEEDER_VISUAL.width / 2 + 0.06 &&
    Math.abs(z - FEEDER_VISUAL.z) <= FEEDER_VISUAL.depth / 2 + 0.06
  );
}
export const FEEDER_CAPACITY = 99;
export const FEEDER_REGRAZE_DAYS = 3;
export const pastureDepletedTiles: Record<string, number> = {};

export function pastureGrassStageAt(
  x: number,
  z: number,
  day = gameState.currentDay,
) {
  if (!hasPastureGrassAt(x, z)) return -1;
  const key = x + "," + z;
  const depletedDay = pastureDepletedTiles[key];
  if (depletedDay === undefined) return 2;
  const age = day - depletedDay;
  if (age >= FEEDER_REGRAZE_DAYS) {
    delete pastureDepletedTiles[key];
    return 2;
  }
  return age <= 0 ? 0 : 1;
}

function pastureCandidateTiles(day: number) {
  const p = LAYOUT.pasture;
  const candidates: { x: number; z: number }[] = [];
  for (let z = p.z; z < p.z + p.height; z++) {
    for (let x = p.x; x < p.x + p.width; x++) {
      if (pastureGrassStageAt(x, z, day) !== 2) continue;
      candidates.push({ x, z });
    }
  }
  return candidates;
}

export type PastureHarvestResult =
  | "harvested"
  | "not-grass"
  | "regrowing"
  | "feeder-full"
  | "missing-tool";

export function harvestPastureGrass(
  x: number,
  z: number,
  day = gameState.currentDay,
): PastureHarvestResult {
  if (!hasTool("sickle")) return "missing-tool";
  if (!hasPastureGrassAt(x, z)) return "not-grass";
  if (gameState.feederUnits >= FEEDER_CAPACITY) return "feeder-full";
  if (pastureGrassStageAt(x, z, day) !== 2) return "regrowing";
  pastureDepletedTiles[x + "," + z] = day;
  gameState.feederUnits += 1;
  return "harvested";
}

// 08:00 安全天氣只吃一格成熟牧草；惡劣天氣不結算外草，也不消耗機器。
export function settlePastureGrazing(day = gameState.currentDay) {
  if (!gameState.ownedAnimals?.length || isUnsafeAnimalWeather()) return false;
  const candidates = pastureCandidateTiles(day);
  if (candidates.length === 0) return false;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pastureDepletedTiles[pick.x + "," + pick.z] = day;
  return true;
}

// 17:00 只有當天沒吃到外草時才消耗一單位；動物數量不影響消耗量。
export function settleFeederConsumption() {
  if (!gameState.ownedAnimals?.length || gameState.feederUnits <= 0)
    return false;
  gameState.feederUnits -= 1;
  return true;
}

// ==============================================================
// 採集點（木材/石頭）——每天 06:00、18:00 各產生一個刷新時段，但不在整點
// 立即處理；主角下一次真正切換地圖時，loadMap() 才呼叫 refreshGatherNodes()
// 套用最新時段。每個節點只能採一次，
// 採完立即消失，下個刷新時段重新隨機分布。
// 玩家預設已經拿到斧頭，兩種資源現階段都用同一把斧頭簡化採集，之後
// 「採礦(鐘乳石洞跟山洞)」是完全不同的系統，不是這裡的石頭採集點升級。
// ==============================================================
export type GatherKind = "wood" | "stone" | "flower" | "mushroom";
export const GATHER_YIELD_MIN = 3,
  GATHER_YIELD_MAX = 5;
export interface GatherNode {
  id: string;
  kind: GatherKind;
  map: "livingArea" | "mountain";
  zone: "mountainSide" | "foot" | "waist";
  x: number;
  z: number;
  collected: boolean;
  // 序章荒廢農田固定障礙：跨刷新時段保留，直到玩家親自清除。
  persistent?: boolean;
  // 野花節點專用：哪個物種。wood/stone/mushroom 節點不會有這個欄位。
  species?: FlowerSpeciesId;
  // 蘑菇節點專用：哪個物種。目前只有 "mushroom"(香菇)一種，欄位先留著
  // 給以後其他菇類用，跟 species(野花)分開存、不共用同一個欄位——兩者
  // 型別不同，共用容易在只認得其中一種的既有程式碼裡造成誤判。
  mushroomSpecies?: MushroomSpeciesId;
}
export const WOOD_NODES: GatherNode[] = [];
export const STONE_NODES: GatherNode[] = [];
export const FLOWER_NODES: GatherNode[] = [];
export const MUSHROOM_NODES: GatherNode[] = [];
export const GATHER_NODES_PER_KIND = 3;
// 蘑菇——跟野花共用同一批區域(mountainSide/foot/waist)，但密度低很多：
// 每區固定 1 個節點，不用像 FLOWER_NODES_PER_ZONE 那樣分物種池，因為
// 目前只有香菇一種，直接摘、不需要工具。之後真的加了第二種菇，這裡
// 才需要比照 FLOWER_ZONE_SPECIES 開一張「每區可能物種」的表。
export const MUSHROOM_NODES_PER_ZONE = 1;

// 野花——每區允許的物種池與每次刷新的節點數，對應規格書的密度表：
// 生活區山腳(高密度)/山區平台1(中密度)/山區平台2(中密度)各 3 節點。
// 2026-09-01 拿掉 summit(山頂已經有神社/鳥居/長椅等地標，Zeppelin 反饋
// 野花節點會被擋到，乾脆不放)：藍露草原本是 summit 唯一產地，改併進
// waist(山區平台2)的物種池，跟紅罌粟花一起、不單獨開新區。每個節點的
// 物種在刷新時從對應池子隨機挑一個，不是固定配置。
const FLOWER_ZONE_SPECIES: Record<
  "mountainSide" | "foot" | "waist",
  FlowerSpeciesId[]
> = {
  mountainSide: ["wildDaisy", "dandelion"],
  foot: ["wildDaisy", "pinkWoodSorrel"],
  waist: ["dandelion", "redPoppy", "pinkWoodSorrel", "blueDayflower"],
};
const FLOWER_NODES_PER_ZONE: Record<"mountainSide" | "foot" | "waist", number> = {
  mountainSide: 3,
  foot: 3,
  waist: 3,
};

export function getGatherSpawnSlot(
  day = gameState.currentDay,
  phase = gameState.currentPhase,
) {
  const hour = phase * TIME_CONFIG.gameHoursPerDay;
  return day * 2 + (hour >= 18 ? 1 : hour >= 6 ? 0 : -1);
}

function gatherCandidates(zone: GatherNode["zone"]) {
  const mapName = zone === "mountainSide" ? "livingArea" : "mountain";
  const tiles = MAPS[mapName].tiles;
  const bounds =
    zone === "mountainSide"
      ? LAYOUT.livingArea.gatherZone
      : LAYOUT.mountain[zone];
  const cells: { x: number; z: number }[] = [];
  for (let z = bounds.z; z < bounds.z + bounds.depth; z++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      const tile = tiles[z]?.[x];
      if (tile !== 0 && !(zone !== "mountainSide" && tile === 5)) continue;
      if (
        zone === "mountainSide" &&
        Math.abs(x - MOUNTAIN_GATE_BLOCKER.x) +
          Math.abs(z - MOUNTAIN_GATE_BLOCKER.z) <=
          LAYOUT.livingArea.gatherZone.mountainGateClearance
      )
        continue;
      if (zone !== "mountainSide") {
        const plazas = LAYOUT.mountain.plazas[zone];
        const onPlaza = plazas.some(
          (plaza) =>
            x >= plaza.x &&
            x < plaza.x + plaza.width &&
            z >= plaza.z &&
            z < plaza.z + plaza.depth,
        );
        const nearTree = LAYOUT.mountain.trees.some(
          ([treeX, treeZ]) => Math.abs(treeX - x) + Math.abs(treeZ - z) <= 4,
        );
        if (!onPlaza || !nearTree) continue;
      }
      cells.push({ x, z });
    }
  }
  return cells;
}

function shuffled<T>(values: T[]) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function refreshGatherNodes(force = false) {
  const slot = getGatherSpawnSlot();
  if (!force && gameState.gatherSpawnSlot === slot) return false;
  gameState.gatherSpawnSlot = slot;
  const persistentWood = WOOD_NODES.filter(
    (node) => node.persistent && !node.collected,
  );
  const persistentStone = STONE_NODES.filter(
    (node) => node.persistent && !node.collected,
  );
  WOOD_NODES.splice(0, WOOD_NODES.length, ...persistentWood);
  STONE_NODES.splice(0, STONE_NODES.length, ...persistentStone);
  // 野花/蘑菇節點目前沒有 persistent 用例，直接整批清空重灑。
  FLOWER_NODES.length = 0;
  MUSHROOM_NODES.length = 0;
  const usedByMap = new Map<string, { x: number; z: number }[]>();
  [...persistentWood, ...persistentStone].forEach((node) => {
    const used = usedByMap.get(node.map) || [];
    usedByMap.set(node.map, used);
    used.push({ x: node.x, z: node.z });
  });
  const zones: GatherNode["zone"][] = ["mountainSide", "foot", "waist"];
  for (const zone of zones) {
    const map = zone === "mountainSide" ? "livingArea" : "mountain";
    const used = usedByMap.get(map) || [];
    usedByMap.set(map, used);
    const candidates = shuffled(gatherCandidates(zone));
    for (const kind of ["wood", "stone"] as const) {
      for (let index = 0; index < GATHER_NODES_PER_KIND; index++) {
        const pickIndex = candidates.findIndex((cell) =>
          used.every(
            (taken) =>
              Math.abs(taken.x - cell.x) + Math.abs(taken.z - cell.z) >= 2,
          ),
        );
        if (pickIndex < 0) throw new Error(`採集點候選格不足：${zone}/${kind}`);
        const [cell] = candidates.splice(pickIndex, 1);
        used.push(cell);
        (kind === "wood" ? WOOD_NODES : STONE_NODES).push({
          id: `${zone}-${kind}-${index}`,
          kind,
          map,
          zone,
          ...cell,
          collected: false,
        });
      }
    }
  }
  // 野花節點——沿用同一套刷新時段與候選格演算法、跟木材/石頭完全
  // 相同的三個區域(mountainSide/foot/waist)，出現範圍不額外擴大。每個
  // 節點的物種在這裡隨機從 FLOWER_ZONE_SPECIES[zone] 挑一個。
  const flowerZones: ("mountainSide" | "foot" | "waist")[] = [
    "mountainSide",
    "foot",
    "waist",
  ];
  for (const zone of flowerZones) {
    const map = zone === "mountainSide" ? "livingArea" : "mountain";
    const used = usedByMap.get(map) || [];
    usedByMap.set(map, used);
    const candidates = shuffled(gatherCandidates(zone));
    const speciesPool = FLOWER_ZONE_SPECIES[zone];
    const count = FLOWER_NODES_PER_ZONE[zone];
    for (let index = 0; index < count; index++) {
      const pickIndex = candidates.findIndex((cell) =>
        used.every(
          (taken) =>
            Math.abs(taken.x - cell.x) + Math.abs(taken.z - cell.z) >= 2,
        ),
      );
      if (pickIndex < 0)
        throw new Error(`採集點候選格不足：${zone}/flower`);
      const [cell] = candidates.splice(pickIndex, 1);
      used.push(cell);
      const species =
        speciesPool[Math.floor(Math.random() * speciesPool.length)];
      FLOWER_NODES.push({
        id: `${zone}-flower-${index}`,
        kind: "flower",
        map,
        zone,
        species,
        ...cell,
        collected: false,
      });
    }
  }
  // 蘑菇節點——跟野花同一套刷新時段/候選格演算法、同一批三個區域，只是
  // 密度低很多(每區固定 1 個)，而且不吃工具檢查(摘香菇不用鐮刀/斧頭，
  // hasTool 判定留在 harvestMushroomNode() 裡確認過永遠成立就好，這裡
  // 不用另外過濾)。Zeppelin：「一區一個一個就好」。
  for (const zone of flowerZones) {
    const map = zone === "mountainSide" ? "livingArea" : "mountain";
    const used = usedByMap.get(map) || [];
    usedByMap.set(map, used);
    const candidates = shuffled(gatherCandidates(zone));
    for (let index = 0; index < MUSHROOM_NODES_PER_ZONE; index++) {
      const pickIndex = candidates.findIndex((cell) =>
        used.every(
          (taken) =>
            Math.abs(taken.x - cell.x) + Math.abs(taken.z - cell.z) >= 2,
        ),
      );
      if (pickIndex < 0)
        throw new Error(`採集點候選格不足：${zone}/mushroom`);
      const [cell] = candidates.splice(pickIndex, 1);
      used.push(cell);
      MUSHROOM_NODES.push({
        id: `${zone}-mushroom-${index}`,
        kind: "mushroom",
        map,
        zone,
        mushroomSpecies: "mushroom",
        ...cell,
        collected: false,
      });
    }
  }
  return true;
}

export function harvestGatherNode(
  kind: Exclude<GatherKind, "flower">,
  x: number,
  z: number,
) {
  if (!hasTool("dualAxe")) return 0;
  const label = kind === "wood" ? "木材" : "石頭";
  const node = (kind === "wood" ? WOOD_NODES : STONE_NODES).find(
    (candidate) =>
      candidate.x === x && candidate.z === z && !candidate.collected,
  );
  if (!node) return 0;
  const amount =
    GATHER_YIELD_MIN +
    Math.floor(Math.random() * (GATHER_YIELD_MAX - GATHER_YIELD_MIN + 1));
  if (kind === "wood") inventory.wood += amount;
  else inventory.stone += amount;
  node.collected = true;
  gameState.harvestFeedback = {
    kind: "success",
    title: kind === "wood" ? "揮斧砍柴" : "揮斧敲石",
    text: `${label} ×${amount}`,
    count: amount,
    until: gameState.elapsed + 2.6,
  };
  return amount;
}

// 野花採集——跟 harvestGatherNode 同一套判定/回饋模式，但工具是鐮刀
// (跟牧場割草共用同一把)，且產量寫回 inventory.wildflowers[物種]，不是
// 單一計數欄位，所以獨立成一個函式，不硬塞進 harvestGatherNode 的
// wood/stone 二選一邏輯裡。
export function harvestFlowerNode(x: number, z: number) {
  if (!hasTool("sickle")) return 0;
  const node = FLOWER_NODES.find(
    (candidate) =>
      candidate.x === x &&
      candidate.z === z &&
      !candidate.collected &&
      candidate.species,
  );
  if (!node || !node.species) return 0;
  const amount =
    GATHER_YIELD_MIN +
    Math.floor(Math.random() * (GATHER_YIELD_MAX - GATHER_YIELD_MIN + 1));
  inventory.wildflowers[node.species] += amount;
  node.collected = true;
  gameState.harvestFeedback = {
    kind: "success",
    title: "採花",
    text: `${flowerSpeciesLabel(node.species)} ×${amount}`,
    count: amount,
    until: gameState.elapsed + 2.6,
  };
  return amount;
}

// 蘑菇採集——跟 harvestFlowerNode 同一套模式，但「直接可以摘」不用檢查
// hasTool()，也沒有季節限定(四季都有，跟野花一樣)。目前只有香菇一種，
// 產量寫回 inventory.mushrooms(既有欄位，沒有另外開 wildflowers 那種
// per-species 表——之後真的加第二種菇時再參考野花的做法擴充)。
export function harvestMushroomNode(x: number, z: number) {
  const node = MUSHROOM_NODES.find(
    (candidate) =>
      candidate.x === x &&
      candidate.z === z &&
      !candidate.collected &&
      candidate.mushroomSpecies,
  );
  if (!node || !node.mushroomSpecies) return 0;
  const amount =
    GATHER_YIELD_MIN +
    Math.floor(Math.random() * (GATHER_YIELD_MAX - GATHER_YIELD_MIN + 1));
  inventory.mushrooms += amount;
  node.collected = true;
  gameState.harvestFeedback = {
    kind: "success",
    title: "採香菇",
    text: `${mushroomSpeciesLabel(node.mushroomSpecies)} ×${amount}`,
    count: amount,
    until: gameState.elapsed + 2.6,
  };
  return amount;
}
refreshGatherNodes();

// ==============================================================
// 料理系統：食譜 ID 永久保存，來源可由 NPC、書架或事件解鎖。
// 材料可來自背包與倉庫；來源偏好只影響扣除順序，總量不足時不可料理。
// ==============================================================
export type CookingIngredientId = "harvested" | "mushroom" | "fish" | "oysters";

export interface Recipe {
  id: string;
  name: string;
  tier: "普通" | "喜歡" | "最愛";
  cost: Partial<Record<CookingIngredientId, number>>;
}

export const RECIPES: Recipe[] = [
  { id: "grilledVeggie", name: "烤蔬菜", tier: "普通", cost: { harvested: 2 } },
  { id: "seafoodSoup", name: "海鮮湯", tier: "普通", cost: { fish: 2 } },
  {
    id: "mushroomSkewer",
    name: "烤蘑菇串",
    tier: "普通",
    cost: { mushroom: 2 },
  },
  {
    id: "garlicGreens",
    name: "蒜炒野菜",
    tier: "喜歡",
    cost: { harvested: 3 },
  },
  { id: "bakedOyster", name: "奶油烤牡蠣", tier: "喜歡", cost: { oysters: 2 } },
  {
    id: "islandPlatter",
    name: "島嶼海鮮拼盤",
    tier: "最愛",
    cost: { fish: 2, oysters: 1, harvested: 1 },
  },
];

const RECIPE_TIER_RANK: Record<Recipe["tier"], number> = {
  最愛: 2,
  喜歡: 1,
  普通: 0,
};

export type CookingSourcePreference = Partial<
  Record<CookingIngredientId, "bag" | "storage">
>;

const bagIngredientAmount = (id: CookingIngredientId) =>
  id === "mushroom" ? inventory.mushrooms : inventory[id];

const setBagIngredientAmount = (id: CookingIngredientId, amount: number) => {
  if (id === "mushroom") inventory.mushrooms = amount;
  else inventory[id] = amount;
};

export function learnRecipes(recipeIds: string[]) {
  const known = new Set(inventory.learnedRecipes);
  recipeIds.forEach((id) => {
    if (RECIPES.some((recipe) => recipe.id === id)) known.add(id);
  });
  inventory.learnedRecipes = [...known];
}

export function canAffordRecipe(recipe: Recipe) {
  return (Object.entries(recipe.cost) as [CookingIngredientId, number][]).every(
    ([id, amount]) =>
      bagIngredientAmount(id) + (inventory.storage[id] || 0) >= amount,
  );
}

export function cookRecipe(
  recipeId: string,
  preferences: CookingSourcePreference = {},
): Recipe | null {
  const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
  if (
    !recipe ||
    !inventory.learnedRecipes.includes(recipe.id) ||
    !canAffordRecipe(recipe)
  )
    return null;

  (Object.entries(recipe.cost) as [CookingIngredientId, number][]).forEach(
    ([id, required]) => {
      const preferStorage = preferences[id] === "storage";
      const bag = bagIngredientAmount(id);
      const stored = Math.max(0, inventory.storage[id] || 0);
      const fromStorage = preferStorage
        ? Math.min(stored, required)
        : Math.max(0, required - bag);
      const fromBag = required - fromStorage;
      setBagIngredientAmount(id, bag - fromBag);
      const nextStored = stored - fromStorage;
      if (nextStored > 0) inventory.storage[id] = nextStored;
      else delete inventory.storage[id];
    },
  );

  inventory.dishes[recipe.id] = (inventory.dishes[recipe.id] || 0) + 1;
  gameState.harvestFeedback = {
    kind: "success",
    title: "料理完成",
    text: `${recipe.name}（${recipe.tier}）×1`,
    until: gameState.elapsed + 2.6,
  };
  return recipe;
}

// 舊呼叫點相容：只從已解鎖且材料足夠的食譜自動挑選。
export function cookMeal(): Recipe | null {
  const recipe = RECIPES.filter(
    (item) =>
      inventory.learnedRecipes.includes(item.id) && canAffordRecipe(item),
  ).sort((a, b) => RECIPE_TIER_RANK[b.tier] - RECIPE_TIER_RANK[a.tier])[0];
  return recipe ? cookRecipe(recipe.id) : null;
}
