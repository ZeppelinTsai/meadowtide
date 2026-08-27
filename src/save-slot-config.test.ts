import assert from "node:assert/strict";
import test from "node:test";
import { SAVE_SLOT_COUNT, saveSlotForDigitCode } from "./save-slot-config";

test("手動存檔共有 10 格", () => {
  assert.equal(SAVE_SLOT_COUNT, 10);
});

test("數字列 1~9 對應同號格，0 對應第 10 格", () => {
  for (let slot = 1; slot <= 9; slot++) {
    assert.equal(saveSlotForDigitCode(`Digit${slot}`), slot);
  }
  assert.equal(saveSlotForDigitCode("Digit0"), 10);
  assert.equal(saveSlotForDigitCode("Numpad0"), null);
  assert.equal(saveSlotForDigitCode("KeyA"), null);
});
