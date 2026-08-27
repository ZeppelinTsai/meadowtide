# 音訊系統：背景音樂（music.ts）+ 一次性音效（sfx.ts）

## 玩家音量設定

src/settings.ts 是顯示與音量偏好的單一資料源，使用 meadowtide.settings
存在 localStorage，不跟九格遊戲進度綁定。實際輸出為「總音量 × 分類音量」；
音效再乘呼叫端提供的單次倍率。M 與系統頁的「全部靜音」只切換 mute 狀態，
不破壞玩家原本的三組音量。

> 從 `AGENTS.md` 搬過來的架構決策，仍然有效。


**架構決定**：嚴格單軌播放，不組合「天氣×季節×日夜」多首音樂。晴天依
`nightFactor` 選擇目前季節的日曲或夜曲；非晴天時，天氣曲會取代季節曲，
不是疊加。切換時先把舊曲淡出並停止，再淡入新曲，任何時刻最多只有一首音檔
實際播放。目前共 12 首：「季節×日夜」8 首 + 天氣 4 首。

**季節 × 日夜（8 首）**

| 季節 | 白天                            | 晚上                        |
| ---- | ------------------------------- | --------------------------- |
| 春   | Playful Springtime Garden Dance | Whispering Sakura Moonlight |
| 夏   | Summer Breeze Echoes            | Summer Evening Lake View    |
| 秋   | Autumn Leaves Serenade          | Moonlit Autumn Serenade     |
| 冬   | Winter's Quiet Piano Whisper    | Soft Blanket of White       |

**天氣（4 首，優先做這個而不是季節×日夜的全部組合）**

- 雨天：Raindrops on a Quiet Day
- 颱風：Tropical Storm Approaching
- 下雪：Icy Dawn Arising
- 暴風雪：Gliding Alpine White Peaks（刻意避開 black metal 風格的「blizzard」
  搜尋結果，那些太恐怖，跟遊戲調性不合）

### 音樂系統技術說明

- 音檔放在 `public/assets/audio/bgm/`，檔名遵循
  `StockTune-<曲名>_<數字>.mp3`。實際檔名與用途的對照集中在
  `src/music.ts` 的 `BGM_TRACKS`；加入新曲時先把 MP3 放進該資料夾，再在
  `BGM_TRACKS` 加一筆。若是季節日夜曲，還要把 key 放進
  `SEASON_MUSIC_KEYS`；若是天氣曲，key 要與天氣狀態名稱一致。載入失敗只會
  在 console 警告，不會中止其他音樂。
- `getSeasonIndex()` 負責季節判斷，目前 `DAYS_PER_SEASON = 3`，所以測試時
  每 3 天換季；正式版暫定改為 21 天。`rollWeatherForSeason()`
  依季節限制每日天氣（含晴、陰、雨、颱風、暴風雨、雪、暴風雪），`beginNewDay()`
  在 `currentDay` 改變時抽取新天氣。`updateWeatherEffects()` 驅動固定在場景世界座標的
  低成本雨線、雪片、春季櫻花瓣與秋葉；粒子不可掛在相機下，否則會像跟著主角移動。
  所有戶外粒子的 X/Z 範圍必須由 `getTileGridWorldBounds(MAPS[currentMap].tiles,
  WEATHER_PADDING)` 取得，禁止再寫固定 `WEATHER_BOUNDS` 絕對座標；切換地圖時
  `syncWeatherBoundsToCurrentMap()` 必須重新分布雨、雪、花瓣與秋葉。粒子容量與有效
  draw range 由 `scaleCountForWorldBounds()` 依地圖面積同步縮放，讓俯視縮遠或地圖擴建後
  仍維持近似密度。`INDOOR_MAPS` 是室內天氣遮蔽的單一資料源，房屋與鐘乳石洞窟
  不渲染戶外粒子。修改粒子範圍、地圖尺寸或室內清單後執行 `npm run test:map-tools`
  與 `npm run build`；春季晴／陰不分日夜都會飄花瓣，暴風雨另有閃電。
- `initializeMusic()` 在第一次鍵盤／滑鼠操作時建立 Web Audio API 音訊圖，
  避開瀏覽器自動播放限制。`updateMusic()` 以 `nightFactor` 選擇季節日曲或
  夜曲；陰天沿用季節曲，其他惡劣天氣選天氣曲取代旋律（暴風雨沿用颱風曲）。
  切換採舊曲淡出停止、新曲才淡入的單軌
  狀態機，所有音量變化都經過 `GainNode`。每個曲目 key 只建立一個 `Audio` 實例，播放 Promise
  也有防重入保護；淡出到零的非作用中曲目會暫停，不會讓全部曲目靜音空轉。
  `M` 鍵控制 master gain 靜音。
- StockTune MP3（48kHz/192kbps）不是為無縫循環製作，若日後聽到循環接縫，
  可調整 `BGM_LOOP_HEAD_SKIP` 與 `BGM_LOOP_TAIL_TRIM`，讓單一 Audio 實例在
  尾端留白前跳回有效開頭；最終仍建議離線修剪音檔頭尾。遊戲內的 GainNode
  淡入淡出負責換季、日夜及天氣銜接，不會修復 MP3 本身的循環接縫。
- `src/weather-schedule.ts` 是每季天氣排程的純資料計算來源：流星雨第 11～14 日
  固定晴天；夏季颱風／暴風雨前後固定雨天，冬季暴風雪前後固定雪天，兩類
  極端天氣每個 21 天季節最多各 2 次。排程會存入存檔，避免重開後改變。
  修改天氣機率、保護日或極端天氣規則後必須執行 `npm run test:weather`，測試
  若發現流星雨日非晴天、過渡日錯誤或極端天氣超量，會以非零退出碼失敗。

### BGM 優先序（2026-08-25 已實作地域這層）

播放哪一首曲目由高到低分五層：**特殊事件 BGM > 通用事件 BGM > 地域 BGM >
天氣 BGM > 季節 BGM**。目前只有「地域／天氣／季節」三層有實作，
「特殊事件」跟「通用事件」對應的遊戲系統（劇情節點、突發事件之類）還
沒做，先只是把優先序的位置定下來，之後真的要做時直接在
`updateMusic()` 裡的 `desiredKey` 判斷式插在 `locationKey` 之前即可，不
用重寫淡入淡出/單軌切換那套機制。

- **地域 BGM**（`src/music.ts` 的 `LOCATION_MUSIC_KEYS`，依
  `gameState.currentMapName` 查表）：特定地圖固定配一首常駐曲，蓋過天氣
  跟季節——玩家在洞窟裡不管外面在下雨還是下雪，一律播洞窟自己的曲子，
  離開地圖後才交還給天氣/季節那套邏輯。音量沿用 `MELODY_VOLUME`（不是
  `WEATHER_VOLUME`），因為地域常駐曲是氛圍旋律，不是要蓋過去強調的層。
  目前只有鐘乳石洞窟（向下的海之洞）配好了：`stalactiteCave` →
  `seaCaveAmbient`（*Moonlit Sirens Of Atlantis*，harp、mystical，呼應
  「亞特蘭提斯水晶層」跟女神領域的設定）。山之洞（向上、山神領域）的曲
  子也已經選好放進 `BGM_TRACKS`（`mountainCaveAmbient`，*Celestial Ice
  Cave Echoes*，harp、introspective，呼應雲頂/山神），但地圖系統還沒做，
  所以先不放進 `LOCATION_MUSIC_KEYS`——之後山之洞的地圖 key 一旦定案，
  在 `LOCATION_MUSIC_KEYS` 補一行 `山之洞map名: "mountainCaveAmbient"`
  就會自動生效，不用碰 `updateMusic()`。
- 新增其他地域曲時比照這個模式：MP3 丟進
  `public/assets/audio/bgm/`、在 `BGM_TRACKS` 加一筆、在
  `LOCATION_MUSIC_KEYS` 對應地圖 key 補一行即可。

**還沒選、之後可能需要的分類**（使用者提過，還沒動手找）：慶典、房內、
戀愛事件、搞笑事件——這些是「特定場景觸發」的配樂，跟上面「環境常駐」
的音樂是不同層級，等對應的遊戲系統（節慶活動、室內場景、好感度/戀愛
事件、劇情觸發的喜劇橋段）真的做出來、需要配樂的時候再找，不要現在
選好晾在那裡。

## 一次性音效系統：`src/sfx.ts`（2026-08-25 已實作，來源：Kenney 音效包，CC0）

- 跟 `music.ts` 的 BGM 系統是刻意分開的兩套：BGM 是常駐 loop、經
  `AudioContext`/`GainNode` 做淡入淡出的單軌狀態機；`sfx.ts` 是「觸發當下
  播一次就丟掉」的短音效（砍材、採礦、拋竿、收竿…），用原生 `<audio>`
  就好，不用接進 BGM 那張 `GainNode` 圖，兩者互不干擾、可以同時響。
  `sfx.ts` 刻意是零 import 的葉節點模組，不會捲進專案既有的循環 import
  問題（見下面「除錯」段落與 `scene-sky.ts` 相關踩雷紀錄），要新增音效
  只改這個檔案跟呼叫端就好。
- **播放**：`playSfx(path, volume?)` 播單一音效；`playRandomSfx(paths[],
  volume?)` 從一組候選路徑隨機挑一個播——同一個動作通常備好幾個變化版
  （kenney 音效包大多一組 5 個 `_000~_004`），每次隨機挑，聽起來才不會
  太機械式重複。兩者都建立在同一個快取機制上：每個音檔路徑對應一個
  `HTMLAudioElement`「範本」（`loadSfxTemplate()`，只建立一次並快取），
  實際播放時 `cloneNode(true)` 出一個新的一次性副本再 `.play()`——這樣
  連續觸發（連砍兩下、礦點很密集連採）可以疊播，不會被前一個播放中的
  音效打斷或卡住。`.play()` 的 Promise 失敗會安靜吞掉（`.catch(() =>
  {})`），不讓瀏覽器自動播放限制或缺檔問題打斷遊戲邏輯；缺檔案只在
  console 警告一次（跟 BGM 系統缺檔的容錯慣例一致），之後把音檔補進資料
  夾就自動生效，不用改程式碼。
- **音量**：`SFX_VOLUME`（目前 `1.0`，2026-08-25 從最初的 `0.55` 拉高——
  玩家反饋原本太小聲）是全域預設值，`playSfx`/`playRandomSfx` 都可以用
  第二個參數個別覆蓋，但目前四個呼叫點都用預設值。使用者提過之後會在
  主選單加音量設定選項，屆時直接把 `SFX_VOLUME` 換成讀取玩家調整過的值
  （或是在 `playSfx` 內乘上一個全域倍率）即可，四個呼叫點（見下方）完全
  不用跟著動。
- **已有的音效分類**（集中在 `sfx.ts` 底部維護，全部來自
  `public/assets/audio/sfx/` 底下的 CC0 素材，換音檔/加變化版本只改這裡，
  不用去每個呼叫點找）：`CHOP_WOOD_SFX`（砍材/砍礦共用的木質敲擊音，5 個
  變化）、`MINE_ORE_SFX`（採礦敲擊音，5 個變化）、`FISH_CAST_SFX`（拋竿，
  借用「丟骰子」的甩動+落地聲代表甩竿出去，3 個變化）、`FISH_REEL_SFX`
  （收竿，借用「皮帶扣具」的拉緊聲代表拉線回收，2 個變化）——後兩組是
  找質感最接近的替代品，音效包裡沒有專門的釣魚素材；之後補到專用音檔
  時直接換掉這兩個陣列的路徑即可，呼叫端不用動。
- **呼叫點**：全部集中在 `input-save.ts` 那個單一的 E 鍵
  `keydown` handler 裡——砍材/採石的 `harvestGatherNode` 成功分支
  （`granted > 0`）呼叫 `playRandomSfx(CHOP_WOOD_SFX)`；採礦的
  `harvestOreNode` 成功分支（`result.amount > 0 && result.tier`）呼叫
  `playRandomSfx(MINE_ORE_SFX)`；`fishingState` 從 `"idle"` 轉
  `"casting"` 時呼叫 `playRandomSfx(FISH_CAST_SFX)`；從 `"biting"` 轉為
  收竿結算時呼叫 `playRandomSfx(FISH_REEL_SFX)`。新增其他動作的音效時，
  比照這個模式：在 `sfx.ts` 加一組路徑陣列，在對應的遊戲邏輯分支呼叫
  `playRandomSfx()`，不用另外包裝或建立新的播放器。
