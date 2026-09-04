import storyRows from "./story/chapters/data/prologue-day1-day2-translations.json";

export type StoryTranslationRow = {
  text: string;
  text_en: string;
  text_ja: string;
};

// 匯出原始列表給 scripts/story-audit.ts 檢查重複原文——STORY_SCRIPT_
// TRANSLATIONS 下面是用 row.text(原文中文)直接當 key 查表，兩筆原文
// 只要字面一模一樣，後面那筆會悄悄蓋掉前面那筆的翻譯，且不會有任何
// 錯誤訊息。2026-09-04 加新的一天/新角色台詞時，這裡不用手動維護，
// audit 會自動掃這份陣列。
export const STORY_TRANSLATION_ROWS: StoryTranslationRow[] = storyRows as StoryTranslationRow[];

function buildStoryLookup(field: "text_en" | "text_ja"): Record<string, string> {
  return STORY_TRANSLATION_ROWS.reduce<Record<string, string>>(
    (lookup, row) => {
      if (row.text && row[field]) lookup[row.text] = row[field];
      return lookup;
    },
    {},
  );
}

export const STORY_SCRIPT_TRANSLATIONS = {
  en: buildStoryLookup("text_en"),
  ja: buildStoryLookup("text_ja"),
};
