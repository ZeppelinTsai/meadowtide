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

## 縮圖大小這輪的第二輪修正：2.8 比可視範圍還大

疊乘 bug 修好、道具第一次真正精準縮到 `INVENTORY_THUMBNAIL_LONG_EDGE` 之後，
Zeppelin 截圖回報「過大了」——農作物、蘑菇這類偏垂直的道具頂到甚至超出
縮圖畫面上下緣。查相機設定才發現 `INVENTORY_THUMBNAIL_LONG_EDGE` 原本的
`2.8`，比相機本身的可視範圍還大：縮圖相機是
`new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)`，可視範圍只有 2 個
世界單位寬高。`2.8 > 2` 這件事在 bug 修好之前完全沒被發現，因為大多數道具
那時候被 `setScalar` bug 意外縮得比 2.8 小，剛好沒溢出畫面；bug 一修好、
道具真的精準縮到 2.8，這個「目標值比畫面還大」的既有問題才顯形。

改成 `1.6`(可視範圍的 80%，四周留邊)，Zeppelin 實機確認「可以了」，這輪
確定收斂。

## 「背包的轉向不對」：實際是縮圖/快捷列的貼紙角度，不是手持（2026-09-01 補完，修正過一次方向）

Zeppelin 補了截圖跟具體情境，第一輪誤判成手持(拿出來握在手上)的種子袋
(`makeSeedPouch()`)角度不對，把 45° 疊加改進了
`syncHeldItemVisual()`(`inventory-system.ts`)——結果 Zeppelin 回報這樣反而
把原本正常的手持模型轉錯了，真正要調的是「資訊模式」/「資訊包」，也就是
`inventory-ui.ts` 的縮圖快取(`renderModelThumbnail()`)。這個快取是「物品」
分頁格狀清單**跟** `quick-item-ui.ts` 快捷列圖示**共用的唯一畫面來源**
(`inventoryItemThumbnail()`)，兩處用的是同一張 `toDataURL()` 產出的 PNG，
不是各自獨立渲染——縮圖相機是固定角度的正交相機
(`camera.position.set(2.2, 1.8, 3.2)`)，跟手持模型所在的真實 3D 遊戲鏡頭
是完全不同的兩顆相機、兩份獨立模型實例，同一顆模型不轉，在兩邊相機下角度
觀感自然不一樣，不能套同一個修法。

已改回：`syncHeldItemVisual()` 的種子額外旋轉整段移除，手持角度回到原樣。
改為在 `renderModelThumbnail()` 裡，`item.model()` 建出模型後、量測
bounding box 之前，針對 `item.id.endsWith("Seeds")` 疊加
`model.rotation.y += Math.PI / 4`——因為縮圖跟快捷列共用同一份快取，這裡
改一處，「物品」分頁格狀清單跟快捷列圖示會同時修正。

同一輪 Zeppelin 也回報握持道具「有點浮空」，`HELD_ITEM_POSITION.y` 從
`0.62` 降到 `0.56`(`held-item-pose.ts`)——這個沒有被上面那次誤判牽連，
維持降低後的數值。這個是全域手持位置常數，所有道具握持時都會跟著降低，
不是只有種子。

wood/stone/oysters 等地面道具「原始建模朝向搬進握持/縮圖情境可能不是最佳
角度」這個技術債本身還沒動，等 Zeppelin 之後回報具體哪個道具看起來不對
再處理。

## 驗證

```bash
npx tsc --noEmit   # 通過，型別無誤
```

`npm run dev` / `npm run build` 這輪在這台機器上都卡在同一種 EPERM
(檔案鎖定)，不是這輪程式碼的問題，建議 Zeppelin 檢查一下防毒軟體/OneDrive
是不是把這個專案資料夾即時掃描鎖住了，排除掉這個資料夾應該就會恢復正常。
