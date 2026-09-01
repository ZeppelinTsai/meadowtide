import { npcs } from "./npc-runtime";
import { gameState } from "./game-state";
import { translateText } from "./i18n";
import { showComicCue } from "./comic-cue";
import {
  getNpcDisplayName,
  isNpcIdentityId,
  setNpcNameStage,
} from "./npc-name-reveal";

export const dialogEl = document.getElementById("dialog");
export const dialogTextEl = document.getElementById("dialogText");
export const dialogNameEl = document.getElementById("dialogName");
export const dialogPortraitEl = document.getElementById(
  "dialogPortrait",
) as HTMLImageElement;
export const dialogPortraitPlaceholderEl = document.getElementById(
  "dialogPortraitPlaceholder",
);
export const cgOverlayEl = document.getElementById("cgOverlay");
export const cgImgEl = document.getElementById("cgImg") as HTMLImageElement;

// ==============================================================
// 立繪／CG——UI 層唯一允許外部圖片的地方（3D 世界本身仍然完全程式
// 生成，見 AGENTS.md「圖片素材規則」）。兩層分開：
//   - 立繪(#dialogPortrait)：中小尺寸，疊在對話框正上方，3D 世界
//     維持可見，日常對話用這個。
//   - CG(#cgOverlay)：只有少數關鍵劇情節點掛，全螢幕蓋過 3D 畫面，
//     淡入淡出銜接。
// 兩者都用 Image().onerror 偵測檔案存不存在——跟 BGM 載入失敗的處理
// 邏輯一樣：只在 console 警告、不中斷對話，圖檔之後陸續補進資料夾
// 就會自動生效，不用改程式碼。
// ==============================================================
export let currentCgId = null;
let currentPortraitId = null;
export function setDialogPortrait(speakerId) {
  if (speakerId === currentPortraitId) {
    if (currentCgId || !speakerId) {
      dialogPortraitEl.style.display = "none";
      dialogPortraitPlaceholderEl.style.display = "none";
    } else if (dialogPortraitEl.dataset.portraitId === speakerId) {
      dialogPortraitEl.style.display = "block";
    }
    return;
  }
  currentPortraitId = speakerId;
  delete dialogPortraitEl.dataset.portraitId;
  if (currentCgId || !speakerId) {
    dialogPortraitEl.style.display = "none";
    dialogPortraitPlaceholderEl.style.display = "none";
    return;
  }
  // 圖檔還沒生成好之前，先顯示一個佔位框(虛線邊框+角色代號)，讓版位/
  // 比例現在就看得出來；真的立繪載入成功後蓋掉佔位框，失敗就留著佔位框。
  dialogPortraitEl.style.display = "none";
  dialogPortraitPlaceholderEl.style.display = "none";
  const img = new Image();
  img.onload = () => {
    if (currentPortraitId !== speakerId) return;
    dialogPortraitEl.src = img.src;
    dialogPortraitEl.dataset.portraitId = speakerId;
    if (currentCgId) return;
    dialogPortraitEl.style.display = "block";
    dialogPortraitPlaceholderEl.style.display = "none";
  };
  img.onerror = () => {
    if (currentPortraitId !== speakerId) return;
    dialogPortraitEl.style.display = "none"; // 圖檔不存在時維持空白，不打斷對話
  };
  img.src = `/assets/portraits/${speakerId}.png`;
}
export function setDialogCg(cgId) {
  if (cgId === currentCgId) return; // 沒變化，不用重新觸發淡入淡出
  if (!cgId) {
    currentCgId = null;
    cgOverlayEl.style.opacity = "0";
    setTimeout(() => {
      if (!currentCgId) cgOverlayEl.style.display = "none";
    }, 500);
    return;
  }
  currentCgId = cgId;
  const img = new Image();
  img.onload = () => {
    if (currentCgId !== cgId) return; // 載入期間對話已經跳到別行，放棄套用
    cgImgEl.src = img.src;
    cgOverlayEl.style.display = "block";
    requestAnimationFrame(() => {
      cgOverlayEl.style.opacity = "1";
    });
  };
  img.onerror = () => {
    console.warn(`[CG] 找不到 CG 圖檔，維持原本畫面：${cgId}`);
    if (currentCgId === cgId) currentCgId = null;
  };
  img.src = `/assets/cg/${cgId}.png`;
}
// 對話行可以是純字串(沿用舊格式，沒有立繪/名牌)，也可以是
// {text, speaker?, name?, cg?} 物件——speaker 對應立繪檔名，name 是
// 名牌顯示文字(不填就查 npcs 裡對應 id 的 name)，cg 觸發全螢幕 CG。
export function normalizeDialogLine(line) {
  return typeof line === "string" ? { text: line } : line;
}
export function renderDialogLine(line) {
  showComicCue(line.comicCue || null);
  dialogTextEl.textContent = translateText(line.text);
  setDialogCg(line.cg || null);
  setDialogPortrait(line.hidePortrait ? null : line.speaker || null);
  if (line.name || line.speaker) {
    const npc = npcs.find((n) => n.id === line.speaker);
    dialogNameEl.textContent =
      line.speaker && isNpcIdentityId(line.speaker)
        ? getNpcDisplayName(line.speaker)
        : translateText(line.name || (npc && npc.name) || line.speaker);
    dialogNameEl.style.display = "block";
  } else {
    dialogNameEl.style.display = "none";
  }
}
export function closeDialogUi() {
  showComicCue(null);
  dialogEl.style.display = "none";
  dialogNameEl.style.display = "none";
  setDialogPortrait(null);
  setDialogCg(null);
}
export function showDialog(text) {
  const wasOpen = !(
    dialogEl.style.display === "none" || !dialogEl.style.display
  );
  if (wasOpen) {
    closeDialogUi();
    return;
  }
  renderDialogLine(normalizeDialogLine(text));
  dialogEl.style.display = "flex"; // flex 才吃得到 align-items:center 讓文字上下置中
}
// 多句對話用的小佇列——按 E 一句一句往下推，最後一句再按一次才關掉。
// 單句對話還是用上面的 showDialog()，這個只給需要「一來一往」的場景用
export let dialogQueue = [];
export let dialogIndex = 0;
export let dialogSequenceOnComplete = null;
// onComplete 是選用的：劇情事件(如木匠抵達)要在整段對話跑完後接材料
// 檢查/進度推進時傳進來，一般單純的多句對話不用管這個參數
export function showDialogSequence(lines, onComplete = null) {
  const normalized = lines.map(normalizeDialogLine);
  const compacted = [];
  let pendingComicCue = null;
  normalized.forEach((line) => {
    const isStageDirection = /^\[.*\]$/.test(line.text.trim());
    if (isStageDirection) {
      if (line.comicCue) pendingComicCue = line.comicCue;
      return;
    }
    if (pendingComicCue && !line.comicCue) line.comicCue = pendingComicCue;
    pendingComicCue = null;
    compacted.push(line);
  });
  dialogQueue = compacted;
  dialogIndex = 0;
  dialogSequenceOnComplete = onComplete;
  if (!dialogQueue.length) {
    closeDialogUi();
    dialogSequenceOnComplete = null;
    if (onComplete) queueMicrotask(onComplete);
    return;
  }
  renderDialogLine(dialogQueue[0]);
  dialogEl.style.display = "flex"; // flex 才吃得到 align-items:center 讓文字上下置中
}
export function advanceDialogSequence() {
  const completedLine = dialogQueue[dialogIndex];
  dialogIndex++;
  if (completedLine?.revealNameAfter) {
    setNpcNameStage(
      completedLine.revealNameAfter.npcId,
      completedLine.revealNameAfter.stage,
    );
  }
  if (dialogIndex >= dialogQueue.length) {
    closeDialogUi();
    dialogQueue = [];
    const onComplete = dialogSequenceOnComplete;
    dialogSequenceOnComplete = null;
    if (onComplete) onComplete();
    return;
  }
  renderDialogLine(dialogQueue[dialogIndex]);
}

// ==============================================================
// 二選一(或多選)提示——跟連續對話(dialogQueue)共用同一個 #dialog
// 框、同一套文字渲染(renderDialogLine)，但底下換成一排選項按鈕，
// 不是「按 E 一句句往下推」。故意不塞進 dialogQueue，是因為 E 鍵
// 的處理邏輯(input-save.ts)看到 dialogQueue.length 就會直接呼叫
// advanceDialogSequence()，那是「純文字往下推」的語意，跟「玩家
// 要做一個真的有分支的決定」不一樣，混在一起容易誤觸——所以選項
// 提示用另一個獨立狀態(activeChoice)，E 鍵在有 activeChoice 時直接
// 忽略，只認數字鍵/滑鼠點擊(見 input-save.ts)。
// 這是為了「上樓要不要直接回城鎮」這個需求做的通用小工具，之後
// 任何「玩家要在文字提示下做選擇」的場景(包含之後想做的另一個
// 「往上爬」洞窟)都可以直接呼叫 showChoice()，不用再各自發明一套。
//
// 2026-08-25 改版(FGO 風格)：原本選項按鈕塞在 #dialog 內部右下角，
// 一多就跟立繪/長文字互相蓋到。改成獨立浮動在 #dialog 正上方、寬版
// 堆疊的一排選項條，DOM 上把 #dialogChoices 移出 #dialog 變成同層
// 的 sibling(理由：#dialog 本身有 transform，會讓內部 position:fixed
// 子元素的定位基準變成 #dialog 的 box 而不是整個 viewport，移出來
// 才單純)。垂直位置不是寫死的 CSS 值，是每次渲染時用 JS 讀
// #dialog 當下實際的 getBoundingClientRect() 高度即時算(見
// positionChoicePanel)，這樣不管對話文字長短、有沒有名牌/立繪一起
// 跳出來，選項面板永遠緊貼在對話框正上方，不會疊字也不會浮空——
// 這就是「自適應」的意思，不是靠 CSS media query 而已。
// 同時最多只顯示 CHOICE_PAGE_SIZE(3)個選項，超過的話最下面多一條
// 較小的「換下一頁」列，點擊或按 Tab 鍵可以循環翻頁(見
// advanceChoicePage，input-save.ts 裡 Tab 鍵會呼叫這個)；數字鍵
// 1~3 對應的是「目前這一頁」看得到的選項，不是選項陣列裡的絕對
// 索引，換頁後 1~3 會對應到新的那三個。
// ==============================================================
export const dialogChoicesEl = document.getElementById("dialogChoices");
export const dialogContinueEl = document.getElementById("dialogContinue");
export const CHOICE_PAGE_SIZE = 3;
export let activeChoice: {
  options: { label: string; value: any }[];
  onSelect: (value: any) => void;
  page: number;
} | null = null;

// 把選項面板釘在 #dialog 正上方——每次選項內容變動(換頁/剛開啟)都
// 要重算一次，因為對話框高度會隨文字/名牌是否顯示而變。
function positionChoicePanel() {
  const rect = dialogEl.getBoundingClientRect();
  dialogChoicesEl.style.bottom = `${window.innerHeight - rect.top + 30}px`;
}

// 依 activeChoice.page 畫出目前這一頁的按鈕(最多 CHOICE_PAGE_SIZE
// 個)，選項總數超過一頁時額外補一條「換下一頁」列。
function renderChoicePage() {
  if (!activeChoice) return;
  const { options, page } = activeChoice;
  const totalPages = Math.ceil(options.length / CHOICE_PAGE_SIZE);
  const start = page * CHOICE_PAGE_SIZE;
  const pageOptions = options.slice(start, start + CHOICE_PAGE_SIZE);
  dialogChoicesEl.innerHTML = "";
  pageOptions.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "dialogChoiceBtn";
    btn.textContent = `${i + 1}. ${translateText(opt.label)}`;
    btn.onclick = () => resolveChoice(opt.value);
    dialogChoicesEl.appendChild(btn);
  });
  if (totalPages > 1) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "dialogChoiceNextBtn";
    nextBtn.textContent = `換下一頁 (${page + 1}/${totalPages}) ▸`;
    nextBtn.onclick = () => advanceChoicePage();
    dialogChoicesEl.appendChild(nextBtn);
  }
  positionChoicePanel();
}

export function showChoice(text, options, onSelect) {
  renderDialogLine(normalizeDialogLine(text));
  dialogEl.style.display = "flex";
  if (dialogContinueEl) dialogContinueEl.style.display = "none";
  activeChoice = { options, onSelect, page: 0 };
  dialogChoicesEl.style.display = "flex";
  renderChoicePage();
}

// 換下一頁——選項數 <= 一頁裝得下的話直接沒事做，回傳有沒有真的
// 翻頁，方便呼叫端(input-save.ts 的 Tab 鍵)決定要不要 preventDefault。
// 翻到最後一頁後再翻會繞回第一頁，不會卡住。
export function advanceChoicePage(): boolean {
  if (!activeChoice) return false;
  const totalPages = Math.ceil(activeChoice.options.length / CHOICE_PAGE_SIZE);
  if (totalPages <= 1) return false;
  activeChoice.page = (activeChoice.page + 1) % totalPages;
  renderChoicePage();
  return true;
}

export function resolveChoice(value) {
  if (!activeChoice) return;
  const { onSelect } = activeChoice;
  activeChoice = null;
  dialogChoicesEl.style.display = "none";
  dialogChoicesEl.innerHTML = "";
  if (dialogContinueEl) dialogContinueEl.style.display = "";
  closeDialogUi();
  onSelect(value);
}

// 數字鍵 1~3 對應「目前這一頁」看得到的選項(不是選項陣列的絕對
// 索引，換頁後意義會變)，鍵盤事件統一集中在 input-save.ts 處理
// (既有慣例)，這裡只暴露一個純函式讓它呼叫；回傳有沒有真的吃掉
// 這個按鍵，方便呼叫端決定要不要 preventDefault。
export function handleChoiceDigitKey(key: string): boolean {
  if (!activeChoice) return false;
  const index = Number(key) - 1;
  if (Number.isNaN(index) || index < 0 || index >= CHOICE_PAGE_SIZE)
    return false;
  const absoluteIndex = activeChoice.page * CHOICE_PAGE_SIZE + index;
  const opt = activeChoice.options[absoluteIndex];
  if (!opt) return false;
  resolveChoice(opt.value);
  return true;
}
