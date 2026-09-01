import test from "node:test";
import assert from "node:assert/strict";
import { carpenterQuest } from "./layout-maps";
import {
  canStartDayTwoArrivalSequence,
  getHouseInspectionText,
} from "./carpenter-quest";

test("day-two forced arrival begins at 08:00 and stays within the window", () => {
  const previousStage = carpenterQuest.stage;
  carpenterQuest.stage = "not_started";

  try {
    assert.equal(
      canStartDayTwoArrivalSequence({ currentDay: 1, currentPhase: 8 / 24 }),
      true,
    );
    assert.equal(
      canStartDayTwoArrivalSequence({ currentDay: 1, currentPhase: 7.99 / 24 }),
      false,
    );
    assert.equal(
      canStartDayTwoArrivalSequence({ currentDay: 2, currentPhase: 8 / 24 }),
      false,
    );
  } finally {
    carpenterQuest.stage = previousStage;
  }
});

test("house investigation text differs by role so players can tell each house apart", () => {
  const schoolText = getHouseInspectionText("school");
  const carpenterText = getHouseInspectionText("carpenter");
  assert.ok(schoolText.length > 0);
  assert.ok(carpenterText.length > 0);
  assert.notEqual(schoolText, carpenterText);
});
