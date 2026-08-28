import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseInteractionTarget,
  gamepadPromptFor,
  isPrimaryInteractionKey,
  promptFor,
  type InteractionCandidate,
  type InteractionSlot,
} from "./context-interaction";

const action = {
  id: "pet",
  label: "撫摸",
  slot: "primary" as const,
  execute() {},
};

function candidate(
  id: string,
  distance: number,
  facingScore: number,
  pointed = false,
): InteractionCandidate {
  return { id, distance, facingScore, pointed, actions: [action] };
}

test("滑鼠指向優先於距離與朝向", () => {
  const result = chooseInteractionTarget(
    [candidate("near", 0.5, 1), candidate("pointed", 2, 0.1, true)],
    null,
  );
  assert.equal(result?.id, "pointed");
});

test("目標遲滯會保留仍然接近最佳候選的舊目標", () => {
  const result = chooseInteractionTarget(
    [candidate("old", 1.2, 0.82), candidate("new", 1, 0.9)],
    "old",
  );
  assert.equal(result?.id, "old");
});

test("沒有可執行動作的候選不會被選取", () => {
  const empty = candidate("empty", 0.2, 1);
  empty.actions = [];
  assert.equal(chooseInteractionTarget([empty], null), null);
});

test("Nintendo 與 Xbox 顯示同一組實體西北東鍵的正確名稱", () => {
  const slots: InteractionSlot[] = ["primary", "secondary", "tertiary"];
  assert.deepEqual(
    slots.map((slot) => gamepadPromptFor(slot, "nintendo")),
    ["Y", "X", "A"],
  );
  assert.deepEqual(
    slots.map((slot) => gamepadPromptFor(slot, "xbox")),
    ["X", "Y", "B"],
  );
  assert.deepEqual(
    slots.map((slot) => promptFor(slot, "keyboardMouse", "xbox")),
    ["E", "R", "F"],
  );
});

test("E, Enter, and Space share the primary keyboard action", () => {
  assert.equal(isPrimaryInteractionKey("e"), true);
  assert.equal(isPrimaryInteractionKey("E"), true);
  assert.equal(isPrimaryInteractionKey("Enter"), true);
  assert.equal(isPrimaryInteractionKey(" "), true);
  assert.equal(isPrimaryInteractionKey("Spacebar"), true);
  assert.equal(isPrimaryInteractionKey("r"), false);
});
