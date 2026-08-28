import { evaluateStoryEvent } from "./story-conditions";
import {
  abortStoryEvent,
  beginStoryEvent,
  claimStoryReward,
  completeStoryEvent,
  recordStoryChoice,
  setStoryFlag,
  storyState,
} from "./story-state";
import type {
  StoryContext,
  StoryEvent,
  StoryStep,
} from "./story-types";

export interface StoryRuntimeAdapter {
  showDialogue(step: Extract<StoryStep, { type: "dialogue" }>): Promise<void>;
  showChoice(step: Extract<StoryStep, { type: "choice" }>): Promise<string>;
  execute(step: Exclude<StoryStep, { type: "dialogue" | "choice" | "setFlag" }>): Promise<void>;
}

async function runSteps(steps: StoryStep[], adapter: StoryRuntimeAdapter) {
  for (const step of steps) {
    if (step.type === "dialogue") {
      await adapter.showDialogue(step);
    } else if (step.type === "choice") {
      const selected = await adapter.showChoice(step);
      const option = step.options.find((candidate) => candidate.value === selected);
      if (!option) throw new Error(`選項 ${step.choiceId} 回傳未知值：${selected}`);
      recordStoryChoice(step.choiceId, selected);
      if (option.steps) await runSteps(option.steps, adapter);
    } else if (step.type === "setFlag") {
      setStoryFlag(step.key, step.value);
    } else if (step.type === "grantItem") {
      if (!storyState.claimedRewards.includes(step.rewardId)) {
        // 外部獎勵動作成功後才登記領取；若 adapter 拋錯，事件重試時仍會補發。
        await adapter.execute(step);
        claimStoryReward(step.rewardId);
      }
    } else {
      await adapter.execute(step);
    }
  }
}

export async function runStoryEvent(
  event: StoryEvent,
  context: StoryContext,
  adapter: StoryRuntimeAdapter,
  options: { allowManual?: boolean } = {},
) {
  const eligibility = evaluateStoryEvent(event, context, storyState, options);
  if (!eligibility.eligible) {
    throw new Error(`事件 ${event.id} 無法觸發：${eligibility.reasons.join("；")}`);
  }
  beginStoryEvent(event.id);
  try {
    await runSteps(event.steps, adapter);
    completeStoryEvent(event.id);
  } catch (error) {
    abortStoryEvent(event.id);
    throw error;
  }
}
