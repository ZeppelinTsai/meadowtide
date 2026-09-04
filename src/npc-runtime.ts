import * as THREE from "three";
import { hash2 } from "./utils";
import { scene, PLATEAU_Y } from "./scene-sky";
import {
  MAPS,
  LAYOUT,
  carpenterQuest,
  botanistQuest,
  isInsideLakeShape,
} from "./layout-maps";
import { npcDefs } from "./npc-defs";
import { makeCaptain, makeCarpenter, makeHumanoid, makeMayor, makeArtist, makeBotanist, makeMarineBiologist } from "./humanoid";
import { makeAnimal } from "./props";

// 9) NPC 群 — 現在每個 NPC 多帶兩個欄位：path（A* 算出的格子序列）
//    跟 pathIndex（走到第幾格了），取代 v11 的「直線衝過去」
// ==============================================================
export const npcGroup = new THREE.Group();
// 不像 farmGroup/plateauGroup 用固定的群組 Y 位移代表高台，NPC 的
// 世界高度改成跟主角同一套算法：game-loop.ts 逐幀呼叫
// characterGroundY(currentMapName, x, z) 直接寫回 mesh.position.y，
// 所以這裡的群組本身不要再疊加額外的 Y 偏移，不然會跟算出來的高度
// 疊加兩次。
scene.add(npcGroup);
export const outsideCols = MAPS.livingArea.tiles[0].length;
export const outsideRows = MAPS.livingArea.tiles.length;
export const npcs = npcDefs.map((def) => {
  const mesh =
    def.id === "mayor"
      ? makeMayor()
      : def.id === "carpenter"
        ? makeCarpenter()
        : def.id === "captain"
          ? makeCaptain()
          : def.id === "artist"
          ? makeArtist()
          : def.id === "botanist"
            ? makeBotanist()
            : def.id === "marine_biologist"
              ? makeMarineBiologist()
            : def.id === "chef"
            ? new THREE.Group() // 暫時不建立廚師模型；保留空節點供任務狀態查找。
            : makeHumanoid({ shirt: def.shirt, hair: def.hair });
  mesh.position.set(def.home.x, 0, def.home.z);
  // 露比在正式登島／招募事件觸發前不存在於世界，避免在舊城鎮 (170,11) 預先出現。
  // 克拉拉(植物學家)同一招：第三天個人事件登場前也先不存在。
  if (def.id === "chef" || def.id === "artist" || def.id === "botanist" || def.id === "marine_biologist")
    mesh.visible = false;
  npcGroup.add(mesh);
  return {
    ...def,
    mesh,
    memory: 0,
    path: null,
    pathIndex: 0,
    lastTargetKey: null,
  };
});
// 木匠抵達事件完成前，木匠這個角色還沒「存在」於生活區——先藏起來，
// 不參與排程走動；handleCarpenterDoorstepTouch() 完成入住場景時才現身。
(() => {
  const carpenterNpc = npcs.find((n) => n.id === "carpenter");
  if (carpenterNpc)
    carpenterNpc.mesh.visible =
      carpenterQuest.stage === "escorting" ||
      carpenterQuest.stage === "village_scene_done" ||
      carpenterQuest.stage === "moved_in";
})();
// 克拉拉同一招——不過真正讀存檔時的可見度是 input-save.ts 的
// loadGame() 明確設定(跟木匠那段一樣、比藝術家那段完整，見
// day3-morning-event.ts 開頭的說明)，這裡只處理「模組剛載入、還沒讀
// 過任何存檔」那個起始瞬間，例如開發時熱重載。
(() => {
  const botanistNpc = npcs.find((n) => n.id === "botanist");
  if (botanistNpc) botanistNpc.mesh.visible = botanistQuest.stage !== "not_started";
})();

// ==============================================================
// 9.5) 動物 — 白天在牧草地邊界內隨機遊走，晚上自動走回穀倉門口消失，
//    早上原地重新出現。純直線移動，沒有 A*（牧草地是空地，划不來）
// ==============================================================
export const PASTURE = {
  minX: LAYOUT.pasture.x,
  maxX: LAYOUT.pasture.x + LAYOUT.pasture.width - 1,
  minZ: LAYOUT.pasture.z,
  maxZ: LAYOUT.pasture.z + LAYOUT.pasture.height - 1,
};
export const BARN_DOOR = {
  x: LAYOUT.barn.doorX,
  z: LAYOUT.barn.z + LAYOUT.barn.d,
};
export function hasPastureGrassAt(x, z) {
  if (
    x < PASTURE.minX ||
    x > PASTURE.maxX ||
    z < PASTURE.minZ ||
    z > PASTURE.maxZ
  )
    return false;
  if (isInsideLakeShape(x, z, -0.2)) return false;
  if (
    x >= LAYOUT.barn.x &&
    x < LAYOUT.barn.x + LAYOUT.barn.w &&
    z >= LAYOUT.barn.z &&
    z < LAYOUT.barn.z + LAYOUT.barn.d
  )
    return false;
  // 小屋門口保留三格寬的短空地，動物進出時不會被高草遮住。
  if (z <= BARN_DOOR.z + 1 && Math.abs(x - BARN_DOOR.x) <= 1) return false;
  if (
    x >= LAYOUT.windmill.x - 1 &&
    x < LAYOUT.windmill.x + LAYOUT.windmill.w + 1 &&
    z >= LAYOUT.windmill.z - 1 &&
    z < LAYOUT.windmill.z + LAYOUT.windmill.d + 1
  )
    return false;
  const onEdge =
    x === PASTURE.minX ||
    x === PASTURE.maxX ||
    z === PASTURE.minZ ||
    z === PASTURE.maxZ;
  if (onEdge && hash2(x * 4.7, z * 8.3) < 0.38) return false;
  // 次外圈少量缺口，避免牧草邊界看起來像裁切整齊的長方形。
  const nearEdge =
    x <= PASTURE.minX + 1 ||
    x >= PASTURE.maxX - 1 ||
    z <= PASTURE.minZ + 1 ||
    z >= PASTURE.maxZ - 1;
  return !nearEdge || hash2(x * 6.1 + 2.4, z * 3.9) > 0.16;
}
export const animalGroup = new THREE.Group();
animalGroup.position.y = PLATEAU_Y; // 牧場整個都在高台範圍內
scene.add(animalGroup);
export function randomPasturePoint(
  isSafe: (x: number, z: number) => boolean = () => true,
) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const point = {
      x: PASTURE.minX + Math.random() * (PASTURE.maxX - PASTURE.minX),
      z: PASTURE.minZ + Math.random() * (PASTURE.maxZ - PASTURE.minZ),
    };
    const insideWindmill =
      point.x >= LAYOUT.windmill.x - 0.8 &&
      point.x < LAYOUT.windmill.x + LAYOUT.windmill.w + 0.8 &&
      point.z >= LAYOUT.windmill.z - 0.8 &&
      point.z < LAYOUT.windmill.z + LAYOUT.windmill.d + 0.8;
    if (
      !isInsideLakeShape(point.x, point.z, -0.2) &&
      !insideWindmill &&
      isSafe(point.x, point.z)
    )
      return point;
  }
  for (let z = Math.max(0, Math.ceil(PASTURE.minZ)); z <= PASTURE.maxZ; z++) {
    for (let x = Math.ceil(PASTURE.minX); x <= PASTURE.maxX; x++) {
      if (hasPastureGrassAt(x, z) && isSafe(x, z)) return { x, z };
    }
  }
  return { x: BARN_DOOR.x, z: BARN_DOOR.z + 1 };
}
export const animalDefs = [
  { id: "cow1", type: "cow", speed: 0.32, restMin: 3, restMax: 7 },
  { id: "cow2", type: "cow", speed: 0.32, restMin: 3, restMax: 7 },
  { id: "sheep1", type: "sheep", speed: 0.38, restMin: 2, restMax: 5 },
  { id: "sheep2", type: "sheep", speed: 0.38, restMin: 2, restMax: 5 },
  { id: "chicken1", type: "chicken", speed: 0.5, restMin: 1, restMax: 3 },
  { id: "chicken2", type: "chicken", speed: 0.5, restMin: 1, restMax: 3 },
];
export const animals = animalDefs.map((def, i) => {
  const mesh = makeAnimal(def.type, i);
  // 原始低模動物相對人物太小；以群組原點（腳底高度 y=0）統一放大，
  // 因此尺寸變成兩倍但仍會貼著地面，不影響移動與回家邏輯。
  mesh.scale.setScalar(2);
  const start = randomPasturePoint();
  mesh.position.set(start.x, 0, start.z);
  mesh.visible = false;
  animalGroup.add(mesh);
  return {
    ...def,
    mesh,
    state: "out",
    target: randomPasturePoint(),
    wanderState: "walking",
    restUntil: 0,
    grazeAt: Infinity,
    // 每隻動物自己的路徑亂數種子：走位的側向弧度跟目標點的小幅偏移都
    // 靠它決定，避免同一隻動物每次都走出一模一樣的直線。
    pathSeed: hash2(i * 3.7 + 1.3, i * 5.1 + 8.2),
    routeTarget: null as any,
    routeFromX: 0,
    routeFromZ: 0,
    routeTotalDist: 0,
    routeCurve: 0,
    prevBend: 0,
    stuckSeconds: 0,
    // 返舍路徑：進入 animalsShouldBeHome 時用 aStar() 算一次到穀倉門口
    // 的格路徑（見 game-loop.ts），取代舊版寫死中繼點 BARN_RETURN_APPROACH。
    homePath: null as { x: number; z: number }[] | null,
    homePathIndex: 0,
  };
});
