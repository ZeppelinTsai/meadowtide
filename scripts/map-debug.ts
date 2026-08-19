#!/usr/bin/env node
// 地圖除錯小工具 —— 直接從 src/layout-maps.ts import MAPS/LAYOUT，跟原本
// meadowtide.html 版本靠 regex 抽取＋vm 執行「純資料」那段的做法相比，
// 現在有了真正的模組邊界，不用再抽取字串執行。
//
// 用法：npm run map-debug -- [--map=livingArea|oldVillage|port|house] [--legend] [--landmarks]
//
// layout-maps.ts 必須保持零 DOM/WebGL 依賴（不能 import 任何最終會拉到
// THREE.WebGLRenderer / document.getElementById 的模組），這支工具才能在
// 純 Node 環境下執行，不用開瀏覽器就能先看一眼格子對不對。

import { MAPS } from "../src/layout-maps";

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

if (process.argv.includes("--landmarks")) {
  console.log("\n(標記房子/穀倉/NPC等地標，之後可以擴充這段)");
}
