import { SEASON_NAMES } from "./game-state";
import { getSaveSlotSummaries, SaveSlotSummary } from "./input-save";
import { getLocale, translateText } from "./i18n";

// 標題畫面「讀取遊戲」跟遊戲中 Esc 暫停選單的「讀取進度」共用同一份 9
// 格清單渲染邏輯——兩邊畫面/摘要文字只寫一次，之後存檔資料結構改了也
// 只要改這裡。

const MAP_DISPLAY_NAMES: Record<string, string> = {
  livingArea: "生活區",
  port: "港口",
  oldVillage: "舊村",
  mountain: "山區",
  stalactiteCave: "鐘乳石洞窟",
};

function slotSummaryText(summary: SaveSlotSummary): string {
  if (!summary.exists) return translateText("（空）");
  const season = translateText(SEASON_NAMES[summary.currentSeason ?? 0] ?? "");
  const mapName =
    translateText(MAP_DISPLAY_NAMES[summary.currentMapName ?? ""] || "") ||
    summary.currentMapName ||
    "";
  const day = (summary.currentDay ?? 0) + 1;
  if (getLocale() === "en") return `Day ${day} · ${season} · ${mapName}`;
  if (getLocale() === "ja") return `${season}・${day}日目・${mapName}`;
  return `第 ${day} 天・${season}季・${mapName}`;
}

// container 底下清空重建 autosave + 9 個手動 slot；空格 disabled，
// 有資料的項目點下去回傳實際 saveName 與其來源手動格。
export function renderSaveSlotButtons(
  container: HTMLElement,
  onPick: (saveName: string, sourceSlot: number) => void,
) {
  container.innerHTML = "";
  container.classList.add("saveSlotList");
  getSaveSlotSummaries().forEach((summary) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "titleSlotBtn" + (summary.isAutosave ? " titleSlotBtn--autosave" : "");
    button.disabled = !summary.exists;

    const numEl = document.createElement("span");
    numEl.className = "titleSlotNum";
    numEl.textContent = summary.isAutosave
      ? translateText("自動存檔")
      : getLocale() === "en" ? `Slot ${summary.slot}` : getLocale() === "ja" ? `スロット ${summary.slot}` : `第 ${summary.slot} 格`;

    const summaryEl = document.createElement("span");
    summaryEl.className = "titleSlotSummary";
    summaryEl.textContent = slotSummaryText(summary);

    button.append(numEl, summaryEl);
    if (summary.exists) {
      button.addEventListener("click", () =>
        onPick(summary.saveName, summary.sourceSlot),
      );
    }
    container.appendChild(button);
  });
}
