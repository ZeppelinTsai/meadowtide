export const MAX_EXTREME_WEATHER_PER_SEASON = 2;

// 2026-09-04 新增：獨立於 createWeatherSchedule() 之外的「教學周永遠
// 晴天」判斷式，故意抽成不依賴 gameState/game-state.ts 的純函式——
// game-state.ts 那條 import 鏈會一路拉到 scene-sky.ts 建 WebGLRenderer，
// 在 Node 測試環境(tsx --test，沒有 DOM/canvas)會直接炸掉，這個檔案
// 一直以來就是刻意留給「跟遊戲全域狀態無關的天氣排程算法」用，才能被
// weather-schedule.test.ts 正常測到。rollWeatherForSeason()(game-state.ts)
// 呼叫這個函式來決定要不要略過(可能過期的)排程快取，直接回傳 clear。
// 2026-09-04 新增：天氣轉換緩衝的共用純函式。原本只有雲量
// (cloudOpacityByWeather)、天色濃淡(weatherShadeByWeather)、雨/雪粒子
// opacity 這幾處各自手寫一次「previousWeather 的值 lerp 到
// currentWeather 的值，lerp 係數用 weatherTransitionRamp()」，其餘會
// 隨天氣改變的視覺量(色調曝光、環境光/太陽光強度、雨雪粒子數量/是否
// 顯示…)反而直接看 gameState.currentWeather 硬切，換天氣那一幀就會
// 瞬間跳掉，跟 Zeppelin 反饋的「晴陰雨雪大雪颱風轉換要有緩衝效果」是
// 同一類問題。抽成一個共用的純函式，不吃 gameState，方便在 Node 測試
// 環境直接測到(不像 game-loop.ts/scene-sky.ts 那樣拉到
// WebGLRenderer)，game-state.ts 再包一層讀 gameState 目前值的版本给
// 各處呼叫。
export function blendWeatherValue(
  previousWeather: string,
  currentWeather: string,
  ramp: number,
  valuesByWeather: Partial<Record<string, number>>,
  fallback = 0,
): number {
  const from = valuesByWeather[previousWeather] ?? fallback;
  const to = valuesByWeather[currentWeather] ?? fallback;
  const clampedRamp = Math.max(0, Math.min(1, ramp));
  return from + (to - from) * clampedRamp;
}

export function isTutorialWeekDay(
  absoluteSeason: number,
  seasonDayIndex: number,
  tutorialWeekDays: number,
): boolean {
  return absoluteSeason === 0 && seasonDayIndex + 1 <= tutorialWeekDays;
}

export interface WeatherScheduleOptions {
  absoluteSeason: number;
  daysPerSeason: number;
  seasonCount: number;
  isProtectedDay: (seasonDayIndex: number) => boolean;
  random?: () => number;
}

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

export function createWeatherSchedule({
  absoluteSeason,
  daysPerSeason,
  seasonCount,
  isProtectedDay,
  random = Math.random,
}: WeatherScheduleOptions) {
  const seasonIndex =
    ((absoluteSeason % seasonCount) + seasonCount) % seasonCount;
  const schedule: string[] = Array.from({ length: daysPerSeason }, () =>
    rollOrdinaryWeather(seasonIndex, random),
  );
  const protectedDays = new Set<number>();

  for (let index = 0; index < schedule.length; index++) {
    if (isProtectedDay(index)) {
      schedule[index] = "clear";
      protectedDays.add(index);
    }
  }

  if (seasonIndex !== 1 && seasonIndex !== 3) return schedule;
  const transitionWeather = seasonIndex === 1 ? "rain" : "snow";
  const candidates = Array.from(
    { length: Math.max(0, schedule.length - 2) },
    (_, index) => index + 1,
  ).filter(
    (center) =>
      !protectedDays.has(center - 1) &&
      !protectedDays.has(center) &&
      !protectedDays.has(center + 1),
  );

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
