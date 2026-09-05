export type EventClockState = {
  elapsed: number;
  currentDay: number;
  prevDay: number;
  currentPhase: number;
  currentSeason: number;
};

export function eventClockMoment(
  dayIndex: number,
  hour: number,
  dayDuration: number,
  hoursPerDay = 24,
) {
  const phase = hour / hoursPerDay;
  return { dayIndex, hour, phase, elapsed: dayDuration * (dayIndex + phase) };
}

export function applyEventClock(
  state: EventClockState,
  dayIndex: number,
  hour: number,
  dayDuration: number,
  season: number,
  hoursPerDay = 24,
) {
  const moment = eventClockMoment(dayIndex, hour, dayDuration, hoursPerDay);
  state.elapsed = moment.elapsed;
  state.currentDay = moment.dayIndex;
  state.prevDay = moment.dayIndex;
  state.currentPhase = moment.phase;
  state.currentSeason = season;
  return moment;
}
