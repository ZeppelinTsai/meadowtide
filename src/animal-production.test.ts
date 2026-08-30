import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceProductionProgress,
  isProductionReady,
} from "./animal-production";

test("牛每天成功餵食一次後恢復擠奶", () => {
  assert.equal(advanceProductionProgress("cow", 0, false), 0);
  const fed = advanceProductionProgress("cow", 0, true);
  assert.equal(fed, 1);
  assert.equal(isProductionReady("cow", fed), true);
});

test("羊需要三個成功餵食日，沒餵食不增加進度", () => {
  let progress = 0;
  progress = advanceProductionProgress("sheep", progress, true);
  progress = advanceProductionProgress("sheep", progress, false);
  progress = advanceProductionProgress("sheep", progress, true);
  assert.equal(progress, 2);
  assert.equal(isProductionReady("sheep", progress), false);
  progress = advanceProductionProgress("sheep", progress, true);
  assert.equal(isProductionReady("sheep", progress), true);
});
