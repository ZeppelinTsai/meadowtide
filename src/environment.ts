import { gameState } from "./game-state";

export const INDOOR_MAPS = new Set(["house"]);

export function isOutdoorMap(mapName = gameState.currentMapName) {
  return !INDOOR_MAPS.has(mapName);
}
