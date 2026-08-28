import { ACT1_STORY_EVENTS } from "./chapters/act1";
import { PROLOGUE_STORY_EVENTS } from "./chapters/prologue";
import type { StoryEvent, StoryEventId } from "./story-types";

// 所有正式事件唯一的索引入口；不得从各章文件绕过 registry 直接查找。
export const STORY_EVENTS: StoryEvent[] = [
  ...PROLOGUE_STORY_EVENTS,
  ...ACT1_STORY_EVENTS,
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
