import assert from "node:assert/strict";
import test from "node:test";
import {
  allVillagersAtSixStars,
  normalizeOysterRackSlots,
  pearlChance,
  rollPearl,
  VILLAGER_IDS,
} from "./pearl-system";

test("牡蠣架格數限制在一到三格", () => {
  assert.equal(normalizeOysterRackSlots(0), 1);
  assert.equal(normalizeOysterRackSlots(2), 2);
  assert.equal(normalizeOysterRackSlots(8), 3);
});

test("每增加一座牡蠣架，各珍珠機率增加五個百分點", () => {
  assert.equal(pearlChance("white", 1), 20);
  assert.equal(pearlChance("white", 3), 30);
  assert.equal(pearlChance("purple", 3), 15);
  assert.equal(pearlChance("black", 3), 12);
  assert.equal(pearlChance("gold", 3), 11);
});

test("黑金珍珠未解鎖時不會掉落", () => {
  assert.equal(rollPearl(1, { black: false, gold: false }, () => 0), "purple");
  assert.notEqual(rollPearl(3, { black: false, gold: false }, () => 0.99), "black");
});

test("全村民都達六星才解鎖黑珍珠", () => {
  const points = Object.fromEntries(VILLAGER_IDS.map((id) => [id, 600]));
  assert.equal(allVillagersAtSixStars(points), true);
  points.mayor = 599;
  assert.equal(allVillagersAtSixStars(points), false);
});
