import assert from "node:assert/strict";
import test from "node:test";
import { parseDebugCommand, prepareDebugSnapshot } from "./event-debug-core";
import { listStoryEvents } from "./story/story-registry";
import { auditStoryRegistry } from "./story/story-audit";
import { createCgPlaceholder } from "./cg-placeholder";
import type { StoryEvent } from "./story/story-types";

function snapshot() {
  return { currentDay: 9, currentPhase: 0.6, currentMapName: "livingArea", player: { x: 1, z: 1 }, prologue: null,
    story: { activeEventId: null, completedEvents: ["test.event"], flags: {}, choices: { "test.choice": "yes" }, claimedRewards: ["test.reward", "other.reward"] },
    dayTwoMorningEvent: {}, carpenterQuest: {}, artistQuest: {}, botanistQuest: {}, oceanographerQuest: {}, relationships: {}, inventory: {} };
}
test("all console commands validate before a test session mutates", () => {
  for (const cmd of ["help", "event.list", "location.list", "snapshot.restore", "event.play main.day2.arrivals auto", "event.play main.day2.arrivals ignore", "time.set 23:59", "date.set 7", "warp port", "affection.set carpenter 600", "flag.set test.flag false", "weather.set rain"]) assert.ok(parseDebugCommand(cmd));
  for (const cmd of ["", "toString", "date.set 0", "date.set NaN", "time.set 24:00", "time.set 8:12", "affection.set a -1", "affection.set a 801", "flag.set a yes", "flag.set __proto__ true", "event.play a unknown", "warp"]) assert.throws(() => parseDebugCommand(cmd));
});
test("auto applies registry conditions and resets only the selected event rewards on a copy", () => {
  const original = snapshot(); const before = structuredClone(original); const copy = structuredClone(original);
  const event: StoryEvent = { id: "test.event", title: "test", summary: "test", chapter: "test", characters: [], priority: 0, once: true,
    conditions: [{ type: "day", min: 1, max: 1 }, { type: "phase", min: 8/24 }, { type: "map", mapId: "port" }, { type: "flag", key: "test.ready", equals: true }, { type: "relationship", npcId: "carpenter", minPoints: 600 }, { type: "item", itemId: "wood", minCount: 10 }],
    steps: [{ type: "choice", choiceId: "test.choice", prompt: "test", options: [{ label: "test", value: "yes", steps: [{ type: "grantItem", rewardId: "test.reward", itemId: "wood", amount: 1 }] }] }] };
  prepareDebugSnapshot(copy, event, true, 21);
  assert.equal(copy.currentDay, 1); assert.equal(copy.currentPhase, 8/24); assert.equal(copy.currentMapName, "port");
  assert.equal(copy.player, null); assert.equal((copy.story.flags as any)["test.ready"], true);
  assert.equal((copy.relationships as any).carpenter.points, 600); assert.equal((copy.inventory as any).wood, 10);
  assert.deepEqual(copy.story.claimedRewards, ["other.reward"]); assert.deepEqual(copy.story.choices, {});
  assert.deepEqual(original, before);
});
test("ignore preserves date, map and affection while isolating unrelated automatic events", () => {
  const data = snapshot(); prepareDebugSnapshot(data, listStoryEvents()[0], false, 21);
  assert.equal(data.currentDay, 9); assert.equal(data.currentMapName, "livingArea"); assert.deepEqual(data.relationships, {});
  assert.equal((data.dayTwoMorningEvent as any).triggered, true);
});
test("all registered events audit and existing day-one/day-two entries are discoverable", () => {
  assert.deepEqual(auditStoryRegistry(listStoryEvents()).errors, []);
  for (const id of ["main.prologue.arrival", "main.day2.arrivals", "character.artist.personal"]) assert.ok(listStoryEvents().some(e => e.id === id));
  assert.equal(listStoryEvents().some(e => e.id.includes("day7")), false);
});
test("CG placeholder escapes text and keeps mobile typography at 20px or larger", () => {
  const svg = decodeURIComponent(createCgPlaceholder('cg<&"', '說明<script>', 390, 844).split(",")[1]);
  assert.ok(svg.includes("CG PLACEHOLDER")); assert.ok(svg.includes("cg&lt;&amp;&quot;")); assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes('width="390"')); assert.ok(svg.includes('font-size="20"'));
});
