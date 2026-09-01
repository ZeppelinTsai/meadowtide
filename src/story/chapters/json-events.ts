import type { StoryEvent } from "../story-types";
import carpenterDockIntroDraft from "./data/carpenter-dock-intro-draft.json";

// 2026-09-01 Phase A：手寫 JSON 事件的載入點。src/story/chapters/data/
// 底下每個 *.json 檔案可以是單一 StoryEvent 物件，也可以是 StoryEvent[]
// 陣列。
//
// 這裡刻意用「明確 import + 手動加進陣列」而不是 Vite 的
// import.meta.glob() 自動掃資料夾——原本第一版是用 glob 自動載入，
// F10 熱鍵實測直接在遊戲裡按下去，結果印出「找不到
// dev.carpenter_dock_intro_draft」。根因是 import.meta.glob() 是 Vite
// 建置期語法巨集，只有「import.meta.glob(...) 這個呼叫式本身直接寫在
// 原始碼裡」才會被正確轉換；為了不讓 tsx 直接跑的
// scripts/story-audit.ts 在沒有這個 API 的環境下噴錯，原本的寫法把它
// 包了一層變數／typeof 判斷再呼叫——這樣寫 Vite 就認不出來了，實際在
// 瀏覽器裡跑 STORY_EVENTS 永遠是空的，是這輪唯一一次「單元測試/audit
// 都過，但真的在遊戲裡試才發現壞掉」的案例。改成明確 import 之後，
// 同一行 `import x from "./data/x.json"`（resolveJsonModule 已開啟）
// 在 Vite（瀏覽器）跟 tsx（scripts/story-audit.ts）底下是原生支援、
// 行為完全一致，不用再猜測建置工具的巨集認不認得某種寫法。
//
// 代價：加新的 JSON 事件檔案時，除了在 data/ 底下新增檔案，還要回來
// 這裡補一行 import + 加進下面的陣列——不是「丟進資料夾就自動生效」，
// 但換到的是「兩個執行環境保證行為一致」，這次的教訓是後者更重要。
export const JSON_STORY_EVENTS: StoryEvent[] = [
  ...(Array.isArray(carpenterDockIntroDraft)
    ? carpenterDockIntroDraft
    : [carpenterDockIntroDraft]),
] as StoryEvent[];
