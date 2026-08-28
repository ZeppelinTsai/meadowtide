import type {
  StoryEventId,
  StoryFlagValue,
  StoryStateData,
} from "./story-types";

export function createDefaultStoryState(): StoryStateData {
  return {
    currentChapter: "main.prologue",
    completedEvents: [],
    activeEventId: null,
    flags: {},
    choices: {},
    claimedRewards: [],
  };
}

export const storyState = createDefaultStoryState();

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

export function normalizeStoryState(value: unknown): StoryStateData {
  const source = value && typeof value === "object"
    ? value as Partial<StoryStateData>
    : {};
  return {
    currentChapter: typeof source.currentChapter === "string"
      ? source.currentChapter
      : "main.prologue",
    completedEvents: uniqueStrings(source.completedEvents),
    // 中途存檔目前不允許；若舊資料意外留下 activeEventId，讀檔時安全重播。
    activeEventId: null,
    flags: source.flags && typeof source.flags === "object"
      ? { ...source.flags }
      : {},
    choices: source.choices && typeof source.choices === "object"
      ? Object.fromEntries(
          Object.entries(source.choices).filter((entry): entry is [string, string] =>
            typeof entry[1] === "string"),
        )
      : {},
    claimedRewards: uniqueStrings(source.claimedRewards),
  };
}

export function resetStoryState() {
  restoreStoryState(createDefaultStoryState());
}

export function restoreStoryState(value: unknown) {
  const restored = normalizeStoryState(value);
  storyState.currentChapter = restored.currentChapter;
  storyState.completedEvents = restored.completedEvents;
  storyState.activeEventId = restored.activeEventId;
  storyState.flags = restored.flags;
  storyState.choices = restored.choices;
  storyState.claimedRewards = restored.claimedRewards;
}

export function exportStoryState(): StoryStateData {
  return normalizeStoryState(storyState);
}

export function hasCompletedStoryEvent(eventId: StoryEventId): boolean {
  return storyState.completedEvents.includes(eventId);
}

export function beginStoryEvent(eventId: StoryEventId) {
  if (storyState.activeEventId && storyState.activeEventId !== eventId) {
    throw new Error(`已有劇情事件執行中：${storyState.activeEventId}`);
  }
  storyState.activeEventId = eventId;
}

export function completeStoryEvent(eventId: StoryEventId) {
  if (!storyState.completedEvents.includes(eventId)) {
    storyState.completedEvents.push(eventId);
  }
  storyState.activeEventId = null;
}

export function abortStoryEvent(eventId: StoryEventId) {
  if (storyState.activeEventId === eventId) storyState.activeEventId = null;
}

export function setStoryFlag(key: string, value: StoryFlagValue) {
  storyState.flags[key] = value;
}

export function recordStoryChoice(choiceId: string, value: string) {
  storyState.choices[choiceId] = value;
}

export function claimStoryReward(rewardId: string): boolean {
  if (storyState.claimedRewards.includes(rewardId)) return false;
  storyState.claimedRewards.push(rewardId);
  return true;
}
