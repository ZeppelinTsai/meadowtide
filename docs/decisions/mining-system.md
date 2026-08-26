# 洞窟採礦系統：src/mine.ts

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。


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


