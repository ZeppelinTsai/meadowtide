import { gameState } from "./game-state";

// mountainCave(山之洞)2026-08-25 加入——玩家反饋兩個洞窟先不要飄花/
// 星空背景，之後會各自訂製效果跟背景；這裡是唯一資料源，加進這個
// 集合會同時關掉天氣粒子(weather-particles.ts 的 isOutdoorMap 判斷)跟
// 星空/流星層(scene-sky.ts 的 skyDome/meteorLayer 那幾處 isOutdoorMap
// 判斷)，不用兩邊分開改。
export const INDOOR_MAPS = new Set(["house", "stalactiteCave", "mountainCave"]);

export function isOutdoorMap(mapName = gameState.currentMapName) {
  return !INDOOR_MAPS.has(mapName);
}
