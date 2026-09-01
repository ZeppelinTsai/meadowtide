# 響應式圖片資源（WebP 多版本）

Zeppelin 的原則：「圖片資源都要對」——不管是地圖底圖、CG 還是之後的
立繪，只要是會被玩家看到的 2D 圖片素材（AGENTS.md「圖片素材規則」：
3D 世界完全程式生成，圖片只用在 UI 層），都應該有對應解析度的版本，
不要讓小視窗載入不必要的大圖，也不要讓全螢幕玩家看到被硬拉伸的小圖。

## 兩種載入機制，為什麼不是同一套

**世界地圖底圖**（`public/assets/map/world-map.png`）：檔名固定、只有
一張，直接寫死在 `index.html` 的 `<picture><source srcset>`（見
`docs/decisions/map-menu.md`），瀏覽器原生依視窗寬度挑對應的 WebP
版本，PNG 只作 fallback。

**CG／立繪**：檔名是執行期才決定的（`cgId`／`speakerId`，例如
`carpenter_movein`），沒辦法預先寫死一份 HTML `<picture>`——用
`src/responsive-images.ts` 的 `responsiveWebpUrl()` 在 JS 裡依目前視窗
寬度組出對應網址，`src/dialogue.ts` 的 `setDialogPortrait()`／
`setDialogCg()` 先試 WebP，`onerror` 就自動退回原始 PNG，兩層都找不到
才是真的沒圖（維持既有「找不到就留空、不打斷對話」的容錯精神，不會
因為加了這一層而變得更容易出錯）。

寬度分級跟畫面上這個元素實際會多大直接對應，不是隨便挑的：

| 資源 | 寬度分級 | 依據 |
|------|----------|------|
| 世界地圖底圖 | 480 / 960 / 1440 | 地圖選單面板尺寸 |
| CG | 1280 / 1600 / 1920 | 直接對齊系統設定的三個視窗解析度選項（`system-settings-ui.ts` 的 `RESOLUTIONS`） |
| 立繪 | 400 / 600 / 800 | `#dialogPortrait` 的 `max-width: min(86vw, 760px)`，抓到略高於上限給高 DPI 螢幕留餘裕 |

立繪的常數（`PORTRAIT_RESPONSIVE_WIDTHS`）已經定義在
`src/responsive-images.ts`、`dialogue.ts` 也已經接上同一套 WebP-優先
邏輯，但**還沒有幫 `public/assets/portraits/` 批次產生 WebP**——那個
資料夾目前混了不少測試/重複檔案（`mayorTEST.png`、`carpenter - 複製
- 複製.png`、`Adobe Express - file.png` 之類），批次跑下去會連垃圾檔
一起產生 WebP，值得先清一輪資料夾再處理，這個決定留給 Zeppelin。

## 產生 WebP 版本

`scripts/export-responsive-images.py` 有兩種模式：

```bash
# 單一檔案（世界地圖底圖，既有用法，向下相容不用改）
npm run assets:webp

# 整個資料夾——底下每個 *.png 各自輸出一組（CG 用這個）
npm run assets:webp:cg
# 等同於：
python scripts/export-responsive-images.py --input-dir public/assets/cg --widths 1280,1600,1920
```

`--input-dir` 模式下每個檔案的輸出前綴就是它自己的檔名(stem)，不用
（也不能）再手動指定 `--name`。

## 匯出 exe 前的自動提醒

`npm run build:win` 會在打包前自動跑
`scripts/check-responsive-images.ts`，掃描 `RESPONSIVE_IMAGE_SETS`
清單裡的每一項（目前是世界地圖底圖 + CG 資料夾），檢查對應的 WebP
版本存不存在、有沒有比來源 PNG 舊——有問題印警告 + 該打的指令，**不會
擋 build**（純提醒，來源圖檔還沒放時安靜跳過，不會誤報）。

## 之後要幫立繪也做這套處理時

1. 清一輪 `public/assets/portraits/`，只留真的會用到的角色立繪。
2. 跑 `python scripts/export-responsive-images.py --input-dir public/assets/portraits --widths 400,600,800`
   （或加一個 `assets:webp:portraits` npm script，比照 `assets:webp:cg`）。
3. 在 `scripts/check-responsive-images.ts` 的 `RESPONSIVE_IMAGE_SETS`
   加一筆 `sourceDir: "public/assets/portraits"` 設定。

`src/dialogue.ts`／`src/responsive-images.ts` 的程式碼這輪已經先寫好
（`PORTRAIT_RESPONSIVE_WIDTHS` 常數、`setDialogPortrait()` 的 WebP-優先
邏輯），不用再改程式，只差上面這三步的素材/腳本工作。

## 第一次用真實 CG 素材驗證（2026-09-01）

塞了一張真的 CG（`public/assets/cg/030.png`，歐文/木匠特寫，來源
1672px 寬）進去，接上 `dev.carpenter_dock_intro_draft`
（`src/story/chapters/data/carpenter-dock-intro-draft.json`）最後一句
對白的 `cg` 欄位，跑 `npm run assets:webp:cg` 實際產生了
`030-1280.webp`／`030-1600.webp`，`1920` 這個 tier 因為來源只有
1672px 寬、放大會糊，被腳本正確跳過（不放大是既有設計，見上面
「產生 WebP 版本」一節）。

跑下去才發現 `scripts/check-responsive-images.ts` 不知道這條「來源
不夠寬就跳過」的規則，把被正常跳過的 `030-1920.webp` 誤判成「忘記
匯出」而印警告。修法：`checkOne()` 現在會讀來源 PNG 檔頭（PNG IHDR
chunk，不需要裝 Pillow）拿到實際寬度，先把比來源寬的 tier 從檢查
清單濾掉，再檢查有沒有缺檔——跟 python 腳本「不放大」這條規則對齊。

程式碼／管線這邊 `tsc`／`test:story`／`story-audit`／
`check-responsive-images` 都過了，但**畫面上 WebP 版本的 CG 實際看
起來對不對，還是要 Zeppelin 進遊戲按 F10 觸發那段木匠碼頭草稿事件親眼
確認**——尤其留意讀取到的是不是真的 WebP（不是退回 PNG）、圖片沒有
被裁切變形。

## 驗證

```bash
npx tsc --noEmit
python3 -m py_compile scripts/export-responsive-images.py   # 語法檢查，不需要 Pillow
npx tsx scripts/check-responsive-images.ts                  # 目前印「檢查通過（或美術尚未加入）」
```
