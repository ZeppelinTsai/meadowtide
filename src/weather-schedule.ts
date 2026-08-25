export const MAX_EXTREME_WEATHER_PER_SEASON = 2;

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
