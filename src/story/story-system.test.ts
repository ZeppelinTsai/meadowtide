import assert from "node:assert/strict";
import test from "node:test";
import { auditStoryRegistry } from "./story-audit";
import { evaluateStoryEvent } from "./story-conditions";
import { runStoryEvent, type StoryRuntimeAdapter } from "./story-runner";
import {
  createDefaultStoryState,
  normalizeStoryState,
  resetStoryState,
  storyState,
} from "./story-state";
import type { StoryContext, StoryEvent } from "./story-types";

const context: StoryContext = {
  mapId: "oldVillage",
  day: 2,
  season: 0,
  phase: 0.5,
  relationships: { mayor: 205 },
  inventory: { wood: 10 },
};

const event: StoryEvent = {
  id: "main.act1.test_event",
  title: "測試事件",
  summary: "驗證條件、選擇與完成狀態。",
  chapter: "main.act1",
  characters: ["mayor"],
  priority: 100,
  once: true,
  conditions: [
    { type: "map", mapId: "oldVillage" },
    { type: "relationship", npcId: "mayor", minPoints: 200 },
  ],
  steps: [
    { type: "setFlag", key: "test.started", value: true },
    {
      type: "choice",
      choiceId: "main.act1.test_event.reply",
      promptKey: "story.main.act1.test_event.prompt",
      options: [
        {
          labelKey: "story.main.act1.test_event.yes",
          value: "yes",
          steps: [{ type: "grantItem", rewardId: "main.act1.test_event.wood", itemId: "wood", amount: 1 }],
        },
      ],
    },
  ],
};

test("舊存檔會補齊劇情狀態且清除中斷中的事件", () => {
  assert.deepEqual(normalizeStoryState({ activeEventId: "broken", completedEvents: ["a", "a"] }), {
    ...createDefaultStoryState(),
    completedEvents: ["a"],
  });
});

test("條件判定會回傳可讀的失敗原因", () => {
  const failed = evaluateStoryEvent(event, { ...context, mapId: "port" }, createDefaultStoryState());
  assert.equal(failed.eligible, false);
  assert.match(failed.reasons.join(" "), /oldVillage/);
});

test("執行器記錄選擇、獎勵與完成事件，once 事件不可重複", async () => {
  resetStoryState();
  const executed: string[] = [];
  const adapter: StoryRuntimeAdapter = {
    async showDialogue() {},
    async showChoice() { return "yes"; },
    async execute(step) { executed.push(step.type); },
  };
  await runStoryEvent(event, context, adapter);
  assert.deepEqual(storyState.completedEvents, [event.id]);
  assert.equal(storyState.choices["main.act1.test_event.reply"], "yes");
  assert.deepEqual(executed, ["grantItem"]);
  await assert.rejects(() => runStoryEvent(event, context, adapter), /事件已完成/);
});

test("audit 會抓重複 ID、缺少前置與循環", () => {
  const broken: StoryEvent[] = [
    { ...event, id: "main.a", conditions: [{ type: "eventCompleted", eventId: "main.b" }] },
    { ...event, id: "main.b", conditions: [{ type: "eventCompleted", eventId: "main.a" }] },
    { ...event, id: "main.a", conditions: [{ type: "eventCompleted", eventId: "main.missing" }] },
  ];
  const result = auditStoryRegistry(broken);
  assert.ok(result.errors.some((message) => message.includes("重複事件 ID")));
  assert.ok(result.errors.some((message) => message.includes("前置事件不存在")));
  assert.ok(result.errors.some((message) => message.includes("循環")));
});

test("獎勵動作失敗時不會提前登記為已領取", async () => {
  resetStoryState();
  const adapter: StoryRuntimeAdapter = {
    async showDialogue() {},
    async showChoice() { return "yes"; },
    async execute() { throw new Error("inventory unavailable"); },
  };
  await assert.rejects(() => runStoryEvent(event, context, adapter), /inventory unavailable/);
  assert.deepEqual(storyState.claimedRewards, []);
  assert.equal(storyState.activeEventId, null);
});
