// ==============================================================
// 鐘乳石洞窟——採礦系統(2026-08-25)
// 跟 game-state.ts 的木材/石頭採集點是「同一套模式、不同系統」：座標清單
// +「今天/這樓採過了嗎」的 collected 旗標+決定性隨機生成，但礦石節點
// 綁的是「樓層」不是「日夜時段」，跟地表採集完全獨立，不共用同一份
// 清單(參考 game-state.ts 裡「採礦是完全不同的系統」那則註解)。
// 這個檔案刻意保持「純資料+邏輯」，不 import THREE/DOM——3D 模型放
// props.ts，場景組裝/loadMap 呼叫放 build-map.ts，跟 layout-maps.ts
// 保持純資料是同一個理由(map-debug.ts 這類工具才能單獨 import)。
// ==============================================================
import { LAYOUT, MAPS } from "./layout-maps";
import { gameState, inventory } from "./game-state";
import { hash2 } from "./utils";

export type OreKind =
  | "copper"
  | "silver"
  | "gold"
  | "starCrystal"
  | "godCrystal";

export interface OreTier {
  kind: OreKind;
  label: string;
  color: number;
  accentColor: number;
  yieldMin: number;
  yieldMax: number;
}

// 5 階對應 5 種樓層外觀，第 1~3 階是常見礦物(銅/銀/金)，第 4~5 階換成
// 自己的世界觀命名(星晶/神晶)，不用 mythril/adamantite 那套。配色刻意
// 跟牆體/地板的偏冷灰基底拉開差距，同時避免整體變成「方格地板+方洞
// 樓梯」的牧場物語既視感——地板/牆體顏色隨階層漸變，樓梯是石階造型
// 不是方洞。
export const ORE_TIERS: OreTier[] = [
  { kind: "copper", label: "銅礦", color: 0xb5652c, accentColor: 0xdf9a4f, yieldMin: 2, yieldMax: 4 },
  { kind: "silver", label: "銀礦", color: 0xb7bcc0, accentColor: 0xe8ecef, yieldMin: 2, yieldMax: 4 },
  { kind: "gold", label: "金礦", color: 0xd8a627, accentColor: 0xf5cf5a, yieldMin: 1, yieldMax: 3 },
  { kind: "starCrystal", label: "星晶", color: 0x2f6fb0, accentColor: 0x6fc4e8, yieldMin: 1, yieldMax: 2 },
  { kind: "godCrystal", label: "神晶", color: 0x6a2f9e, accentColor: 0xb46fe0, yieldMin: 1, yieldMax: 2 },
];

// 原設計是「50 層，每 10 層一個精緻階層」，這輪先做到 25 層頂、階層粒度
// 改成每 5 層一階(剛好對到 5 種礦石)，之後真的要往 50 層擴充時，
// MINE_FLOOR_MAX 改掉、ORE_TIERS 補階即可，其他邏輯都是照 MINE_TIER_SIZE
// 算,不用重寫。
export const MINE_FLOOR_MAX = 25;
export const MINE_TIER_SIZE = 5;
export const MINE_SIZE = 50;

export function mineTierForFloor(floor: number) {
  return Math.min(
    ORE_TIERS.length,
    Math.max(1, Math.ceil(floor / MINE_TIER_SIZE)),
  );
}
export function mineOreForFloor(floor: number): OreTier {
  return ORE_TIERS[mineTierForFloor(floor) - 1];
}

// 樓梯座標固定在房間對角兩側(跟樓層無關)：上樓梯(回上一層/出洞口)在
// 西南角，下樓梯(往下一層，最底層沒有)在東北角，兩者距離夠遠，中間
// 隨機礦點怎麼灑都不會擋住任一邊。
export function mineUpStairs() {
  // 原本 z=MINE_SIZE-4；往畫面上方(-Z)移三格，地磚、事件與抵達點同步。
  return { x: 4, z: MINE_SIZE - 7 };
}
export function mineDownStairs(floor: number) {
  return floor < MINE_FLOOR_MAX ? { x: MINE_SIZE - 5, z: 3 } : null;
}

export function mineStairRotation(direction: "up" | "down") {
  // 朝向調整套在下樓梯；上樓梯維持原模型方向。
  return direction === "down" ? Math.PI : 0;
}

// tile 值延用 build-map.ts 既有圖例，4/7 之前完全沒用過：
// 0=地板 1=牆 3=門檻(這裡不用) 4=下樓梯 7=上樓梯
export function makeMineFloorTiles(floor: number) {
  const size = MINE_SIZE;
  const tiles: number[][] = Array.from({ length: size }, () =>
    new Array(size).fill(0),
  );
  for (let x = 0; x < size; x++) {
    tiles[0][x] = 1;
    tiles[size - 1][x] = 1;
  }
  for (let z = 0; z < size; z++) {
    tiles[z][0] = 1;
    tiles[z][size - 1] = 1;
  }
  const up = mineUpStairs();
  tiles[up.z][up.x] = 7;
  const down = mineDownStairs(floor);
  if (down) tiles[down.z][down.x] = 4;
  return tiles;
}

export interface OreNode {
  id: string;
  kind: OreKind;
  x: number;
  z: number;
  collected: boolean;
  colorSeed: number; // 0~1，同一顆礦石固定用這個值做顏色微調，不必每幀重算
}
export const ORE_NODES: OreNode[] = [];

const ORE_NODE_COUNT = 14;
const ORE_KEEP_OUT: { x: number; z: number }[] = [];

function isFarEnough(x: number, z: number, taken: { x: number; z: number }[]) {
  return taken.every((t) => Math.abs(t.x - x) + Math.abs(t.z - z) >= 3);
}

// 地磚是純樓層函式，重算幾次都是同一個結果，不會弄丟任何存檔狀態；
// 拆成獨立函式是因為 loadMap() 需要一個「保險重建」的呼叫點(見
// build-map.ts)，那個呼叫點只能重建地磚，不能連礦石節點一起重灑——
// 不然存讀檔還原到洞窟中途樓層時，剛從存檔讀回來的 collected 狀態會
// 立刻被這裡蓋掉。
export function regenerateMineFloorTiles(floor: number) {
  const clampedFloor = Math.max(1, Math.min(MINE_FLOOR_MAX, floor));
  gameState.mineFloor = clampedFloor;
  MAPS.stalactiteCave.tiles = makeMineFloorTiles(clampedFloor);
  MAPS.stalactiteCave.playerStart = { ...mineUpStairs(), z: mineUpStairs().z - 1 };
  return clampedFloor;
}

// 每層重新進來都是同一批礦點(用樓層數當種子)，不是每次踩樓梯都重灑；
// 跟木材/石頭那套「固定時段刷新」不同，這裡是「這層採完了、下次再來
// 才會補新的一批」——先簡化成「重新進這層就補滿」，之後要做「同一層
// 沒採完的維持原樣」可以另外存 Map<floor, OreNode[]> 的快取，這輪先求
// 挖礦迴圈能跑起來。只有 enterMine()/mineGoUp()/mineGoDown() 這種「真的
// 換樓層」的時機才呼叫這個函式；單純重建畫面(存讀檔)要呼叫上面那個
// 只動地磚的版本。
export function regenerateMineFloor(floor: number) {
  const clampedFloor = regenerateMineFloorTiles(floor);

  ORE_NODES.length = 0;
  const tier = mineOreForFloor(clampedFloor);
  const up = mineUpStairs();
  const down = mineDownStairs(clampedFloor);
  const taken: { x: number; z: number }[] = [up, ...(down ? [down] : [])];
  let placed = 0;
  let attempt = 0;
  while (placed < ORE_NODE_COUNT && attempt < ORE_NODE_COUNT * 40) {
    attempt++;
    const nx = hash2(clampedFloor * 13.7 + attempt * 3.1, attempt * 7.9);
    const nz = hash2(attempt * 5.3, clampedFloor * 11.1 + attempt * 2.3);
    const x = 3 + Math.floor(nx * (MINE_SIZE - 6));
    const z = 3 + Math.floor(nz * (MINE_SIZE - 6));
    if (!isFarEnough(x, z, taken)) continue;
    taken.push({ x, z });
    ORE_NODES.push({
      id: `mine-${clampedFloor}-${placed}`,
      kind: tier.kind,
      x,
      z,
      collected: false,
      colorSeed: hash2(x * 4.4 + clampedFloor, z * 3.3),
    });
    placed++;
  }
}

export function harvestOreNode(x: number, z: number) {
  const node = ORE_NODES.find(
    (candidate) => candidate.x === x && candidate.z === z && !candidate.collected,
  );
  if (!node) return { amount: 0, tier: null as OreTier | null };
  const tier = ORE_TIERS.find((t) => t.kind === node.kind)!;
  const amount =
    tier.yieldMin +
    Math.floor(Math.random() * (tier.yieldMax - tier.yieldMin + 1));
  inventory[tier.kind] += amount;
  node.collected = true;
  gameState.harvestFeedback = {
    kind: "success",
    title: `敲下${tier.label}`,
    text: `${tier.label} ×${amount}`,
    count: amount,
    until: gameState.elapsed + 2.6,
  };
  return { amount, tier };
}
