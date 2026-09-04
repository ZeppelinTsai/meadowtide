import type { StoryEvent, StoryStep } from "./story-types";

export interface StoryAuditResult {
  errors: string[];
  warnings: string[];
}

export interface StoryTranslationRow {
  text: string;
  text_en: string;
  text_ja: string;
}

// 2026-09-04 補充：STORY_SCRIPT_TRANSLATIONS(src/story-script-translations.ts)
// 是用「原文中文」直接當 key 查表，兩筆原文字面一模一樣時，後面那筆會
// 悄悄蓋掉前面那筆的翻譯，不會有任何錯誤或警告——起因是 Zeppelin 問起
// 這個結構的風險，檢查當下這批 267 句劇情剛好沒撞到，但劇情台詞(尤其
// 短句反應、舞台指示)天生比固定的 UI 術語表更容易重複，機率不是 0，
// 而且壞掉的時候是靜默的，所以在這裡補一道自動檢查，之後加新的一天／
// 新角色台詞時，story-audit 會自動抓出來，不用再手動寫腳本比對。
export function auditStoryTranslations(
  rows: readonly StoryTranslationRow[],
): StoryAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const firstSeenAt = new Map<string, number>();

  rows.forEach((row, index) => {
    if (!row.text || !row.text.trim()) {
      errors.push(`翻譯第 ${index + 1} 筆缺少原文 text`);
      return;
    }
    const firstIndex = firstSeenAt.get(row.text);
    if (firstIndex !== undefined) {
      errors.push(
        `翻譯原文重複(第 ${firstIndex + 1} 筆與第 ${index + 1} 筆)：「${row.text}」——` +
          `STORY_SCRIPT_TRANSLATIONS 用原文當 key 查表，重複會讓其中一筆翻譯被悄悄蓋掉，` +
          `請改其中一筆原文讓它變成唯一(或確認兩筆真的該共用同一句翻譯後合併成一筆)`,
      );
    } else {
      firstSeenAt.set(row.text, index);
    }
    if (!row.text_en || !row.text_en.trim()) {
      warnings.push(`翻譯第 ${index + 1} 筆缺少英文翻譯：「${row.text}」`);
    }
    if (!row.text_ja || !row.text_ja.trim()) {
      warnings.push(`翻譯第 ${index + 1} 筆缺少日文翻譯：「${row.text}」`);
    }
  });

  return { errors: [...new Set(errors)], warnings };
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
