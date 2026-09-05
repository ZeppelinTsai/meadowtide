import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_HOLD_MS, WorldPointerGesture } from "./world-pointer-gesture";

test("short press remains a navigation tap", () => {
  const gesture = new WorldPointerGesture();
  gesture.begin(1, 100, 100, 0, true);
  assert.deepEqual(gesture.end(1, 104, 103), { x: 104, y: 103 });
});

test("stationary first-person hold takes one photo and consumes the tap", () => {
  const gesture = new WorldPointerGesture();
  gesture.begin(1, 100, 100, 0, true);
  assert.equal(gesture.takeLongPress(PHOTO_HOLD_MS - 1), false);
  assert.equal(gesture.takeLongPress(PHOTO_HOLD_MS), true);
  assert.equal(gesture.takeLongPress(PHOTO_HOLD_MS + 100), false);
  assert.equal(gesture.end(1, 100, 100), null);
});

test("drag cancels photo hold and navigation tap", () => {
  const gesture = new WorldPointerGesture();
  gesture.begin(1, 100, 100, 0, true);
  assert.deepEqual(gesture.move(1, 120, 100), { x: 20, y: 0 });
  assert.equal(gesture.takeLongPress(PHOTO_HOLD_MS + 100), false);
  assert.equal(gesture.end(1, 120, 100), null);
});

test("standard camera hold remains a tap instead of taking a photo", () => {
  const gesture = new WorldPointerGesture();
  gesture.begin(1, 100, 100, 0, false);
  assert.equal(gesture.takeLongPress(PHOTO_HOLD_MS + 100), false);
  assert.deepEqual(gesture.end(1, 100, 100), { x: 100, y: 100 });
});
