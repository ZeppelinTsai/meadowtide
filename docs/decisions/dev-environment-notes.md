# 開發環境雜項筆記(給協作 agent 看)

這份文件記錄跟遊戲邏輯無關、但會拖累 agent(Claude/Codex 之類)工作效率的
環境問題跟修法，避免每個 agent 各自重新摸索一次，或誤以為是自己改壞的。

## `npm run test:map-tools`/`test:weather` 曾經整套跑不動——已修好

**症狀**：`tsx --test ...` 連啟動都失敗，不會跑到任何一個 test case，錯誤
指向 esbuild 平台 binary。

**根因**：`node_modules` 是在 Windows 原生環境(`win32-x64`)裝的，但實際
在跑指令的是這台機器上的 Linux VM(`linux-x64`)。esbuild/rollup 這類工具
會依平台裝對應的原生 binary，`node_modules/@esbuild/` 底下只有
`win32-x64`、沒有 `linux-x64`，`tsx`(內部靠 esbuild 轉譯)直接掛掉。

**2026-08-27 修法**：在這個 Linux VM 環境裡對著同一份 `node_modules`
再跑一次 `npm install`(不用先清掉舊的，npm 只是把目前平台缺的 optional
binary 補齊，兩種平台的 binary 會並存，不衝突)。跑完 `@esbuild/linux-x64`
出現，`npm run test:map-tools`(32 個測試)、`npm run test:weather`(3 個
測試)都能正常跑完。

**如果之後又壞了**(例如有人在 Windows 原生環境重新整個 `rm -rf
node_modules && npm install` 一次，會把 Linux 平台的 binary 洗掉)：在
Linux VM(也就是這個 agent 平常工作的環境)裡對著 repo 根目錄再跑一次
`npm install` 就好，不用整個重裝，也不會動到 `package-lock.json`(補的是
`optionalDependencies` 而已)。

**這件事連帶抓到一個真的問題**：測試套件長期跑不動，代表這段時間所有靠
`tsc --noEmit` 驗證、但沒被人在遊戲裡實測到的邏輯改動，其實完全沒被
`map-transitions.test.ts` 這類快照測試檢查過。修好後第一次跑就抓到一筆
真的過期快照——`docs/decisions/oldvillage-terrace-depthwrite.md` 第三輪
修正把 `northBeachPlatform.segments` 其中一段的 `depth` 從 `3` 改成
`2.5`，但當時測試套件跑不動，沒人發現斷言沒跟著更新。已經一併修掉，細節
見那份文件。**教訓：以後只靠 `tsc --noEmit` 當驗證手段是不夠的，測試能跑
的話一定要跑，尤其是碰 `layout-maps.ts`/座標相關的改動。**

## `tsconfig.json` 加了 `incremental`

`tsc --noEmit` 之前每次都是從零開始全量檢查。這個環境跑指令的時間預算
有限(單次呼叫上限約 43 秒)，檔案數/程式碼量還會繼續長，全量檢查遲早會
撞到這個上限。2026-08-27 加了：

```json
"incremental": true,
"tsBuildInfoFile": "./node_modules/.cache/tsbuildinfo/tsconfig.tsbuildinfo",
```

`tsBuildInfoFile` 特意放在 `node_modules/` 底下，藉助既有的
`node_modules/` gitignore 規則，不用另外加 `.gitignore` 條目。純粹是
「第二次以後跑更快」的快取，不影響任何檢查結果，`noEmit: true` 底下一樣
安全（有實測比對過，開關前後回報的 diagnostics 一致）。

## 工作目錄裡常出現一批「跟本次改動無關」的 modified 檔案

`git status` 偶爾會顯示一堆完全沒被任何 agent 動過的檔案是 modified（例如
`main.js`、素材資料夾裡一堆 Kenney 的 `.url`/`.txt`/`.ini`），一看 diff
全部是純換行符號(CRLF↔LF)差異，沒有真的內容變動。

**根因**：repo 沒有 `.gitattributes`，`core.autocrlf` 也沒設定，所以「這個
檔案該用什麼換行符號」完全看最後一個寫入它的工具/編輯器的預設值——不同
agent、不同作業系統的編輯器混著用，換行符號就會不斷來回漂移。

這不是任何一個 agent 的 bug，是專案缺一個明確的換行符號規範。**建議**（
還沒做，因為這牽涉到要不要一次性 normalize 全 repo 的既有檔案，屬於
「Zeppelin 自己決定要不要做」的層級，不是 agent 該自作主張的範圍）：加一份
`.gitattributes`，至少對 `*.ts`/`*.js`/`*.md`/`*.json` 這類文字檔案訂
`text=auto eol=lf`，處理過一次之後這類雜訊 diff 就會消失，之後每個 agent
看 `git status` 才不用先花時間分辨「這是我真的改的還是換行符號漂移」。

## 這個 repo 只能透過裝置橋接編輯，不能用 Read/Edit/Write 工具

不是這個 repo 特有的規則，是純技術限制：這個專案的原始碼實際存放在
Zeppelin 的 Windows 機器上，雲端 agent 的 Read/Edit/Write/Grep/Glob 工具
只能碰到雲端容器自己的檔案系統，完全看不到裝置上掛載的資料夾。所有編輯都
得透過裝置橋接的 shell 工具(`device_bash`)執行——實務上是寫一段 Python
heredoc 做「讀檔→用 `assert content.count(old) == 1` 確認鎖定唯一改動點
→寫回」，比直接用 Edit 工具慢一些，但沒有更好的替代方案，純粹紀錄一下這
個限制的來源，避免有人以為是工具設定錯誤。
