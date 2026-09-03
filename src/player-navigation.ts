import { gameState } from "./game-state";
import { MAPS, mountainGroundY, oldVillageGroundY, portGroundY, isOnOldVillageStair } from "./layout-maps";
import { isBlocked } from "./build-map";
import { animals, npcs } from "./npc-runtime";
import { dialogQueue, activeChoice } from "./dialogue";
import { isInventoryOpen } from "./inventory-ui";
import { isGameplayPaused } from "./time-pause";
import { showUiToast } from "./ui-toast";
import { findReachablePath, type GridPoint } from "./navigation";
export type NavigationInteraction = { id: string; radius: number; getPosition: () => GridPoint | null; isValid: () => boolean; execute: () => void };
type NavigationState = { path: GridPoint[]; pathIndex: number; desired: GridPoint; interaction: NavigationInteraction | null; lastTarget: GridPoint | null; replans: number };
let navigation: NavigationState | null = null;
const listeners = new Set<(destination: GridPoint | null) => void>();
function notify() { const end = navigation && navigation.path.length ? navigation.path[navigation.path.length - 1] : null; listeners.forEach((listener) => listener(end)); }
function safeAt(mapName: string, x: number, z: number) { return ![[-0.22,-0.22],[0.22,-0.22],[-0.22,0.22],[0.22,0.22]].some(([dx,dz]) => isBlocked(mapName, x + dx, z + dz)); }
// 2026-09-04 Zeppelin 反饋「從 (100,36) 點擊沒辦法自動走到神社
// (100,29) 那邊」——追下來是波上宮那段南端樓梯(layout-maps.ts 的
// westStairs 最後一項，x=99~101,fromZ:31,toZ:34)的落差比其他樓梯陡：
// 其他樓梯都是爬 1 層 elevation、攤在 3~7 格 z 距離，這段是爬滿 3 層
// elevation、只攤在 3 格，oldVillageGroundY() 用 6 個 steps 算下來每
// 一個「整數格」剛好正正好落差 1.0(3層/3格分6步，每步0.5，但整數格
// 一次跨兩步)。WASD 連續走路是每幀走一小段(canTraverseVillageHeight()
// 同一個 0.7 門檻，但採樣間距遠小於 1 格)，永遠不會一次跨過整層落差，
// 所以人工走得上去；這裡的 A* 只在整數格上取樣，單步落差 1.0 超過
// 0.7 門檻，判定「爬不上去」，導致點擊整段樓梯範圍完全找不到路徑。
// 樓梯本來就是「設計來讓玩家跨越這種高度差」的地形，不該被這個給一般
// 平地/懸崖用的門檻擋下——只要起點或終點其中一端落在
// isOnOldVillageStair() 範圍內，直接放行，不比較高度差。
function canStep(mapName: string, fromX: number, fromZ: number, x: number, z: number) {
  if (mapName === "oldVillage") {
    if (isOnOldVillageStair(x, z) || isOnOldVillageStair(fromX, fromZ)) return true;
    return Math.abs(oldVillageGroundY(x,z) - oldVillageGroundY(fromX,fromZ)) <= 0.7;
  }
  if (mapName === "mountain") return Math.abs(mountainGroundY(x,z) - mountainGroundY(fromX,fromZ)) <= 0.7;
  if (mapName === "port") return Math.abs(portGroundY(x,z) - portGroundY(fromX,fromZ)) <= 0.45;
  return true;
}
function dynamicBlocked(x: number, z: number, ignoredId?: string) {
  return npcs.some((npc) => npc.id !== ignoredId && npc.mesh.visible && npc.map === gameState.currentMapName && Math.round(npc.mesh.position.x) === x && Math.round(npc.mesh.position.z) === z)
    || (gameState.currentMapName === "livingArea" && animals.some((animal) => animal.id !== ignoredId && animal.mesh.visible && Math.round(animal.mesh.position.x) === x && Math.round(animal.mesh.position.z) === z));
}
function plan(desired: GridPoint, interaction: NavigationInteraction | null) {
  if (!gameState.player) return null;
  const map = MAPS[gameState.currentMapName]; if (!map?.tiles?.length) return null;
  const start = { x: Math.round(gameState.player.position.x), z: Math.round(gameState.player.position.z) };
  return findReachablePath(start, { x: Math.round(desired.x), z: Math.round(desired.z) }, map.tiles[0].length, map.tiles.length,
    (x,z,fromX,fromZ) => !safeAt(gameState.currentMapName,x,z) || dynamicBlocked(x,z,interaction?.id) || (fromX !== undefined && fromZ !== undefined && !canStep(gameState.currentMapName,fromX,fromZ,x,z)),
    interaction?.radius ?? 0);
}
export function findReachablePlayerDestination(desired: GridPoint) {
  const path = plan(desired, null);
  return path?.[path.length - 1] ?? null;
}
export function requestPlayerNavigation(desired: GridPoint, interaction: NavigationInteraction | null = null) {
  const path = plan(desired, interaction);
  if (!path || path.length < 1) { cancelPlayerNavigation(); showUiToast("\u7121\u6cd5\u79fb\u52d5", "\u7121\u6cd5\u8d70\u5230\u90a3\u88e1\u3002"); return false; }
  navigation = { path, pathIndex: path.length > 1 ? 1 : 0, desired, interaction, lastTarget: interaction ? { ...desired } : null, replans: 0 }; notify(); return true;
}
export function cancelPlayerNavigation() { if (!navigation) return; navigation = null; notify(); }
export const isPlayerNavigating = () => navigation !== null;
function shouldStop() { return !gameState.player || gameState.cutsceneActive || gameState.isSitting || gameState.fishingState !== "idle" || dialogQueue.length > 0 || Boolean(activeChoice) || isInventoryOpen() || isGameplayPaused(); }
function finish() { const interaction = navigation?.interaction ?? null; navigation = null; notify(); if (!interaction) return; const target = interaction.getPosition(); if (!target || !interaction.isValid()) return; const dx = target.x - gameState.player.position.x, dz = target.z - gameState.player.position.z; if (Math.hypot(dx,dz) > interaction.radius + 0.35) return; gameState.player.rotation.y = Math.atan2(-dx,-dz); interaction.execute(); }
export function getAutoMoveDirection(): GridPoint | null {
  if (!navigation) return null; if (shouldStop()) { cancelPlayerNavigation(); return null; }
  const interaction = navigation.interaction;
  if (interaction) {
    const target = interaction.getPosition(); if (!target || !interaction.isValid()) { cancelPlayerNavigation(); return null; }
    const moved = navigation.lastTarget ? Math.hypot(target.x-navigation.lastTarget.x,target.z-navigation.lastTarget.z) : 0;
    if (moved > 0.9) { if (navigation.replans >= 3 || moved > 5) { cancelPlayerNavigation(); return null; } const path = plan(target,interaction); if (!path) { cancelPlayerNavigation(); return null; } navigation.path=path; navigation.pathIndex=path.length>1?1:0; navigation.lastTarget={...target}; navigation.replans++; notify(); }
  }
  const waypoint=navigation.path[navigation.pathIndex], dx=waypoint.x-gameState.player.position.x, dz=waypoint.z-gameState.player.position.z;
  if (Math.hypot(dx,dz)<=0.12) { navigation.pathIndex++; if (navigation.pathIndex>=navigation.path.length) { finish(); return null; } return getAutoMoveDirection(); }
  const length=Math.hypot(dx,dz); return {x:dx/length,z:dz/length};
}
export function onNavigationDestinationChanged(listener: (destination: GridPoint | null) => void) { listeners.add(listener); return () => listeners.delete(listener); }
