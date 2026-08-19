#!/usr/bin/env node
// 地圖除錯小工具 —— 從 HTML 檔案裡抽出「純資料」那一段(MAPS 定義 +
// 所有 splice/append/tile 覆寫的程式碼，完全不碰 THREE.js，所以能直接
// 丟進 Node 執行)，跑完之後印出一張文字版的地圖網格。
//
// 用法：node map-debug.js <html檔案路徑> [--map=livingArea|oldVillage|port|house] [--legend] [--landmarks]
//
// 這樣我之後改座標，不用開瀏覽器、不用等你截圖，先在終端機裡看一眼
// 格子對不對，抓到明顯錯位(疊在牆上、湖蓋到房子)可以先自己抓出來。

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('用法: node map-debug.js <html檔案路徑>');
  process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');
const scriptMatch = html.match(/<script src="https:\/\/cdnjs[^>]+><\/script>\s*<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
  console.error('找不到內嵌的 <script> 區塊');
  process.exit(1);
}
const fullScript = scriptMatch[1];

// 只抽取到 THREE.js 開始被用到之前的部分 —— 這一段都是純陣列/物件操作
const cutMarker = 'const TILE = 1;';
const cutIndex = fullScript.indexOf(cutMarker);
if (cutIndex === -1) {
  console.error('找不到切割點 (const TILE = 1;)，檔案結構可能變了');
  process.exit(1);
}
const dataScript = fullScript.slice(0, cutIndex);

// 在乾淨的 vm context 裡執行這段純資料程式碼，執行完把 MAPS 丟出來
const vm = require('vm');
const sandbox = {};
vm.createContext(sandbox);
try {
  vm.runInContext(dataScript + '\nthis.__MAPS = MAPS; this.__hash2 = hash2;', sandbox);
} catch (e) {
  console.error('執行失敗:', e.message);
  process.exit(1);
}
const MAPS = sandbox.__MAPS;

const LEGEND = {
  0: '·', 1: '█', 2: '♣', 3: '▭', 5: '=', 6: '≈', 7: '▤', 8: '░', 9: '~',
};

function printMap(mapName) {
  const map = MAPS[mapName];
  console.log(`\n=== ${mapName} (${map.tiles[0].length} x ${map.tiles.length}) ===`);
  const header = '    ' + Array.from({ length: map.tiles[0].length }, (_, x) =>
    (x % 10)).join('');
  console.log(header);
  map.tiles.forEach((row, z) => {
    const line = row.map(t => LEGEND[t] ?? '?').join('');
    console.log(String(z).padStart(3, ' ') + ' ' + line);
  });
  if (map.buildings) {
    console.log('buildings:', JSON.stringify(map.buildings));
  }
  if (map.playerStart) {
    console.log('playerStart:', JSON.stringify(map.playerStart));
  }
}

const mapArg = process.argv.find((a) => a.startsWith('--map='));
const mapName = mapArg ? mapArg.slice('--map='.length) : 'livingArea';
if (!MAPS[mapName]) {
  console.error(`找不到地圖 "${mapName}"，可用的地圖: ${Object.keys(MAPS).join(', ')}`);
  process.exit(1);
}
printMap(mapName);

if (process.argv.includes('--legend')) {
  console.log('\n圖例: · 草地  █ 牆/懸崖  ♣ 樹  ▭ 門檻  = 路  ≈ 湖/水  ▤ 農地  ░ 沙灘  ~ 海');
}

if (process.argv.includes('--landmarks')) {
  console.log('\n(標記房子/穀倉/NPC等地標，之後可以擴充這段)');
}
