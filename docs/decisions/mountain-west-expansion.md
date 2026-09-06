# 山區西側擴充

山區西側擴充使用 `src/layout-maps.ts` 的 `MOUNTAIN_WEST_EXPANSION` 作為唯一設定值。
目前為 10 格。

流程固定為：

1. 用 `shiftMapLayout()` 往 west 插入合法 tile 欄位，並同步搬動山門、樓梯、洞口、傳送點與玩家起點。
2. `foot`、`waist`、`summit` 三層平台保留原本東緣，西側各增加同樣格數。
3. 樹木座標抵銷整張地圖平移，讓樹仍落在平台範圍內；山區木材、石材、野花與蘑菇候選會讀更新後的 `foot/waist` 矩形，不另外維護掉落座標。
4. 依更新後的 `LAYOUT.mountain` 重建山區 tile，避免只移視覺而留下舊碰撞資料。

之後若要再次擴充，只需修改 `MOUNTAIN_WEST_EXPANSION`，並執行：

```bash
npm run mountain-debug
npm run map-debug -- --map=mountain --legend
npm run test:map-tools
npm run build
```

`mountain-debug` 會檢查地圖寬度、三層平台是否越界、平台是否仍有可走格，以及樹木是否落在三層平台內。若擴充同時改動山門或跨地圖傳送，還要確認 `map-transitions` 測試與山區實際進出路徑。
