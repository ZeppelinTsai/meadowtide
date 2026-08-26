// ==============================================================
// 搖桿震動(Gamepad Haptics)——薄薄一層包裝 Web Gamepad API 的
// GamepadHapticActuator，純瀏覽器 API 包裝，不碰 THREE/DOM，跟
// fishing.ts 同一個「零渲染依賴」原則：之後如果其他系統(不只釣魚)也想用
// 震動，直接 import 這裡的 vibrateGamepad()，不用重寫偵測邏輯。
//
// 環境限制(2026-08-26 起，目前沒有 device 可以實測，先照 spec 寫；
// 2026-08-26 稍後 Zeppelin 已用 Xbox 360 手把實測過基礎功能有效)：
// - 這是 Web Gamepad API 的擴充功能，不是每個瀏覽器都支援——Chrome/Edge
//   有 GamepadHapticActuator.vibrationActuator.playEffect("dual-rumble")，
//   Firefox 目前完全不支援震動這塊(搖桿方向鍵本身還是能用，就是不會震)。
// - 瀏覽器安全限制：搖桿要先被使用者按過一次鍵，才會出現在
//   navigator.getGamepads() 裡——連好線但完全沒按過鍵，這裡會偵測不到。
// - 找不到搖桿、瀏覽器不支援 vibrationActuator/hapticActuators 都直接
//   靜默跳過(不噴錯)，呼叫端完全不用檢查環境，想震就震。
// ==============================================================

import { FishTierKey, QteDirection } from "./fishing";

export interface VibratePattern {
  duration: number; // 毫秒
  weakMagnitude: number; // 0~1，低頻馬達(通常機身左側，悶震動)
  strongMagnitude: number; // 0~1，高頻馬達(通常機身右側，尖銳震動)
}

function firstConnectedGamepad(): Gamepad | null {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

/** 觸發一次震動。找不到搖桿/瀏覽器不支援都靜默跳過。優先用新版
 * vibrationActuator.playEffect("dual-rumble", ...)，沒有的話退而求其次
 * 用舊版 hapticActuators[0].pulse(...)(部分瀏覽器/搖桿只有這個)。 */
export function vibrateGamepad(pattern: VibratePattern) {
  const pad = firstConnectedGamepad();
  if (!pad) return;

  const actuator = (pad as any).vibrationActuator;
  if (actuator && typeof actuator.playEffect === "function") {
    actuator
      .playEffect("dual-rumble", {
        startDelay: 0,
        duration: pattern.duration,
        weakMagnitude: pattern.weakMagnitude,
        strongMagnitude: pattern.strongMagnitude,
      })
      .catch(() => {});
    return;
  }

  const legacyActuator = (pad as any).hapticActuators?.[0];
  if (legacyActuator && typeof legacyActuator.pulse === "function") {
    legacyActuator
      .pulse(
        Math.max(pattern.weakMagnitude, pattern.strongMagnitude),
        pattern.duration,
      )
      .catch(() => {});
  }
}

// 釣魚 QTE 判定結果 → 震動強度基準值(2026-08-26 追加「手感強烈一點」
// 要求後整體調高過一輪)，對應設計筆記第 4 節「震動/音效資訊通道」的
// 草案，集中放這裡方便之後照實測手感調數值，不用去 input-save.ts 裡
// 到處改。這些是「魚霸主」級距(下面 FISH_TIER_HAPTIC_SCALE.boss≈1)的
// 基準強度，實際套用時全部會經過 scaleForTier() 按魚階再放大/縮小一次
// ——只有 bite(咬鉤警示)例外，見下方說明。
export const FISHING_HAPTICS = {
  // 上鉤(casting→biting)那一刻——這是「快按 E」的警示鈴聲，不是「這條魚
  // 有多重」的手感，所以刻意**不**跟著魚階縮放(game-loop.ts 呼叫時直接
  // 用這組原始數值)，不管釣到什麼都要滿檔，確保 1.1 秒的咬鉤窗不會被
  // 錯過。
  bite: { duration: 360, weakMagnitude: 1, strongMagnitude: 1 },
  // 方向事件「開始」那一刻的一下拉扯提示(見下面 vibrateDirectionalPull)
  // 用的基準值——魚咬線的瞬間感，不是判定結果。
  pull: { duration: 140, weakMagnitude: 0.55, strongMagnitude: 0.85 },
  // 暴衝(轉圈猛拉)單次脈衝的基準值，見下面 vibrateRushSpin，會連續觸發
  // 好幾次做出「亂拉一通」的節奏，不是判定結果。
  rushPulse: { duration: 75, weakMagnitude: 0.6, strongMagnitude: 0.9 },
  perfect: { duration: 130, weakMagnitude: 0.45, strongMagnitude: 0.95 },
  success: { duration: 90, weakMagnitude: 0.35, strongMagnitude: 0.7 },
  wrong: { duration: 230, weakMagnitude: 0.8, strongMagnitude: 1 },
  miss: { duration: 150, weakMagnitude: 0.65, strongMagnitude: 0.5 },
  rushSafe: { duration: 70, weakMagnitude: 0.3, strongMagnitude: 0.2 },
  rushFail: { duration: 260, weakMagnitude: 0.9, strongMagnitude: 1 },
  catchSuccess: { duration: 320, weakMagnitude: 0.55, strongMagnitude: 0.8 },
  lineBreak: { duration: 480, weakMagnitude: 0.95, strongMagnitude: 1 },
} as const;

// 魚階 → 震動強度倍率(2026-08-26 追加，回應「小魚中魚大魚特大特殊剛好
// 對應強度」的要求)：小魚只是輕輕一點觸感，特殊(傳說魚)要感覺出「這條
// 完全不一樣」的重量。倍率可以超過 1(legendary)，套用時 magnitude 會
// 夾在 0~1，duration 則會跟著等比拉長，所以大魚除了「更用力」也會
// 「震更久」，兩個維度一起做出差異，不是只有力道變化。垃圾魚沒有 QTE
// 不會走到這裡，數字給低分只是保底(以防之後垃圾魚也接進來)。
export const FISH_TIER_HAPTIC_SCALE: Record<FishTierKey, number> = {
  trash: 0.4,
  small: 0.55,
  medium: 0.75,
  large: 0.9,
  boss: 1.05,
  legendary: 1.25,
};

function scaleForTier(pattern: VibratePattern, tierKey: FishTierKey): VibratePattern {
  const scale = FISH_TIER_HAPTIC_SCALE[tierKey];
  const durationScale = 0.7 + Math.min(1.3, scale) * 0.35;
  return {
    duration: Math.round(pattern.duration * durationScale),
    weakMagnitude: Math.min(1, pattern.weakMagnitude * scale),
    strongMagnitude: Math.min(1, pattern.strongMagnitude * scale),
  };
}

/** 依魚階縮放後觸發 FISHING_HAPTICS 裡「判定結果」那幾組(完美/成功/
 * 方向錯誤/沒按/暴衝安全放線/暴衝誤觸/收穫成功/斷線失敗)，呼叫端只要
 * 給判定種類跟魚階 key，不用自己算縮放。`bite`(咬鉤警示)不透過這個
 * function——它是警示鈴聲，不跟著魚階變弱，呼叫端直接
 * `vibrateGamepad(FISHING_HAPTICS.bite)`。 */
export function vibrateFishingHaptic(
  kind: Exclude<keyof typeof FISHING_HAPTICS, "bite" | "pull" | "rushPulse">,
  tierKey: FishTierKey,
) {
  vibrateGamepad(scaleForTier(FISHING_HAPTICS[kind], tierKey));
}

// 左右靠雙馬達的「弱／強」比例做出方向感——大部分手把(含 Xbox 360)弱
// 馬達(高頻、較輕)裝在右邊、強馬達(低頻、較重)裝在左邊，這是常見硬體
// 配置，但 Web Gamepad API 規格本身沒有保證一定對應到物理左右，只能
// 算是「大部分手把上大致如此」的近似值，不是精確的空間定位。上／下
// 沒有對應的物理馬達可以比照左右做偏移，改用節奏做出「觸感不同」——
// 這不是真的空間定位，是用時間結構去模擬「重量感」跟「甩動感」的差異。
function applyDirectionalBias(
  pattern: VibratePattern,
  dir: QteDirection,
): VibratePattern {
  if (dir === "left")
    return { ...pattern, weakMagnitude: pattern.weakMagnitude * 0.3 };
  if (dir === "right")
    return { ...pattern, strongMagnitude: pattern.strongMagnitude * 0.3 };
  return pattern;
}

/** 方向事件「開始」那一刻觸發一次拉扯感——代表「魚正往這個方向拉線」，
 * 玩家要按反方向抵抗(見設計筆記 3.3 節)。魚往左/右逃：靠雙馬達強弱
 * 比例做出左右偏移；魚往下潛：一次比較長、比較沉的單一震動(線被往下
 * 拖的重量感)；魚往上躍出水面：兩下快速輕擊(線瞬間變輕、甩動感)，跟
 * 「下潛」的沉重長頓做出節奏上的差異。判定結果(完美/成功/方向錯誤/
 * 沒按)是另一次獨立的震動，見 vibrateFishingHaptic——一個事件會先有
 * 「開始」的拉扯感，判定出來後再有「結果」的震動，中間那段等待窗沒有
 * 震動，這個安靜的空檔就是「暫停」的觸感。 */
export function vibrateDirectionalPull(
  fishDirection: QteDirection,
  tierKey: FishTierKey,
) {
  const base = scaleForTier(FISHING_HAPTICS.pull, tierKey);
  if (fishDirection === "left" || fishDirection === "right") {
    vibrateGamepad(applyDirectionalBias(base, fishDirection));
    return;
  }
  if (fishDirection === "down") {
    vibrateGamepad({ ...base, duration: Math.round(base.duration * 1.7) });
    return;
  }
  const tap = { ...base, duration: Math.round(base.duration * 0.45) };
  vibrateGamepad(tap);
  setTimeout(() => vibrateGamepad(tap), 100);
}

/** 暴衝事件「開始」那一刻觸發——魚轉圈猛拉的亂流感，用連續幾下快速
 * 脈衝做出「不規則亂拉」的節奏，跟其他事件單一一下的拉扯感明顯不同，
 * 玩家應該一感覺到「這陣亂震」就知道現在要放線、不要按任何鍵(見設計
 * 筆記 3.5 節)。 */
export function vibrateRushSpin(tierKey: FishTierKey) {
  const pulse = scaleForTier(FISHING_HAPTICS.rushPulse, tierKey);
  const pulses = 4;
  for (let i = 0; i < pulses; i++) {
    setTimeout(() => vibrateGamepad(pulse), i * 90);
  }
}
