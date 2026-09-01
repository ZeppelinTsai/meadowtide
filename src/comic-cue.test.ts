import assert from "node:assert/strict";
import test from "node:test";
import { shouldDisplayDialogText } from "./comic-cue-logic";

test("comic cues hide dialogue text while the animation is active", () => {
  assert.equal(
    shouldDisplayDialogText({
      comicCue: { actorId: "mayor", kind: "sweatFace" },
    }),
    false,
  );
  assert.equal(
    shouldDisplayDialogText({
      comicCue: null,
    }),
    true,
  );
  assert.equal(
    shouldDisplayDialogText({}),
    true,
  );
});
