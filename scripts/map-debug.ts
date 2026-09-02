#!/usr/bin/env node
// 地圖除錯小工具 —— 直接從 src/layout-maps.ts import MAPS/LAYOUT，跟原本
// meadowtide.html 版本靠 regex 抽取＋vm 執行「純資料」那段的做法相比，
// 現在有了真正的模組邊界，不用再抽取字串執行。
//
// 用法：npm run map-debug -- [--map=livingArea|oldVillage|port|house] [--legend] [--landmarks] [--filter=關鍵字]

import { MAPS, LAYOUT } from "../src/layout-maps";

const LEGEND: Record<number, string> = {
  0: "·",
  1: "█",
  2: "♣",
  3: "▭",
  5: "=",
  6: "≈",
  7: "▤",
  8: "░",
  9: "~",
};

function printMap(mapName: string) {
  const map = (MAPS as any)[mapName];
  console.log(`\n=== ${mapName} (${map.tiles[0].length} x ${map.tiles.length}) ===`);
  const header =
    "    " +
    Array.from({ length: map.tiles[0].length }, (_, x) => x % 10).join("");
  console.log(header);
  map.tiles.forEach((row: number[], z: number) => {
    const line = row.map((t) => LEGEND[t] ?? "?").join("");
    console.log(String(z).padStart(3, " ") + " " + line);
  });
  if (map.buildings) {
    console.log("buildings:", JSON.stringify(map.buildings));
  }
  if (map.playerStart) {
    console.log("playerStart:", JSON.stringify(map.playerStart));
  }
}

const mapArg = process.argv.find((a) => a.startsWith("--map="));
const mapName = mapArg ? mapArg.slice("--map=".length) : "livingArea";
if (!(MAPS as any)[mapName]) {
  console.error(
    `找不到地圖 "${mapName}"，可用的地圖: ${Object.keys(MAPS).join(", ")}`,
  );
  process.exit(1);
}
printMap(mapName);

if (process.argv.includes("--legend")) {
  console.log(
    "\n圖例: · 草地  █ 牆/懸崖  ♣ 樹  ▭ 門檻  = 路  ≈ 湖/水  ▤ 農地  ░ 沙灘  ~ 海",
  );
}

// --landmarks：從 LAYOUT（唯一的座標 single source of truth，見
// layout-maps.ts 檔頭註解）遞迴掃出所有「有 x/z 座標的節點」，不用另外
// 手抄一份、之後會跟著 LAYOUT 改動脫鉤的座標清單。寫事件（例如某個 NPC
// 該站在哪、某個傳送點在哪）要查座標時直接跑這個指令；改了 LAYOUT 裡的
// 數字（搬房子、搬地標）之後這份清單自動就是最新的，不用手動維護。
interface Landmark {
  path: string;
  x: number;
  z: number;
  extra: string;
}

function collectLandmarks(
  node: unknown,
  path: string[],
  out: Landmark[],
): void {
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (typeof record.x === "number" && typeof record.z === "number") {
    const extra = Object.keys(record)
      .filter((k) => k !== "x" && k !== "z" && typeof record[k] !== "object")
      .map((k) => `${k}=${record[k]}`)
      .join(", ");
    out.push({ path: path.join("."), x: record.x, z: record.z, extra });
  }
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value !== null && typeof value === "object") {
      collectLandmarks(value, [...path, key], out);
    }
  }
}

if (process.argv.includes("--landmarks")) {
  const filterArg = process.argv.find((a) => a.startsWith("--filter="));
  const filter = filterArg ? filterArg.slice("--filter=".length).toLowerCase() : "";
  const landmarks: Landmark[] = [];
  collectLandmarks(LAYOUT, [], landmarks);
  const filtered = filter
    ? landmarks.filter((l) => l.path.toLowerCase().includes(filter))
    : landmarks;
  filtered.sort((a, b) => a.path.localeCompare(b.path));
  console.log(
    `\n=== LAYOUT 座標點（${filtered.length} 筆${filter ? `，篩選 "${filter}"` : ""}） ===`,
  );
  const pathWidth = Math.max(0, ...filtered.map((l) => l.path.length));
  for (const l of filtered) {
    const coord = `(${l.x}, ${l.z})`.padEnd(12, " ");
    console.log(
      `  ${l.path.padEnd(pathWidth, " ")}  ${coord}${l.extra ? "  " + l.extra : ""}`,
    );
  }
  if (filtered.length === 0) {
    console.log("  （沒有符合的座標點，換個 --filter 關鍵字試試）");
  }
}
