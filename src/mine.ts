// ==============================================================
// 洞窟採礦系統(2026-08-25 鐘乳石洞窟／2026-08-25 山之洞)
// 跟 game-state.ts 的木材/石頭採集點是「同一套模式、不同系統」：座標清單
// +「今天/這樓採過了嗎」的 collected 旗標+決定性隨機生成，但礦石節點
// 綁的是「樓層」不是「日夜時段」，跟地表採集完全獨立，不共用同一份
// 清單(參考 game-state.ts 裡「採礦是完全不同的系統」那則註解)。
// 這個檔案刻意保持「純資料+邏輯」，不 import THREE/DOM——3D 模型放
// props.ts，場景組裝/loadMap 呼叫放 build-map.ts，跟 layout-maps.ts
// 保持純資料是同一個理由(map-debug.ts 這類工具才能單獨 import)。
//
// 檔案分兩段：上半段是鐘乳石洞窟(向下版，stalactiteCave)，下半段是
// 「山之洞」(向上版，mountainCave，2026-08-25 新增)——玩家要求「先套用
// 同樣模板就好」，所以山之洞直接沿用同一套 ORE_TIERS/樓層階層公式/
// 房間尺寸/礦點生成演算法(甚至同一套礦物經濟，先不分家)，唯一不共用
// 的是「樓層在哪個角落」跟「哪個方向要不要問回鎮上」——這兩塊細節見
// 下半段開頭那則長註解。之後真的要做出「50 層＋5 種新礦」的完整山之洞
// 設計時，比照 mine.ts 這段開頭同一則註解的做法：加新常數、不用重寫
// 呼叫端。
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

// 樓梯固定在房間對角兩側的兩個點，但「哪個點是上樓梯/哪個是下樓梯」
// 依樓層奇偶交替，不是死死釘住某個角落——玩家反饋：原本上下樓梯的模型
// 放反了(該用凹陷造型的位置放了疊高造型，反之亦然)，且方向要轉 180
// 度；同時想通了「相鄰樓層的上下樓梯位置要對得上」才不會出現「明明是
// 順著同一組樓梯上下、畫面卻瞬間跳到對角」的違和感：第 1 層(奇數)從
// 西南角(A)進來、東北角(B)往下；第 2 層(偶數)理當從 B 進來(跟第 1 層
// 往下的落點對齊)、再從 A 往下(對齊第 3 層又是從 A 進來)，兩個點的角色
// 每層對調一次。
const MINE_STAIR_A = { x: 4, z: MINE_SIZE - 7 }; // 西南角
const MINE_STAIR_B = { x: MINE_SIZE - 5, z: 3 }; // 東北角

export function mineUpStairs(floor: number) {
  return floor % 2 === 1 ? MINE_STAIR_A : MINE_STAIR_B;
}
export function mineDownStairs(floor: number) {
  if (floor >= MINE_FLOOR_MAX) return null;
  return floor % 2 === 1 ? MINE_STAIR_B : MINE_STAIR_A;
}

export function mineStairRotation(direction: "up" | "down") {
  // 曾經改成跟座落的角落綁在一起(哪個角落固定用哪個朝向)，但玩家後續
  // 反饋：雙數樓換到東北角的上樓梯(疊高箱子那顆)方向還是不對，要再轉
  // 180 度——代表朝向其實跟「這是上樓梯還是下樓梯造型」綁在一起才對，
  // 跟座落哪個角落無關(疊高箱子固定 PI、凹陷坑洞固定 0，兩種角落都一
  // 樣)，之前改成跟角落綁死是修正過頭了，這裡改回跟 direction 掛勾。
  return direction === "up" ? Math.PI : 0;
}

// 玩家重生點要落在樓梯「往房間內」那一格，不能直接站在樓梯上——西南角
// 房間在北側(z 變小方向)，東北角房間在南側(z 變大方向)，兩者往內的
// 方向相反。
function mineEntrancePoint(pos: { x: number; z: number }) {
  return pos.z < MINE_SIZE / 2
    ? { x: pos.x, z: pos.z + 1 }
    : { x: pos.x, z: pos.z - 1 };
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
  const up = mineUpStairs(floor);
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
  MAPS.stalactiteCave.playerStart = mineEntrancePoint(mineUpStairs(clampedFloor));
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
  const up = mineUpStairs(clampedFloor);
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

// ==============================================================
// 山之洞——採礦系統(2026-08-25，向上爬版本)
// 「先套用同樣模板就好」：房間尺寸(MOUNTAIN_MINE_SIZE)、樓層階層公式
// (直接沿用 mineTierForFloor/mineOreForFloor，同一份 ORE_TIERS，同一套
// 礦物經濟)、礦點生成演算法全部照抄鐘乳石洞窟那一半，沒有另外發明。
// 真正不同的只有兩件事，而且兩件事其實是同一個原因造成的：
//
// 1)「同層兩樓梯模組要對換」——鐘乳石洞窟裡「上樓梯」(mineUpStairs)是
//    朝淺處/出口方向(疊高箱子造型，物理上就是往上爬的階梯)，「下樓梯」
//    (mineDownStairs)朝深處(凹陷坑洞造型，物理上是往下挖的洞)。山之洞
//    整個世界觀是「往上爬」，深處(樓層數字更大)在山頂、更高，淺處(樓層
//    數字更小)在山腳/出口、更低——跟鐘乳石洞窟的深淺/樓層數字對應關係
//    是相反的。makeMineStaircase()/mineStairRotation() 這兩個純幾何函式
//    完全沒改、直接沿用(疊箱子固定叫"up"、凹坑固定叫"down"，跟哪個洞窟
//    無關)；「對換」是靠下面 mountainMineUpStairs()/mountainMineDownStairs()
//    的角落交替公式互換角色達成的——這裡的 mountainMineUpStairs() 回傳的
//    是「深處(樓層+1，往山頂爬)」那個角落(套用鐘乳石洞窟 mineDownStairs()
//    的公式)，mountainMineDownStairs() 回傳「淺處(樓層-1，往出口/山腳)」
//    那個角落(套用鐘乳石洞窟 mineUpStairs() 的公式)。build-map.ts 畫這兩
//    個點的時候，一樣是「mountainMineUpStairs() 那格放 makeMineStaircase
//    ("up",…)疊箱子、mountainMineDownStairs() 那格放"down"+挖坑」——跟
//    鐘乳石洞窟同一套渲染邏輯，模組會自動對調，完全不用在渲染端寫任何
//    if/else 特判。
// 2)「跟對話選項邏輯要換」——「要不要直接回鎮上」這個提示原本綁在
//    mineGoUp()(鐘乳石洞窟裡"上樓梯"＝出口方向)。山之洞的出口方向現在
//    是 mountainMineDownStairs()，所以提示邏輯要綁在 mountainMineGoDown()
//    (見 build-map.ts)，"往上一層"的純樓層前進(沒有提示，踩了就走)才是
//    mountainMineGoUp()——命名剛好符合直覺："往上爬"＝繼續深入山之洞，
//    "往下走"＝要離開了，跟鐘乳石洞窟"上樓＝要離開、下樓＝繼續深入"的
//    直覺方向正好相反，這正是這整段要處理的核心。
// ==============================================================
export const MOUNTAIN_MINE_FLOOR_MAX = 25;
export const MOUNTAIN_MINE_SIZE = 50;

const MOUNTAIN_STAIR_A = { x: 4, z: MOUNTAIN_MINE_SIZE - 7 }; // 西南角
const MOUNTAIN_STAIR_B = { x: MOUNTAIN_MINE_SIZE - 5, z: 3 }; // 東北角

// 深處(樓層+1，往山頂爬)——套用鐘乳石洞窟 mineDownStairs() 同一條公式，
// 頂層(MOUNTAIN_MINE_FLOOR_MAX)沒有更深了，回傳 null。
export function mountainMineUpStairs(floor: number) {
  if (floor >= MOUNTAIN_MINE_FLOOR_MAX) return null;
  return floor % 2 === 1 ? MOUNTAIN_STAIR_B : MOUNTAIN_STAIR_A;
}
// 淺處(樓層-1，往出口/山腳)——套用鐘乳石洞窟 mineUpStairs() 同一條公式，
// 永遠存在(包含第 1 層，用來走出洞口)。
export function mountainMineDownStairs(floor: number) {
  return floor % 2 === 1 ? MOUNTAIN_STAIR_A : MOUNTAIN_STAIR_B;
}

function mountainMineEntrancePoint(pos: { x: number; z: number }) {
  return pos.z < MOUNTAIN_MINE_SIZE / 2
    ? { x: pos.x, z: pos.z + 1 }
    : { x: pos.x, z: pos.z - 1 };
}

// tile 值跟鐘乳石洞窟同一套圖例：0=地板 1=牆 4=下樓梯(往淺處/出口)
// 7=上樓梯(往深處/山頂)。
export function makeMountainMineFloorTiles(floor: number) {
  const size = MOUNTAIN_MINE_SIZE;
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
  const up = mountainMineUpStairs(floor);
  if (up) tiles[up.z][up.x] = 7;
  const down = mountainMineDownStairs(floor);
  tiles[down.z][down.x] = 4;
  return tiles;
}

export const MOUNTAIN_ORE_NODES: OreNode[] = [];

// 跟鐘乳石洞窟的 regenerateMineFloorTiles 同一個角色：純樓層函式，只重建
// 地磚，不動 MOUNTAIN_ORE_NODES 的 collected 狀態——loadMap() 的存讀檔
// 保險呼叫點要用這個，不能用下面連礦點一起重灑的完整版。
export function regenerateMountainMineFloorTiles(floor: number) {
  const clampedFloor = Math.max(1, Math.min(MOUNTAIN_MINE_FLOOR_MAX, floor));
  gameState.mountainMineFloor = clampedFloor;
  MAPS.mountainCave.tiles = makeMountainMineFloorTiles(clampedFloor);
  MAPS.mountainCave.playerStart = mountainMineEntrancePoint(
    mountainMineDownStairs(clampedFloor),
  );
  return clampedFloor;
}

// 完整版：換樓層(enterMountainMine()/mountainMineGoUp()/
// mountainMineGoDown())才呼叫，會連礦點一起重灑。
export function regenerateMountainMineFloor(floor: number) {
  const clampedFloor = regenerateMountainMineFloorTiles(floor);

  MOUNTAIN_ORE_NODES.length = 0;
  const tier = mineOreForFloor(clampedFloor);
  const up = mountainMineUpStairs(clampedFloor);
  const down = mountainMineDownStairs(clampedFloor);
  const taken: { x: number; z: number }[] = [down, ...(up ? [up] : [])];
  let placed = 0;
  let attempt = 0;
  while (placed < ORE_NODE_COUNT && attempt < ORE_NODE_COUNT * 40) {
    attempt++;
    // 種子跟鐘乳石洞窟那份錯開(乘數/位移不同)，兩個洞窟同樓層數字不會
    // 灑出同一批座標。
    const nx = hash2(clampedFloor * 17.3 + attempt * 4.1 + 90, attempt * 6.7);
    const nz = hash2(attempt * 8.9 + 30, clampedFloor * 9.7 + attempt * 3.7);
    const x = 3 + Math.floor(nx * (MOUNTAIN_MINE_SIZE - 6));
    const z = 3 + Math.floor(nz * (MOUNTAIN_MINE_SIZE - 6));
    if (!isFarEnough(x, z, taken)) continue;
    taken.push({ x, z });
    MOUNTAIN_ORE_NODES.push({
      id: `mountain-mine-${clampedFloor}-${placed}`,
      kind: tier.kind,
      x,
      z,
      collected: false,
      colorSeed: hash2(x * 4.4 + clampedFloor + 90, z * 3.3),
    });
    placed++;
  }
}

export function harvestMountainOreNode(x: number, z: number) {
  const node = MOUNTAIN_ORE_NODES.find(
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
