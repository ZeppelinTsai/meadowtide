import * as THREE from "three";
import { hash2 } from "./utils";
import { LAYOUT, MAPS, isInsideLakeShape } from "./layout-maps";
import { npcs, hasPastureGrassAt } from "./npc-runtime";
import { syncFarmVisuals } from "./farm-visuals";
import { createWeatherSchedule } from "./weather-schedule";
import { getScaledBuildingBounds } from "./building-scale";
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
  pouchCollectedDay: -1,
  currentDay: 0,
  currentPhase: 0, // 一天中的比例(0~1)，animate() 每幀更新，E 鍵事件也要讀
  currentSeason: 0, // 下面初始化時會用 getSeasonIndex(0) 覆蓋
  currentWeather: "clear" as string, // 下面初始化時會用 rollWeatherForSeason 覆蓋
  previousWeather: "clear" as string,
  weatherChangedAt: 0,
  // 每個 21 天季節預先產生完整天氣，才能保證極端天氣前後的過渡日。
  // key 是從遊戲開局起算的絕對季節編號，不只用 0~3 的季節索引。
  weatherSchedules: {} as Record<string, string[]>,
  fishingState: "idle" as string,
  fishingTimer: 0,
  biteWaitTime: 0,
  biteWindowStart: 0,
  bobberMesh: null as THREE.Object3D | null,
  fishFeedback: null as { text: string; until: number } | null,
  // 牡蠣架收成的 UI 回饋——跟 fishFeedback 同一套「elapsed 到期就清掉」
  // 的做法，animate() 每幀讀這個物件去更新 #harvestToast。
  harvestFeedback: null as {
    kind: "success" | "empty";
    title: string;
    text: string;
    count?: number;
    until: number;
  } | null,
  // 牡蠣架上「還沒收成」那批殼用的共用材質——makeOysterRack() 建好之後把
  // 材質丟回這裡，animate() 每幀根據 isOysterRackReady() 幫它調
  // emissiveIntensity，達到「還能採就發光、採完就暗下來」的效果。
  oysterGlowMat: null as THREE.MeshStandardMaterial | null,
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
  portWaterMeshes: [] as THREE.Mesh[],
  lakeMesh: null as THREE.Mesh | null, // 湖面，跟海一樣是合併網格，只是波浪幅度小很多、沒有碎浪
  seaGlimpseMesh: null as THREE.Mesh | null, // 北邊的遠方海景背景板，會輕輕起伏
  mapGroup: new THREE.Group(),
  player: undefined as any,
  currentMapName: "livingArea",
  playerGridPos: { x: 0, z: 0 },
  facing: "down",
  isMoving: false,
  isSitting: false,
  houseLampLight: null as THREE.PointLight | null,
  houseLampBulbMat: null as THREE.MeshStandardMaterial | null,
  ePressed: false,
  lastFrame: 0, // main.ts 啟動迴圈時會用 performance.now() 設一次
  prevDay: 0,
  animationFrameCount: 0,
  grassAnimationAccumulator: 0,
  hudUpdateAccumulator: 0,
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
  seeds: 1,
  harvested: 0,
  fish: 0,
  wood: 10,
  stone: 5,
  oysters: 0,
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
};
export const cropState: Record<string, { stage: number; plantedDay: number }> =
  {};

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
    .lerp(new THREE.Color(AUTUMN_GRASS_MAPLE_YELLOW), hash2(seed * 3.7, seed * 1.3))
    .offsetHSL(0, 0, (seed - 0.5) * 0.06);
}
export function getSeasonGrassTone(seasonIndex = gameState.currentSeason) {
  const key = TIME_CONFIG.seasons[seasonIndex] as keyof typeof SEASON_GRASS_TONES;
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
  13: Object.freeze({ phase: "peak", minPerHour: 18, maxPerHour: 26 }),
  14: Object.freeze({ phase: "fading", minPerHour: 6, maxPerHour: 9 }),
});
export const METEOR_SHOWER_PHASE_NAMES: Record<string, string> = Object.freeze({
  approach: "流星雨前夕",
  rising: "流星雨增強",
  peak: "流星雨高峰",
  fading: "流星雨漸弱",
});
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
        Boolean(METEOR_SHOWER_SCHEDULE[seasonDay])
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
  const seasonDayIndex = ((day % TIME_CONFIG.daysPerSeason) + TIME_CONFIG.daysPerSeason) %
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
  if (gameState.currentMapName !== "livingArea") return false;
  const map = MAPS.livingArea;
  const { x, z } = gameState.playerGridPos;
  const nearOcean = [
    [x + 1, z],
    [x - 1, z],
    [x, z + 1],
    [x, z - 1],
  ].some(([nx, nz]) => {
    if (nz < 0 || nz >= map.tiles.length || nx < 0 || nx >= map.tiles[0].length)
      return false;
    return map.tiles[nz][nx] === 9;
  });
  if (nearOcean) return true;
  // 岸石有碰撞後玩家會站得稍遠；加長偵測距離，仍可隔著石頭向湖內拋竿。
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    if (
      isInsideLakeShape(
        gameState.player.position.x + Math.cos(angle) * 1.35,
        gameState.player.position.z + Math.sin(angle) * 1.35,
      )
    )
      return true;
  }
  return false;
}

export function nearAnyNpc() {
  return npcs.some((n) => {
    const dx = gameState.playerGridPos.x - n.mesh.position.x,
      dz = gameState.playerGridPos.z - n.mesh.position.z;
    if (Math.sqrt(dx * dx + dz * dz) <= 4) {
      n.memory++;
      return true;
    }
    return false;
  });
}
export function plantSeed(x: number, z: number) {
  const key = `${x},${z}`;
  if (cropState[key] || inventory.seeds <= 0) return;
  cropState[key] = { stage: 0, plantedDay: gameState.currentDay };
  inventory.seeds--;
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
export function pickupSeeds() {
  if (gameState.currentDay <= gameState.pouchCollectedDay) return;
  gameState.pouchCollectedDay = gameState.currentDay;
  inventory.seeds += 3;
  syncFarmVisuals();
}
export function growCropsForNewDay() {
  Object.values(cropState).forEach((c) => {
    c.stage = Math.min(2, gameState.currentDay - c.plantedDay);
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
// 珍珠判定系統這輪還沒接（暫停中，等牡蠣架視覺/位置確認過再繼續）。
// ==============================================================
// 這裡本來只列 (44,14) 一格，但玩家的碰撞箱半寬是 0.22(見
// input-save.ts 的 collidesAt)，往浮筏方向一路走到底，四個角落裡
// 最靠海那個角落會先撞到 x=46 的海(9)，實際會被擋在中心點約
// x=45.28，四捨五入之後 playerGridPos 落在 (45,14)，不是 (44,14)——
// 也就是玩家自然走到底、感覺「已經站在浮筏旁邊」的那格，反而不算數，
// 這才是「站不上去/採不到」的真正原因，不是判定寫錯。把最靠海這格
// 也一起算進採集點，兩格都能觸發，不用逼玩家往回退一步才踩得中。
export const OYSTER_RACK_TILES = [
  [44, 14],
  [45, 14],
];
export const OYSTER_RACK_VISUAL = { x: 46, z: 14 };
export const OYSTER_HARVESTS_PER_DAY = 1; // 放養式養殖：一天巡一次就好，
// 不是能重複伸手撈的採集點——跟農地/釣魚那種可以來回刷的機制刻意不同。
export const OYSTER_YIELD_MIN = 3,
  OYSTER_YIELD_MAX = 5; // 每次收成 3~5 個
export const oysterRackState: Record<
  string,
  { harvestsToday: number; lastHarvestDay: number }
> = {};
export function harvestOysterRack(x: number, z: number) {
  // 用浮筏本體的固定座標當這個養殖點的身分證，不要用玩家站的那格——
  // OYSTER_RACK_TILES 現在有兩格都能觸發收成(44,14 跟 45,14)，兩格其實
  // 是同一座浮筏，要共用同一份「今天採過了嗎」的狀態，不能各自獨立算。
  const key = `${OYSTER_RACK_VISUAL.x},${OYSTER_RACK_VISUAL.z}`;
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
  // TODO(珍珠系統下一階段)：這裡之後要接珍珠判定——每次收成動作各自
  // 判定粉/黑/金三個等級，機率獨立(20%/10%/5%)，解鎖條件另外處理。
  // 現在先只累加生牡蠣數量，讓採集點本身可以先測試。
  gameState.harvestFeedback = {
    kind: "success",
    title: "潮間帶巡視",
    text: `牡蠣 ×${yieldCount}`,
    count: yieldCount,
    until: gameState.elapsed + 2.6,
  };
}

// 牡蠣架現在還採不採得到——給 game-loop.ts 的 animate() 用來決定殼要不要
// 發光。跟 harvestOysterRack() 共用同一把 key，兩邊判斷永遠一致，不會
// 出現「UI 顯示還在發光，實際按 E 卻說今天採過了」這種對不上的情況。
export function isOysterRackReady() {
  const key = `${OYSTER_RACK_VISUAL.x},${OYSTER_RACK_VISUAL.z}`;
  const rackState = oysterRackState[key];
  if (!rackState || rackState.lastHarvestDay !== gameState.currentDay)
    return true;
  return rackState.harvestsToday < OYSTER_HARVESTS_PER_DAY;
}

// ==============================================================
// 動物投餵機——放養式簡化模型，規格來源 task.md：
// - 最多存放 FEEDER_CAPACITY 單位，每單位不論動物數量都能餵一天。
// - 安全天氣時動物早上自己出去吃草（見 game-loop.ts 的
//   animalsShouldBeHome，沿用同一顆 isUnsafeAnimalWeather()）；早上 8 點
//   結算「今天吃到了嗎」：安全天氣就從還沒被吃過(或已經過了
//   FEEDER_REGRAZE_DAYS 天)的牧草格裡隨機挑一格標記「今天吃掉」，這一步
//   完全不動投餵機存量；天氣不好則整天不結算放牧，settlePastureGrazing()
//   直接回傳 false。
// - 傍晚 18 點結算：今天如果沒吃到放牧的草，才消耗一單位投餵機餵食
//   （出外吃草那天不消耗投餵機，兩種結算互斥、不疊加）。
// - 牧草格用「座標 -> 被吃掉的遊戲天數」這份純資料模擬，跟
//   pastureGrassBlades 那套 32 秒即時循環的裝飾動畫是兩個不同時間尺度，
//   故意不耦合——玩家看到的草叢搖擺/變短是純演出，格子「還能不能被
//   放牧吃到」是這裡另外算的天數制。
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

function pastureCandidateTiles(day: number) {
  const p = LAYOUT.pasture;
  const candidates: { x: number; z: number }[] = [];
  for (let z = p.z; z < p.z + p.height; z++) {
    for (let x = p.x; x < p.x + p.width; x++) {
      if (!hasPastureGrassAt(x, z)) continue;
      const eatenDay = pastureDepletedTiles[`${x},${z}`];
      if (eatenDay !== undefined && day - eatenDay < FEEDER_REGRAZE_DAYS)
        continue;
      candidates.push({ x, z });
    }
  }
  return candidates;
}

// 早上 8 點呼叫一次。天氣不好就整天不結算，回傳 false；安全天氣但剛好
// 找不到候選格（理論上不會發生，牧草格遠多於 99）也回傳 false。回傳值
// 只給傍晚的 settleFeederConsumption() 判斷要不要改吃投餵機用。
export function settlePastureGrazing(day = gameState.currentDay) {
  if (isUnsafeAnimalWeather()) return false;
  const candidates = pastureCandidateTiles(day);
  if (candidates.length === 0) return false;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pastureDepletedTiles[`${pick.x},${pick.z}`] = day;
  return true;
}

// 傍晚 18 點呼叫一次（只在今天沒吃到放牧的草時呼叫）。回傳有沒有成功
// 消耗到投餵機（false 代表投餵機也是空的）。
export function settleFeederConsumption() {
  if (gameState.feederUnits <= 0) return false;
  gameState.feederUnits -= 1;
  return true;
}

// 補料——目前免費全部補滿，補多少單位、要不要消耗其他資源之後有經濟
// 系統再另外設計；先讓機制本身能測試。回傳實際補了多少單位。
export function refillFeeder() {
  const added = FEEDER_CAPACITY - gameState.feederUnits;
  gameState.feederUnits = FEEDER_CAPACITY;
  return added;
}

// ==============================================================
// 採集點（木材/石頭）——每天 06:00、18:00 各產生一個刷新時段，但不在整點
// 立即處理；主角下一次真正切換地圖時，loadMap() 才呼叫 refreshGatherNodes()
// 套用最新時段。每個節點只能採一次，
// 採完立即消失，下個刷新時段重新隨機分布。
// 玩家預設已經拿到斧頭，兩種資源現階段都用同一把斧頭簡化採集，之後
// 「採礦(鐘乳石洞跟山洞)」是完全不同的系統，不是這裡的石頭採集點升級。
// ==============================================================
export type GatherKind = "wood" | "stone";
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
}
export const WOOD_NODES: GatherNode[] = [];
export const STONE_NODES: GatherNode[] = [];

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
      ? { x: 0, z: 1, width: 4, depth: tiles.length - 2 }
      : LAYOUT.mountain[zone];
  const cells: { x: number; z: number }[] = [];
  for (let z = bounds.z; z < bounds.z + bounds.depth; z++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      const tile = tiles[z]?.[x];
      if (tile !== 0 && !(zone !== "mountainSide" && tile === 5)) continue;
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
  WOOD_NODES.length = 0;
  STONE_NODES.length = 0;
  const usedByMap = new Map<string, { x: number; z: number }[]>();
  const zones: GatherNode["zone"][] = ["mountainSide", "foot", "waist"];
  for (const zone of zones) {
    const map = zone === "mountainSide" ? "livingArea" : "mountain";
    const used = usedByMap.get(map) || [];
    usedByMap.set(map, used);
    const candidates = shuffled(gatherCandidates(zone));
    for (const kind of ["wood", "stone"] as const) {
      for (let index = 0; index < 5; index++) {
        const pickIndex = candidates.findIndex((cell) =>
          used.every((taken) => Math.abs(taken.x - cell.x) + Math.abs(taken.z - cell.z) >= 2),
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
  return true;
}

export function harvestGatherNode(kind: GatherKind, x: number, z: number) {
  const label = kind === "wood" ? "木材" : "石頭";
  const node = (kind === "wood" ? WOOD_NODES : STONE_NODES).find(
    (candidate) => candidate.x === x && candidate.z === z && !candidate.collected,
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
refreshGatherNodes();

// ==============================================================
// 通用料理系統——房子廚房的爐台前按 E 直接開煮，不做選單：自動挑目前
// 食材做得出、等級最高的那一道，跟採集/牡蠣「靠近按 E 就決定結果」是
// 同一套互動慣例。等級(普通/喜歡/最愛)沿用 task.md 好感度禮物的同一套
// 詞彙，之後要把煮好的成品拿去當贈禮用，不用再另外設計一套料理品質
// 稱呼。食材只吃得到已經有型別的資源(收成/魚/牡蠣)，作物種類還沒分
// 型，所以先不分蔬菜/肉類這種更細的食譜條件。
// ==============================================================
export interface Recipe {
  id: string;
  name: string;
  tier: "普通" | "喜歡" | "最愛";
  cost: Partial<Record<"harvested" | "fish" | "oysters", number>>;
}
export const RECIPES: Recipe[] = [
  { id: "grilledVeggie", name: "烤蔬菜", tier: "普通", cost: { harvested: 2 } },
  { id: "seafoodSoup", name: "海鮮湯", tier: "普通", cost: { fish: 2 } },
  { id: "garlicGreens", name: "蒜炒野菜", tier: "喜歡", cost: { harvested: 3 } },
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

function canAffordRecipe(recipe: Recipe) {
  return (Object.entries(recipe.cost) as [keyof typeof recipe.cost, number][]).every(
    ([key, amount]) => inventory[key as "harvested" | "fish" | "oysters"] >= amount,
  );
}

// 爐台前按 E 呼叫——食材做得出的食譜裡挑等級最高的那個，同等級照
// RECIPES 陣列順序(陣列本身已經照「越晚出現越講究」排好)挑第一個；
// 一道都做不出來就回傳 null，並丟出提示今天食材不夠。
export function cookMeal(): Recipe | null {
  const affordable = RECIPES.filter(canAffordRecipe).sort(
    (a, b) => RECIPE_TIER_RANK[b.tier] - RECIPE_TIER_RANK[a.tier],
  );
  const recipe = affordable[0];
  if (!recipe) {
    gameState.harvestFeedback = {
      kind: "empty",
      title: "廚房",
      text: "食材不夠，煮不出任何一道菜",
      until: gameState.elapsed + 2.6,
    };
    return null;
  }
  (Object.entries(recipe.cost) as ["harvested" | "fish" | "oysters", number][]).forEach(
    ([key, amount]) => {
      inventory[key] -= amount;
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
