# 遊戲時間節奏

## 世界時間與視覺動畫時間

室內與礦坑會暫停 gameState.elapsed，但場景內仍允許玩家行走。因此走路、
待機、水波等純視覺動畫必須使用 gameState.effectElapsed 作為相位；是否實際
播放則另外讀 isMoving 或 dt。不可用暫停中的世界時間驅動室內移動動畫，否則
角色會正常位移但手腳停在固定姿勢。

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效——採集點座標規則也在裡面，改動前照樣要看。


- `TIME_CONFIG` 是唯一時間參數來源：現實 30 秒＝遊戲 1 小時、一天 24 小時
  （`dayLength = 720` 秒，約 12 分鐘一天）、`daysPerSeason = 21`（一個 21
  天月份對應一季）。若之後要讓一季包含多個月份，需另加月份層，不要只改
  這個常數。
- `elapsed` 是唯一累計時鐘；`updateGameClock()` 統一處理正常計時與 `N`
  快轉，跨日事件逐日觸發（不會因為快轉跳過中間天數的 `beginNewDay()`）。
- `SEASON_DAYLIGHT` 以遊戲小時設定四季日出日落；`getNightFactor()` 的
  結果供天空、太陽、月亮、燈光、音樂與星象共用。
- HUD 顯示季節內第 1～21 日與上／中／下旬。`F6` 儲存、`F9` 讀取，亦可
  呼叫 `saveGame(slot)`／`loadGame(slot)`。
- 流星由 `METEOR_CONFIG`、`METEOR_SHOWER_SCHEDULE` 管理；第 11～15 日為
  流星雨，第 14 日高峰。`meteorPool` 固定最多 16 個物件；室內、白天或
  不可見天氣會清空活動狀態，不會累積 geometry/material。
- 木材／石頭採集點每天 06:00、18:00 各刷新一次；採集後整個模型立即消失，
  不使用 emissive 發光提示。標記 `persistent` 的序章荒廢農田木石不屬於一般刷新：跨時段與換圖都保留未採集節點，只有玩家親自清除後才永久消失。每區、每批的數量以 `src/game-state.ts` 的
  `GATHER_NODES_PER_KIND` 為單一資料源，目前生活區西側、山區山腳與山腰
  都各為 3 木＋3 石，山頂不生成。隨機座標必須從 `MAPS` 的可走草地與
  `LAYOUT.mountain.foot/waist` 推導；山腳／山腰只可生成在各層
  `LAYOUT.mountain.plazas` 的平地上，且須靠近 `LAYOUT.mountain.trees` 的
  既有樹木，避免散落到玩家難以搜尋的平台角落。木石不得共用座標；修改後執行
  `npm run map-debug -- --map=livingArea --legend`、
  `npm run map-debug -- --map=mountain --legend` 與 `npm run build`。
- 生活區採集點只可在 `LAYOUT.livingArea.gatherZone` 定義的西側範圍生成，
  目前為 `x=0～2、z=3～36`；並須依同一物件的 `mountainGateClearance`，排除
  `MOUNTAIN_GATE_BLOCKER` 周邊，避免木石掉在山區傳送點附近。魚池左上岸的六棵遮陽樹
  由 `LAYOUT.lake.shadeTreeOffsets` 定位，碰撞 tile 與季節變色樹模型都從這份
  資料推導；移動魚池時不可另留寫死的樹座標。
- 生活區西側背景山坡的基準角度由 `LAYOUT.mountainBand.slopeDegrees` 控制，
  目前為 30°；`makeWesternMountainTerrain()` 必須從這個角度計算線性抬升，
  不可另寫非線性高牆公式。第一人稱可見的山腳側面填充範圍由同一物件的
  填充的 Z 範圍必須直接沿用同一函式算出的 `northZ`～`southZ`，不可另存固定終點；
  向世界下方延伸的 Y 底界由 `footFillBottomY` 控制。填充必須是涵蓋
  `slopeWestX`～`slopeEastX` 的實心體，不可只放東緣平面，
  否則斜角仍會看見山坡底面後方的天空。修改後執行 `npm run build`。
