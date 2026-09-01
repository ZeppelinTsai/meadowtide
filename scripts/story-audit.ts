import { STORY_EVENTS } from "../src/story/story-registry";
import { auditStoryRegistry } from "../src/story/story-audit";

// story-registry.ts 現在會把 chapters/json-events.ts 的 JSON_STORY_EVENTS
// 一起併進 STORY_EVENTS，這支腳本用 tsx 直接跑也能拿到同一份（JSON
// import 在 tsx／Vite 底下行為一致，不像先前的 import.meta.glob 版本
// 需要分開兩條路徑，見 json-events.ts 開頭註解），所以這裡不用再另外
// 用 node:fs 讀一次 data/ 資料夾。
const result = auditStoryRegistry(STORY_EVENTS);
for (const warning of result.warnings) console.warn(`[story-audit] WARNING: ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`[story-audit] ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`[story-audit] OK: ${STORY_EVENTS.length} event(s)`);
}
