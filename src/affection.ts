export const POINTS_PER_STAR = 100;
export const MAX_FRIENDSHIP_STARS = 8;
export const LOCK_BUFFER = 50;
export const AFFECTION_LOCK_STARS = [2, 4, 6] as const;
export type AffectionLockStar = (typeof AFFECTION_LOCK_STARS)[number];

export const AFFECTION_REWARDS = Object.freeze({
  dailyConversation: 5,
  giftNormal: 5,
  giftLiked: 15,
  giftLoved: 25,
  giftDisliked: -10,
  giftHated: -20,
  personalEvent: 30,
  festivalInteraction: 15,
  festivalSpecialInteraction: 30,
});

export type AffectionSource = keyof typeof AFFECTION_REWARDS | "other";
export type AffectionRewardSource = keyof typeof AFFECTION_REWARDS;

export interface RelationshipState {
  points: number;
  lastDailyConversationDay: number;
  lastGiftDay: number;
  completedEvents: string[];
  unlockedStages: AffectionLockStar[];
  currentLock: AffectionLockStar | null;
  announcedLocks: AffectionLockStar[];
}

export interface AffectionChangeResult {
  previousPoints: number;
  points: number;
  applied: number;
  currentLock: AffectionLockStar | null;
  lockCap: number | null;
  newlyLocked: AffectionLockStar | null;
  atLockCap: boolean;
}

export interface PersonalEventResult {
  completed: boolean;
  duplicate: boolean;
  unlockedStage: AffectionLockStar | null;
  affection: AffectionChangeResult | null;
}

export const relationships: Record<string, RelationshipState> = {};

function makeRelationshipState(): RelationshipState {
  return {
    points: 0,
    lastDailyConversationDay: -1,
    lastGiftDay: -1,
    completedEvents: [],
    unlockedStages: [],
    currentLock: null,
    announcedLocks: [],
  };
}

export function getRelationship(npcId: string): RelationshipState {
  return (relationships[npcId] ||= makeRelationshipState());
}

function nextLockFor(state: RelationshipState, points: number) {
  return (
    AFFECTION_LOCK_STARS.find(
      (star) =>
        !state.unlockedStages.includes(star) &&
        points >= star * POINTS_PER_STAR,
    ) || null
  );
}

export function addAffection(
  npcId: string,
  amount: number,
  _source: AffectionSource = "other",
): AffectionChangeResult {
  const state = getRelationship(npcId);
  const previousPoints = state.points;
  if (!Number.isFinite(amount) || amount === 0) {
    return {
      previousPoints,
      points: state.points,
      applied: 0,
      currentLock: state.currentLock,
      lockCap: state.currentLock
        ? state.currentLock * POINTS_PER_STAR + LOCK_BUFFER
        : null,
      newlyLocked: null,
      atLockCap: Boolean(
        state.currentLock &&
          state.points >= state.currentLock * POINTS_PER_STAR + LOCK_BUFFER,
      ),
    };
  }

  let target = Math.min(
    MAX_FRIENDSHIP_STARS * POINTS_PER_STAR,
    Math.max(0, state.points + amount),
  );
  let newlyLocked: AffectionLockStar | null = null;
  if (amount > 0 && !state.currentLock) {
    const reachedLock = nextLockFor(state, target);
    if (reachedLock) {
      state.currentLock = reachedLock;
      newlyLocked = reachedLock;
      if (!state.announcedLocks.includes(reachedLock)) {
        state.announcedLocks.push(reachedLock);
      }
    }
  }

  const lockCap = state.currentLock
    ? state.currentLock * POINTS_PER_STAR + LOCK_BUFFER
    : null;
  if (amount > 0 && lockCap !== null) target = Math.min(target, lockCap);
  state.points = target;
  return {
    previousPoints,
    points: state.points,
    applied: state.points - previousPoints,
    currentLock: state.currentLock,
    lockCap,
    newlyLocked,
    atLockCap: lockCap !== null && state.points >= lockCap,
  };
}

export function addAffectionReward(
  npcId: string,
  source: AffectionRewardSource,
) {
  return addAffection(npcId, AFFECTION_REWARDS[source], source);
}

export function awardDailyConversation(npcId: string, day: number) {
  const state = getRelationship(npcId);
  if (state.lastDailyConversationDay === day) return null;
  state.lastDailyConversationDay = day;
  return addAffection(
    npcId,
    AFFECTION_REWARDS.dailyConversation,
    "dailyConversation",
  );
}

export function completePersonalEvent(
  npcId: string,
  stage: AffectionLockStar,
  eventId: string,
): PersonalEventResult {
  const state = getRelationship(npcId);
  if (state.completedEvents.includes(eventId)) {
    return {
      completed: false,
      duplicate: true,
      unlockedStage: null,
      affection: null,
    };
  }
  if (state.currentLock !== stage) {
    return {
      completed: false,
      duplicate: false,
      unlockedStage: null,
      affection: null,
    };
  }

  state.completedEvents.push(eventId);
  if (!state.unlockedStages.includes(stage)) state.unlockedStages.push(stage);
  state.currentLock = null;
  const affection = addAffection(
    npcId,
    AFFECTION_REWARDS.personalEvent,
    "personalEvent",
  );
  return {
    completed: true,
    duplicate: false,
    unlockedStage: stage,
    affection,
  };
}

export function getDisplayedStars(npcId: string) {
  const state = getRelationship(npcId);
  const actualStars = Math.min(
    MAX_FRIENDSHIP_STARS,
    Math.floor(state.points / POINTS_PER_STAR),
  );
  return state.currentLock
    ? Math.min(actualStars, state.currentLock)
    : actualStars;
}

export function exportRelationships() {
  return JSON.parse(JSON.stringify(relationships));
}

export function restoreRelationships(saved: unknown) {
  Object.keys(relationships).forEach((id) => delete relationships[id]);
  if (!saved || typeof saved !== "object") return;
  Object.entries(saved as Record<string, Partial<RelationshipState>>).forEach(
    ([npcId, value]) => {
      const state = makeRelationshipState();
      state.points = Math.max(0, Number(value.points) || 0);
      state.lastDailyConversationDay = Number.isFinite(
        value.lastDailyConversationDay,
      )
        ? Number(value.lastDailyConversationDay)
        : -1;
      state.lastGiftDay = Number.isFinite(value.lastGiftDay)
        ? Number(value.lastGiftDay)
        : -1;
      state.completedEvents = Array.isArray(value.completedEvents)
        ? [...new Set(value.completedEvents.filter((id) => typeof id === "string"))]
        : [];
      state.unlockedStages = AFFECTION_LOCK_STARS.filter((star) =>
        value.unlockedStages?.includes(star),
      );
      state.announcedLocks = AFFECTION_LOCK_STARS.filter((star) =>
        value.announcedLocks?.includes(star),
      );
      state.currentLock = AFFECTION_LOCK_STARS.includes(
        value.currentLock as AffectionLockStar,
      )
        ? (value.currentLock as AffectionLockStar)
        : nextLockFor(state, state.points);
      if (state.currentLock) {
        state.points = Math.min(
          state.points,
          state.currentLock * POINTS_PER_STAR + LOCK_BUFFER,
        );
      }
      relationships[npcId] = state;
    },
  );
}

export function resetRelationships() {
  Object.keys(relationships).forEach((id) => delete relationships[id]);
}

export function resetRelationshipsForTests() {
  resetRelationships();
}
