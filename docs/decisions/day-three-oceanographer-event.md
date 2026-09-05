# 第三天下午海洋學家事件

## 排程

- 玩家顯示的第三天（內部 `currentDay === 2`）14:00 起可觸發。
- 必須先完成植物學家事件；正常流程中植物學家事件於 10:00 開始並在 12:00 結束。
- 14:00–16:00 之間直接觸發；若快轉跨過窗口，`game-clock.ts` 會留下 `oceanographerEvent.due`，待對話或過場空檔再補觸發。
- 完成後把當日時間固定到 16:00，不更改日期。
- 開始與完成分別以 `lockEventClock()` 固定寫入第 3 天 14:00／16:00，
  不依賴事件期間的 `currentDay` 反推日期。

## 流程與狀態

`src/oceanographer-event.ts` 負責牧場拜訪、海岸觀察、牡蠣架設置與收尾。事件進行中使用獨立的 `oceanographerEvent` 暫停來源，避免與其他事件互相覆寫。

`oceanographerQuest.stage` 為 `not_started | intro | complete`。演出中途存檔再讀取時，`intro` 退回 `not_started`，避免在缺少 callback 的狀態下卡住；角色的暫時站位不進入日常排程。

## 牡蠣養殖解鎖

牡蠣架座標以 `LAYOUT.oysterFarm` 為唯一資料源。新遊戲的 `gameState.oysterFarmingUnlocked` 為 `false`，因此架子不建模、也不能互動。架設演出呼叫 `unlockOysterFarming()`，再於黑幕期間重建生活區，讓設備正式進入世界。

存檔 v17 保存事件進度、due 與解鎖旗標。事件完成本身也會推導為已解鎖，避免旗標與劇情狀態不一致。

## 視覺素材

架設段預留 CG id `day3Oceanographer-01`，對應 `public/assets/cg/day3Oceanographer-01.png`。圖片缺少時沿用對話系統既有容錯，只警告、不阻斷事件。