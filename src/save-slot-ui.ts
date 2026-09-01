import { SEASON_NAMES } from "./game-state";
import { getSaveSlotSummaries, SaveSlotSummary } from "./input-save";
import { getLocale, translateText } from "./i18n";

// 標題畫面「讀取遊戲」跟遊戲中 Esc 暫停選單的「讀取進度」／「儲存進度」
// 共用同一份清單渲染邏輯——兩邊畫面/摘要文字只寫一次，之後存檔資料結構
// 改了也只要改這裡。

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
  const playerName = summary.playerName || translateText("牧場主");
  if (getLocale() === "en") return `${playerName} · Day ${day} · ${season} · ${mapName}`;
  if (getLocale() === "ja") return `${playerName}・${season}・${day}日目・${mapName}`;
  return `${playerName}・第 ${day} 天・${season}季・${mapName}`;
}

// 存檔時間——存檔資料本來就有 savedAt(見 input-save.ts 的 saveGame())，
// 只是清單一直沒有顯示出來。格式故意保持精簡(月/日 時:分)，清單一行放
// 得下，也不需要跟摘要文字搶位置；沒有 savedAt(理論上不會發生，保險起
// 見)就回傳空字串，呼叫端會直接不渲染這個節點。
function formatSavedAt(savedAt: number | undefined): string {
  if (!savedAt) return "";
  const locale = getLocale();
  const localeTag = locale === "en" ? "en-US" : locale === "ja" ? "ja-JP" : "zh-Hant-TW";
  try {
    return new Date(savedAt).toLocaleString(localeTag, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function appendSlotMeta(button: HTMLButtonElement, summary: SaveSlotSummary) {
  const meta = document.createElement("span");
  meta.className = "titleSlotMeta";
  const summaryEl = document.createElement("span");
  summaryEl.className = "titleSlotSummary";
  summaryEl.textContent = slotSummaryText(summary);
  meta.append(summaryEl);
  const timeText = formatSavedAt(summary.savedAt);
  if (timeText) {
    const timeEl = document.createElement("span");
    timeEl.className = "titleSlotTime";
    timeEl.textContent = timeText;
    meta.append(timeEl);
  }
  button.append(meta);
}

// 兩個 render 函式都回傳「建議 focus 的按鈕」——同一份存檔清單，
// 標題畫面跟暫停選單各自呼叫完之後拿這個結果去 .focus()，不用各自另外
// 寫一套「哪個該被選到」的邏輯。規則：清單中「有資料、savedAt 最新」的
// 那格優先；讀取清單如果完全沒有任何存檔，回傳 null 讓呼叫端退回原本
// 「返回」按鈕；儲存清單所有格永遠可點(空格也能存新檔)，找不到任何已存
// 資料時退回清單第一格。

// container 底下清空重建 9 個手動 slot(不含自動存檔——不能手動存進
// 自動存檔格)；每格永遠可點，回傳實際 saveName 與其來源手動格。
export function renderWritableSaveSlotButtons(
  container: HTMLElement,
  onPick: (slot: number) => void,
): HTMLButtonElement | null {
  container.innerHTML = "";
  container.classList.add("saveSlotList");
  let mostRecentButton: HTMLButtonElement | null = null;
  let mostRecentAt = -Infinity;
  let firstButton: HTMLButtonElement | null = null;
  getSaveSlotSummaries()
    .filter((summary) => !summary.isAutosave)
    .forEach((summary) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "titleSlotBtn";
      const numEl = document.createElement("span");
      numEl.className = "titleSlotNum";
      numEl.textContent = getLocale() === "en"
        ? `Slot ${summary.slot}`
        : getLocale() === "ja"
          ? `スロット ${summary.slot}`
          : `第 ${summary.slot} 格`;
      button.append(numEl);
      appendSlotMeta(button, summary);
      button.addEventListener("click", () => onPick(summary.slot));
      container.appendChild(button);
      if (!firstButton) firstButton = button;
      if (summary.exists && (summary.savedAt ?? 0) > mostRecentAt) {
        mostRecentAt = summary.savedAt ?? 0;
        mostRecentButton = button;
      }
    });
  return mostRecentButton ?? firstButton;
}

export function renderSaveSlotButtons(
  container: HTMLElement,
  onPick: (saveName: string, sourceSlot: number) => void,
): HTMLButtonElement | null {
  container.innerHTML = "";
  container.classList.add("saveSlotList");
  let mostRecentButton: HTMLButtonElement | null = null;
  let mostRecentAt = -Infinity;
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
    button.append(numEl);
    appendSlotMeta(button, summary);

    if (summary.exists) {
      button.addEventListener("click", () =>
        onPick(summary.saveName, summary.sourceSlot),
      );
      if ((summary.savedAt ?? 0) > mostRecentAt) {
        mostRecentAt = summary.savedAt ?? 0;
        mostRecentButton = button;
      }
    }
    container.appendChild(button);
  });
  return mostRecentButton;
}
