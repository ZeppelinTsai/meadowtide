import * as THREE from "three";
import { hash2 } from "./utils";
import { LAYOUT, MAPS, isInsideLakeShape } from "./layout-maps";
import { npcs } from "./npc-runtime";
import { syncFarmVisuals } from "./farm-visuals";

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
};

export const inventory = {
  seeds: 1,
  harvested: 0,
  fish: 0,
  wood: 10,
  stone: 5,
  oysters: 0,
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

export const MAX_EXTREME_WEATHER_PER_SEASON = 2;

function rollOrdinaryWeather(seasonIndex: number, random: () => number) {
  const r = random();
  if (seasonIndex === 0)
    return r < 0.55 ? "clear" : r < 0.72 ? "cloudy" : "rain";
  if (seasonIndex === 1)
    return r < 0.62 ? "clear" : r < 0.77 ? "cloudy" : "rain";
  if (seasonIndex === 2)
    return r < 0.58 ? "clear" : r < 0.76 ? "cloudy" : "rain";
  return r < 0.53 ? "clear" : r < 0.71 ? "cloudy" : "snow";
}

export function createSeasonWeatherSchedule(
  absoluteSeason: number,
  random: () => number = Math.random,
) {
  const seasonIndex =
    ((absoluteSeason % TIME_CONFIG.seasons.length) + TIME_CONFIG.seasons.length) %
    TIME_CONFIG.seasons.length;
  const firstAbsoluteDay = absoluteSeason * TIME_CONFIG.daysPerSeason;
  const schedule: string[] = Array.from(
    { length: TIME_CONFIG.daysPerSeason },
    () => rollOrdinaryWeather(seasonIndex, random),
  );
  const protectedDays = new Set<number>();

  for (let index = 0; index < schedule.length; index++) {
    const seasonDay = index + 1;
    const absoluteDay = firstAbsoluteDay + index;
    if (isSunday(absoluteDay) || METEOR_SHOWER_SCHEDULE[seasonDay]) {
      schedule[index] = "clear";
      protectedDays.add(index);
    }
  }

  const transitionWeather = seasonIndex === 1 ? "rain" : "snow";
  if (seasonIndex !== 1 && seasonIndex !== 3) return schedule;

  const candidates = Array.from(
    { length: Math.max(0, schedule.length - 2) },
    (_, index) => index + 1,
  ).filter(
    (center) =>
      !protectedDays.has(center - 1) &&
      !protectedDays.has(center) &&
      !protectedDays.has(center + 1),
  );

  // Fisher-Yates 洗牌後依序挑選不重疊的三日區段。
  for (let index = candidates.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [
      candidates[swapIndex],
      candidates[index],
    ];
  }
  const chosenCenters: number[] = [];
  for (const center of candidates) {
    if (chosenCenters.some((chosen) => Math.abs(chosen - center) <= 2)) continue;
    chosenCenters.push(center);
    if (chosenCenters.length === MAX_EXTREME_WEATHER_PER_SEASON) break;
  }

  for (const center of chosenCenters) {
    schedule[center - 1] = transitionWeather;
    schedule[center] =
      seasonIndex === 1 ? (random() < 0.62 ? "typhoon" : "storm") : "blizzard";
    schedule[center + 1] = transitionWeather;
  }
  return schedule;
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
  const key = `${x},${z}`;
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
