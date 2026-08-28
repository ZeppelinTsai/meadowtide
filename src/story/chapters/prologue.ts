import type { StoryEvent } from "../story-types";
import { PROLOGUE_GUIDE_CAMERA_SHOTS } from "./prologue-script";

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
    // 既有序幕仍由 prologue.ts 演出；這份資料先作為新指令格式的正式範例，
    // 遷移時直接把 external 改成 steps 並補齊其餘段落。
    steps: [
      { type: "camera", shots: PROLOGUE_GUIDE_CAMERA_SHOTS, waitForCompletion: true },
      {
        type: "follow",
        leaderId: "mayor",
        followerId: "player",
        destination: { mapId: "oldVillage", x: 46.54, z: 19.44 },
        speed: 1.6,
        maxDistance: 4,
        reminderTextKey: "story.prologue.followMayor",
      },
    ],
  },
];
