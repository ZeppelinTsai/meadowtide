import type { StoryEvent } from "../story-types";

// ==============================================================
// event-system Phase 1 概念驗證專用測試事件。2026-09-01。
//
// 目的不是內容，是拿來驗證「story/ 這套正式系統＋一份真正的
// StoryRuntimeBindings 實作」到底堪不堪用，見 docs/decisions/
// event-system.md「Phase 1」段落的四個停損標準。故意：
//   - 跟現有序章/木匠劇情完全無關，不會撞到任何真實內容
//   - 只能用 F9 debug 熱鍵手動觸發（見 src/input-save.ts），不會出現在
//     正常玩流程、不接進 story-registry.ts 的 STORY_EVENTS
//   - once: false，方便反覆按 F9 重跑，不用每次都重設存檔
//
// 內容：玩家按 F9 → 村長被叫過來，寒暄兩句後回去巡田。刻意涵蓋
// pauseTime、fade、setActorVisible、positionActor、camera、dialogue
// 六種這輪新增/既有的 StoryStep，是這次盤點兩份真實腳本後歸納出的
// 共通積木。choice/move/follow/teleport/grantItem 沒有用到，因為
// 這個小測試内容用不上，不代表這幾個 binding 也驗證過了。
// ==============================================================

export function createDevPhase1ProbeEvent(
  originX: number,
  originZ: number,
): StoryEvent {
  const mayorTargetX = originX + 1.4;
  const mayorTargetZ = originZ;

  return {
    id: "dev.phase1_probe.mayor_wave",
    title: "[Phase1 概念驗證] 村長寒暄",
    summary:
      "F9 debug 熱鍵專用，測試 story/ 系統＋story-runtime-browser.ts 是否真的能操作暫停時間／演員／淡入淡出／鏡頭／台詞。",
    chapter: "dev",
    characters: ["mayor"],
    priority: 0,
    once: false,
    conditions: [{ type: "manual" }],
    steps: [
      { type: "pauseTime", active: true, source: "storyEvent" },
      { type: "fade", action: "out", holdMilliseconds: 900 },
      { type: "setActorVisible", actorId: "mayor", visible: true },
      {
        type: "positionActor",
        actorId: "mayor",
        target: { x: mayorTargetX, z: mayorTargetZ },
      },
      { type: "fade", action: "in" },
      {
        type: "camera",
        waitForCompletion: true,
        shots: [
          {
            focusX: mayorTargetX,
            focusZ: mayorTargetZ,
            zoom: 10,
            duration: 0.6,
          },
        ],
      },
      {
        type: "dialogue",
        textKey: "devtest.wave.narration_approach",
        hidePortrait: true,
      },
      {
        type: "dialogue",
        textKey: "devtest.wave.greeting",
        speakerId: "mayor",
        nameKey: "carpenter.name.mayor",
      },
      {
        type: "dialogue",
        textKey: "devtest.wave.follow_up",
        speakerId: "mayor",
        nameKey: "carpenter.name.mayor",
      },
      { type: "pauseTime", active: false, source: "storyEvent" },
    ],
  };
}
