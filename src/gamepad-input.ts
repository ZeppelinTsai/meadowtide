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
const prevHeld = { w: false, a: false, s: false, d: false, e: false, q: false, r: false };
const prevShoulder = { left: false, right: false };

function syncKey(key: keyof typeof prevHeld, held: boolean) {
  if (held === prevHeld[key]) return;
  dispatchKey(held ? "keydown" : "keyup", key);
  prevHeld[key] = held;
}

/** game-loop.ts 的 animate() 每幀呼叫——讀搖桿左搖桿/d-pad/A 鍵目前
 * 狀態，轉成合成鍵盤事件丟出去，跟玩家實際按鍵盤是同一條路徑，下游
 * (移動、E 鍵互動、拉扯期方向判定)完全不用區分輸入來源。找不到搖桿
 * 直接跳過，不影響鍵盤操作。 */
export function pollGamepad() {
  const pad = firstConnectedGamepad();
  if (!pad) return;

  rightStickX = Math.abs(pad.axes[2] ?? 0) >= STICK_DEADZONE ? (pad.axes[2] ?? 0) : 0;
  rightStickY = Math.abs(pad.axes[3] ?? 0) >= STICK_DEADZONE ? (pad.axes[3] ?? 0) : 0;
  const rightStickButton = !!pad.buttons[11]?.pressed;
  if (rightStickButton && !prevRightStickButton) dispatchKey("keydown", "Tab");
  if (!rightStickButton && prevRightStickButton) dispatchKey("keyup", "Tab");
  prevRightStickButton = rightStickButton;

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
  if (dx === 0 && dz === 0) {
    // d-pad 備援(標準映射：buttons[12]=上 13=下 14=左 15=右)，Xbox 360
    // 手把在 Chrome 底下的「standard」映射也遵循這個 index。
    if (pad.buttons[14]?.pressed) dx = -1;
    else if (pad.buttons[15]?.pressed) dx = 1;
    if (pad.buttons[12]?.pressed) dz = -1;
    else if (pad.buttons[13]?.pressed) dz = 1;
  }

  leftStickX = dx;
  leftStickZ = dz;
  syncKey("a", dx < 0);
  syncKey("d", dx > 0);
  syncKey("w", dz < 0);
  syncKey("s", dz > 0);
  syncKey("e", !!pad.buttons[0]?.pressed);
  syncKey("r", !!pad.buttons[1]?.pressed); // B 鍵（standard mapping）＝收割牧草
  syncKey("q", !!pad.buttons[3]?.pressed); // Y 鍵（standard mapping）＝背包

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
