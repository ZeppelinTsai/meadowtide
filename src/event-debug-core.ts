import type { StoryEvent } from "./story/story-types";
export const DEBUG_CATEGORIES = { all: "全部", main: "主線", intro: "角色初登場", heart2: "2 心", heart4: "4 心", heart6: "6 心", confession: "告白", married: "婚後", festival: "節慶", special: "特殊事件" };
const counts: Record<string, number[]> = { help: [0], "event.list": [0], "location.list": [0], "snapshot.restore": [0], "event.play": [1,2], "time.set": [1], "date.set": [1], warp: [1], "affection.set": [2], "flag.set": [2], "weather.set": [1] };
export function parseDebugCommand(command: string) {
  const [name, ...args] = command.trim().split(/\s+/);
  if (!Object.prototype.hasOwnProperty.call(counts, name) || !counts[name].includes(args.length)) throw new Error("未知指令或參數數量錯誤；輸入 help 查看用法。");
  if (name === "time.set" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(args[0])) throw new Error("時間格式為 00:00–23:59。");
  if (name === "date.set" && (!/^\d+$/.test(args[0]) || +args[0] < 1 || +args[0] > 100000)) throw new Error("日期必須為 1–100000 的整數。");
  if (name === "affection.set" && (!/^\d+$/.test(args[1]) || +args[1] > 800)) throw new Error("好感度必須為 0–800 的整數。");
  if (name === "flag.set" && (!["true", "false"].includes(args[1]) || ["__proto__", "constructor", "prototype"].includes(args[0]))) throw new Error("旗標值必須為 true 或 false，且 ID 必須合法。");
  if (name === "event.play" && args[1] && !["auto", "ignore"].includes(args[1])) throw new Error("播放模式為 auto 或 ignore。");
  return { name, args };
}
/** Apply only to a disposable save-shaped copy, never the snapshot stored for restoration. */
export function prepareDebugSnapshot(data: any, event: StoryEvent | undefined, auto: boolean, daysPerSeason: number) {
  data.prologue = null;
  data.story.activeEventId = null;
  data.dayTwoMorningEvent = { ...data.dayTwoMorningEvent, triggered: true, due: false, phase: "complete", holding: false, holdPositions: null };
  data.carpenterQuest.stage = "moved_in";
  data.artistQuest.stage = "complete";
  data.botanistQuest.stage = "complete";
  data.oceanographerQuest.stage = "complete";
  // Prevent unrelated legacy story gates from capturing the test session.
  if (!data.story.completedEvents.includes("main.prologue.arrival")) data.story.completedEvents.push("main.prologue.arrival");
  if (event) {
    data.story.completedEvents = data.story.completedEvents.filter((id: string) => id !== event.id);
    const resetEventRewards = (steps: StoryEvent["steps"]) => {
      for (const step of steps) {
        if (step.type === "grantItem") data.story.claimedRewards = data.story.claimedRewards.filter((id: string) => id !== step.rewardId);
        if (step.type === "choice") {
          delete data.story.choices[step.choiceId];
          for (const option of step.options) resetEventRewards(option.steps || []);
        }
      }
    };
    resetEventRewards(event.steps);
  }
  if (!auto || !event) return;
  let day = data.currentDay;
  let phase = data.currentPhase;
  for (const condition of event.conditions) {
    switch (condition.type) {
      case "day": day = condition.min ?? condition.max ?? day; break;
      case "phase": phase = condition.min ?? condition.max ?? phase; break;
      case "map": data.currentMapName = condition.mapId; data.player = null; break;
      case "flag": data.story.flags[condition.key] = condition.equals; break;
      case "eventCompleted": if (!data.story.completedEvents.includes(condition.eventId)) data.story.completedEvents.push(condition.eventId); break;
      case "eventNotCompleted": data.story.completedEvents = data.story.completedEvents.filter((id: string) => id !== condition.eventId); break;
      case "relationship": data.relationships[condition.npcId] = { ...data.relationships[condition.npcId], points: Math.max(data.relationships[condition.npcId]?.points || 0, condition.minPoints), unlockedStages: [2, 4, 6], currentLock: null }; break;
      case "item": data.inventory[condition.itemId] = Math.max(data.inventory[condition.itemId] || 0, condition.minCount); break;
    }
  }
  const seasons = event.conditions.filter(c => c.type === "season");
  for (const condition of seasons) {
    if (!condition.anyOf.length) throw new Error("季節條件不可為空");
    if (!condition.anyOf.includes(Math.floor(day / daysPerSeason) % 4)) {
      day = Math.floor(day / (daysPerSeason * 4)) * daysPerSeason * 4 + condition.anyOf[0] * daysPerSeason + day % daysPerSeason;
    }
  }
  // elapsed is assigned by the caller using the project's dayLength, never a second clock formula.
  for (const condition of event.conditions) {
    if (condition.type === "day" && ((condition.min !== undefined && day < condition.min) || (condition.max !== undefined && day > condition.max))) throw new Error("日期與季節條件互相衝突，請使用 ignore 手動測試。");
  }
  data.currentDay = day; data.currentPhase = phase;
}
