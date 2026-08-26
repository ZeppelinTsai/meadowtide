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
- `scripts/audit-raw-coordinates.ts`：掃出 `LAYOUT` 外寫死的座標，複查清單。
- `src/region-paint.ts`、`src/map-shift.ts`：地圖區域安全重繪與座標平移工具。
- `src/i18n.ts`：多語言查表骨架（`t()`/`setLocale()`），目前只有木匠事件掛了翻譯。
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
- **主角家與山區的雙向傳送點都固定在山腰平台右側內部，禁止再建平台外的連接走廊。** 山區回家門檻與進山落點分別使用
  `LAYOUT.mountain.homeGate`、`LAYOUT.mountain.homeArrival`；兩點必須分開，避免進山後立刻反向觸發。事件不得自行用
  `homeGate.x - 1` 或其他寫死座標推算。調整山腰輪廓後必須執行
  `npm run map-debug -- --map=mountain --legend`，確認 `homeArrival` 仍在可走格、
  與右側門檻連通，否則舊存檔或主角家傳送會把玩家送進岩壁。
- 生活區西側通往山區的外接石梯由 `LAYOUT.mountainGateway.visualBottomX`、
  `visualMinZ`、`visualMaxZ` 控制樓底落點，`makeMountainGateway()` 必須由這三個
  欄位推導樓梯方向、中心與寬度，扶手則沿用 `makeSteepStoneStairs()` 同步
  生成。目前樓底朝右、對準世界座標 `x=-1,z=16~19`；邏輯門檻仍只能放在
  合法的 tile `x=0`，不得為了視覺對齊把負索引寫進地圖陣列。
- **搬遷一個區域時，一定要把舊位置清回 `0`**，不是只在新位置寫值——這個
  專案裡已經因為忘記清舊位置留過兩次死資料殘留（湖、舊農田），靠除錯工具
  才抓到。
- **`LAYOUT.oldVillage.width` 不等於「城鎮的東側邊界」，兩者語意不同，
  不要假設改 `width` 只會影響地圖陣列大小**（2026-08-26 踩過的 bug，
  根因記錄）：`width` 原本身兼兩職——(a) tiles 陣列實際欄數，(b) 好幾個
  消費端拿來當「城鎮走得到的東側邊界」用，包括 `build-map.ts` 裡三個
  `addTerrace()` 地板填補呼叫（用 `width - 某起點X` 算寬度，補平台/階梯
  底下的實體地板）跟 `game-loop.ts` 鏡頭鎖定（`oldVillage` 分支用
  `width - 1` 當右邊界，把鏡頭釘在城鎮右上角）。第一次幫海邊新增沙灘/
  海域測試（往東擴 `width` 從 77→106）時，這兩處消費端**沒被告知**新增的
  29 格其實是還沒鋪好地板、不該算進城鎮框架的新海域，導致地板填補範圍
  跟著暴增整片、鏡頭鎖定邊界也跟著跑掉——玩家回報的「城鎮碰撞出問題會
  撞到樓梯」「房子跟城鎮整個平移、房子往下移動」都是同一個根因。**修法**：
  新增 `LAYOUT.oldVillage.townEdgeX = 76`（固定常數，**不**從 `width`
  推導，代表擴張前的城鎮真實邊界），兩個消費端改讀這個常數（terrace 用
  `townEdgeX + 1`，鏡頭用 `townEdgeX`），`width` 之後可以繼續為了新海域
  往東擴，不會再牽動這兩處。**之後任何人要再改 `LAYOUT.oldVillage.width`
  （包括 Codex 或其他 agent）都要記得：新增的範圍預設不算進「城鎮框架」，
  只有真的要擴大城鎮本體（不是加海/沙灘這種外圍地形）才需要同步調
  `townEdgeX`，否則地板填補跟鏡頭鎖定會照舊只認到 `townEdgeX` 那條線。**
  這次做法是新增獨立常數，沒有把 `width` 本身的語意收斂成單一用途——
  如果之後又冒出第三個消費端誤用 `width` 當邊界，比較徹底的解法是把
  `width` 改名或加型別註解強制區分「陣列大小」跟「城鎮邊界」兩個概念，
  目前先用 `townEdgeX` 這個補丁擋住已知的兩處。

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

## 湖面／海面水體生成規則

- 水體碰撞與視覺必須共用同一份最終資料：格狀海域以 `MAPS.<map>.tiles` 的
  tile `9` 為準；湖泊等曲線水體以 `isInsideLakeShape()` 這類純形狀函式為準。
  禁止在 `build-map.ts` 另抄一份岸線座標或重新推算另一個輪廓。
- 透明水面不可按「南海／西海／新增切除區」分批各畫一層後互相重疊。透明
  mesh 重疊會因 alpha 疊加形成淺藍矩形殘影，看起來像海底仍有舊地板。
  `oldVillage` 的做法是掃描最終 tile，每列把連續 tile `9` 合併成一段水面；
  同一海格只能有一層水面與一層深度遮罩。
- 把沙灘／陸地改成海時，順序必須是：先完成所有沙地與切除區 tile 重繪，
  再從最終結果生成水面。不得在水面建好後另外疊補一塊矩形水面；若地板幾何
  會露出，應依同一輪廓切分底板，而不是用更多透明水面遮蓋。
- 修改湖岸或海岸後必跑 `npm run map-debug -- --map=<name> --legend`、
  `npm run test:map-tools` 與 `npm run build`，並在實際 3D 畫面確認沒有透明
  重疊色塊、岸線穿插或可走沙地／不可走海面不一致。
- 拍岸浪花也必須讀最終 tile 的沙地 `8`／海面 `9` 鄰接邊界，不得另抄
  一份岸線座標。南岸使用 `findSouthernShoreSandZ()`、西岸使用
  `findWesternShoreSandX()`（`src/shore-foam.ts`）；`makeFoam()` 的
  `waveDirection` 必須朝陸地，南岸另旋轉 `rotationY=Math.PI/2` 讓浪花沿
  東西向岸線延伸。修改岸線或浪花範圍後同樣執行上述三個驗證命令。
- `foamMeshes` 這類逐幀動畫登記表必須在 `buildMap()` 開頭、任何地圖
  分支建立物件之前清空，再由該次建圖重新登記。禁止在共用海面收尾才清空：
  港口／舊城鎮會比收尾更早建立浪花，晚清空會留下畫面上的 mesh，卻讓
  `animate()` 失去登記項目，造成「生活區會動、其他地圖浪花靜止」。

## 採集點延後刷新與多 agent 提交

- 多 agent 同時操作 Git 時，若發現 `.git/index.lock`，先確認目前沒有仍在
  執行的 Git 程序；若鎖檔確為 **0-byte**，即可視為中斷後留下的殘留鎖，
  agent 應直接刪除該精確檔案後繼續，不必再向使用者詢問。非 0-byte、仍有
  Git 程序，或無法確認鎖檔身分時不得刪除，以免破壞正在進行的索引操作。
- 木材／石頭的 06:00、18:00 只產生新的刷新時段；留在原地時不得在玩家
  眼前重生或搬動。只有 `loadMap()` 發現目標 map name 與目前地圖不同時，
  才呼叫 `refreshGatherNodes()` 套用最新時段；洞窟同地圖換樓不算換圖。
- 多個 agent 同時工作時，各 agent 完成後只記錄、stage、commit、push 自己
  的變更；不得把工作樹中其他 agent 尚未提交的檔案或 hunk 一起帶進 commit。
  提交前用 `git diff --cached` 核對 staged diff，並在交付訊息寫明 commit。

## 朝向/旋轉的慣例 — 這裡出過至少兩次 bug

- **人形角色統一高度為 `1.0` 世界單位**（鞋底到頭頂／頭髮主體頂端），接近專案
  原始低模角色比例，並以村長的
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

## 地圖座標平移工具：`src/region-paint.ts`、`src/map-shift.ts`、`scripts/audit-raw-coordinates.ts`

解決的是這份文件裡「除錯工具找到最後一批死資料」「除錯工具抓到另一個舊帳」
反覆出現過的同一類問題：搬遷一個區域時，舊位置沒有真的清乾淨（湖、舊農田都
踩過），或是有座標寫死在 `LAYOUT` 外面、搬家時完全沒被動到。單一資料源仍是
`LAYOUT`；這三支工具不取代它，只是讓「依 `LAYOUT` 重繪」跟「整批搬遷座標」
這兩個操作不必再靠一次性手刻陣列與人工複查。

- **`src/region-paint.ts` 的 `repaintRegion(tiles, regionId, cells, newTileValue, clearTileValue?)`**：
  安全重繪一個具名區域——先清掉這個 `regionId` 上次畫過的格子（登記表記錄，
  不靠 tile 數值獨一無二），再畫新格子、更新登記表。**已用於**
  `LAYOUT.farm` 的走道繪製（見 `layout-maps.ts` 裡 `farm-paths` 那段）：農田
  走道跟一般道路共用 tile 值 `5`，不能像湖（`tile===6` 全地圖獨用）那樣直接
  「清掉所有該數值格子」，所以之前農田搬家完全沒有清舊資料的步驟，是已知
  但還沒發生過的坑。之後湖、行道樹等區域要不要也換成 `repaintRegion`，等
  真的要搬家時再改，不用現在全部換掉。整包地圖重新建置時記得呼叫
  `resetRegionPaintRegistry()`，避免登記表殘留上一輪建置的紀錄。
- **`src/map-shift.ts` 的 `expandTileGrid(tiles, direction, amount, fillValue?)`**：
  取代手刻 `unshift`/`push`/`splice` 陣列擴張（`NORTH_EXPANSION`、`X_OFFSET`
  當初就是這樣手刻的）。往南／東擴張時既有內容座標不變；往北／西擴張會讓
  既有內容整批位移，回傳值是實際位移量（收縮會被夾住，不等於輸入值）。
  搭配 **`shiftCoordinates(targets, dx, dz)`／`shiftCoordinatesDeep(target, dx, dz)`**
  批次位移一批帶座標的物件：除 `x/z/x1/z1/x2/z2/fromX/fromZ/toX/toZ` 外，
  也會移動語意明確的單軸世界座標（`doorX`、`entranceX`、`upperCoreEndX`、
  `deepCoreEndX`、`westEdge`、`rampX`、`startX/Z`、`visualX/Z`、
  `entranceStartZ`、`deepStartZ`、`beachStartZ/EndZ`、`minZ/maxZ`）；
  `width/height/spacing/offset` 等尺寸或相對偏移不動。往北擴張對應 `dz`、往西
  擴張對應 `dx`，只傳「這次真的要一起搬」的那個 `LAYOUT` 子物件（例如只傳
  `LAYOUT.oldVillage`），不要整包 `LAYOUT` 一起丟，否則會搬到不相干地圖的座標。
  舊城鎮目前由 `OLD_VILLAGE_OCEAN_EXPANSION` 在西側與南側各加 100 格海面；
  西擴的座標根節點必須包含 `OLD_VILLAGE_RAILS`，擴充後 `LAYOUT.oldVillage.width/
  height` 必須以實際 tile grid 回填。`npm run test:map-tools` 會驗證新增區域全為
  tile `9`、洞口／房門等單軸座標有同步移動、港口傳送仍連通。
  港口東側則由 `PORT_OCEAN_EXPANSION.east=50` 透過 `shiftMapLayout(..., "east",
  fillValue: 9)` 追加外海；東擴不得平移既有座標，完成後必須用 tile grid 實際寬度
  回填 `LAYOUT.port.width`。同一組測試會確認新增 50 欄全為 tile `9`、玩家起點與
  舊城鎮傳送端點未移動。
  `makePortScene()` 的北側港區高台右緣必須使用 `LAYOUT.port.eastOceanCutout.x`，
  禁止再由擴張後的 `LAYOUT.port.width` 反推；否則港口東擴時高台模型會一起被拉長，
  即使 tile 已改成海，畫面仍會被高台遮住。
- **`scripts/audit-raw-coordinates.ts`**：風險清單產生器，不是自動修復或
  pass/fail 檢查（找到的項目不是 bug，只是「平移工具碰不到、要人工判斷」的
  提醒，所以刻意不用非零退出碼失敗，跟本節下面「應以非零退出碼失敗」的
  通則不同——原因寫在腳本開頭）。純 AST 掃描 `LAYOUT` 範圍以外、看起來像
  座標的物件屬性與變數宣告，抓不到 `worldLeft` 這種沒有 X/Z 結尾的邊界變數，
  當複查清單用，不是完整性保證。跑法：

  ```bash
  npm run audit-coordinates
  ```

  對 `layout-maps.ts`／`build-map.ts` 掃過一次的已知需複查項目：
  `build-map.ts` 裡 `northSeaWestX`/`northCliffStartX`/`plazaStairsEndX` 等
  程序化地形邊界常數，以及主屋／祠堂內部地圖的固定格子。世界地圖之間的
  傳送點已集中到 `LAYOUT` 與 `src/map-transitions.ts`，不應再出現在這份
  寫死座標清單；內部地圖格子不隨外部建築位置平移。

  測試：

  ```bash
  npm run test:map-tools
  ```

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

## 多語言（i18n）系統 —— 目前只有木匠事件是試點

`src/i18n.ts` 是查表骨架：`t(key)` 依目前語言回傳翻譯字串，key 用點分隔
對應巢狀結構（例如 `"carpenter.dock.mayorIntro"`）；`setLocale(code)` 切換
語言。**目前只有 `carpenter.*` 這一組翻譯是完整的**，對應
`src/carpenter-quest.ts` 木匠事件的四段對話、材料不足提示、村長／木匠的
對話框名牌，涵蓋 `zh`（預設）／`en`／`ja` 三種語言。其他對話（`npc-defs.ts`
的 `npcLine()` 閒聊、之後其他角色的事件）還沒接上 i18n，仍是純中文字串，
這是刻意先驗證機制堪用、不是遺漏——其他場景要上多語言時，照
`carpenter.*` 的結構在 `TRANSLATIONS` 裡新增一個頂層 key、把該場景的字串
換成 `t("key")` 呼叫即可，不用動 `t()`/`setLocale()` 本體。

**切換語言的方法（開發測試用）**：遊戲在瀏覽器跑起來後，打開 devtools
console，直接打：

```js
meadowtideI18n.setLocale("en")   // 切到英文
meadowtideI18n.setLocale("ja")   // 切到日文
meadowtideI18n.setLocale("zh")   // 切回中文（預設）
meadowtideI18n.getLocale()       // 查目前語言
meadowtideI18n.locales           // 列出支援的語言代碼 ["zh","en","ja"]
```

切換後**要重新觸發木匠事件的對話**（例如 F9 讀一個 `carpenterQuest.stage`
還在 `not_started`/`escorting`/`ready_for_move_in` 的存檔，或用
`carpenterQuest.stage = "not_started"` 手動重置後再走到觸發點）才看得到新
語言——已經顯示在畫面上的對話框不會即時重繪，因為 `showDialogSequence()`
是在觸發當下把整段對話陣列算好存進 `dialogQueue`，`t()` 只在那個當下被
呼叫一次。

**已知限制（刻意簡化，之後有需求再做）**：

- 沒有持久化：重新整理頁面或存讀檔都會回到預設語言 `zh`，語言不記在
  存檔裡。
- 沒有正式 UI 選單，只有 console 指令。
- 立繪／CG 素材不分語言，所有語言共用同一套 `public/assets/portraits`、
  `public/assets/cg`，不用另外準備多語言圖檔。
- 缺翻譯時 `t()` 會退回 `zh` 並在 console 印一行警告，不會讓對話框空白或
  丟例外；兩邊都查不到才會直接印出 key 本身當文字內容，方便一眼看出是
  哪一句漏翻。

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
  低成本雨線、雪片、春季櫻花瓣與秋葉；粒子不可掛在相機下，否則會像跟著主角移動。
  所有戶外粒子的 X/Z 範圍必須由 `getTileGridWorldBounds(MAPS[currentMap].tiles,
  WEATHER_PADDING)` 取得，禁止再寫固定 `WEATHER_BOUNDS` 絕對座標；切換地圖時
  `syncWeatherBoundsToCurrentMap()` 必須重新分布雨、雪、花瓣與秋葉。粒子容量與有效
  draw range 由 `scaleCountForWorldBounds()` 依地圖面積同步縮放，讓俯視縮遠或地圖擴建後
  仍維持近似密度。`INDOOR_MAPS` 是室內天氣遮蔽的單一資料源，房屋與鐘乳石洞窟
  不渲染戶外粒子。修改粒子範圍、地圖尺寸或室內清單後執行 `npm run test:map-tools`
  與 `npm run build`；春季晴／陰不分日夜都會飄花瓣，暴風雨另有閃電。
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
- `src/weather-schedule.ts` 是每季天氣排程的純資料計算來源：流星雨第 11～14 日
  固定晴天；夏季颱風／暴風雨前後固定雨天，冬季暴風雪前後固定雪天，兩類
  極端天氣每個 21 天季節最多各 2 次。排程會存入存檔，避免重開後改變。
  修改天氣機率、保護日或極端天氣規則後必須執行 `npm run test:weather`，測試
  若發現流星雨日非晴天、過渡日錯誤或極端天氣超量，會以非零退出碼失敗。

### BGM 優先序（2026-08-25 已實作地域這層）

播放哪一首曲目由高到低分五層：**特殊事件 BGM > 通用事件 BGM > 地域 BGM >
天氣 BGM > 季節 BGM**。目前只有「地域／天氣／季節」三層有實作，
「特殊事件」跟「通用事件」對應的遊戲系統（劇情節點、突發事件之類）還
沒做，先只是把優先序的位置定下來，之後真的要做時直接在
`updateMusic()` 裡的 `desiredKey` 判斷式插在 `locationKey` 之前即可，不
用重寫淡入淡出/單軌切換那套機制。

- **地域 BGM**（`src/music.ts` 的 `LOCATION_MUSIC_KEYS`，依
  `gameState.currentMapName` 查表）：特定地圖固定配一首常駐曲，蓋過天氣
  跟季節——玩家在洞窟裡不管外面在下雨還是下雪，一律播洞窟自己的曲子，
  離開地圖後才交還給天氣/季節那套邏輯。音量沿用 `MELODY_VOLUME`（不是
  `WEATHER_VOLUME`），因為地域常駐曲是氛圍旋律，不是要蓋過去強調的層。
  目前只有鐘乳石洞窟（向下的海之洞）配好了：`stalactiteCave` →
  `seaCaveAmbient`（*Moonlit Sirens Of Atlantis*，harp、mystical，呼應
  「亞特蘭提斯水晶層」跟女神領域的設定）。山之洞（向上、山神領域）的曲
  子也已經選好放進 `BGM_TRACKS`（`mountainCaveAmbient`，*Celestial Ice
  Cave Echoes*，harp、introspective，呼應雲頂/山神），但地圖系統還沒做，
  所以先不放進 `LOCATION_MUSIC_KEYS`——之後山之洞的地圖 key 一旦定案，
  在 `LOCATION_MUSIC_KEYS` 補一行 `山之洞map名: "mountainCaveAmbient"`
  就會自動生效，不用碰 `updateMusic()`。
- 新增其他地域曲時比照這個模式：MP3 丟進
  `public/assets/audio/bgm/`、在 `BGM_TRACKS` 加一筆、在
  `LOCATION_MUSIC_KEYS` 對應地圖 key 補一行即可。

**還沒選、之後可能需要的分類**（使用者提過，還沒動手找）：慶典、房內、
戀愛事件、搞笑事件——這些是「特定場景觸發」的配樂，跟上面「環境常駐」
的音樂是不同層級，等對應的遊戲系統（節慶活動、室內場景、好感度/戀愛
事件、劇情觸發的喜劇橋段）真的做出來、需要配樂的時候再找，不要現在
選好晾在那裡。

## 一次性音效系統：`src/sfx.ts`（2026-08-25 已實作，來源：Kenney 音效包，CC0）

- 跟 `music.ts` 的 BGM 系統是刻意分開的兩套：BGM 是常駐 loop、經
  `AudioContext`/`GainNode` 做淡入淡出的單軌狀態機；`sfx.ts` 是「觸發當下
  播一次就丟掉」的短音效（砍材、採礦、拋竿、收竿…），用原生 `<audio>`
  就好，不用接進 BGM 那張 `GainNode` 圖，兩者互不干擾、可以同時響。
  `sfx.ts` 刻意是零 import 的葉節點模組，不會捲進專案既有的循環 import
  問題（見下面「除錯」段落與 `scene-sky.ts` 相關踩雷紀錄），要新增音效
  只改這個檔案跟呼叫端就好。
- **播放**：`playSfx(path, volume?)` 播單一音效；`playRandomSfx(paths[],
  volume?)` 從一組候選路徑隨機挑一個播——同一個動作通常備好幾個變化版
  （kenney 音效包大多一組 5 個 `_000~_004`），每次隨機挑，聽起來才不會
  太機械式重複。兩者都建立在同一個快取機制上：每個音檔路徑對應一個
  `HTMLAudioElement`「範本」（`loadSfxTemplate()`，只建立一次並快取），
  實際播放時 `cloneNode(true)` 出一個新的一次性副本再 `.play()`——這樣
  連續觸發（連砍兩下、礦點很密集連採）可以疊播，不會被前一個播放中的
  音效打斷或卡住。`.play()` 的 Promise 失敗會安靜吞掉（`.catch(() =>
  {})`），不讓瀏覽器自動播放限制或缺檔問題打斷遊戲邏輯；缺檔案只在
  console 警告一次（跟 BGM 系統缺檔的容錯慣例一致），之後把音檔補進資料
  夾就自動生效，不用改程式碼。
- **音量**：`SFX_VOLUME`（目前 `1.0`，2026-08-25 從最初的 `0.55` 拉高——
  玩家反饋原本太小聲）是全域預設值，`playSfx`/`playRandomSfx` 都可以用
  第二個參數個別覆蓋，但目前四個呼叫點都用預設值。使用者提過之後會在
  主選單加音量設定選項，屆時直接把 `SFX_VOLUME` 換成讀取玩家調整過的值
  （或是在 `playSfx` 內乘上一個全域倍率）即可，四個呼叫點（見下方）完全
  不用跟著動。
- **已有的音效分類**（集中在 `sfx.ts` 底部維護，全部來自
  `public/assets/audio/sfx/` 底下的 CC0 素材，換音檔/加變化版本只改這裡，
  不用去每個呼叫點找）：`CHOP_WOOD_SFX`（砍材/砍礦共用的木質敲擊音，5 個
  變化）、`MINE_ORE_SFX`（採礦敲擊音，5 個變化）、`FISH_CAST_SFX`（拋竿，
  借用「丟骰子」的甩動+落地聲代表甩竿出去，3 個變化）、`FISH_REEL_SFX`
  （收竿，借用「皮帶扣具」的拉緊聲代表拉線回收，2 個變化）——後兩組是
  找質感最接近的替代品，音效包裡沒有專門的釣魚素材；之後補到專用音檔
  時直接換掉這兩個陣列的路徑即可，呼叫端不用動。
- **呼叫點**：全部集中在 `input-save.ts` 那個單一的 E 鍵
  `keydown` handler 裡——砍材/採石的 `harvestGatherNode` 成功分支
  （`granted > 0`）呼叫 `playRandomSfx(CHOP_WOOD_SFX)`；採礦的
  `harvestOreNode` 成功分支（`result.amount > 0 && result.tier`）呼叫
  `playRandomSfx(MINE_ORE_SFX)`；`fishingState` 從 `"idle"` 轉
  `"casting"` 時呼叫 `playRandomSfx(FISH_CAST_SFX)`；從 `"biting"` 轉為
  收竿結算時呼叫 `playRandomSfx(FISH_REEL_SFX)`。新增其他動作的音效時，
  比照這個模式：在 `sfx.ts` 加一組路徑陣列，在對應的遊戲邏輯分支呼叫
  `playRandomSfx()`，不用另外包裝或建立新的播放器。

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
- 木材／石頭採集點每天 06:00、18:00 各刷新一次；採集後整個模型立即消失，
  不使用 emissive 發光提示。每區、每批的數量以 `src/game-state.ts` 的
  `GATHER_NODES_PER_KIND` 為單一資料源，目前生活區西側、山區山腳與山腰
  都各為 3 木＋3 石，山頂不生成。隨機座標必須從 `MAPS` 的可走草地與
  `LAYOUT.mountain.foot/waist` 推導；山腳／山腰只可生成在各層
  `LAYOUT.mountain.plazas` 的平地上，且須靠近 `LAYOUT.mountain.trees` 的
  既有樹木，避免散落到玩家難以搜尋的平台角落。木石不得共用座標；修改後執行
  `npm run map-debug -- --map=livingArea --legend`、
  `npm run map-debug -- --map=mountain --legend` 與 `npm run build`。
- 生活區採集點只可在 `LAYOUT.livingArea.gatherZone` 定義的西側範圍生成，
  目前為 `x=0～2、z=3～36`；並須依同一物件的 `mountainGateClearance`，排除
  `MOUNTAIN_GATE_BLOCKER` 周邊，避免木石掉在山區傳送點附近。魚池左上岸的六棵遮陽樹
  由 `LAYOUT.lake.shadeTreeOffsets` 定位，碰撞 tile 與季節變色樹模型都從這份
  資料推導；移動魚池時不可另留寫死的樹座標。
- 生活區西側背景山坡的基準角度由 `LAYOUT.mountainBand.slopeDegrees` 控制，
  目前為 30°；`makeWesternMountainTerrain()` 必須從這個角度計算線性抬升，
  不可另寫非線性高牆公式。修改後執行 `npm run build`。

## 傳送點與整張地圖平移（2026-08-25 已實作）

- `src/map-transitions.ts` 的 `createTransitionEvents()` 是世界地圖雙向連線的
  共同產生器；event 的門檻與抵達點在觸發當下讀取 `LAYOUT`，不複製座標。
- 傳送端點由它實際所在的地圖持有。例如生活區端點在
  `LAYOUT.livingArea`，港口端點在 `LAYOUT.port`。禁止把兩張地圖的端點塞進
  同一物件，否則只搬一張地圖時會誤搬另一側。
- `src/layout-maps.ts` 的 `MAP_SHIFT_REGISTRY` 是 map id 到地磚、座標根節點、
  `playerStart` 的所有權清單。整張地圖平移必須呼叫
  `shiftRegisteredMap(MAP_SHIFT_REGISTRY, mapId, direction, amount)`；北／西擴張
  會同步平移地磚座標、建築／地形資料、玩家起點與該側傳送端點，南／東擴張
  不改既有世界座標。
- 地磚碰撞與縮放建築碰撞仍是兩套系統；哪些建築資料會跟著搬，明確列在該
  map id 的 `coordinateRoots`，不可假設掃描 tile 就能找到建築。
- **任何地形切口必須同步修改三層：地磚、碰撞、視覺。** 海岸、湖面、平台、
  樓梯與洞口等區域，必須先在 `LAYOUT` 建立唯一的具名範圍，再讓 tile 重繪、
  `isBlocked()`／建築碰撞，以及 `build-map.ts`／`props.ts` 的網格尺寸共同讀取它。
  禁止只把 tile 改成海或可走格就視為完成：底板、高台或水面若仍使用整張地圖的
  `width/height`，畫面可能完全不變，碰撞也可能與外觀不一致。修改後除了
  `npm run test:map-tools` 與 `npm run build`，還必須執行對應地圖的
  `npm run map-debug -- --map=<map id> --legend`，並實際重建／重進場景檢查視覺切口。
  港口 `eastOceanCutout` 是標準案例：tile 海面、港區高台右緣與水面起點都必須
  由同一物件推導。
- 修改傳送或平移邏輯後必跑 `npm run test:map-tools`。測試會檢查端點不漏移、
  不雙重位移，並以 BFS 驗證山區／舊城鎮／兩側南灘的抵達點到門檻之間仍有
  連續可走地磚，防止 `path()` 對零或負寬度靜默不畫。

## 二選一提示 UI：`showChoice()`（2026-08-25 已實作，同日改版成 FGO 風格）

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


## 洞窟採礦系統：`src/mine.ts`（鐘乳石洞窟 2026-08-25／山之洞 2026-08-25）

`mine.ts` 檔案分兩段：上半段是鐘乳石洞窟（向下版，`stalactiteCave`），
下半段是山之洞（向上版，`mountainCave`）。兩者共用同一套模板——房間
尺寸（50×50）、5 階樓層階層公式（`mineTierForFloor`/`mineOreForFloor`，
`ORE_TIERS`：銅/銀/金/星晶/神晶）、礦點生成演算法、`makeMineStaircase()`/
`makeMinePitRecess()`/`mineStairRotation()` 這幾個純幾何函式全部直接共用，
沒有另外發明。目前都是 25 層頂（原設計 50 層，`MINE_FLOOR_MAX`/
`MOUNTAIN_MINE_FLOOR_MAX` 之後要擴充直接改常數即可，不用重寫其他邏輯）。

**入口視覺**：兩個洞窟的入口岩堆共用同一個模板函式
`makeCaveRockEntrance(cave)`（`props.ts`，2026-08-25 從
`makeOldVillageStalactiteCaveEntrance()` 抽出來的通用版本，改吃
`{x,z,width,depth,entranceX,entranceWidth,entranceStartZ}` 形狀的 cave
參數）——`makeOldVillageStalactiteCaveEntrance()`/`makeMountainCaveEntrance()`
都只是餵不同 `LAYOUT` 座標的薄包裝，視覺（地面石筍、苔蘚；拱門口上方
原本垂吊的鐘乳石 2026-08-25 已拿掉，玩家反饋不要了）先 100% 一致，之後
真的要讓山之洞長得不一樣（比如換成乾燥岩壁）再另外分家。山之洞入口在 `LAYOUT.mountain.cave`，嵌在山腳平台
（`foot`）最北緣，鏤空邏輯在 `layout-maps.ts` 的 `makeMountainMapTiles()`
最後一步（無條件覆寫，不需要另外登記 `protectedClearings`）。

**核心差異只有一件事，而且兩個表徵都是同一個原因造成的**：鐘乳石洞窟
是「往下探索」，深處（樓層數字更大）在下方；山之洞是「往上爬」，深處
在上方（山頂）——深淺跟樓層數字的對應關係整個相反。做法**不是**在
`makeMineStaircase()`/`mineStairRotation()`（這兩個純幾何函式完全沒改，
`"up"`永遠是疊箱子造型、`"down"`永遠是凹坑造型，跟哪個洞窟無關）裡加
if/else 特判，而是讓 `mountainMineUpStairs(floor)`/
`mountainMineDownStairs(floor)` 的角落交替公式互換角色：

- `mountainMineUpStairs()` 回傳「深處（樓層+1，往山頂爬）」那個角落——
  套用鐘乳石洞窟 `mineDownStairs()` 同一條公式，頂層回傳 `null`。
- `mountainMineDownStairs()` 回傳「淺處（樓層-1，往出口/山腳）」那個
  角落——套用鐘乳石洞窟 `mineUpStairs()` 同一條公式，永遠存在（包含
  第 1 層，用來走出洞口）。

`build-map.ts` 畫這兩個點時，一樣是「`mountainMineUpStairs()` 那格放
`makeMineStaircase("up",…)` 疊箱子、`mountainMineDownStairs()` 那格放
`"down"` + 挖坑」——跟鐘乳石洞窟同一套渲染邏輯，模組會自動對調，渲染端
完全不用寫任何 if/else 特判。這正是玩家要求的「同層兩樓梯模組要對換」，
靠**角落公式對調**達成，不是渲染邏輯對調。

**連帶影響「要不要回鎮上」的提示邏輯要換**：鐘乳石洞窟的提示綁在
`mineGoUp()`（該洞窟的「上樓梯」＝出口方向）。山之洞的出口方向現在是
`mountainMineDownStairs()`，所以提示邏輯要綁在 `mountainMineGoDown()`
（`build-map.ts`）；「往上一層」的純樓層前進（踩了就走，沒有提示）才是
`mountainMineGoUp()`——命名剛好符合直覺：「往上爬」＝繼續深入山之洞，
「往下走」＝要離開了，跟鐘乳石洞窟「上樓＝要離開、下樓＝繼續深入」的
直覺方向正好相反。兩個洞窟的提示都用同一個 `showChoice()`（見上面
「二選一提示 UI」那節），文案照各自的方向調整措辭（「繼續挖礦」↔
「繼續往上爬」、「往上一層」↔「下一層」）。

**獨立狀態**：山之洞的樓層/礦點/BGM 全部是獨立的一份，不共用鐘乳石
洞窟那份，兩個洞窟可以各自停在不同樓層、互不影響：

- 樓層：`gameState.mineFloor`（鐘乳石洞窟）vs `gameState.mountainMineFloor`
  （山之洞），存讀檔（`input-save.ts`）分開存兩個欄位。
- 礦點：`ORE_NODES` vs `MOUNTAIN_ORE_NODES`（`mine.ts`），node id 前綴
  不同（`mine-*` vs `mountain-mine-*`），可以共用同一份 `oreNodeMeshes`
  登記表（`scene-registries.ts`）不會撞名；`harvestOreNode()` vs
  `harvestMountainOreNode()` 分開的採收函式，經濟（`inventory` 的
  `copper`/`silver`/… 欄位）目前是同一套，先不分家。
- 地圖/事件：`MAPS.mountainCave`、`LAYOUT.mountain.cave`；洞口觸碰/
  樓梯觸碰事件在 `build-map.ts` 的 `events` 陣列裡，跟鐘乳石洞窟那三個
  （`enterMine`/`mineGoUp`/`mineGoDown`）平行的三個（`enterMountainMine`/
  `mountainMineGoUp`/`mountainMineGoDown`）。
- BGM：地域 BGM 表（`music.ts` 的 `LOCATION_MUSIC_KEYS`）多一筆
  `mountainCave: "mountainCaveAmbient"`（曲目見上面 BGM 優先序那節）。
- 牆體/地板配色：跟鐘乳石洞窟同一套「依樓層礦石階層混色」寫法，各自
  讀各自的樓層欄位，互不干擾。
- 室內判定：`environment.ts` 的 `INDOOR_MAPS`（唯一資料源）加了
  `"mountainCave"`——跟鐘乳石洞窟一樣不顯示戶外天氣粒子（飄花/雨/雪，
  `weather-particles.ts`）也不顯示星空/流星背景（`scene-sky.ts` 的
  `skyDome`/`meteorLayer`，兩處都靠 `isOutdoorMap()` 判斷，改
  `INDOOR_MAPS` 這一個集合就同時關掉，不用兩邊分開改）。玩家明確說「以
  後會各自訂製效果跟背景」——這是先關掉共用的戶外效果，兩個洞窟之後
  各自的專屬氛圍（比如山之洞可能要飄雪或礦光粒子）是未做的坑，不要
  自己腦補加上去。

之後要把山之洞真的做出「50 層＋5 種新礦」的差異化設計（原始世界觀是
自然岩溶層/螢光微光層/石灰鐘乳層/地熱硫磺層/雲頂冰晶層，各層有自己的
環境/礦物）時，比照這節開頭「先套用同樣模板」的做法：加新常數、新
`ORE_TIERS`（或另開一份山之洞專用的階層表），不用重寫角落交替/事件
接線這些結構性邏輯。


## 釣魚 QTE 系統：`src/fishing.ts`（2026-08-26 核心邏輯已實作，畫面/演出待設計）

`fishing.ts` 是純資料/邏輯模組，跟 `layout-maps.ts` 同一個原則——不 import
THREE/DOM，方便之後寫測試或給其他工具共用。六階魚表（垃圾/小/中/大/魚
霸主/特殊）、竿具等級折扣公式（`max(0 或 1, 基礎QTE − 等級×3)`）、QTE
序列產生（`buildQteSequence`，direction 事件 + 額外插入不計入額度的
rush/暴衝事件）、三段式命中判定（完美/成功/方向錯誤/沒按）、張力增減量
表全部在這裡，數值都是草案（詳見專案文件 `claude/釣魚QTE系統設計筆記
v1.md`，裡面有完整設計來源、待確認事項、跟每一輪追加功能的實作記錄）。

**串接方式**（刻意的單向依賴，避免循環 import）：`game-state.ts` 只放
狀態欄位（`fishingState: "idle"|"casting"|"biting"|"reeling"`、
`stamina`/`staminaMax`、`rodLevel`、`fishingQte`、`pendingFishTier`）；
`input-save.ts` 擁有全部狀態機轉換邏輯（收竿判定、QTE 按鍵即時判定、
逐幀超時判定、`resolveFishCatch()` 收穫演出）——原因是它已經有
`scene`/`makeFishProp`/`playRandomSfx`/`inventory` 這些依賴，而且
`game-loop.ts` 本來就 import `input-save.ts`，這個方向不能反過來；
`game-loop.ts` 每幀只呼叫一次 `advanceFishingQte()` 加渲染 UI。

**拉扯期(reeling)方向輸入是獨立的 `keydown` 監聽**（不是 WASD 移動用的
`keys` held-state 物件）——因為判定要的是「這個判定窗內的第一下按鍵」
（edge-trigger），跟移動的「現在按著」語意不同，不能共用。`qte.judged`
旗標防止按鍵判定路徑跟逐幀超時判定路徑重複計算。

**移動鎖定範圍會隨需求擴大過一次**：一開始只鎖 `reeling`（拉扯期），
2026-08-26 改成整個釣魚期間（`casting`/`biting`/`reeling`，即
`fishingState !== "idle"`）都鎖住玩家移動（`game-loop.ts`）——拋竿後
角色就該站定等魚，不是只有拉扯期才鎖。**上鉤前（`casting`）現在可以按
E 取消**（`input-save.ts`），原本「casting 中途按 E 沒有作用」是刻意
設計，後來被明確要求改掉，不要誤以為是 bug 復原。

**UI**：`#fishHint`（`index.html`/`style.css`，bottom-center 固定文字框）
保留給 `casting` 提示跟收穫後的結果通知（釣到了/斷線了/跑掉了）；
`biting`/`reeling` 這兩個「要馬上按鍵」的狀態改用 `#fishActionHud`
（貼在主角頭頂正上方，每幀用 `new THREE.Vector3(player.x, player.y+1.75,
player.z).project(camera)` 算螢幕座標——這是跟著 `scene-sky.ts` 既有的
`.project(camera)` 太陽/月亮天際遮罩用法抄的技巧，第一次用在 DOM 定位
上），內含一條體力條 + 一個當下要按的按鍵/方向大字。兩組 UI 互斥顯示。

**已知簡化/未做**（完整清單見專案文件「還沒做」段落，這裡只列會影響
之後改動的部分）：只有 `livingArea` 地圖能釣魚（`nearWater()` 判斷綁在
`input-save.ts` 的 E 鍵處理，`currentMapName === "livingArea"` 這個條件
寫死）；體力扣了不會回、沒有下限門檻；`rodLevel` 有欄位但沒有任何升級
介面；魚的個性行為模版（快魚/深水魚/跳躍魚…）全部還是同一種隨機方向。

## 搖桿輸入：`src/gamepad-input.ts`（2026-08-26 已實作，**未經實機測試**）

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

## 波上宮風主殿：`makeShrineHall()`（`props.ts`，2026-08-26 已實作）

`LAYOUT.oldVillage.northBeachPlatform`(Codex 建的西北岸神社平台，含
`torii`/`cube`/`segments` 四段台地)原本的 `cube` 只是 `build-map.ts` 裡
直接畫的一個素色 `BoxGeometry` 佔位(Zeppelin 原話「你可以只建立主模就
好了」)。這輪補上完整建模：`props.ts` 新增 `makeShrineHall(cube)`，跟
`makeToriiGate()` 放在一起(同一組神社道具)，接在 `build-map.ts` 原本畫
`platformCubeMesh` 的地方，直接吃 `northPlatform.cube`(`{x,z,width,
depth,height}`)算尺寸位置——**改 LAYOUT 的 cube 座標/大小這裡會自動跟著
變，不用同步改 `makeShrineHall()` 本身**。

外觀：石灰基座→朱紅牆身(跟 `makeToriiGate()` 同一顆 `0xb33b2a`，主殿跟
鳥居才是同一組色)→米白長押(跟 `makeBuilding()` 預設牆色 `0xe8ddc7` 同一
顆)→深色四坡頂(沿用 `makeBuilding()`「先把旋轉烤進 geometry、mesh 上只
留縮放」的技巧，出簷比例 `0.85` 比一般房子(`0.72`)更誇張)→屋脊千木(chigi)
交叉裝飾→正面(+z，鳥居/樓梯那一側)迴廊列柱→雙開木門。內部完全不做——
這裡本來就設定「無法住人的簡化神社」。碰撞判定(`build-map.ts` 裡
`isBlockedByOldVillageRail` 附近那段直接讀 `cube` 的 x/z/width/depth)
沒有變，純視覺替換，`tsc` 過關。

**2026-08-26 追加：主殿北移 5 格**——Zeppelin 反饋「主殿離鳥居太近了
一點」，要求連著平台/沙灘一起往北(z 減)擴充搬移。改動全在
`layout-maps.ts` 的 `LAYOUT.oldVillage` 字面量，`makeShrineHall()`
本身完全沒動(如上一段所說，它只是吃 `cube` 算尺寸)：
- `northBeachPlatform.cube.z`：20→15（主殿本體北移 5）。
- `northBeachPlatform.segments[0]`：`z:18,depth:3` → `z:13,depth:8`，
  蓋住新 cube 範圍 `[15,21)` 並在北側留 2 格緩衝(維持原本緩衝量)；
  `segments[1..3]`、`torii(z:28)` 都沒動——平台仍是 13→32 連續一片，
  主殿到鳥居/樓梯的路徑沒斷，只是視覺上退後、跟鳥居之間空地變大
  (原本主殿南緣到鳥居只差 2 格，現在差 7 格)。

**同一天追加修正：`segments[0]` 寬度也要跟著改，不然接縫會凸出一塊
懸崖。** Zeppelin 截圖回報 `(104,21-22)` 有懸崖凸出去、問
`(103,21)`/`(97,21)` 是不是也要往北擴 5——這兩點正好是 `segments[1]`
(`x:-3,width:7`，世界座標 x=97~103)的西/東北角。原因：`segments[0]`
當時只跟著 `cube` 改寬度(仍是 `x:-2,width:5`，世界 x=98~102)，跟
`segments[1]` 的寬 7 對不齊，兩段交界(z=21)自然會有 1 格寬度落差，
讀起來就是一塊懸崖凸出去。修法：把 `segments[0]` 的 `x`/`width` 改成
跟 `segments[1]` 完全一樣(`x:-3,width:7`)，讓 z=13~27 連成一塊沒有
寬度落差的矩形；`cube`(主殿本體，寬 5)本來就置中疊在這塊更寬的
台地上，跟 `segments[1]`/舊 `cube` 原本的「台地比建築寬 1 格」關係
一致。玄武岩柱群跟 `makeNorthBeachPlatformRails()` 的扶手都是從
`segments` 動態算輪廓，寬度對齊後兩邊自動變乾淨，不用另外碰。

**踩過的坑，寫下來避免下次重犯：修這個問題時，一開始想過反過來讓
`segments[1]` 的 `z` 往北延伸去蓋掉 `segments[0]` 的範圍(而不是拓寬
`segments[0]`)——這個方向是錯的，沒有採用。`oldVillageNorthPlatform
Bounds()` 用 `.find()` 找 z 命中的 segment，只抓陣列裡**第一個**命中
的、不會取寬的那個。如果讓 `segments[1]` 的 z 範圍跟 `segments[0]`
重疊，重疊區間視覺上(`addTerrace` 兩段都各自畫自己的實心方塊，不會
去重)會鋪出寬台地，但碰撞/站立判定仍然只吃到先命中的 `segments[0]`
窄邊界，玩家會在看起來是平台的地方掉出去或浮空。**`segments` 之間的
z 範圍必須保持互不重疊**，這是這份資料結構沒寫在型別裡、但實際上
必須遵守的硬性前提，之後如果要再調這個平台要記得。
- `northBeach`(核心沙灘矩形)：`z:16,height:21` → `z:11,height:26`，
  北緣跟著主殿一起往北推 5，南緣(z=36)不動，東南側 EastFill/
  EastShelf/SouthEdge/SeaCutout/SandCorrections 等南側收尾規則完全
  沒碰。
- `northBeachOuterFringe.westDepths`/`eastDepths`：**這兩個陣列是用
  `northBeach.z` 當 index 0 的「定位索引」**(`z = northBeach.z +
  index`)，不是絕對座標——所以單改 `northBeach.z` 而不動陣列內容
  的話，南側(原本 z=31~35)已經調好的鋸齒岸線會整組錯位、甚至有
  幾排掉出陣列範圍變成沒有岸線細節。這輪是在兩個陣列**最前面各插入
  5 個新值**(對應新的 z=11~15)，讓原本第 0 項開始的舊資料整組往後
  挪 5 格、繼續對到跟以前一樣的 z，南側完全不受影響；新插的 5 個值
  只是照風格隨手排的鋸齒(0~2 之間)，沒有特別美術依據，畫面上如果
  覺得這段海岸線不夠自然可以再手動調整這 5 個數字。
- `oldVillageNorthPlatformBounds()`/`build-map.ts` 裡直接讀 `cube`
  的碰撞判定都是動態算的，不用另外改。`tsc --noEmit` 過關；這個
  環境跑不了 `vite build`/`tsx`(node_modules 是 Windows 那邊裝的，
  這個 device_bash 是 Linux，`@rollup/rollup-linux-x64-gnu`/
  `@esbuild/linux-x64` 都缺)，沒辦法在這裡跑起來看畫面，實際效果
  要 Zeppelin 進遊戲看。
