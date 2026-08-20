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
        currentPortraitId = speakerId;
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
          if (currentPortraitId !== speakerId || currentCgId) return;
          dialogPortraitEl.src = img.src;
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
