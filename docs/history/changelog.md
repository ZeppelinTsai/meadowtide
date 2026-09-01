# 開發歷史紀錄

> 這份是從 `AGENTS.md` 搬過來的逐輪除錯／功能建置紀錄，照時間順序排列，純粹是稽核軌跡（誰在什麼時候回報了什麼、怎麼查出根因、怎麼修的），**不是**還在生效的規則或架構文件——那些留在 `AGENTS.md`（硬規則/驗證命令）跟 `docs/decisions/`（仍然有效的架構決策）。要找「這個系統現在長怎樣」看 `docs/decisions/`；要找「這個 bug 當初是怎麼一路查出來的」才翻這份。

## event-system Phase 1：第一份真正接線的 StoryRuntimeBindings，F9 概念驗證（2026-09-01）

跟 Zeppelin／GPT 討論後定案的做法：不直接 migrate 序章或木匠，先寫一個
全新、跟現有劇情無關的小事件（`dev.phase1_probe.mayor_wave`，村長被
叫過來寒暄兩句再回去巡田），接一份真正的 `StoryRuntimeBindings` 實作
（`src/story/story-runtime-browser.ts`），用 F9 熱鍵手動觸發（見
`src/input-save.ts`），照四個停損標準驗收。詳細設計跟結論記在
`docs/decisions/event-system.md`「Phase 1」一節，這裡只記過程：

- 第一次跑 `test:story` 就抓到一個真的問題：測試事件的 ID 跟 textKey
  一開始寫成 camelCase，被 `story-audit.ts` 的 `ID_PATTERN` 擋下來（只
  准全小寫+底線）。改成 snake_case 後過關——這是正式系統的 audit 能抓
  、手刻腳本(carpenter-quest.ts 那種 camelCase key)抓不到的錯誤示範。
- Zeppelin 實際在遊戲裡按 F9 測過一輪：村長現身/移動/位置正常、鏡頭
  拉近、對話顯示、時間確實暫停，都過；只有淡出淡入「效果不明顯」。查
  出來是測試事件自己的 `holdMilliseconds` 給太短（250ms），比對
  `prologue.ts` 三處真正在用 `showLoadingScreen()` 的地方都是配 900ms
  的 `holdPrologueBlackScreen()`，改成 900 後 Zeppelin 確認「黑幕有了」
  。這次修復只動了事件資料裡一個數字，完全沒有動 binding／熱鍵邏輯，
  驗證了「資料跟邏輯分開」這個賣點是真的。
- 接線過程中也在 `time-pause.ts` 補了一個新的暫停來源 `"storyEvent"`
  ——原本想讓 `pauseTime` step 沿用既有的 `"event"`，但 `"event"` 每次
  都會被 `syncAutomaticPauseSources()` 依對話框開關狀態強制覆蓋，在
  沒開對話框的鏡頭空檔手動暫停會被立刻蓋掉，等於白設，是真的接上去
  才發現的坑。

四個停損標準全過，結論是這套正式系統值得繼續投資；要不要進下一步
（轉換木匠事件）留給 Zeppelin 決定。

## 開發用熱鍵改用 import.meta.env.DEV 自動擋掉正式版（2026-09-01）

Zeppelin 提醒之後會有 electron exe／純 HTML 靜態版好幾種出貨切片，每次
出貨前手動記得關掉開發用熱鍵容易漏。順手把 `src/input-save.ts` 裡
F4(鏡頭調整模式)／F8(序幕重播)／F9(event-system Phase 1 概念驗證)／
C(記錄鏡頭座標) 這四個開發用熱鍵都加上 `import.meta.env.DEV &&` 前置
條件——Vite 在 `npm run build` 產出的正式版這個值是 `false`，`build:win`
(electron 包)跟未來的 HTML 靜態版都是吃同一份 `vite build` 輸出，一次
擋掉兩種切片，不用每次出貨前手動檢查。另外盤點了幾個掛在 `window` 上
的 console 除錯入口（`saveGame`/`loadGame`/`meadowtideI18n`/幾個雙底線
前綴的內部除錯變數），這批風險較低（不會被誤觸，只能手動打字呼叫）
先只記錄沒有動，之後要出公開穩定版時再一起決定要不要收掉。清單跟細節
見新增的 `docs/decisions/dev-hotkeys.md`。

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

## 鐘乳石洞窟第25層開發用傳送點 + 天梯筆誤修正（2026-08-26）

對應 task.md「海底龍宮建模」/「雲上天宮建模」兩段筆記，這輪只做最小
範圍的兩件事，龍宮/天宮本體建模都還沒開始（那是更大的後續工作）：

1. **`[shrine]` 女神祠堂 (4,2) 新增開發用傳送點**——`女神祠堂`
   (`MAPS.shrine`，8x6 小房間，跟`北岸波上宮風主殿`是完全不同的兩個
   東西，別搞混：`shrine` 這個地圖 key 是生活區私人海岸那座女神
   祠堂)。玩家重生點 (4,4)，鳥居在 (4,3)，既有的回程觸發點在
   (4,5)。新加的觸發點在 (4,2)——玩家從南邊走進來會先穿過鳥居，
   再往北兩格就會踩到這個新點。踩上去會 `regenerateMineFloor
   (MINE_FLOOR_MAX)` 直接重生成鐘乳石洞窟第 25 層(目前的最深層)，
   再 `loadMap("stalactiteCave", mineUpStairs(MINE_FLOOR_MAX))`——
   跟 `mineGoDown()` 正常換樓層時的落點規則完全一樣，不是另外發明
   一套「抵達地點」。25 層本身沒有任何專屬內容，跟其他樓層一樣是
   隨機生成的洞窟房間+礦點(第 5 階礦，`mineTierForFloor(25)=5`)。
   這是純開發用的捷徑(方便之後建龍宮/測試不用手動下 25 層)，目前
   沒有視覺標記(踩到那個 tile 才會觸發)，也還沒決定要不要留到
   正式版——先能用，之後再看要不要拿掉或包裝成彩蛋。

2. **天梯的樓層筆誤：30 → 25**——`props.ts` 的
   `makeCelestialSpiralStaircase()`(2026-08-25 做的，透明懸空發七彩
   光、無扶手的螺旋梯，task.md 原始設計稿：「天梯 山之洞第25層的
   上樓樓梯」)當時的註解誤寫成「山之洞第30層」，而且只是獨立造型
   函式，沒有真的接進遊戲。這輪修正：
   - `mine.ts` 把 `MOUNTAIN_STAIR_A`/`MOUNTAIN_STAIR_B`(山之洞上/下
     樓梯角落座標常數，本來只在檔案內部用)改成 `export`。
   - `build-map.ts` 山之洞樓層渲染那段，`mountainMineUpStairs
     (mountainFloor)` 在頂層(`MOUNTAIN_MINE_FLOOR_MAX=25`)回傳
     `null` 那個分支(`if (mountainUp) {...}` 的 `else`)，改成放一座
     `makeCelestialSpiralStaircase()`，位置用
     `mountainFloor % 2 === 1 ? MOUNTAIN_STAIR_B : MOUNTAIN_STAIR_A`
     算出「如果有上樓梯會在哪個角落」，跟 `mountainMineUpStairs()`
     內部同一條奇偶公式，不是另外編一個座標。
   - **特意沒有動 `mountainMineUpStairs()` 本身的 `null` 回傳**，頂層
     是死路的碰撞/事件判斷完全沒變——這次只是在原本什麼都不畫的
     地方擺一座裝飾，暗示「此處通往雲上天宮，但現在還沒開通」。等
     `雲上天宮`(task.md 另一項，還沒構思完成)定案要接通時，才需要
     回來改 `mountainMineUpStairs()`/事件表，讓它變成真的可以往上
     走的樓梯。
   - `tsc --noEmit` 過關；這個環境跑不了 `vite build`，沒辦法自己
     看畫面，实際效果(天梯位置/大小/發光有沒有跟山之洞第25層的房間
     比例搭)要 Zeppelin 進遊戲看。

### 天梯實測回報三點微調（同一天）

Zeppelin 進遊戲看了第25層那座天梯，截圖回報三點，都在
`makeCelestialSpiralStaircase()`(`props.ts`)跟 `build-map.ts` 的呼叫端
調整，函式本身的踏面/發光/無扶手設計沒有變動：

1. **轉 180 度**——新增一個 `rotationDegrees?: number` 參數，疊加在
   每一階的角度計算上(`angle = i * angleStep + baseAngle`)。特意不是
   讓呼叫端對回傳的 `group` 設 `rotation.y`：這個函式每一階的座標是
   直接算成世界座標(`options.x + cos(angle)*radius`...)，不是先在
   原點建好、外面再套 `position`+`rotation`——對 group 設 rotation 會繞
   著地圖原點轉，不是繞天梯自己的中心，整座會飛到別的地方去。呼叫端
   現在傳 `rotationDegrees: 180`。
2. **階梯密度調高兩倍**——`steps`/`risePerStep`/`angleStepDegrees`
   同時砍半再乘二的關係(從 14/0.3/40° 改成 70 階、每階爬升
   0.15、每階轉 20°)：單圈半徑(`radius`)沒變，但同樣的爬升/角度
   範圍內塞進兩倍的階梯數，疏密感確實加倍。
3. **往上渲染到玩家視線範圍**——光密度加倍不會改變總高度(0.15x70=
   10.5，剛好是原本 14x0.3=4.2 的 2.5 倍，這個「順便更高」是密度
   調整的計算副作用，不是另外加的參數)。這個總高度是照 55 度俯角+
   正交投影(scene-sky.ts 的 TILT_DEG/camera)大概抓的，目的是讓螺旋
   頂端在畫面上盡量貼近/超出上緣，看起來像「一直往上、看不到底」，
   沒有精算相機視錐的實際世界座標——這個環境跑不了 vite build，
   沒辦法自己截圖驗證抓得準不準，如果實際玩起來還是不夠高/太高，
   直接調 `steps` 這個數字(維持 0.15/20° 那組密度不動)就好，不用
   連 risePerStep/angleStepDegrees 一起改。

`tsc --noEmit` 過關。

### 天梯第二輪微調：梯數 1.5 倍、寬度 3 倍（同一天）

Zeppelin 回報「改1.5倍梯數應該剛剛好」+「寬度也能調整成三倍嗎?」，
都在 `build-map.ts` 的呼叫端調整：

- **梯數**：從上一輪的 70 階(2.5倍高)改成 42 階。算法：「1.5倍」取的
  是相對『兩倍密度、高度不變』那個中繼版本(28 階，risePerStep/
  angleStepDegrees 砍半但沒加高)的 1.5 倍，42x0.15=總爬升 6.3，正好
  也是原始 4.2 的 1.5 倍——這裡刻意寫下來是因為「梯數的1.5倍」跟
  「高度的1.5倍」兩種算法在這組參數下剛好殊途同歸，都是 42，不是
  巧合湊出來的，之後如果哪個參數又要單獨調，要分清楚是在調哪一個。
- **寬度**：加寬的是 `treadWidth`(每一階踏面寬度)，不是 `radius`
  (螺旋半徑，維持 0.9 沒動)——0.62 → 1.86(x3)。這個密度下相鄰兩階
  的弧長間距只有約 0.31，遠小於 1.86，踏面彼此會明顯重疊，但材質
  本來就是半透明+`depthWrite:false`(函式裡原本就有的設計，為了讓
  疊在一起的踏面不會因為互相遮蔽出現硬邊)，所以這裡的重疊預期會
  融合成一條連續發光緞帶，不是破圖。
- `tsc --noEmit` 過關。「寬度」跟「梯數」這兩個詞在需求裡本來就有
  歧義(寬度可能指 radius 也可能指 treadWidth；梯數1.5倍的基準可能
  是原始14階、目前70階、或中繼28階)，這輪選了上面寫的那組解讀，
  如果 Zeppelin 進遊戲看了發現猜錯方向，這幾個參數都是獨立數字，
  直接說要哪個再改就好，不用整個函式重寫。

### 天梯第三輪：複製延長三倍 + 閃耀特效（同一天）

Zeppelin 回報「效果不錯，現在複製往上延長三倍，然後看能不能加點
閃耀特效」：

- **複製延長三倍**：`build-map.ts` 改成迴圈呼叫 3 次
  `makeCelestialSpiralStaircase()`，同一組參數(含 `rotationDegrees:
  180`)，只有 `baseY` 往上疊一個 segment 的總爬升(42x0.15=6.3)——
  是「複製」的字面意思：3 座完全相同的螺旋直接疊在一起，不是把
  角度也接著往上算變成一條連續大螺旋。3 座疊起來總高度 18.9。
- **閃耀特效**：新函式 `makeCelestialSparkles()`(`props.ts`，緊接在
  `makeCelestialSpiralStaircase()` 後面)——材質/貼圖直接沿用
  `scene-sky.ts` 星空系統的 `STAR_SPARKLE_TEXTURE`/
  `STAR_SPARKLE_COLORS`(四角十字星芒的貼圖，跟滿天星星同一顆)，
  維持場景「星芒」視覺語言一致；差異是 `sizeAttenuation: true`(掛在
  世界座標、會隨距離縮放，星空那套是掛在攝影機上、故意不隨距離縮放)。
  星點分 6 個 phase group，各自獨立一份 `PointsMaterial`，散落在整座
  (3倍高後)天梯周圍的圓柱體積內(半徑 0.9x1.6、高度 0~18.9)，數量
  150。
- **動畫走 `scene-registries.ts` 既有慣例**：新增
  `celestialSparkleMaterials`(`PointsMaterial[]`)登記陣列，`props.ts`
  只負責建幾何/材質不碰動畫，`build-map.ts` 建圖時把材質
  push 進這個陣列(`buildMap()` 開頭已經加了
  `celestialSparkleMaterials.length = 0` 清空，跟 `oreNodeMeshes`
  等其他登記表同一個模式)，`game-loop.ts` 的 `animate()` 逐幀用
  sin 波(每個 phase 各自不同頻率/相位，四次方讓亮暗對比更明顯)
  更新 `opacity`，公式抄 `scene-sky.ts` 的 `updateSeasonalStars()`
  裡 `sparkleMaterials.forEach` 那段。因為陣列只有進山之洞第25層
  才會有內容，`animate()` 裡不用另外判斷 `currentMapName`，其他
  地圖/樓層陣列是空的，`forEach` 自然不會做任何事。
- `tsc --noEmit` 過關。這個環境跑不了 `vite build`，沒辦法自己看
  閃爍效果的實際節奏/密度順不順眼，要 Zeppelin 進遊戲看。


## 船長角色建模：`makeCaptain()` + npcDefs/npc-runtime 掛載（2026-08-26）

策略討論後 Zeppelin 指示先做「船長」角色模組，依 agent.txt 的角色設定
（上班地點:港口，居住地點:不住島上，已固定；灰黑色髮、灰鬢角、船長帽；
海軍藍＋鏽紅配色；繩索羅盤是招牌道具；站姿「雙腳較寬、迎風站穩，一手
自然半握、另一手掌心向下」）跟 Zeppelin 提供的參考圖，做出低模角色：

- **`src/humanoid.ts` 新增 `export function makeCaptain()`**，緊接在
  `makeCarpenter()` 後面、`makeGirlPlayer()` 前面，沿用村長/木匠那套
  「pelvis/torso 圓柱 + 左右對稱裝飾 + 頭部細節 + arm/leg pivot」的
  低模寫法，沒有另外發明新架構：
  - 海軍藍船員外套(敞開兩片，露出中間藍毛衣)、鏽紅頸巾(扁 Torus 環
    +垂下一角)、黃銅羅盤吊飾+小木牌(胸前，agent.txt 指定的招牌道具)、
    皮腰帶+皮囊、腰間一捆用 3 層 Torus 疊出來的盤繩(純裝飾，不是真的
    握在手裡，避免手部姿勢被繩子綁死)。
  - 頭部：灰黑短髮(只露後腦+兩側鬢角)、船帽(米色帽身+深藍帽緣，蓋住
    大半頭頂)、`addDefaultHumanoidSmile()` 沿用既有笑容組件。
  - **不對稱站姿是刻意的**：`makeArm(side)` 裡左手(`side===-1`)只給
    小角度 `rotation.z/x`，右手(`side===1`)給比較大的 `rotation.z`
    +`rotation.y=0.3` 做出「掌心朝下」的外轉感——這兩個軸
    `animateWalk()`/`animateRun()` 都只碰 `rotation.x`，不會被行走
    動畫洗掉，站定不動時姿勢會一直維持著。雙腳 pivot 的 x 偏移從
    木匠的 `side*0.105` 加寬到 `side*0.14`，外加 `rotation.z =
    side*-0.05`，做出「雙腳較寬」的站距。
  - `group.scale.setScalar(humanoidScale(1.34))`——比照村長/木匠的
    寫法自訂一個未縮放身高常數，不是量出來的精確值，純粹讓最終
    世界身高落在跟其他 NPC同一個量級。

- **`src/npc-defs.ts` 新增 `captain` entry**：因為 agent.txt 明講他
  「不住島上」，不像村長/木匠有一整天的散步行程，所以只給小範圍
  來回走動(檢查貨物繩索的感覺)，`home`/`schedule` 座標故意寫成
  `LAYOUT.port.basin.x`/`LAYOUT.port.ferry.z` 這種算出來的參照，
  對應 `props.ts` 裡渡輪跳板實際落地的位置(`gangplankStartX =
  port.basin.x - 0.3`)，不是憑空手填的數字——船長站在跳板碼頭旁，
  跟渡輪/跳板是同一組座標系統，之後 LAYOUT 數字調整不用跟著手動改。

- **`src/npc-runtime.ts`**：import 加 `makeCaptain`，mesh 建構的
  三元判斷式加一支 `def.id === "captain" ? makeCaptain() : ...`
  分支，維持既有「重要角色才有專屬模型函式，其餘 fallback 到
  `makeHumanoid()`」的慣例。沒有加任何可見度/任務階段限制——船長
  在 agent.txt 裡是「已固定」角色，不像木匠有登場前要隱藏的招募流程，
  所以從一開始就是常駐可見狀態。

- 刻意沒做的事(留給之後有需要再處理，這輪先求角色模型能進遊戲看)：
  沒有依白天/夜晚切換船長可見度(雖然渡輪跳板本身會在夜間收起，
  `ferryDocked = !isNightTime()`)，也沒有任何對話/事件邏輯——目前
  npc-defs 沒填 `id==="captain"` 專屬的 `npcLine()` 分支，會直接
  落到 `npcLine()` 最後那組通用好感度台詞，之後有船長專屬事件/
  對話再另外接。
- `tsc --noEmit` 過關，這個環境沒辦法自己跑 `vite build` 看實際
  模型長相，需要 Zeppelin 進遊戲確認比例/配色跟參考圖對不對得上。


## 港口渡輪改款：登陸艇造型 `makeCargoShip()`（2026-08-26）

Zeppelin 提出序幕的演出是「主角乘船而來」，希望港口那艘船做得精緻一點；
給了兩張參考圖(木造漁船配色/道具參考，非最終版面)，後續明確追加成
「登陸艇」規格覆蓋原本圖片裡的版面：

- **船頭跳板改整片正面放下**：船頭改成又寬又平(拿掉舊版尖船首用的
  stem/bowsprit)，local -X 那端(碼頭側)整面就是船頭牆，跳板從那裡
  直接連到碼頭，`makeGangplank()` 加了 `width` 參數(預設沿用舊版
  0.62，`makePortScene()` 這裡改傳 1.1)，讓牛羊整片走上去不用排隊。
- **配置整個頭尾互換**：駕駛艙(帶三片朝船頭的窗＋屋頂管線/小燈/短
  天線)搬到船尾(local +X，開放水域那端)；中段是固定的大型動物欄位
  (三面圍欄，跳板那側刻意留空讓牛羊直進直出，裡面擺了飼料槽)；船尾
  保留：遮陽棚長椅(鏽紅斜頂)、雞籠(線框箱+兩顆白色橢球代表雞)、
  堆疊貨箱。
- **配色/道具語言**沿用參考圖但換成登陸艇比例：米色船身＋墨綠鑲邊
  ＋深紅吃水線寬帶，甲板頂面用材質陣列(`[+x,-x,+y,-y,+z,-z]`)單獨
  換成木色，不用另外疊一層甲板 mesh；船身兩側掛 4x2 顆黑色輪胎當
  緩衝；船頭一角掛錨鏈+錨；駕駛室側牆掛白底紅十字條紋救生圈(白色
  Torus 疊兩條紅色細方塊十字交叉，低多邊形版本的救生圈紋樣)。
- **`ferryHullHalfWidth` 改名 `ferryHullHalfLength`**：舊名字誤導
  (3.6 其實是船體局部長度不是寬度，量的是「離碼頭最近那一端」的
  半長)，改款順便把變數名跟註解一起修正，數值/算法完全沒動——因為
  local +X 本來就是「靠碼頭那端」，這次只是把船頭跟船尾互換內容，
  該端本身的座標沒變，`makePortScene()` 算跳板落點的公式不用跟著改。
- **刻意沒改的東西**：`ferry` 的 `position`/`rotation.y`/`scale`
  三行完全沒動——船體局部 Y=0.5 的甲板高度不變量也保留著(見
  `makeCargoShip()` 開頭註解)，`gangplankEndY` 那行公式因此不用跟著
  改。船殼 hullLength 維持 3.6 沒放大，只放寬了 hullBeam(1.15→1.5)
  讓船頭看起來更寬平；乘上既有 `ferry.scale.set(2.05,1.7,1.7)` 之後
  整艘船世界尺寸自然跟著變寬約 30%。
- `tsc --noEmit` 過關。這個環境沒辦法自己跑 `vite build` 看實際外觀，
  需要 Zeppelin 進遊戲確認比例/配色，尤其是船頭跳板開口跟中段欄位
  的實際目測寬度是否真的夠讓牛羊順利通過。

### 登陸艇實測回報三點微調（同一天）

Zeppelin 截圖回報「很漂亮，可能要往左兩格並給上下兩側也加上護欄，
左側則是準備放下的板子先做放下的樣子我看看」：

- **往左兩格**：`LAYOUT.port.ferry.x` 從 13 改成 11。跳板長度是從
  `port.ferry.x - ferryHullHalfLength` 減去 `port.basin.x - 0.3` 現場
  算出來的，船往碼頭方向移近之後跳板自動變短，不用另外調公式。
- **上下兩側護欄**：原本只有欄位自己那圈矮圍欄(木色)、跟一段從欄位
  後緣到駕駛室的走道扶手(墨綠色，只蓋 penBackX→cabinFrontX 這一小段)
  ，兩者風格/高度不統一，从截圖角度看幾乎看不出來。改成一條統一的
  連續護欄：雙橫桿(y=0.15/0.32)+7 根柱，從欄位前緣(penFrontX，跳板
  開口後面那端)一路到駕駛室牆面(cabinFrontX)，船身左右對稱各一組，
  跟欄位自己的矮圍欄疊在一起(內外兩層)。跳板開口那段(x < penFrontX)
  維持開放，牛羊還是直進直出不受影響。
- **跳板先常駐放下**：舊版邏輯(沿用自原本的補給渡輪)是跳板靠
  `gangplankMeshes` 登記表跟著 `game-loop.ts` 的日夜切換收放，夜間
  視為「已啟航」收起——Zeppelin 這次是在夜晚畫面測試，跳板因此被
  收起來看不到。既然這艘船已經改款成登陸艇/固定交通船的定位，不再
  是「開走的渡輪」，這裡直接把 `gangplankMeshes.push(gangplank)` 那行
  拿掉，跳板改成永遠放下顯示。以後如果要做「收起」的出航動畫，再
  另外接開關就好，這輪只求先讓 Zeppelin 看到放下的樣子。
- `tsc --noEmit` 過關。

### 登陸艇第二輪微調：護欄延到船頭、跳板加寬（同一天）

Zeppelin 再回報「上下欄杆延長到船頭，然後跳板可能要上下擴張一格?
這樣90度收起來的時候才能把船綁起來」：

- **護欄延長到船頭**：原本兩側連續護欄只從欄位前緣(penFrontX=-1.1)
  開始，船頭轉角(-1.75)只有兩根單獨的矮柱框視覺範圍。改成護欄本體
  直接從 `railFrontX = -1.75` 起算，一路到駕駛室牆面(cabinFrontX)，
  原本那組獨立轉角柱拿掉(併進護欄自己的柱子序列裡，postCount 跟著
  從 7 加到 9 維持疏密一致)。船頭最前緣(跳板開口本身)還是沒有欄杆
  ——護欄只沿左右兩側走，不擋牛羊直進。
- **跳板加寬**：`makeGangplank()` 第二參數(寬度)從 1.1 改成 1.6，
  比船體 `hullBeam`(1.5)略寬一點。Zeppelin 的原話「上下擴張一格」
  若照字面(格=1 世界單位)會變成 2.1，這輪選了比較保守的解讀——
  寬度只要能蓋住整個船頭寬度(略超過 hullBeam)就滿足「立起來能封住
  船頭、當繫船點用」的功能性需求，不用真的加到 2.1 那麼誇張；如果
  Zeppelin 觀感上還是覺得不夠寬，這是單一個數字，直接說要多少再改
  就好。
- Zeppelin 這句「90度收起來的時候才能把船綁起來」透露的是之後的
  設計方向：跳板將來會做成可以立起/放下兩態的船頭艙門，立起時當
  封艙門+繫船點用。這輪還沒做實際的立起/收放互動或動畫，純粹是把
  尺寸留夠，之後真的要做收放開關時不用重算比例。
- `tsc --noEmit` 過關。

### 登陸艇第三輪：再往左一格、跳板真的沒踩到地面（同一天）

Zeppelin 回報「船再往左一格，讓板子直接放在地面，如果船高度跟港口
一樣可能要微調個0.5」：

- **再往左一格**：`LAYOUT.port.ferry.x` 11→10。
- **跳板沒踩到地面(找到實際原因)**：查了 `makePortScene()` 裡碼頭
  平台怎麼生出來的——`addPlatform(0, port.basin.z, port.basin.x,
  port.basin.height)` 用 `BoxGeometry(width,...)` 蓋石造平台，中心點
  `position.x = x + (width-1)/2`，實際涵蓋範圍是 `[-0.5, port.basin.x
  - 0.5]`(這裡 width 傳的是 `port.basin.x`=6，所以平台右邊緣在
  x=5.5)。原本 `gangplankStartX = port.basin.x - 0.3`(=5.7)落在平台
  邊緣外 0.2 格——跳板的落地端其實懸在水面上方，沒有真的踩在石造
  平台上，這就是「沒放在地面」的實際原因，不是高度算錯。改成
  `port.basin.x - 0.52`，對齊平台實際邊緣再往內縮一點點避免共平面
  接縫。
- **高度那句沒有跟著動**：實際算過，船甲板高度(`ferry.position.y +
  0.5*ferry.scale.y` = 0.15+0.85=1.0)本來就跟碼頭平台頂
  (`port.elevation`=1，平台 slab 頂面 `port.elevation-0.01`≈0.99)
  幾乎完全一致，跳板本來就是水平的，不是斜的——数字上不符合「船
  高度跟港口不一樣」的前提，所以沒有跟著調 0.5。這句話有可能是
  Zeppelin 自己在猜可能的原因，但這輪查到的是上面那個水平位置的
  bug，跟高度無關；如果這次修完 Zeppelin 進遊戲看，跳板落地那端
  還是覺得高度對不上，麻煩告訴我是「船看起來太高」還是「太低」，
  這樣才知道要往哪個方向調，不要用猜的動這個數字(牽動整艘船的水線
  位置，猜錯方向反而更難看)。
- `tsc --noEmit` 過關。

### 登陸艇第四輪：船抬高，跳板不再陷進碼頭（同一天）

Zeppelin 用截圖回報「主要是船要比港口高一點，不然板子就會像這樣陷入
港口，船高一點點，然後可能要量一下角度，讓板子剛好放到港口」——上一輪
我算過船甲板高度(≈1.0)理論上跟碼頭平台頂(≈0.99)幾乎一樣高，但實測
畫面裡跳板確實陷進碼頭正面，代表這個固定視角下實際需要的高度比純數字
算出來的更高(這輪不深究是不是攝影機透視關係，直接照 Zeppelin 給的方向
修)：

- `ferry.position.set(port.ferry.x, 0.15, ...)` 改成 `0.45`(+0.3)，
  船身明確抬高一截。
- 角度不用另外量——`gangplankEndY = ferry.position.y + 0.5 *
  ferry.scale.y` 這行本來就是現場用 `ferry.position.y` 算出來的，船
  抬高之後跳板的 `rotation.z`(用 `Math.atan2` 算)會自動跟著出現「從
  碼頭略微往上斜接到甲板」的角度，不用手動調轉角。
- 副作用要注意：船身抬高後，吃水線(waterline 深紅色那圈)離實際水面
  變遠了一些，如果 Zeppelin 覺得船看起來「浮太高、離水面太空」，這
  是同一個 `0.45` 數字的另一面，可以再往下調一點點找平衡點，不用當
  成另一個新 bug。
- `tsc --noEmit` 過關。

### 登陸艇第五輪：跳板吃模、寬度沒跟船身對齊（同一天）

Zeppelin 這輪回報「有一點點吃模了，板子調高一點點，然後加寬到跟船身
一樣?」：

- **跳板吃模**：跳板碼頭端的板面(`makeGangplank()` 局部 y=0.03)本來
  就只比平台頂高 0.03~0.04，斜度一上去很容易在接縫處共平面閃爍。
  加了 `RAMP_LIFT = 0.06`，把整條跳板(起點/終點一起平移)墊高一點，
  純粹是視覺淨空，角度計算還是用平移前的真實高度差算，不影響坡度。
- **寬度沒跟船身對齊(找到真正原因)**：`makeGangplank()` 產生的
  group 是直接 `group.add(gangplank)` 進場景，沒有跟著 `ferry` 那組
  `scale.set(2.05,1.7,1.7)` 一起縮放。上一輪把跳板寬度設成 1.6，
  理由是「比船殼局部寬度 `hullBeam`(1.5) 略寬」，但這個 1.5 是
  `makeCargoShip()` 局部座標系的數字，船殼經過 `ferry.scale.z=1.7`
  放大後，實際世界寬度是 `1.5*1.7=2.55`——比沒縮放的跳板寬了快一倍，
  這才是畫面上「跳板比船身窄」的真正原因。改成 `1.5 * ferry.scale.z`
  現場算，之後 `hullBeam` 或 `ferry.scale` 再調整都不用手動同步這個
  數字。
- `tsc --noEmit` 過關。

### 登陸艇第六輪：回答「改哪個參數能讓跳板更斜」（同一天）

Zeppelin 追問「我是說傾斜角度要有點，接港口的地方往上翹? 修改哪邊
參數」——這是在追問上一輪「板子調高一點點」的意思，釐清那句指的是
坡度角要更明顯，不是單純把整條板子平移墊高(上一輪的 `RAMP_LIFT` 只
是平移，沒有改變坡度)。

- 答案記在 `makePortScene()` 裡：跳板本身沒有獨立的角度參數，
  `gangplank.rotation.z` 是 `Math.atan2(gangplankEndY -
  gangplankStartY, gangplankLength)` 現場算出來的，兩個端點分別鎖定
  「船甲板實際高度」(`ferry.position.y + 0.5*ferry.scale.y`)跟「碼頭
  平台實際高度」(`port.elevation`)——這樣設計是為了保證跳板兩端一定
  真的接在船跟碼頭上，不會浮空也不會插進去。所以真正能調的旋鈕是
  這兩個端點的高度差，不是角度本身直接調。
- 這次把 `ferry.position.y` 從 0.45 再加到 0.65(+0.2)，高度差從 0.3
  拉大到 0.5，跳板斜度跟著更明顯——碼頭端固定不動，船那端墊更高，
  視覺上就是「接碼頭的那端往上翹」。如果 Zeppelin 覺得還不夠斜，
  同一個數字繼續加就好，不用改別的地方。
- `tsc --noEmit` 過關。

### 登陸艇第七輪：跳板真的穿模了，原因是船塢矮牆（同一天）

Zeppelin 回報「現在是跳板左邊的Z太低,導致接不上碼頭,會穿模」。追查
後跟 Z 本身無關，是撞到另一個結構：`makePortScene()` 裡框住船塢水面
的「三面碼頭矮牆」(west/north/south 三段 `BoxGeometry`，這裡指的是
西側那段)，X 範圍 `[port.basin.x-0.79, port.basin.x-0.31]`(=
`[5.21,5.69]`)、高度到 `port.elevation+0.27`(=1.27)，沿整條 Z 軸貫穿
整個船塢——而跳板碼頭端 `gangplankStartX≈port.basin.x-0.52`(=5.48)
剛好落在這段牆的 X 範圍正中間，Y(≈1.06)也落在牆的高度範圍內，等於
跳板落地點直接卡在牆的實心箱體裡，不是坡度/位置算錯，是真的撞到了
另一個沒考慮到的結構。

- **修法**：把西牆從一整條拆成兩段，中間在 `port.ferry.z` 挖一個
  `rampGapHalfZ=1.5` 的缺口(比跳板實際寬度 `1.5*ferry.scale.z=2.55`
  略寬，留邊界)給跳板通過，兩段各自算自己的長度/中心點，長度太短
  (<0.1)就不生成那一段(避免退化成負值或極薄的破圖)。north/south
  兩段矮牆(基座南北兩側)沒有跟跳板路徑重疊，維持原樣不動。
- 這樣修不用再靠「把船墊更高跨過矮牆」，也不影響上一輪剛調好的
  跳板坡度(`ferry.position.y=0.65` 沒有跟著再動)——纯粹是幫跳板在
  牆上開一個通道，跟真實碼頭的護欄/矮牆本來就會在舷梯位置留缺口是
  同一個道理。
- `tsc --noEmit` 過關。


## 船長站位微調（2026-08-26）

Zeppelin 反饋「船長站位改往左一格往上一格」。`src/npc-defs.ts` 加了
`CAPTAIN_STAND_X = LAYOUT.port.basin.x - 1`、
`CAPTAIN_STAND_Z = LAYOUT.port.ferry.z - 1` 兩個錨點常數，`home`/
`schedule` 統一改用這兩個算好的座標，不再各自散著用
`LAYOUT.port.basin.x`/`LAYOUT.port.ferry.z` 加減——之後船長站位還要
再調，只改這兩行常數就好，不用一個個座標找。`tsc --noEmit` 過關。


## 船長站定時面向玩家（2026-08-26）

Zeppelin 反饋「船長是不是應該轉180 我看不到臉」。查了 `game-loop.ts`
的 NPC 朝向邏輯：站定不動時的 `rotation.y` 是「上一段走過來的方向」
凍結住的；船長巡邏範圍很小(見 `npc-defs.ts` 的
`CAPTAIN_STAND_X`/`CAPTAIN_STAND_Z`)，不同時段回到 home 點時是從
不同方向走回來的，朝向會不一樣，硬轉 180 只能解其中一種情況，另一種
時段還是背對。

改成把既有「玩家靠近 4 格內、站定不動時緩慢轉向玩家」那段邏輯(本來
只認 `currentMapName === "livingArea"`，村長/木匠專用)的地圖判斷擴大
成也認 `"port"`。不是新機制，是重用同一套——之後 port 地圖上其他
站定的 NPC 一樣受惠，不用每個角色各自修一次。`tsc --noEmit` 過關。



## 序幕：開場第一天演出（2026-08-26）

Zeppelin 確認要開始做「主角乘船抵達港口」的開場演出，並回答了三個
規劃問題定案下面的形狀：

- **畫面**：不是靜態站位，是真的有走位的過場——船從外海(世界 +X，
  比停靠位再推 `SEA_OFFSET_X=18` 格)滑回停靠位、跳板從立起(90 度)
  放下、主角從甲板走出來、下跳板、走到碼頭。過程中先播「主角看傳單
  ＋船長喊快到岸了」的對話，等對話關掉才開始船隻靠岸的動畫。
- **在場角色**：船長負責「把人載過來」這條線；村長也在碼頭迎接(碼頭
  上的「三個開局角色」互相牽連的關係網，見更早的筆記)，兩人一起講
  歡迎詞，不另外拆成村莊那邊的第二場戲。
- **觸發**：偵測不到存檔(`localStorage["meadowtide.save.default"]`
  不存在)就自動播一次；另外留一顆 F8 熱鍵可以在已經站在港口地圖時
  無條件重播，不用清存檔。

**沒有另外蓋第二艘船**——直接借用 `makePortScene()` 裡本來就停在
碼頭、整場遊戲都在的那艘登陸艇渡輪(`ferry`)跟跳板(`gangplank`)。
`scene-registries.ts` 新增一個 `prologueRefs`(單一可變物件，理由跟
`gangplank Meshes` 那批陣列一樣：從其他檔案 import 進去的 `let` 沒辦法
重新賦值，只能改物件屬性)，`makePortScene()` 蓋完這兩個 Object3D 後
把參照＋「跳板靜止角度」／「船隻靜止 X 座標」一併存進去。新檔案
`src/prologue.ts` 演出時把它們暫時搬離停靠狀態(船推到外海、跳板轉成
90 度立起)，演出結束時兩者都會回到原本蓋出來的靜止狀態——所以這場
戲對其餘遊戲時間完全沒有副作用，也不用另外處理「演出跑完之後渡輪
要恢復原狀」這件事，因為根本沒有真的離開過那個狀態機以外的東西。

**移動鎖用新欄位 `gameState.cutsceneActive`，不是 `isGameTimePaused()`
那條路**——後者會把整個 `dt` 鎖成 0，連我自己要跑的船/跳板補間動畫
都會一起被凍結。`game-loop.ts` 的「自由移動」那一整塊(WASD 讀取／
碰撞判定／轉向平滑)包進 `if (!gameState.cutsceneActive) {...} else {
updatePrologueCutscene(dt); }`，`animateRun`/`animateSit` 呼叫維持在
外層不動(靠 `prologue.ts` 自己設對 `gameState.isMoving` 就會正常播走
路動畫)。另外把「主角 Y 疊加地形高度」那一行也包了同樣的條件——序幕
期間角色站在甲板/跳板斜面上，Y 完全由 `updatePrologueCutscene()` 自己
算(`ferry.localToWorld()` 讀甲板局部座標)，不能被拉回海平面/碼頭
高度，這是實作過程中發現、原本沒想到的一個坑，寫成明確註解免得之後
又被繞過去。

演出內部是一個小狀態機(`atSea → approaching → rampLowering → walking
→ greeting → done`)，`updatePrologueCutscene(dt)` 每幀跑一次、只在
`cutsceneActive` 為真時做事，其餘時間是 no-op，掛進 `animate()` 主迴圈
不影響平常效能。下船走位(`walking` 階段)沒有重用 WASD 那套碰撞判定，
是自己算好一串安全路徑點(甲板→跳板船頭端→跳板碼頭端→碼頭迎接點)直接
線性位移＋套用跟主迴圈同一條「模型鼻子朝 -Z，要多轉半圈」的轉向公式，
因為這條路徑是設計好的、不需要再跑一次通用碰撞檢查。

台詞是純中文字串，沒有走 `i18n.ts` 的 `t()`——照 `i18n.ts` 自己的說明，
目前只有木匠事件是刻意做多語言的試點，其餘事件(包含 `chef-quest.ts`)
都是直接寫中文，這裡跟著同一個慣例，之後真的要幫序幕上多語言時再一
起補。

**已知的簡化、之後可能要調的地方**（先求「有動作、順序對」，實際
畫面效果要 Zeppelin 進遊戲看過才知道）：

- 跳板立起/放下的旋轉支點目前用的是跳板本身的 `group.position`，也
  就是碼頭端(`makeGangplank()` 的內部座標系是「原點＝碼頭端」)，不是
  船頭端。真實的登陸艇艙門通常是船頭端當鉸鏈，這裡為了不動
  `makeGangplank()`/`makePortScene()` 已經調好的靜態跳板算式，選擇
  在船還很遠時把跳板整個藏起來(`visible=false`)，只有靠岸後那 1.4 秒
  的放下動畫看得到旋轉，用「藏起來、只露出最後一小段动畫」蓋掉支點
  不對的問題。如果放下動畫看起來像「跳板自己在碼頭邊轉」而不是「從
  船頭掀下來」，之後可以再考慮把跳板拆成獨立的鉸鏈群組。
- 外海/走位的所有座標(`SEA_OFFSET_X`、甲板局部座標 `(0.3, 0.5, 0)`、
  跳板船頭端局部座標 `(-1.6, 0.5, 0)`、碼頭迎接點偏移量、船長/村長的
  站位偏移量)都是憑手算跟既有不變量(甲板高度 Y=0.5、hull 半長 1.8)
  推出來的估計值，沒有實際進遊戲看過畫面校正——這輪整個環境沒辦法
  跑 `vite build` 看畫面，這些數字大概率需要 Zeppelin 進遊戲後再回報
  微調，跟這次船隻建模/跳板那一長串反饋輪是同一個流程。
- 開局判斷純粹看「有沒有存檔」，遊戲目前還沒有真正的「開新遊戲／繼續
  遊戲」選單流程(`main.ts` 本來就一直是直接進生活區，沒有標題畫面)，
  等之後真的做這個流程時，這裡的判斷條件應該會被那套機制取代，不是
  永久設計。
- 歡迎對話播完後村長/船長的 `.mesh.visible` 改回 `true`，会重新被
  `game-loop.ts` 的 NPC 排程邏輯接管(這段邏輯本身有 `if (!n.mesh.
  visible) return;` 的跳過條件，序幕演出期間他們兩個一直是
  `visible=false`，所以不會被排程系統搶著移動；解除後才會恢復正常)。
  沒有特別處理「歡迎完，兩人應該留在原地一下」——理論上是自然接回
  正常排程，但這段還沒有實際驗證過會不會出現一放開就立刻走掉的觀感
  問題。

`tsc --noEmit` 過關(每個檔案改完都各自驗證過一次：`game-state.ts`／
`scene-registries.ts`／`props.ts`／`prologue.ts`(新檔)／`game-loop.ts`／
`main.ts`／`input-save.ts`)。



## 序幕第二輪：外海距離、鏡頭鎖船、主角站船頭（2026-08-26）

Zeppelin 進遊戲看過流程後回報三點：

- 「船開頭再往右20格」——`SEA_OFFSET_X` 從 18 加到 38，外海起始點
  推得更遠，鏡頭鎖在船上時比較看得出「船正在從遠處開過來」的距離感。
- 「鎖定鏡頭再船身上」——原本外海／靠岸這幾個階段，鏡頭是透過
  `gameState.player.position`(主角釘在船頭跟著船一起動)間接跟著船，
  結果理論上一樣，但改成 `game-loop.ts` 的港口鏡頭邏輯直接讀
  `prologueRefs.ferry.position`，只在 `isPrologueShipStage()`(atSea／
  approaching／rampLowering)為真時生效，下船走位／碼頭迎接這兩個
  階段鏡頭照常跟玩家。更直接，也不怕之後主角站位再調整時鏡頭跟著跑掉。
- 「把主角模型放到船頭並對著碼頭」——原本站甲板中段(本地 x=0.3，其實
  偏船尾側)，改到船頭(本地 x=-1.3，卡在動物欄杆前緣 -1.1 跟船體前緣
  -1.8 之間，不會穿模，也還沒踩到跳板船頭端 -1.6)。面向碼頭那行
  `faceDirection()` 呼叫本來就有、沒有動，站位挪到船頭之後這個朝向
  依然成立。

**修的時候順便抓到一個自己踩的坑**：把原本每次呼叫都各自 `new
THREE.Vector3(0.3, 0.5, 0)` 的五個地方，一開始圖方便直接改成共用同一個
具名常數 `PLAYER_BOW_LOCAL`——但 `THREE.Object3D.localToWorld(vector)`
是就地改寫傳進去的那個 Vector3、回傳同一個參照，不是回傳新物件。如果
五個呼叫點共用同一個常數，第一次呼叫後這個「常數」本身就會被覆寫成
當下那一刻的世界座標，之後每一幀讀到的都是上一次算出來的世界座標而
不是船頭的本地座標，位置會整個算錯。修法是每個呼叫點都先
`PLAYER_BOW_LOCAL.clone()` 再丟進 `localToWorld()`。這輪還沒進遊戲
驗證這幾個數字實際看起來如何，`tsc --noEmit` 過關。



## 序幕第三輪：跳板收合貼船頭、Z 對齊、下船判定、zoom 印值（2026-08-26）

Zeppelin 回報四點：

- 「跳板自己在碼頭邊轉，而不是從船頭掀下來」＋「跳板一開始甚至沒有
  顯示在船上，他應該有合起來的狀態」——原本的做法是外海階段整個
  `gangplank.visible = false`，靠岸那 1.4 秒才現身用舊的靜態坡度旋轉
  補間，等於「憑空冒出來」再「原地怪異地轉」。改成：跳板全程可見，
  收合狀態(角度立起 `RAMP_RAISED_ROTATION_Z`)貼在船頭局部座標
  `GANGPLANK_BOW_LOCAL=(-1.78,0.5,0)`，`syncGangplankToBow()` 在
  atSea/approaching 每幀重新算「此刻船頭在哪」直接把 `gangplank.
  position` 設過去(不是真的用 `object.add()` 掛成 `ferry` 的子物件，
  那樣還要另外處理 `ferry.scale` 抵消縮放，反而更麻煩)，看起來就是
  「跳板收好貼在船頭、跟著船一起開過來」。進入 `rampLowering` 那一刻
  拍一張快照(`rampLowerFromPosition`)，用 `position.lerpVectors()`
  把整塊跳板從「貼船頭的收合位置」補間到 `makePortScene()` 原本蓋好
  的停靠位置(`prologueRefs.gangplankRestPosition`，這輪新增，跟
  `gangplankRestRotationZ` 存在同一個 `prologueRefs`)，角度也同步補間。
  這不是嚴謹的單軸鉸鏈旋轉(真正物理正確要鉸鏈永遠固定在船頭端，但
  `makeGangplank()` 的靜態坡度算式是以碼頭端當局部座標原點，這條算式
  跟渡輪停靠時的坡度計算共用，沒有動)，是「位置+角度一起補間」的簡化
  版，但已經沒有「跳板自己在碼頭邊憑空轉」的怪異感，之後如果還想要更
  精確的鉸鏈動畫，得先讓 `makeGangplank()` 支援船頭端當原點。
- 「Z不對」——查出來是 `ferry.rotation.y=0.03` 那個小小的偏航角，
  `localToWorld()` 換算時會讓局部 `z=0` 的點在世界座標混進一點點來自
  `x` 的分量(旋轉矩陣的關係)，換算下來偏移約 0.1 格，肉眼看不出哪裡
  歪、但走位跟跳板的 Z 對不齊。跳板本身是直接寫死 `world z=port.
  ferry.z`(沒有經過旋轉)，所以新增 `bowWorldPoint()` 這個共用函式，
  統一規則：凡是演出用到的「甲板/船頭」世界座標，`z` 一律強制對齊
  `LAYOUT.port.ferry.z`，不採信 `localToWorld()` 自己算出來的 z 分量。
  主角站位/跳板同步全部改走這個函式，不再各自呼叫 `ferry.
  localToWorld()`。
- 「應該要有走下去的觸碰跟判定」——這句話比較抽象，我的理解是：下船
  走位的終點(踩上跳板碼頭端那一步)要是一個明確、有名字的判定點，不是
  埋在通用的「跟下一個路徑點距離夠近就算到了」邏輯裡看不出來。加了
  `hasTouchedDock` 這個一次性旗標，`waypoints[2]`(跳板碼頭端/
  `rampBottom`)被踩到的那一幀印一行 `console.info("[序幕] 已踏上碼頭")`
  當作明確的判定點。**如果 Zeppelin 原意是別的東西(例如真的要接一個
  正式的 touch 事件、或要在這個點插音效/鏡頭震動之類)，這輪先按這個
  理解做，之後看畫面/確認需求再調**——沒有百分之百把握猜對這句的意思，
  照最保守的字面解讀先做出一個可以看得見效果(console 有印)的版本。
- 「改zoom的時候打印一下」——`input-save.ts` 的 `setCameraZoom()` 加了
  `console.info` 印目前 `gameState.zoom`，方便滾滾輪試演出用的鏡頭
  距離時直接看 console 記下來，`import.meta.env.DEV` 包住，正式版會被
  靜態消掉。

`tsc --noEmit` 過關(`scene-registries.ts` 多存一份 `gangplankRestPosition`
／`props.ts` 填值／`prologue.ts` 大改／`input-save.ts` 補 zoom 印值)。



## 序幕第四輪：真正的船頭鉸鏈旋轉、鎖定演出用 zoom（2026-08-26）

Zeppelin 附了三張截圖回報：開頭(atSea 階段)完全看不到跳板；行駛
(approaching 階段)時跳板方向是反的，應該轉 180 度；最後放下來的關節
還是不對，應該從船頭轉不是從碼頭轉——直接點名要修正上一輪那個「先求
有、之後再調」留下的簡化版(位置+角度一起補間，不是真正單軸旋轉)。

這輪把 `GANGPLANK_BOW_LOCAL` 的局部座標從隨手內縮的 `-1.78` 改成
hull 邊緣真正的 `-1.8`(對齊 `makePortScene()` 算跳板船端世界座標用的
`ferryHullHalfLength`)，把這個點當成真正的旋轉鉸鏈原點，`rampLowering`
階段整個重寫成單軸旋轉而不是位置補間：

- 船到位那一刻(`approaching` 結束)`syncGangplankToBow()` 把
  `gangplank.position` 釘死在船頭，之後 `rampLowering` 全程不再動
  position，只轉 `rotation.z`。
- 推導出「放下後」的角度不是直接用 `gangplankRestRotationZ`，是
  `gangplankRestRotationZ + Math.PI`——因為靜態停靠版跳板是以碼頭端
  當原點、`rotation.z` 是「碼頭端指向船端」的角度；同一條線段，換成
  以船端當原點反過來看，方向剛好相反，也就是要加一個 π。這剛好對應
  Zeppelin「方向反了，應該轉180度」那句反饋，不是巧合。
- 轉到底之後，跟原本以碼頭端為原點的靜態跳板是同一條線段、同一塊
  板子，只是內部原點定義不同，視覺上完全等價，所以動畫結束時直接切回
  `prologueRefs.gangplankRestPosition`/`gangplankRestRotationZ` 這兩個
  `makePortScene()` 算好的原始值，不會有跳動。
- 順手拿掉了上一輪為了「位置補間」才加的 `rampLowerFromPosition` 快照
  變數，這版不再需要。

另外「開頭沒看到跳板」大機率跟同一個方向錯誤是同一個成因(舊版角度算
反，跳板可能整個貼進 hull 裡面被擋住或角度怪異到肉眼看不出是一塊板)，
這輪的旋轉方向修正後預期會一併解決，但沒有實機驗證，要 Zeppelin 這輪
再進遊戲確認一次。

最後照 Zeppelin 指示，把演出用的鏡頭縮放釘死成 `PROLOGUE_ZOOM = 5`
(`startPrologueScene()` 開場時直接設 `gameState.zoom` 並呼叫
`updateCameraFrustum()`)，不管玩家或上次除錯滾輪停在哪裡，每次演出
都從同一個已知的鏡頭距離開始。`tsc --noEmit` 過關。



## 序幕第五輪：過期矩陣、木匠亂入、跳板收合方向再翻轉（2026-08-26）

Zeppelin 附圖回報三點，這輪抓到一個真正的根因 bug：

- 「初始沒看到主角跟船板，我懷疑是Z沒有碰撞對到船面」——實際查出來
  不是 Z 對不齊(那是上一輪修過的)，是更根本的 three.js 版本問題：這個
  專案釘的是 `three@0.128.0`，這個版本的 `Object3D.localToWorld()`
  **不會**自動重算 `matrixWorld`(這是後來版本才加的行為)。序幕演出
  裡每次「剛改完 `ferry.position` 就馬上呼叫 `ferry.localToWorld()`」
  的地方，讀到的其實是上一次渲染時算好的舊矩陣，等於慢一幀。平常
  緩慢移動時這個誤差小到看不出來，但船從停靠位瞬間跳到外海
  (`SEA_OFFSET_X=38`)那一瞬間，落差極大：算出來的甲板/跳板世界座標
  停在「船還沒跳走之前」的舊位置，跟已經鎖定到船新位置的鏡頭完全對
  不上，人跟跳板因此都落在畫面外。修法是在 `bowWorldPoint()`(所有
  演出用世界座標的唯一入口)裡先呼叫 `ferry.updateMatrixWorld(true)`
  強制刷新，不依賴 renderer 下一輪 `render()` 才會做的自動更新。這個
  修法一次覆蓋了主角站位／跳板同步／所有 waypoint 計算，不用每個呼叫
  點各自補。
- 「不知道為什麼木匠跟著」——推測是 `game-loop.ts` 的
  `isCarpenterEscortActor` 邏輯：只要 `carpenterQuest.stage` 是
  `"escorting"`/`"village_scene_done"`(如果這個瀏覽器之前手動觸發過
  木匠碼頭事件、狀態會留著)，村長/木匠的位置就會**不看
  `.mesh.visible`**、直接跟著玩家的走位軌跡跑；序幕演出全程都在搬動
  玩家位置，木匠因此被拖上船。這輪先防守性地把木匠也加進開場隱藏
  清單(原本只隱藏船長/村長，木匠完全沒被管到)。這只是擋畫面，沒有
  處理狀態殘留的根本原因——如果清一次瀏覽器存檔/重新整理後木匠還是
  跟著，代表不是這個原因，要再往下查。
- 「行駛中的船的跳板應該要反過來，轉個180度」——收合角度
  `RAMP_RAISED_ROTATION_Z` 直接照這句反饋從 `+π/2` 翻成 `-π/2`(這是
  照 Zeppelin 實際看到的畫面調的，不是重新推導；如果這輪之後方向還是
  不對，代表問題不是單純角度正負號，可能是 `GANGPLANK_BOW_LOCAL` 選
  錯邊，要換個角度查)。順便加了一個 `lerpAngle()` 走最短路徑的角度
  補間 helper(跟 `game-loop.ts` 主迴圈轉向平滑同一條公式)，把
  `rampLowering` 的 `THREE.MathUtils.lerp()` 換掉——這是為了避免翻轉
  角度常數之後，兩個端點數值差太遠時普通線性內插會繞遠路(例如
  -90 度轉到 200 度，直接內插要經過 0 度整整轉 290 度，走最短路徑只
  需要反方向轉 70 度)，不管以後這兩個角度常數再怎麼調，旋轉動畫都會
  自動走最短路徑，不會再因為端點數值而意外轉一大圈。

`tsc --noEmit` 過關。這輪的過期矩陣修法算是找到一個明確、可解釋的根因
(不是憑感覺猜)，木匠亂入跟跳板方向這兩點還是要 Zeppelin 進遊戲重新
確認才能定案。


## 序幕第六輪：跳板方向重新推導、下船「陷進地板」的真正根因（2026-08-26）

Zeppelin 附圖回報：「跳板方向再翻180度 但是Z沒有往上調整回去 卡在船上了
然後翻轉變成從下往上翻」+「主角剛落地是陷進碼頭的」。這輪兩點都不是
再瞎翻一次角度就能解決，各自往下查出了明確原因：

- 跳板方向——上一輪(第五輪)把 `RAMP_RAISED_ROTATION_Z` 從 `+π/2` 改成
  `-π/2`，當時明講是「照畫面調的，沒有重新推導」；但第五輪**同一次
  改動**裡還修了 `bowWorldPoint()` 的過期矩陣 bug(`ferry.
  updateMatrixWorld()`)。這代表當時看到「該用 -π/2」的那次測試，畫面
  很可能同時被舊的過期矩陣 bug 污染，兩個變因疊在一起，不能單純採信
  那次的視覺結論。這輪換個方式，不再看畫面猜，直接用向量代數重新推：
  局部座標 `(length, 0)` 這個點繞 `rotation.z` 轉 θ 角，會落在世界偏移
  `(length·cosθ, length·sinθ)`。跳板折收貼船頭、封住艙口的狀態，
  自由端(local x=length，也就是「放下」動畫另一端 `restAngleFromBow`
  最終要接上碼頭的那一端)應該指向世界 **+Y**(往上收，蓋住船頭開口)，
  對應 `θ=+π/2`；`-π/2` 會讓它指向世界 **-Y**(往下、穿過船身沒入
  水裡)，於是「放下」的補間動畫變成從水裡由下往上翻回來——正好對上
  「變成從下往上翻」這句反饋描述的畫面，也解釋了「卡在船上了」的觀感
  (收合角度一開始就指錯方向，整段動畫看起來像跳板黏在船身沒真的甩
  出去)。改回 `+π/2`，這次是重新推導出來的，不是單純再翻一次；如果
  這輪之後方向還是不對，問題就不是角度正負號，得往
  `GANGPLANK_BOW_LOCAL` 選錯邊或旋轉軸本身查，不會再用「再翻180度」
  這招了。
- 「主角剛落地是陷進碼頭的」——這個是這輪找到的**真正根因 bug**，跟
  跳板方向無關：`game-loop.ts` 的 `animate()` 主迴圈裡，
  `updatePrologueCutscene(dt)` 執行完之後，不管 `cutsceneActive` 是不
  是 `true`，下面都還是會照樣呼叫 `animateRun()`/`animateSit()`
  (`humanoid.ts`)；這兩個函式會**直接覆寫** `gameState.player.
  position.y` 成走路/待機用的小幅 bob 值(移動中 0~0.055、待機
  ±0.01)，不是相對疊加、是整個蓋掉。序幕在 `updatePrologueCutscene()`
  裡辛苦算出來的甲板高度(~1.3)、跳板斜度、碼頭高度(~1.0)，因此**每一
  幀**都會在寫完的下一行馬上被蓋成幾乎貼地的數字——不只是「剛落地」
  那一刻，是整段演出(在船上、走跳板、下船)全程都在陷。原本的
  `if (!gameState.cutsceneActive) { position.y += characterGroundY(...) }`
  只擋住了「地形高度疊加」這一段，沒擋住更早一步、animateRun 自己的
  Y 覆寫。修法：`prologue.ts` 新增 `lastPlayerY` 模組變數，每次
  `updatePrologueCutscene()` 寫完 `position.y` 就順手呼叫
  `syncLastPlayerY()` 存一份「這幀真正該有的高度」；另外匯出
  `reapplyProloguePlayerY()`，game-loop.ts 在 `animateRun()`/
  `animateSit()` 呼叫完**之後**馬上呼叫它，把序幕算的高度蓋回去(非
  演出期間整段是 no-op，不影響正常移動的地形/bob 疊加)。等於兩邊
  「誰蓋誰」的順序反過來，序幕的高度才是最後贏的那個。

`tsc --noEmit` 過關。跳板方向這次雖然是重新推導、信心比前兩輪高，但
畢竟前兩輪的推導/畫面調整都各自「看起來合理」結果還是不對，所以還是
要 Zeppelin 進遊戲實際看一次才能定案；陷進地板這個則是抓到明確、可
解釋、且能講清楚「為什麼之前每次改 Y 都沒用」的根因(animateRun 的
覆寫順序)，信心較高。


## 序幕第七輪：跳板方向連續三輪喬不對，改從扶手模型下手（2026-08-26）

`RAMP_RAISED_ROTATION_Z` 這個正負號已經來回改了三輪(+π/2 → -π/2 →
重新推導改回 +π/2)，每次都「看起來有道理」結果 Zeppelin 進遊戲一看
還是反的。這輪 Zeppelin 直接換個角度：與其繼續猜 rotation.z 的正負
號，不如先讓跳板本身「哪一端在動」看得出來——`makeGangplank()` 的
扶手(欄杆+柱子)原本裝在木板上方(local y=+0.34/+0.17)，改裝到「反面」
(local y=-0.34/-0.17)。這是 Zeppelin 直接要求的實驗性改法，動的是
`props.ts` 的模型本身，不是 `prologue.ts` 的旋轉邏輯，而且因為
`makeGangplank()` 是序幕跟平常靜態跳板共用同一份，這個改動兩邊都會
生效。

`tsc --noEmit` 過關。這輪純粹是照 Zeppelin 指示做的實驗，沒有自己重新
推導對錯——要看下一次進遊戲的畫面回報才知道扶手換面之後，方向問題
是真的解決了，還是只是換了一種錯法。


## 序幕第八輪：扶手改成動態翻面、木匠範圍觸發補旗標、BGM 自動播放永久停用的 bug（2026-08-26）

Zeppelin 回報：上岸前(立起貼船頭)扶手方向對了，但靠岸後(放下停靠、
本來就沒壞過的狀態)扶手又反了；另外木匠事件因為只做範圍觸發，序幕
下船走位經過那個區時被誤觸發；還附了一段 BGM 播不出來的 console log。

- **扶手方向**——上一輪把 `makeGangplank()` 扶手/欄杆柱整組永久改到
  板子反面(local y 全部乘 -1)，這輪證實是錯的策略：立起貼船頭
  (`RAMP_RAISED_ROTATION_Z`)跟放下停靠(`gangplankRestRotationZ`)這
  兩個狀態的 `rotation.z` 本來就不一樣，同一個扶手局部位移在兩種
  轉角下對應到不同世界方向，永久改一邊必定弄壞另一邊——這次改完
  「立起」對了，但從沒壞過的「停靠」反而變錯，正好驗證了這個推論。
  改法：`props.ts` 的扶手/柱子位置改回原樣(蓋在板子上方)，但額外把
  `gangplankRailBaseY` 存進每個子物件的 `userData`；`prologue.ts`
  新增 `setGangplankRailFlip(flipped)`，在 `startPrologueScene()`
  設定「立起貼船頭」的當下呼叫 `true`(扶手搬到反面)，`rampLowering`
  動畫做完、跳板真正 snap 回 `gangplankRestPosition`/
  `gangplankRestRotationZ` 的同一刻呼叫 `false`(扶手搬回原本蓋好的
  那面)。兩個狀態各自要哪面就給哪面，不用整組永久二選一，靜態的
  「停靠」狀態(平常遊戲時間全程可見)理論上完全不受影響。
- **木匠事件誤觸發**——`build-map.ts` 的 `carpenterMeet` 矩形跟其他
  港口地圖事件一樣是 `trigger:"touch"`，只認「玩家格子座標有沒有踏進
  觸發區」，不管座標是 WASD 走過去的還是序幕自己直接寫 `position`
  搬過去的；序幕下船走位(甲板→跳板→碼頭)剛好會經過這個觸發格，於是
  木匠碼頭事件在演出途中被意外觸發，兩段對話疊在一起播。修法：
  `game-loop.ts` 派發 `touch` 事件那段整段包進
  `if (!gameState.cutsceneActive) {...}`——跟這個檔案裡其他「演出期間
  該關掉的正常邏輯」同一支旗標、同一套寫法，之後不管未來再加哪個
  演出，只要有把 `cutsceneActive` 設成 true，這類地圖 touch 事件就會
  自動被擋掉，不用每個新演出都個別排除木匠或其他事件。
- **BGM「開場無法播放」**——這個附帶的 console log 不是序幕邏輯的
  bug，是 `music.ts` 既有的一個真 bug：`ensureMusicTrackPlaying()`
  把瀏覽器自動播放政策擋下的 `NotAllowedError`(使用者還沒跟頁面互動
  過，純粹時機不對)跟真正播不動的錯誤(檔案損毀/404，其實有另一個
  `"error"` 事件監聽器專門處理)混在一起處理，一律
  `track.failed = true` 永久停用那首曲子。序幕是開局自動觸發的，
  玩家連一次互動都還沒做，第一次嘗試播放 100% 會被擋下——結果這首
  曲子從此再也不會重試，就算玩家後來按 E/WASD 真正跟頁面互動過也一樣
  沒有聲音。修法：`.catch()` 只在 `error?.name !== "NotAllowedError"`
  時才設 `track.failed`，讓自動播放政策造成的失敗保持「可重試」，
  下一次 `updateMusic()` tick 自然會再試一次；配合檔案本來就有的
  `pointerdown`/`keydown` 監聽器(呼叫 `initializeMusic()`)，玩家一
  旦真的有過一次使用者手勢，重試就會成功。

`tsc --noEmit` 過關。木匠旗標跟 BGM 重試這兩個是有明確原因、講得通的
根因修法；扶手動態翻面延續 Zeppelin 上一輪指定的做法，只是把「整組
永久改」換成「按狀態動態改」，理論上更不容易顧此失彼，但兩個狀態
(尤其立起貼船頭那段)實際畫面還是要進遊戲確認。

## 銀河／日月／雲層融入天空球（2026-09-01）

第一人稱截圖中夏季銀河左側出現清楚的斜直線，日月與雲也像獨立平面浮在
天空前。排查確認銀河使用 PlaneGeometry(260, 48) 搭配矩形 canvas 貼圖，
日月與雲則全部固定在相機局部 z=-74 左右；轉頭或仰視後自然會看見平面
邊界與天空球曲率不一致。修正後銀河改為分布在完整星空球面的柔光 Points
星霧帶，日月與雲透過共用 placeSkyBillboard() 投影至天空球內側並朝向
球心。保留原有季節、時間、月相、天氣透明度與地形遮蔽判定。npm run
build、npm run test:first-person、npm run test:weather 均通過；本機
瀏覽器自動目測因 Windows deny-read ACL 無法啟動，仍需進遊戲實看一次。

## 冬季街道看不出積雪：地面色太接近灰，不是缺判斷（2026-09-01，GitHub Copilot 執行）

Zeppelin 回報冬天截圖裡街道、港口地面沒有「積雪感」，看起來只是天空
在下雪、地面還是原本的灰色。這輪（由 GitHub Copilot 在同一份 repo 上
排查，非本次 Claude session）對照 `game-clock.ts`、`props-nature.ts`
（`updateSeasonalGroundColors()` 一帶）、`weather-schedule.ts` 三個檔案
後確認：季節/天氣判斷邏輯本身沒有缺漏——`getSeasonGrassTone()`
（`game-state.ts`）在 `snowWeather || seasonIndex === 3` 時本來就會走
專屬分支，問題出在這個分支給的地面色數值本身太淡、非直射光下容易讀成
灰底而不是雪白。

修法：把該分支的地面色改成更接近純白、粗糙度更低的數值——目前程式碼
是 `{ ground: 0xf7f9fc, roughness: 0.62 }`，跟 `SEASON_GRASS_TONES.winter`
（`0xe8eef2`／`roughness: 0.82`，非下雪的一般冬天日子用這個較柔和的色）
分開一組更亮更「有光澤感」的雪色，讓下雪天／整個冬季地表跟港口、城鎮
地板一起變白，不再只有天空層看得出下雪。

`npm run build` 已跑過並成功（`✓ built in 7.87s`）。這是純視覺調色，
沒有動判斷邏輯，理論上風險低，但實際「白得夠不夠」仍要 Zeppelin 進遊戲
看一次冬天/雪天畫面才能確認。

附註：這輪排查時發現 repo 底下有一個殘留的 `.git/index.lock`（本次
session 沒有刪除檔案的權限，沒有清掉），如果之後 `git` 指令卡住或
Copilot／終端機回報鎖檔錯誤，先確認這個檔案還在不在。
