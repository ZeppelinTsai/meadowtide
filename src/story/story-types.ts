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
  | { type: "camera"; targetId: string; zoom: 2 | 5 | 10 | 20 }
  | { type: "move"; actorId: string; targetId: string }
  | { type: "teleport"; mapId: string; targetId: string }
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
