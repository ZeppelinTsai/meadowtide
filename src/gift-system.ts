import { AFFECTION_REWARDS, getRelationship } from "./affection";
import { awardNpcAffection } from "./affection-ui";
import { gameState, inventory } from "./game-state";
import { consumeInventoryItem, inventoryItem, itemAmount } from "./inventory-system";
import { getNpcDisplayName } from "./npc-name-reveal";
import { showUiToast } from "./ui-toast";

export type GiftPreference = "hated" | "disliked" | "normal" | "liked" | "loved";

export const GIFT_PREFERENCE_SYMBOLS: Record<GiftPreference, string> = {
  hated: "×",
  disliked: "▽",
  normal: "○",
  liked: "△",
  loved: "♥",
};

const GIFT_REWARD_BY_PREFERENCE = {
  hated: AFFECTION_REWARDS.giftHated,
  disliked: AFFECTION_REWARDS.giftDisliked,
  normal: AFFECTION_REWARDS.giftNormal,
  liked: AFFECTION_REWARDS.giftLiked,
  loved: AFFECTION_REWARDS.giftLoved,
} as const;

// NPC 專屬喜好表的正式入口；美術／劇情資料確定前，未列項目一律普通。
export const NPC_GIFT_PREFERENCES: Record<
  string,
  Partial<Record<string, GiftPreference>>
> = {};

let activeFestivalGiftMultiplier = 1;

export function setFestivalGiftMultiplier(multiplier = 1) {
  activeFestivalGiftMultiplier = Math.max(1, Number(multiplier) || 1);
}

export function isFestivalGiftActive() {
  return activeFestivalGiftMultiplier > 1;
}

export function giftPreferenceFor(npcId: string, itemId: string): GiftPreference {
  return NPC_GIFT_PREFERENCES[npcId]?.[itemId] ?? "normal";
}

export function canGiveDailyGift(npcId: string, day = gameState.currentDay) {
  return (
    isFestivalGiftActive() ||
    getRelationship(npcId).lastGiftDay !== day
  );
}

export function giveHeldItemToNpc(npcId: string) {
  const itemId = inventory.heldItemId;
  const item = itemId ? inventoryItem(itemId) : null;
  if (!itemId || !item || itemAmount(itemId) <= 0) return false;
  if (!canGiveDailyGift(npcId)) {
    showUiToast(getNpcDisplayName(npcId), "今天已經送過禮物了。");
    return false;
  }

  const preference = giftPreferenceFor(npcId, itemId);
  const basePoints = GIFT_REWARD_BY_PREFERENCE[preference];
  const points = Math.round(basePoints * activeFestivalGiftMultiplier);
  if (!consumeInventoryItem(itemId, 1)) return false;
  if (!isFestivalGiftActive()) {
    getRelationship(npcId).lastGiftDay = gameState.currentDay;
  }
  awardNpcAffection(npcId, points, "other");
  showUiToast(
    GIFT_PREFERENCE_SYMBOLS[preference] + " " + getNpcDisplayName(npcId),
    item.label + "／好感度 " + (points >= 0 ? "+" : "") + points,
  );
  return true;
}
