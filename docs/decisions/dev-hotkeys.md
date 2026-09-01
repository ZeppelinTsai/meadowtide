# 開發用熱鍵與除錯入口

Zeppelin 提醒：之後正式出貨會有好幾種切片（electron exe、純 HTML 靜態
版），每種切片出貨前都要記得把開發用的熱鍵/除錯入口關掉，不要漏。這篇
盤點目前全部的開發用熱鍵跟 `window.*` 除錯入口，並且把熱鍵那批直接用
`import.meta.env.DEV` 擋掉——這樣「正式版要記得關掉」就不是一件需要每
次出貨前手動檢查的事，而是**建置流程本身就會處理**：

- `import.meta.env.DEV` 是 Vite 內建的旗標，`npm run dev`（開發模式）是
  `true`，任何 `npm run build`（`tsc --noEmit && vite build`）產出的
  `dist/` 都是 `false`。
- `npm run build:win`（electron-builder 包 exe）跟未來規劃的純 HTML
  靜態版，兩者都是直接拿同一份 `vite build` 的 `dist/` 輸出去包裝，不是
  分開兩條建置流程——所以只要用 `import.meta.env.DEV` 擋一次，兩種切片
  會同時失效，不用各切一次。

## 開發用熱鍵（`src/input-save.ts` 同一個 `keydown` 區塊，已用
`import.meta.env.DEV` 擋掉）

| 按鍵 | 做什麼 | 備註 |
|------|--------|------|
| F4 | 開/關鏡頭調整模式（`cutscene-camera.ts`）：方向鍵平移鏡頭焦點、滾輪/雙指縮放，跟 C 鍵搭配用 | 開發用，錄鏡頭構圖給 `StoryCameraShot[]` 用 |
| F8 | 重播序幕（第一天開場演出），不用清存檔，只能在港口地圖按 | `prologue.ts` 的 `previewPrologue()` |
| F9 | 觸發 `dev.phase1_probe.mayor_wave` 測試事件（event-system Phase 1 概念驗證用） | 見 `docs/decisions/event-system.md`；跟正式劇情內容無關，故意不進 `story-registry.ts` 的 `STORY_EVENTS` |
| F10 | 播放 `chapters/data/*.json` 裡手寫的草稿事件（目前是 `dev.carpenter_dock_intro_draft`） | event-system Phase A（JSON 手寫事件格式）概念驗證用，見 `docs/decisions/event-system.md`「Phase A」 |
| C | 視目前模式而定：F4 模式下記一顆鏡頭(`recordCameraAdjustShot`)；第一人稱模式(Tab)下記一顆第一人稱鏡頭(`recordFirstPersonCameraShot`) | 兩個分支都只是把座標印到 console 讓開發者複製貼上，不影響遊戲本身 |

**Tab（切換第一人稱視角）本身不在這張表裡**——那是正式的玩家功能，
不受 `import.meta.env.DEV` 影響，任何切片都要保留。

## `window.*` 除錯入口（尚未自動擋掉，先記錄）

這些是直接掛在 `window` 上、只能從瀏覽器 devtools console 手動呼叫的
除錯工具，不是按鍵，正式版仍然「能被呼叫」（只是一般玩家不會知道要打
什麼），风险比熱鍵低很多，這輪沒有動它們：

| 名稱 | 位置 | 用途 |
|------|------|------|
| `window.saveGame` / `window.loadGame` | `src/input-save.ts:615-616` | 跟正式的 Shift+數字鍵存讀檔共用同一組函式，這裡只是額外開一個 console 可以直接呼叫的入口，方便測試不想對著存檔格位按鍵 |
| `window.meadowtideI18n` | `src/i18n.ts:288` | 切換語言用；`i18n.ts` 自己註解寫明「保留作除錯用途」，正式入口在系統選單，這個是備用 |
| `window.__fishHintEl` / `window.__nightFactor` / `window.__chefQuest` / `window.__setThresholdMarkersVisible` / `window.__gameState` | `src/game-loop.ts`、`src/input-save.ts` | 都已經用雙底線前綴自我標記為內部除錯用途，沒有額外文件 |

之後如果要出海外/公開版，這批要不要也擋掉（例如包一層
`import.meta.env.DEV ? realFn : undefined`）是另一個決定，跟熱鍵不同的
是它們目前沒有實際危害（不會被誤觸，只能靠打字呼叫），先記錄起來，
之後真的要出穩定公開版時再一起討論要不要收掉。

## 之後加新的開發用熱鍵/入口時

比照這篇的做法：熱鍵一律在條件式裡加 `import.meta.env.DEV &&`（參考
`src/input-save.ts` 現有的四個分支），`window.*` 除錯入口至少維持雙底線
前綴的命名慣例，然後回來這篇補一行——不要等到快出貨了才回頭找有哪些
忘記關。
