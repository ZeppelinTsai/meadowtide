# 釣魚 QTE 系統：src/fishing.ts

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。實際數值/設計來源另見專案文件《釣魚QTE系統設計筆記v1》。


`fishing.ts` 是純資料/邏輯模組，跟 `layout-maps.ts` 同一個原則——不 import
THREE/DOM，方便之後寫測試或給其他工具共用。六階魚表（垃圾/小/中/大/魚
霸主/特殊）、竿具等級折扣公式（`max(0 或 1, 基礎QTE − 等級×3)`）、QTE
序列產生（`buildQteSequence`，direction 事件 + 額外插入不計入額度的
rush/暴衝事件）、三段式命中判定（完美/成功/方向錯誤/沒按）、張力增減量
表全部在這裡，數值都是草案（詳見專案文件 `claude/釣魚QTE系統設計筆記
v1.md`，裡面有完整設計來源、待確認事項、跟每一輪追加功能的實作記錄）。

**串接方式**（刻意的單向依賴，避免循環 import）：`game-state.ts` 只放
狀態欄位（`fishingState: "idle"|"casting"|"biting"|"reeling"`、
`rodLevel`、`fishingQte`、`pendingFishTier`）；
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
上），內含一個當下要按的按鍵/方向大字。兩組 UI 互斥顯示。

**已知簡化/未做**（完整清單見專案文件「還沒做」段落，這裡只列會影響
之後改動的部分）：只有 `livingArea` 地圖能釣魚（`nearWater()` 判斷綁在
`input-save.ts` 的 E 鍵處理，`currentMapName === "livingArea"` 這個條件
寫死）；`rodLevel` 有欄位但沒有任何升級介面；魚的個性行為模版
（快魚/深水魚/跳躍魚…）全部還是同一種隨機方向。
