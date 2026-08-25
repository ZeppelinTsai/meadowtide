import { gameState } from "./game-state";

export const INDOOR_MAPS = new Set(["house", "stalactiteCave"]);

export function isOutdoorMap(mapName = gameState.currentMapName) {
  return !INDOOR_MAPS.has(mapName);
}
