import type { Locale } from "../i18n";

// 2026-09-01 Phase A：手寫 JSON 事件用的多語言文字欄位——用「同一個
// 欄位名 + 語言後綴」的扁平寫法（例如 text／text_en／text_ja），不是
// 巢狀物件，方便手動編輯 JSON 檔案時直接加一個新欄位就能補一個語言，
// 不用改資料結構。跟 StoryStep 的 textKey／t() 那條路徑並存——手寫
// TS 事件想維持嚴格 i18n key 管理就繼續用 textKey，手寫 JSON 事件圖快
// 就用 text／text_xx。純函式，不吃 DOM／i18n.ts 執行期依賴（只吃
// Locale 型別，import type 編譯期會被完全擦掉），方便單元測試。

const LOCALE_SUFFIX: Record<Locale, string | null> = {
  zh: null, // zh 是基準欄位本身（不加後綴），不是 text_zh
  en: "en",
  ja: "ja",
};

/**
 * 從一個帶有 field／field_en／field_ja 這種扁平後綴欄位的物件裡，依
 * locale 挑出對應的字串；查無該語言時退回基準欄位（zh），兩者都沒有
 * 就回傳 undefined（呼叫端決定要不要當成錯誤）。
 */
export function pickLocalizedField(
  source: Record<string, unknown>,
  field: string,
  locale: Locale,
): string | undefined {
  const suffix = LOCALE_SUFFIX[locale];
  if (suffix) {
    const suffixed = source[`${field}_${suffix}`];
    if (typeof suffixed === "string" && suffixed.trim()) return suffixed;
  }
  const base = source[field];
  return typeof base === "string" && base.trim() ? base : undefined;
}
