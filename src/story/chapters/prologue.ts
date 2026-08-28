import type { StoryEvent } from "../story-types";

// 既有 src/prologue.ts 暫時仍負責實際演出；先登記永久 ID，讓存檔、前置條件
// 與之後的主線都能引用同一事件。完成演出時由 prologue.ts 寫入完成狀態。
export const PROLOGUE_STORY_EVENTS: StoryEvent[] = [
  {
    id: "main.prologue.arrival",
    title: "抵達海風島",
    summary: "主角乘船抵達港口並被帶往新牧場。",
    chapter: "main.prologue",
    characters: ["player", "mayor"],
    priority: 1000,
    once: true,
    execution: "external",
    conditions: [{ type: "manual" }],
    steps: [],
  },
];
