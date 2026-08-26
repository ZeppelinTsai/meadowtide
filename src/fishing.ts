// ==============================================================
// 釣魚 QTE 系統 —— 魚階資料、竿具等級公式、QTE 序列產生器、判定邏輯。
// 純資料/邏輯模組，不碰 THREE/DOM：跟 layout-maps.ts 同一個原則，方便
// 之後如果要寫測試或給地圖偵錯工具共用可以直接 import。遊戲迴圈
// (game-loop.ts)/輸入(input-save.ts)負責把這裡算出來的東西接上動畫、
// 音效跟畫面——那兩處目前用最陽春的文字提示(#fishHint)顯示，之後畫面
// 版本確定了再換掉，不影響這裡的邏輯。
//
// 設計來源：claude/釣魚QTE系統設計筆記v1.md(專案文件)。所有數值(體力/
// 權重/QTE次數/暴衝次數/判定秒數)都是草案，之後隨時可能依實際遊玩調整
// ——這裡集中放，改起來只要動這個檔案。
// ==============================================================

export type FishTierKey =
  | "trash"
  | "small"
  | "medium"
  | "large"
  | "boss"
  | "legendary";

export interface FishTierDef {
  key: FishTierKey;
  label: string;
  staminaCost: number;
  baseQteMin: number;
  baseQteMax: number;
  // 暴衝次數範圍——不計入上面的 QTE 額度(見設計筆記 2.1 節)。
  rushMin: number;
  rushMax: number;
  // 整個拉扯期的時間預算(秒)，用來反推每次判定窗大概要多長。
  minSeconds: number;
  maxSeconds: number;
  // 咬鉤時的抽選權重，草案值，之後可能被假魚餌系統(設計筆記第 8 節，
  // 尚未實作)依裝備覆寫或加權。
  weight: number;
}

// 六階分級——體力/QTE 範圍/暴衝次數/時間預算照設計筆記表 1 抄。
export const FISH_TIERS: Record<FishTierKey, FishTierDef> = {
  trash: {
    key: "trash",
    label: "垃圾",
    staminaCost: 0,
    baseQteMin: 0,
    baseQteMax: 0,
    rushMin: 0,
    rushMax: 0,
    minSeconds: 0,
    maxSeconds: 0,
    weight: 30,
  },
  small: {
    key: "small",
    label: "小魚",
    staminaCost: 3,
    baseQteMin: 3,
    baseQteMax: 3,
    rushMin: 0,
    rushMax: 0,
    minSeconds: 4,
    maxSeconds: 6,
    weight: 32,
  },
  medium: {
    key: "medium",
    label: "中魚",
    staminaCost: 6,
    baseQteMin: 4,
    baseQteMax: 5,
    rushMin: 1,
    rushMax: 1,
    minSeconds: 6,
    maxSeconds: 9,
    weight: 20,
  },
  large: {
    key: "large",
    label: "大魚",
    staminaCost: 9,
    baseQteMin: 5,
    baseQteMax: 6,
    rushMin: 1,
    rushMax: 2,
    minSeconds: 9,
    maxSeconds: 14,
    weight: 12,
  },
  boss: {
    key: "boss",
    label: "魚霸主",
    staminaCost: 12,
    baseQteMin: 6,
    baseQteMax: 7,
    rushMin: 2,
    rushMax: 3,
    minSeconds: 12,
    maxSeconds: 20,
    weight: 5,
  },
  legendary: {
    key: "legendary",
    label: "特殊",
    staminaCost: 15,
    baseQteMin: 7,
    baseQteMax: 9,
    rushMin: 3,
    rushMax: 5,
    minSeconds: 20,
    maxSeconds: 35,
    weight: 1,
  },
};

export const FISH_TIER_ORDER: FishTierKey[] = [
  "trash",
  "small",
  "medium",
  "large",
  "boss",
  "legendary",
];

function rollInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 依權重抽一個魚階——目前用固定權重(FISH_TIERS[key].weight)，假魚餌
 * 系統(設計筆記第 8 節)之後可以傳一份覆寫過的權重表進來，不用改這個
 * 函式本身。 */
export function rollFishTier(
  weights: Partial<Record<FishTierKey, number>> = {},
): FishTierDef {
  const entries = FISH_TIER_ORDER.map((key) => ({
    key,
    weight: weights[key] ?? FISH_TIERS[key].weight,
  }));
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return FISH_TIERS[entry.key];
  }
  return FISH_TIERS[entries[entries.length - 1].key];
}

/** 竿具等級公式(設計筆記第 2 節，已定案)：小/中/大魚可以被升級扣到 0
 * (跟垃圾魚一樣秒收)；魚霸主/特殊魚公式下限鎖 1，永遠要親手按一次。 */
export function actualQteCount(tier: FishTierDef, rodLevel: number): number {
  const rolledBase = rollInt(tier.baseQteMin, tier.baseQteMax);
  const discounted = rolledBase - rodLevel * 3;
  if (tier.key === "boss" || tier.key === "legendary")
    return Math.max(1, discounted);
  return Math.max(0, discounted);
}

export type QteDirection = "up" | "down" | "left" | "right";
const DIRECTIONS: QteDirection[] = ["up", "down", "left", "right"];

export interface QteEvent {
  kind: "direction" | "rush";
  // kind==="direction" 時才有值：魚逃跑的方向，玩家要按反方向抵抗
  // (見設計筆記 3.3 節)——反方向已經在 COUNTER_DIRECTION 換算好，
  // 這裡存的是「魚的動作方向」，方便畫面顯示魚的動畫。
  fishDirection?: QteDirection;
  // 是否為序列最後一個 direction 事件——最後收竿(3.6 節)，判定窗要
  // 放寬，不是額外多加的第 N+1 次。
  isFinal?: boolean;
  windowSeconds: number;
}

/** 魚的逃跑方向 → 玩家該按的抵抗方向(設計筆記 3.3 節：反方向拉竿)。 */
export const COUNTER_DIRECTION: Record<QteDirection, QteDirection> = {
  left: "right",
  right: "left",
  down: "up", // 魚往下潛 → 按上拉起
  up: "down", // 魚躍出水面 → 按下穩住魚線
};

/** 把 tier 的時間預算平均分給每個事件(direction + rush)，夾在一個合理
 * 範圍內，避免魚階時間預算算出來的單一判定窗過短(按不到)或過長(太拖)。
 * 最後一個 direction 事件(最後收竿)額外放寬，呼應 3.6 節「較寬鬆的方向
 * 判定」。 */
function windowSecondsFor(
  tier: FishTierDef,
  eventCount: number,
  isFinal: boolean,
): number {
  const budget =
    tier.maxSeconds > 0
      ? (tier.minSeconds + tier.maxSeconds) / 2
      : 1.6 * eventCount;
  const base = eventCount > 0 ? budget / eventCount : 1.6;
  const clamped = Math.max(0.9, Math.min(2.4, base));
  return isFinal ? clamped * 1.4 : clamped;
}

/** 產生一次拉扯期的完整事件序列：n 個 direction 事件(額度內，最後一個
 * 是最後收竿) + rushCount 個暴衝事件(額度外，隨機插在中間，不會插在
 * 最後收竿之後——魚都要上岸了不會突然暴衝)。 */
export function buildQteSequence(
  tier: FishTierDef,
  qteCount: number,
): QteEvent[] {
  const rushCount =
    tier.rushMin + tier.rushMax > 0 ? rollInt(tier.rushMin, tier.rushMax) : 0;
  const events: QteEvent[] = [];
  for (let i = 0; i < qteCount; i++) {
    const isFinal = i === qteCount - 1;
    events.push({
      kind: "direction",
      fishDirection: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
      isFinal,
      windowSeconds: windowSecondsFor(tier, qteCount, isFinal),
    });
  }
  const rushWindowSeconds = Math.max(
    1.1,
    Math.min(1.9, windowSecondsFor(tier, qteCount || 1, false) * 1.1),
  );
  for (let i = 0; i < rushCount; i++) {
    // 不插在陣列最前面(魚才剛上鉤還沒開始拉扯)或最後一個 direction 事件
    // 之後(最後收竿之後不該再暴衝)。qteCount<=1 時就直接接在後面。
    const insertAt =
      events.length > 1
        ? 1 + Math.floor(Math.random() * (events.length - 1))
        : events.length;
    events.splice(insertAt, 0, {
      kind: "rush",
      windowSeconds: rushWindowSeconds,
    });
  }
  return events;
}

export type QteJudgement = "perfect" | "success" | "wrong" | "miss";

// 張力增減量(設計筆記 3.4/3.5 節，草案值)：完美大降、成功小降、按錯
// 大增、沒按(超時)小增——沒按跟按錯不該同等嚴重。暴衝正確放線(不按)
// 小降，暴衝誤按(硬拉)大增。
export const TENSION_MAX = 100;
export const TENSION_DELTA = {
  perfect: -25,
  success: -10,
  wrong: 30,
  miss: 15,
  rushSafe: -5,
  rushFail: 35,
} as const;

/** 判定一次 direction 事件的按鍵結果。pressedDir 為 null 代表判定窗
 * 內沒有任何按鍵(超時)。pressRatio 是按下當下距離判定窗開始經過的
 * 比例(0~1)，只有 pressedDir 對的時候才有意義，用來分「完美」跟
 * 「成功」——完美是窗口正中央約 25%(見 3.4 節表格)。 */
export function judgeDirectionPress(
  fishDirection: QteDirection,
  pressedDir: QteDirection | null,
  pressRatio: number,
): QteJudgement {
  if (pressedDir === null) return "miss";
  const required = COUNTER_DIRECTION[fishDirection];
  if (pressedDir !== required) return "wrong";
  return pressRatio >= 0.375 && pressRatio <= 0.625 ? "perfect" : "success";
}

export function tensionDeltaFor(judgement: QteJudgement): number {
  return TENSION_DELTA[judgement];
}
