import { EXTERNAL_STORY_EVENTS } from "./chapters/external-events";
import { ACT1_STORY_EVENTS } from "./chapters/act1";
import { JSON_STORY_EVENTS } from "./chapters/json-events";
import type { StoryEvent, StoryEventId } from "./story-types";


// 序幕目前仍由 src/prologue.ts 的演出流程負責；story/chapters/prologue.ts
// 是舊檔，不是 StoryEvent 資料，因此在正式事件資料遷移完成前保持空章節。
const PROLOGUE_STORY_EVENTS: StoryEvent[] = [];

// 所有正式事件唯一的索引入口；不得从各章文件绕过 registry 直接查找。
// JSON_STORY_EVENTS 是 2026-09-01 Phase A 補的手寫 JSON 事件（見
// chapters/json-events.ts、chapters/data/*.json、docs/decisions/
// event-system.md）——進了這個陣列不代表會自動觸發，一樣要看各自的
// conditions（目前都是 manual only 的草稿/測試事件）。
export const STORY_EVENTS: StoryEvent[] = [
  ...PROLOGUE_STORY_EVENTS,
  ...EXTERNAL_STORY_EVENTS,
  ...ACT1_STORY_EVENTS,
  ...JSON_STORY_EVENTS,
];

const storyEventById = new Map<StoryEventId, StoryEvent>();
for (const event of STORY_EVENTS) {
  // 重複 ID 由 story-audit 負責給出完整報告；執行時保留第一筆，避免靜默覆蓋。
  if (!storyEventById.has(event.id)) storyEventById.set(event.id, event);
}

export function getStoryEvent(eventId: StoryEventId): StoryEvent | undefined {
  return storyEventById.get(eventId);
}

export function listStoryEvents(): readonly StoryEvent[] {
  return STORY_EVENTS;
}
