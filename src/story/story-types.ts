import type { ComicCueKind } from "../comic-cue-logic";

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
  // labelKey(嚴格 i18n key，TS 手寫事件用)跟 label／label_en／label_ja
  // (直接寫死文字，JSON 手寫事件用，見 story-text.ts)兩者至少要有一個，
  // story-audit.ts 會檢查。
  labelKey?: string;
  label?: string;
  label_en?: string;
  label_ja?: string;
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
  | {
      type: "dialogue";
      textKey?: string;
      speakerId?: string;
      // 2026-09-01 補上：src/story/chapters/prologue-script.ts 的
      // DialogueLine（正式序章實際在用的對話形狀）已經有 name／comicCue／
      // hidePortrait／revealNameAfter／cg 這幾個欄位，原本這裡只有
      // textKey/speakerId，無法對應真正的內容需求。差別是這裡一律要求
      // i18n key（見 docs/decisions/story-system.md「玩家文字一律填写
      // i18n key」），不是 DialogueLine 目前直接塞中文字串那種寫法；
      // nameKey 沒填時，runtime adapter 應依 speakerId 查角色預設顯示名。
      nameKey?: string;
      // 2026-09-01 Phase A 補：text／text_en／text_ja 是 textKey 的另一
      // 條路——JSON 手寫事件直接填目標語言文字，不用先去 i18n.ts 登記
      // key。textKey 跟 text 至少要有一個，story-audit.ts 會檢查；兩個
      // 都給的話 textKey 優先（維持既有 TS 事件走嚴格 i18n key 管理的
      // 行為不變）。見 story-text.ts、docs/decisions/event-system.md。
      text?: string;
      text_en?: string;
      text_ja?: string;
      comicCue?: { actorId: string; kind: ComicCueKind };
      hidePortrait?: boolean;
      revealNameAfter?: { npcId: string; stage: 1 | 2 };
      cg?: string;
    }
  | {
      type: "choice";
      choiceId: string;
      // promptKey／prompt(_en/_ja) 跟上面 dialogue 的 textKey／text 同一
      // 套規則。
      promptKey?: string;
      prompt?: string;
      prompt_en?: string;
      prompt_ja?: string;
      options: StoryChoiceOption[];
    }
  | { type: "setFlag"; key: string; value: StoryFlagValue }
  | { type: "setNpcNameStage"; npcId: string; stage: 1 | 2 }
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
  | { type: "grantItem"; rewardId: string; itemId: string; amount: number }
  // 以下四個是 2026-09-01 新增：盤點 src/prologue.ts 與 src/carpenter-quest.ts
  // 兩份手刻腳本後，發現的真正共通、但舊 StoryStep 沒有涵蓋的動作。目前
  // 只加型別跟 runtime-adapter 的接線，還沒有任何正式事件使用（純新增，
  // 不影響既有行為）。見 docs/decisions/event-system.md。
  | { type: "setActorVisible"; actorId: string; visible: boolean }
  | { type: "positionActor"; actorId: string; target: StoryWorldTarget }
  | { type: "matchActorPosition"; actorId: string; toActorId: string }
  | { type: "fade"; action: "out" | "in"; holdMilliseconds?: number }
  | { type: "pauseTime"; active: boolean; source?: string };

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
