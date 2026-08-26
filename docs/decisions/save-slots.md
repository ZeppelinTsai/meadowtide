# 存檔系統：9 格 + 每日 06:00 自動存檔

> 從 `AGENTS.md` 搬過來的架構/設計決策，仍然有效。

## 2026-08-26 從單一「default」存檔改成 9 格

`input-save.ts` 的 `saveGame(slot)`/`loadGame(slot)` 本來就吃參數，只是
過去所有呼叫端都用預設值 `"default"`，等於只有一格。這輪改成 slot 命名
`"slot1".."slot9"`，`SAVE_KEY_PREFIX + slot` 組出 localStorage key
(`meadowtide.save.slot1` 這樣)。

- `migrateLegacyDefaultSave()`：開局第一件事(`title-screen.ts` 的
  `initTitleScreen()` 最前面呼叫)，把舊版 `meadowtide.save.default`
  搬進 `slot1`、刪掉舊 key，只搬一次(`slot1` 已經有資料就不會覆蓋)。
- `getSaveSlotSummaries()`：回傳 9 格各自有沒有資料+簡短摘要(第幾天/
  季節/地圖)，給主選單「讀取遊戲」畫面用。
- `getActiveSaveSlot()`/`setActiveSaveSlot()`：「目前在玩哪一格」，開新
  遊戲固定設 1(還沒有開局選格數的介面)、讀取某一格時設成該格號、
  Shift+數字手動存檔時也會更新——每日自動存檔(見下面)存的就是這一格。

## 熱鍵：Shift+1~9 存、1~9 讀

`input-save.ts` 有一個獨立的 `keydown` 監聽只認
`event.code`(`"Digit1".."Digit9"`)，不是 `event.key`——按 Shift 時
`.key` 在美式鍵盤會變成 `"!"`/`"@"` 這種符號，用 `code` 才不受 Shift/
鍵盤配置影響。跟「二選一提示」的數字鍵選項共用同一批物理鍵位，靠
`activeChoice`/`dialogQueue.length`/`isInventoryOpen()`/
`gameState.cutsceneActive` 這幾個既有狀態擋開，對話框開著時數字鍵照舊
只選對話選項。**讀檔沒有二次確認**——這是 Zeppelin 明確要求的行為
(「讀取則直接 1-9」)，不是漏做確認框。

原本的 F6(存)/F9(讀) 已經移除，只保留單一格語意的舊 `"default"`
slot 給 `migrateLegacyDefaultSave()` 讀一次搬家用，新程式碼不應該再
寫這個 key。

## 每日 06:00 自動存檔

`game-clock.ts` 的 `updateGameClock(delta)` 每次推進時間都會檢查「這一幀
跨過的 `elapsed` 區間」有沒有含到任一天的 06:00(用絕對值比較，不是比較
`currentPhase` 前後值——N 鍵快轉一次跳 6 小時，前後值可能剛好跨過又繞
回來，比較 elapsed 才不會漏)，有的話設 `gameState.pendingAutosave = true`。

`game-clock.ts` 不能直接呼叫 `saveGame()`——`input-save.ts` 已經 import
這個檔案的 `updateGameClock()`，反過來 import 會形成循環 import(這個
專案踩過的坑，見 `scene-sky.ts` 開頭那段說明)。改成用
`gameState.pendingAutosave` 這個共用旗標傳遞，真正的 `saveGame()` 呼叫
在 `game-loop.ts` 的 `animate()`，每幀檢查這個旗標，`cutsceneActive`
期間延後(避免存到過場演出中途的暫態，例如船還在外海、玩家位置被演出
接管的那種狀態)，旗標留著，過場結束後下一幀補存。存的格數是
`getActiveSaveSlot()`。

放在 `gameState` 上而不是用回呼/回傳值傳遞，是因為時間推進有兩個呼叫點
(每幀正常前進、`game-clock.ts` 自己的 N 鍵快轉監聽)，用共用旗標才不會
漏接快轉那條路徑觸發的自動存檔。

## 尚未做的事

- 開新遊戲目前固定寫進第 1 格，還沒有「開局先選要存去哪一格」的介面。
- 2026-08-26 補：遊戲中 Esc/手把 Start 鍵的暫停選單(`pause-menu.ts`)
  已經做了，「讀取進度」直接共用同一份 `getSaveSlotSummaries()`/
  `renderSaveSlotButtons()`(抽到 `save-slot-ui.ts`，`title-screen.ts`
  跟 `pause-menu.ts` 都呼叫這份，不重寫)，見
  `docs/decisions/pause-menu.md`。
