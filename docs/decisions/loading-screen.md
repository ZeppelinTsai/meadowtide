# 共用載入畫面

`index.html` 的 `#loadingScreen` 是全畫面黑色遮罩，z-index 1000，必須早於 TypeScript 與 WebGL 初始化就存在並預設顯示。

需要執行換圖或大型同步工作時，先 `await showLoadingScreen()`，確保黑幕至少實際繪製一幀後再開始工作；場景與資源準備完成後 `await hideLoadingScreen()`。不要自行新增另一個全畫面載入遮罩，也不要拿 `#fade` 或標題背景代替。啟動標題是特殊情況：HTML 已預設顯示黑幕，標題完成首幀後只呼叫 `hideLoadingScreen()`。
