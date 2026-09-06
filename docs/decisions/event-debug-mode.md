# 事件快速測試模式

事件快速測試只在 Vite 開發模式啟用。按 `F9` 開關選單；選單從
`src/story/story-registry.ts` 的唯一 registry 讀取事件與 metadata，不維護第二份清單。
既有手刻演出以 `execution: "external"` 登記 metadata，真正台詞與流程仍由原本的
`prologue.ts`、`day2-morning-event.ts` 與角色事件模組執行。

開始測試時，系統將目前進度複製到 `sessionStorage`，重新載入一份可丟棄的測試狀態。
重播事件會一直從同一份原始快照開始；「還原快照／結束測試」才回到一般進度。
測試期間手動存檔、快速存檔與每日自動存檔都不會寫入 `localStorage`，讀取一般存檔也會被阻止。

選單可以選擇自動套用事件的日期、時間、地圖、季節、天氣、好感度、道具、旗標與前置事件，
或用 ignore 模式只繞過觸發條件。手刻演出內建的場景切換與時鐘鎖仍照原腳本運作。

瀏覽器主控台介面是 `window.eventDebug`：

```js
eventDebug.run("event.play main.day2.arrivals auto")
eventDebug.run("time.set 12:30")
eventDebug.run("date.set 7")
eventDebug.run("warp port")
eventDebug.run("affection.set carpenter 600")
eventDebug.run("flag.set debug.example true")
eventDebug.run("weather.set rain")
eventDebug.run("snapshot.restore")
```

也可以在 F9 選單底部輸入相同字串。`event.list`、`location.list` 與 `help` 用來查詢。

CG loader 先嘗試響應式 WebP，再嘗試同 ID 的 PNG；兩者都不存在時，使用同一套 CG
淡入、差分與關閉流程顯示程式生成的 placeholder，並在 console 印出 asset ID。
placeholder 的文字位於畫面上半部，正式圖片補到 `public/assets/cg/<id>.png` 後會自動取代。

修改事件測試模式後執行：

```bash
npm run test:event-debug
npm run story-audit
npm run test:story
npm run build
```
