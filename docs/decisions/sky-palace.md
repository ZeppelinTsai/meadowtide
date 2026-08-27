# 雲上天宮地圖與傳送

skyPalace 是 50×50 的戶外地圖空殼，目前只有四周不可通行邊界、地板與
兩組雙向傳送點。地圖尺寸及所有觸發／抵達座標統一放在
src/layout-maps.ts 的 LAYOUT.skyPalace、LAYOUT.mountainCave 與
LAYOUT.mountain.skyPalaceGate；事件只讀這些欄位，不另寫座標。

- 山之洞第 25 層的 (43~45, 2~4) 天梯區會傳送到天宮北側；此事件必須以
  MOUNTAIN_MINE_FLOOR_MAX 限制樓層，其他樓層的相同座標不得觸發。
- 天宮北側 3×3 門區可回到山之洞第 25 層，抵達 (42,3)，避開原觸發區。
- mountain 的 (20,14) 與天宮南側 (24,47) 雙向連接；兩側抵達格都和
  觸發格分開，避免載入後立刻反向傳送。

修改這三張地圖或端點後，必須執行：

    npm run map-debug -- --map=mountain --legend
    npm run map-debug -- --map=mountainCave --legend
    npm run map-debug -- --map=skyPalace --legend
    npm run test:map-tools
    npm run build
