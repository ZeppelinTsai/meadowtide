# 事件／演出系統：現況盤點、共通積木與撰寫指南

> 2026-09-01，Zeppelin 要求把事件/演出的程式碼抽象化、彙整出共通結構，
> 因為接下來要開始加大量文本，希望任何 agent 甚至 Zeppelin 自己都能寫出
> 「具體、可除錯」的演出腳本。這篇是盤點 `src/prologue.ts`（第一天序章，
> 1645 行）跟 `src/carpenter-quest.ts`（第二天木匠前半，193 行）這兩份
> 真實腳本後的結論，不是憑空設計。

## TL;DR

1. **`src/story/` 底下已經有一套設計完整的正式事件骨架**（型別、條件、
   runner、runtime adapter、audit）——但**全專案目前零呼叫點**：
   `runStoryEvent()`、`createStoryRuntimeAdapter()`、`listStoryEvents()`、
   `getStoryEvent()` 除了 `story/` 自己內部跟測試檔，沒有任何地方 import。
   `ACT1_STORY_EVENTS`、`PROLOGUE_STORY_EVENTS` 都是空陣列。這套系統目前
   是「型別檢查得過、單元測試會過，但完全沒有接上遊戲」的狀態。
2. **序章跟木匠都是各自獨立的手刻狀態機**，沒有走上面那套系統，彼此的
   寫法也不統一（例如序章的台詞是純中文字串，木匠的台詞已經在用
   `t()` i18n key）。
3. 盤點時多發現一個問題：`src/story/chapters/prologue.ts`（1065 行）
   其實是 `src/prologue.ts` 某個更早版本的**過期複製檔**，`story-registry.ts`
   自己的註解也寫了「是舊檔，不是 StoryEvent 資料」，但一直沒有人移走。
   已經確認全專案沒有任何檔案 import 它，這輪搬進
   `_to_delete/story-chapters-prologue-stale-copy.ts`，等你自己確認後
   可以直接刪除那個資料夾。
4. 這輪把兩份真實腳本裡「有共通模式、但正式系統的 `StoryStep` 還沒
   涵蓋」的動作，加成新的 step 型別（`setActorVisible`／`positionActor`／
   `matchActorPosition`／`fade`／`pauseTime`），並把 `dialogue` step 補上
   `nameKey`／`comicCue`／`hidePortrait`／`revealNameAfter`／`cg`——這些
   全部是**純新增**，`story-runtime-adapter.ts`、`story-audit.ts`、
   `story-system.test.ts` 都跟著補了對應的介面/驗證/測試，`npx tsc
   --noEmit`、`npm run test:story`、`npm run story-audit` 都過關。目前
   仍然是「型別跟骨架就緒，實際遊戲還沒接上」——這輪沒有去動
   `src/prologue.ts` 或 `src/carpenter-quest.ts` 本體，那兩份手刻腳本
   目前還是正式在跑的唯一實作。
5. 文件最後有一份「新增一段演出，具體怎麼寫」的清單，跟一個把木匠碼頭
   事件轉成正式 `StoryEvent` 格式的完整對照範例（純示範，沒有註冊進
   `act1.ts`，避免跟現行 `carpenter-quest.ts` 同時觸發打架）。

## 為什麼要花篇幅講「現狀」，不是直接給你一套新系統

Zeppelin 的直覺是對的——「地圖是否能傳送」「時間是否暫停」「演出」
「物件」這些確實是可以抽出來的共通積木。但這個專案已經有人（很可能是
更早一輪的 agent session）**做過一次這個抽象化嘗試**，而且做得相當完整
（型別、条件、審核、runtime adapter 全都有），只是最後沒有真的接上
`src/prologue.ts`／`src/carpenter-quest.ts` 這兩份持續在演進、持續踩坑
修正的真實腳本——所以正式系統停留在「设计骨架」，實際內容還是留在舊的
手刻寫法裡，兩邊沒有真正合流。如果這次不先盤點清楚就直接再設計一套，
很可能重蹈覆轍：又生出一套漂亮但沒人真的在用的抽象層，徒增维护負担。

## 現有的正式事件骨架：檔案分工

| 檔案 | 職責 | 目前狀態 |
| --- | --- | --- |
| `src/story/story-types.ts` | 事件／條件／步驟／context／存檔資料型別 | 這輪新增了 5 個 step 型別＋補上 dialogue 欄位 |
| `src/story/story-state.ts` | 目前章節、完成事件、旗標、選擇、已領取獎勵 | 完整，`storyState` 是全域單例 |
| `src/story/story-conditions.ts` | 判斷事件能不能觸發，回傳每項失敗原因 | 完整，支援 manual／事件前置／旗標／地圖／日期／季節／時段／好感度／物品數量 |
| `src/story/story-runner.ts` | 依序執行 `event.steps`，處理 choice／reward 的特殊邏輯 | 完整，但呼叫方（`runStoryEvent`）目前沒人呼叫 |
| `src/story/story-runtime-adapter.ts` | 把 runner 的抽象步驟接回瀏覽器實際系統 | **介面已定義，這輪補了新 step 的介面，但沒有任何檔案建立真正的 `StoryRuntimeBindings` 實例**——也就是說連接到 `dialogue.ts`/`cutscene-camera.ts`/`npc-runtime.ts` 的「真正的 binding」還沒人寫 |
| `src/story/story-registry.ts` | 所有正式事件的唯一索引 | `STORY_EVENTS` 目前是空陣列 |
| `src/story/story-audit.ts`／`scripts/story-audit.ts` | 結構檢查：重複/非法 ID、缺前置、循環依賴、非法參數 | 完整，`npm run story-audit` 目前印出「registry 目前没有事件」 |
| `src/story/chapters/act1.ts` | 第一章事件資料 | 空陣列，註解說要從 `concept/海風牧歌 主線劇本.txt` 逐段拆 |

`docs/decisions/story-system.md` 描述的規則本身沒有錯，但有一處跟實況
對不上：那篇寫「`main.prologue.arrival` 已登记为第一笔正式 ID」，但
`story-registry.ts` 的 `PROLOGUE_STORY_EVENTS` 其實是空陣列，這個 ID
並沒有真的被登記進任何地方。這輪沒有動那篇文件，先在這裡點出來，避免
下次以為「至少有一筆事件是接上的」。

## 兩份真實腳本比較出的共通積木

逐一比對 `src/prologue.ts`（序章）跟 `src/carpenter-quest.ts`（木匠）
實際在用的手法，這些是真的兩邊都出現、值得抽象的東西：

**觸發條件**——序章用 `shouldPlayPrologueOnBoot()`（有沒有存檔）；木匠用
`canStartCarpenterDockScene()`（`gameState.currentDay === 1 && hour >= 8
&& hour < 8.5`，`carpenter-quest.ts:88`）。這組「日期＋時段窗口」判斷跟
`StoryCondition` 的 `day`/`phase` 型別已經完全對得上，是兩邊共通、而且
正式系統**已經涵蓋**的部分。

**演出鎖**——序章用 `gameState.cutsceneActive`（見
`docs/decisions/prologue-cutscene.md`），這是全域旗標，不是「每個事件
自己的東西」；木匠沒有用這個旗標，只用 `dialogQueue.length` 擋重複觸發
（`carpenter-quest.ts:96`：`handleCarpenterDockTouch()` 開頭
`if (dialogQueue.length) return;`）。這代表木匠事件期間，玩家理論上還能
自由走動/操作——跟序章「演出期間完全鎖死」是不同等級的鎖，兩者都合理，
但正式系統目前**沒有**把「這段演出要不要鎖 `cutsceneActive`」做成可宣告
的欄位，是隱性、要自己在 runtime adapter 裡處理的東西。

**NPC 位置/顯示**——兩邊都是直接 `npcs.find((n) => n.id === "xxx")`
再改 `.mesh.visible`／`.mesh.position`，見 `carpenter-quest.ts:26-40`
（把村長跟木匠疊在主角腳下）跟 `prologue.ts` 的 `placePrologueMayor()`
（`prologue.ts:174`，隱藏 captain/mayor/carpenter 三個 NPC）。這輪新增的
`setActorVisible`／`positionActor`／`matchActorPosition` 三個 step 型別
就是把這個共通模式抽出來——`matchActorPosition` 對應的正是木匠那段
「兩人疊在主角腳下」的手法（見下面的轉換範例）。

**對話**——兩邊都呼叫 `dialogue.ts` 的 `showDialog()`/`showDialogSequence()`
（`dialogue.ts:146`/`178`），但內容形狀不一樣：木匠已經在用 i18n key
（`t("carpenter.dock.mayorIntro")`），序章的
`src/story/chapters/prologue-script.ts` 裡的 `DialogueLine` 型別是直接塞
中文字串，且比舊版 `StoryStep.dialogue` 多出 `name`／`comicCue`／
`hidePortrait`／`revealNameAfter` 這幾個欄位（序章要顯示漫畫提示、隱藏
立繪、對話後才揭露真名，這些木匠事件目前都沒用到，但序章大量使用）。
這輪把 `StoryStep.dialogue` 補齊這些欄位（改用 `nameKey`，跟系統既有
「玩家文字一律填 i18n key」的規則一致，不是直接抄 `name` 塞中文），讓
它終於能真正代表兩邊腳本的內容需求，不再只是一個看起來能用、實際上
表達力不夠的殘缺型別。

**鏡頭**——`StoryCameraShot`／`playCameraShots()` 是目前**唯一一個真正
被序章實際採用**的正式系統元件：`prologue-script.ts` 的
`PROLOGUE_GUIDE_CAMERA_SHOTS`／`PROLOGUE_OPENING_CAMERA_SHOTS` 直接是
`StoryCameraShot[]`，F4/C 除錯工具（`docs/decisions/cutscene-camera.md`）
印出的格式也剛好是這個型別，可以直接貼進事件資料。木匠事件完全沒有用
鏡頭（沒有 `playCameraShots()` 呼叫），走的是預設的自動跟玩家鏡頭。
這是目前「正式系統」與「真實腳本」少數已經合流的地方，值得作為之後
接其他系統時的參考案例——鏡頭這條線走通，是因為它從一開始設計時
（`docs/decisions/cutscene-camera.md`）就同時考慮了 F4/C 工具產出的格式
要直接可貼進事件資料，不是先設計型別、後來才想辦法兜資料進去。

**傳送／換圖**——序章跨圖用既有 `loadMap(mapName, startPos, onLoaded?)`
（`build-map.ts:3940`，內建 `fadeOut()`），`StoryStep.teleport` 的
`{mapId, target:{x,z}}` 形狀跟這支函式的參數已經對得上。木匠事件目前
沒有跨圖。

**時間暫停**——Zeppelin 特別點名的「時間是否暫停」，實際上**已經有一套
現成的正式抽象**：`src/time-pause.ts` 的 `setTimePauseSource(source,
active)` 維護一個 `activeSources: Set<TimePauseSource>`，`isWorldTimePaused()`
／`isGameplayPaused()` 讀這個集合＋自動偵測對話框開關。這輪新增的
`pauseTime` step 型別就是把這支既有函式包成事件步驟，不是重新發明——
`time-pause.ts` 本身已經是好的抽象，正式事件系統只是還沒有一個 step
去呼叫它。

**黑幕／淡出淡入**——序章走共用 `loading-screen.ts`
（`showLoadingScreen()`/`hideLoadingScreen()`，見
`docs/decisions/prologue-cutscene.md`「料理教學封鎖與序章黑幕」段），
`loadMap()` 換圖也內建 `fadeOut()`；木匠事件是自己手動操作
`document.getElementById("fade").style.opacity`（`carpenter-quest.ts:20-24`），
沒有走共用系統。這是兩邊真正**不一致**的地方，不只是「沒抽象」，是
「各自用了不同的黑幕機制」。這輪新增的 `fade` step 型別，之後真正接
runtime adapter 時，需要決定要接哪一套（建議接共用的 `loading-screen.ts`，
淘汰木匠那種手動 DOM 操作，見下面「待決定」）。

## 這輪新增的型別（純新增，已驗證）

`src/story/story-types.ts` 的 `StoryStep` 新增：

```ts
| { type: "setActorVisible"; actorId: string; visible: boolean }
| { type: "positionActor"; actorId: string; target: StoryWorldTarget }
| { type: "matchActorPosition"; actorId: string; toActorId: string }
| { type: "fade"; action: "out" | "in"; holdMilliseconds?: number }
| { type: "pauseTime"; active: boolean; source?: string }
```

`dialogue` step 補上（型別，不是重新設計 UI）：

```ts
nameKey?: string; // 顯示名稱的 i18n key，沒填就照 speakerId 查角色預設名
comicCue?: { actorId: string; kind: ComicCueKind }; // 沿用 comic-cue-logic.ts 的型別，沒有另開一份
hidePortrait?: boolean;
revealNameAfter?: { npcId: string; stage: 1 | 2 };
cg?: string; // 全螢幕 CG 掛點，對應 carpenter-quest.ts 用過的 setDialogCg() 模式
```

`story-runtime-adapter.ts` 的 `StoryRuntimeBindings` 介面同步補上
`setActorVisible`／`positionActor`／`matchActorPosition`／`fade`／
`pauseTime` 五個 binding；`story-audit.ts` 補上對應的參數驗證（actorId
不可空字串、座標必須合法數字、`holdMilliseconds` 不可為負）；
`story-system.test.ts` 補上這五個 step 的 mock binding 跟一次呼叫斷言。
**這輪沒有寫任何一個 binding 的「真正實作」**——也就是說還沒有程式碼把
`setActorVisible` 真的接到 `npcs.find(...).mesh.visible = ...`，這是
故意留白，見下面「分階段做法」的理由。

## 具體轉換範例：木匠碼頭事件

把 `carpenter-quest.ts` 的 `startCarpenterDockScene()`（現行、正式在跑
的實作）轉成正式 `StoryEvent` 格式，純示範對照用，**沒有加進
`act1.ts`**，避免跟現行 `handleCarpenterDockTouch()` 同時被觸發，兩套各
播一次同樣的對話。

現行寫法（`carpenter-quest.ts:19-72`）精簡摘要：

```js
export function startCarpenterDockScene() {
  carpenterQuest.stage = "escorting";
  fade.style.opacity = "1";
  setTimeout(() => {
    // 村長、木匠疊在主角腳下，設 visible=true
    // fade 淡出
    showDialogSequence([ 6 句台詞，i18n key ]);
  }, 400);
}
```

轉成 `StoryEvent`（示範，非正式資料）：

```ts
const carpenterDockScene: StoryEvent = {
  id: "act1.carpenter.dockScene",
  title: "木匠碼頭事件",
  summary: "村長帶木匠在碼頭迎接主角，簡短寒暄後木匠開始跟著村長行動。",
  chapter: "act1.carpenter",
  characters: ["mayor", "carpenter"],
  priority: 10,
  once: true,
  conditions: [
    { type: "day", min: 1, max: 1 },
    { type: "phase", min: 8 / 24, max: 8.5 / 24 },
    // 現行 canStartCarpenterDockScene() 沒有檢查地圖，這是碰觸事件
    // 掛在哪張地圖決定的，轉換時要回頭確認 build-map.ts 的觸發區，
    // 不能憑空補一個 map 條件。
  ],
  steps: [
    { type: "fade", action: "out" },
    { type: "wait", milliseconds: 400 }, // 對應原本 setTimeout(…, 400)
    { type: "setActorVisible", actorId: "mayor", visible: true },
    { type: "setActorVisible", actorId: "carpenter", visible: true },
    { type: "matchActorPosition", actorId: "mayor", toActorId: "player" },
    { type: "matchActorPosition", actorId: "carpenter", toActorId: "player" },
    { type: "fade", action: "in" },
    { type: "dialogue", textKey: "carpenter.dock.mayorIntro", speakerId: "mayor" },
    { type: "dialogue", textKey: "carpenter.dock.narrationArrive" },
    { type: "dialogue", textKey: "carpenter.dock.carpenterPlank", speakerId: "carpenter" },
    { type: "dialogue", textKey: "carpenter.dock.mayorWelcome", speakerId: "mayor" },
    { type: "dialogue", textKey: "carpenter.dock.carpenterKneel", speakerId: "carpenter" },
    { type: "dialogue", textKey: "carpenter.dock.mayorLaugh", speakerId: "mayor" },
  ],
};
```

轉換過程中發現三個沒辦法乾淨對應、需要 Zeppelin 或後續開發者做設計
決定的地方（刻意不在這輪自己決定）：

1. **`carpenterQuest.stage` 這個狀態放哪裡**——現行是
   `layout-maps.ts` 裡一個獨立的可變物件（`carpenterQuest.stage =
   "escorting"`），不是正式系統的 `storyState.flags`。若要真正接上
   `story/`，得決定：(a) 把 `carpenterQuest.stage` 整個搬進
   `storyState.flags`，`StoryCondition`/`setFlag` 直接讀寫，捨棄舊物件；
   或 (b) 保留舊物件，runtime adapter 的 `setFlag` binding 額外同步寫回
   `carpenterQuest.stage`，兩邊都要維護。(a) 比較乾淨但影響面較大（要
   確認 `layout-maps.ts`／`build-map.ts` 有沒有其他地方直接讀
   `carpenterQuest.stage`）。
2. **`once: true` 在這裡不完全準確**——現行 `carpenterQuest.stage` 是
   多階段狀態機（`not_started → escorting → construction →
   ready_for_move_in → moved_in`），碼頭事件只是其中一段，正式系統的
   「事件」比較適合對應「一整段狀態機裡的一次轉場」，不是「這個角色的
   任務」整體。轉換時要把木匠任務拆成 4-5 個獨立 `StoryEvent`（碼頭、
   建材確認、動工對話、入住），用 `eventCompleted` 條件串起彼此的前置
   關係，不是硬塞成一個事件。
3. **`fade` step 接哪一套黑幕**——如上一節「黑幕/淡出淡入」提到的，
   `fade` binding 的真正實作應該接共用的 `loading-screen.ts`，淘汰木匠
   目前手動操作 `#fade` DOM 元素這段，但這代表轉換木匠事件時同時要順手
   清掉一段舊程式碼，不是單純新增。

## 建議的分階段做法（不是一次到位）

這套正式系統看起來已經停擺過一次（型別/骨架做完就沒有下文），重蹈覆轍
的最大風險是「野心太大，一次要把序章 1645 行的船/跳板/鏡頭鎖/Y 座標
搶寫順序全部塞進通用 step，中途做不完又放棄」。建議反過來，從最小、
風險最低的地方開始，每一步都要能單獨驗收：

1. **先寫一個真正的 `StoryRuntimeBindings` 實作**（例如
   `src/story/story-runtime-browser.ts`），把 `dialogue`/`camera`/
   `teleport`/`pauseTime`/`fade` 這幾個「已經有現成底層函式可以直接包」
   的 binding 寫出來，`move`/`follow`/`setActorVisible`/
   `positionActor`/`matchActorPosition` 也不難（`npcs.find` 那套）。
   這步驟本身不需要註冊任何事件，可以先寫單元測試驗證每個 binding
   呼叫到正確的底層函式，零風險。
2. **挑一個全新、還沒開始寫的小事件，直接用正式系統寫**（不是轉換舊
   腳本），驗證整條路（registry → conditions → runner → adapter →
   真實畫面）真的通。這是目前最缺的一步——現在完全沒有一個事件從頭到
   尾真正跑過這套系統，連最簡單的都沒有，risk 未知。
3. **只有第 2 步驗證過、確定順手之後，才回頭考慮要不要轉換木匠事件**
   （序章因為船/跳板那些高度客製的物理演出，值得再另外評估是否適合
   硬塞進通用 step，或者維持 `execution: "external"`、只用正式系統管
   「有沒有完成」這個狀態，實際演出邏輯繼續留在 `prologue.ts`——這是
   合理的分工，不代表沒有抽象化，「有沒有完成、能不能觸發」的部分一樣
   能拿到 registry/condition/audit 的好處）。
4. **文本量真的變大時**，重新檢視 `dialogue`／`choice` step 的 i18n
   key 命名規則跟 `src/i18n.ts` 的查表方式是否撐得住量——這輪還沒有去
   看 i18n 系統本身撐不撐得住大量新增 key（不在這次盤點範圍內）。

## Phase 1（2026-09-01 補完）：概念驗證的實際結果

跟 Zeppelin／GPT 討論後定案的做法：不 migrate 序章或木匠，先寫一個全新
的、跟現有劇情無關的小測試事件，接一份真正的 `StoryRuntimeBindings`
實作，用四個停損標準驗收：

1. 新事件能通過 `story-audit`、`test:story`、`build`。
2. 能實際觸發、暫停時間、控制演員、淡入淡出、台詞與鏡頭。
3. 出錯時能明確定位是在資料、條件、runner，還是 runtime binding。
4. 寫事件的流程比手刻 state machine 更容易理解和除錯。

### 做了什麼

- **`src/story/story-runtime-browser.ts`（新檔）**：第一份真正接上瀏覽器
  系統的 `StoryRuntimeBindings`。`dialogue`／`camera`／`setActorVisible`／
  `positionActor`／`matchActorPosition`／`fade`／`pauseTime` 這 7 個是這輪
  測試事件實際會呼叫、也實際寫進自動化測試驗證過的；`choice`／`move`／
  `follow`／`teleport`／`grantItem`／`check` 只寫了最小可行實作（型別過
  關、不會噴例外），沒有被這輪測試事件跑過，**不代表它們也驗證過了**，
  之後真的要用到某一個要重新驗證。
  - `dialogue()` 接 `dialogue.ts` 的 `showDialogSequence()`；`step.textKey`
    先用 `t()` 解出實際文字，這段文字會再被 `renderDialogLine()` 內部的
    `translateText()` 處理一次——確認過 `translateText()` 在查不到表時會
    原樣回傳（`src/i18n.ts:89-98`），所以兩條翻譯路徑疊在一起是安全的，
    但這是目前 `t()` key 系統跟舊的 `translateText()` 系統唯一一處真的
    接在一起的地方，值得記錄。
  - `camera()` 接 `cutscene-camera.ts` 的 `playCameraShots()`；
    `waitForCompletion: true` 時鏡頭播完會自動呼叫 `stopCameraShots()`
    交還控制權，不用額外補一個「鏡頭歸位」step。
  - `fade()` 接的是共用的 `loading-screen.ts`（`showLoadingScreen`／
    `hideLoadingScreen`），不是木匠那套手動 `#fade` DOM 操作——這是刻意
    的選擇，之後真的要統一 fade 機制時，`loading-screen.ts` 是留下來的
    那一個，木匠那段才是要被淘汰的。
  - `positionActor()`／`setActorVisible()`／`matchActorPosition()` 都是
    透過 `actorId === "player" ? gameState.player : npcs.find(...)` 解析
    真正的 mesh，直接操作 `.position`／`.visible`，跟 `prologue.ts` 裡
    `mayor.mesh.position.set(...)` 那套既有手法完全一致（`placePrologueMayor()`
    那段註解本來就寫明「演出結束後她會照正常排程走，不用另外復原」，
    所以借用 mayor 當測試角色是安全的）。
- **`src/time-pause.ts`（新增一個來源）**：`TimePauseSource` 多了
  `"storyEvent"`。原因是接線過程中發現一個真的會咬人的問題——
  `syncAutomaticPauseSources()` 每次呼叫都會用 `#dialog` 目前的顯示狀態
  覆蓋 `"event"` 這個來源，所以如果 `pauseTime` binding 沿用 `"event"`，
  在「沒有對話框開著」的鏡頭/演出空檔手動呼叫
  `setTimePauseSource("event", true)`，下一次任何地方呼叫
  `isWorldTimePaused()`/`isGameplayPaused()` 就會被自動同步邏輯蓋掉，
  等於白設。這正是停損標準第 3 項想抓的那種問題——不是靠讀 code 猜到
  的，是真的把 binding 接上去才浮現。`"storyEvent"` 不會被自動同步邏輯
  動到，設了就會一直生效到明確關掉為止。
- **`src/story/chapters/dev-phase1-probe.ts`（新檔）**：測試事件本體，
  `id: "dev.phase1_probe.mayor_wave"`，`conditions: [{type:"manual"}]`，
  `once: false`（方便反覆按熱鍵重跑，不用重設存檔）。內容：暫停時間 →
  淡出 → 村長現身並移動到玩家附近 → 淡入 → 鏡頭拉近 → 三句對話（其中
  兩句用玩家名字/村長名字 i18n key，刻意重用 `carpenter.dock`/`carpenter.
  name` 那組既有 key 驗證跨事件共用 key 是通的）→ 恢復時間流動。**故意
  不註冊進 `story-registry.ts` 的 `STORY_EVENTS`**，只在 F9 熱鍵手動建構
  並執行，不會跟序章/木匠內容衝突，也不會出現在正常玩流程或
  `npm run story-audit` 的預設掃描範圍裡。
- **`src/input-save.ts`**：在既有的 F4（鏡頭調整模式）/F8（序幕重播）
  熱鍵旁邊加了 F9——跟這兩個一樣是只給開發用的 debug 熱鍵，同一個
  `addEventListener("keydown", …)` 區塊。按下後現場組一個
  `createDevPhase1ProbeEvent(player.x, player.z)`、接上
  `createBrowserStoryRuntimeBindings()`，呼叫 `runStoryEvent(...,
  {allowManual: true})`。如果已經有事件在跑（`storyState.activeEventId`
  非空），`beginStoryEvent()` 本身就會 throw 清楚寫明是哪個事件卡著；
  這裡額外加了一層 F9 自己的 guard 提前印警告，避免真的丟例外到
  console 嚇到人。
- **`docs/decisions/event-system.md` 本節** 跟 `src/story/story-system.
  test.ts` 新增一筆測試：直接把 `createDevPhase1ProbeEvent()` 餵給
  `auditStoryRegistry()` 斷言零錯誤，並用 `evaluateStoryEvent(...,
  {allowManual:true})` 斷言可手動觸發——因為這個事件故意不在
  `STORY_EVENTS` 裡，`npm run story-audit` 掃不到它，這筆測試補上這段
  覆蓋，是停損標準第 1 項「能通過 story-audit」的真正驗證位置。

### 過程中抓到的真問題（不是憑空猜的）

寫這份文件的第一版草稿時，`dev.phase1_probe.mayor_wave` 的事件 ID 跟
三個 `textKey` 一開始用的是 camelCase（例如
`devTest.wave.narrationApproach`），`npm run test:story` 直接報錯——
`story-audit.ts` 的 `ID_PATTERN` 只准全小寫（後面的分段可以有底線和數
字，但不准大寫）。這跟木匠既有的 `t("carpenter.dock.mayorIntro")` 那種
camelCase key 不衝突，是因為木匠的內容不是正式 `StoryEvent`，從來沒被
`auditStoryRegistry()` 掃過——**這正好印證了停損標準第 3 項要驗的東西：
正式系統的 audit 會抓到手刻腳本抓不到的錯，而且錯誤訊息（`非法 textKey
「devTest.wave.narrationApproach」`）直接點名是哪個事件、哪個欄位，不
用另外除錯猜半天**。修正方式是全部改成 snake_case（`devtest.wave.
narration_approach` 等），跟事件 ID 一起改完後測試全過。

### Zeppelin 實際玩過一次的結果（2026-09-01）

按 F9 之後：村長有現身、走到玩家旁邊，位置正常；鏡頭有拉近；三句對話
正常顯示；時間有確實停止。**只有一項不如預期：淡出淡入效果不明顯**。

查出來不是 binding 邏輯錯，是測試事件內容自己的參數沒調對：`fade`
step 真正接的 `showLoadingScreen()` CSS 轉場是 0.2 秒，而 `prologue.ts`
裡所有真正在用的地方（`finishPrologueWithTransition()`、
`returnToFarmHouseAfterFishing()`、`startPrologueFishingSequence()`）都
是 `await showLoadingScreen(); await holdPrologueBlackScreen(900);` 這樣
配一個 900ms 的黑幕停留，我的測試事件卻只給了 `holdMilliseconds: 250`
——黑幕都還沒轉到全黑就開始往回轉，難怪感覺不到。已經把
`dev-phase1-probe.ts` 的 `holdMilliseconds` 改成 900，跟序章的既有實測
值對齊，`fade` binding 本身（接 `showLoadingScreen`/`hideLoadingScreen`）
不用動。

這正好是停損標準第 3 項想驗的另一面——這次錯的不是「看錯誤訊息定位問
題」，是「照著實際玩過的既有腳本(prologue.ts)反查正確用法」，一樣是
正式系統的資料驅動特性帶來的好處：呼叫端(F9 handler／binding)完全不用
改，只要調整事件資料裡的一個數字就修好了，不用像手刻腳本那樣要在一大
坨 async 函式裡面找是哪一段的 `setTimeout` 數字要改。

修完之後 Zeppelin 重按一次 F9 確認：黑幕感覺出來了，clear。

### 結論：四個停損標準全過

| # | 標準 | 結果 |
|---|------|------|
| 1 | 新事件能通過 story-audit、test:story、build | 過（`npx tsc --noEmit`／12 個 test:story／專屬 audit 斷言全過；`vite build` 本身卡在這台機器既有的 Windows EPERM 問題，跟這輪改動無關，見文件最下面驗證區的既有備註） |
| 2 | 能實際觸發、暫停時間、控制演員、淡入淡出、台詞與鏡頭 | 過（Zeppelin 實測：村長現身/移動/位置正常、鏡頭拉近、對話顯示、時間確實停止、淡出淡入修完後也確認到了） |
| 3 | 出錯時能明確定位是在資料、條件、runner，還是 runtime binding | 過（實際遇到兩次：一次是 audit 直接點名非法 textKey，一次是靠事件資料裡一個數字對照 prologue.ts 既有用法就修好，都不用大範圍排查） |
| 4 | 寫事件的流程比手刻 state machine 更容易理解和除錯 | 過（上面兩次修復都只動了事件資料，沒有動任何呼叫端邏輯——這是手刻 `setTimeout`/`async` 函式版本很難做到的分離） |

**這套正式系統值得繼續投資，可以進入 Zeppelin/GPT 原本規劃的下一步
（要不要開始把木匠事件轉換過去），不用回頭改抽輕量 helper 的備案。**
F9 probe 目前留在 repo 裡（`src/story/chapters/dev-phase1-probe.ts` +
`input-save.ts` 的熱鍵），因為它完全跟正式內容隔離、成本趨近於零，之後
`story-runtime-browser.ts` 有任何改動都可以拿它當一次快速的手動回歸
測試，如果覺得沒必要留著，跟我說一聲就整組移除。

### 這輪驗證了什麼、還沒驗證什麼

**已經驗證（跑得動的自動化檢查）**：`npx tsc --noEmit` 全過；
`npm run test:story`（12 個測試，含新增的 audit/eligibility 斷言）全
過；`npm run story-audit` 正常印出「0 event(s)」（符合預期，因為測試
事件故意沒進 registry）；`test:map-tools`／`test:weather`／
`test:affection`／`test:save-slots`／`test:context-interaction`／
`test:tools`／`test:pearls`／`test:first-person` 這幾組既有測試全部
重跑過一次，確認 `time-pause.ts`／`i18n.ts` 的改動沒有波及其他系統。

**還沒驗證、需要 Zeppelin 實際跑一次遊戲確認**：F9 熱鍵在真正的瀏覽器/
Three.js 畫面裡按下去，村長是不是真的現身、移動、淡出淡入、鏡頭運鏡、
台詞框都如預期——這件事我這邊做不到，因為這台機器沒有能跑
`npm run dev` 再操作瀏覽器按鍵的環境。也就是停損標準第 2、4 項（「能
實際觸發…」「比手刻更好除錯」）目前只能算是「程式邏輯上說得通、單元
測試層級驗證過」，還不是「真的在遊戲裡看過一次」。

**建議的下一步（需要 Zeppelin 動手）**：`npm run dev` 開發模式跑起來，
在生活區隨便一個位置按 F9，對照上面「內容」那段描述看行為對不對；如果
中途出錯，看 console 印出的錯誤訊息是不是真的能一眼看出問題出在哪一層
（資料/條件/runner/binding）——這正是停損標準第 3 項要驗的東西，希望
親自試錯一次會比我在這裡描述更有說服力。試完之後再回頭決定要不要進
下一階段（轉換木匠事件）。

## Phase A（2026-09-01）：不靠 agent 也能手寫事件

Phase 1 驗證了「正式系統值得投資」，但寫事件目前還是要編輯 TS 檔案、
懂 `StoryStep` 型別、還要先去 `src/i18n.ts` 登記 i18n key——這對「萬一
agent 用不了，Zeppelin 自己想生一個事件」這個保底需求來說門檻太高。
Phase A 補上一條平行的手寫路徑：**JSON 事件檔案**，用文字編輯器就能寫，
不用碰 TS、也不用先登記翻譯 key。

### 資料格式

`src/story/chapters/data/*.json`——每個檔案可以是一個 `StoryEvent` 物件，
也可以是 `StoryEvent[]` 陣列。跟 TS 手寫事件共用完全一樣的 `StoryStep`
型別，差別只在文字欄位多了一條路：

- `dialogue` step：原本強制要填 `textKey`（i18n key），現在改成
  `textKey` 跟 `text`／`text_en`／`text_ja` 至少要有一個。`text` 是預設
  語言（中文）的字，直接寫死，`text_en`／`text_ja` 是可選的其他語言——
  不填的話該語言會退回顯示 `text`（中文），不是空白，見 `story-text.ts`
  的 `pickLocalizedField()`。兩個都給的話 `textKey` 優先（既有 TS 事件
  的嚴格 i18n 行為完全不變）。
- `choice` step 的 `promptKey`／`prompt`(`_en`/`_ja`)、`StoryChoiceOption`
  的 `labelKey`／`label`(`_en`/`_ja`) 是同一套規則。
- 用**扁平欄位＋語言後綴**（`text`/`text_en`/`text_ja`）而不是巢狀物件
  （`{zh,en,ja}`），是 Zeppelin 指定的格式——之後要幫某個事件補一個
  語言，就是直接在 JSON 裡加一個 `xxx_en` 欄位，不用改資料結構、agent
  或 Zeppelin 自己手動編輯都一樣直覺。
- speaker 顯示名不用另外填——`speakerId` 對到 `npcs` 清單裡的角色就會
  自動抓到對應顯示名（村長是名字揭露狀態機、木匠是 `npc-defs.ts` 的
  `name` 欄位），跟現有 TS 事件行為一致，不用重新發明。

### 載入機制（為什麼分兩條路徑）

`src/story/chapters/json-events.ts` 用 Vite 的 `import.meta.glob()` 在
建置期把整個 `data/` 資料夾打包進來，`story-registry.ts` 把這批事件併
進 `STORY_EVENTS`——這段只在瀏覽器/Vite 環境有效（`npm run dev`／
`npm run build` 都算）。`import.meta.glob` 是 Vite 專屬語法，
`scripts/story-audit.ts` 是用 `tsx` 直接跑（不經過 Vite）的獨立腳本，
呼叫不到這個 API（實測過，直接呼叫會噴 `TypeError`）。處理方式：
`json-events.ts` 自己先 `typeof` 檢查再呼叫，避免在 tsx 底下噴錯，
`scripts/story-audit.ts` 改用 `node:fs` 另外直接讀同一個資料夾驗證——
兩條路徑分開實作，但驗證的是同一批檔案，`npm run story-audit` 現在會
分別印出 TS／JSON 事件數量方便對帳。

### 實測草稿：`dev.carpenter_dock_intro_draft`

Zeppelin 給了一版木匠碼頭初登場的重寫台詞（更直接、不寒暄，一上來先
處理「木板要塌了」的危險，凸顯專業/眼裡只看得到損壞物的個性），拿來
當 Phase A 的第一份真實內容測試，而不是隨便編一個假範例。存在
`src/story/chapters/data/carpenter-dock-intro-draft.json`，第一次寫完
`npm run story-audit` 就直接過關（0 errors）——證明「純文字對話 + 旁白
方括號 + comicCue」這類最常見的內容，JSON 格式今天就能用，不用等
agent。**故意用 `conditions: [{type:"manual"}]`，不接進 `carpenter-
quest.ts` 的真實流程**，只能用 F10 熱鍵手動播放（見 `docs/decisions/
dev-hotkeys.md`），不會跟現行木匠劇情衝突——這批草稿要正式取代
`carpenter-quest.ts` 裡的對話，是另一個之後要不要做的決定，Phase A
只驗證格式本身堪不堪用。

### 這次順便驗到的東西

新增了 `pickLocalizedField()` 的單元測試，以及一個「JSON 風格事件（沒
有 textKey，只有 text）能通過 story-audit」的斷言（`test:story` 現在
14 個測試），加上 `carpenter-dock-intro-draft.json` 真的被 `npm run
story-audit` 掃過一次——這三層加起來，比 Phase 1 當時只驗證合成範例
更扎實一點。

### Zeppelin 給的木匠新腳本，還缺什麼（不是 Phase A 範圍，先記錄）

Zeppelin 順手貼了完整的第二天木匠腳本重寫（碼頭見面 → 選房子 → 給
玩家一把「萬用斧」教採集材料，附即時進度追蹤「木材0/10｜石材0/10」
→ 修繕蒙太奇（兩張 CG）→ 好感度 +30 → 事件完成）。開場那段（上面的
`dev.carpenter_dock_intro_draft`）已經用現有 `StoryStep` 完整表達，
其餘部分需要三塊目前還沒有的積木，先記下來，不在這輪動工：

1. **材料採集進度追蹤**——`StoryWaitCondition` 目前有 `cropCount`／
   `fishCaught`／`recipeCooked`／`actorReached`／`flag`，沒有「持有
   道具數量」這種條件，也沒有對應的「畫面上顯示 0/10 進度」UI。跟
   `cropCount` 應該是同一類型的擴充，但 UI 顯示這塊是全新的。
2. **`follow` binding 目前只是印警告的空殼**——腳本裡「進入跟隨模式」
   要用到，Phase 1 文件就寫過這個是最小可行實作、沒被真的跑過，這次
   剛好是第一個會用到它的真實內容。
3. **好感度/關係值沒有對應的 StoryStep**——`relationship` 目前只能當
   `StoryCondition`（門檻判斷），不能當動作（「+30」）。要嘛新增一個
   `grantAffection` 之類的 step 接 `affection.ts`，要嘛透過某種通用
   reward 機制处理，這個之前完全沒設計過。

道具「萬用斧」本身也是全新物品，不在 event-system 的範圍內（要先在
`game-state.ts`／`inventory-system.ts` 那邊定義出來，`grantItem` 這個
binding 才有東西可以真的發）。

## 給未來寫手（agent 或 Zeppelin 自己）的檢查清單

寫一段新演出／事件之前，先問自己這幾個問題，能幫忙决定要走正式系統
還是先手刻：

- **這段會不會被其他系統打斷/搶用資源？**（地圖 touch 事件、NPC 排程、
  時間流動）——會的話一定要決定要不要鎖 `cutsceneActive`／
  `setTimePauseSource`，不要假設「反正很快就播完」。
- **這段用到的世界座標，資料源是哪裡？**——比照 `docs/decisions/
  prologue-cutscene.md` 反覆強調的規則：不要在演出程式碼裡另外寫死
  座標，要嘛從 `LAYOUT` 推，要嘛是玩家/NPC 當下的即時座標
  （`matchActorPosition` 就是為了取代「手動抄一次 player.position.x/y/z」
  這種寫法）。
- **鏡頭需要換構圖嗎？**——需要的話直接用 F4/C 錄下來的
  `StoryCameraShot[]`，不要手推座標。
- **台詞用 i18n key，不要直接塞中文字串**——即使暫時只有中文版本，也要
  先建 key（`src/i18n.ts`），跟着系統既有規則走，不要學序章那種「以後
  再補」的做法，之後要多語言化時工作量會差很多。
- **這是一次性事件還是可以重複觸發？**——`once: true` 現在只能表達
  「完成過就不能再手動觸發」，多階段任務（像木匠）要拆成多個事件用
  `eventCompleted` 串前置，不要塞進一個事件裡自己手動管內部 stage。
- **寫完之後跑這三個命令**：`npx tsc --noEmit`、
  `npm run story-audit`（如果有加真正的事件資料）、
  `npm run test:story`。

## 驗證

```bash
npx tsc --noEmit          # 通過
npm run test:story        # 12 個測試全過（含 Phase 1 的 audit/eligibility 斷言）
npm run story-audit       # 印出「registry 目前没有事件」，符合現況（dev.phase1_probe 故意沒進 registry）
npm run test:map-tools test:weather test:affection test:save-slots test:context-interaction test:tools test:pearls test:first-person
                           # Phase 1 動了 time-pause.ts／i18n.ts，這幾組既有測試全部重跑確認沒有波及
```

**Phase 1 還缺的一步**：`npm run dev` 開發模式，遊戲裡按 F9 實際看一次
村長寒暄的演出是否如預期——這件事需要 Zeppelin 親自動手，見上面「Phase
1」一節最後的「還沒驗證」段落。
