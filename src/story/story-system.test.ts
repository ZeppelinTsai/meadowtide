import assert from "node:assert/strict";
import test from "node:test";
import { auditStoryRegistry } from "./story-audit";
import { evaluateStoryEvent } from "./story-conditions";
import { runStoryEvent, type StoryRuntimeAdapter } from "./story-runner";
import { createStoryRuntimeAdapter } from "./story-runtime-adapter";
import {
  createDefaultStoryState,
  normalizeStoryState,
  resetStoryState,
  storyState,
} from "./story-state";
import type { StoryContext, StoryEvent } from "./story-types";
import { createDevPhase1ProbeEvent } from "./chapters/dev-phase1-probe";
import { pickLocalizedField } from "./story-text";

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

test("runtime adapter 轉送鏡頭、移動、引路、傳送並輪詢玩法條件", async () => {
  const executed: string[] = [];
  let checks = 0;
  const adapter = createStoryRuntimeAdapter({
    async dialogue() { executed.push("dialogue"); },
    async choice() { return "ok"; },
    async camera() { executed.push("camera"); },
    async move() { executed.push("move"); },
    async follow() { executed.push("follow"); },
    async teleport() { executed.push("teleport"); },
    async grantItem() { executed.push("grantItem"); },
    check() { checks++; return checks >= 2; },
    async setActorVisible() { executed.push("setActorVisible"); },
    async positionActor() { executed.push("positionActor"); },
    async matchActorPosition() { executed.push("matchActorPosition"); },
    async fade() { executed.push("fade"); },
    async pauseTime() { executed.push("pauseTime"); },
  });
  await adapter.execute({ type: "camera", shots: [{ focusX: 46.39, focusZ: 23.78, zoom: 0.55, yaw: -2.55, pitch: 0.365, duration: 1.5 }] });
  await adapter.execute({ type: "move", actorId: "mayor", target: { x: 46.54, z: 19.44 } });
  await adapter.execute({ type: "follow", leaderId: "mayor", followerId: "player", destination: { mapId: "oldVillage", x: 46.54, z: 19.44 } });
  await adapter.execute({ type: "teleport", mapId: "oldVillage", target: { x: 46.54, z: 19.44 } });
  await adapter.execute({ type: "waitFor", condition: { type: "cropCount", areaId: "tutorialPlot", count: 9 }, pollMilliseconds: 0 });
  await adapter.execute({ type: "setActorVisible", actorId: "carpenter", visible: true });
  await adapter.execute({ type: "positionActor", actorId: "carpenter", target: { x: 1, z: 1 } });
  await adapter.execute({ type: "matchActorPosition", actorId: "carpenter", toActorId: "player" });
  await adapter.execute({ type: "fade", action: "out", holdMilliseconds: 900 });
  await adapter.execute({ type: "pauseTime", active: true, source: "event" });
  assert.deepEqual(executed, [
    "camera",
    "move",
    "follow",
    "teleport",
    "setActorVisible",
    "positionActor",
    "matchActorPosition",
    "fade",
    "pauseTime",
  ]);
  assert.equal(checks, 2);
});

// event-system Phase 1 停損標準第一項：「新事件能通過 story-audit、
// test:story、build」。dev.phase1Probe 故意不放進 story-registry.ts 的
// STORY_EVENTS（見該檔開頭註解），所以 npm run story-audit 不會自動掃到
// 它——這裡直接把它單獨餵給 auditStoryRegistry() 補上這一段驗證，不能
// 只看 scripts/story-audit.ts 印出「0 event(s)」就以為過關。
test("Phase1 概念驗證事件：dev.phase1Probe 通過 story-audit 結構檢查、manual 條件可手動觸發", () => {
  const probe = createDevPhase1ProbeEvent(10, 5);
  const audit = auditStoryRegistry([probe]);
  assert.deepEqual(audit.errors, []);

  const eligibility = evaluateStoryEvent(
    probe,
    { mapId: "livingArea", day: 0, season: 0, phase: 0, relationships: {}, inventory: {} },
    createDefaultStoryState(),
    { allowManual: true },
  );
  assert.equal(eligibility.eligible, true, eligibility.reasons.join("；"));
});

// event-system Phase A：JSON 手寫事件用的 text／text_en／text_ja 扁平
// 後綴欄位（story-text.ts 的 pickLocalizedField）跟 textKey 那條路並存
// ——這裡驗證挑語言的邏輯本身跟 story-audit 對「至少要有一個」的檢查。
test("Phase A：pickLocalizedField 依 locale 挑字串，查無時退回 zh 基準欄位", () => {
  const source = { text: "你好", text_en: "Hello" };
  assert.equal(pickLocalizedField(source, "text", "zh"), "你好");
  assert.equal(pickLocalizedField(source, "text", "en"), "Hello");
  // 沒有 text_ja，退回基準欄位 text（zh）
  assert.equal(pickLocalizedField(source, "text", "ja"), "你好");
  assert.equal(pickLocalizedField({}, "text", "zh"), undefined);
});

test("Phase A：dialogue/choice 沒有 textKey/promptKey 時，用 text/prompt 也能通過 story-audit（JSON 手寫事件的核心用法）", () => {
  const jsonStyleEvent: StoryEvent = {
    id: "dev.phase_a_text_field_check",
    title: "Phase A 文字欄位測試",
    summary: "驗證 text/prompt/label 不靠 i18n key 也能過 audit。",
    chapter: "dev",
    characters: [],
    priority: 0,
    once: false,
    conditions: [{ type: "manual" }],
    steps: [
      { type: "dialogue", text: "直接寫死的中文台詞", text_en: "A literal English line" },
      {
        type: "choice",
        choiceId: "phaseATestChoice",
        prompt: "要選哪個？",
        options: [
          { value: "a", label: "選項A" },
          { value: "b", label: "選項B" },
        ],
      },
    ],
  };
  const audit = auditStoryRegistry([jsonStyleEvent]);
  assert.deepEqual(audit.errors, []);

  const missingBoth: StoryEvent = {
    ...jsonStyleEvent,
    id: "dev.phase_a_text_field_missing",
    steps: [{ type: "dialogue" } as StoryEvent["steps"][number]],
  };
  const auditMissing = auditStoryRegistry([missingBoth]);
  assert.ok(auditMissing.errors.some((e) => e.includes("缺少 textKey 或 text")));
});
