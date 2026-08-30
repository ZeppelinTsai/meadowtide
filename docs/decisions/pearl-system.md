# 珍珠與牡蠣架系統

牡蠣架初始一格，可擴建到三格。每座架子各自保留每日採收狀態；採收牡蠣時最多隨機取得一顆珍珠。

珍珠稀有度依序為白、粉、紫、黑、金。基礎掉落率分別為 20%、10%、5%、2%、1%；每多一格牡蠣架，所有已解鎖珍珠的機率各增加 5 個百分點。判定由最稀有往最常見執行，單次採收最多取得一種。

黑珍珠只有所有一般村民好感皆達六星才加入掉落池；山神與海神不列入此條件。金珍珠只有主線完成旗標 main.completed 為 true 時才加入掉落池。好感或主線未達條件時，即使隨機值命中也不能取得。

珍珠資料、機率與解鎖判定集中在 src/pearl-system.ts。牡蠣架格數必須經 normalizeOysterRackSlots 限制在 1 到 3；存檔缺少新欄位時回退為一格，珍珠數量回退為零。

驗證命令：

- npm run test:pearls
- npm run test:save-slots
- npm run build
- npm run map-debug -- --map=livingArea --legend
