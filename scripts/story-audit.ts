import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STORY_EVENTS } from "../src/story/story-registry";
import { auditStoryRegistry } from "../src/story/story-audit";
import type { StoryEvent } from "../src/story/story-types";

// story-registry.ts 的 JSON_STORY_EVENTS（chapters/json-events.ts）靠
// Vite 的 import.meta.glob 載入，這支腳本用 tsx 直接跑（不經過 Vite），
// 環境裡沒有 import.meta.glob，所以 STORY_EVENTS 這邊拿到的 JSON 事件
// 一定是空的（json-events.ts 自己有 typeof 檢查，不會噴錯，但也不會
// 载到東西）。這裡另外用 node:fs 直接讀同一個 chapters/data/*.json
// 資料夾，補上這批事件的 audit 覆蓋——瀏覽器跑起來時真正生效的
// STORY_EVENTS（含 JSON 事件）见 story-registry.ts 本身，這支腳本只是
// 讓 `npm run story-audit` 也能驗到 JSON 檔案內容，兩條路徑分開但驗證
// 同一批檔案，見 docs/decisions/event-system.md Phase A。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonEventsDir = path.join(__dirname, "../src/story/chapters/data");
const jsonEvents: StoryEvent[] = [];
if (fs.existsSync(jsonEventsDir)) {
  for (const file of fs.readdirSync(jsonEventsDir)) {
    if (!file.endsWith(".json")) continue;
    const filePath = path.join(jsonEventsDir, file);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      jsonEvents.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      console.error(`[story-audit] ERROR: 無法解析 ${file}：${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}

const allEvents = [...STORY_EVENTS, ...jsonEvents];
const result = auditStoryRegistry(allEvents);
for (const warning of result.warnings) console.warn(`[story-audit] WARNING: ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`[story-audit] ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `[story-audit] OK: ${allEvents.length} event(s)（TS: ${STORY_EVENTS.length}，JSON: ${jsonEvents.length}）`,
  );
}
