# 專案筆記 — 《海風牧歌》 Meadowtide

目前正式程式是 **Vite + TypeScript + Three.js r128 的 ES module 專案**；入口為
`index.html` → `src/main.ts`。`meadowtide.html` 是模組化前的舊版遷移來源，
不是正式執行入口，除非使用者明確要求維護舊版，否則不要再修改它。

主要模組分工：

- `src/layout-maps.ts`：`LAYOUT`、`MAPS` 與純座標／地圖資料。
- `src/build-map.ts`：地圖與場景幾何建置。
- `src/main.ts`：啟動、場景接線與瀏覽器入口。
- `src/game-state.ts`：共享遊戲狀態與通用玩法資料。
- `src/game-loop.ts`、`src/game-clock.ts`：逐幀更新與遊戲時間。
- `src/scene-sky.ts`、`src/weather-particles.ts`、`src/music.ts`：天空、天氣與音樂。
- `src/*-quest.ts`：各角色劇情狀態機。
- `scripts/map-debug.ts`：可直接 import 地圖資料的 Node 除錯工具。
- `scripts/building-debug.ts`：检查缩放建筑的世界边界、门廊碰撞与最终门高。
- `public/assets/`：Vite 靜態素材；程式內以 `/assets/...` 或相容打包的相對 URL 引用。

所有 3D 視覺仍以程式生成的幾何圖形為主。這份筆記是接手專案前應先讀的規則與
已知陷阱，不是功能清單。

**專案名稱**：中文《海風牧歌》，英文 Meadowtide。海洋養殖（貝類/蝦蟹/陷阱）
是討論過的長期方向，但**還沒開始做**——現階段先把核心循環（種田＋NPC 排程
＋一點懸疑劇情）站穩，養殖等核心玩法確定好玩之後再往上疊，不要提早搶跑。

## 世界位置與四季星空

- 舞台設定為**北緯約 8°、四面環海、低光害的架空海島**。這個緯度讓北極星
  位於北方低空，也能讓南十字星等南天星群在特定季節升起；設計目標是四季
  合計看遍大部分南北天代表星空，不宣稱同一晚能看到所有星星。
- 星空由 `src/scene-sky.ts` 的 `SEASON_STAR_CONFIGS`、
  `CONSTELLATION_PATTERNS`、`makeSeasonStarGroup()` 程式生成。春夏秋冬各有
  不同密度、色溫與代表星座構圖，夏季另有密集銀河星帶。
- `updateSeasonalStars()` 依 `currentSeason` 切換配置、依 `nightFactor` 淡入，
  並依 `currentWeather` 遮蔽；晴夜最清楚，陰雨雪變淡，颱風、暴風雨與暴風雪幾乎不可見。
  星群會隨 `currentPhase` 繞天頂旋轉，模擬一晚中的東升西落。
- 適合增設正式觀星點的位置是碼頭末端或海邊小丘：面海、低光害、避開樹與
  房屋遮擋，並讓相機能抬向天頂。現階段尚未加入專用觀星相機模式。

## 技術限制（不要違反）

- **Three.js r128**：沒有 `THREE.CapsuleGeometry`（r142+ 才有），身體用
  `CylinderGeometry` + `SphereGeometry` 拼；沒有內建 `OrbitControls`。
- **圖片素材規則：3D 世界 vs UI 層，不是全面禁止外部圖片。** 3D 世界本身
  （地形、樹木、建築、走動的角色、天空）維持一路堅持的原則，全部用幾何
  圖形跟程式生成的漸層/貼圖(canvas 現畫)做出來，**不接外部圖片**——這條
  沒有變。但 UI 層（疊在畫面上的 2D 平面元素：對話框立繪、劇情 CG、之後
  可能的物品欄圖示）**允許使用外部圖片**，這是效能考量、不只是美術考量：
  UI 圖示是平面元素，用圖片比額外跑一次 3D 渲染管線再截圖便宜。素材放
  `public/assets/<用途>/`：立繪在 `public/assets/portraits/<npc id>.png`、劇情 CG 在
  `public/assets/cg/<cg id>.png`、音樂在 `public/assets/audio/bgm/`。程式碼不寫死
  本機絕對路徑。
  對話框的立繪/CG 載入都用 `Image().onerror` 偵測檔案存不存在，跟 BGM
  載入失敗的處理邏輯一樣：只在 console 警告、不中斷對話，圖檔還沒生成時
  版位就是空的，之後直接把 PNG 丟進資料夾就會自動生效，不用改程式碼。
- **使用 npm**：`npm run dev` 啟動 Vite；`npm run build` 先跑 TypeScript
  檢查再建置；`npm run preview` 預覽產物。Three.js 固定為 npm 套件 `0.128.0`，
  不要改回 CDN，也不要使用高版本才有的 API。

## 座標系統 — 先讀這段再動任何座標

- Grid-based，`TILE = 1` 單位。
- **JS 陣列的欄位不能是負索引**。x<0 目前是「地圖外」，`isBlocked()` 會
  直接判定擋路——這不是軟限制，是硬邊界。想要某個方向有更多可用空間，
  唯一做法是往陣列前面插入新的欄（`row.unshift(...)`），這會讓**所有**
  既有的 x 座標平移，是一次高風險、高工作量的操作，不要在小改動裡順手做。
- **`LAYOUT` 常數是唯一的資料源**（在 `MAPS` 定義之前）。房子、穀倉、牧場、
  農田、湖、山脈緩衝帶的位置/大小都在這裡定義，其他所有地方（`buildings`
  陣列、`PASTURE`、`BARN_DOOR`、`FARM_ORIGIN`、`HOUSE`、動物/NPC 落點）都
  應該從 `LAYOUT` 算出來，**不要在別的地方寫死新的絕對座標**。要調整某個
  區域的位置或大小，改 `LAYOUT` 裡對應的物件就好。
- **搬遷一個區域時，一定要把舊位置清回 `0`**，不是只在新位置寫值——這個
  專案裡已經因為忘記清舊位置留過兩次死資料殘留（湖、舊農田），靠除錯工具
  才抓到。

## Tile 數值圖例

| 值  | 意義                                 | 可走 |
| --- | ------------------------------------ | ---- |
| 0   | 草地                                 | ✓    |
| 1   | 牆/懸崖/建築佔地                     | ✗    |
| 2   | 樹                                   | ✗    |
| 3   | 門檻（觸發換場景，不擋路）           | ✓    |
| 5   | 路                                   | ✓    |
| 6   | 湖/水                                | ✗    |
| 8   | 沙灘                                 | ✓    |
| 9   | 海（合併成一整片動態網格，不逐格畫） | ✗    |

農地不是靠 tile 數值渲染的——`FARMLAND_TILES` 是獨立算出來的座標清單，
種植/收成/渲染都讀這個清單，不讀陣列本身的值。

## 朝向/旋轉的慣例 — 這裡出過至少兩次 bug

- **人形角色統一高度為 `1.0` 世界單位**（鞋底到頭頂／頭髮主體頂端），接近專案
  原始低模角色比例，並以村長阿姨的
  `makeMayor()` 模型為基準。唯一常數是 `src/humanoid.ts` 的
  `HUMANOID_WORLD_HEIGHT`；新增或修改 `makeHumanoid()`、`makeMayor()`、
  `makeHeroPlayer()` 等模型時，先量未縮放高度，再用 `humanoidScale()` 換算，
  不要把呆毛、翹髮、帽飾等突出裝飾算進基準高度；這些要在統一身高之外額外
  延伸。也不要另寫任意縮放倍率，避免
  角色身體為了裝飾被整體縮小，造成視覺身高與腿長漂移。
- 玩家、NPC（`makeHumanoid`/`makeMayor`/`makeHeroPlayer`）的模型**臉朝本地 -Z**（鼻子、
  腮紅都釘在 z 為負的那一側）。移動時的正確公式是：
  `rotation.y = Math.atan2(-dx, -dz)`（不是 `atan2(dx,dz)`，這個正負號
  反過來會導致角色臉一直對著剛走過來的方向，不是要走去的方向）。
- 魚、動物（`makeFishProp`/`makeAnimal`）的模型**頭朝本地 +X**，跟人形是
  不同慣例。移動時要用：`rotation.y = Math.atan2(dx, dz) - Math.PI / 2`。
- 手/腳的擺動一定要用「肩膀/髖部支點群組 + 掛在支點下面的圓柱」，不要直接
  轉圓柱本身（轉軸會在圓柱中心，甩起來像斷肢漂浮，不是關節擺動）。動物的
  前後方向是本地 X 軸，所以腿要繞 **Z 軸**擺（不是 X 軸，那是人形的慣例，
  兩者相反）。
- **人形角色預設嘴型固定使用主角的微笑**：呼叫 `src/humanoid.ts` 的
  `addDefaultHumanoidSmile()`，維持兩條短斜線形成的淺笑弧。新增角色只可配合
  臉部位置調整整體 Y/Z 與顏色，不要另做 Torus 半圓、大嘴或下垂苦瓜嘴；只有
  劇情明確要求驚訝、難過等特殊表情時才另外製作。

## 除錯工具：`scripts/map-debug.ts`

在**改任何座標之前跟之後**都跑一次：

```bash
npm run map-debug -- --map=port --legend
```

這支工具會直接 import `src/layout-maps.ts` 的 `MAPS`。因此 `layout-maps.ts` 必須
保持無 DOM／WebGL 副作用，不能 import 最終會建立 renderer 或讀取 document 的模組。
工具會印出文字版地圖網格。
用來在改動前後快速確認：

- 新舊區域有沒有重疊
- 視覺渲染的座標跟碰撞判定的座標是不是同一組數字（這個專案至少犯過一次：
  懸崖碰撞已經移到新座標，走廊的視覺台階卻忘記跟著移）
- 有沒有殘留的死資料（搬遷後忘記清乾淨的舊值）

工具目前只印地圖網格跟 `buildings`/`playerStart`，`--landmarks` 是預留的
空殼（疊印 NPC/裝飾物位置），還沒實作。

## 建筑缩放除错：`scripts/building-debug.ts`

建筑外观使用 `visualScale` 放大时，视觉边界、门廊通道与运行时碰撞统一由
`src/building-scale.ts` 计算，不要在 `isBlocked()` 另写一套缩放公式。

修改建筑尺寸、缩放、门位置、门高或建筑排列前后都运行：

```bash
npm run building-debug
```

输出中每栋建筑会列出：

- `scale`：最终视觉缩放倍率。
- `bounds=(minX,minZ)..(maxX,maxZ)`：放大后的世界坐标边界，用来检查房屋重叠、
  穿模及平台是否够宽。
- `doorX` / `corridorHalf`：门中心与门廊碰撞通道半宽；主角四角碰撞必须能通过。
- `doorHeight`：缩放完成后的最终世界门高，不是缩放前的局部几何高度。

主屋、动物小屋及旧城镇每栋房屋都必须出现在报告中。改动完成后还要跑
`npm run build`；涉及地图位置时，另按上节要求在前后跑 `map-debug`。

## 辅助程序与新规则

- 遇到需要反复人工计算或容易产生两套答案的问题（坐标平移、视觉缩放与碰撞、
  门廊、资源清单、存档结构、NPC 排程、数据引用完整性等），**可以并建议新增
  辅助程序**，不必继续靠目测或一次性的手算。
- 可复用计算优先放在无 DOM／WebGL 副作用的 `src/` 纯数据模块；运行时与辅助程序
  必须 import 同一个计算来源，禁止复制公式到两个文件。
- 可执行检查放在 `scripts/`，并在 `package.json` 增加语义清楚的 npm script；不要
  留下只能由作者记得如何执行的临时脚本。
- 新辅助程序必须在本文件记录用途、完整命令、何时必须运行，以及关键输出如何
  判读。若检查到越界、重叠或资料不一致，程序应尽量用非零退出码失败，而不是
  只打印一条容易忽略的警告。
- 新规则可以直接补进 `AGENTS.md`，但必须说明规则保护的单一资料源、已发生或容易
  发生的失败模式，以及对应验证命令；不要只写没有可执行判准的口号。
- 辅助程序必须维持可在 Node 环境直接 import 的边界，不得为了检查数据而启动
  renderer、读取 `document` 或依赖浏览器全局。

## 已知還沒做 / 刻意簡化的部分

- **F2 俯視規劃模式**（格線、半透明分區、方向鍵搬動整塊區域、即時檢查
  重疊/超界）：討論過，屬於下一輪的獨立工程，還沒開始做。
- 城區、果園、休息區、花園、碼頭、瀑布目前是**平面/方塊佔位**，沒有細節
  （沒有窗戶屋頂、沒有真的水流動畫），佈局優先，美術之後回頭補。
- 動物、NPC 沒有真的路徑規劃避開新地形變化（例如懸崖/斜坡），目前只在
  已知安全的區域內活動。

## NPC 招募流程 —— 已有第一個實作範例（木匠）

不再是「設計中」，`src/carpenter-quest.ts` 裡的「木匠抵達」是第一個真正的劇情
事件，跑在 `livingArea`／`oldVillage`／`port` 三張地圖骨架之上，之後其他
角色的招募流程可以直接複製這套框架：

- **狀態機**：單一個 `carpenterQuest.stage` 字串，只往前推、不回頭：
  `not_started → escorting → village_scene_done → construction →
ready_for_move_in → moved_in`。每個觸碰事件的 `action()` 自己檢查目前
  stage 該不該反應，不需要另外的「已觸發過」旗標——stage 一旦前進，原本
  的觸發條件自然就不再成立。
- **三段對話**：碼頭見面（port）、往舊城鎮路上抵達空屋（oldVillage）、
  入住當晚（oldVillage），全部用既有的 `showDialogSequence(lines,
onComplete)`（這次新加了 `onComplete` 參數，跑完最後一句才呼叫）。目前
  台詞都是佔位文字，等最終版本確認再填。
- **材料檢查**：`inventory.wood`/`inventory.stone`（這次新加的通用資源
  欄位，開局各給 10/5）在第二段對話結束時檢查，足夠就自動從背包扣除、
  進入 `construction`；不夠則退回 `en_route_village`，可以再次觸發。
- **天數延遲**：`beginNewDay()` 裡比對 `currentDay -
carpenterQuest.constructionStartDay >= CARPENTER_CONSTRUCTION_DAYS`
  （目前 2 天），到了就轉成 `ready_for_move_in`；空屋在這兩個 stage 期間
  會多立一個 `makeConstructionSign()` 施工告示牌。
- **NPC 現身**：`npcDefs` 裡的木匠本來就有 home/schedule，但事件完成前
  他的 mesh 是 `visible = false`（NPC 移動迴圈、E 鍵互動查詢都會跳過
  隱藏的 NPC），直到入住場景播完才真正出現、開始照排程走動。
- **帶路演出**：港口事件先黑幕，再顯示村長與木匠的實際 3D 模型；`escorting`
  階段兩人不是自行尋路追趕，而是重播玩家的歷史 X/Z 座標與朝向，像貪吃蛇
  尾巴一樣依序緊跟。Y 高度不可從歷史點插值，必須用該點目前的 X/Z 呼叫
  `game-loop.ts` 的 `characterGroundY()`；主角逐幀落地、最後高度校正與演出 NPC
  必須共用這個函式，才能貼合每一階樓梯；這也能確保他們
  不切進水面或扶手。跨到 `oldVillage` 時會清空並重建軌跡，抵達
  `CARPENTER_DOORSTEP` 才進入看房與材料檢查。舊存檔的 `en_route_village`
  讀取時會遷移成 `escorting`。
- 看房對話開始後 stage 雖已是 `village_scene_done`，村長與木匠仍必須留在
  尾巴／定點更新分支，禁止恢復 `livingArea` 的日常排程；直到材料檢查轉為
  `construction` 才隱藏演出模型。不得再讓最後的 `groundOffset` 只處理生活區／
  港口；舊村與山區若落回 0，會把主角和跟隨 NPC 拉進高台下方。
- **視覺**：沿用 `oldVillage.placeholders` 裡既有的一間空屋（座標見
  `CARPENTER_HOUSE`），入住後補一顆跟其他建築同一套 `windowMats` 系統
  驅動的窗戶，晚上自動隨 `nightFactor` 亮燈，不用另外寫特效。
- **存讀檔**：`carpenterQuest` 整包存進 `saveGame()`/`loadGame()`，讀檔
  時會一併還原木匠 mesh 的顯示狀態。

## 建議的工作方式

- 每次調整佈局：先跑一次 `npm run map-debug -- --map=<地圖名> --legend` 看現況 →
  改 `src/layout-maps.ts` 的 `LAYOUT`／`MAPS` → 再跑一次
  確認沒有重疊/沒有留死資料 → 改完再檢查一次視覺渲染座標有沒有跟著动。
- 用 git 版本控制取代之前那種「每次存一個新檔名」的做法（`v47`、`v48`…），
  這樣可以直接 diff 看每次改了什麼。
- **改任何 `src/` 正式程式前，先確認使用者的編輯器（VSCode 等）裡沒有未儲存
  的同檔變更，或至少確認分頁內容跟磁碟上的最新版本一致。** 這個專案
  已經發生過兩次「編輯器分頁存檔覆蓋掉 agent 剛做的改動」：一次是西側地形
  的渲染修正、一次是整個三地圖骨架（連同 oldVillage／port／buildMap 相關
  改動）消失了，而且好幾次提交都沒被發現。開工前務必先跟使用者確認目前
  檔案狀態，寧可多問一句，也不要事後才發現改動不見了。

## 背景音樂系統（來源：StockTune，公共領域授權，免費商用不用標示出處）

**架構決定**：嚴格單軌播放，不組合「天氣×季節×日夜」多首音樂。晴天依
`nightFactor` 選擇目前季節的日曲或夜曲；非晴天時，天氣曲會取代季節曲，
不是疊加。切換時先把舊曲淡出並停止，再淡入新曲，任何時刻最多只有一首音檔
實際播放。目前共 12 首：「季節×日夜」8 首 + 天氣 4 首。

**季節 × 日夜（8 首）**

| 季節 | 白天                            | 晚上                        |
| ---- | ------------------------------- | --------------------------- |
| 春   | Playful Springtime Garden Dance | Whispering Sakura Moonlight |
| 夏   | Summer Breeze Echoes            | Summer Evening Lake View    |
| 秋   | Autumn Leaves Serenade          | Moonlit Autumn Serenade     |
| 冬   | Winter's Quiet Piano Whisper    | Soft Blanket of White       |

**天氣（4 首，優先做這個而不是季節×日夜的全部組合）**

- 雨天：Raindrops on a Quiet Day
- 颱風：Tropical Storm Approaching
- 下雪：Icy Dawn Arising
- 暴風雪：Gliding Alpine White Peaks（刻意避開 black metal 風格的「blizzard」
  搜尋結果，那些太恐怖，跟遊戲調性不合）

### 音樂系統技術說明

- 音檔放在 `public/assets/audio/bgm/`，檔名遵循
  `StockTune-<曲名>_<數字>.mp3`。實際檔名與用途的對照集中在
  `src/music.ts` 的 `BGM_TRACKS`；加入新曲時先把 MP3 放進該資料夾，再在
  `BGM_TRACKS` 加一筆。若是季節日夜曲，還要把 key 放進
  `SEASON_MUSIC_KEYS`；若是天氣曲，key 要與天氣狀態名稱一致。載入失敗只會
  在 console 警告，不會中止其他音樂。
- `getSeasonIndex()` 負責季節判斷，目前 `DAYS_PER_SEASON = 3`，所以測試時
  每 3 天換季；正式版暫定改為 21 天。`rollWeatherForSeason()`
  依季節限制每日天氣（含晴、陰、雨、颱風、暴風雨、雪、暴風雪），`beginNewDay()`
  在 `currentDay` 改變時抽取新天氣。`updateWeatherEffects()` 驅動固定在場景世界座標的
  低成本雨線、雪片與春季櫻花粒子（不可掛在相機下，否則會像跟著主角移動）；
  春季晴／陰不分日夜都會飄花瓣，暴風雨另有閃電。
- `initializeMusic()` 在第一次鍵盤／滑鼠操作時建立 Web Audio API 音訊圖，
  避開瀏覽器自動播放限制。`updateMusic()` 以 `nightFactor` 選擇季節日曲或
  夜曲；陰天沿用季節曲，其他惡劣天氣選天氣曲取代旋律（暴風雨沿用颱風曲）。
  切換採舊曲淡出停止、新曲才淡入的單軌
  狀態機，所有音量變化都經過 `GainNode`。每個曲目 key 只建立一個 `Audio` 實例，播放 Promise
  也有防重入保護；淡出到零的非作用中曲目會暫停，不會讓全部曲目靜音空轉。
  `M` 鍵控制 master gain 靜音。
- StockTune MP3（48kHz/192kbps）不是為無縫循環製作，若日後聽到循環接縫，
  可調整 `BGM_LOOP_HEAD_SKIP` 與 `BGM_LOOP_TAIL_TRIM`，讓單一 Audio 實例在
  尾端留白前跳回有效開頭；最終仍建議離線修剪音檔頭尾。遊戲內的 GainNode
  淡入淡出負責換季、日夜及天氣銜接，不會修復 MP3 本身的循環接縫。

**還沒選、之後可能需要的分類**（使用者提過，還沒動手找）：慶典、房內、
戀愛事件、搞笑事件——這些是「特定場景觸發」的配樂，跟上面「環境常駐」
的音樂是不同層級，等對應的遊戲系統（節慶活動、室內場景、好感度/戀愛
事件、劇情觸發的喜劇橋段）真的做出來、需要配樂的時候再找，不要現在
選好晾在那裡。

## 遊戲時間節奏

- `TIME_CONFIG` 是唯一時間參數來源：現實 30 秒＝遊戲 1 小時、一天 24 小時
  （`dayLength = 720` 秒，約 12 分鐘一天）、`daysPerSeason = 21`（一個 21
  天月份對應一季）。若之後要讓一季包含多個月份，需另加月份層，不要只改
  這個常數。
- `elapsed` 是唯一累計時鐘；`updateGameClock()` 統一處理正常計時與 `N`
  快轉，跨日事件逐日觸發（不會因為快轉跳過中間天數的 `beginNewDay()`）。
- `SEASON_DAYLIGHT` 以遊戲小時設定四季日出日落；`getNightFactor()` 的
  結果供天空、太陽、月亮、燈光、音樂與星象共用。
- HUD 顯示季節內第 1～21 日與上／中／下旬。`F6` 儲存、`F9` 讀取，亦可
  呼叫 `saveGame(slot)`／`loadGame(slot)`。
- 流星由 `METEOR_CONFIG`、`METEOR_SHOWER_SCHEDULE` 管理；第 11～14 日為
  流星雨，第 13 日高峰。`meteorPool` 固定最多 16 個物件；室內、白天或
  不可見天氣會清空活動狀態，不會累積 geometry/material。
