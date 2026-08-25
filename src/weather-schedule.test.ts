import assert from "node:assert/strict";
import test from "node:test";
import {
  createSeasonWeatherSchedule,
  MAX_EXTREME_WEATHER_PER_SEASON,
  METEOR_SHOWER_SCHEDULE,
  TIME_CONFIG,
} from "./game-state";

const fixedRandom = () => 0.5;

function verifyExtremeTransitions(absoluteSeason: number) {
  const schedule = createSeasonWeatherSchedule(absoluteSeason, fixedRandom);
  const seasonIndex = absoluteSeason % TIME_CONFIG.seasons.length;
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
    const schedule = createSeasonWeatherSchedule(absoluteSeason, fixedRandom);
    for (const seasonDay of Object.keys(METEOR_SHOWER_SCHEDULE).map(Number)) {
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
