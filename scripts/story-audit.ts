import { STORY_EVENTS } from "../src/story/story-registry";
import { auditStoryRegistry, auditStoryTranslations } from "../src/story/story-audit";
import { STORY_TRANSLATION_ROWS } from "../src/story-script-translations";

// story-registry.ts 現在會把 chapters/json-events.ts 的 JSON_STORY_EVENTS
// 一起併進 STORY_EVENTS，這支腳本用 tsx 直接跑也能拿到同一份（JSON
// import 在 tsx／Vite 底下行為一致，不像先前的 import.meta.glob 版本
// 需要分開兩條路徑，見 json-events.ts 開頭註解），所以這裡不用再另外
// 用 node:fs 讀一次 data/ 資料夾。
const eventResult = auditStoryRegistry(STORY_EVENTS);
// 2026-09-04 加入：STORY_TRANSLATION_ROWS(story-script-translations.ts)
// 用原文中文當 key 查表，重複原文會悄悄互相覆蓋，見 story-audit.ts 裡
// auditStoryTranslations() 的註解。這裡跟事件結構檢查合併回報，任一邊
// 有錯就讓這支腳本(以及跑它的 build/CI)失敗。
const translationResult = auditStoryTranslations(STORY_TRANSLATION_ROWS);

const warnings = [...eventResult.warnings, ...translationResult.warnings];
const errors = [...eventResult.errors, ...translationResult.errors];

for (const warning of warnings) console.warn(`[story-audit] WARNING: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[story-audit] ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[story-audit] OK: ${STORY_EVENTS.length} event(s), ${STORY_TRANSLATION_ROWS.length} translation row(s)`,
  );
}
