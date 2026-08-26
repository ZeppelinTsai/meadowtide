# 二選一提示 UI：showChoice()

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。


- `src/dialogue.ts` 的 `showChoice(text, options, onSelect)` 是給「玩家要在
  文字提示下做一個真的有分支的決定」用的通用小工具，第一個用例是鐘乳石
  洞窟上樓梯「要不要直接回鎮上」的提示（`build-map.ts` 的 `mineGoUp()`）。
  之後任何場景需要 Yes/No 或多選提示，直接呼叫這個，不要另外發明
  `window.confirm()` 或新的彈窗——原本上樓梯是用瀏覽器原生 `confirm()`
  頂著用，玩家反饋這是「導入選項 UI 的時機」才換成這套。
- 跟連續對話（`showDialogSequence`/`dialogQueue`）共用同一個 `#dialog` 框、
  同一套文字渲染（`renderDialogLine`），但底下換成一排選項按鈕，取代
  「按 E 繼續」的提示。故意**不**塞進 `dialogQueue`——E 鍵在
  `input-save.ts` 看到 `dialogQueue.length` 就會直接呼叫
  `advanceDialogSequence()`，那是「純文字往下推」的語意，跟「做決定」不
  一樣，混在一起容易誤觸。選項提示用獨立狀態 `activeChoice`，E 鍵在
  `activeChoice` 有值時整個略過（見 `input-save.ts` 的 E 鍵處理最前面那個
  `if (activeChoice) return;`），玩家只能用數字鍵/滑鼠點擊選項按鈕來決
  定，選完呼叫 `onSelect(value)`、收掉對話框。
- `options` 是 `{ label, value }` 陣列，`value` 可以是任意型別（目前用字串
  常數，例如 `"town"`/`"step"`/`"stay"`），`onSelect` 收到選到的那個
  `value` 自行 `switch`/`if` 分支，不用侷限在二選一——呼叫端可以塞任意
  多個選項，分頁是 UI 層自己處理的，呼叫 `showChoice()` 的人不用管。
- **視覺／版位（2026-08-25 改版，仿 FGO 選項條）**：選項不再塞在 `#dialog`
  內部右下角，改成 `#dialogChoices` 獨立浮在對話框**正上方**的一組寬版
  堆疊圓角長條（`.dialogChoiceBtn`），DOM 上是 `#dialog` 的 sibling 而不是
  子元素（`#dialog` 有 `transform`，會讓內部 `position:fixed` 子元素的定位
  基準變成 `#dialog` 的 box 而不是 viewport，所以搬出來單獨放在
  `index.html`）。垂直位置**不是**寫死的 CSS 數值，是 `dialogue.ts` 內部的
  `positionChoicePanel()` 每次渲染時讀 `#dialog` 當下實際的
  `getBoundingClientRect()` 高度即時算出來、寫進 inline `style.bottom`，
  所以不管提示文字長短、名牌/立繪有沒有一起跳出來，選項面板永遠貼齊
  對話框上緣——這就是「自適應」，不是靠 media query。樣式沿用同一組
  金色邊框＋深色半透明底，維持既有視覺語言，只是形狀從小按鈕換成大
  圓角長條。
- **分頁（最多同時顯示 3 個）**：`CHOICE_PAGE_SIZE = 3`。選項超過 3 個時，
  `showChoice()` 只畫出目前這一頁（`activeChoice.page`，初始 0）對應的最多
  3 顆按鈕，下面再補一條較小的「換下一頁 (第幾頁/共幾頁) ▸」列
  （`.dialogChoiceNextBtn`）。點那條列或按 **Tab** 鍵（`input-save.ts` 監
  聽）會呼叫 `advanceChoicePage()` 循環翻到下一頁，翻到最後一頁再翻會繞
  回第一頁。數字鍵 1/2/3（`handleChoiceDigitKey()`）對應的是**目前這一
  頁**看得到的選項，不是 `options` 陣列的絕對索引——換頁後 1/2/3 的意義
  會跟著變。呼叫端完全不用管分頁，`options` 傳超過 3 個一樣直接丟給
  `showChoice()` 就好。
- 顯示中的選項提示會讓 `#dialog` 保持可見，`isGameTimePaused()`（見
  `game-clock.ts`）因此自動連帶凍結玩家移動與遊戲時間，不用額外處理。
- 這套機制刻意做成跟「上樓梯是哪個角落／哪個造型」無關的通用層——之後
  如果要做另一個「往上爬」的洞窟/塔，一樣直接呼叫 `showChoice()`，不用
  重寫互動、鍵盤處理或分頁邏輯，只要在對應的樓層轉換函式裡换一套
  `options`/`onSelect` 邏輯即可，選項超過 3 個時分頁會自動生效。


