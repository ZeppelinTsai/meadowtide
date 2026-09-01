# 地圖選單

地圖與資訊選單是同級 UI，使用獨立的 `mapOverlay`，不放進資訊選單分頁。鍵盤 `M`、
標準手把 `Select/Back`（button 8），以及右上角「地圖」按鈕都直接開啟此分頁；
再次按 `M/Select` 關閉。`Q/Y` 仍開啟一般資訊選單，`LB/RB` 沿用既有分頁切換。

地圖底圖的原始單一資料源是 public/assets/map/world-map.png。瀏覽器使用
480/960/1440px WebP 響應式版本，PNG 只作 fallback。更新 PNG 後執行
npm run assets:webp，不得手工分別修改輸出尺寸。

2026-09-01 補：`npm run build:win`（exe 匯出）現在會在打包前自動跑
`scripts/check-responsive-images.ts`，檢查 world-map.png 有沒有對應的
三個 WebP 版本、版本有沒有比來源 PNG 舊——有問題會印出警告跟該跑的指令
（不會擋 build，純提醒）。world-map.png 還沒放圖片素材時這個檢查會安靜
跳過，不會誤報。這套機制之後也用在 CG／立繪上，完整說明見
`docs/decisions/responsive-images.md`。

四個地點按鈕會透過既有 loadMap() 傳送，並統一讓主角朝下：山區 (14,53)、
生活區 (21,20)、舊村 (125,10)、港口 (5,14)。座標或地圖資料調整後必須
重新驗證這四格仍在範圍內且可走。

`M` 原先的全部靜音快捷鍵已移除，避免同鍵同時開圖與靜音；音量與靜音仍由
系統設定處理。第一章基本操作教學必須與此配置同步。
