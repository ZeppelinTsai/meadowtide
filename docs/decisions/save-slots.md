# 存檔系統：10 格手動存檔 + 每日 06:00 獨立自動存檔

> 從 `AGENTS.md` 搬過來的架構/設計決策，仍然有效。

## 2026-08-26 從單一「default」存檔改成多格

`input-save.ts` 的 `saveGame(slot)`/`loadGame(slot)` 本來就吃參數，只是
過去所有呼叫端都用預設值 `"default"`，等於只有一格。這輪改成 slot 命名
`"slot1".."slot10"`，`SAVE_KEY_PREFIX + slot` 組出 localStorage key
(`meadowtide.save.slot1` 這樣)。

- `migrateLegacyDefaultSave()`：開局第一件事(`title-screen.ts` 的
  `initTitleScreen()` 最前面呼叫)，把舊版 `meadowtide.save.default`
  搬進 `slot1`、刪掉舊 key，只搬一次(`slot1` 已經有資料就不會覆蓋)。
- `getSaveSlotSummaries()`：回傳 autosave 與 10 格手動存檔各自有沒有資料
  及簡短摘要(第幾天/季節/地圖)，給共用讀取清單使用。
- `getActiveSaveSlot()`/`setActiveSaveSlot()`：「目前在玩哪一格」，開新
  遊戲固定設 1(還沒有開局選格數的介面)、讀取某一格時設成該格號、
  Shift+數字手動存檔時也會更新。autosave 會記錄這個來源格號，但不覆寫它。

## 熱鍵：Shift+1~9／Shift+0 存，1~9／0 讀

`input-save.ts` 有一個獨立的 `keydown` 監聽只認
`event.code`(`"Digit0".."Digit9"`)，不是 `event.key`——按 Shift 時
`.key` 在美式鍵盤會變成 `"!"`/`"@"` 這種符號，用 `code` 才不受 Shift/
鍵盤配置影響。`src/save-slot-config.ts` 是格數與數字列映射的單一資料源：
`Digit0` 對應第 10 格，`Digit1`～`Digit9` 維持同號格。修改格數或快捷鍵後
必須執行 `npm run test:save-slots`，再執行 `npm run build`。

跟「二選一提示」的數字鍵選項共用同一批物理鍵位，靠
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
接管的那種狀態)，旗標留著，過場結束後下一幀補存。資料寫入獨立的
`meadowtide.save.autosave`，不覆寫手動 slot；存檔內容同時記錄
`activeSaveSlot`，從 autosave 載入後能恢復來源手動格。

放在 `gameState` 上而不是用回呼/回傳值傳遞，是因為時間推進有兩個呼叫點
(每幀正常前進、`game-clock.ts` 自己的 N 鍵快轉監聽)，用共用旗標才不會
漏接快轉那條路徑觸發的自動存檔。

## 2026-08-27 共用縱向讀取清單

`save-slot-ui.ts` 的 `renderSaveSlotButtons()` 是開始畫面與遊戲中暫停
選單唯一的讀取清單渲染來源。順序固定為最上方 autosave，接著 slot1～slot10；
使用同一套單欄、可捲動 UI 與摘要格式，不得在兩個畫面各自建立另一套
slot markup 或 CSS。清單必須顯示高對比且穩定佔位的垂直捲軸；標題、暫停、
資訊或地圖選單開啟時，滑鼠滾輪由 UI 接管，不得穿透觸發世界鏡頭 zoom。
標題主選單與讀檔清單可直接用 `1`～`9`／`0` 讀取第 1～10 格，必須共用
`saveSlotForDigitCode()` 與 `loadFromSlot()`；空白格不執行，自動存檔仍由清單選取。

`prologue.ts` 的存檔存在判斷也包含 autosave。即使玩家沒有建立手動存檔，
只要 06:00 autosave 存在，標題畫面仍會顯示「繼續遊戲」。

## 序章檢查點（存檔版本 15，2026-09-01）

- 手動快速存檔必須先通過 `canQuickSaveDuringPrologue()`；序章只有進入 `seekingRod`（前往港口找釣竿的自由同行階段）後可存，更早階段直接擋下。一般遊戲與已完成序章不受影響。
- 存檔的 `prologue.checkpoint` 只保存可安全還原的 `seekingRod`。讀檔時須在 `loadMap()` 前呼叫 `restorePrologueSaveState()`，恢復村長同行、港口事件觸發與序章時間鎖；不可只還原玩家座標。
- 舊版存檔缺少此欄位時不猜測序章進度，避免把播種或過場中的存檔誤判成自由同行。

## 玩家資料（存檔版本 6，2026-08-28）

- `playerProfile.name`：序章前輸入的牧場主姓名，去除首尾空白後最多 16 字元。
- `playerProfile.appearance`：`male` 或 `female`，建立玩家 Mesh 與讀檔時皆生效。
- 舊存檔沒有 `playerProfile` 時，預設名稱為「牧場主」、外型為 `female`，
  保持加入選擇功能前的既有外觀。
- 讀取另一格、即使仍在同一張地圖，也必須呼叫 `syncPlayerAppearance()`
  替換 Mesh；只在 `loadMap()` 建場景時判定會讓同地圖讀檔沿用錯誤外型。
- `src/player-mesh-lifecycle.ts` 是主角 Mesh 清場的單一入口。讀檔／換圖時
  `syncPlayerAppearance()` 必須保留目前 `gameState.player`，並移除 scene 中其餘
  玩家標記 Mesh；標題展示臨時主角離場時也必須從 scene 移除，不能只改指標。
  修改後執行 `npm run test:save-slots` 與 `npm run build`。

## 尚未做的事

- 開新遊戲目前固定寫進第 1 格，還沒有「開局先選要存去哪一格」的介面。
- 2026-08-26 補：遊戲中 Esc/手把 Start 鍵的暫停選單(`pause-menu.ts`)
  已經做了，「讀取進度」直接共用同一份 `getSaveSlotSummaries()`/
  `renderSaveSlotButtons()`(抽到 `save-slot-ui.ts`，`title-screen.ts`
  跟 `pause-menu.ts` 都呼叫這份，不重寫)，見
  `docs/decisions/pause-menu.md`。

## Save format v12
Save v12 adds inventory.pearls and oysterRackSlots. Missing pearl counts safely default to zero, and old saves default to one oyster rack. It retains the v11 animal interaction and legacy-tool migration behavior.\n\n## Save format v13\nSave v13 adds inventory.storage, keyed by the same permanent item ids used by the backpack. Old saves start with an empty warehouse; invalid, fractional, zero, and negative stored quantities are discarded during load.

## Save format v14

Save v14 adds `lastGiftDay` to each existing relationship record. Legacy saves default every NPC to `-1`, meaning no gift has been given today. Relationship data remains the single save source for affection, daily conversation, and daily gifting.
