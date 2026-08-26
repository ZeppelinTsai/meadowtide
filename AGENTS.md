# 專案筆記 — 《海風牧歌》 Meadowtide

目前正式程式是 **Vite + TypeScript + Three.js r128 的 ES module 專案**；入口為
`index.html` → `src/main.ts`。`meadowtide.html` 是模組化前的舊版遷移來源，
不是正式執行入口，除非使用者明確要求維護舊版，否則不要再修改它。

主要模組分工：

- `src/layout-maps.ts`：`LAYOUT`、`MAPS` 與純座標／地圖資料。
- `src/build-map.ts`：地圖與場景幾何建置。
- `src/main.ts`：啟動、場景接線與瀏覽器入口（開局流程本身在
  `src/title-screen.ts`，見 `docs/decisions/title-screen.md`）。
- `src/game-state.ts`：共享遊戲狀態與通用玩法資料。
- `src/game-loop.ts`、`src/game-clock.ts`：逐幀更新與遊戲時間。
- `src/scene-sky.ts`、`src/weather-particles.ts`、`src/music.ts`：天空、天氣與音樂。
- `src/*-quest.ts`：各角色劇情狀態機。
- `src/prologue.ts`：開場第一天演出（序幕），見
  `docs/decisions/prologue-cutscene.md`。
- `scripts/map-debug.ts`：可直接 import 地圖資料的 Node 除錯工具。
- `scripts/building-debug.ts`：检查缩放建筑的世界边界、门廊碰撞与最终门高。
- `scripts/audit-raw-coordinates.ts`：掃出 `LAYOUT` 外寫死的座標，複查清單。
- `src/region-paint.ts`、`src/map-shift.ts`：地圖區域安全重繪與座標平移工具。
- `src/i18n.ts`：多語言查表骨架（`t()`/`setLocale()`），目前只有木匠事件掛了翻譯。
- `public/assets/`：Vite 靜態素材；程式內以 `/assets/...` 或相容打包的相對 URL 引用。

所有 3D 視覺仍以程式生成的幾何圖形為主。**這份筆記是接手專案前應先讀
的硬規則、驗證命令與檔案索引，不是功能清單、也不是完整的架構文件或
歷史紀錄**——那兩類內容分別搬到了下面「文件索引」指的
`docs/decisions/`（仍然有效的架構/系統設計決策）跟
`docs/history/changelog.md`（逐輪除錯/建置的稽核軌跡，只在想知道
「這個 bug 當初怎麼查出來的」時才需要翻）。未來新增規則時，先問自己
「這是不會過期的硬規則」還是「這是某個系統目前的設計」——前者留在
這裡，後者去 `docs/decisions/`，不要無差別一律往這份文件塞。

**專案名稱**：中文《海風牧歌》，英文 Meadowtide。海洋養殖（貝類/蝦蟹/陷阱）
是討論過的長期方向，但**還沒開始做**——現階段先把核心循環（種田＋NPC 排程
＋一點懸疑劇情）站穩，養殖等核心玩法確定好玩之後再往上疊，不要提早搶跑。

## 文件索引

- **`docs/decisions/`**：仍然有效的架構/系統設計決策，一個系統一份
  檔案（音樂/音效、採礦、釣魚 QTE、搖桿、i18n、NPC 招募模式、
  showChoice UI、水體生成、鏡頭級距、世界觀/星空、時間節奏、序幕
  過場、標題畫面……）。改動對應系統前先看這裡。
- **`docs/history/changelog.md`**：逐輪除錯/建置紀錄，照時間順序，
  純稽核軌跡，不是規則。
- **`docs/roadmap/`**：開發優先序與曝光策略（原本存在 claude.ai 專案，
  現在搬進 repo 版控，理由跟 `docs/decisions/` 一樣——路線圖跟程式碼
  一起演進，兩邊各存一份容易分不清哪份才是最新）。claude.ai 專案端
  現在只留一句指引指回這裡。

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


## 系統速查（詳細架構決策見 `docs/decisions/`）

- 世界觀/星空（`scene-sky.ts`）→ `docs/decisions/world-and-sky.md`
- 事件演出鏡頭級距（zoom 2/5/10/20 這四個值）→ `docs/decisions/camera-zoom.md`
- 湖面／海面水體生成規則 → `docs/decisions/water-generation.md`（**這份是硬規則等級，改水體/岸線前務必看**）
- NPC 招募流程模式（以木匠為範例）→ `docs/decisions/npc-recruitment-pattern.md`
- 多語言 i18n 系統 → `docs/decisions/i18n-system.md`
- 背景音樂 + 一次性音效系統 → `docs/decisions/audio-system.md`
- 遊戲時間節奏、採集點刷新座標規則 → `docs/decisions/time-and-pause.md`
- 二選一提示 UI `showChoice()` → `docs/decisions/ui-choice-system.md`
- 洞窟採礦系統 `mine.ts` → `docs/decisions/mining-system.md`
- 釣魚 QTE 系統 `fishing.ts` → `docs/decisions/fishing-qte-system.md`
- 搖桿輸入與震動 → `docs/decisions/gamepad-input.md`
- 序幕過場（開場第一天演出）`prologue.ts` → `docs/decisions/prologue-cutscene.md`
- 開局標題畫面 `title-screen.ts` → `docs/decisions/title-screen.md`

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

