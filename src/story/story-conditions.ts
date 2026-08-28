import type { StoryCondition, StoryContext, StoryEvent } from "./story-types";
import type { StoryStateData } from "./story-types";

export interface StoryEligibility {
  eligible: boolean;
  reasons: string[];
}

function conditionFailure(
  condition: StoryCondition,
  context: StoryContext,
  state: StoryStateData,
): string | null {
  switch (condition.type) {
    case "manual":
      return "此事件只能手動觸發";
    case "eventCompleted":
      return state.completedEvents.includes(condition.eventId)
        ? null
        : `前置事件未完成：${condition.eventId}`;
    case "eventNotCompleted":
      return state.completedEvents.includes(condition.eventId)
        ? `事件已完成：${condition.eventId}`
        : null;
    case "flag":
      return state.flags[condition.key] === condition.equals
        ? null
        : `旗標不符：${condition.key}`;
    case "map":
      return context.mapId === condition.mapId ? null : `地圖必須為 ${condition.mapId}`;
    case "day":
      return (condition.min === undefined || context.day >= condition.min) &&
        (condition.max === undefined || context.day <= condition.max)
        ? null
        : `日期不在 ${condition.min ?? "-∞"}～${condition.max ?? "∞"}`;
    case "season":
      return condition.anyOf.includes(context.season) ? null : "季節不符";
    case "phase":
      return (condition.min === undefined || context.phase >= condition.min) &&
        (condition.max === undefined || context.phase <= condition.max)
        ? null
        : `時段不在 ${condition.min ?? "-∞"}～${condition.max ?? "∞"}`;
    case "relationship":
      return (context.relationships[condition.npcId] || 0) >= condition.minPoints
        ? null
        : `${condition.npcId} 好感度未達 ${condition.minPoints}`;
    case "item":
      return (context.inventory[condition.itemId] || 0) >= condition.minCount
        ? null
        : `${condition.itemId} 未達 ${condition.minCount}`;
  }
}

export function evaluateStoryEvent(
  event: StoryEvent,
  context: StoryContext,
  state: StoryStateData,
  options: { allowManual?: boolean } = {},
): StoryEligibility {
  if (event.once && state.completedEvents.includes(event.id)) {
    return { eligible: false, reasons: [`事件已完成：${event.id}`] };
  }
  const reasons = event.conditions
    .filter((condition) => !(options.allowManual && condition.type === "manual"))
    .map((condition) => conditionFailure(condition, context, state))
    .filter((reason): reason is string => Boolean(reason));
  return { eligible: reasons.length === 0, reasons };
}
