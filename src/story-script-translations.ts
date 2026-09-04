import storyRows from "./story/chapters/data/prologue-day1-day2-translations.json";

type StoryTranslationRow = {
  text: string;
  text_en: string;
  text_ja: string;
};

function buildStoryLookup(field: "text_en" | "text_ja"): Record<string, string> {
  return (storyRows as StoryTranslationRow[]).reduce<Record<string, string>>(
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
