# NPC 招募流程模式（以木匠為範例）

木匠護送的 escorting／village_scene_done 階段，村長與木匠會在玩家身後
保持一般 NPC 對話半徑內，因此 input-save.ts 必須停用這兩個階段的一般
鄰近 NPC 閒聊。事件指定對話仍由 scripted touch/interact event 觸發，不能
為了擋身後村長而一起關閉。

> 從 `AGENTS.md` 搬過來的架構決策——這是之後每個新角色招募事件都該複製的框架，不是一次性的木匠專屬筆記。


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
