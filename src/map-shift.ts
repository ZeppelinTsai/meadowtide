// map-shift.ts
//
// 把你在 layout-maps.ts 裡已經手動做過四次的操作（NORTH_EXPANSION 往北
// unshift 5 排、X_OFFSET 往西 unshift 15 格、coast.eastExpansion 在
// column 26 splice、TOWN_ROWS 往南 push 6 排）收斂成一個測試過、可重複
// 呼叫的函式，以後要「這個方向再多幾格」不用再手刻一次陣列手術、也不用
// 每次都重新想一遍要不要用 unshift/push/splice。
//
// 重要的範圍界線（請看 agent.md 的完整說明，這裡先講重點）：
// - expandTileGrid() 只負責 tiles 這個二維陣列本身的擴張/收縮。
// - 往南（south）、往東（east）擴張：新格子加在陣列尾端，既有內容的座標
//   完全不用動，LAYOUT 裡原有的 x/z 也不用改。
// - 往北（north）、往西（west）擴張：新格子用 unshift 加在陣列前端，這會
//   讓所有「原本」畫在地圖上的內容整個往後推——LAYOUT 裡所有屬於這張
//   地圖的 x（west 擴張時）或 z（north 擴張時）欄位，以及 events 陣列裡
//   這張地圖的觸發座標，全部都要跟著加上同樣的偏移量，否則地形移動了、
//   事件觸發點跟碰撞判定卻還留在舊座標，會整個對不上。shiftCoordinates()
//   就是用來批次處理這一步的，但呼叫時要自己把「這張地圖所有帶座標的
//   物件」蒐集成一個陣列傳進去——這工具沒辦法自動找出所有相關物件，尤其
//   是寫死在 map-scene.ts 裡、沒有走 LAYOUT 的原始數字（用
//   audit-raw-coordinates.ts 掃這一類）。

export type TileGrid = number[][];
export type ShiftDirection = "north" | "south" | "east" | "west";

/**
 * 在 tiles 陣列的某一邊擴張（或收縮，amount 傳負數）。
 * north/west 擴張後，回傳這次實際位移量，方便呼叫端接著用在
 * shiftCoordinates()（正常情況下就是你傳入的 amount，但收縮到底線時
 * 會被夾住，所以用回傳值而不是假設一定等於輸入值）。
 */
export function expandTileGrid(
  tiles: TileGrid,
  direction: ShiftDirection,
  amount: number,
  fillValue = 0,
): number {
  if (amount === 0) return 0;
  const width = tiles[0]?.length ?? 0;

  if (amount > 0) {
    switch (direction) {
      case "north":
        tiles.unshift(
          ...Array.from({ length: amount }, () =>
            new Array(width).fill(fillValue),
          ),
        );
        return amount;
      case "south":
        for (let i = 0; i < amount; i++)
          tiles.push(new Array(width).fill(fillValue));
        return amount;
      case "west":
        tiles.forEach((row) =>
          row.unshift(...new Array(amount).fill(fillValue)),
        );
        return amount;
      case "east":
        tiles.forEach((row) => row.push(...new Array(amount).fill(fillValue)));
        return amount;
    }
  }

  // 收縮：amount 是負數。同樣夾住不能縮超過現有大小，避免 splice 出詭異
  // 的結果或整張地圖被清空到 0 列/0 欄。
  const shrink = Math.min(-amount, direction === "north" || direction === "south" ? tiles.length : width);
  switch (direction) {
    case "north":
      tiles.splice(0, shrink);
      return -shrink;
    case "south":
      tiles.splice(tiles.length - shrink, shrink);
      return -shrink;
    case "west":
      tiles.forEach((row) => row.splice(0, shrink));
      return -shrink;
    case "east":
      tiles.forEach((row) => row.splice(row.length - shrink, shrink));
      return -shrink;
  }
}

const XZ_KEY_PAIRS: Array<[string, string]> = [
  ["x", "z"],
  ["x1", "z1"],
  ["x2", "z2"],
  ["fromX", "fromZ"], // 你的 westStairs/plazaStairs 用這組命名
  ["toX", "toZ"],
];

/**
 * 批次位移一組帶座標的物件（LAYOUT 子物件、events 陣列項目、rail 線段…）。
 * 直接改物件本身（mutate），只認得上面列出的幾組常見鍵名，其他鍵一律
 * 忽略，所以可以放心把一包混雜不同形狀物件的陣列整包丟進來。
 *
 * dx 對應 west 擴張量、dz 對應 north 擴張量——跟 expandTileGrid() 的
 * 方向對應：往西擴張 N 格，這裡的舊座標 x 要 +N；往北擴張 N 格，舊座標
 * z 要 +N。south/east 擴張不需要呼叫這個函式（新空間加在尾端，既有座標
 * 不用動）。
 */
export function shiftCoordinates(
  targets: Array<Record<string, unknown>>,
  dx: number,
  dz: number,
): void {
  if (dx === 0 && dz === 0) return;
  for (const obj of targets) {
    for (const [xKey, zKey] of XZ_KEY_PAIRS) {
      if (typeof obj[xKey] === "number") (obj[xKey] as number) += dx;
      if (typeof obj[zKey] === "number") (obj[zKey] as number) += dz;
    }
  }
}

/**
 * 遞迴版本：LAYOUT 是巢狀物件（LAYOUT.oldVillage.houses 是陣列、
 * LAYOUT.mountain.plazas.summit 是陣列的陣列……），直接對整包 LAYOUT
 * 呼叫 shiftCoordinates 只會處理最外層，巢狀的都碰不到。這個版本會
 * 沿著物件/陣列往下鑽，把每一層裡符合 XZ_KEY_PAIRS 的鍵都位移到。
 *
 * 用法示範見 agent.md；務必只對「這次真的要整張地圖一起搬」的那個
 * 子物件呼叫（例如只傳 LAYOUT.oldVillage，不要整包 LAYOUT 一起丟），
 * 否則會把其他地圖（例如 house、shrine）不相干的座標也一起搬走。
 */
export function shiftCoordinatesDeep(
  target: unknown,
  dx: number,
  dz: number,
  seen: Set<unknown> = new Set(),
): void {
  if (target === null || typeof target !== "object") return;
  if (seen.has(target)) return; // 防止循環參照無限遞迴
  seen.add(target);

  if (Array.isArray(target)) {
    for (const item of target) shiftCoordinatesDeep(item, dx, dz, seen);
    return;
  }

  const obj = target as Record<string, unknown>;
  shiftCoordinates([obj], dx, dz);
  for (const value of Object.values(obj)) {
    if (typeof value === "object") shiftCoordinatesDeep(value, dx, dz, seen);
  }
}
