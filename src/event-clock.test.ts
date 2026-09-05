import assert from "node:assert/strict";
import test from "node:test";
import { applyEventClock, eventClockMoment } from "./event-clock-core";

const dayDuration = 480;

test("event clock maps visible day and hour to one absolute timestamp", () => {
  const secondDayEnd = eventClockMoment(1, 10, dayDuration);
  assert.equal(secondDayEnd.dayIndex, 1);
  assert.equal(secondDayEnd.phase, 10 / 24);
  assert.ok(secondDayEnd.elapsed > eventClockMoment(0, 10, dayDuration).elapsed);
});

test("locking an event clock repairs a mismatched current day", () => {
  const state = {
    elapsed: 0,
    currentDay: 0,
    prevDay: 0,
    currentPhase: 0,
    currentSeason: 0,
  };
  applyEventClock(state, 2, 12, dayDuration, 3);
  assert.equal(state.currentDay, 2);
  assert.equal(state.prevDay, 2);
  assert.equal(state.currentPhase, 12 / 24);
  assert.equal(state.currentSeason, 3);
  assert.equal(state.elapsed, eventClockMoment(2, 12, dayDuration).elapsed);
});
