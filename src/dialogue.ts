import { npcs } from "./npc-runtime";
import { gameState } from "./game-state";

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
      export const cgImgEl = document.getElementById(
        "cgImg",
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
        dialogTextEl.textContent = line.text;
        setDialogCg(line.cg || null);
        setDialogPortrait(line.speaker || null);
        if (line.name || line.speaker) {
          const npc = npcs.find((n) => n.id === line.speaker);
          dialogNameEl.textContent = line.name || (npc && npc.name) || line.speaker;
          dialogNameEl.style.display = "block";
        } else {
          dialogNameEl.style.display = "none";
        }
      }
      export function closeDialogUi() {
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
        dialogQueue = lines.map(normalizeDialogLine);
        dialogIndex = 0;
        dialogSequenceOnComplete = onComplete;
        renderDialogLine(dialogQueue[0]);
        dialogEl.style.display = "flex"; // flex 才吃得到 align-items:center 讓文字上下置中
      }
      export function advanceDialogSequence() {
        dialogIndex++;
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
      // ==============================================================
      export const dialogChoicesEl = document.getElementById("dialogChoices");
      export const dialogContinueEl = document.getElementById("dialogContinue");
      export let activeChoice: {
        options: { label: string; value: any }[];
        onSelect: (value: any) => void;
      } | null = null;

      export function showChoice(text, options, onSelect) {
        renderDialogLine(normalizeDialogLine(text));
        dialogEl.style.display = "flex";
        if (dialogContinueEl) dialogContinueEl.style.display = "none";
        activeChoice = { options, onSelect };
        dialogChoicesEl.innerHTML = "";
        options.forEach((opt, i) => {
          const btn = document.createElement("button");
          btn.className = "dialogChoiceBtn";
          btn.textContent = `${i + 1}. ${opt.label}`;
          btn.onclick = () => resolveChoice(opt.value);
          dialogChoicesEl.appendChild(btn);
        });
        dialogChoicesEl.style.display = "flex";
      }

      export function resolveChoice(value) {
        if (!activeChoice) return;
        const { onSelect } = activeChoice;
        activeChoice = null;
        dialogChoicesEl.style.display = "none";
        if (dialogContinueEl) dialogContinueEl.style.display = "";
        closeDialogUi();
        onSelect(value);
      }

      // 數字鍵 1~9 對應目前選項清單索引，鍵盤事件統一集中在
      // input-save.ts 處理(既有慣例)，這裡只暴露一個純函式讓它呼叫；
      // 回傳有沒有真的吃掉這個按鍵，方便呼叫端決定要不要 preventDefault。
      export function handleChoiceDigitKey(key: string): boolean {
        if (!activeChoice) return false;
        const index = Number(key) - 1;
        const opt = activeChoice.options[index];
        if (!opt) return false;
        resolveChoice(opt.value);
        return true;
      }
