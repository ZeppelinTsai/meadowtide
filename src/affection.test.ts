import assert from "node:assert/strict";
import test from "node:test";
import {
  addAffection,
  completePersonalEvent,
  getDisplayedStars,
  getRelationship,
  resetRelationshipsForTests,
} from "./affection";

for (const [stage, cap] of [
  [2, 250],
  [4, 450],
  [6, 650],
] as const) {
  test(`${stage} 星鎖定：門檻後最多暫存到 ${cap}`, () => {
    resetRelationshipsForTests();
    const npcId = `lock-${stage}`;
    const state = getRelationship(npcId);
    state.points = stage * 100 - 5;
    state.unlockedStages = [2, 4, 6].filter(
      (value) => value < stage,
    ) as (2 | 4 | 6)[];
    addAffection(npcId, 5);
    assert.equal(state.currentLock, stage);
    addAffection(npcId, 999);
    assert.equal(state.points, cap);
    assert.equal(getDisplayedStars(npcId), stage);
    assert.equal(addAffection(npcId, 5).applied, 0);
    const event = completePersonalEvent(npcId, stage, `heart-${stage}`);
    assert.equal(event.completed, true);
    assert.equal(event.affection?.applied, 30);
    assert.equal(state.points, cap + 30);
    assert.equal(state.currentLock, null);
  });
}

test("解鎖會保留 50 點暫存值，再完整加入事件 +30", () => {
  resetRelationshipsForTests();
  const npcId = "unlock";
  addAffection(npcId, 999);
  assert.equal(getRelationship(npcId).points, 250);
  const result = completePersonalEvent(npcId, 2, "heart-2");
  assert.equal(result.completed, true);
  assert.equal(result.affection?.applied, 30);
  assert.equal(getRelationship(npcId).points, 280);
  assert.equal(getRelationship(npcId).currentLock, null);
  assert.deepEqual(getRelationship(npcId).completedEvents, ["heart-2"]);
});

test("同一個個人事件只能完成並獎勵一次", () => {
  resetRelationshipsForTests();
  const npcId = "duplicate";
  addAffection(npcId, 200);
  completePersonalEvent(npcId, 2, "heart-2");
  const points = getRelationship(npcId).points;
  const duplicate = completePersonalEvent(npcId, 2, "heart-2");
  assert.equal(duplicate.duplicate, true);
  assert.equal(getRelationship(npcId).points, points);
});
