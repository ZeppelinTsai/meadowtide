import * as THREE from "three";
import { gameState } from "../game-state";
import { npcs } from "../npc-runtime";
import {
  showDialogSequence,
  showChoice,
} from "../dialogue";
import { playCameraShots, stopCameraShots } from "../cutscene-camera";
import { showLoadingScreen, hideLoadingScreen } from "../loading-screen";
import { setTimePauseSource, type TimePauseSource } from "../time-pause";
import { t, getLocale } from "../i18n";
import { loadMap } from "../build-map";
import { storyState } from "./story-state";
import type { StoryRuntimeBindings } from "./story-runtime-adapter";
import type { StoryWaitCondition } from "./story-types";
import { pickLocalizedField } from "./story-text";

// ==============================================================
// 事件系統 Phase 1 概念驗證：第一份真正接上瀏覽器系統的
// StoryRuntimeBindings 實作。見 docs/decisions/event-system.md「Phase 1」。
//
// 範圍說明——這不是要一次把所有 13 個 binding 都做到production-ready：
// dialogue/camera/setActorVisible/positionActor/matchActorPosition/fade/
// pauseTime 這 7 個是這輪 dev.phase1Probe 測試事件實際會呼叫、也實際測過
// 的，其餘 6 個(choice/move/follow/teleport/grantItem/check)只寫最小可行
// 實作讓型別過關、不會噴例外，但沒有被這輪測試事件真正跑過一次——之後
// 真的要用某一個時才要重新驗證，不要假設它已經被驗證過。
// ==============================================================

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

// textKey 優先（既有 TS 事件、嚴格 i18n key 管理不變）；沒填 textKey
// 才退回 text／text_xx 這條 Phase A 補的路（JSON 手寫事件直接填文字）。
// 兩者都沒有理論上過不了 story-audit，這裡還是丟明確錯誤，不要讓
// undefined 字串偷偷跑進對話框。
function resolveStepText(
  step: object,
  keyField: "textKey" | "promptKey" | "labelKey",
  textField: "text" | "prompt" | "label",
  describeFor: string,
): string {
  const source = step as Record<string, unknown>;
  const key = source[keyField];
  if (typeof key === "string") return t(key);
  const literal = pickLocalizedField(source, textField, getLocale());
  if (literal !== undefined) return literal;
  throw new Error(
    `[story-runtime-browser] ${describeFor} 缺少 ${keyField} 或 ${textField}`,
  );
}

/** actorId "player" 對應主角本人，其餘查 npcs（id 對應 npc-defs.ts 的 id）。 */
function resolveActor(actorId: string): THREE.Object3D {
  if (actorId === "player") {
    if (!gameState.player) {
      throw new Error(
        `[story-runtime-browser] actorId "player" 查無 gameState.player（玩家還沒生成）`,
      );
    }
    return gameState.player;
  }
  const npc = npcs.find((n) => n.id === actorId);
  if (!npc) {
    throw new Error(
      `[story-runtime-browser] 找不到 actorId "${actorId}"——目前 npcs 清單只有：${npcs
        .map((n) => n.id)
        .join(", ")}`,
    );
  }
  return npc.mesh;
}

export function createBrowserStoryRuntimeBindings(): StoryRuntimeBindings {
  return {
    async dialogue(step) {
      const line: any = {
        text: resolveStepText(step, "textKey", "text", `dialogue(${step.textKey ?? step.text ?? "?"})`),
        speaker: step.speakerId,
        name: step.nameKey ? t(step.nameKey) : undefined,
        hidePortrait: step.hidePortrait,
        comicCue: step.comicCue,
        cg: step.cg,
      };
      await new Promise<void>((resolve) => {
        showDialogSequence([line], resolve);
      });
    },

    async choice(step) {
      const promptText = resolveStepText(step, "promptKey", "prompt", `choice(${step.choiceId})`);
      const options = step.options.map((option) => ({
        label: resolveStepText(option, "labelKey", "label", `choice(${step.choiceId})/option(${option.value})`),
        value: option.value,
      }));
      return new Promise<string>((resolve) => {
        showChoice(promptText, options, (value: string) => resolve(value));
      });
    },

    async camera(step) {
      if (!gameState.player) return;
      if (!step.waitForCompletion) {
        playCameraShots(
          step.shots,
          gameState.player.position.x,
          gameState.player.position.z,
          gameState.zoom,
        );
        return;
      }
      await new Promise<void>((resolve) => {
        playCameraShots(
          step.shots,
          gameState.player.position.x,
          gameState.player.position.z,
          gameState.zoom,
          () => {
            stopCameraShots();
            resolve();
          },
        );
      });
    },

    async move(step) {
      // 簡化版：直接把座標寫到目標，沒有真的沿 A* 路徑走位動畫。
      // 之後真的要在事件裡走位（例如跟 humanoid 排程整合）時要重新設計，
      // 這裡只保證型別介面能被滿足，Phase 1 測試事件沒有用到這個 binding。
      const actor = resolveActor(step.actorId);
      actor.position.x = step.target.x;
      actor.position.z = step.target.z;
      console.warn(
        `[story-runtime-browser] move() 是簡化版（瞬間到位，沒有走位動畫）：${step.actorId} → (${step.target.x}, ${step.target.z})`,
      );
    },

    async follow(step) {
      console.warn(
        `[story-runtime-browser] follow() 尚未實作，目前是 no-op：${step.leaderId} 帶 ${step.followerId}`,
      );
    },

    async teleport(step) {
      await new Promise<void>((resolve) => {
        loadMap(step.mapId, { x: step.target.x, z: step.target.z }, () => resolve());
      });
    },

    async grantItem(step) {
      console.warn(
        `[story-runtime-browser] grantItem() 尚未接到真正的背包系統，目前是 no-op：${step.itemId} x${step.amount}`,
      );
    },

    check(condition: StoryWaitCondition) {
      if (condition.type === "flag") {
        return storyState.flags[condition.key] === condition.equals;
      }
      console.warn(
        `[story-runtime-browser] check() 尚未支援 waitFor 條件類型 "${condition.type}"，目前一律回傳 false`,
      );
      return false;
    },

    async setActorVisible(step) {
      resolveActor(step.actorId).visible = step.visible;
    },

    async positionActor(step) {
      // 只寫 x/z；y 交給既有的逐幀地形高度同步（NPC 見 game-loop.ts 的
      // characterGroundY 呼叫，每幀都會跑，所以下一幀就會自動校正）。
      const actor = resolveActor(step.actorId);
      actor.position.x = step.target.x;
      actor.position.z = step.target.z;
    },

    async matchActorPosition(step) {
      const from = resolveActor(step.toActorId);
      const actor = resolveActor(step.actorId);
      actor.position.x = from.position.x;
      actor.position.z = from.position.z;
    },

    async fade(step) {
      if (step.action === "out") {
        await showLoadingScreen();
        if (step.holdMilliseconds) await delay(step.holdMilliseconds);
      } else {
        if (step.holdMilliseconds) await delay(step.holdMilliseconds);
        await hideLoadingScreen();
      }
    },

    async pauseTime(step) {
      const source = (step.source as TimePauseSource) || "storyEvent";
      setTimePauseSource(source, step.active);
    },
  };
}
