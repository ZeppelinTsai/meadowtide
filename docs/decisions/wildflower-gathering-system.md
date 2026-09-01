# 野花採集系統

> 從《海風牧歌》Google 文件版規格書（`claude/野花採集系統規格書_v1.md`）落地為程式碼的架構決策記錄，實作對應 commit 見 `src/wildflowers.ts`/`src/game-state.ts` 等檔案。改動這個系統前先看這份，跟改木材/石頭採集點前要看 `docs/decisions/time-and-pause.md` 是同一個道理。

## 五個物種

物種資料/花頭幾何生成函式都在 `src/wildflowers.ts`（新檔案，跟木材/石頭堆放在 `props-decor.ts` 不同，因為五個物種各自是獨立幾何而不是同一顆花換色，量體比較大，獨立一個檔案比塞進 `props-decor.ts` 清楚）。

| item id (`FlowerSpeciesId`) | 中文名稱 | 對應顏料色 | 花頭造型 |
|---|---|---|---|
| `wildDaisy` | 白雛菊 | 白 | 黃色花心圓盤 + 細長白色花瓣，扁平放射狀 |
| `redPoppy` | 紅罌粟花 | 紅 | 4 片大紅花瓣呈杯狀微捲 + 深色花心 |
| `dandelion` | 蒲公英 | 黃 | 密集細瘦黃色花瓣，比雛菊密、微拱起 |
| `blueDayflower` | 藍露草 | 藍 | 兩片大藍花瓣朝上 + 一片小花瓣朝下，明顯不對稱 |
| `pinkWoodSorrel` | 粉紅酢漿草 | 粉 | 5 片小粉花瓣的花 + 3 片心形葉 |

「對應顏料色」目前只是資料標記（`FlowerSpeciesDefinition.pigmentColor`），顏料/染色系統還沒做，先把欄位固定下來避免以後要重新對應 item id。

花瓣/葉片都是 `THREE.Shape` + bezier 曲線描邊、`ShapeGeometry` 拉出的扁平幾何，用 `radialPart()` 這個共用工具沿花心/莖頂放射狀排列（角度決定方位、局部 X 軸旋轉決定花瓣攤平/上翹角度）。跟 `weather-particles.ts` 畫花瓣貼圖用的 bezier 技巧同一種思路，只是這裡直接做成 3D 幾何而不是 canvas 貼圖。

- `makeFlowerSpecimen(species)`：單朵花頭，用於背包/手持展示。
- `makeFlowerCluster(species, x, z, seed?)`：採集點的叢生模型，同一物種 2~4 朵花頭聚在一起（跟 `props-decor.ts` 的 `makeGardenBed()` 用 `makeFlower()` 堆花叢是同一種做法，只是這裡花本身是專屬幾何）。**2026-09-01 更新**：花頭幾何原本照真花比例做，第一版實機測試（跟 `makeWoodPile()`/`makeStonePile()` 放一起比）小到幾乎看不見，比照兩者各自用 `group.scale.setScalar(1.35/1.4)` 放大整叢的做法，`makeFlowerCluster()` 也加了 `CLUSTER_SCALE = 2.6` 套在整個叢生 `group` 上（倍率比木材/石頭大很多，因為花頭本身幾何遠比原木/岩塊小），只放大最終叢，不動個別花頭的幾何比例/輪廓，五個物種的可辨識輪廓不受影響。

## 採集點資料 —— 跟木材/石頭共用同一套骨架

`GatherNode` interface（`src/game-state.ts`）加了一個可選的 `species?: FlowerSpeciesId` 欄位，`GatherKind` 加了 `"flower"`，`zone` 加了 `"summit"`，木材/石頭節點完全沒有動：

- `WOOD_NODES`/`STONE_NODES` 維持原樣，繼續只在 `mountainSide`/`foot`/`waist` 生成。
- 新增 `FLOWER_NODES: GatherNode[]`，`refreshGatherNodes()` 內部在既有的木材/石頭迴圈後面，另外跑一段野花專用迴圈，多納入 `summit`（山區平台3）。`gatherCandidates()` 本來就用 `LAYOUT.mountain[zone]`/`LAYOUT.mountain.plazas[zone]` 通用處理任何區域，`summit` 不需要另外改這個函式。
- 兩段迴圈共用同一個 `usedByMap` 佔用格追蹤，所以野花節點不會跟木材/石頭疊在同一格（沿用既有的曼哈頓距離 >= 2 規則）。
- 產量沿用既有的 `GATHER_YIELD_MIN`/`GATHER_YIELD_MAX`（3~5），不另開新常數。
- 刷新時段沿用既有的 `getGatherSpawnSlot()`（06:00/18:00 兩個時段）與呼叫時機——只有 `loadMap()` 判定地圖真的切換時才套用，玩家留在原地跨過時段不會讓節點在眼前重生/搬動，`docs/decisions/time-and-pause.md` 那條規則野花照樣遵守，沒有另開一套。

### 分區密度表

| 區域 | 對應 `LAYOUT` | 密度 | 節點數 | 可能物種 |
|---|---|---|---|---|
| 生活區山腳 | `LAYOUT.livingArea.gatherZone`（zone=`mountainSide`） | 高密度 | 3 | 白雛菊、蒲公英 |
| 山區平台1 | `LAYOUT.mountain.foot` | 中密度 | 3 | 白雛菊、粉紅酢漿草 |
| 山區平台2 | `LAYOUT.mountain.waist` | 中密度 | 3 | 蒲公英、紅罌粟花、粉紅酢漿草、藍露草 |

每個節點的物種在每次刷新時從對應池子隨機挑一個（`FLOWER_ZONE_SPECIES`/`FLOWER_NODES_PER_ZONE`，都是 `game-state.ts` 內未匯出的模組常數，只給 `refreshGatherNodes()` 自己用），不是固定配置。

**2026-09-01 更新：`summit`（山區平台3）最終沒有採用**。原本是這次新啟用的區域（`LAYOUT.mountain.summit`/`plazas.summit` 資料本來就在，只是木材/石頭從沒真正用過），但 Zeppelin 實測發現山頂已經有神社/鳥居/長椅/觀景台等地標物件（`build-map.ts` 的 `summitShrine`/`summitTorii`/`bench`），野花叢會被這些東西擋到、看不清楚，決定乾脆不在 summit 放。藍露草原本是 summit 唯一產地，改併進山區平台2（`waist`）的物種池，出現範圍最終跟木材/石頭完全一致（`mountainSide`/`foot`/`waist` 三區，沒有新增地圖區域）。`GatherNode["zone"]` 型別也拿掉了 `"summit"`，`gatherCandidates()`/`LAYOUT.mountain.summit` 本身沒有動，之後真的要用 summit 放別的東西不受影響。

## 採集/工具/UI 掛點

- 工具：`sickle`（鐮刀）。這把工具在這次改動前就已存在於 `tool-catalog.ts`、是新遊戲預設已裝備的起始工具（`title-screen.ts`），本來就用在牧場割草，這裡直接沿用，沒有新增或修改工具目錄。
- 沒帶鐮刀時的行為：沿用這個專案既有的採集節點慣例——`targetForGather()`/`targetForPasture()`（`context-interaction-ui.ts`）沒帶對應工具時直接回傳 `null`，互動提示整個消失，不會另外跳 toast。`targetForFlower()` 是同樣寫法，沒有另外發明一套「需要鐮刀」的提示文字。
- `harvestFlowerNode(x, z)`（`game-state.ts`）：檢查 `hasTool("sickle")`，找到該座標未採集的 `FLOWER_NODES` 節點，產量加到 `inventory.wildflowers[物種]`，設定 `collected = true`，並寫入 `gameState.harvestFeedback`（跟 `harvestGatherNode()` 同一套 toast 機制），標題固定「採花」、內文「物種名稱 ×數量」。
- `context-interaction-ui.ts` 的 `targetForFlower()`：跟 `targetForGather()` 平行，動作標籤是「採集{物種名稱}」（例如「採集白雛菊」），跟「砍柴」/「採石」放在同一組情境互動選單裡。
- `scene-registries.ts` 的 `flowerNodeMeshes`：跟 `gatherNodeMeshes` 平行的一份獨立登記表，沒有塞進 `gatherNodeMeshes` 本體——因為 `context-interaction-ui.ts` 對 `gatherNodeMeshes` 的既有 `forEach` 直接綁 `targetForGather()`（只認得 wood/stone），混進來要嘛污染那段既有迴圈要嘛另外判斷種類，不如比照 `oreNodeMeshes` 開一份平行表乾淨，wood/stone 的既有程式碼路徑完全沒被動到。
- `build-map.ts`：`mountain`/`livingArea` 兩個地圖區塊都在既有 `makeWoodPile`/`makeStonePile` 呼叫之後，加一段 `FLOWER_NODES.filter(...).forEach(...)` 呼叫 `makeFlowerCluster()`，模式跟木材/石頭一致。
- `input-save.ts`：
  - 存檔：`flowerNodes: JSON.parse(JSON.stringify(FLOWER_NODES))`，跟 `woodNodes`/`stoneNodes` 同一行風格。
  - 讀檔：`data.flowerNodes` 存在就還原；野花系統上線前的舊存檔沒有這個欄位時，直接呼叫 `refreshGatherNodes(true)` 整批重灑（木材/石頭/野花都重新灑一次），圖的是簡單、一次性的遷移成本，比只補野花、木石維持舊座標的做法單純。
  - E 鍵鄰接採集：跟木材/石頭同一段大 keydown handler 裡加一段平行判斷（曼哈頓距離 <=1、`hasTool("sickle")`），呼叫 `harvestFlowerNode()`。沒有加飛散木屑/碎石那種演出——鐮刀目前沒有專屬音效可用，先不比照木材/石頭多做一套。
- `item-catalog.ts`：5 個新 item id，`edible: false`。
- `inventory-system.ts`：`itemAmount`/`changeItemAmount`/`moveItemToStorageAmount`/`moveItemFromStorageAmount` 都用 `isFlowerSpeciesId(itemId)` 這個型別守衛統一判斷（`wildflowers.ts` 匯出），對應讀寫 `inventory.wildflowers[itemId]`，不是 5 個各自獨立的 if 分支——這五個 item 性質完全一樣，用 pearls 那種「id -> 數量」表（`inventory.wildflowers: Record<FlowerSpeciesId, number>`）比照 wood/stone 那種各自獨立欄位的寫法更不重複。
  - `BAG_ITEM_TARGET_LONG_EDGE`/`HELD_ITEM_SCALE_MULTIPLIER`：5 個物種都給了比預設小一點的數值（花本身模型很小）。
  - `makeInventoryItemVisual()`：`isFlowerSpeciesId(itemId)` 時回傳 `makeFlowerSpecimen(itemId)` 正規化後的單朵花模型。
- `inventory-ui.ts`：背包格子清單（`inventoryEntries()`）比照 `PEARL_DEFINITIONS.forEach(...)` 的寫法加一段 `FLOWER_SPECIES.forEach(...)`，`tone: "flower"`（`style.css` 新增 `.inventory-slot-flower` 一條規則，粉色底），倉庫頁籤沿用同一份 entries、靠 `storedItemAmount()` 篩選，沒有另外維護第二份清單。

## 2026-09-01 第二輪實機調整：白雛菊描邊、蒲公英放大收緊

- **白雛菊描邊**：白色花瓣在沙地／淺色地面（尤其冬天雪地）幾乎融進背景。`wildflowers.ts` 新增 `radialPetalWithOutline()`（跟共用的 `radialPart()`平行，只有白雛菊用），同一個 holder 裡疊一層放大 1.3 倍、深色（`0x3a3128`）、`polygonOffset` 推到填色網格後面的描邊網格，避免 z-fighting。其他四個物種配色跟地面對比夠，沒有套這層。
- **蒲公英放大**：`makeDandelionHead()` 的花瓣從 `pointedPetalGeometry(0.05, 0.009)` 放大到 `(0.07, 0.013)`，基部離心距離從 `0.006` 放大到 `0.009`，其餘四個物種比例不受影響。
- **蒲公英花叢收緊**：`makeFlowerCluster()` 新增 `CLUSTER_SPREAD` 這張 per-species 表（跟 `inventory-system.ts` 的 `BAG_ITEM_TARGET_LONG_EDGE`/`HELD_ITEM_SCALE_MULTIPLIER` 同一種「`Record<id, number>` + 預設值」寫法），蒲公英是 `0.55`（花頭彼此散開的半徑乘 0.55，看起來更像一叢擠在一起的蒲公英），其他物種預設 `1`（維持原本的散開程度）。

## 三個「被程式碼現況解決」的規格書開放問題

規格書留了幾個問題請實作者依現況判斷，這裡照實記錄，之後系統升級時要重新考慮：

1. **999 堆疊上限**：規格書寫的是設計意圖，**這個專案目前所有資源(木材/石頭/魚/蘑菇……)都沒有實際的堆疊上限檢查**——`inventory.wood`/`inventory.mushrooms` 等全部都是不設上限的計數器。野花刻意保持一致、沒有為五個新 item 單獨造一套上限機制，避免野花變成整個背包系統裡唯一有上限的東西。之後如果要幫全部資源統一補上限，這裡要一起改。
2. **採集消耗體力**：規格書問「是否該像其他採集一樣扣一點體力」——**這個專案目前完全沒有體力系統**（只有一句劇情台詞文字提到「體力」，沒有對應的機制/數值/UI），連木材/石頭的 `harvestGatherNode()` 都不扣任何東西。野花維持零成本採集，這個問題目前無從回答起，等體力系統真的做出來再回頭補。
3. **沒帶鐮刀的提示**：規格書沒硬性規定用什麼 UX，這裡選擇跟隨這個專案既有的採集節點慣例——`targetForGather()`/`targetForPasture()` 沒帶對應工具時互動提示直接消失（回傳 `null`），沒有额外跳「你需要鐮刀」之類的 toast。這是既有模式，不是野花系統特有的取捨。

## 第 6 節：預留給之後的欄位/系統（這次不實作）

沿用規格書原文的「保留」清單，只是先把 item id 固定下來，避免以後要重新對應存檔欄位：

- 顏料系統：`FlowerSpeciesDefinition.pigmentColor` 欄位已經存在，顏料/染色玩法本身還沒做。
- 種子/播種：野花目前只能採集，沒有對應的種子 item 或可種植欄位。
- 花圃系統：農地上種花、自己顧的花圃，還沒做。
- 蜂箱：跟花朵連動的蜂蜜/授粉系統，還沒做。
- 送禮：五個野花 item 目前沒有掛進 NPC 送禮偏好表。
- 料理：野花目前不是任何食譜的材料。
- 節慶：跟野花相關的季節性活動/限定內容，還沒做。

## 季節

規格書 v1 明確五個物種全年可採，沒有季節限定/替換邏輯。程式碼裡刻意沒有對 `gameState.currentSeason` 做任何判斷——如果之後要加季節限定野花，改動點會在 `FLOWER_ZONE_SPECIES`（每區可用物種池）跟 `refreshGatherNodes()` 挑物種那段隨機邏輯，不用碰花頭幾何本身。
