import assert from "node:assert/strict";
import test from "node:test";
import {
  createWeatherSchedule,
  isTutorialWeekDay,
  blendWeatherValue,
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

test("isTutorialWeekDay: first 7 days of absolute season 0 are protected, day 8 onward is not", () => {
  const TUTORIAL_WEEK_DAYS = 7;
  for (let seasonDayIndex = 0; seasonDayIndex < TUTORIAL_WEEK_DAYS; seasonDayIndex++) {
    assert.equal(
      isTutorialWeekDay(0, seasonDayIndex, TUTORIAL_WEEK_DAYS),
      true,
      `season-day ${seasonDayIndex + 1} of the very first season should be protected`,
    );
  }
  assert.equal(isTutorialWeekDay(0, TUTORIAL_WEEK_DAYS, TUTORIAL_WEEK_DAYS), false);
  assert.equal(isTutorialWeekDay(0, TUTORIAL_WEEK_DAYS + 5, TUTORIAL_WEEK_DAYS), false);
});

test("isTutorialWeekDay: only applies to absolute season 0, never later seasons at the same season-day index", () => {
  const TUTORIAL_WEEK_DAYS = 7;
  for (const absoluteSeason of [1, 2, 4, 8]) {
    for (let seasonDayIndex = 0; seasonDayIndex < TUTORIAL_WEEK_DAYS; seasonDayIndex++) {
      assert.equal(
        isTutorialWeekDay(absoluteSeason, seasonDayIndex, TUTORIAL_WEEK_DAYS),
        false,
        `absolute season ${absoluteSeason} should never be treated as the tutorial week`,
      );
    }
  }
});

test("blendWeatherValue: ramp 0 is fully the previous weather's value", () => {
  const values = { rain: 190, typhoon: 360, clear: 0 };
  assert.equal(blendWeatherValue("rain", "clear", 0, values), 190);
});

test("blendWeatherValue: ramp 1 is fully the current weather's value", () => {
  const values = { rain: 190, typhoon: 360, clear: 0 };
  assert.equal(blendWeatherValue("rain", "clear", 1, values), 0);
});

test("blendWeatherValue: mid-ramp linearly interpolates between the two", () => {
  const values = { rain: 190, clear: 0 };
  assert.equal(blendWeatherValue("rain", "clear", 0.5, values), 95);
  assert.equal(blendWeatherValue("clear", "rain", 0.25, values), 47.5);
});

test("blendWeatherValue: missing entries fall back to the fallback value, default 0", () => {
  const values = { rain: 0.52 };
  assert.equal(blendWeatherValue("cloudy", "rain", 1, values), 0.52);
  assert.equal(blendWeatherValue("cloudy", "rain", 0, values), 0);
  assert.equal(blendWeatherValue("cloudy", "sunny", 1, values, 3), 3);
});

test("blendWeatherValue: ramp is clamped to [0, 1]", () => {
  const values = { rain: 190, clear: 0 };
  assert.equal(blendWeatherValue("rain", "clear", -5, values), 190);
  assert.equal(blendWeatherValue("rain", "clear", 5, values), 0);
});
