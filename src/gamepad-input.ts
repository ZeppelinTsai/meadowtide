import {
  focusFirstUiElement,
  getActiveUiRoot,
  isUiNavigationActive,
} from "./ui-focus-navigation";
import { markGamepadInput } from "./input-device";
import { dialogQueue, activeChoice, toggleDialogAutoPlay } from "./dialogue";

// ==============================================================
// 搖桿輸入(移動 + 互動鍵)——2026-08-26。
//
// 做法：把搖桿目前狀態轉成「合成的鍵盤事件」
// (window.dispatchEvent(new KeyboardEvent(...)))，直接餵給
// input-save.ts 既有的全域 keydown/keyup 監聽(`keys[e.key]=true/false`
// 那兩行，還有 E 鍵的大型 keydown handler、拉扯期方向判定的 keydown
// 監聽)。搖桿在整個系統眼裡「看起來就是一個在按鍵盤的玩家」——WASD
// 八方向移動、E 鍵所有分支(對話/座位/採集/釣魚拋竿收竿…)、釣魚 QTE
// 拉扯期的方向判定，全部原封不動繼承，完全不用碰 game-loop.ts 的移動
// 計算或 input-save.ts 的互動邏輯，也不會維護兩套平行的輸入邏輯。
//
// 取捨：只支援單一搖桿(讀 navigator.getGamepads() 第一個 connected
// 的)；不支援類比半速移動——因為 `keys` 本身只有「按下/沒按下」兩態，
// 跟鍵盤語意一致，這是刻意簡化，不是偵測不到類比值。
//
// 環境限制同 gamepad-haptics.ts：搖桿要先被使用者按過一次鍵，才會出現
// 在 navigator.getGamepads() 清單裡；純插著線、完全沒按過鍵的搖桿，
// 這個模組會偵測不到，這不是 bug，是瀏覽器的安全限制。
//
// 呼叫方式：game-loop.ts 的 animate() 每幀呼叫一次 pollGamepad()，不用
// 另外開輪詢或監聽 gamepadconnected 事件——反正每幀都在讀，搖桿隨時
// 插上/斷開都會在下一幀自然生效或停止。
// ==============================================================

const STICK_DEADZONE = 0.35;
let leftStickX = 0;
let leftStickZ = 0;
let rightStickX = 0;
let rightStickY = 0;
let prevRightStickButton = false;
let prevStartButton = false;

export function getGamepadLookInput() {
  return { x: rightStickX, y: rightStickY };
}

export function getGamepadMoveInput() {
  return { x: leftStickX, z: leftStickZ };
}

function firstConnectedGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

function dispatchKey(type: "keydown" | "keyup", key: string) {
  window.dispatchEvent(new KeyboardEvent(type, { key }));
}

// 四個方向鍵 + 互動鍵各自獨立追蹤「上一幀是否按著」，只在跨越邊界時才
// 丟合成事件(邊緣觸發)——每幀都丟事件不只沒必要，E 鍵那組合成 keydown
// 如果每幀重複丟，會被 gameState.ePressed 擋掉變成永遠只有第一幀有效，
// 且語意上也該跟真的鍵盤按著不放一樣只在「按下/放開那一刻」各觸發一次。
const prevHeld = { w: false, a: false, s: false, d: false, e: false, r: false, f: false, q: false, m: false };
const prevShoulder = { left: false, right: false };
const prevUiDirection = { up: false, down: false, left: false, right: false };
const prevQuickDpad = { up: false, down: false, left: false, right: false };
let prevUiConfirm = false;
let prevUiTransfer = false;
let prevCancelButton = false;
let prevAutoPlayToggleButton = false;
let prevZoomIn = false;
let prevZoomOut = false;

function syncKey(key: keyof typeof prevHeld, held: boolean) {
  if (held === prevHeld[key]) return;
  dispatchKey(held ? "keydown" : "keyup", key);
  prevHeld[key] = held;
}

function releaseAllGamepadInputs() {
  prevUiTransfer = false;
  (Object.keys(prevQuickDpad) as Array<keyof typeof prevQuickDpad>).forEach((key) => {
    prevQuickDpad[key] = false;
  });
  (Object.keys(prevHeld) as Array<keyof typeof prevHeld>).forEach((key) => {
    if (prevHeld[key]) dispatchKey("keyup", key);
    prevHeld[key] = false;
  });
  (Object.keys(prevUiDirection) as Array<keyof typeof prevUiDirection>).forEach(
    (key) => {
      if (prevUiDirection[key]) {
        dispatchKey("keyup", "Arrow" + key[0].toUpperCase() + key.slice(1));
      }
      prevUiDirection[key] = false;
    },
  );
  leftStickX = 0;
  leftStickZ = 0;
  rightStickX = 0;
  rightStickY = 0;
  prevUiConfirm = false;
  prevCancelButton = false;
  prevAutoPlayToggleButton = false;
  prevZoomIn = false;
  prevZoomOut = false;
  prevRightStickButton = false;
  prevStartButton = false;
  prevShoulder.left = false;
  prevShoulder.right = false;
}
addEventListener("blur", releaseAllGamepadInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAllGamepadInputs();
});

/** game-loop.ts 的 animate() 每幀呼叫——讀搖桿左搖桿/d-pad/A 鍵目前
 * 狀態，轉成合成鍵盤事件丟出去，跟玩家實際按鍵盤是同一條路徑，下游
 * (移動、E 鍵互動、拉扯期方向判定)完全不用區分輸入來源。找不到搖桿
 * 直接跳過，不影響鍵盤操作。 */
export function pollGamepad() {
  // 背景分頁的 rAF 雖會降頻但不保證完全停止；不可在 blur 清掉後又立刻
  // 從仍偏著的搖桿重新合成 keydown，否則回到前景仍會自動行走。
  if (document.hidden || !document.hasFocus()) {
    releaseAllGamepadInputs();
    return;
  }
  const pad = firstConnectedGamepad();
  if (!pad) return;
  if (pad.buttons.some((button) => button.pressed) || pad.axes.some((axis) => Math.abs(axis) >= STICK_DEADZONE)) markGamepadInput(pad);

  rightStickX = Math.abs(pad.axes[2] ?? 0) >= STICK_DEADZONE ? (pad.axes[2] ?? 0) : 0;
  rightStickY = Math.abs(pad.axes[3] ?? 0) >= STICK_DEADZONE ? (pad.axes[3] ?? 0) : 0;
  const rightStickButton = !!pad.buttons[11]?.pressed;
  if (rightStickButton && !prevRightStickButton) dispatchKey("keydown", "Tab");
  if (!rightStickButton && prevRightStickButton) dispatchKey("keyup", "Tab");
  prevRightStickButton = rightStickButton;
  const uiNavigation = isUiNavigationActive();
  const zoomOutValue = pad.buttons[6]?.value ?? 0;
  const zoomInValue = pad.buttons[7]?.value ?? 0;
  const zoomOut = zoomOutValue > 0.55;
  const zoomIn = zoomInValue > 0.55;
  if (zoomOut && !prevZoomOut && uiNavigation) dispatchKey("keydown", "PageUp");
  if (zoomIn && !prevZoomIn && uiNavigation) dispatchKey("keydown", "PageDown");
  prevZoomOut = zoomOut;
  prevZoomIn = zoomIn;
  if (!uiNavigation) {
    const triggerZoom = zoomOutValue - zoomInValue;
    if (Math.abs(triggerZoom) > 0.08)
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: triggerZoom * 6 }));
  }

  // Start/Menu 鍵(標準映射 buttons[9])＝暫停選單(pause-menu.ts)，直接合成
  // Escape 鍵盤事件——跟上面 Tab 是同一招，暫停選單本來就是掛在鍵盤 Esc
  // 監聽上，不用另外幫手把寫一套開關邏輯。
  const startButton = !!pad.buttons[9]?.pressed;
  if (startButton && !prevStartButton) dispatchKey("keydown", "Escape");
  if (!startButton && prevStartButton) dispatchKey("keyup", "Escape");
  prevStartButton = startButton;

  let dx = pad.axes[0] ?? 0;
  let dz = pad.axes[1] ?? 0;
  if (Math.abs(dx) < STICK_DEADZONE) dx = 0;
  if (Math.abs(dz) < STICK_DEADZONE) dz = 0;
  const dpad = {
    up: !!pad.buttons[12]?.pressed,
    down: !!pad.buttons[13]?.pressed,
    left: !!pad.buttons[14]?.pressed,
    right: !!pad.buttons[15]?.pressed,
  };
  if (!uiNavigation) {
    (Object.keys(dpad) as Array<keyof typeof dpad>).forEach((key) => {
      if (dpad[key] && !prevQuickDpad[key]) {
        window.dispatchEvent(new CustomEvent("quick-item-direction", { detail: key }));
      }
      prevQuickDpad[key] = dpad[key];
    });
  } else {
    (Object.keys(prevQuickDpad) as Array<keyof typeof prevQuickDpad>).forEach((key) => {
      prevQuickDpad[key] = false;
    });
  }

  const confirmButton = !!pad.buttons[0]?.pressed;
  const cancelButton = !!pad.buttons[1]?.pressed;
  // 2026-09-05：對話框「暫時隱藏」(dialogue.ts toggleDialogUiPeek)也要
  // 吃取消鍵(手把 B/Xbox、A/Nintendo)，但一般讀對話(dialogQueue 有內容)
  // 不會被 isUiNavigationActive() 判定成 UI 導覽模式——那個只認標題/
  // 暫停/物品欄/地圖/二選一選單這幾種，導致這顆鍵原本只有在真的跳出
  // 選單/選項時才送 Escape，單純讀對話按下去完全沒反應(Zeppelin 回報
  // 「隱藏按手把B沒用」)。這裡另外併一個條件，對話框開著也算數，不影響
  // 下面 uiNavigation 分支原本掌管的方向鍵/確認鍵那些邏輯。
  const wantsCancelEscape = uiNavigation || dialogQueue.length > 0;
  if (uiNavigation) {
    leftStickX = 0;
    leftStickZ = 0;
    syncKey("a", false);
    syncKey("d", false);
    syncKey("w", false);
    syncKey("s", false);
    syncKey("e", false);
    syncKey("r", false);
    syncKey("f", false);
    const directions = {
      up: dz < 0 || dpad.up,
      down: dz > 0 || dpad.down,
      left: dx < 0 || dpad.left,
      right: dx > 0 || dpad.right,
    };
    (Object.keys(directions) as Array<keyof typeof directions>).forEach((key) => {
      if (directions[key] && !prevUiDirection[key]) {
        const focused = document.activeElement;
        if (
          (key === "left" || key === "right") &&
          focused instanceof HTMLInputElement &&
          focused.type === "range"
        ) {
          const step = Number(focused.step) || 1;
          const next = Number(focused.value) + (key === "right" ? step : -step);
          focused.value = String(Math.max(Number(focused.min), Math.min(Number(focused.max), next)));
          focused.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (
          (key === "left" || key === "right") &&
          focused instanceof HTMLElement &&
          focused.dataset.cycleControl === "true"
        ) {
          // 系統設定的語言／控制器配置／視窗解析度「‹ 目前值 ›」控制項
          // (system-settings-ui.ts)：跟上面的 range 滑桿同一招，直接對
          // 目前 focus 的元素丟自訂事件改值，不透過 window 合成鍵盤事件
          // ——因為原生 <select> 已經證實搖桿完全按不動，同樣道理，光丟
          // 合成 keydown 也叫不動這顆自訂元件，必須直接對它 dispatch。
          focused.dispatchEvent(
            new CustomEvent("cycle-step", { detail: key === "right" ? 1 : -1 }),
          );
        } else {
          dispatchKey("keydown", "Arrow" + key[0].toUpperCase() + key.slice(1));
        }
      }
      if (!directions[key] && prevUiDirection[key]) {
        dispatchKey("keyup", "Arrow" + key[0].toUpperCase() + key.slice(1));
      }
      prevUiDirection[key] = directions[key];
    });
    if (confirmButton && !prevUiConfirm) {
      const focused = document.activeElement;
      const root = getActiveUiRoot();
      if (root && focused instanceof HTMLElement && root.contains(focused)) {
        // 已經有東西被 focus 住(滑桿、cycle 控制項…)時，A 鍵只在焦點是
        // button/連結/分頁時才觸發 click——避免像之前那樣，隨便按 A
        // 都把焦點彈回第一個項目(下面 focusFirstUiElement 那個分支，
        // 本來是設計給「畫面上完全沒有東西被 focus」的情境用的)。
        if (focused.matches("button:not(:disabled), a[href], [role=tab]")) {
          focused.click();
        }
      } else if (!focusFirstUiElement()) {
        // 標題 splash 沒有可聚焦項目，仍需用按鍵事件進入主選單。
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      }
    }
    prevUiConfirm = confirmButton;
    const transferButton = !!pad.buttons[2]?.pressed;
    if (transferButton && !prevUiTransfer) dispatchKey("keydown", "x");
    if (!transferButton && prevUiTransfer) dispatchKey("keyup", "x");
    prevUiTransfer = transferButton;
  } else {
    (Object.keys(prevUiDirection) as Array<keyof typeof prevUiDirection>).forEach(
      (key) => {
        if (prevUiDirection[key]) {
          dispatchKey("keyup", "Arrow" + key[0].toUpperCase() + key.slice(1));
          prevUiDirection[key] = false;
        }
      },
    );
    prevUiConfirm = confirmButton;
    prevUiTransfer = false;
    leftStickX = dx;
    leftStickZ = dz;
    syncKey("a", dx < 0);
    syncKey("d", dx > 0);
    syncKey("w", dz < 0);
    syncKey("s", dz > 0);
    syncKey("e", !!pad.buttons[2]?.pressed);
    syncKey("r", !!pad.buttons[3]?.pressed);
    syncKey("f", !!pad.buttons[1]?.pressed); // physical east: Nintendo A / Xbox B
  }
  if (wantsCancelEscape) {
    if (cancelButton && !prevCancelButton) dispatchKey("keydown", "Escape");
    if (!cancelButton && prevCancelButton) dispatchKey("keyup", "Escape");
  }
  prevCancelButton = cancelButton;
  // 2026-09-05：對話「自動播放」開關(dialogue.ts toggleDialogAutoPlay)
  // 借用互動鍵旁邊那顆按鈕(button[3]，Xbox Y / Nintendo X，跟鍵盤 R 同一
  // 顆邏輯鍵)——這顆鍵在對話進行中原本就不做事：context-interaction-ui.ts
  // 的 blocked() 在 dialogQueue.length > 0 時會擋掉所有情境互動，包含 R
  // 觸發的 secondary 互動，所以借來用不會撞到既有功能。只在連續對話
  // (dialogQueue 有內容)且沒有二選一提示時才生效，跟上面 Escape 隱藏鍵
  // 同樣的邊緣觸發寫法(只在按下那一刻觸發一次，不是按著就一直切換)。
  const autoPlayToggleButton = !!pad.buttons[3]?.pressed;
  const wantsAutoPlayToggle = dialogQueue.length > 0 && !activeChoice;
  if (wantsAutoPlayToggle && autoPlayToggleButton && !prevAutoPlayToggleButton) {
    toggleDialogAutoPlay();
  }
  prevAutoPlayToggleButton = autoPlayToggleButton;
  syncKey("q", !!pad.buttons[8]?.pressed);
  syncKey("m", !!pad.buttons[10]?.pressed); // L3: map

  const leftShoulder = !!pad.buttons[4]?.pressed;
  const rightShoulder = !!pad.buttons[5]?.pressed;
  if (leftShoulder !== prevShoulder.left) {
    dispatchKey(leftShoulder ? "keydown" : "keyup", "[");
    prevShoulder.left = leftShoulder;
  }
  if (rightShoulder !== prevShoulder.right) {
    dispatchKey(rightShoulder ? "keydown" : "keyup", "]");
    prevShoulder.right = rightShoulder;
  } // A 鍵(Xbox 手把)＝互動鍵
}
