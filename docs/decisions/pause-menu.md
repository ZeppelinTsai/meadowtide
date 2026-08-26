# 遊戲中 Esc 暫停選單：src/pause-menu.ts

> 從 `AGENTS.md` 搬過來的架構/設計決策，仍然有效。

## 2026-08-26 新增，照抄 title-screen.ts 的架構

Zeppelin 原本說之後要在 Esc/手把預設位置加隨時選單，後來直接說「參照
主選單或背包做好」，所以這次一次做完，沒有分兩輪。架構上直接照抄
`title-screen.ts` 的 `data-step` 切換那套(這裡是 `menu`/`loadSlots`/
`system` 三步)，按鈕沿用同一份 `.titleMenuBtn`/`.titleSlotBtn` CSS，
讀存檔清單的渲染邏輯抽成共用模組 `save-slot-ui.ts`(`renderSaveSlotButtons()`)，
`title-screen.ts` 的「讀取遊戲」跟這裡的「讀取進度」都呼叫同一份，不重寫。

四個選項：返回畫面(關閉選單)／讀取進度(9 格清單，見
`docs/decisions/save-slots.md`)／系統(目前只有音樂靜音切換，跟標題畫面
系統子畫面同款)／結束遊戲(跟標題畫面同一套 `window.close()` + 收尾訊息
的保底寫法)。

## 暫停/擋移動：完全交給 time-pause.ts 既有機制，沒有另外寫

`#pauseMenu` 開啟時設 `data-game-menu="open"`，跟 `#inventoryOverlay`
是同一個既有慣例——`time-pause.ts` 的 `syncAutomaticPauseSources()`
本來就會用 `document.querySelector('[data-game-menu="open"]')` 自動偵測
「有沒有選單開著」，偵測到就讓 `isGameplayPaused()`/`isWorldTimePaused()`
回傳 true，`game-loop.ts` 的 `dt` 自動變 0，WASD 移動也跟著不會動。這裡
完全沒有自己寫暫停/擋移動的邏輯，純粹是掛對 `data-game-menu` 屬性。

## Esc 鍵的分層行為

`pause-menu.ts` 自己掛一個 `keydown` 監聽只認 `Escape`：

- 標題畫面階段(`gameState.player` 還不存在)、過場演出中
  (`gameState.cutsceneActive`)、對話或二選一進行中
  (`dialogQueue.length`/`activeChoice`)——都直接不處理，不開選單。
- 背包開著時：Esc 當背包的關閉鍵(呼叫 `setInventoryOpen(false)`)，不會
  在背包上面又疊一層暫停選單。跟原本只能按 Q 關閉背包比起來，多一個
  更符合直覺的關閉方式，兩者不衝突。
- 選單關著：Esc 開選單，固定回到 `menu` 這一步(不管上次關閉前在哪個
  子畫面)。
- 選單開著、目前在 `loadSlots`/`system` 子畫面：Esc 先退回 `menu`
  這一步，不是直接整個關掉——跟子畫面裡的「返回」按鈕邏輯一致，多一層
  才不會不小心連按兩次 Esc 就把選單整個關掉、回到遊戲。
- 選單開著、目前在 `menu` 這一步：Esc 才真的關閉選單、回到遊戲。

## 讀取進度：跟標題畫面「讀取遊戲」的差異

`title-screen.ts` 的 `loadFromSlot()` 是從「還沒有任何地圖/玩家」的狀態
開始，得先 `buildMap("livingArea")`+`loadMap("livingArea", undefined)`
打地基，再等 `loadMap()` 內部的 400ms 淡出銜接 500ms 後才呼叫
`loadGame()`(見 `docs/decisions/save-slots.md`)。這裡(`pause-menu.ts`
的 `loadFromSlotInGame()`)已經在遊戲裡、地圖跟 `gameState.player` 本來
就存在，不需要這段打地基流程——`loadGame()` 自己遇到存檔地圖跟目前不同
時，內部就會呼叫 `loadMap()` 處理過場淡出；同一張地圖則直接原地搬玩家
座標，沒有額外的淡出動畫(跟原本 F9 讀檔的行為一致，這裡沒有另外加)。

## 手把開啟：Start 鍵合成 Escape 事件

`gamepad-input.ts` 整個模組的做法是把搖桿狀態轉成合成的鍵盤事件直接丟
給既有的全域 `keydown`/`keyup` 監聽(見該檔案開頭註解)，所以手把要開這
個選單，不用另外幫它寫一套開關邏輯——`pollGamepad()` 讀標準映射
`buttons[9]`(Start/Menu 鍵)，邊緣觸發合成一次 `Escape` 鍵盤事件，直接
命中上面那個 `keydown` 監聽，跟真的按鍵盤 Esc 完全同一條路徑。

## 尚未做的事

- 「系統」子畫面目前只有音樂靜音，跟標題畫面一樣沒有音量滑桿/語言切換
  這些，等 Zeppelin 想好再一起加(兩邊共用同一個系統子畫面邏輯的話，
  之後也可以考慮抽出來共用，這輪先各自維持一份，畢竟目前內容只有一顆
  按鈕，抽共用的效益還不明顯)。
