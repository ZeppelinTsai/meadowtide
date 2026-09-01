# 動物返舍路徑系統

## 現狀（會卡住/繞路的舊寫法）

動物白天在牧場採直線移動，故意不用 A*（見 npc-runtime.ts 開頭註解：
牧草地是空地，划不來）。但返舍（17:00 後 animalsShouldBeHome）時，走的
仍是同一套「直線朝目標點移動＋碰撞分軸滑行」邏輯，只是多插了一個寫死
的中繼點 `BARN_RETURN_APPROACH`（npc-runtime.ts:71，
`{ x: LAYOUT.barn.x + LAYOUT.barn.w + 1, z: BARN_DOOR.z + 2 }`，目前算
出來是 (24, 2)）——動物一律先直線衝去這個中繼點，抵達（距離 < 0.35 格）
才切換 `returningViaApproach = false`、改朝 `BARN_DOOR` 直線走
（game-loop.ts:1190-1220）。

這個中繼點原本是為了解決「大型動物會卡在 (24, 0)」加的補丁（見同一段
註解），但因為是**固定座標、不看動物當下位置**，只要動物出發點本來就
離門口很近（例如已經站在門前），還是會被迫先繞去 (24, 2) 再折返——
這就是 Zeppelin 這輪回報「動物返舍會先走到 (24, 2)，這個不對，會變成
在門口前還得繞路」的成因。

## 根因

返舍邏輯本質上是「直線 + 一個寫死的中繼點」，不是路徑搜尋，所以無法
依動物實際站位判斷「要不要繞」「往哪繞」——(24, 2) 這個點只在某幾種
進場角度下有效，換一個起點就變成純粹多餘的繞路。

## 修法：比照村民 NPC 排程移動，改用既有的 aStar()（已實作）

專案裡本來就有跟玩家移動同一套四方向網格 A*（`aStar()`，
layout-maps.ts:2482），村民 NPC 排程移動已經在用這一套（game-loop.ts:
1010 附近）：目標改變時才重新算一次路徑（用 `lastTargetKey` 判斷是否
要重算），結果存進 `n.path` / `n.pathIndex`，逐格走完。

返舍邏輯改成比照這個既有寫法（game-loop.ts 的 `animalsShouldBeHome` 分支）：
動物物件新增 `homePath` / `homePathIndex`（npc-runtime.ts 動物物件定義）；
動物一進入返舍狀態、`homePath` 還是 `null` 時，以動物當下格子座標
（`Math.round` 取整）為起點、`BARN_DOOR` 為終點跑一次 `aStar()`，
`isBlockedFn` 直接包一層既有的 `isAnimalPositionSafe(a, x, z)`（已經把
動物體型半徑算進去）；`outsideCols` / `outsideRows`（npc-runtime.ts:
19-20）當網格尺寸——livingArea 是動物唯一會出現的地圖，不需要像村民
NPC 那樣動態取 `gameState.currentMapName`。算出來的路徑逐格用原本的
`moveAnimalWithCollision()` 走完（保留原本每幀的静态碰撞防呆），走到
終點才把 `state` 切回 `"in"` 並清空 `homePath`。

沒有用 `findReachablePath()`（navigation.ts，BFS + 容許半徑找最近可達
點）——那支是給「目標本身可能被完全擋住，退而求其次找附近可達點」的
情境用的；這裡的目標（穀倉門口）本身一定是通的，直接 `aStar()` 找最短
路徑即可，語意也跟村民 NPC 現有寫法一致。

`BARN_RETURN_APPROACH` 這個寫死中繼點已整個移除；`aStar()` 本身就會
算出繞開小屋牆面、柵欄的路徑，動物不管當下站在牧場哪個角落，都是走
真正最短路徑進門，不會再被強迫繞去 (24, 2) 這種固定點。

任何會把動物瞬間移到別的座標的地方（`rescueAnimalFromObstacle()`、
20:00 強制進屋、卡住逾時備援、早上重新出欄）都同步清空 `homePath`，
避免下一幀沿用根據舊座標算出來的過期路徑。

## 待確認

- 路徑走到一半被（例如另一隻動物）擋住時要不要重算：村民 NPC 現況也
  沒特別處理這塊，返舍動物先比照現況不做，交給既有的
  `moveAnimalWithCollision()` 分軸滑行 + 卡住 2 秒逾時備援兜底。
- 這篇記錄的是程式邏輯本身；`npm run build` 的 `tsc --noEmit` 跟
  `npm run test:context-interaction`（含 navigation/animal-production
  測試）都已通過，但實際走位手感（尤其大型動物在穀倉周邊轉彎的視覺）
  仍需要 Zeppelin 進遊戲實看一次確認。

驗證命令：

- npm run map-debug -- --map=livingArea --legend
- npx tsc --noEmit
- npm run test:context-interaction
