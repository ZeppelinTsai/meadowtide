# 序幕過場（開場第一天演出）：src/prologue.ts

> 從 `AGENTS.md` 的逐輪除錯紀錄整理出來的**現狀**摘要——只寫現在真正
> 生效的架構跟已知坑，過程中被推翻的中間版本（跳板角度改來改去、
> 「先猜再修正」那些反覆）不重複列在這裡，完整過程留在
> `docs/history/changelog.md`（搜尋「序幕」）。

## 設計原則：不蓋第二艘船

演出不另外建立第二艘船/第二塊跳板，直接「借用」`makePortScene()`
（`props.ts`）本來就蓋好、整場遊戲都停在碼頭的 `ferry`/`gangplank`
這兩個 Object3D。`scene-registries.ts` 的 `prologueRefs` 是單一可變
物件，存了這兩個參照 + 「跳板靜止角度」`gangplankRestRotationZ` +
「船隻靜止 X 座標」`ferryRestX` + `gangplankRestPosition`。演出把它們
暫時搬離停靠狀態，演出結束時兩者都會回到 `makePortScene()` 原本蓋出
來的靜止狀態——對其餘遊戲時間完全沒有副作用。

## 移動鎖：`gameState.cutsceneActive`，不是 `isGameTimePaused()`

後者會把整個 `dt` 鎖成 0，連演出自己要跑的船/跳板補間動畫都會一起
凍結。`game-loop.ts` 的「自由移動」整塊（WASD/碰撞/轉向）包進
`if (!gameState.cutsceneActive) {...} else { updatePrologueCutscene(dt); }`；
「主角 Y 疊加地形高度」那行也用同一個條件包住——演出期間角色站在
甲板/跳板斜面上，Y 完全由演出自己算，不能被拉回地形高度。

## 狀態機

`atSea → approaching → rampLowering → walking → greeting → done`，
`updatePrologueCutscene(dt)` 每幀跑一次，只在 `cutsceneActive` 為真時
做事，其餘時間是 no-op。`walking` 階段不重用 WASD 碰撞系統，是自己算
好的路徑點（甲板→跳板船頭端→跳板碼頭端→碼頭迎接點）直接線性位移。

## `bowWorldPoint()`：所有演出世界座標的唯一入口

```ts
function bowWorldPoint(localPoint: THREE.Vector3): THREE.Vector3 {
  const ferry = prologueRefs.ferry!;
  ferry.updateMatrixWorld(true);
  const world = ferry.localToWorld(localPoint.clone());
  world.z = LAYOUT.port.ferry.z;
  return world;
}
```

兩個踩過的坑都收斂在這個函式裡：

- **`three@0.128.0` 的 `Object3D.localToWorld()` 不會自動重算
  `matrixWorld`**（這個自動更新是後來版本才加的行為）。剛改完
  `ferry.position` 就馬上呼叫 `localToWorld()`，讀到的其實是上一幀的
  舊矩陣——船從停靠位瞬間跳到外海那一瞬間差距最大，會讓算出來的甲板/
  跳板世界座標停在「船還沒跳走之前」的位置。修法是在這裡強制
  `ferry.updateMatrixWorld(true)`。
- **`ferry.rotation.y = 0.03` 這個小小的偏航角**，`localToWorld()`
  換算時會讓局部 `z=0` 的點在世界座標混進一點點來自 `x` 的分量，
  肉眼看不出哪裡歪但走位/跳板的 Z 會對不齊。統一規則：凡是演出用到
  的世界座標，`z` 一律強制對齊 `LAYOUT.port.ferry.z`，不採信
  `localToWorld()` 自己算出來的 z 分量。

**`localToWorld(vector)` 會就地改寫傳進去的那個 `Vector3`、回傳同一個
參照，不是回傳新物件。** 任何共用常數（例如 `PLAYER_BOW_LOCAL`、
`GANGPLANK_BOW_LOCAL`）傳進 `bowWorldPoint()`/`localToWorld()` 前一定
要 `.clone()`，否則第一次呼叫後這個「常數」就會被覆寫成當下的世界
座標。

## 跳板放下動畫：真正的船頭鉸鏈旋轉

跳板收合狀態貼在船頭局部座標 `GANGPLANK_BOW_LOCAL`，`syncGangplankToBow()`
在 `atSea`/`approaching` 每幀重新算「此刻船頭在哪」直接把
`gangplank.position` 設過去（不是真的用 `object.add()` 掛成 `ferry`
的子物件，那樣還要處理 `ferry.scale` 抵消縮放）。

`rampLowering` 階段是單軸旋轉，鉸鏈原點固定在船頭（`approaching` 結束
那一刻 `syncGangplankToBow()` 釘死 `position`，之後全程只轉
`rotation.z`，不再動 `position`）。推導：靜態停靠版跳板以碼頭端當
原點、`rotation.z = gangplankRestRotationZ` 時局部 +X 指向船端；同一條
線段換成以船端當原點反過來看，角度是同一個向量的反方向，也就是
`+π`。所以「放下後」的角度是 `gangplankRestRotationZ + Math.PI`，不是
`gangplankRestRotationZ` 本身。轉到底之後跟原本以碼頭端為原點的靜態
跳板是同一條線段、只是內部原點定義不同，視覺上完全等價，動畫結束時
直接切回 `gangplankRestPosition`/`gangplankRestRotationZ`，不會跳動。

角度補間用 `lerpAngle(from, to, t)`（跟 `game-loop.ts` 主迴圈轉向平滑
同一條「走最短路徑」公式），避免兩個角度端點數值差太遠時
`THREE.MathUtils.lerp` 繞遠路。

**收合（立起貼船頭）角度 `RAMP_RAISED_ROTATION_Z` 目前是 `+Math.PI/2`**
——推導依據：局部 `(length,0)` 這個點繞 `rotation.z` 轉 θ，會落在世界
偏移 `(length·cosθ, length·sinθ)`；收合封住艙口時，跳板自由端應該指向
世界 +Y（往上收），也就是 θ=+π/2。這個值先前來回改過兩次（一次是照
畫面回報盲改，事後發現是被同一輪的過期矩陣 bug 污染了觀察結果），
**這次是重新推導出來的，但截至 2026-08-26 這輪還沒拿到 Zeppelin 確認
畫面正確**，改這個常數前先看 `docs/history/changelog.md` 最後幾輪，
不要重複之前試過的值。

## 跳板扶手動態翻面

`makeGangplank()`（`props.ts`）的扶手/欄杆柱子在 `userData` 存了
`gangplankRailBaseY`。收合貼船頭跟放下停靠這兩個狀態的 `rotation.z`
不一樣，同一個扶手局部位移在兩種轉角下會對應到不同的世界方向——
**不能整組永久改到某一面**（試過，會顧此失彼：改對了收合狀態，
放下停靠這個本來沒壞過的狀態反而變錯）。改成動態：
`setGangplankRailFlip(flipped)`（`prologue.ts`）在收合狀態設
`true`（扶手搬到反面），跳板真正 snap 回停靠位置的同一刻設
`false`（搬回原本蓋好的那面）。

## `lastPlayerY` / `reapplyProloguePlayerY()`：跟 animateRun() 搶 Y 的寫入順序

`game-loop.ts` 的 `animate()` 主迴圈，不管 `cutsceneActive` 是不是
`true`，都還是會呼叫 `animateRun()`/`animateSit()`（`humanoid.ts`）；
這兩個函式會**直接覆寫** `gameState.player.position.y` 成走路/待機用
的 bob 值，不是相對疊加。序幕算出來的甲板/跳板/碼頭高度因此每一幀
都會在寫完的下一行馬上被蓋掉。修法：`prologue.ts` 每次寫
`position.y` 都呼叫 `syncLastPlayerY()` 存一份到模組變數
`lastPlayerY`；`game-loop.ts` 在 `animateRun()`/`animateSit()`
呼叫完**之後**呼叫 `reapplyProloguePlayerY()` 把這份高度蓋回去
（非演出期間整段是 no-op）。兩邊「誰蓋誰」的順序反過來，序幕的高度
才是最後贏的那個。

## 演出期間要擋掉的其他系統

- **鏡頭**：`isPrologueShipStage()` 回傳 `atSea`/`approaching`/
  `rampLowering` 這三個「人還在船上」的階段是不是為真；`game-loop.ts`
  的港口鏡頭邏輯在這幾個階段直接讀 `prologueRefs.ferry.position`，
  不透過 `gameState.player.position`。`walking`/`greeting` 恢復正常
  跟玩家。
- **地圖 touch 事件**：`game-loop.ts` 派發 `trigger:"touch"` 事件那段
  包進 `if (!gameState.cutsceneActive) {...}`——序幕下船走位會經過
  港口地圖上其他事件的觸發格（例如木匠碼頭事件的矩形區），沒擋會
  在演出途中被意外觸發。**這是通用擋法，之後任何新演出只要設定
  `cutsceneActive = true`，這類地圖事件都會自動被擋掉**，不用每個
  新演出各自排除受影響的事件。
- **世界互動**：cutsceneActive 期間 E/R/F、滑鼠情境互動、釣魚、播種、採集與
  NPC 閒聊全部封鎖；對話推進仍可使用 E。教學需要玩家實際操作時，應先結束
  cutsceneActive 進入自由活動／玩法等待階段，不可讓完整過場鎖定和自由操作
  同時成立。
- **NPC 顯示**：`startPrologueScene()` 開場把 captain/mayor/carpenter
  三個 NPC 的 `.mesh.visible` 都設 `false`（carpenter 是後來才補上的
  防守性修法——`carpenterQuest.stage === "escorting"` 時
  `isCarpenterEscortActor` 邏輯會不看 `.mesh.visible` 直接跟著玩家的
  走位軌跡跑，這個修法只是擋畫面，沒處理狀態殘留的根本原因）。

## 觸發與除錯

- 開局偵測不到存檔（`localStorage["meadowtide.save.default"]` 為
  `null`）會觸發 `shouldPlayPrologueOnBoot()`；`hasSaveData()` 是反向
  包裝，給 `title-screen.ts` 判斷要不要顯示「繼續遊戲」按鈕用
  （見 `docs/decisions/title-screen.md`）。
- `F8` 熱鍵（`input-save.ts`）呼叫 `previewPrologue()`
  （`startPrologueScene({force:true})`），只能在已經站在港口地圖時
  使用，不用清存檔就能重播，方便邊看畫面邊調參數。
- 船上與下船段使用 `PROLOGUE_ZOOM = 5`；村長開始跨圖引路後改用
  `PROLOGUE_GUIDE_ZOOM = 12`，抵達生活區後恢復 5。兩者都由
  `lockPrologueZoom()` 寫入 `gameState.zoom` 並呼叫
  `updateCameraFrustum()`。

## 村長跨圖引路

港口介紹結束後，`prologue.ts` 進入 `guidedWalking`：對話必須先完整關閉，村長沿指定路徑領路，主角由程式沿村長逐幀留下的軌跡自動跟隨並維持約 0.7 格距離；轉彎時不得斜切，玩家方向輸入也不得搶走角色控制。
同行期間維持 `cutsceneActive`，由 `updatePrologueCutscene()` 同時更新兩人的位置；九格播種是限定範圍內的玩法操作，不代表序章已進入一般自由活動。一般自由尋路與跨圖操作要到劇情要求玩家去找釣竿時才開放。
目前測試路線為：

- `port`：`(4,22) → (0,22)`，完成後用既有 `loadMap()` 進入舊城鎮。
- `oldVillage`：`(175,23) → (164,23) → (164,0)`，完成後轉入生活區。

進入生活區後，主角與村長先留在 `LAYOUT.livingArea.prologueArrival` 的入口站位；先顯示抵達提示並完成主角第一人稱環視，環視結束後才啟動入口到 `(21,20)` 的同行，不得在換圖回呼中直接把演出推到家門前。雜貨店與山區介紹兩句保留村長名牌但隱藏立繪，抵達牧場後恢復立繪。

原始路徑不可寫死在 `prologue.ts`；唯一資料源是 `LAYOUT.port.prologueGuide`、
`LAYOUT.oldVillage.prologueGuide` 與 `LAYOUT.livingArea.prologueArrival`。
舊城鎮路徑用西擴張前的座標宣告，會由既有 `shiftCoordinatesDeep()` 隨整張
地圖平移成上述世界座標。跨圖能力由 `title-screen.ts` 在啟動序章時注入
既有 `loadMap`，避免 `prologue.ts` 反向 import `build-map.ts` 形成循環依賴。

序章期間 `game-loop.ts` 必須在所有地圖暫停 mayor/captain 的日常排程，
不能只在港口暫停，否則引路 NPC 到舊城鎮或生活區後會被排程覆寫位置。

## 已知不確定/未確認的地方

- `hasTouchedDock`（`waypoints[2]` 踏上跳板碼頭端那一刻的一次性判定，
  目前只印一行 `console.info`）是對 Zeppelin「應該要有走下去的觸碰跟
  判定」這句話的**猜測性**實作，還沒被明確確認或糾正。
- 台詞是純中文字串，沒有走 `i18n.ts` 的 `t()`——跟其他事件（除木匠外）
  同一個慣例，之後真的要幫序幕上多語言時再一起補。
# 序章劇本資料

序章首次顯示採用專屬的一秒淡黑加一秒淡入；角色與渡輪在全黑期間定位，第一顆
鏡頭完全顯示後才開啟傳單對話。淡入完成會移除 inline transition，其他換圖仍沿用
全域 0.4 秒設定。
新遊戲從標題畫面進入時，標題底下必須先鋪黑幕；等 `loadMap("port")` 的
`onLoaded` 已建立玩家與港口參照後，才以 `alreadyFaded` 啟動序章。這條流程會
讓 `loadMap` 回呼回傳 `false`，抑制一般換圖自己的 `fadeIn()`，避免普通港口
閃現以及初始化期間輸入讀取未建立的 `player.position`。
船上傳單使用程式生成的低模紙張，掛在主角右手肩膀支點下；雙臂以事件姿勢權重
約 0.45 秒抬起，船長最後一句結束後約 0.35 秒放下並移除紙張。因一般待機動畫每幀
會重設手臂，傳單姿勢必須在 `animateRun()` 後由
`reapplyProloguePlayerY()` 同一個末段覆寫點重新套用。

可閱讀的序章文字集中在 `src/story/chapters/prologue-script.ts`；`src/prologue.ts`
只負責船、跳板、人物走位與串接段落。序章依序涵蓋傳單、港口、城鎮、牧場、住宅、釣魚與料理。新遊戲先清空物品與
工具；村長抵達教學田後才發放九包蘿蔔種子。除 `(13..15,22..24)` 教學田外，
其餘農地在序章開始時使用正式木材／石材採集節點填滿，不建立純視覺佔位物。

九格播種是正式玩法閘門：對話結束後先以 0.9 秒 ease-in-out 將 zoom 從一般
中景 5 平滑拉到 3，完成後才令 `cutsceneActive=false`，允許玩家自由移動與使用快捷背包；`game-loop.ts` 每幀只統計教學田的實際 `cropState`。未滿九格
時鎖住序章日期時間、停用 touch 換圖事件，並讓村長維持原位；滿九格後先以相同時長將 zoom 從 3 平滑恢復為 5，再黑屏、把兩人復位到
`(14,20)`，恢復演出與指定同行路徑。zoom 補間期間必須暫停序章每幀的固定 zoom 鎖，
否則補間值會在下一幀被覆蓋。進屋談到忘記準備釣竿後進入
`seekingRod`：解除 `cutsceneActive`，開放房屋、生活區、舊城鎮與港口間的正常移動／
傳送，村長沿主角軌跡保持約 0.72 格跟隨；靠近港口船長才重新鎖定演出並接續釣竿
對話。船長的未自我介紹階段固定顯示職稱「船長」，自我介紹句結束後才揭露「赫克托」。
取得釣竿後進入 `fishingTutorial`：船長引導玩家前往港口南側沙灘，開放玩家自由走到水邊與釣魚，村長維持同行，但仍鎖住 touch 換圖；港口事件起點必須先用 `portGroundY()` 同步玩家高度與序章 Y 快取，避免切回 cutscene 時被舊高度壓進港區高台；上鉤魚固定
為小魚，取消、過早收竿、錯過咬鉤或斷線都由船長重播提示，直到成功。成功後由村長
說明返回牧場小屋，使用共用 loading 黑幕直接載入 `house`，再接料理教學。料理教學前爐灶鎖定；村長說明右上角爐灶後開放自由操作，只有 `cookMeal()` 真正成功才接後續對話。結尾由村長交付地圖並提示 M／View，說完歡迎詞後使用共用 loading 黑幕讓村長離場，再以 UI toast 提示選單存讀檔與鏡頭縮放。序章全部
完成後，第一天自由時間固定由 15:00 開始。

序章荒廢農田產生的木材／石材節點須標記為固定障礙，06:00／18:00 的一般採集點刷新不得移除或重排；只有玩家用對應工具親自清除後才消失。序章手動快速存檔的安全檢查點設在 `seekingRod`：更早的引路、播種與室內演出階段一律擋下快速存檔；讀檔須在重建地圖前還原此階段，讓村長同行與港口觸發繼續生效。進入 `seekingRod` 前由村長交付島嶼地圖；港口船長說要去倉庫後，以共用 loading 黑幕略過離場／返場舞台指示；黑幕後第一句固定由赫克托說「找到了，給你吧」，再交付釣竿。這支釣竿設定為前任村長遺留之物：赫克托與前任村長是多年老友，現任村長梅貝爾是前任村長的妻子並接下其職務。序章只透過舊釣竿與一句「妳丈夫」輕輕揭露關係，不提前展開喪偶、守島或勸離的情緒內容，保留給第一週後段事件。

床鋪雖在小屋介紹時出現，實際互動必須等 `main.prologue.arrival` 完成後才開放。玩家可選擇休息到當日 18:00（僅限尚未到 18:00）或睡到隔日 06:00；時間跳轉必須呼叫 `updateGameClock()`，不可直接覆寫 `elapsed`，以免漏掉換日、作物、天氣與自動存檔事件。

目前物品資料尚未細分蘿蔔與蘑菇，因此各三份先合併為六份 `harvested`。傳單只說
「讓土地再次熱鬧」，「重新生長」保留給後期生態主線；首日動物區、休息區與花園
只簡短指出，不展開功能。料理教學只強制介紹烤魚，其他料理與效果交由食譜介面呈現。
教學文字
指向正式 E 鍵種植、釣魚與爐灶系統；後續加入逐項任務閘門時，必須讀正式玩法的成功
結果，不得另做一套假的種田、釣魚或料理判定。

舞台指示採用方括號字串，runner 必須把它們當控制標記或純演出描述，不得顯示在對話框。帶 `comicCue` 的方括號描述會把漫畫符號附到下一句實際台詞上，避免同一個內心反應同時以漫畫符號與文字重複呈現。

## 角色頭頂漫畫提示

`src/comic-cue.ts` 使用程式生成的 CanvasTexture + Three.js Sprite，在角色模型頭頂
顯示漫畫提示。`!`、`?`、`…` 使用奶油米白對話泡泡與棕色粗框；慌張水滴、汗顏與
`|||` 是不帶泡泡的獨立符號。劇本行以 `comicCue: { actorId, kind }` 宣告，
`dialogue.ts` 每次顯示新行時同步替換提示，關閉對話時必須移除 Sprite 並 dispose
材質與貼圖，禁止用不受對話進度控制的固定計時器堆疊提示。
## 演出期間 HUD

主迴圈依 `gameState.cutsceneActive` 切換 `body.cutscene-presentation`。所有事件演出期間隱藏遊戲 HUD 與右上快捷卡，只保留演出所需的對話、選項與轉場；事件結束後自動恢復。

## 料理教學封鎖與序章黑幕

料理教學自由操作期間仍屬序章：每幀鎖定序章日期時間，房屋出口 touch event 與地圖選單快速傳送皆不得執行；只有成功完成任一道教學料理並跑完結尾對話後才解除。村長歡迎主角後須補上返回鎮上的告別句，再進黑幕。船長前往倉庫取釣竿與村長離開牧場小屋兩段黑幕各至少完整停留 900ms；延長只作用於這兩段，不修改共用 loading-screen 的全域轉場速度。

### 釣魚教學沙灘限制與轉場注入

序章 fishingTutorial 雖沿用一般 nearWater 判定，但開始拋竿還必須位於 LAYOUT.port.southBeach 的實際鋸齒岸線範圍；鍵盤互動、情境膠囊與點擊水面尋路必須共用 canUsePrologueFishingSpot()，避免南碼頭等非沙灘岸邊也能完成教學。正式新遊戲、F8 預覽與 seekingRod 存檔還原都必須重新注入同一個 loadMap 函式，否則成功釣魚後無法轉場回 house。
