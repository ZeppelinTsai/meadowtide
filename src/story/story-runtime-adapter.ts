import type { StoryRuntimeAdapter } from "./story-runner";
import type { StoryStep, StoryWaitCondition } from "./story-types";

type StepOf<T extends StoryStep["type"]> = Extract<StoryStep, { type: T }>;

export interface StoryRuntimeBindings {
  dialogue(step: StepOf<"dialogue">): Promise<void>;
  choice(step: StepOf<"choice">): Promise<string>;
  camera(step: StepOf<"camera">): Promise<void>;
  move(step: StepOf<"move">): Promise<void>;
  follow(step: StepOf<"follow">): Promise<void>;
  teleport(step: StepOf<"teleport">): Promise<void>;
  grantItem(step: StepOf<"grantItem">): Promise<void>;
  check(condition: StoryWaitCondition): boolean | Promise<boolean>;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

async function waitForCondition(
  condition: StoryWaitCondition,
  pollMilliseconds: number,
  check: StoryRuntimeBindings["check"],
) {
  const interval = Math.max(16, pollMilliseconds);
  while (!(await check(condition))) await delay(interval);
}

// 表現層只要提供七個既有系統的 binding，即可得到 runner 使用的統一 adapter。
// wait/waitFor 在這裡共用同一套實作，避免每個事件各自手刻 setInterval。
export function createStoryRuntimeAdapter(bindings: StoryRuntimeBindings): StoryRuntimeAdapter {
  return {
    showDialogue: bindings.dialogue,
    showChoice: bindings.choice,
    async execute(step) {
      switch (step.type) {
        case "wait":
          await delay(step.milliseconds);
          return;
        case "waitFor":
          await waitForCondition(step.condition, step.pollMilliseconds ?? 100, bindings.check);
          return;
        case "camera":
          await bindings.camera(step);
          return;
        case "move":
          await bindings.move(step);
          return;
        case "follow":
          await bindings.follow(step);
          return;
        case "teleport":
          await bindings.teleport(step);
          return;
        case "grantItem":
          await bindings.grantItem(step);
          return;
      }
    },
  };
}
