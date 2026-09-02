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
