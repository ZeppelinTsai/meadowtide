// 2026-09-01：CG／立繪這類「一堆各自獨立圖檔、執行期才知道要載哪一張」
// 的圖片資源，用這個共用邏輯做響應式 WebP——跟世界地圖底圖那種「單一
// 固定檔案、寫死在 index.html 的 <picture><source srcset> 裡」不是同一
// 招，因為 CG/立繪的檔名(cgId/speakerId)是執行期才決定的，沒辦法預先
// 寫死一份 HTML。見 docs/decisions/responsive-images.md。
//
// 用法：呼叫端準備一個 <img>，先試 responsiveWebpUrl() 給的 WebP 網址，
// onerror 再退回原始 PNG——WebP 版本還沒產生（或這個 id 本來就沒建立）
// 時會自動走原始 PNG 這條路，不會出錯，跟現有「找不到圖檔就維持原本
// 畫面」的容錯精神一致。

/** 依目前視窗寬度(乘上 devicePixelRatio 抓高解析度螢幕)，從候選寬度裡
 * 挑「足夠大、但不要更大」的一個——比自己實際需要的还大就是浪費頻寬，
 * 比實際需要的小則會模糊，這跟瀏覽器原生 srcset 的選擇邏輯是同一個
 * 精神，只是這裡因為圖檔名要動態組出來，沒辦法直接交給瀏覽器做。 */
export function pickResponsiveWidth(widths: readonly number[]): number {
  const sorted = [...widths].sort((a, b) => a - b);
  if (!sorted.length) throw new Error("[responsive-images] widths 不能是空陣列");
  const target = window.innerWidth * (window.devicePixelRatio || 1);
  return sorted.find((width) => width >= target) ?? sorted[sorted.length - 1];
}

/** 組出目前視窗寬度下該載入的 WebP 網址，例如
 * responsiveWebpUrl("/assets/cg", "carpenter_movein", CG_WIDTHS)
 * → "/assets/cg/carpenter_movein-1920.webp"（假設目前視窗落在最大那層）。 */
export function responsiveWebpUrl(
  baseDir: string,
  name: string,
  widths: readonly number[],
): string {
  const width = pickResponsiveWidth(widths);
  return `${baseDir}/${name}-${width}.webp`;
}

// 這兩組寬度是「畫面上這個元素實際會多大」推出來的，不是隨便挑的：
// CG 是全螢幕(#cgImg { width:100%; height:100% })，直接對齊系統設定
// 裡的三個視窗解析度選項(1280/1600/1920，見 system-settings-ui.ts 的
// RESOLUTIONS)；立繪(#dialogPortrait)最大只有 min(86vw, 760px)，抓
// 400/600/800 三檔涵蓋到略高於那個上限，給高 DPI 螢幕留一點餘裕。
// scripts/export-responsive-images.py 目前沒辦法直接讀這個 TS 常數
// （兩種語言各自維護），跑 --widths 參數時要記得跟這裡手動對齊，見
// docs/decisions/responsive-images.md。
export const CG_RESPONSIVE_WIDTHS = [1280, 1600, 1920] as const;
export const PORTRAIT_RESPONSIVE_WIDTHS = [400, 600, 800] as const;
