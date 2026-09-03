# 第二天早上「村長在家門口等你」事件（試驗版）

> Zeppelin 2026-09-02「試試看」提出的第一版：第二天 08:00 強制觸發，主角
> 傳送到住家門口面朝下、村長固定站在門口再往南一格面朝上、黑幕轉場。這輪
> 目的是驗證「日期+時段強制觸發（不用玩家觸碰）＋跨圖傳送＋朝向＋NPC
> 固定站位＋黑幕」這組組合怎麼寫，還沒接對話/後續劇情。

## 為什麼沒有走 `src/story/` 正式事件系統

`docs/decisions/event-system.md` 記錄的正式事件骨架（`StoryEvent`/
`runStoryEvent`/`StoryRuntimeBindings`）目前只有 F9 熱鍵手動觸發的
`dev.phase1_probe.mayor_wave` 一個測試案例接上真正的畫面，全專案**沒有
任何地方會自動依日期/時段條件輪詢觸發事件**——`StoryCondition` 雖然有
`day`/`phase` 型別，但目前唯一「日期+時段強制觸發」的真實案例
（`carpenter-quest.ts` 的 `canStartCarpenterDockScene()`）本身是手刻的，
不是走正式系統，而且那個是**觸碰式**（玩家要走到碼頭才觸發），不是強制
傳送。

這次需要的「不管玩家在哪、時間到了強制傳送」在正式系統裡缺兩塊：
1. 沒有背景輪詢機制——要嘛我自己寫一個「每幀檢查 day/phase 是否吻合就呼叫
   `runStoryEvent()`」的迴圈（等於自己重新發明一次觸發判斷，正式系統這塊
   完全沒現成的），跟手刻判斷式（`canStartDayTwoMorningEvent()`）工作量
   幾乎一樣。
2. `positionActor`/`move` 這兩個 step 的 runtime binding **都沒有實作朝向
   （facing）**——`move` 的型別雖然宣告了 `facing?: "up"|"down"|"left"|
   "right"`，但 `story-runtime-browser.ts` 的實際實作完全沒讀這個欄位，
   只寫 x/z。這次「玩家面朝下、村長面朝上」是明確需求，正式系統目前接不
   到，得自己在 runtime 層再補一塊。

再加上 `event-system.md` 自己也記錄「`teleport`/`move` 這幾個 binding
只有型別過關、沒有被任何測試事件真的跑過，之後真的要用要重新驗證」——
與其把驗證風險疊加在這個新場景上，這輪選擇比照 `carpenter-quest.ts` 的
既有手法（`gameState.currentDay`/`currentPhase` 直接判斷、`loadMap()` 跨
圖傳送、`npcs.find()` 找村長直接改 `.mesh.position`/`.rotation.y`），這條
路目前是全專案唯一「真的在跑」的日期+時段事件寫法。

## 這個事件跟木匠碼頭事件的關係——刻意保持獨立

用的日期+時段窗口（`currentDay === 1 && hour ∈ [8, 8.5)`）跟
`canStartCarpenterDockScene()` **完全相同**，這不是巧合——顯然設計意圖上
兩者屬於同一個早上。但這輪刻意讓兩個事件各自獨立觸發、互不干擾：
- `dayTwoMorningEvent.triggered`/`.holding` 是獨立的狀態物件，沒有跟
  `carpenterQuest.stage` 共用或互相設定。
- 沒有修改 `carpenter-quest.ts`／`handleCarpenterDockTouch()` 的任何行為。

要不要把兩者串成一段連續演出（例如「村長來敲門把你叫出門 → 一起走去碼頭
迎接木匠」，取代現行「玩家自己走到碼頭弔凼」的設計）是敘事層的決定，需要
Zeppelin 拍板，這輪不擅自合併。如果之後決定要串起來，銜接點很清楚：在
`startDayTwoMorningEvent()` 的 `loadMap` 回呼結尾（`dayTwoMorningEvent.
holding = true` 那行）之後接對話/走位，對話結束時把 `holding` 設回
`false` 並視需要呼叫（或改寫觸發條件讓）碼頭事件接手。

## 座標怎麼來的——不是新編的數字

主角傳送點 `(21, 17)` 其實就是既有的 `HOUSE_ROAD_X`/`HOUSE_ROAD_START_Z`
（`layout-maps.ts`，主屋門前那條路的公式：`HOUSE_ROAD_X = LAYOUT.house.
doorX`，`HOUSE_ROAD_START_Z = LAYOUT.house.z + LAYOUT.house.d + 1`）算出來
的同一個點，不是巧合，是「家門口」本來就該落在這裡。新增的
`DAY_TWO_MORNING_ARRIVAL`（`layout-maps.ts`，緊接在 `HOUSE_ROAD_*` 那組
後面）直接引用這兩個既有常數，村長站在再往南一格（`z + 1`）：

```ts
export const DAY_TWO_MORNING_ARRIVAL = {
  player: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z },
  mayor: { x: HOUSE_ROAD_X, z: HOUSE_ROAD_START_Z + 1 },
};
```

好處：之後如果搬房子（改 `LAYOUT.house.x`/`z`），這個事件的傳送點跟著
自動更新，不用回頭改寫死的座標——跟 `scripts/audit-raw-coordinates.ts`
的既有規則（座標一律從 `LAYOUT` 推，不要另外寫死）一致。

## 順便補的小工具：`npm run map-debug -- --landmarks`

寫這個事件之前，Zeppelin 提到「需要一個地點座標的 map，寫事件時可以
查找，改地圖也能快速處理座標」。`scripts/map-debug.ts` 本來就有一個
`--landmarks` 旗標，但原本是空的（`"(標記房子/穀倉/NPC等地標，之後可以
擴充這段)"`），這次把它實作出來：遞迴掃描 `LAYOUT`（整個專案座標的唯一
single source of truth），列出所有「有 `x`/`z` 座標的節點」，附帶其他
純量欄位（`width`/`doorX`/`role`…）當備註，不用另外手抄一份會跟著地圖
改動脫鉤的座標清單：

```bash
npm run map-debug -- --landmarks                # 列出全部（目前 103 筆）
npm run map-debug -- --landmarks --filter=house  # 只看路徑包含 "house" 的
```

輸出範例：

```
  house                      (20, 14)      w=3, d=2, doorX=21, ...
  oldVillage.carpenterHouse  (136, 13)     d=3, doorX=137
```

因為是遞迴掃描、不是手寫清單，改了 `LAYOUT` 裡任何數字之後這份清單自動
就是最新的——這正是「改地圖也能快速處理座標」要的效果，不用維護第二份
資料。

## 目前行為（已驗證：`tsc --noEmit`、`test:map-tools`、`test:save-slots`
全過，還沒實際在遊戲裡玩過一次）

1. 第二天（`currentDay === 1`）08:00-08:30 之間，只要沒有對話框開著、沒有
   其他演出鎖住（`cutsceneActive`），下一幀就會強制觸發，不管玩家當下在
   哪張地圖/哪個座標。
2. `loadMap("livingArea", DAY_TWO_MORNING_ARRIVAL.player, ...)`——沿用既有
   換圖函式（`build-map.ts`），內建 `fadeOut()`/`fadeIn()` 黑幕轉場，不用
   另外接 `loading-screen.ts` 或正式系統的 `fade` step。
3. 玩家傳送到 `(21, 17)`，`rotation.y = Math.PI`（面朝下/+Z）。
4. 村長傳送到 `(21, 18)`，`rotation.y = 0`（面朝上/-Z），跟玩家隔一格
   面對面。朝向公式跟全專案一致：`atan2(dx, dz) + π`（模型鼻子朝本地
   -Z，見 `game-loop.ts` NPC 走位那段同一條註解）。
5. `dayTwoMorningEvent.holding = true` 之後，`game-loop.ts` 的 NPC 排程
   迴圈會在村長的日常行程表（`getScheduleTarget`）判斷之前攔截、把她
   釘在門口，不會下一幀就被排程重新接管走掉——這段目前**沒有釋放條件**
   （沒有寫「玩家跟她說話之後恢復正常行程」這類邏輯），是刻意留白，等
   下一輪加對話/後續演出時再決定怎麼釋放。
6. `dayTwoMorningEvent`（`triggered`/`holding`）會存進存檔（跟
   `carpenterQuest` 同一種 `{...obj}` 存法），讀檔時如果 `holding` 為真
   會重新顯示村長，實際站位由 game-loop.ts 每幀校正，不會存檔重讀後
   村長消失或跑掉。

## 還沒做、下一輪如果要繼續要決定的事

- **沒有對話**——目前只有沉默的黑幕轉場+站位，沒有台詞。要加的話比照
  `carpenter-quest.ts` 用 `showDialogSequence()` + `t()` i18n key 即可，
  在 `startDayTwoMorningEvent()` 的 `loadMap` 回呼最後接上。
- **村長會永遠釘在門口**——目前沒有任何邏輯把 `holding` 設回 `false`，
  在下一輪加對話/演出之前，這是預期中的「暫停在這一格」狀態，不是 bug。
- **跟木匠碼頭事件的關係未定**——見上面「刻意保持獨立」那節，是否要合併
  成一段連續演出需要 Zeppelin 拍板。
- **還沒有在瀏覽器裡實際玩過一次**——這台機器沒有能跑 `npm run dev` 再
  操作瀏覽器的環境（跟 `event-system.md` Phase 1 那次遇到的限制一樣），
  邏輯層驗證過（`tsc`/既有測試全過），但「傳送點會不會卡到什麼東西」
  「村長模型面對面站著視覺上順不順」這些需要 Zeppelin 親自進遊戲、調到
  第二天早上 8 點左右看一次。
## 2026-09-02 第二輪：Zeppelin 反饋「避免強制事件被跳過」＋睡覺系統改成「最近」

### 問題：睡覺／N 鍵快轉是瞬間跳時間，可能整段跳過事件窗口

`game-clock.ts` 的 `updateGameClock(delta)` 是單一一次 `gameState.elapsed
+= delta` 的瞬間賦值，沒有逐格動畫；跨日的部分本來就有逐日迴圈
（`beginNewDay()`）保底，但「日內某個時段窗口」（例如本事件的
`day===1 && hour∈[8,8.5)`）沒有對應的保底機制——原本的
`canStartDayTwoMorningEvent()` 只在每幀輪詢「現在是不是剛好落在窗口
內」，如果玩家睡覺一次跳過一大段時間、剛好整個窗口被跳過去（例如在
第二天 06:00～08:00 之間又睡了一次「休息到今天傍晚六點」，一次跳到
18:00），這個事件就會被永久跳過，之後永遠不會再觸發。

同樣的風險理論上也存在於 `carpenter-quest.ts` 的
`canStartCarpenterDockScene()`（同一個 `day===1, hour∈[8,8.5)` 窗
口），但那個是「觸碰式」——要玩家實際走到碼頭觸發點才會判斷，不是
每幀自動判斷，且不是「強制」事件，這輪先不動它，留在下面「還沒做」
清單。

### 修法：比照 `crossedAutosaveMark()` 的絕對 elapsed 區間比較

`game-clock.ts` 本來就有 `crossedAutosaveMark(oldElapsed, newElapsed)`
處理「N 鍵快轉可能跳過每日 06:00 自動存檔點」的同類問題——比較的是
**這次前進所橫跨的絕對 elapsed 區間**有沒有含到目標時間點，而不是
比較 `currentPhase` 前後值（大跳躍時 `currentPhase` 可能繞回同一個
值，比不出來）。這輪新增 `crossedDayTwoMorningWindow(oldElapsed,
newElapsed)`，用一樣的手法比較「這次前進的區間」有沒有含到
`[DAY_TWO_MORNING_WINDOW_START, DAY_TWO_MORNING_WINDOW_END)`（這兩個
常數搬到 `day2-morning-event.ts` 自己身上，用同一顆 `dayLength`
換算，跟窗口定義放在同一個檔案，不用在 `game-clock.ts` 重複定義
`day===1, hour∈[8,8.5)` 這組魔術數字）。

`updateGameClock()` 偵測到跨過窗口、且事件還沒 `triggered` 過，就把
新增的 `dayTwoMorningEvent.due` 旗標設成 `true`——跟既有的
`gameState.pendingAutosave` 是同一種分工：**底層時鐘只負責標記「該
發生了」），真正要不要現在觸發（要避開 `dialogQueue`/`cutsceneActive`
等畫面狀態）留給消費端自己決定**。`day2-morning-event.ts` 的
`canStartDayTwoMorningEvent()` 加一行：`due` 為真時直接放行（不用
再比對現在的 `hour` 是否還落在窗口內，跳躍後很可能已經不在了）；
`startDayTwoMorningEvent()` 觸發時把 `due` 重設回 `false`。

`game-clock.ts` 反過來 `import` `day2-morning-event.ts`——先確認過沒
有循環 import 風險：`day2-morning-event.ts` 自己只 import
`game-state`/`layout-maps`/`npc-runtime`/`build-map`/`scene-sky`/
`dialogue`，這幾個都不會繞回 `game-clock.ts` 或 `input-save.ts`。

### 睡覺選單改成「最近的」六點，不是寫死跳到隔天

`src/input-save.ts` 的床鋪互動（E 鍵）原本兩個選項都是寫死算法：
「早上」永遠是**隔天**六點，「傍晚」永遠是**今天**十八點。問題是半
夜（例如凌晨 2 點）選「睡到隔天早上六點」會整組多跳過快一整天（凌晨
2 點的「今天」六點其實還沒過），不符合直覺，也是 Zeppelin 這輪反饋
的原因。

改法：讀目前的 `hour = gameState.currentPhase * TIME_CONFIG
.gameHoursPerDay`，`morningIsToday = hour < 6`——如果現在還沒到今天
六點，早上選項就睡到**今天**六點；已經過了六點（含白天、晚上）才睡到
**隔天**六點。傍晚選項維持只在 `hour < 18` 時才出現（已經過晚上六點
就沒有意義），一律睡到**今天**十八點——因為只在 `hour < 18` 時才會
出現，「今天」在這個條件下就是最近的一個。兩個選項文字也跟著動態換
成「睡到今天早上六點」/「睡到隔天早上六點」，不再永遠顯示「隔天」。

目標時間點改用 `currentDayStart = Math.floor(gameState.elapsed /
dayLength) * dayLength` 當基準去加時段比例，取代原本直接用
`gameState.elapsed` 往後估算「加 N 小時」的寫法——這樣「六點」永遠是
六點整，不會因為玩家不是剛好在整點按下選單而產生零頭誤差。

這個修改跟上面「避免強制事件被跳過」是同一件事的兩面：改成「最近」
之後單次睡眠跳躍的時間變短了（最多 24 小時，原本半夜睡「隔天六點」
理論上可以跳到將近 30 小時），降低了跳過事件窗口的機率，但不能單靠
「跳躍變短」保證不跳過，所以還是需要上面 `due` 旗標這層真正的保底。

### 序章教學文字同步更新

`src/story/chapters/prologue-script.ts` 的 `house` 段落（村長介紹床
鋪那句）原文是「你可以睡到隔天早上六點，或休息到今天傍晚六點」，跟
新行為不符（不再永遠是「隔天」），改成「系統會依照當下時間，帶你睡
到最近的早上六點，或是休息到今天傍晚六點」，不再寫死「隔天」兩個字。

### 驗證

`npx tsc --noEmit`、`npm run test:map-tools`、`npm run test:save-slots`、
`npm run test:story` 全過（跟第一輪一樣，這台機器沒有能實際跑
`npm run dev` 進遊戲操作的環境，邏輯層驗證過，實際跳一次時間+看選單
文字用不用順眼，還是要 Zeppelin 進遊戲確認一次）。

### 還沒做（沿用上一輪未完成項）

- `carpenter-quest.ts` 的 `canStartCarpenterDockScene()` 仍是原本的
  `hour∈[8,8.5)` 觸碰式窗口，這輪沒有動它——它不是「強制」事件（要玩
  家自己走到碼頭），跟這輪「強制事件被跳過」的問題性質不完全一樣，
  且用同一招（`due` 旗標）去修會牽動 `carpenterQuest.stage` 的狀態機，
  影響面比較大，先留給下一輪視需要再處理。
- 上一輪列的「沒有對話」「村長會永遠釘在門口」「跟木匠碼頭事件的關係
  未定」三項都還沒動。

## 2026-09-02 第三輪：修正「半沉進地板」bug ＋ 完整第二天早上劇本（Phase 1+2：門口→港口迎接歐文／露比）

### Bug：村長固定站位時半沉進地板（已於 `4a67d66` 修好，這裡補記）

上一輪的 holding 分支先把 `position.y` 設成 `characterGroundY()`，再呼叫
`animateWalk()`——但 `animateWalk()` 對「原地不動」的情況會把
`position.y` 整個覆蓋成待機彈跳量（`humanoid.ts` 裡是絕對賦值，不是疊
加），把剛設好的地形高度整個蓋掉，導致村長固定站位時整個人半沉進地
板。改成跟同檔案裡 `isPrologueMayorFollowing`／escort trail 兩段一致的
順序：先 `animateWalk()`，再設 `position.y = characterGroundY()`。這輪
繼續沿用這個修正過的順序，一併寫進下面的通用化版本裡。

### Zeppelin 給了完整第二天劇本，這輪把兩個關鍵方向定案

用 `AskUserQuestion` 問了兩個決定，都選了推薦選項：

1. `dualAxe`（萬用斧）要不要一開始就給玩家？→ **改成不給**，第二天由
   木匠歐文在劇情裡送出。
2. `carpenter-quest.ts` 舊的多天碼頭／建屋流程，跟這份新劇本什麼關
   係？→ **新劇本完全取代舊流程**。

### 整體流程改寫：家門口 → 港口，共用同一套「固定站位」機制

`dayTwoMorningEvent` 從上一輪寫死的「單一 mayor + livingArea」，改成
通用的 `holdMap` / `holdPositions` 表：同一套機制先服務家門口（只有村
長）那場戲，再服務港口（村長＋歐文＋露比三人同時）那場戲，往後
Phase 3 的舊城鎮走路橋段大機率也會用到。`game-loop.ts` 裡對應的
`npcs.forEach` 分支也跟著從「認 mayor+livingArea 這一組寫死條件」改成
「查 `holdPositions[n.id]` 有沒有這個 npc」，站位資料／朝向完全交給呼
叫端（`day2-morning-event.ts`）決定，這裡只負責套用，animateWalk 在前
的順序修正也保留在這個通用版本裡。

新增 `DAY_TWO_PORT_ARRIVAL`（`layout-maps.ts`），沿用既有
`LAYOUT.port.carpenterMeet` 當基準點推算三人站位——跟 Zeppelin 給的座
標 (3,22) 完全對上，沒有另外造一組平行座標，跟 Phase 3 要用到的
`CARPENTER_EVENT_WAIT_POS`（(137,17)，也跟 Zeppelin 給的座標對上）是
同一個查驗方式（`npm run map-debug -- --landmarks --filter=X`）。

港口登島戲結束時（`onPortArrivalSceneComplete`）：`releaseHold()`、
`carpenterQuest.stage = "escorting"`——沿用木匠任務原本就有的狀態機，
不新開一條平行狀態，之後 Phase 3-5 規劃直接從 `escorting` 跳到未來的
`moved_in`，跳過 `village_scene_done`／`construction`／
`ready_for_move_in` 三個中間態，讓既有的 gating code（build-map.ts 的
NPC 站位、npc-runtime.ts 的初始可見性、input-save.ts 的存讀檔還原）都
不用改。

### 意外發現：`artist`（露比）的可見性現在被 `buildMap()` 每次換圖強制關閉

這輪動工期間，Zeppelin 自己同步推進了「Rebuild Ruby model and gate
appearance」，`buildMap()` 現在會在**每次換地圖**時把 `chef`／`artist`
都強制 `mesh.visible = false`（跟 `carpenter` 用
`carpenterQuest.stage` 留例外分支不同，`artist` 完全沒有例外）。

這對目前這輪的 `holdPositions` 機制沒有影響——因為 holding 分支是在
`animate()` 的 `npcs.forEach` 裡逐幀套用，執行順序在 `buildMap()` 之
後，所以港口三人在 holding 期間都能正常蓋回可見。但這是下一輪的地
雷：一旦 `releaseHold()` 之後又觸發 `loadMap()` 換圖（比如 Phase 3 要
進 `oldVillage`），`buildMap()` 會把 `artist` 重新蓋回不可見。Phase 3
的 holding 必須整段涵蓋到玩家真正自由行動之前，中途不能放手，否則露
比會在轉場後憑空消失。

### `dualAxe` 預設值改成 `false`

`game-state.ts` 的靜態預設、`title-screen.ts` 新遊戲重置，兩處都從
`true` 改 `false`，跟 `resetPrologueStartingItems()`（`prologue.ts`，
序章一開始就會把所有工具整組清成 false）的既有行為對齊。這個靜態預
設值原本大部分正常路徑都會被序章蓋掉，只有跳過序章之類的邊界情況才
真的生效，這次改成 false 主要是語意一致，不是修正一個玩家實際會遇到
的 bug。

### `carpenter-quest.ts` 舊流程現況：保留檔案，行為上變成永久 no-op

沒有刪除或修改 `carpenter-quest.ts`；它的碰觸式事件仍掛在
`build-map.ts` 的 events 表上，但新流程一旦把 `carpenterQuest.stage`
推進到 `"escorting"`，舊流程 `canStartCarpenterDockScene()` 的起點條件
（`stage === "not_started"`）就再也不會成立，等於自然停用，不需要額
外拔線。這輪沒有為這點另外寫測試（不在既有測試涵蓋範圍內），如果下
一輪要徹底清理／刪除這個檔案，要記得先確認沒有其他地方引用。

### 這輪完成的範圍（Phase 1 + Phase 2）

- **Phase 1**：家門口強制事件改寫成「村長帶你去港口」四句對話，
  `[村長進入同行狀態]` 之後直接接港口戲（黑幕轉場，不重走已走過的
  路，照 Zeppelin 原話處理）。
- **Phase 2**：港口登島戲，完整還原 Zeppelin 給的歐文／露比對白，含
  `revealNameAfter` 機制揭露露比的名字（一開始顯示 `???`，對話中途
  變成「露比」）、`comicCue` 主角「！」反應。
- Phase 2 結束：`releaseHold()`、`carpenterQuest.stage = "escorting"`，
  接下來的 Phase 3-5（舊城鎮選屋＋領萬用斧＋山區採集教學＋回房修繕
  CG＋好感度 +30）留給下一輪，TODO 註解直接寫在
  `onPortArrivalSceneComplete()` 裡。

### 還沒做、下一輪要處理

- **Phase 3 走路去舊城鎮選屋**：Zeppelin 原話「進入跟隨模式但不能
  動」，需要先確認是要沿用 `isCarpenterEscortActor` 那套 escort-trail
  （跟隨路徑但理論上還能自由走位），還是序章那套 `prologueGuide`／
  `startGuidedWalk` 純自動走路（完全鎖玩家輸入，逐步走到定點）——兩
  套現有機制語意不完全一樣，這輪還沒選定，動工前要先確認。
- **Phase 4 山區採集教學**：木材／石材各 10，需要新的任務進度 HUD
  （`[任務：木材 0/10｜石材 0/10]`）；採集本體機制
  （`harvestGatherNode`／E 鍵／`hasTool("dualAxe")` 判定）已經現成可
  重用，只差 HUD 跟「鎖定地圖時間、只能走到山區」這段移動限制怎麼實
  作還沒設計。
- **Phase 5 回房修繕 CG**：Zeppelin 自己在腳本裡問「目前這一張 看要
  不要複製重新命名 030.png」，CG 資源要不要另存一份還沒決定；結尾
  `addAffection("carpenter", 30, ...)` + 把
  `carpenterQuest.stage` 推進到未來的 `"moved_in"` 也還沒接。
- 這輪只驗證了 `tsc --noEmit` + 三個既有測試套件，沒有到遊戲裡實際跑
  一遍港口戲——請 Zeppelin 進遊戲玩到第二天早上八點檢查一次，尤其對
  話文字、站位朝向、露比名字揭露的時機。

### 驗證

`npx tsc --noEmit`、`npm run test:map-tools`（41 過）、
`npm run test:save-slots`（3 過）、`npm run test:story`（14 過）全
過。這台機器沒有能跑 `npm run dev` 進遊戲操作的環境，實際進遊戲玩一
次門口戲＋港口戲，還是要 Zeppelin 確認一次。

## 2026-09-02 Phase 3–5：選屋、自動走路、山區採集與修繕收尾

- 港口戲結束後黑幕進入 `oldVillage`，借用序章 `startGuidedWalk()` 的純自動走路；
  外部事件模式不鎖序章日期，且兩段演出明確使用 zoom 5。玩家全程不能操作。
- 歐文在「我是歐文」完成後以 `revealNameAfter` 正式揭露姓名；露比同樣在自介後
  揭露。`buildMap()` 只在露比仍為未知身分時隱藏她，避免登場後換圖又消失。
- 選屋後才把 `inventory.tools.dualAxe` 設為 true。前往山區期間只允許舊城鎮
  西北三格山門傳送；進山後暫停世界時間但保留玩家採集操作。
- 採集目標以事件開始時的庫存為基準，要求新增木材 10、石材 10，HUD 字級固定
  18px。完成後自動回選定房屋，播放 `day2Carpenter-01` CG。
- 收尾把木匠好感增加 personalEvent 的 30 點、`carpenterQuest.stage` 設成
  `moved_in`，並以 `rewardGranted` 防止讀檔或重入時重複發獎。
- CG 新檔沿用「事件 id－流水號」：`030.png` 複製為 `day2Carpenter-01.png`，
  並提供 1280/1600 WebP 響應式衍生檔。

## 2026-09-04：修正「港口迎接戲主角陷進地板」bug

Zeppelin 實測回報：第二天切到港口時主角會陷進地面裡。追下去發現這是
「2026-08-26 第六輪反饋」那個 bug 的變種，不是新問題重犯：

`game-loop.ts` 裡 `animateWalk()` 每幀都會把 `gameState.player.position.y`
整個覆寫成走路/待機用的小幅 bob 值（不是疊加），序幕靠
`reapplyProloguePlayerY()` 讀 `prologue.ts` 內部的 `lastPlayerY` 蓋回正
確地形高度來解決；`game-loop.ts` 也照著把「補回地形高度」的
`characterGroundY()` 疊加動作包在 `if (!gameState.cutsceneActive)` 底
下，理由是序幕期間的 Y 完全交給 `reapplyProloguePlayerY()` 決定，不要
被地形疊加拉回海平面/碼頭高度。

問題是這兩段判斷式讀的都是**通用**的 `gameState.cutsceneActive`，不是
「現在是不是真的在跑序幕」——`day2-morning-event.ts` 的港口迎接戲也會
把 `cutsceneActive` 設成 `true`（純粹是想借用同一套「鎖玩家操作、隱藏
UI」機制），但這場戲換圖時從來沒呼叫過 `syncLastPlayerY()`，
`lastPlayerY` 就停在序幕最後一次同步的值（livingArea 平地、接近 0）。
於是港口迎接戲整段：`reapplyProloguePlayerY()` 把主角的 Y 每幀蓋回這個
序幕遺留的舊值，地形疊加又被同一個 `cutsceneActive` 判斷式跳過——主角
被釘在錯誤的高度，港口這裡比 livingArea 高一階（`portGroundY()` 在
`carpenterMeet` 一帶算出來是 `port.elevation = 1`），看起來就是整場戲
都陷進碼頭。

**修法**：沒有動 `game-loop.ts`／`reapplyProloguePlayerY()` 本體（風險
較高、影響全部呼叫點），改成讓 `day2-morning-event.ts` 自己在每次換圖
後補呼叫一次 `syncLastPlayerY()`（`prologue.ts` 把這支函式改成
`export`）：
- `startDayTwoMorningEvent()` 家門口 `loadMap("livingArea", …)` 的
  callback 開頭補一次。
- 這輪其餘所有換圖（港口／舊城鎮／山區／顏料戲）都走同一個本檔案的
  `loadEventMap()` helper，直接在它內部 `loadMap()` 的 callback 補
  （`loadMap` 剛設好新地圖地形高度時同步一次，呼叫端 `onLoaded()`
  跑完後再同步一次，防呼叫端自己又動了玩家座標），涵蓋這輪所有場景，
  以後這個檔案新增場景也不用另外記得加。

之後任何新演出只要會把 `gameState.cutsceneActive` 設成 `true`，換圖
後都要記得呼叫 `syncLastPlayerY()`——這不是序幕專屬的內部細節，
`prologue.ts` 裡該函式上方已經補了對應說明。

驗證：`npx tsc --noEmit`、`npm run test:story`（14 過）、
`npm run test:map-tools`（41 過）、`npm run story-audit`（1 event, OK）
全過。這台機器沒有能跑 `npm run dev` 進遊戲操作的環境，實際進遊戲玩
一次港口迎接戲，還是要 Zeppelin 確認高度看起來對不對。

## 2026-09-04：木匠事件結束後沒有接上藝術家事件——追查中，邏輯本身沒找到問題

Zeppelin 反饋「木匠事件結束後理論要直接接藝術家的事件，但沒有發生」。
追了一遍完整鏈路（`completeDayTwoMorningEvent()` → `artistQuest.stage`
設成 `"waiting_oldVillage"` → `game-loop.ts` 的釘位邏輯把露比放到
`ARTIST_EVENT_WAIT_POS` → `build-map.ts` 觸碰點觸發
`handleArtistWaitTouch()`），每一段程式邏輯單獨看都是對的、也用
`tsc`/現有測試驗證不出矛盾。

跟木匠事件本來就不是「直接接」，是「露比先站定點等，玩家要走近才觸
發」（見上面 2026-09-03 那則記錄），跟 `carpenter-quest.ts` 的
`CARPENTER_DOORSTEP` 是同一招：觸碰點只佔她南邊那一格
（`(142,18)`），玩家要從南側走進來才會踩到，從其他方向靠近不會觸
發——這是全專案這類「站定點等玩家」NPC 共用的既有模式，不是這次新
引入的設計，所以沒有貿然把它加寬。

這輪沒有找到確切的程式邏輯錯誤，需要 Zeppelin 下次測到時幫忙確認兩件
事，才能判斷是哪一段真的壞了：(1) 木匠事件結束後，露比有沒有站在舊城
鎮 `(142,17)` 那個位置（有出現代表狀態機推進正常，問題出在觸碰點；沒
出現代表 `completeDayTwoMorningEvent()`／`artistQuest.stage` 這段本身
沒推進，需要往回查）；(2) 如果她有出現，是從哪個方向走近她的（南側
`(142,18)` 這格才會觸發）。


## 2026-09-04 第二～三輪：三輪回報都「根本沒看到露比」——改成木匠戲結束直接自動接上，不再靠玩家自己找到她

上一則記錄請 Zeppelin 幫忙確認「露比有沒有站在 `(142,17)`」跟「從哪個
方向走近她」，後續兩輪回報是：

1. 「要故意直接觸發 連續的才行，讓主角自己走過去，露比理論上就在隔壁
   棟，應該可以看得到才對」——描述聽起來是有走到，但沒特別確認方向。
2. 「事件結束後根本沒看到露比，但走過去倒是有觸發，應該是直接觸發，
   但是要讓主角自動走過去這樣」——這輪關鍵：**確認了觸碰事件本身有
   正常觸發**，代表 `artistQuest.stage` 有推進到 `waiting_oldVillage`、
   `handleArtistWaitTouch()` 的觸碰判斷也是通的（上一則記錄列的兩個
   待確認項目，等於間接確認都正常）——問題純粹是玩家自己完全沒看到
   她的模型，是被動走到觸發格才碰上的，不是先看到人再走過去。

### 這輪逐行核對過、排除掉的假設

再追了幾個上一輪沒仔細查的角度，全部核對後排除：

- **`makeArtist()` 模型本身**（`src/humanoid.ts`）：整份手動搭建的
  mesh 讀過一遍，材質/geometry/scale 都正常，沒有 opacity=0、scale=0
  這類會讓她「技術上存在但畫面上看不到」的設定。
- **`ARTIST_EVENT_WAIT_POS = {x:142, z:17}` 是不是超出地圖範圍**：一
  開始懷疑座標是不是打錯（`77` 寬的舊城鎮怎麼會有 `x=142`），追進
  `OLD_VILLAGE_OCEAN_EXPANSION`（西擴 `+100` 海面）才發現這個常數本
  來就是「西擴後」的座標，換算回去是 `x=42`——剛好對到木匠家隔壁那
  棟房子（城鎮 `houses[]` 陣列裡 `x:42, z:13` 那間），跟
  `CARPENTER_EVENT_WAIT_POS`（同樣西擴後的 `x=137,z=17`）只差 5 格，
  完全符合「隔壁棟」的敘事，不是打錯數字、也沒有真的跑到地圖外的
  海面上。
- **`game-loop.ts` 逐幀釘位邏輯前面有沒有更早的分支把 artist 攔
  截掉**：把 `npcs.forEach()` 整段從頭讀到露比那個分支，前面
  `holding`／`isPrologueMayorFollowing`／cutscene 鎖定／
  `isCarpenterEscortActor`／`isCarpenterWaitingAtHouse` 這幾段全部
  只認 `mayor`／`carpenter`／`captain`，不會誤攔 `artist`。
- **`n.mesh.parts == null` 那個最前面的早退判斷**：只有 `chef`（空
  `THREE.Group()`，故意不建模型）會踩到，`artist` 是正常的
  `makeArtist()` 回傳值，有 `.parts`，不受影響。

唯一找到的真正差異：其他固定站位分支（`holding`／
`isPrologueMayorFollowing`／`isCarpenterEscortActor`）都會順手設一次
`npcGroup.visible = true`，露比那段漏了這行。`buildMap()` 換圖時算出
來的 `npcGroup.visible` 在 `oldVillage` 本來就一定是 `true`（見
`build-map.ts` 那段公式），理論上不該是這次看不到人的成因，但既然是
唯一一處寫法不一致的地方，這輪還是把它補齊了（`game-loop.ts`）。

### 沒有再繼續往下猜，改成正面解決「討論了三輪都還是找不到人」這件事

程式邏輯逐行核對不出錯，加上「觸碰事件确實有觸發」這個新證據，讓這輪
判斷比較像是「不知道要往哪走、相機也沒帶到那裡」的可發現性落差，不是
真的渲染壞掉——但這只是推論，不是實測驗證過的結論（環境限制：這個
session 沒辦法自己跑一份能跨 tool call 存活的 dev server 連上瀏覽器
實測，見下面「環境限制」那段）。

與其繼續猜第四輪，直接回應 Zeppelin 這兩輪都明確講的訴求（第一輪
「理論要直接接」、這輪「應該是直接觸發…自動走過去」）：把
`completeDayTwoMorningEvent()` 原本「推進到 `waiting_oldVillage`、
交給玩家自己走過去碰」的設計，改成木匠戲一結束就直接呼叫
`startArtistPersonalEvent()`，跳過站定點等碰觸發那個中間站。
`ARTIST_EVENT_WAIT_POS` 這個座標跟 `handleArtistWaitTouch()` 觸碰事
件本身都保留，沒有刪——如果之後想改回「玩家自由探索找到她」的體驗，
`completeDayTwoMorningEvent()` 那兩行換回
`artistQuest.stage = "waiting_oldVillage"` 就好。

同時在 `startArtistPersonalEvent()` 開頭加了一次性 `console.info`
除錯輸出（`mesh.visible`／`npcGroup.visible`／local+world position／
scale／`hasParts`／目前地圖／玩家座標），如果自動接上之後畫面上還是
看不到露比，下次直接看 F12 console 這行貼出來就有實際數據，不用再靠
截圖猜。確認沒問題之後這段除錯輸出可以刪掉。

### 環境限制：這個 session 沒辦法自己連上瀏覽器實測

`device_bash` 每次呼叫都是全新的沙箱行程樹（`bwrap` 隔離），背景行程
（`setsid nohup … & disown`）不會跨呼叫存活——起 dev server 那次呼叫
一結束，server 就跟著沒了，沒辦法在下一次呼叫用瀏覽器工具連上去實測。
這是這一輪只能靠程式碼逐行核對、沒辦法自己截圖驗證「露比到底有沒有
畫出來」的原因，記錄下來避免以後又想著「直接開瀏覽器測一次不就好了」
重複踩坑。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。
沒有新增/修改任何測試——這輪改的是流程時機（何時呼叫
`startArtistPersonalEvent()`）跟一行除錯輸出，沒有新的可測邏輯分支。


## 2026-09-04 第四輪：選屋橋段三個新問題——跟隊順序、Y 高度、露比放生後亂走

自動接上（上一則記錄）送出後，Zeppelin 這輪附了兩張選屋橋段
(`startVillageHouseTour()`) 的截圖，回報三件事：(1) 露比跟隨村長走的
時候應該排在隊伍最後面；(2) 露比沒有走到（木匠選中的）那棟房子，而是
跑去廣場了；(3) 她走路的樣子很像貼地平移，高度好像有誤差。這三個都是
選屋橋段本身的問題，跟上一輪的「看不到人」是不同橋段（那個是木匠事件
完全結束後的露比個人事件，這個是木匠事件進行中、四人一起去挑房子那
段），這輪逐一查出實際成因並修正：

**(1) 跟隊順序**——`updateDayTwoWalkFollowers()` 原本讓歐文/露比鏡射
在村長兩側（`x ± 1.15`），但整段選屋橋段的行進方向固定沿 z=17 往 -x
走（`VILLAGE_TOUR` 三個點 x=152→143→137），鏡射意味著露比落在
`村長x - 1.15`，比村長更靠近 -x（前進方向），等於走在隊伍最前面，跟
反饋的「應該在隊伍最後面」正好相反。改成跟歐文同側、但偏移量加倍
（`村長x + 2.3`），z 也錯開一點避免完全重疊，讓她確實排在隊尾；開場
定格的初始站位（`startVillageHouseTour()` 裡的 `holdNpcsAt`）也同步
改成同一個方向，避免開場第一幀跟後續每幀的算法對不上而跳動。

**(2) 沒走到房子、跑去廣場**——追進 `beginMountainRoute()`（選屋結束、
準備上山採集材料那段）才發現：露比說完「我先不跟你們上山了...隔壁那
棟房子我蠻喜歡的，先去放行李了」這兩句台詞後，程式碼原本的想法是說
`releaseHold()` 解除固定站位後，她會「自動退回 npc-defs.ts 原本的舊
城鎮日常排程」——但日常排程的路徑table跟她剛講的「隔壁那棟房子」毫無
關聯，玩家看到的就是她憑空走去排程指定的其他地點（這次是廣場），跟
台詞對不上。改成 `beginMountainRoute()` 直接把 `artistQuest.stage` 推
進到 `waiting_oldVillage`——這是既有的狀態，`game-loop.ts` 的釘位邏輯
本來就認得，會把她放到 `ARTIST_EVENT_WAIT_POS`（「隔壁那棟房子」）並
釘住，一路撐到 `completeDayTwoMorningEvent()` 接上她的個人事件為止，
跟台詞完全對上。連帶把 `completeDayTwoMorningEvent()` 裡判斷「要不要
接上露比事件」的條件從只認 `not_started` 放寬到也接受
`waiting_oldVillage`（現在正常流程一定會先經過這個狀態），避免卡住。

**(3) 走路貼地平移**——這個才是真正的程式邏輯錯誤，不是這次新增的，
是既有的固定站位（`holding`）分支本來就有的 bug：`animateWalk()`
不管 moving 還是 idle，都會直接覆蓋 `position.y`（moving 時是
`Math.abs(Math.sin(t*10))*0.03` 的踏步彈跳量，idle 時是
`Math.sin(t*2)*0.01` 的待機微幅浮動），`characterGroundY()` 回傳的是
純地形高度、不含彈跳量——兩者要疊加才對。`holding` 分支上一輪(見前面
「修正村長半沉進地板」那則)已經把呼叫順序改成先 `animateWalk()` 再處
理地形高度，但地形高度那行用的是 `=`（直接覆蓋）不是 `+=`（疊加），
等於把 `animateWalk()` 剛設好的踏步彈跳量整個蓋掉，變成只有四肢在動、
身體完全不會上下浮動的「貼地平移」——跟 escort trail、日常排程那兩段
本來就用 `+=` 的正確寫法不一致。這個分支同時服務 mayor/carpenter/
artist 三種角色，這次修正是共用的，選屋橋段、家門口固定站位、港口迎
接戲全部一起受惠，不是只修露比這一種情境。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。


## 2026-09-04 第五輪：露比開場戲加分鏡（發現→回頭反應→走過去）

Zeppelin 貼了截圖確認上一輪自動接上之後露比的 CG 立繪正常顯示（三輪
除錯的「看不到人」疑慮到此正式排除，是可發現性問題，不是渲染壞掉），
然後給了一段具體分鏡，要在 `completeDayTwoMorningEvent()` 接上露比事
件時照著演：露比先站定 `[oldVillage] (142,18)` 面朝上、發出「...」、
對話框顯示「露比：「……」」；接著主角轉向右側、發出「!」；然後走到
露比左邊 `(141,18)`；再繼續原本的對話。

實作對應：

- `ARTIST_EVENT_WAIT_POS` 從 `(142,17)` 改成 Zeppelin 指定的
  `(142,18)`——這個常數原本是比照 `CARPENTER_EVENT_WAIT_POS` 的公式
  推算出來的，現在有明確指定座標，直接改成定案值。
- `startArtistPersonalEvent()` 拆成三段 `showDialogSequence`：第一段
  只有開場白 `[藝術家站在隔壁空屋前，盯著外牆]` + 露比的「……」（掛
  `comicCue: {actorId:"artist", kind:"..."}`)；第二段是主角轉向
  `FACING_ANGLE.right`（面向東側，露比所在方向）+「!」反應
  cue；第三段（`continueArtistPersonalEventDialogue()`）是原本從
  「你覺得這面牆是白色的嗎？」開始的完整對話，透過新寫的
  `walkPlayerTo()` 走到露比左邊(142-1, 18)之後才接上。
- 新增 `walkPlayerTo(target, onDone)`：主角在演出中自己走一小段路的
  小工具，用獨立的 `requestAnimationFrame` 迴圈線性內插座標，速度比
  照 `game-loop.ts` 日常排程 NPC 的 1.6 格/秒；沒有沿用
  `startGuidedWalk()`，因為那個函式寫死操控 `mayor`，是給「NPC 領頭、
  主角跟隨」設計的，這裡反過來是主角自己走，硬套風險比自己寫一個小
  工具大。地形高度疊加用跟這輪其他修正一致的
  `animateWalk() 先、position.y += 地形高度後` 順序，避免又出現貼地
  平移。
- 拿掉了上一輪加的一次性除錯 `console.log`——確認沒問題了，照描述
  刪掉。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。
`walkPlayerTo()` 本身沒有寫自動化測試——是純視覺演出的小工具，邏輯
（線性內插+速度換算）很單純，用既有測試套件驗證不到，之後如果想補，
可以測「給定 target 跟 speed，durationMs 的計算」這種純函式部分。


## 2026-09-04 第六輪：離隊「瞬移」改成自己走過去＋補一個同款 Y 陷入 bug

Zeppelin 反饋兩件事：(1) 木匠事件（選屋橋段）結束後露比直接不見了；
(2) 要不要讓她離隊後自己走到定點；(3) 高度可能還是有點陷下去。

**(1)+(2) 瞬移改成走路**——上一輪（第四輪）把 `beginMountainRoute()`
改成離隊時直接把 `artistQuest.stage` 設成 `waiting_oldVillage`，讓
`game-loop.ts` 的釘位邏輯接手——但那段邏輯是「這一幀直接把座標釘死在
`ARTIST_EVENT_WAIT_POS`」，跟她剛剛走隊形的座標完全對不上，視覺上就是
瞬間消失、在別的地方憑空出現。改成新寫的 `walkArtistToWaitSpot(onDone)`
——從她離隊當下的座標，自己用跟主角 `walkPlayerTo()` 同一套算法（線性
內插、1.6 格/秒）走到 `ARTIST_EVENT_WAIT_POS`，走到了才呼叫 `onDone()`
把 `artistQuest.stage` 推進到 `waiting_oldVillage`，這時候釘位邏輯接手
才不會有瞬移感。跟主角那個工具的差異：這裡動的是 NPC 的 mesh，而且要
避免走路過程被 `game-loop.ts` 的日常排程 A* 系統搶走——沒有自己寫一套
全新的「NPC 免疫日常排程」機制，而是借用既有的
`holdNpcsAt()`/`dayTwoMorningEvent.holding` 那套（跟村長領隊走位共用
同一條 `game-loop.ts` 釘位分支），每幀重新呼叫 `holdNpcsAt()` 更新她的
座標，順便繼承那條分支上一輪（第四輪）已經修好的 Y 疊加順序，不用重
複寫一份地形高度計算。`beginMountainRoute()` 裡 `dayTwoMorningEvent.
phase = "mountainRoute"` 這行要在走路動畫的第一幀跑之前就切掉，不然
`updateDayTwoWalkFollowers()` 還認得 `"villageWalk"`，會用村長的位置
每幀重算 `holdPositions.artist`，跟這裡的走路動畫互相搶著寫同一個
欄位。

**(3) Y 陷入**——這次不是走路動畫的問題，是「站定點等」那個釘位分支
（`waiting_oldVillage`/`intro`/`returning`）本身就有 bug，跟走路無關：
原本用 `position.set(x, 地形高度, z)` 一次把座標設好，但緊接著呼叫的
`animateWalk(moving=false)` 會把 `position.y` 整個覆蓋成
`Math.sin(t*2)*0.01` 的待機微幅浮動（見 humanoid.ts），等於把剛設好
的地形高度整個蓋掉、變成貼近 0 的高度——這一帶地形墊高在
`groundElevation`(=1) 附近，所以看起來像陷進地板。改成跟 `holding`
分支同一個順序：x/z 先設好，`animateWalk()` 呼叫完之後再用 `+=` 疊加
地形高度。順便發現木匠「站在工地空屋前」那個等待姿勢
（`isCarpenterWaitingAtHouse` 分支）也是一模一樣的寫法、一模一樣的
bug，只是還沒被抓到，這輪一起修掉，沒有等下次才發現同一個坑。

（`isPrologueMayorFollowing` 那段村長序章跟隨的分支也有類似但比較輕微
的變體——`animateWalk()` 呼叫順序是對的，但地形高度用 `=` 直接覆蓋
不是 `+=`，會把彈跳量蓋掉、變成貼地平移，不會真的陷進地板。這個是序
章既有、已經上線測過的場景，這輪沒有一起動，先記錄下來，如果之後序
章那段也被反饋「走路怪怪的」，就是同一個成因。）

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。


## 2026-09-04 第七輪：港口見面戲改成兩排面對面

Zeppelin 給了新的港口事件佔位座標，四人份都是直接指定的絕對座標＋朝
向：`[port] (5,21) 歐文面左`、`[port] (5,23) 露比面左`、
`[port] (3,21) 主角面右`、`[port] (3,23) 村長面右`。

這四個座標剛好都落在既有的 `LAYOUT.port.carpenterMeet`
(`{x:3, z:21, width:3, height:3}`) 範圍內，改成用它推導（`x`/`x+2`、
`z`/`z+2`）而不是寫死四個數字，比較好維護——跟原本
`layout-maps.ts` 的寫法風格一致。原本(2026-09-03 那版)是主角/村長同排
面向船、歐文/露比也同排面向船（迎接的人跟被迎接的人各自面對船，不是
面對彼此）；這次改成兩排面對面——主角/村長站西側那排面向東(right)，
歐文/露比站東側那排面向西(left)，兩排隔著中間對望，比較像「迎接」的
構圖。

`layout-maps.ts` 的 `DAY_TWO_PORT_ARRIVAL` 四個座標改用
`carpenterMeet` 推導；`day2-morning-event.ts` 的
`startPortArrivalScene()` 裡，主角初始朝向、`holdNpcsAt()` 傳給
mayor/carpenter/artist 的 `rotY` 都從寫死的 `0`/`Math.PI` 改成
`FACING_ANGLE.right`/`FACING_ANGLE.left`（跟這輪稍早加的
`FACING_ANGLE` import 共用）。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。


## 2026-09-04 第八輪：露比離隊走路「順移」——改成不靠推斷、自己驅動動畫

Zeppelin 反饋上一輪的 `walkArtistToWaitSpot()`「露比沒有事件後走過去
而是順移了」，另外提到「所有角色的碰撞還是有問題，導致沒有進入行走
動畫」。

先講可以確認、也修掉的部分：`walkArtistToWaitSpot()` 上一版是借用
`holdNpcsAt()`/`dayTwoMorningEvent.holding` 這套機制，讓
`game-loop.ts` 的「holding」分支自己比較「這幀的目標座標」跟「mesh
目前座標」的差距，超過門檻(0.008)才播走路動畫——問題是
`walkArtistToWaitSpot()` 自己的 `requestAnimationFrame` 迴圈跟
`game-loop.ts` 主迴圈的 `animate()` 是兩條各自獨立、沒有互相同步的
rAF 鏈，「這裡有沒有真的把新座標寫進 holdPositions」跟「那邊這一幀有
沒有讀到最新值」時序對不齊，靠比較前後兩幀座標差推斷「有沒有在動」這
件事並不可靠，會導致動畫沒有跟位移同步觸發，看起來就是貼地滑過去。

改成完全比照 `walkPlayerTo()` 的寫法——不再假手任何分支去推斷，直接
在 `walkArtistToWaitSpot()` 自己的 rAF 迴圈裡呼叫
`animateWalk(mesh, true, ...)`，全部自己算好、自己套用，不依賴任何
跨迴圈的狀態推斷。要避免這段期間被日常排程的 A* 系統搶著改她的
position，原本借用的 `holding` 機制語意也不完全對得上（那是給「固定
站位」設計的，不是給「這段時間交給別的程式碼控制」設計的），換成一個
新的、意思更明確的旗標 `dayTwoMorningEvent.artistSoloWalking`——
`game-loop.ts` 的 `npcs.forEach` 一開始看到這個旗標為真、且是 artist
就直接跳過整段（含日常排程），不會有兩邊同時搶著改同一個 mesh 的
position/rotation 造成「動畫跟位移打架」的情況。

「所有角色的碰撞還是有問題」這句沒有辦法在這輪確認——回頭查了村長領
隊那套（`prologue.ts` 的 `updatePrologueCutscene()` guidedWalking 分
支）跟 carpenter escort trail、上面幾輪修過的 holding 分支，都沒有找
到會擋住移動的碰撞檢查(`isBlocked()` 只用在日常排程 NPC 的 A* 尋路跟
玩家自己走路那兩處，這幾段固定站位/跟隨走位完全不經過那段)，這些分支
判斷「有沒有在動」的邏輯(`mayorMoving`、`moved > 0.008`)結構上看起來
是對的，不像這次 `walkArtistToWaitSpot()` 那樣有跨 rAF 鏈的時序問
題。如果村長領隊那組走位（選屋橋段）也有「不播走路動畫」的狀況，需要
下次遇到時附一張走路當下的截圖或說明具體是哪一段，這輪沒有足夠線索
能確定是同一個成因還是另一個問題。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全過。


## 2026-09-04 第九輪：木匠戲收尾加黑屏、村長/木匠解除凍結、教學周天氣修正

這輪 Zeppelin 一次提了四件事，逐項拆開處理。

### (1) 木匠事件結束後先黑屏，再接露比事件

`completeDayTwoMorningEvent()` 原本是木匠最後一句台詞收掉、下一行就
直接呼叫 `startArtistPersonalEvent()`，兩場戲之間沒有任何停頓，觀感
上像硬接。改成用檔案裡已經在用的 `runBlackTransition("short", ...)`
包住這段轉場（跟 CG 切換、`startCarpenterRepairScene()` 裡歐文換裝那
段是同一套機制）：畫面全黑之後才真的把 `artistQuest.stage` 切成
`"intro"` 並呼叫 `startArtistPersonalEvent()`，黑屏持續 140ms（short
的 hold 時間）後淡出，玩家看到的會是「木匠戲淡出→短暫全黑→淡入露比
戲」，兩段戲有明確段落感，不是同一幀硬切。

### (2) 村長/木匠事件結束後回去過自己的日常（含逛廣場）

這是這輪查最久的一個。追過 `carpenterQuest.stage` 的狀態機，確認
`completeDayTwoMorningEvent()` 把它設成 `"moved_in"` 之後，
`game-loop.ts` 裡專門攔截村長/木匠的 `isCarpenterEscortActor`（只認
`"escorting"`/`"village_scene_done"`）跟 `isCarpenterWaitingAtHouse`
（只認 `"construction"`/`"ready_for_move_in"`）都不會再命中——這條路
其實原本就沒問題，`moved_in` 之後兩人本來就會落回日常排程分支。

真正卡住他們的是另一段完全通用、跟木匠劇情無關的碼：

```js
if (
  (gameState.cutsceneActive ||
    isPrologueFarmingActive() ||
    isPrologueSeekingRod() ||
    isPrologueFishingTutorialActive()) &&
  (n.id === "mayor" || n.id === "captain")
)
  return;
```

這段本來是為了序章期間村長/船長的位置要完全交給 `prologue.ts` 控制、
不能被日常排程同一幀蓋掉而寫的，條件裡用的是最籠統的
`gameState.cutsceneActive`——這個旗標是全專案共用的通用鎖（序章／木
匠事件／露比個人事件全部都會把它設成 true），並不是「序章專屬」的旗
標。露比事件現在（見上一項）黑屏後立刻自動接上，`cutsceneActive` 從
木匠戲結尾到露比在山上採花結束之前幾乎全程是 true，於是村長跟木匠就
在這整段期間被這段守衛凍結住，回不去日常排程——這才是「回自己日程」
卡住的真正原因，跟 carpenter quest 的 stage 機器完全無關。

修法：`prologue.ts` 新增一個之前沒有的通用檢查
`isPrologueActive()`（`stage !== "inactive" && stage !== "done"`），
`game-loop.ts` 那段守衛改成只看 `isPrologueActive()`——
`isPrologueFarmingActive()`/`isPrologueSeekingRod()`/
`isPrologueFishingTutorialActive()` 對應的階段本來就落在
`isPrologueActive()` 涵蓋的範圍內，不用再各別列一次，順便讓條件精簡
一些。這樣只有「序章本身」真的還沒結束時才會凍結村長/船長，Day2 之後
任何借用 `cutsceneActive` 的事件都不會再誤傷這段邏輯。

### (3) 「先讓她們在廣場逛好了」

一旦 (2) 修好、村長跟木匠不再被凍結，他們就會落回 `npc-defs.ts` 既有
的日常排程——那套排程本來就會讓沒有特殊事件卡著的 NPC 在自己的地圖範
圍內走動（含廣場），這點不用額外改碼，Zeppelin 這句話本身就是在確認
「日常排程帶去廣場」是可接受的結果，不是要另外指定廣場座標。

### (4) 教學周（第一週）應該永遠晴天，但目前看到雨天

`rollWeatherForSeason()` 本來就有教學周保護——`createSeasonWeatherSchedule()`
的 `isProtectedDay` 已經把 `absoluteSeason === 0` 的前
`TUTORIAL_WEEK_DAYS`（7）天強制排成 `clear`。邏輯本身沒寫錯，Zeppelin
自己也猜「不確定是記錄還是邏輯問題」——實際上兩者都有一點：

- `gameState.weatherSchedules` 跟 `gameState.currentWeather` 都會整
  包存進存檔（`input-save.ts` 的 `saveGame()`/`loadGame()`），讀檔時
  `loadGame()` 原本是 `data.currentWeather || rollWeatherForSeason(...)`
  ——只要存檔裡已經有 `currentWeather` 這個字串（不管是不是在教學周
  保護邏輯上線之前存的），就會直接信任那個可能過期的舊值，不會重
  算。這輪測試用的存檔很可能就是這種「比保護邏輯更早」存下來的天氣
  結果。
- `gameState.weatherSchedules` 這份 cache 本身也會跨場景留在記憶體
  裡沿用——標題畫面的天氣預覽、或同一頁先讀過某個存檔又回頭開新遊
  戲，都不會清空它；`startNewGame()` 原本也沒有重置這個欄位。

與其在讀檔／新遊戲／標題預覽這些各自獨立的進入點分別補一次「清快
取」，這輪把保護規則直接搬到 `rollWeatherForSeason()` 的回傳值那一
層：把判斷式抽成 `weather-schedule.ts` 裡一個不依賴 `gameState` 的
純函式 `isTutorialWeekDay(absoluteSeason, seasonDayIndex, tutorialWeekDays)`，
`rollWeatherForSeason()` 在碰任何排程快取之前先問這個函式——只要是教
學周範圍內的日子，不管快取（不管是剛算的、還是從舊存檔/記憶體沿用下
來的）裡實際存了什麼，一律直接回傳 `clear`。這樣一次涵蓋所有呼叫路
徑，不用擔心漏掉某個進入點。

抽成獨立純函式而不是直接寫在 `game-state.ts` 裡，是因為
`game-state.ts` 的 import 鏈會一路拉到 `scene-sky.ts` 建
`WebGLRenderer`，在沒有 DOM/canvas 的 `tsx --test` 環境沒辦法直接
import 這個檔案做單元測試；`weather-schedule.ts` 本來就是刻意抽出來
放「跟遊戲全域狀態無關的天氣排程算法」的地方，`isTutorialWeekDay()`
可以直接被 `weather-schedule.test.ts` 測到。

順便修了兩處配套：
- `input-save.ts` 的 `loadGame()` 不再優先信任 `data.currentWeather`
  這個可能過期的字串，一律呼叫 `rollWeatherForSeason()` 重新算——排
  程快取本身在一般情況下沒變，重算結果會跟存檔當下一致，只有在存檔
  資料過期/不一致（例如這次的教學周）時才會被「修正」回正確值。
- `title-screen.ts` 的 `startNewGame()` 補上
  `gameState.weatherSchedules = {}`，避免新遊戲沿用同一頁前一輪讀過
  的存檔留下的排程快取（教學周本身已經被上面那層強制保護涵蓋，這裡
  純粹是順手歸零，避免教學周「之後」的天數也意外沿用舊排程）。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）、
`npm run test:weather`（新增 `isTutorialWeekDay` 兩項測試，共 5 項）
全過。天氣這部分沒辦法用瀏覽器實際跑一輪存讀檔驗證（環境限制，見檔案
開頭說明），已用單元測試把「教學周永遠晴天、且不受快取內容影響」這條
規則鎖住；如果下次進遊戲教學周內還是看到非晴天天氣，麻煩附上當下是遊
戲第幾天、是新遊戲還是讀舊存檔，方便進一步排查是不是還有其他路徑在繞
過 `rollWeatherForSeason()`。


## 2026-09-04 第十輪：露比事件結束強制跳到 15:00、花田改回一叢式外觀

### 露比事件結束後時間強制改到 1500

`completeArtistPersonalEvent()` 是露比整場事件（港口相遇→木匠戲→黑屏
接上→山上採花→回村研磨顏料）真正收尾的地方，之前只解除
`setTimePauseSource("rubyEvent", false)`，遊戲時間會維持在事件開始
暫停的那個時間點繼續往下走——劇情演了大半天，時鐘卻還停在早上，觀感
不對。

比照 `prologue.ts` 序章結束時同款寫法（`beginStage("done")` 收尾那段
的 `FREE_TIME_PHASE = 15/24`，直接改寫 `gameState.elapsed`/
`gameState.currentPhase`）新增 `RUBY_EVENT_END_PHASE = 15/24`。差別是
序章發生在第 0 天，`prologue.ts` 可以直接用 `dayLength * phase`；露比
事件是第二天以後，這裡改成
`gameState.currentDay * dayLength + dayLength * RUBY_EVENT_END_PHASE`，
保留當下的 `currentDay`，只覆寫「這一天內的時刻」，不會把日期也一起
拉回去。

### 花田花朵視覺——從單朵改回固定三角排列的小花叢

這片花田在更早之前（同樣 2026-09-04）因為「花會偏移大概0.2個單位」
的反饋，從借用 `makeFlowerCluster()`（野外採集點那種 2~4 朵隨機散開
的叢生模型）改成單一朵花精準種在格子正中央——問題是矯枉過正，種出來
的花田看起來一格一朵，稀稀落落不像花田。

這次改法不是走回頭路重新借用 `makeFlowerCluster()`（它的散開角度/半
徑整段都是隨機數，是造成「偏移」反饋的根本原因），而是在
`makeFlowerBedMesh()` 裡直接寫死一個三角形排列的小花叢：3 朵花頭固定
在 120° 等分的角度上、固定半徑 0.09（乘上 `CLUSTER_SCALE` 2.6 倍後約
0.23 個單位，離相鄰格線還有一半以上緩衝），只用 hash 讓每朵花的旋轉角
度／縮放有一點細微差異（不影響位置）。因為位置本身是常數、三個角度對
稱分布，整叢花的視覺重心永遠精準落在 group 原點——呼叫端
（`farm-visuals.ts` 的 `syncFlowerBedVisuals()`）再把這個 group 定位
到格子座標，跟之前「單朵花種在正中央」對齊格線的效果一樣，但多了叢生
的層次感。半成熟階段（stage 1）維持單朵縮小版不變，只有成熟階段
（stage 2，會顯示採收提示的那個階段）套用新的三角花叢。收成邏輯
（`harvestFlowerBed()`）完全沒動，純粹外觀調整。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）全
過。花叢視覺跟強制時間這兩項都是純渲染/賦值邏輯，沒有對應的單元測
試，已用程式碼審查確認邏輯正確（時間那段特別檢查了「保留 currentDay」
這個跟序章版本的關鍵差異）。


## 2026-09-04 第十一輪：露比開場「!」演出完全沒播出來——修掉、村長瞬移到廣場待查

Zeppelin 附了黑屏淡入後的截圖，反饋兩件事：「木匠事件結束後村長直接
瞬移到廣場」、「黑屏後應該要!演出，我覺得應該是太早了我沒看到，而且
應該要停頓一下的」。這兩件事分開查，一件是確認、修掉的 bug，一件是
查過但沒能確認成因，如實記錄、留給下次帶更精確資訊回報。

### 「!」演出沒播出來——`showDialogSequence()` 的舞台指示壓縮邏輯有個
空隙

先看程式在做什麼：`showDialogSequence()` 開頭會把整段台詞陣列「壓
縮」一次——凡是文字整句被 `[...]` 包住的行都當成「舞台指示」，不會
自己變成一格獨立的對話框，只把它身上帶的 `comicCue`（如果有）記在
`pendingComicCue`，交給壓縮後陣列裡「下一句真正會顯示的台詞」一起帶
出去（讓驚嘆號泡泡跟下一句話同時出現，這是這個檔案裡到處都在用、也
一直運作正常的手法，例如「[主角頭上「！」]」後面接著木匠的台詞）。

問題出在露比開場戲那句：
```js
showDialogSequence(
  [cue("[主角轉頭，注意到隔壁站著一個人]", "player", "!")],
  () => { walkPlayerTo(...) },
);
```
這個陣列只有這一句，而且是舞台指示（`[...]`包住）。壓縮迴圈跑完後，
它被吃進 `pendingComicCue`，但後面沒有任何一句「真正的台詞」可以承
接——`compacted` 壓縮完是空陣列。`showDialogSequence()` 看到空陣列會
直接 `closeDialogUi()` 再 `queueMicrotask(onComplete)`，也就是這個驚
嘆號根本沒有被畫出來過一次，`walkPlayerTo()` 幾乎在同一個 tick 就被
呼叫——玩家會覺得「太快了、我根本沒看到」，因為畫面上真的什麼都沒
播。這是這輪 Round 3 把開場戲拆成三段分鏡時，第一次把單獨一句
`cue()` 當成整個陣列傳進去，才踩到這個之前沒人踩過的空隙——之前所有
`cue()` 的用法都嵌在更長的陣列裡、後面一定接著真的台詞，沒暴露過這個
問題。

修法：`showDialogSequence()` 壓縮迴圈跑完後，如果 `pendingComicCue`
還卡在手上沒人接（代表陣列收在一句「純舞台指示＋comicCue」），補一個
安全網——塞一句 `{text: "", comicCue: pendingComicCue}` 的合成台詞進
`compacted`。`shouldDisplayDialogText()` 看到有 `comicCue` 就會自動隱
藏文字框、只顯示泡泡，`renderDialogLine()` 也已經有現成的 1400ms 計
時器負責這種「隱藏文字」的行自動往下推進——這正好就是「顯示驚嘆號、
停頓一下、再自動繼續」，不用另外加等待機制，也不影響任何現有的、後
面接著真台詞的 `cue()` 用法（`pendingComicCue` 在那些情況下迴圈跑完
前就已經被消耗掉，不會走到這個新分支）。

這是共用邏輯（`dialogue.ts`），改一次全專案任何未來「單獨一句舞台指
示+驚嘆號」的寫法都會受惠，不用每次都靠人工記得「後面一定要接一句真
台詞」這個隱性規則。

沒辦法補自動化測試——`showDialogSequence()`/`renderDialogLine()` 這
條路徑會碰到 `document.getElementById`、`npcs`（一路拉到
`scene-sky.ts` 建 `WebGLRenderer`），在沒有 DOM 的 `tsx --test` 環境
沒辦法直接測，跟這輪之前 `game-state.ts` 遇到的環境限制一樣。已經逐
行追過壓縮邏輯的分支條件確認修法正確；`comic-cue.test.ts`（測純邏輯
`shouldDisplayDialogText()`）維持通過，跟這次改動本來就是兩個不同層
級的邏輯。

### 村長「瞬移到廣場」——查了但沒能定位到明確成因

先排除幾個可能性：
- 木匠事件結束到露比開場黑屏淡入這一小段，地圖沒有換過（全程都在
  oldVillage），`loadMap()`/`buildMap()` 沒有被呼叫，不存在「換圖時
  把 NPC 重新擺到某個座標」這種會被誤認成瞬移的重建動作——查過
  `buildMap()`，一般排程 NPC（不是木匠護送那個特例）本來就不會在建圖
  時被重新定位，`getScheduleTarget()` 只有 `game-loop.ts` 逐幀那段跟
  `prologue.ts` 船長那段在用。
- 村長被放行去日常排程（見上一輪 `isPrologueActive()` 那個修正）之
  後，真正會移動他座標的只有 `game-loop.ts` 那段逐幀 A* 走路邏輯——
  是逐格插值走過去，理論上不會整個瞬間跳到終點。
- 但這整段期間對話框幾乎沒停過（`isGameplayPaused()` 只要 `#dialog`
  還開著就會回傳 true，這時候 `dt` 直接是 0），意味著村長絕大部分時
  間根本沒有機會真的走動——他很可能整個木匠戲收尾到露比開場淡入這段
  期間都維持凍結在木匠戲最後站的位置附近（這點反而跟截圖對得上：截
  圖裡村長跟木匠疊在一起、站在房子附近，不是站在廣場）。

综合起来，「瞬移到廣場」比較可能發生在露比整場事件「真正結束、玩家拿
回自由控制」之後——這輪剛好也把 `completeArtistPersonalEvent()` 加上
了「強制跳到 15:00」（見上一輪紀錄），時間一變，村長的日常排程目標
可能直接換成「廣場」，這時候對話框關閉、`dt` 恢復正常，他確實會開始
用逐幀走路邏輯走過去——如果他當時離廣場不遠、走過去只要一兩秒，玩家
沒特別盯著看的話，很容易觀感上就是「一回神人已經在那了」，不是真的瞬
間位移。

這個解釋合理，但沒辦法在這個環境實際跑一輪確認（沒有瀏覽器可以驗
證），跟前幾輪「碰撞」那次一樣，這裡誠實記下沒有查到能 100% 確認的
成因，不亂猜一個修法上去。如果下次遇到，麻煩幫忙確認一下：是在黑屏
剛淡入那一刻就已經在廣場了（代表凍結期間位置真的悄悄變了，比較可疑）
，還是在露比整場事件結束、玩家重新能自由行動之後才發現他已經在廣場
（比較符合「其實有走過去，只是走得快/沒注意到」）。

### 驗證

`tsc --noEmit` 通過；`npm run test:map-tools`（41 項）、
`npm run test:affection`（5 項）、`npm run test:save-slots`（3 項）、
`npm run test:weather`（5 項）、`npm run test:comic-cue`（沒有獨立
script，直接用 `tsx --test src/comic-cue.test.ts` 跑，1 項）全過。
