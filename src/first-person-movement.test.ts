import assert from "node:assert/strict";
import test from "node:test";
import { firstPersonMoveVector } from "./first-person-movement";

const closeTo = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("yaw 0 keeps W forward on world -Z and D on world +X", () => {
  const forward = firstPersonMoveVector(0, -1, 0);
  closeTo(forward.x, 0);
  closeTo(forward.z, -1);
  const right = firstPersonMoveVector(1, 0, 0);
  closeTo(right.x, 1);
  closeTo(right.z, 0);
});

test("turning right rotates forward and strafe with the camera", () => {
  const yaw = -Math.PI / 2;
  const forward = firstPersonMoveVector(0, -1, yaw);
  closeTo(forward.x, 1);
  closeTo(forward.z, 0);
  const left = firstPersonMoveVector(-1, 0, yaw);
  closeTo(left.x, 0);
  closeTo(left.z, -1);
});

test("diagonal input preserves its length before normalisation", () => {
  const move = firstPersonMoveVector(1, -1, 0.7);
  closeTo(Math.hypot(move.x, move.z), Math.SQRT2);
});
