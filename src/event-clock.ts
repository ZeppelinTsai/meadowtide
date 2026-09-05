import {
  dayLength,
  gameState,
  getSeasonIndex,
  TIME_CONFIG,
} from "./game-state";
import { applyEventClock } from "./event-clock-core";
export { eventClockMoment } from "./event-clock-core";

export function lockEventClock(dayIndex: number, hour: number) {
  applyEventClock(
    gameState,
    dayIndex,
    hour,
    dayLength,
    getSeasonIndex(dayIndex),
    TIME_CONFIG.gameHoursPerDay,
  );
}
