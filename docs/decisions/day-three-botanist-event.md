# 第三天早上劇本——克拉拉(植物學家)個人事件

事件開始固定鎖在第 3 天 10:00，完成固定落在同一天 12:00。兩端都使用
`lockEventClock()` 明確寫入第 3 天，避免事件期間日期欄位失去同步後回退。

2026-09-04，Zeppelin 給了完整劇本材料（門口寒暄→蜂箱那塊空地→架設蜂箱→
收尾），要求「先導入，演出你適當編排」。這份文件記錄怎麼把那份材料接上
現有系統、做了哪些編排取捨，以及驗證結果。

## 跟第二天事件的關係

跟 `day2-morning-event.ts`（村長帶隊去港口接歐文/露比）方向相反：這次
是克拉拉主動上門拜訪牧場，玩家是「被拜訪」的一方，不用跑地圖去接人。
整場戲只在 `livingArea` 一張地圖裡發生，沒有跨地圖傳送。

新開一個獨立檔案 `day3-morning-event.ts`，結構刻意跟 `day2-morning-
event.ts` 保持一致（觸發窗口 + due 旗標／`announceHomeVisitorThenRun`
預告／`runBlackTransition` 場景轉換／`showDialogSequence` 串接
callback／結尾 `addAffectionReward`），但只有克拉拉一個角色、沒有「自由
採集」之類的中間態，所以：

- 沒有照搬 `dayTwoMorningEvent` 那個泛用的 `holding`/`holdPositions`
  Record，改在 `layout-maps.ts` 新增 `botanistQuest.scenePos`——單一
  物件，`game-loop.ts` 逐幀讀這個值把她釘在對的座標，跟既有的
  `artistQuest` 「單一固定站位」分支同一種精神，差別只是站位會隨場次
  換（門口／蜂箱空地），所以用一個會變動的物件而不是寫死的常數。
- `due` 旗標也是單一布林值（`dayThreeMorningEvent.due`），不是整包物件，
  理由跟上面一樣：這個事件沒有 `phase`/`holding` 這些需要一起存讀檔的
  中途狀態，`botanistQuest.stage` 本身就夠用了。

## 座標——全部沿用既有常數，沒有新編數字

Zeppelin 給的座標剛好都能直接從既有系統推導出來，不是巧合：

- 門口／對話站位：`(21,18)`/`(21,20)`。沿用 `HOUSE_ROAD_X`/
  `HOUSE_ROAD_START_Z`（家門口那組現成座標系，`DAY_TWO_MORNING_
  ARRIVAL` 也是用這個），玩家 `(HOUSE_ROAD_X, HOUSE_ROAD_START_Z+1)`、
  克拉拉再往南兩格 `(HOUSE_ROAD_X, HOUSE_ROAD_START_Z+3)`。房子之後
  搬家這裡不用跟著手動改數字。
- 蜂箱空地：`(27,39)` 面右 / `(29,39)` 面左，蜂箱 `(28,39)` 夾在正中間。
  `game-state.ts` 的 `BEEHIVE_VISUAL` 本來就固定站在 `LAYOUT.beehive`
  `(28,39)`（花田南緣再往南 2 格的開闊草地，是這次事件之前就規劃好等
  著解鎖的位置）——這裡直接用 `LAYOUT.beehive.x ± 1` 算演出站位，不是
  另外編一組數字。

新增到 `layout-maps.ts`：`DAY_THREE_BOTANIST_ARRIVAL`、
`DAY_THREE_BEEHIVE_SCENE`、`botanistQuest`（stage 機器：
`not_started → intro → complete`，比 `artistQuest` 簡單，因為沒有自由
採集中繼態）。

## 蜂箱「簡易建造模式」——這輪做了簡化，需要 Zeppelin 知道

劇本原文：「進入簡易建造模式，玩家第一次自己決定蜂箱放在哪」，並提到這
是在鋪未來的「設施放置」通用系統。

這輪**沒有做真正的自由放置 UI**。查過 `game-state.ts` 的蜂箱系統，設計
本來就是固定站在 `LAYOUT.beehive(28,39)`——跟牡蠣架同一種「預先規劃好
的設施位置，靠 unlock flag 開關」寫法，這個專案目前所有「設施」都是這
樣，沒有任何一個是玩家自由選格子放的。於是這輪忠實沿用這個既有設計：
演出上直接帶到 `(27,39)/(29,39)` 這個定點，對話帶過「放這裡」的決定，
不額外做拖曳/選格子的介面。

真的要做「玩家自己選格子放設施」的通用系統，是比這個事件大很多的獨立
功能（需要一套格子選取 UI、碰撞檢查、跟現有建築/農地/花田範圍互斥判
定……），這輪範圍內沒有做，先讓 Zeppelin 知道，之後想做再另外排。

## CG 資產

Zeppelin 給的兩張圖（`concept/ChatGPT Image 2026年9月3日 下午10_56_54
.png` 主圖、`concept/ChatGPT Image 2026年9月4日 上午06_38_26.png` 差
分）複製進 `public/assets/cg/`，照 2026-09-02 起的命名慣例改名成
`day3Botanist-01.png`/`day3Botanist-02.png`，並跑過
`npm run assets:webp:cg` 補上 1280/1600 寬的響應式 WebP 版本（原圖
1672px 寬，1920 那一檔會被腳本自動跳過，跟其他既有 CG 一致）。

CG 切換點：`day3Botanist-01` 涵蓋「蜂箱架好→打趣想吃蜂蜜→反思這片土地
在人離開後依然自己活下來」這段；「[她微笑]」那句之後換成
`day3Botanist-02`（告別／要去爬山／蘑菇警告）。這個切點是這輪自己編排
的（劇本原文兩段有些用詞重疊，例如「這樣應該就可以了」跟「先讓新鄰居
住幾天吧」都在講同一個「放置完成」的瞬間），依「情緒轉折點換差分」的
既有慣例（`day2Artist-01`→`-02` 也是在語氣轉折處切）挑的位置。

## 對話行編排上的取捨

- 主角的短句反應（「？」「……」「！」）裡，凡是劇本裡**沒有用方括號
  包起來**的（例如「主角：「？」」），視為真的要顯示在對話框裡的台
  詞，用 `hero()` 處理；唯一一句方括號包起來的「[主角：！]」，當成純
  舞台指示處理（不顯示、只留在原始碼當演出註記），沒有用
  `comicCue`／`cue()` 泡泡演出。

  這是刻意避開的一個雷：讀 `dialogue.ts` 的 `showDialogSequence()`
  發現，一句「方括號 + comicCue」後面如果緊接著一句真的有台詞的對話
  行，那句台詞會被 `pendingComicCue` 波及、整句文字被吃掉、只顯示驚
  嘆號泡泡（`shouldDisplayDialogText()` 只要 `line.comicCue` 有值就會
  隱藏文字）。翻 `day2-morning-event.ts` 發現至少兩處
  `cue(...)` 後面緊接著角色台詞的既有寫法（歐文「這塊木板裡面已經腐
  掉了」、露比「……你該不會也想去看看？」），照這個邏輯推演，那兩句
  台詞應該也會被吃掉——這聽起來像既有程式碼裡一個沒被抓到的潛在瑕
  疵，但這輪任務範圍不包含修它，也沒辦法用瀏覽器實際驗證是不是真的
  會這樣播出來，所以沒有動它，只是在自己的新內容裡刻意避開這個寫
  法，改用不帶 `comicCue` 的純方括號敘述句。如果 Zeppelin 玩既有的
  木匠/露比那兩場戲時發現「有一句台詞完全沒顯示、只跳出驚嘆號就跳過
  了」，這就是原因，值得回報讓我確認。

- 蜂箱架好的系統提示（`systemDialog("蜂箱已經架設好了，之後可以定期
  採收蜂蜜")`）疊上 `cg: "day3Botanist-01"`，讓它在 CG 已經淡入的畫
  面上顯示，不會在 CG 淡入前先跳一次純 3D 世界的 toast、再切一次 CG
  fade-in，比較不突兀。

## 存讀檔

- `input-save.ts` 存檔時序列化 `botanistQuest`（含 `scenePos`，讀檔時
  會清成 `null`，不會沿用舊座標播錯場景）。
- 讀檔時：跟 `artistQuest` 同一個理由，`stage === "intro"`（存檔當下
  正在演出途中）一律退回 `"not_started"`，靠 `canStartDayThreeMorning
  Event()` 的窗口條件自然重新觸發（時間本來就被 `"botanistEvent"` 這
  個暫停來源鎖住，重新載入後通常還在原本的窗口內）。
- 讀檔時明確設一次 `botanistNpc.mesh.visible = botanistQuest.stage ===
  "complete"`——這裡刻意學木匠那段的完整寫法，**沒有**照搬
  `artistQuest` 的讀檔還原邏輯，因為順手核對時發現 `artistQuest` 那段
  讀檔還原完全沒有設可見度：只在 `"waiting_oldVillage"/"intro"/
  "returning"` 這三個中途 stage 靠 `game-loop.ts` 的固定站位分支順手
  補上 `mesh.visible = true`，但 `"complete"` 狀態沒有任何地方會再設
  它——意味著如果玩家存檔時露比事件已經完成，讀檔之後她的模型會永遠
  維持一開始建立時的 `visible = false`，不會再出現。這是既有程式碼
  裡看起來像是真的漏掉的一個 bug，這輪沒有動它（範圍外、沒辦法用瀏
  覽器驗證），但克拉拉這裡直接做對，沒有複製這個缺口。如果要修
  露比那個，之後可以在 `input-save.ts` 的 `data.artistQuest` 區塊比
  照補一行 `artistNpc.mesh.visible = artistQuest.stage === "complete" ||
  ...`。
- `unlockBeehive()` 呼叫在「放這裡」那句對話之後，緊接一次 `loadMap()`
  重建同一張地圖（座標不變）——蜂箱模型是 `build-map.ts` 在 `buildMap()`
  時才檢查一次 `isBeehiveUnlocked()` 決定要不要放進場景，不是每幀動態
  開關，所以只呼叫 `unlockBeehive()` 不夠，得靠地圖重建才能讓 3D 模型
  真的出現。黑幕期間切換，玩家不會看到模型憑空生成的瞬間。
- 老存檔遷移（`game-state.ts` 蜂箱那段開頭已有的說明）：`gameState.
  currentDay >= 3` 時會直接補上 `beehive.unlocked`，跳過這整個事件。
  `canStartDayThreeMorningEvent()` 因此多加了 `!isBeehiveUnlocked()`
  這個防呆條件，避免已經被遷移補過 flag 的玩家事後又被劇情重播一次
  ——這正是那段舊註解裡提到「事件寫出來之後要記得加上」的那個條件。
  副作用：這種舊存檔會拿到蜂箱設施，但永遠不會認識克拉拉這個角色（她
  的模型可見度只在事件完成時才會被設成 true）；這是既有遷移設計本來
  就接受的取捨，這輪沒有進一步處理。

## 新增的時間暫停來源

`time-pause.ts` 加了 `"botanistEvent"`，理由跟既有的 `"rubyEvent"` 一
樣：不沿用 `"guidedGameplay"`，避免以後如果哪個事件也用那個鍵、每幀
互相覆寫打架。

## 驗證

`npx tsc --noEmit` 全程通過。跑過的測試套件：`test:map-tools`（41）、
`test:affection`（5）、`test:save-slots`（3）、`test:weather`（10）、
`test:story`（14）、`test:pearls`（4）、`shrine-stair-navigation.test.ts`
（3），全部維持原本的通過數，沒有被這輪改動波及。

老實說：`day3-morning-event.ts` 本身跟它牽動的 `game-loop.ts`／
`game-clock.ts`／`npc-runtime.ts`／`build-map.ts` 都在同一條「模組載入
時就會建立 `THREE.WebGLRenderer`」的 import 鏈上（源頭是
`scene-sky.ts`），沒辦法在 Node 測試環境裡直接 import，這輪新增的觸發
窗口/場景轉換/對話流程完全沒有自動化測試覆蓋——跟 `day2-morning-
event.ts` 當初的處境一樣。只能靠 `tsc --noEmit`（型別/語法層面）加上
逐行核對邏輯（座標算式、`revealNameAfter`/`cg` 疊加、`botanistQuest.
stage` 各分支）把關；門口寒暄→蜂箱架設→收尾的實際演出效果、CG 切換的
視覺呈現，都還沒辦法在這個環境裡實際跑一次確認，需要 Zeppelin 在遊戲
裡玩過第三天 10:00 這個窗口才能最終驗證。

## 觸發窗口

第三天（`currentDay === 2`，因為存檔清單顯示的「第 N 天」是
`currentDay + 1`）10:00–10:30，跟第二天事件同一種「due 旗標 + 窗口比
對」寫法，能撐過睡覺/N 鍵快轉跳過整個窗口的情況。
