import assert from "node:assert/strict";
import test from "node:test";
import {
  createWeatherSchedule,
  MAX_EXTREME_WEATHER_PER_SEASON,
} from "./weather-schedule";

const fixedRandom = () => 0.5;
const DAYS_PER_SEASON = 21;
const SEASON_COUNT = 4;
const METEOR_SHOWER_DAYS = new Set([11, 12, 13, 14, 15]);

function createSchedule(absoluteSeason: number) {
  const firstAbsoluteDay = absoluteSeason * DAYS_PER_SEASON;
  return createWeatherSchedule({
    absoluteSeason,
    daysPerSeason: DAYS_PER_SEASON,
    seasonCount: SEASON_COUNT,
    isProtectedDay: (index) =>
      (firstAbsoluteDay + index) % 7 === 0 ||
      METEOR_SHOWER_DAYS.has(index + 1),
    random: fixedRandom,
  });
}

function verifyExtremeTransitions(absoluteSeason: number) {
  const schedule = createSchedule(absoluteSeason);
  const seasonIndex = absoluteSeason % SEASON_COUNT;
  const extremeWeather = seasonIndex === 1 ? new Set(["typhoon", "storm"]) : new Set(["blizzard"]);
  const transitionWeather = seasonIndex === 1 ? "rain" : "snow";
  const extremeIndexes = schedule
    .map((weather, index) => (extremeWeather.has(weather) ? index : -1))
    .filter((index) => index >= 0);

  assert.equal(extremeIndexes.length, MAX_EXTREME_WEATHER_PER_SEASON);
  for (const index of extremeIndexes) {
    assert.equal(schedule[index - 1], transitionWeather);
    assert.equal(schedule[index + 1], transitionWeather);
  }
}

test("meteor shower days are always clear in every season", () => {
  for (let absoluteSeason = 0; absoluteSeason < 8; absoluteSeason++) {
    const schedule = createSchedule(absoluteSeason);
    for (const seasonDay of METEOR_SHOWER_DAYS) {
      assert.equal(schedule[seasonDay - 1], "clear");
    }
  }
});

test("summer extreme weather has rainy transition days and is capped", () => {
  verifyExtremeTransitions(1);
});

test("winter blizzards have snowy transition days and are capped", () => {
  verifyExtremeTransitions(3);
});
