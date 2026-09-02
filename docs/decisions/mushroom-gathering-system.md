# 蘑菇採集系統

> 依 Zeppelin 的即時需求落地，架構完全比照野花採集系統（見
> `docs/decisions/wildflower-gathering-system.md`），改動這個系統前先看
> 那份文件的骨架說明，這裡只記跟野花不同的地方。

## 目前只有一個物種：香菇

`src/mushrooms.ts` 是新檔案，架構比照 `wildflowers.ts` 的
`FlowerSpeciesId`，留了 `MushroomSpeciesId` 這個型別（目前只有一個值
`"mushroom"`），Zeppelin：「之後會有其他菇」——之後新增菇類時，比照這裡
加新的 `MushroomSpeciesId` 值＋`item-catalog.ts` 註冊新 item id＋
`MUSHROOM_SPECIES` 加一筆，不用重寫周邊的採集點/存讀檔邏輯。

item id 沿用專案裡本來就有的 `"mushroom"`——這個 id 原本只有序章劇情
（`prologue.ts`）贈送 3 個、cooking-ui.ts 的「烤蘑菇串」食譜也吃這個
id，`inventory.mushrooms` 是既有存檔欄位，**沒有另外改名**，避免動到
食譜成本表/舊存檔映射。只把顯示標籤從通稱「蘑菇」改成具體品種「香菇」
（`item-catalog.ts`/`inventory-ui.ts`/`cooking-ui.ts` 三處的 label 一起
改，id 不動）。

## 跟野花的差異

- **不用工具**：Zeppelin：「直接可以摘」。`harvestMushroomNode()`、
  `context-interaction-ui.ts` 的 `targetForMushroom()`、
  `input-save.ts` 的 E 鍵鄰接判定都沒有 `hasTool()` 檢查——這是跟野花
  （鐮刀）/木材石頭（斧頭）最大的不同。
- **密度低很多**：野花每區 3 個節點，蘑菇每區固定 1 個
  （`MUSHROOM_NODES_PER_ZONE = 1`，跟 `FLOWER_NODES_PER_ZONE` 不同，
  蘑菇目前只有一個物種所以沒有另開「每區可能物種池」表，之後真的加了
  第二種菇再比照 `FLOWER_ZONE_SPECIES` 補）。
- **區域**：跟野花完全共用同一批三區（`mountainSide`/`foot`/`waist`，
  即生活區山腳／山區平台1／山區平台2），**不含 summit**——理由跟野花
  拿掉 summit 一樣（山頂已有神社/鳥居等地標）。Zeppelin：「範圍一樣」
  「一區一個一個就好 生活 山腰 山底」。
- **四季都有**：跟野花一樣沒有季節限定/替換邏輯。
- **刷新時段**：沿用跟木材/石頭/野花同一套 `refreshGatherNodes()`
  06:00/18:00 時段機制，`refreshGatherNodes()` 內部在野花那段迴圈
  之後，直接重跑同一份 `flowerZones` 清單（三個區域跟野花一模一樣，
  沒有另外開一份），改成蘑菇的密度常數。
- **候選格夠不夠**：三區疊加木材(3)+石頭(3)+野花(3)+蘑菇(1)＝每區 10
  個節點，寫了一次性驗證腳本（跑完即刪，不留在 repo）用
  `layout-maps.ts` 純資料在 Node 下模擬 500 次刷新，確認曼哈頓距離
  ≥2 的佔用格規則下三區都不會丟出「候選格不足」的例外。

## 視覺

`makeMushroomCluster()`（`src/mushrooms.ts`）比照 `makeFlowerCluster()`
的叢生做法：同一節點放 2~3 顆香菇（短粗菌柄＋壓扁半球傘蓋＋一圈淺色
菌褶暗示，flatShading 低模、沒有外部貼圖），`CLUSTER_SCALE = 2.2` 整叢
放大，讓辨識度大致跟 `makeWoodPile()`/`makeStonePile()` 同一量級（那
兩個各自用 1.35/1.4，蘑菇原始幾何更小，倍率也拉高一點）。

## 快捷背包（膠囊）

`"mushroom"` 原本沒有加進 `quick-item-ui.ts` 的 `ITEM_ROWS` 白名單——
這是跟野花當初一樣的漏洞（見 wildflower 文件「菇扉髗漏洷背包看不到花的
bug」那節），只是蘑菇之前只能靠序章一次性贈送取得，機率上不太會撞到
「玩家身上只有蘑菇、其他白名單物品都是 0」這個邊界狀況，所以這個 bug
一直沒被踩到。這次趁蘑菇有了野外採集點（會被反覆撿到、機率大增），
一併把 `"mushroom"` 補進 `ITEM_ROWS`（跟 `fish`/`oysters` 同一列，
食材類）並在 `SYMBOLS` 補了備援文字「菇」。

## 缺工具（缺鐮刀/斧頭）互動提示

跟蘑菇系統一起做的獨立修正「Zeppelin：「不能執行的動作順便跳提示，
避免玩家奇怪為什麼開場不能清理石材木材」）：

`input-save.ts` 的 E 鍵鄰接採集判定，原本「木材/石頭旁邊但沒有斧頭」
「野花旁邊但沒有鐮刀」都是直接被 `if (... && hasTool(...))` 這種寫法
整段跳過、按 E 完全沒有任何反應——遊戲一開場玩家還沒拿到斧頭時，
站在木材/石頭旁邊按 E 沒有任何提示，容易讓人誤以為卡關或功能沒做。

修法：把 `hasTool()` 判定從外層條件挪進「已經確認鄰接節點存在」之後缌
找到節點但沒有對應工具時，用跟採集成功同一顆 `gameState.harvestFeedback`
（`kind: "empty"`，共用 `#harvestToast` 這個既有 DOM/CSS，沒有另外做新
元件）跳出「需要斧頭／需要鐮刀」的提示再 `return`，不再讓按鍵默默沒
反應。蘑菇因為「直接可以摘」不受影響，不需要這段。這個修正只動
`input-save.ts` 的鄰接判定邏輯本身，`context-interaction-ui.ts` 的
`targetForGather()`/`targetForFlower()`（滑鼠/搖桿指向式互動用）沒有
tool 時仍然回傳 `null`——按鍵是遊戲目前唯一實際會觸發採集的入口，兩套
系統最終都收斂到同一段鄰接判定，改這裡就夠了，不需要重構指向式互動的
target 系統。
