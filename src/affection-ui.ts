import {
  addAffection,
  addAffectionReward,
  AffectionSource,
  AffectionRewardSource,
  AffectionLockStar,
  awardDailyConversation,
  completePersonalEvent,
} from "./affection";
import { showDialogSequence } from "./dialogue";
import { gameState } from "./game-state";
import { npcs } from "./npc-runtime";
import { playSfx, RELATIONSHIP_EVENT_SFX } from "./sfx";
import { showUiToast } from "./ui-toast";

function npcName(npcId: string) {
  return npcs.find((npc) => npc.id === npcId)?.name || npcId;
}

function showChangeFeedback(
  npcId: string,
  source: AffectionSource,
  result: ReturnType<typeof addAffection>,
) {
  const name = npcName(npcId);
  if (result.newlyLocked) {
    playSfx(RELATIONSHIP_EVENT_SFX);
    showDialogSequence([
      `你和${name}的關係似乎有了新的變化……`,
      "觸發對方的個人事件後，關係才能繼續提升。",
    ]);
    return;
  }
  if (!result.currentLock) return;
  if (result.applied < 0) return;
  if (source === "dailyConversation") {
    showUiToast(
      `${name}似乎有話想對你說。`,
      "觸發個人事件後，關係才能繼續提升。",
    );
    return;
  }
  if (result.atLockCap && result.applied === 0) {
    showUiToast("關係等待契機", `你和${name}的關係需要新的契機。`);
    return;
  }
  showUiToast(
    "關係尚未突破",
    `好感度最多暫存至${result.lockCap}。`,
  );
}

export function awardNpcAffectionReward(
  npcId: string,
  source: AffectionRewardSource,
) {
  const result = addAffectionReward(npcId, source);
  showChangeFeedback(npcId, source, result);
  return result;
}

export function awardNpcAffection(
  npcId: string,
  amount: number,
  source: AffectionSource = "other",
) {
  const result = addAffection(npcId, amount, source);
  showChangeFeedback(npcId, source, result);
  return result;
}

export function completeNpcDailyConversation(npcId: string) {
  const result = awardDailyConversation(npcId, gameState.currentDay);
  if (result) showChangeFeedback(npcId, "dailyConversation", result);
  return result;
}

export function completeNpcPersonalEvent(
  npcId: string,
  stage: AffectionLockStar,
  eventId: string,
) {
  const result = completePersonalEvent(npcId, stage, eventId);
  if (result.completed) {
    showUiToast(
      "關係提升",
      `你和${npcName(npcId)}變得更親近了。`,
    );
  }
  return result;
}
