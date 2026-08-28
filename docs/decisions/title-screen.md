# 開局標題畫面：src/title-screen.ts

標題背景直接顯示生活區的即時 3D 場景，不可截圖轉成 CSS 背景；主遊戲
`animate()` 必須持續更新天空、水面、浪花與環境動畫。展示期間由
`first-person-camera.ts` 的 presentation camera 覆寫輸出鏡頭，離開標題時解除。
鏡頭使用 `(18.27, 2.38, 8.01)`、yaw `-7.276`、pitch `0.103`、FOV `65`。
季節與時刻先讀目前遊戲狀態；沒有目前玩家時讀 `savedAt` 最新的存檔，
舊存檔沒有 `savedAt` 則以 `elapsed` 回退。離開標題時才還原共享 gameState。

標題 BGM 分三段：06:00–11:59 白天、12:00–17:59 下午、18:00–05:59 晚上。
三個時段集中在 `TITLE_SCENE_PRESETS` 作為可擴充範本；BGM 必須等玩家
按任意鍵／滑鼠／手把從 splash 進入選單後才開始。離開標題時清除標題音樂
優先權，交還地區／天氣／季節音樂。

標題畫面在玩家模型建立前必須自行呼叫 pollGamepad()；主遊戲 animate()
會因 gameState.player 尚不存在而提早返回，不能依賴它輪詢。Splash 階段
任一手把按鈕都可進入主選單，且必須等該按鈕放開後才啟用一般 UI confirm，
避免按住 A 直接誤觸開始新遊戲，或讓 Y／Start 洩漏成遊戲快捷鍵。離開標題後
立即停止標題輪詢，避免與遊戲迴圈重複讀取。

> 2026-08-26 新增，架構決策摘要。完整討論脈絡見
> `docs/history/changelog.md` 最後一節。

## 流程

`splash`（純白底，按任意鍵）→ `menu`（開始新遊戲／繼續遊戲／系統／
結束遊戲）。開始新遊戲會先進 `profileName`（姓名輸入），再進
`appearance`（左男性、右女性的 3D 模型預覽），選定後才開始序章；
系統設定與讀檔則分別進 `system`／`loadSlots`。所有步驟共用同一個
`#titleScreen` 容器（`index.html`），用 `data-step` 屬性切換誰可見
（`style.css`），`z-index: 100`，蓋過 `#fade`（20）等既有最高疊層。

## 「按任意鍵」順手解決 BGM 自動播放政策問題

序幕（開場第一天演出）是開局自動觸發，玩家連一次互動都還沒做，第一次
嘗試播放 BGM 一定會被瀏覽器的自動播放政策擋下
（`NotAllowedError`，見 `docs/decisions/audio-system.md` 的
`ensureMusicTrackPlaying()` 重試修法）。標題畫面的「按任意鍵」這一下
是玩家在這個分頁裡第一次真正的使用者手勢，`title-screen.ts` 的
`enterMenu()` 就地呼叫 `initializeMusic()`——比單純讓失敗可以重試更
進一步，理論上序幕/正常遊戲的 BGM 第一次嘗試播放時政策就已經解鎖。

## 開局分支邏輯搬進按鈕，不再是開局自動判斷

`main.ts` 原本自己判斷 `shouldPlayPrologueOnBoot()`（有沒有存檔）
決定要不要播序幕。現在改成玩家自己在主選單選：

- **開始新遊戲**：先填寫姓名並選擇男女外型，再執行
  `buildMap("port"); loadMap("port", undefined);
  startPrologueScene();`——等於原本 `shouldPlayPrologueOnBoot()` 為真
  那條分支，不檢查是否已有存檔（不刪除既有存檔，只是不管它——舊存檔
  要到玩家實際按 F6 存檔時才會被覆蓋）。
- **繼續遊戲**（`hasSaveData()` 為真才顯示這顆按鈕，見
  `docs/decisions/prologue-cutscene.md` 的 `hasSaveData()` 說明）：
  `buildMap("livingArea"); loadMap("livingArea", undefined);` 之後用
  `setTimeout(..., 500)` 銜接呼叫 `loadGame()`——這是這輪才第一次把
  讀檔接進開局流程，原本存檔要進遊戲後手動按 F9 才會讀。**500ms 的
  由來**：`loadMap()` 內部是 `fadeOut()→setTimeout(cb,400)` 才真的
  建立 `gameState.player`，`loadGame()` 會直接讀寫
  `gameState.player.position`，兩者不能同一個 tick 疊在一起呼叫
  （player 還不存在）；500ms 留了 100ms 緩衝，跟 `startPrologueScene()`
  自己那個 400ms `setTimeout` 是同一種「用 `setTimeout` 對齊淡出時機」
  的既有寫法，不是新發明的排程模式。

`main.ts` 因此瘦身成只呼叫 `initTitleScreen()` +
`requestAnimationFrame(animate)`。`animate()` 本來就有
`if (!gameState.player) return;`（第一行），所以標題畫面停留多久都
不會出事，不用額外處理「還沒建地圖時 animate 在幹嘛」。

## 「系統」子畫面

目前只放了音樂靜音切換（復用既有的 `setMusicMuted()`）。其餘選項
（音量滑桿、語言切換之類）刻意留白，等 Zeppelin 想好再加——不要自己
腦補加上去。

## 「結束遊戲」

瀏覽器分頁沒辦法被網頁自己強制關掉（除非分頁本身是用 `window.open()`
開的）。做法是盡量嘗試 `window.close()`，不管有沒有成功都顯示一句
「感謝遊玩，可以關閉這個分頁了」收尾訊息——這是先跟 Zeppelin 確認過
的保底寫法，不是偵測失敗才顯示。

## 狀態

截至 2026-08-26，這套流程還沒有實際跑過完整的按鍵/滑鼠互動測試
（splash→menu→四顆按鈕各自的畫面/行為），需要 Zeppelin 確認。

## 展示期間 HUD

標題畫面啟用 `body.title-presentation`，必須隱藏遊戲 HUD 與右上快捷卡；離開標題時移除。標題自身的 Logo、提示與選單不受影響。

## 標題天體時鐘

標題從目前遊戲狀態／最新存檔的日期與時刻起算，但展示期間採現實 1 秒＝遊戲世界 1 秒。換算量為 `frameDt * (dayLength / 86400)`，只更新 `elapsed/currentDay/currentPhase/currentSeason`，不得呼叫正式跨日時鐘觸發自動存檔、作物成長、天氣重抽或任務工程進度。離開標題後還原載入前狀態；正式遊戲照原倍率運作。標題跨越 06:00／12:00／18:00 時同步重選分時 BGM。

## 標題場景動物

標題生活區不顯示牧場動物。地圖建置後只將 `animals[].mesh` 從展示 scene 移除，不修改動物資料或正式地圖生成；開始新遊戲／讀檔重建地圖後照常出現。
