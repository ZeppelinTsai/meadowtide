# 物品模型顯示尺寸：三個情境各自為政的問題與這輪的修法

## 背景

2026-09-01，Zeppelin 回報「背包的轉向不對，然後牡蠣跟木材石材顯得好小，
需要統一一下物品的模型介面尺寸了，包括手拿、物品縮圖、以及地圖上的尺寸」。
盤點後發現同一個道具模型(例如 `makeWoodPile`)會在三個完全獨立的情境出現，
各自套用不同、互不知情的縮放邏輯，疊了好幾層之後失控：

1. **地圖上(世界採集點)**：`build-map.ts` 直接呼叫 `makeWoodPile(x, z)` 等
   factory，不做任何額外縮放——顯示的是模型原始尺寸(某些 factory 內部自己
   會 `group.scale.setScalar(1.35)` 之類的自我校正，例如 `makeWoodPile`、
   `makeOysterProp`)。這是三個情境裡唯一「所見即所得」、沒有二次正規化的
   基準尺寸。
2. **背包/手持共用的模型**：`inventory-system.ts` 的 `makeInventoryItemVisual()`
   呼叫同一個 factory 之後，套用 `normalizeItemDisplayModel(model,
   bagDisplayTargetLongEdge(itemId))`——把模型最長邊縮放成
   `BAG_ITEM_TARGET_LONG_EDGE` 表格裡每個道具各自的目標值(預設 1.1，
   wood/stone/oysters 等各自覆寫)。
3. **手持(握在手上)**：`syncHeldItemVisual()` 拿到上一步已經正規化過的模型，
   **又**量一次寬度(`size.x`)，重新算出 `baseScale = HELD_ITEM_WORLD_SIZE /
   size.x`，再乘上 `HELD_ITEM_SCALE_MULTIPLIER` 表格裡的道具倍率。
4. **背包縮圖(小圖示)**：`inventory-ui.ts` 的 `renderModelThumbnail()`
   同樣拿第 2 步已經正規化過的模型，**再量一次**最長邊，重新縮放成固定的
   `INVENTORY_THUMBNAIL_LONG_EDGE`(2.8)。

## 這輪查到的具體 bug：縮圖那層用 `setScalar` 蓋掉前一層，不是疊乘

第 4 步 `renderModelThumbnail()` 原本寫的是：

```js
const thumbnailScale = INVENTORY_THUMBNAIL_LONG_EDGE / longestEdge; // longestEdge 是「已經套用過第2步正規化」之後量到的值
model.scale.setScalar(thumbnailScale); // 錯：直接蓋掉 model.scale，不是疊乘
```

`Object3D.scale` 是套用在模型「原始(未縮放)幾何」上的絕對值，`setScalar()`
會整個蓋掉第 2 步 `normalizeItemDisplayModel()` 已經寫入的 `scale`，不是在
它基礎上疊乘。結果是：縮圖最終的世界尺寸變成
`(道具原始最長邊) × (2.8 / 該道具在第2步的目標值)`——這個公式完全脫鉤了
第 2 步刻意調整過的 `BAG_ITEM_TARGET_LONG_EDGE`，兩個各自獨立挑出來的數字
（道具原始建模尺寸、跟後來為了「背包列表看起來順眼」手調的目標值）湊在一起
除出來的結果沒有任何道理，牡蠣/木材/石材這類原始模型偏小、扁平的道具就會
算出離譜結果，縮圖之間大小完全不統一。

**修法**：`setScalar` 改成 `multiplyScalar`，讓兩層正規化正確疊乘。疊乘之後
可以代數證明：不管第 2 步的目標值是多少，最終疊乘出來的世界尺寸永遠精準
等於 `INVENTORY_THUMBNAIL_LONG_EDGE`——也就是說縮圖**必然會統一大小**，這正是
「物品縮圖」這個情境真正想要的效果(格狀圖示本來就該視覺份量一致，不該讓
某個道具的圖示比其他道具明顯大或小)。

## 手持寬度改成精確 1 格單位

`HELD_ITEM_WORLD_SIZE` 原本是 `1.05`，Zeppelin 這輪明確要求「手持則寬度1
格單位」，這個專案的世界座標本來就是 1 單位＝1 格(`layout-maps.ts` 裡大量
「移動 1 格」對應座標 ±1 可以佐證)，所以直接改成 `1`。

## 目前已知但這輪沒有動的技術債：`BAG_ITEM_TARGET_LONG_EDGE` 其實已經沒有作用

推導下來會發現一件不直覺的事：**第 2 步的 `BAG_ITEM_TARGET_LONG_EDGE`
表格，目前對「手持」跟「縮圖」這兩個唯二會用到它的情境，最終呈現尺寸都沒有
任何影響**：

- 縮圖(第 4 步)：疊乘之後最終尺寸恆等於 `INVENTORY_THUMBNAIL_LONG_EDGE`，
  跟第 2 步的目標值無關(代數上會直接消掉)。
- 手持(第 3 步)：`baseScale` 是用「第 2 步縮放後的 `size.x`」反過來除出
  `HELD_ITEM_WORLD_SIZE`，同樣是「不管第 2 步縮放多少，最後都會被反推
  抵銷」的結構，最終寬度恆等於 `HELD_ITEM_WORLD_SIZE`。

也就是說，`BAG_ITEM_TARGET_LONG_EDGE` 這張表(wood: 1.2、stone: 1.25、
oysters: 1.8 等)目前形同虛設，改它不會讓任何畫面變化。這應該是之前某一輪
修正(commit `fb502ac` 附近)加的，後來被這輪抓到的縮圖疊乘 bug 蓋掉了效果，
兩邊分屬不同時間點的修改、沒有互相對照。這輪只先修正明確的 bug(疊乘)跟
明確的數字(手持=1)，沒有動這張表，因為要嘛乾脆整張刪掉(承認它現在沒用)、
要嘛重新設計成「縮圖也尊重每個道具的相對大小差異」(拿掉縮圖固定统一大小
這個現在看來合理的效果)，這是設計取捨要 Zeppelin 確認要哪一種，不是單純
的 bug。

## 尚未處理：「背包的轉向不對」

沒有找到明確對應的 bug。目前只有 `fish` 在 `makeInventoryItemVisual()` 裡
有客製旋轉(`fish.rotation.x = Math.PI / 2`，把原本站立的魚放平)，
wood/stone/oysters 等「地面道具」沒有任何客製旋轉，直接沿用原始建模朝向。
懷疑這些道具原始建模是照著「放在地上、玩家從遊戲固定俯視角看」的角度做的，
搬進縮圖/手持共用的固定 3/4 俯角相機(`camera.position.set(2.2, 1.8, 3.2)`)
時可能不是最佳角度，看起來「轉向不對」或「扁掉」。

這輪沒有動——這台機器這次遇到反覆的 EPERM 檔案鎖定(`npm run build`、
`npm run dev`、甚至 `rm -rf node_modules/.vite` 都被擋，可能是防毒軟體或
OneDrive 之類的即時同步在鎖檔)，沒辦法真的把 dev server 跑起來截圖驗證，
不想在沒看到畫面的情況下亂猜角度數字，猜錯反而可能讓觀感更差。等 Zeppelin
自己畫面確認「轉向不對」具體長怎樣(哪個道具、哪個情境：背包縮圖／手持)，
再對症下藥比較穩。

## 驗證

```bash
npx tsc --noEmit   # 通過，型別無誤
```

`npm run dev` / `npm run build` 這輪在這台機器上都卡在同一種 EPERM
(檔案鎖定)，不是這輪程式碼的問題，建議 Zeppelin 檢查一下防毒軟體/OneDrive
是不是把這個專案資料夾即時掃描鎖住了，排除掉這個資料夾應該就會恢復正常。
