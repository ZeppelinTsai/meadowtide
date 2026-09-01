// exe 匯出前的資產檢查：世界地圖底圖、CG、（未來可能還有立繪）這幾類
// 圖片資源都有一套響應式 WebP 版本，靠 `npm run assets:webp` 系列腳本
// (scripts/export-responsive-images.py) 手動產生——沒有任何機制會在
// 忘記重新產生時自動提醒。這支腳本掛在 `npm run build:win` 前面，只印
// 警告不擋 build（用意是提醒，不是強制），來源圖檔還沒放（美術還沒做）
// 時完全不出聲，安靜跳過。
//
// 兩種模式對應 export-responsive-images.py 的兩種模式：
//   source：單一固定檔案（世界地圖底圖，寫死在 index.html 的
//           <picture><source srcset> 裡）。
//   sourceDir：一整個資料夾，裡面每個 *.png 各自要有一組響應式版本
//              （CG／立繪這種「執行期才決定要載哪張」的圖片，見
//              src/responsive-images.ts、src/dialogue.ts）。
// 之後要幫立繪也做這套處理時，在下面 RESPONSIVE_IMAGE_SETS 加一筆
// sourceDir 設定就好（寬度要跟 src/responsive-images.ts 的
// PORTRAIT_RESPONSIVE_WIDTHS 對齊），不用再另外寫檢查邏輯。見
// docs/decisions/responsive-images.md。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

interface SingleSourceSet {
  kind: "source";
  label: string;
  source: string; // 相對 ROOT 的來源 PNG 路徑
  variantDir: string; // 相對 ROOT 的輸出資料夾
  name: string; // export-responsive-images.py 的 --name
  widths: number[];
}

interface DirectorySourceSet {
  kind: "sourceDir";
  label: string;
  sourceDir: string; // 相對 ROOT，資料夾底下每個 *.png 各自檢查
  widths: number[];
  exportCommand: string; // 印給使用者看的重新匯出指令
}

type ResponsiveImageSet = SingleSourceSet | DirectorySourceSet;

const RESPONSIVE_IMAGE_SETS: ResponsiveImageSet[] = [
  {
    kind: "source",
    label: "世界地圖底圖",
    source: "public/assets/map/world-map.png",
    variantDir: "public/assets/map",
    name: "world-map",
    widths: [480, 960, 1440],
  },
  {
    kind: "sourceDir",
    label: "CG",
    sourceDir: "public/assets/cg",
    // 跟 src/responsive-images.ts 的 CG_RESPONSIVE_WIDTHS 對齊。
    widths: [1280, 1600, 1920],
    exportCommand: "npm run assets:webp:cg",
  },
];

// 讀 PNG 檔頭拿寬度（IHDR chunk：簽章 8 bytes + chunk length 4 bytes +
// "IHDR" 4 bytes 之後，width 是 big-endian uint32），不需要裝 Pillow
// 或其他圖片函式庫。export-responsive-images.py 「來源比某個 tier 窄
// 就跳過、不放大」的邏輯在這裡也要對齊，不然來源解析度不夠大時，被
// 刻意跳過的 tier 會被這支腳本誤判成「忘記匯出」。
function getPngWidth(filePath: string): number {
  const buffer = Buffer.alloc(24);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  const isPng = buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a;
  if (!isPng) throw new Error(`[check-responsive-images] ${filePath} 不是有效的 PNG 檔`);
  return buffer.readUInt32BE(16);
}

function checkOne(sourcePath: string, variantDir: string, name: string, widths: number[]) {
  const sourceMtime = fs.statSync(sourcePath).mtimeMs;
  const sourceWidth = getPngWidth(sourcePath);
  const applicableWidths = widths.filter((width) => width <= sourceWidth);
  const missing: string[] = [];
  const stale: string[] = [];
  for (const width of applicableWidths) {
    const variantPath = path.join(ROOT, variantDir, `${name}-${width}.webp`);
    if (!fs.existsSync(variantPath)) {
      missing.push(`${name}-${width}.webp`);
      continue;
    }
    if (fs.statSync(variantPath).mtimeMs < sourceMtime) {
      stale.push(`${name}-${width}.webp`);
    }
  }
  return { missing, stale };
}

let warned = false;
for (const set of RESPONSIVE_IMAGE_SETS) {
  if (set.kind === "source") {
    const sourcePath = path.join(ROOT, set.source);
    if (!fs.existsSync(sourcePath)) continue; // 美術還沒做，不用提醒
    const { missing, stale } = checkOne(sourcePath, set.variantDir, set.name, set.widths);
    if (missing.length || stale.length) {
      warned = true;
      console.warn(`\n[check-responsive-images] ${set.label}（${set.source}）的響應式 WebP 版本需要重新產生：`);
      if (missing.length) console.warn(`  缺少：${missing.join("、")}`);
      if (stale.length) console.warn(`  過舊（比來源 PNG 舊，來源改過但沒重新匯出）：${stale.join("、")}`);
      console.warn(`  執行：npm run assets:webp -- --input ${set.source} --output-dir ${set.variantDir} --name ${set.name}`);
    }
  } else {
    const dirPath = path.join(ROOT, set.sourceDir);
    if (!fs.existsSync(dirPath)) continue;
    const pngFiles = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith(".png"));
    const problems: string[] = [];
    for (const file of pngFiles) {
      const name = file.replace(/\.png$/i, "");
      const { missing, stale } = checkOne(path.join(dirPath, file), set.sourceDir, name, set.widths);
      if (missing.length) problems.push(`${file}：缺少 ${missing.join("、")}`);
      if (stale.length) problems.push(`${file}：過舊 ${stale.join("、")}`);
    }
    if (problems.length) {
      warned = true;
      console.warn(`\n[check-responsive-images] ${set.label}（${set.sourceDir}/）有 ${problems.length} 個檔案的響應式 WebP 版本需要重新產生：`);
      for (const problem of problems) console.warn(`  ${problem}`);
      console.warn(`  執行：${set.exportCommand}`);
    }
  }
}

if (!warned) {
  console.log("[check-responsive-images] 響應式圖片版本檢查通過（或美術尚未加入，無需處理）");
}
