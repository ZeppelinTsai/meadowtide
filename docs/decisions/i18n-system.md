# 多語言（i18n）系統

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。

## 正式語言設定（2026-08-28）

- 支援繁體中文 `zh`、日文 `ja`、英文 `en`。
- 標題畫面與遊戲中暫停選單共用的「系統」頁都提供語言下拉選單。
- 選擇保存在 `meadowtide.settings` 的 `locale` 欄位；這是裝置偏好，與音量、
  解析度相同，不綁定某一格遊戲存檔。
- `src/i18n.ts` 除了穩定 key 的 `t()`，也提供 `translateText(source)` 舊字串
  遷移入口與 `translateDocument()` 靜態 HTML 翻譯。
- `src/ui-translations.ts` 是仍使用中文原文的舊 UI／動態文字之日英過渡表；
  新功能仍應使用穩定的 `t("namespace.key")`，不要持續擴大原文查表。
- 靜態 `index.html`、系統設定、教學、HUD 日期／天氣、存檔摘要、資訊選單、
  對話顯示、選項與 Toast 已接入共同翻譯入口。無翻譯時保留繁體中文，
  不顯示空白或翻譯 key。
- 切換語言會立即重繪靜態 UI；已經排入 `dialogQueue` 的整段事件內容仍以
  觸發當下語言為準，關閉後重新觸發才會完整套用新語言。


`src/i18n.ts` 的 `t(key)` 依目前語言回傳翻譯字串，key 用點分隔
對應巢狀結構（例如 `"carpenter.dock.mayorIntro"`）；`setLocale(code)` 切換
語言。**目前劇情事件中只有 `carpenter.*` 這一組採完整穩定 key**，對應
`src/carpenter-quest.ts` 木匠事件的四段對話、材料不足提示、村長／木匠的
對話框名牌，涵蓋 `zh`（預設）／`en`／`ja` 三種語言。其他對話（`npc-defs.ts`
的 `npcLine()` 閒聊、其他角色事件）會先通過 `translateText()` 過渡表；
還沒有日英翻譯的原文會安全退回中文。其他場景正式遷移時，照
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

## 共用角色/地點命名空間（2026-09-03）

在 `TRANSLATIONS` 裡新增了 `characters.*`／`places.*` 這兩個共用命名
空間（`src/i18n.ts`），收角色（`mayor`/`carpenter`/`chef`/`captain`/
`artist`）跟地圖（`livingArea`/`port`/`oldVillage`/`mountain`）的顯示
名三語對照。動機：`carpenter.name.mayor` 這組翻譯之前鎖在 `carpenter.*`
底下，別的事件想顯示村長名字時沒有語意合適的 key 可以借用，只能重複
存一次翻譯，以後改名字要改兩個地方。新事件（不管是 TS `StoryEvent`
還是 Phase A 的 JSON 事件）要在 `dialogue`/`choice` step 顯示角色或地點
名稱，直接用 `nameKey: "characters.mayor"` 這種共用 key，不用管這句話
邏輯上屬於哪個章節。`carpenter.name.*` 保留沒動（避免動到正式在跑的
木匠事件），內容跟 `characters.*` 刻意保持一致。

同時加了 `NAME_LOOKUP`——從 `characters`/`places` 衍生出「中文原文→
譯文」對照，餵給 `translateText()` 的舊式原文查表用（衍生而非手動在
`ui-translations.ts` 重複打一次字串，避免又出現兩份名字翻譯各自漂移
的問題）。效果是：任何還沒切到 `t()` key 的舊呼叫點（例如
`npc-defs.ts` 的 `npcLine()` 直接回傳 `npc.name` 這種原文字串、
`dialogue.ts` 對話框名牌）也會自動吃到這批翻譯，不用逐一改呼叫點。
`places.*` 的四個地圖名稱字串故意跟 `src/ui-translations.ts` 既有的
地圖圖例（山區/城鎮/牧場/港口）完全一致，NAME_LOOKUP 才推得出對應
關係。

驗證：`npx tsc --noEmit`、`npm run test:story`（14 個測試）、
`npm run story-audit`（1 event，OK）、`test:map-tools`／`test:weather`／
`test:affection`／`test:save-slots`／`test:context-interaction`／
`test:tools`／`test:pearls`／`test:first-person` 全過；另外寫了一支
throwaway 腳本直接呼叫 `translateText("村長")` 等九組角色/地點字串，
確認 en/ja 都能查到正確譯文（`t("characters.mayor")` 也驗證過）。
