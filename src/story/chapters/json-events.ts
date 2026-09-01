import type { StoryEvent } from "../story-types";

// 2026-09-01 Phase A：手寫 JSON 事件的載入點。src/story/chapters/data/
// 底下每個 *.json 檔案可以是單一 StoryEvent 物件，也可以是 StoryEvent[]
// 陣列（一個檔案想放好幾個小事件也可以）。用 Vite 的 import.meta.glob
// 在建置期直接把整個資料夾打包進來，不用另外寫一個 fetch()／檔案清單
// ——這只在瀏覽器/Vite 環境有效（npm run dev、npm run build 都算），純
// Node 環境（例如 scripts/story-audit.ts 用 tsx 直接跑）沒有
// import.meta.glob，所以用 typeof 檢查是不是函式再呼叫，避免在 tsx 底下
// 直接噴錯——tsx 環境自己有另一份用 node:fs 讀同一個資料夾的驗證邏輯
// （見 scripts/story-audit.ts），兩邊分開但驗證同一批檔案。
//
// 這批事件不會自動出現在正式流程裡——跟 TS 手寫事件一樣，一樣要嘛被
// STORY_EVENTS 收進 registry 之後有東西呼叫 runStoryEvent()，要嘛保持
// manual only。JSON 只是換一種手寫格式，不代表會自動接線。
const globFn = (import.meta as any).glob;
const modules: Record<string, { default: StoryEvent | StoryEvent[] }> =
  typeof globFn === "function" ? globFn("./data/*.json", { eager: true }) : {};

export const JSON_STORY_EVENTS: StoryEvent[] = Object.values(modules).flatMap(
  (mod) => {
    const data = mod.default;
    return Array.isArray(data) ? data : [data];
  },
);
