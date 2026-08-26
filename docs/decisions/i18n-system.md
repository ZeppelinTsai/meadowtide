# 多語言（i18n）系統

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。


`src/i18n.ts` 是查表骨架：`t(key)` 依目前語言回傳翻譯字串，key 用點分隔
對應巢狀結構（例如 `"carpenter.dock.mayorIntro"`）；`setLocale(code)` 切換
語言。**目前只有 `carpenter.*` 這一組翻譯是完整的**，對應
`src/carpenter-quest.ts` 木匠事件的四段對話、材料不足提示、村長／木匠的
對話框名牌，涵蓋 `zh`（預設）／`en`／`ja` 三種語言。其他對話（`npc-defs.ts`
的 `npcLine()` 閒聊、之後其他角色的事件）還沒接上 i18n，仍是純中文字串，
這是刻意先驗證機制堪用、不是遺漏——其他場景要上多語言時，照
`carpenter.*` 的結構在 `TRANSLATIONS` 裡新增一個頂層 key、把該場景的字串
換成 `t("key")` 呼叫即可，不用動 `t()`/`setLocale()` 本體。

**切換語言的方法（開發測試用）**：遊戲在瀏覽器跑起來後，打開 devtools
console，直接打：

```js
meadowtideI18n.setLocale("en")   // 切到英文
meadowtideI18n.setLocale("ja")   // 切到日文
meadowtideI18n.setLocale("zh")   // 切回中文（預設）
meadowtideI18n.getLocale()       // 查目前語言
meadowtideI18n.locales           // 列出支援的語言代碼 ["zh","en","ja"]
```

切換後**要重新觸發木匠事件的對話**（例如 F9 讀一個 `carpenterQuest.stage`
還在 `not_started`/`escorting`/`ready_for_move_in` 的存檔，或用
`carpenterQuest.stage = "not_started"` 手動重置後再走到觸發點）才看得到新
語言——已經顯示在畫面上的對話框不會即時重繪，因為 `showDialogSequence()`
是在觸發當下把整段對話陣列算好存進 `dialogQueue`，`t()` 只在那個當下被
呼叫一次。

**已知限制（刻意簡化，之後有需求再做）**：

- 沒有持久化：重新整理頁面或存讀檔都會回到預設語言 `zh`，語言不記在
  存檔裡。
- 沒有正式 UI 選單，只有 console 指令。
- 立繪／CG 素材不分語言，所有語言共用同一套 `public/assets/portraits`、
  `public/assets/cg`，不用另外準備多語言圖檔。
- 缺翻譯時 `t()` 會退回 `zh` 並在 console 印一行警告，不會讓對話框空白或
  丟例外；兩邊都查不到才會直接印出 key 本身當文字內容，方便一眼看出是
  哪一句漏翻。

