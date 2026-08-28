export type StoryEventId = string;
export type StoryFlagValue = string | number | boolean | null;

export type StoryCondition =
  | { type: "manual" }
  | { type: "eventCompleted"; eventId: StoryEventId }
  | { type: "eventNotCompleted"; eventId: StoryEventId }
  | { type: "flag"; key: string; equals: StoryFlagValue }
  | { type: "map"; mapId: string }
  | { type: "day"; min?: number; max?: number }
  | { type: "season"; anyOf: number[] }
  | { type: "phase"; min?: number; max?: number }
  | { type: "relationship"; npcId: string; minPoints: number }
  | { type: "item"; itemId: string; minCount: number };

export interface StoryChoiceOption {
  labelKey: string;
  value: string;
  steps?: StoryStep[];
}

export interface StoryCameraShot {
  focusX: number;
  focusZ: number;
  zoom: number;
  yaw?: number;
  pitch?: number;
  duration: number;
}

export interface StoryWorldTarget {
  mapId?: string;
  x: number;
  z: number;
}

export type StoryWaitCondition =
  | { type: "flag"; key: string; equals: StoryFlagValue }
  | { type: "cropCount"; areaId: string; count: number }
  | { type: "fishCaught"; count: number }
  | { type: "recipeCooked"; recipeId: string; count?: number }
  | { type: "actorReached"; actorId: string; target: StoryWorldTarget; tolerance?: number };

export type StoryStep =
  | { type: "dialogue"; textKey: string; speakerId?: string }
  | {
      type: "choice";
      choiceId: string;
      promptKey: string;
      options: StoryChoiceOption[];
    }
  | { type: "setFlag"; key: string; value: StoryFlagValue }
  | { type: "wait"; milliseconds: number }
  | { type: "waitFor"; condition: StoryWaitCondition; pollMilliseconds?: number }
  | { type: "camera"; shots: StoryCameraShot[]; waitForCompletion?: boolean }
  | {
      type: "move";
      actorId: string;
      target: StoryWorldTarget;
      speed?: number;
      facing?: "up" | "down" | "left" | "right";
      waitForArrival?: boolean;
    }
  | {
      type: "follow";
      leaderId: string;
      followerId: string;
      destination: StoryWorldTarget;
      speed?: number;
      maxDistance?: number;
      reminderTextKey?: string;
    }
  | { type: "teleport"; mapId: string; target: StoryWorldTarget }
  | { type: "grantItem"; rewardId: string; itemId: string; amount: number };

export interface StoryEvent {
  id: StoryEventId;
  title: string;
  summary: string;
  chapter: string;
  characters: string[];
  priority: number;
  once: boolean;
  execution?: "steps" | "external";
  conditions: StoryCondition[];
  steps: StoryStep[];
}

export interface StoryContext {
  mapId: string;
  day: number;
  season: number;
  phase: number;
  relationships: Record<string, number>;
  inventory: Record<string, number>;
}

export interface StoryStateData {
  currentChapter: string;
  completedEvents: StoryEventId[];
  activeEventId: StoryEventId | null;
  flags: Record<string, StoryFlagValue>;
  choices: Record<string, string>;
  claimedRewards: string[];
}
