import { npcs } from "./npc-runtime";
import {
  responsiveWebpUrl,
  CG_RESPONSIVE_WIDTHS,
  PORTRAIT_RESPONSIVE_WIDTHS,
} from "./responsive-images";
import { gameState } from "./game-state";
import { translateText } from "./i18n";
import { showComicCue, shouldDisplayDialogText } from "./comic-cue";
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
export const dialogHideToggleEl = document.getElementById("dialogHideToggle");
export const cgOverlayEl = document.getElementById("cgOverlay");
export const cgImgEl = document.getElementById("cgImg") as HTMLImageElement;
// 換差分用的第二張圖，平常疊在 cgImg 上面但透明——見 style.css #cgImgNext
// 註解跟下面 setDialogCg() 的差分分支。
export const cgImgNextEl = document.getElementById(
  "cgImgNext",
) as HTMLImageElement;

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
  const applyPortrait = (src: string) => {
    if (currentPortraitId !== speakerId) return;
    dialogPortraitEl.src = src;
    dialogPortraitEl.dataset.portraitId = speakerId;
    if (currentCgId) return;
    dialogPortraitEl.style.display = "block";
    dialogPortraitPlaceholderEl.style.display = "none";
  };
  // 先試響應式 WebP 版本，找不到（還沒跑 assets:webp，或這個角色本來
  // 就沒有 WebP 版本）就自動退回原始 PNG，兩層都找不到才是真的沒圖。
  const loadOriginalPng = () => {
    const pngImg = new Image();
    pngImg.onload = () => applyPortrait(pngImg.src);
    pngImg.onerror = () => {
      if (currentPortraitId !== speakerId) return;
      dialogPortraitEl.style.display = "none"; // 圖檔不存在時維持空白，不打斷對話
    };
    pngImg.src = `/assets/portraits/${speakerId}.png`;
  };
  const webpImg = new Image();
  webpImg.onload = () => applyPortrait(webpImg.src);
  webpImg.onerror = loadOriginalPng;
  webpImg.src = responsiveWebpUrl(
    "/assets/portraits",
    speakerId,
    PORTRAIT_RESPONSIVE_WIDTHS,
  );
}
export function setDialogCg(cgId) {
  if (cgId === currentCgId) return; // 沒變化，不用重新觸發淡入淡出
  if (!cgId) {
    currentCgId = null;
    cgOverlayEl.style.opacity = "0";
    // 差分轉換途中被硬清掉(例如玩家直接跳過對話)的邊界情況：cgImgNext
    // 可能還停在淡入一半，這裡順便歸零，下次重新進 CG 才不會一開場
    // 就疊著一張沒歸零的殘影。
    cgImgNextEl.style.opacity = "0";
    setTimeout(() => {
      if (!currentCgId) cgOverlayEl.style.display = "none";
    }, 500);
    return;
  }
  // 原本有值(不是第一次進 CG)、只是換成同一場戲的另一張差分，跟「從
  // 3D 畫面/黑幕第一次進 CG」是兩種不同的演出：後者靠 cgOverlay 整層
  // 從 0 淡入即可(黑幕→CG，本來就該有這段黑)；前者 overlay 早就是
  // opacity:1 了，如果還是直接改 cgImgEl.src 會像切照片一樣硬切，也
  // 不會黑屏但很生硬。改成疊 cgImgNext 從透明淡入蓋上去，讓新舊兩張
  // 圖有半秒重疊淡入淡出，才是一般差分轉換該有的樣子。
  const isDifferentialSwap = Boolean(currentCgId);
  currentCgId = cgId;
  const applyCg = (src: string) => {
    if (currentCgId !== cgId) return; // 載入期間對話已經跳到別行，放棄套用
    if (isDifferentialSwap) {
      cgImgNextEl.src = src;
      cgOverlayEl.style.display = "block";
      requestAnimationFrame(() => {
        cgImgNextEl.style.opacity = "1";
      });
      window.setTimeout(() => {
        // 上面這段淡入跑完了，把新圖「扶正」成 cgImg 本體、cgImgNext
        // 歸零準備下一次差分。中途又被切到別張圖(currentCgId 已經不是
        // 這次的 cgId)就不要蓋回去，讓新的那輪自己收尾就好。
        if (currentCgId !== cgId) return;
        cgImgEl.src = src;
        cgImgEl.style.opacity = "1";
        cgImgNextEl.style.opacity = "0";
      }, 520);
      return;
    }
    cgImgEl.src = src;
    cgImgEl.style.opacity = "1";
    cgOverlayEl.style.display = "block";
    requestAnimationFrame(() => {
      cgOverlayEl.style.opacity = "1";
    });
  };
  // 同一套「WebP 優先，找不到退回原始 PNG」邏輯，見上面 setDialogPortrait。
  const loadOriginalPng = () => {
    const pngImg = new Image();
    pngImg.onload = () => applyCg(pngImg.src);
    pngImg.onerror = () => {
      console.warn(`[CG] 找不到 CG 圖檔，維持原本畫面：${cgId}`);
      if (currentCgId === cgId) currentCgId = null;
    };
    pngImg.src = `/assets/cg/${cgId}.png`;
  };
  const webpImg = new Image();
  webpImg.onload = () => applyCg(webpImg.src);
  webpImg.onerror = loadOriginalPng;
  webpImg.src = responsiveWebpUrl("/assets/cg", cgId, CG_RESPONSIVE_WIDTHS);
}
// 對話行可以是純字串(沿用舊格式，沒有立繪/名牌)，也可以是
// {text, speaker?, name?, cg?} 物件——speaker 對應立繪檔名，name 是
// 名牌顯示文字(不填就查 npcs 裡對應 id 的 name)，cg 觸發全螢幕 CG。
/** 無 NPC 發話者的系統提示：保留系統名牌，但永遠不載入角色立繪。 */
export function systemDialog(text: string) {
  return {
    text,
    dialogueType: "system" as const,
    name: "系統",
    hidePortrait: true,
  };
}
export function normalizeDialogLine(line) {
  return typeof line === "string" ? { text: line } : line;
}
export function renderDialogLine(line) {
  clearComicCueAdvanceTimer();
  const hideDialogText = !shouldDisplayDialogText(line);
  showComicCue(line.comicCue || null);
  if (hideDialogText) {
    dialogTextEl.textContent = "";
    dialogNameEl.textContent = "";
    dialogNameEl.style.display = "none";
    setDialogPortrait(null);
    setDialogCg(null);
    comicCueAdvanceTimer = window.setTimeout(() => {
      const isCurrentLine =
        dialogQueue.length > 0 && dialogQueue[dialogIndex] === line;
      if (isCurrentLine) {
        advanceDialogSequence();
        return;
      }
      closeDialogUi();
    }, 1400);
    return;
  }
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
  clearComicCueAdvanceTimer();
  showComicCue(null);
  dialogEl.style.display = "none";
  dialogNameEl.style.display = "none";
  setDialogPortrait(null);
  setDialogCg(null);
  restoreDialogUiVisibility();
}

// ==============================================================
// 對話框「暫時隱藏」——2026-09-05 Zeppelin 反饋：CG 全螢幕時，如果
// 演出主體構圖偏下方，會被 #dialog(固定佔螢幕下方 30vh)擋住看不清楚。
// 加一個貼在對話框右上角的隱藏鍵，玩家可以按一下把對話框(含名牌/
// 立繪/繼續提示/選項面板)整組暫時藏起來看 CG 全貌；藏起來之後「做
// 任何操作」(任一按鍵/點擊)都會自動還原，不用記得再按一次隱藏鍵，
// 也不用做「按住看/放開還」那種容易誤觸的手感。這裡刻意只動 CSS
// 顯示層級(dialogUiPeek class)，完全不碰 dialogQueue/advanceDialogSequence
// 等對話狀態機——單純是「暫時別擋我的臉」，不是關掉對話。真正還原
// 觸發點在 input-save.ts 的全域輸入監聽(捕捉階段跑在最前面，還原時
// 順便吃掉那次輸入，不會同時又被當成「按 E 繼續」處理掉一句對話)。
// ==============================================================
export let dialogUiTemporarilyHidden = false;
function setDialogUiVisualHidden(hidden: boolean) {
  dialogUiTemporarilyHidden = hidden;
  dialogEl.classList.toggle("dialogUiPeek", hidden);
  dialogChoicesEl.classList.toggle("dialogUiPeek", hidden);
}
export function toggleDialogUiPeek() {
  setDialogUiVisualHidden(!dialogUiTemporarilyHidden);
}
// 按鈕本身是 #dialog 的子元素，藏起來的同時自己也會跟著淡出、變得點
// 不到——這是刻意的，後續只能靠「做任何操作」還原(見上面模組註解)，
// 不用另外處理「再點一次按鈕」的還原路徑。stopPropagation 是避免這次
// click 又被 window 上的全域指標監聽(input-save.ts)當成一般點擊處理。
dialogHideToggleEl?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDialogUiPeek();
});
// 回傳有沒有「真的做了還原」，方便呼叫端(input-save.ts)決定要不要把
// 這次輸入吃掉、不再往下傳給「按 E 繼續」之類的一般對話推進邏輯。
export function restoreDialogUiVisibility(): boolean {
  if (!dialogUiTemporarilyHidden) return false;
  setDialogUiVisualHidden(false);
  return true;
}
export function showDialog(text) {
  const wasOpen = !(
    dialogEl.style.display === "none" || !dialogEl.style.display
  );
  if (wasOpen) {
    closeDialogUi();
    return;
  }
  const line = normalizeDialogLine(text);
  renderDialogLine(line);
  if (!shouldDisplayDialogText(line)) {
    dialogEl.style.display = "none";
    return;
  }
  dialogEl.style.display = "flex"; // flex 才吃得到 align-items:center 讓文字上下置中
}
// 多句對話用的小佇列——按 E 一句一句往下推，最後一句再按一次才關掉。
// 單句對話還是用上面的 showDialog()，這個只給需要「一來一往」的場景用
export let dialogQueue = [];
export let dialogIndex = 0;
export let dialogSequenceOnComplete = null;
let comicCueAdvanceTimer = null;

function clearComicCueAdvanceTimer() {
  if (comicCueAdvanceTimer) {
    clearTimeout(comicCueAdvanceTimer);
    comicCueAdvanceTimer = null;
  }
}

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
  // 2026-09-04 修正：如果整段陣列最後收在一句「純舞台指示＋comicCue」
  // （例如只想讓角色頭上冒個驚嘆號、後面沒有接真正要顯示文字的台詞——
  // day2-morning-event.ts 的露比開場戲「[主角轉頭，注意到隔壁站著一個
  // 人]」+"!" 就是這樣單獨一句傳進來），上面迴圈跑完 pendingComicCue
  // 會卡在手上、沒有下一句「真的會進 compacted」的台詞可以承接——原本
  // 直接被吃掉，這個驚嘆號完全不會顯示，dialogQueue 是空的（見下面
  // !dialogQueue.length 分支），onComplete 幾乎當下就被呼叫，Zeppelin
  // 反饋「太早了我沒看到，應該要停頓一下」，根本原因是這個泡泡從頭到
  // 尾沒真正播出來過。這裡補一個安全網：用一句空白文字、只帶
  // comicCue 的合成行接住它——shouldDisplayDialogText() 看到有
  // comicCue 就會自動隱藏文字框、只顯示驚嘆號泡泡，並且套用
  // renderDialogLine() 既有的 1400ms 計時器自動往下推進，正好就是
  // 「顯示一下、停頓、再繼續」的效果，不用另外加等待機制。
  if (pendingComicCue) {
    compacted.push({ text: "", comicCue: pendingComicCue });
  }
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
  if (!shouldDisplayDialogText(dialogQueue[0])) {
    dialogEl.style.display = "none";
    return;
  }
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
  if (!shouldDisplayDialogText(dialogQueue[dialogIndex])) {
    dialogEl.style.display = "none";
    return;
  }
  dialogEl.style.display = "flex";
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
