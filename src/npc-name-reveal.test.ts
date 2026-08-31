import assert from "node:assert/strict";
import test from "node:test";
import { PROLOGUE_SCRIPT } from "./story/chapters/prologue-script";
import {
  exportNpcNameRevealState,
  getNpcDisplayName,
  getNpcNameStage,
  resetNpcNameRevealState,
  restoreNpcNameRevealState,
  setNpcNameStage,
} from "./npc-name-reveal";

test("一般居民從未知到正式姓名，且序章介紹句本身仍是未知", () => {
  resetNpcNameRevealState();
  const intro = PROLOGUE_SCRIPT.tour[1];
  assert.equal(typeof intro, "object");
  assert.equal(getNpcDisplayName("mayor", "zh"), "???");
  if (typeof intro !== "string" && intro.revealNameAfter) {
    setNpcNameStage(intro.revealNameAfter.npcId, intro.revealNameAfter.stage);
  }
  assert.equal(getNpcDisplayName("mayor", "zh"), "梅貝爾");
  assert.equal(getNpcDisplayName("mayor", "en"), "Mabel");
});

test("船長在自我介紹前顯示職稱，介紹後才揭露赫克托", () => {
  resetNpcNameRevealState();
  assert.equal(getNpcDisplayName("captain", "zh"), "船長");
  const introduction = PROLOGUE_SCRIPT.fishing.find(
    (line) => typeof line !== "string" && line.revealNameAfter?.npcId === "captain",
  );
  assert.ok(introduction && typeof introduction !== "string");
  if (typeof introduction !== "string" && introduction.revealNameAfter) {
    setNpcNameStage(
      introduction.revealNameAfter.npcId,
      introduction.revealNameAfter.stage,
    );
  }
  assert.equal(getNpcDisplayName("captain", "zh"), "赫克托");
});

test("神明身分與真名是獨立的三階段，不受其他進度自動影響", () => {
  resetNpcNameRevealState();
  assert.equal(getNpcDisplayName("mountain_god", "zh"), "???");
  setNpcNameStage("mountain_god", 1);
  assert.equal(getNpcDisplayName("mountain_god", "zh"), "山神");
  assert.equal(getNpcNameStage("mountain_god"), 1);
  setNpcNameStage("mountain_god", 2);
  assert.equal(getNpcDisplayName("mountain_god", "zh"), "伊吹");
  assert.equal(getNpcDisplayName("mountain_god", "en"), "Ibuki");
});

test("名稱階段可存取、舊檔可安全遷移且不允許倒退", () => {
  resetNpcNameRevealState();
  setNpcNameStage("sea_god", 1);
  setNpcNameStage("mayor", 1);
  const saved = exportNpcNameRevealState();
  resetNpcNameRevealState();
  restoreNpcNameRevealState(saved);
  assert.equal(getNpcNameStage("sea_god"), 1);
  assert.equal(getNpcDisplayName("mayor", "zh"), "梅貝爾");
  assert.equal(setNpcNameStage("mayor", 0), false);
  assert.equal(getNpcNameStage("mayor"), 1);

  restoreNpcNameRevealState(undefined, ["captain"]);
  assert.equal(getNpcDisplayName("captain", "zh"), "赫克托");
  assert.equal(getNpcDisplayName("mayor", "zh"), "???");
});

test("未知 NPC id 永遠有安全顯示，不會出現空白", () => {
  resetNpcNameRevealState();
  assert.equal(getNpcDisplayName("not_registered"), "???");
});