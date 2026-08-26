# 過場鏡頭系統：src/cutscene-camera.ts

> 從 `AGENTS.md` 搬過來的架構/設計決策，仍然有效。

## 設計原則：只換位置/焦點/遠近，不做自由旋轉的攝影機

2026-08-26 跟 Zeppelin 確認過範圍：這套系統的目標是讓事件演出可以像
「風之繁華市集」那樣換鏡頭構圖，但**維持 `scene-sky.ts` 的 `TILT_RAD`
固定傾角不變**，不做可以任意旋轉、側拍、貼近角色臉部的自由攝影機。
理由：現有整個遊戲的視覺風格就是固定傾角的正交相機，真的做自由旋轉會
立刻跟其餘畫面風格不一致，而且低模角色/場景是照著「固定俯視角看得到
的樣子」做的，貼近或換角度可能會看到背面沒做細的地方、貼圖接縫、或
場景邊界外的空白。所以一顆鏡頭（`CameraShot`）只有三個數字：看向哪個
世界座標 `focusX`/`focusZ`、`zoom` 拉多近（套用
`docs/decisions/camera-zoom.md` 的 2/5/10/20 級距，不要發明新的 zoom
數字）、`duration` 補間到這顆鏡頭要花多久。

## 跟原本「自動跟玩家」鏡頭邏輯的關係

`game-loop.ts` 主迴圈原本的鏡頭邏輯是：每幀讀 `gameState.player.position`
（序幕外海/靠岸那幾階段例外，直接讀 `prologueRefs.ferry.position`，見
`docs/decisions/prologue-cutscene.md`）算出 `cameraFocusX`/`cameraFocusZ`，
再套各地圖自己的邊界夾限。這套過場鏡頭系統是在算這兩個值**之前**插進
一段檢查：`updateCameraShots(dt)`（清單播放中）或
`updateCameraAdjustMode(dt, ...)`（F4 手動模式開著）任一個回傳非
`null`，就直接拿那組 `{focusX, focusZ, zoom}` 蓋掉整段「自動跟玩家＋
逐地圖邊界夾限」的邏輯，並且同步把 `gameState.zoom` 設成該值、呼叫
`updateCameraFrustum()`。兩者都回傳 `null` 時，行為跟這套系統加進來之前
完全一樣——這是刻意設計成「預設無副作用」，之後就算完全不呼叫
`playCameraShots()`，遊戲其餘部分不會有任何變化。

## 播放清單：`playCameraShots(shots, fromX, fromZ, fromZoom, onDone?)`

給事件腳本呼叫。`fromX`/`fromZ`/`fromZoom` 是「鏡頭現在在哪」，用來讓
第一顆鏡頭從目前位置補間過去，不會一開場就是硬切。清單放完之後
`onDone` 回呼一次、狀態自動清空，鏡頭下一幀開始交還給
「自動跟玩家」邏輯。`duration` 設 `0` 代表這顆鏡頭是硬切、不補間。

## 鏡頭調整模式（開發用）：F4 開／關

`F4` 開關，開著時：

- 方向鍵（`ArrowLeft/Right/Up/Down`）平移焦點（`ADJUST_PAN_SPEED = 9`
  世界單位/秒）。
- 滾輪／雙指縮放照舊沿用 `input-save.ts` 既有的 `setCameraZoom()`（本來
  就會把目前 zoom 印到 console，這條是 2026-08-26 稍早就加的）。
- `C` 鍵把目前焦點+zoom 記一顆鏡頭（預設 `duration: 1.5`），整份清單
  重印在 console，格式已經是可以直接貼進程式碼的 `CameraShot[]`。
- 再按一次 `F4` 關閉，鏡頭交還自動跟隨。

典型用法：`F8` 重播序幕（或站在任何地圖上）→ `F4` 開手動模式 → 用方向鍵
/滾輪試出想要的構圖 → `C` 記下來 → 換下一個構圖繼續 `C` → 滿意後把
console 印出的清單複製進事件程式碼，呼叫 `playCameraShots()`。

**已知限制**：方向鍵在 `game-loop.ts` 平常也是 WASD 的替代移動鍵；
`gameState.cutsceneActive` 為 `true` 時那段移動判定整個不執行，方向鍵
才不會同時「鏡頭在動、玩家也在走」。目前只在過場期間（`cutsceneActive`
為真，例如序幕）測試過，一般自由走動時開 F4 會同時吃到方向鍵當移動
輸入——之後如果要支援「一般走動時也能開這個模式」，得先處理這個輸入
搶用的問題（例如開 F4 時額外鎖住方向鍵的移動判定）。

## 跟 `prologue.ts` 既有 zoom 鎖的衝突(2026-08-26 真正的根因)

Zeppelin 換成 F4 之後回報「還是動不了」——這次不是熱鍵問題，是真的邏輯
衝突：`prologue.ts` 的 `updatePrologueCutscene(dt)` 從序幕一開始就有
`lockPrologueZoom()`，**每一幀**都會把 `gameState.zoom` 強制釘回
`PROLOGUE_ZOOM(5)`(原意是防止玩家滾輪滾到別的縮放、破壞演出既定的
取景距離)。這個「每幀重釘」跑在 `game-loop.ts` 主迴圈**前段**(自由移動
那個 if/else 區塊)，比這套過場鏡頭系統插進去的那段(camDist 那裡)還早
執行——所以不管滾輪或 F4 調整模式把 `gameState.zoom` 改成什麼，下一幀
一開始就被蓋回 5，畫面上完全看不出縮放有變化，跟「鎖死了」沒兩樣。

修法：`updatePrologueCutscene()` 改成只在**沒有鏡頭系統接管**時
(`!isCameraShotsPlaying() && !isCameraAdjustModeActive()`)才每幀重新
確認/鎖 zoom；鏡頭系統(清單播放或 F4 手動模式)接管時，zoom 完全交給
它決定，不會再被 `lockPrologueZoom()` 蓋掉。開場 `startPrologueScene()`
一次性的 `lockPrologueZoom()` 呼叫(把鏡頭釘在已知距離開演)不受影響，
還是照原本邏輯跑。

## 為什麼是 F4，不是 F7

2026-08-26 最早這裡選的是 `F7`，Zeppelin 實測回報「畫面好像被鎖住、
zoom 動不了」——查了一下，`F7` 是 Chrome／Firefox 內建的「插入符瀏覽
(caret browsing)」切換鍵，第一次按會跳出瀏覽器原生的確認對話框，
擋住整個分頁的輸入/渲染，之後也可能讓方向鍵被瀏覽器的插入符移動搶走，
不是這套系統本身的邏輯錯誤。換成 `F4`(Chrome 沒有預設用途)之後同一段
邏輯應該就正常了。這裡記一筆是提醒之後要加新熱鍵時，避開瀏覽器有預設
行為的鍵位(常見的坑：F1 說明、F3/Ctrl+F 尋找、F5 重新整理、F7 插入符
瀏覽、F10 開瀏覽器選單、F11 全螢幕、F12 開發者工具)。

## 尚未做的事

- 目前沒有任何事件實際呼叫 `playCameraShots()`——這一輪只交付系統本身
  跟 F4 調整工具，序幕（或未來的市集事件）要接上鏡頭清單得等 Zeppelin
  用 F4 試出想要的構圖之後再寫進去。
- `duration` 之外沒有可調的 easing 函式，統一用內建的
  `easeInOutQuad`；之後真的需要不同轉場手感（例如硬切、慢入快出）再加
  參數。
