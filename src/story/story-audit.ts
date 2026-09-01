import type { StoryEvent, StoryStep } from "./story-types";

export interface StoryAuditResult {
  errors: string[];
  warnings: string[];
}

const ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/;

function walkSteps(
  event: StoryEvent,
  steps: StoryStep[],
  choiceIds: Set<string>,
  rewardIds: Set<string>,
  errors: string[],
) {
  for (const step of steps) {
    if (step.type === "dialogue") {
      if (step.textKey !== undefined) {
        if (!ID_PATTERN.test(step.textKey)) {
          errors.push(`${event.id}: 非法 textKey「${step.textKey}」`);
        }
      } else if (!step.text || !step.text.trim()) {
        errors.push(`${event.id}: dialogue 缺少 textKey 或 text`);
      }
    }
    if (step.type === "choice") {
      if (choiceIds.has(step.choiceId)) {
        errors.push(`${event.id}: 重複 choiceId「${step.choiceId}」`);
      }
      choiceIds.add(step.choiceId);
      if (step.promptKey !== undefined) {
        if (!ID_PATTERN.test(step.promptKey)) {
          errors.push(`${event.id}: 非法 promptKey「${step.promptKey}」`);
        }
      } else if (!step.prompt || !step.prompt.trim()) {
        errors.push(`${event.id}: choice 缺少 promptKey 或 prompt`);
      }
      const values = new Set<string>();
      for (const option of step.options) {
        if (values.has(option.value)) {
          errors.push(`${event.id}/${step.choiceId}: 重複選項值「${option.value}」`);
        }
        values.add(option.value);
        if (option.labelKey !== undefined) {
          if (!ID_PATTERN.test(option.labelKey)) {
            errors.push(`${event.id}: 非法 labelKey「${option.labelKey}」`);
          }
        } else if (!option.label || !option.label.trim()) {
          errors.push(`${event.id}/${step.choiceId}: 選項缺少 labelKey 或 label`);
        }
        if (option.steps) walkSteps(event, option.steps, choiceIds, rewardIds, errors);
      }
    }
    if (step.type === "grantItem") {
      if (rewardIds.has(step.rewardId)) {
        errors.push(`${event.id}: 重複 rewardId「${step.rewardId}」`);
      }
      rewardIds.add(step.rewardId);
      if (!Number.isFinite(step.amount) || step.amount <= 0) {
        errors.push(`${event.id}/${step.rewardId}: 獎勵數量必須大於 0`);
      }
    }
    if (step.type === "camera") {
      if (!step.shots.length) errors.push(event.id + ": camera 至少需要一顆鏡頭");
      step.shots.forEach((shot, index) => {
        const values = [shot.focusX, shot.focusZ, shot.zoom, shot.duration, shot.yaw ?? 0, shot.pitch ?? 0];
        if (values.some((value) => !Number.isFinite(value)) || shot.zoom <= 0 || shot.duration < 0) {
          errors.push(event.id + ": camera 第 " + (index + 1) + " 顆參數不合法");
        }
      });
    }
    if (step.type === "move" || step.type === "teleport") {
      if (!Number.isFinite(step.target.x) || !Number.isFinite(step.target.z)) {
        errors.push(event.id + ": " + step.type + " 目的地座標不合法");
      }
    }
    if (step.type === "follow") {
      if (!Number.isFinite(step.destination.x) || !Number.isFinite(step.destination.z)) {
        errors.push(event.id + ": follow 目的地座標不合法");
      }
      if (step.maxDistance !== undefined && step.maxDistance <= 0) {
        errors.push(event.id + ": follow maxDistance 必須大於 0");
      }
    }
    if (
      (step.type === "setActorVisible" ||
        step.type === "positionActor" ||
        step.type === "matchActorPosition") &&
      !step.actorId.trim()
    ) {
      errors.push(event.id + ": " + step.type + " 缺少 actorId");
    }
    if (step.type === "positionActor") {
      if (!Number.isFinite(step.target.x) || !Number.isFinite(step.target.z)) {
        errors.push(event.id + ": positionActor 目的地座標不合法");
      }
    }
    if (step.type === "matchActorPosition" && !step.toActorId.trim()) {
      errors.push(event.id + ": matchActorPosition 缺少 toActorId");
    }
    if (
      step.type === "fade" &&
      step.holdMilliseconds !== undefined &&
      (!Number.isFinite(step.holdMilliseconds) || step.holdMilliseconds < 0)
    ) {
      errors.push(event.id + ": fade holdMilliseconds 必須是不小於 0 的數字");
    }
  }
}

export function auditStoryRegistry(events: readonly StoryEvent[]): StoryAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const choiceIds = new Set<string>();
  const rewardIds = new Set<string>();

  for (const event of events) {
    if (!ID_PATTERN.test(event.id)) errors.push(`非法事件 ID「${event.id}」`);
    if (ids.has(event.id)) errors.push(`重複事件 ID「${event.id}」`);
    ids.add(event.id);
    if (!event.title.trim()) errors.push(`${event.id}: 缺少开发标题`);
    if (!event.summary.trim()) errors.push(`${event.id}: 缺少开发摘要`);
    if (event.execution !== "external" && event.steps.length === 0) {
      errors.push(`${event.id}: steps 不可为空`);
    }
    walkSteps(event, event.steps, choiceIds, rewardIds, errors);
  }

  const graph = new Map<string, string[]>();
  for (const event of events) {
    const prerequisites = event.conditions
      .filter((condition) => condition.type === "eventCompleted")
      .map((condition) => condition.eventId);
    // 重複 ID 已是錯誤；保留第一筆依賴關係，避免後面的重複資料覆蓋後，
    // 反而把原本存在的循環依賴藏起來。
    if (!graph.has(event.id)) graph.set(event.id, prerequisites);
    for (const dependency of prerequisites) {
      if (!ids.has(dependency)) errors.push(`${event.id}: 前置事件不存在「${dependency}」`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string, path: string[]) {
    if (visiting.has(id)) {
      errors.push(`事件前置形成循環：${[...path, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) || []) {
      if (graph.has(dependency)) visit(dependency, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id, []);

  if (events.length === 0) warnings.push("registry 目前没有事件");
  return { errors: [...new Set(errors)], warnings };
}
