export const MAX_EXTREME_WEATHER_PER_SEASON = 2;

// 2026-09-04 新增：獨立於 createWeatherSchedule() 之外的「教學周永遠
// 晴天」判斷式，故意抽成不依賴 gameState/game-state.ts 的純函式——
// game-state.ts 那條 import 鏈會一路拉到 scene-sky.ts 建 WebGLRenderer，
// 在 Node 測試環境(tsx --test，沒有 DOM/canvas)會直接炸掉，這個檔案
// 一直以來就是刻意留給「跟遊戲全域狀態無關的天氣排程算法」用，才能被
// weather-schedule.test.ts 正常測到。rollWeatherForSeason()(game-state.ts)
// 呼叫這個函式來決定要不要略過(可能過期的)排程快取，直接回傳 clear。
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
