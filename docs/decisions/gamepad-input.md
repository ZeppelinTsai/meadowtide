# 搖桿輸入與震動：src/gamepad-input.ts、src/gamepad-haptics.ts

## 統一按鈕語意

標準映射以 A 確認／互動、B 返回／取消、X 次要操作／收成、Y 資訊選單、
Start 暫停、R3 切換視角、LB／RB 切換分頁、LT／RT 縮放鏡頭。UI 開啟時
左搖桿與方向鍵只負責焦點導覽，聚焦滑桿時左右方向改為調整數值。

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。兩節都標註「未經實機測試」——這個環境沒有搖桿裝置，實機驗證結果請直接更新這份文件。


一開始只做了震動輸出（見下一節），Zeppelin 拿 Xbox 360 手把實測時發現
「按了沒反應」——因為當時搖桿完全沒有接進輸入端，只有 QTE 判定會主動
去查震動，搖桿本身不會讓角色動或觸發任何互動。這節補的是輸入端。

**做法是把搖桿狀態轉成合成鍵盤事件**（`window.dispatchEvent(new
KeyboardEvent(...))`），直接餵給 `input-save.ts` 既有的全域
`keydown`/`keyup` 監聽——`keys[e.key]=true/false` 那兩行、E 鍵那個大型
`keydown` handler、拉扯期(reeling)方向判定的專屬 `keydown` 監聽，全部
原封不動繼承，**沒有另外寫一套平行的搖桿專用移動/互動邏輯**，也完全
沒改 `game-loop.ts` 的移動計算或 `input-save.ts` 的任何互動分支。好處
是搖桿在系統眼裡就是「一個在按鍵盤的玩家」：WASD 八方向移動、E 鍵所有
分支（對話/座位/採集/釣魚拋竿收竿…）、釣魚 QTE 拉扯期的方向判定，全部
自動可以用搖桿操作，包括這次一起追加的「casting 按 E 取消」也是。

- 左搖桿(axes 0/1，死區 0.35)優先，沒推搖桿才看 d-pad(buttons 12–15,
  標準映射 上/下/左/右)。**只有按下/沒按下兩態**，跟鍵盤語意一致——
  不支援類比半速移動，這是刻意簡化，不是偵測不到類比值。
- A 鍵(`buttons[0]`)對應鍵盤 E。
- 四個方向鍵 + E 各自追蹤上一幀是否按著，只在跨越邊界時才丟合成事件
  (邊緣觸發)，不是每幀都丟——尤其 E 鍵，每幀重複丟 keydown 會被
  `gameState.ePressed` 的防重複邏輯擋掉，語意上也該是「按下/放開那一刻」
  各觸發一次，跟真的按著鍵盤不放一樣。
- `game-loop.ts` 的 `animate()` 每幀呼叫一次 `pollGamepad()`，不用另外
  開輪詢或監聽 `gamepadconnected`——反正每幀都在讀，搖桿插上/斷開自然
  在下一幀生效或停止。
- **只支援單一搖桿**（讀 `navigator.getGamepads()` 第一個 `connected`
  的），多人本地共玩不在這次範圍內。
- 環境限制跟震動那節一樣：搖桿要先被按過一次鍵才會出現在
  `getGamepads()` 清單裡，純插著線沒按過鍵偵測不到，這不是 bug。
- **這輪同樣沒有實機驗證**（環境裡沒有搖桿裝置），只過了 `tsc` 型別
  檢查。麻煩實測：(a) 左搖桿/d-pad 能不能正常八方向移動、(b) A 鍵能不能
  觸發所有 E 鍵分支(對話/座位/採集/釣魚/牡蠣架/投餵機…)、(c) 拉扯期用
  搖桿方向判定準不準(死區 0.35 是否需要調整)、(d) 鍵盤/搖桿交替使用會
  不會互相打架(理論上不會，因為兩者最終都只是寫同一份 `keys` map)。

## 搖桿震動：`src/gamepad-haptics.ts`（2026-08-26 已實作，**未經實機測試**）

包一層 Web Gamepad API 的 `GamepadHapticActuator`，純瀏覽器 API 封裝，
零 THREE/DOM 依賴，跟 `sfx.ts`「零 import 葉節點模組」同一個理由——之後
其他系統要用震動直接 `import { vibrateGamepad, FISHING_HAPTICS }`，不用
重寫偵測邏輯。目前唯一呼叫方是釣魚 QTE（`input-save.ts` 拉扯期的四個
判定點：逐幀超時 `advanceFishingQte()`、按鍵即時判定 keydown 監聽、斷線
失敗分支、`resolveFishCatch()` 收穫分支）。

**這輪實作完全沒有搖桿裝置可以驗證**，純照 spec 寫，寫的時候要注意：

- 優先用新版 `vibrationActuator.playEffect("dual-rumble", …)`
  （Chrome/Edge 支援），沒有的話退而求其次用舊版
  `hapticActuators[0].pulse(…)`。**Firefox 目前完全不支援這塊 API**——
  如果開發時用 Firefox 預覽，搖桿方向鍵能動但震動永遠沒反應，不代表
  程式碼有問題，換 Chrome/Edge 測。
- 瀏覽器安全限制：搖桿要先被使用者**按過一次任意鍵**，才會出現在
  `navigator.getGamepads()` 清單裡——單純插著線、完全沒按過鍵的搖桿，
  `firstConnectedGamepad()` 會偵測不到，這不是 bug。
- 找不到搖桿、瀏覽器不支援都靜默跳過（不噴錯），呼叫端完全不用檢查
  環境。
- 八種強度（`FISHING_HAPTICS`，完美/成功/方向錯誤/沒按超時/暴衝正確
  放線/暴衝誤觸/收穫成功/斷線失敗）純憑感覺草擬數值，還沒有人拿真的
  搖桿測過手感，之後實測回報「哪幾種感覺不出差異/太弱/太吵」再回來調
  這個檔案的 `FISHING_HAPTICS` 物件即可，呼叫端完全不用動。
