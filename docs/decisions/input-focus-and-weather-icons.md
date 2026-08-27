# 背景切換輸入與天氣圖示

瀏覽器／Electron 視窗失焦或 `document.hidden` 時，實體鍵盤的 `keyup` 可能
不會送回頁面。`input-save.ts` 必須清空玩法 `keys` 與 `ePressed`；
`gamepad-input.ts` 同時釋放合成鍵、搖桿軸值與上一幀按鈕狀態。否則回到遊戲
後，角色會沿失焦前的方向持續前進。修改輸入狀態時執行 `npm run build`。

HUD 天氣不可依賴系統彩色 Emoji 字型。Windows EXE 的 Electron 字型回退可能
只得到黑色單色字形；所有天氣圖示統一由 `weather-icons.ts` 產生內嵌 SVG，
瀏覽器與打包版因此使用相同顏色與形狀，不需要外部圖片或系統 Emoji 支援。
