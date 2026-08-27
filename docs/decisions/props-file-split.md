# props.ts 拆分成四個檔案

## 背景

2026-08-26，Zeppelin 問「你覺得專案的結構跟資料夾還需要調整嗎」，盤點後發現
`src/props.ts` 是全專案最大的檔案（約 4795 行，80 個 top-level function），
內容是各種場景道具/建築/自然物件的 factory function，彼此職責清楚但堆在同一
個檔案裡，找特定函式時要滾很久。Zeppelin 同意先拆這個檔案示範拆法。

## 拆分方式

`props.ts` 裡的 80 個函式(79 個 export + 1 個內部用的
`seasonalPastureGrassColor`)照內容性質分成四類，各自獨立成檔：

- **`props-nature.ts`**(31 個函式，約 1300 行)：地形/植被/水體類，包含樹木、
  草地、花、果樹、石頭、沙地、山體、洞窟入口、瀑布佔位、階梯地形等。不依賴
  其他 props-*.ts 檔案。
- **`props-buildings.ts`**(16 個函式，約 2000 行)：建築/場景結構類，包含
  房屋、穀倉、碼頭、貨船、鳥居、神社殿、市鎮佔位、玄武岩海岬、天界階梯、
  礦坑階梯等。依賴 `props-nature.ts` 的 `makeSand`、`makeFoam`。
- **`props-decor.ts`**(22 個函式，約 1000 行)：裝飾/小家具類，包含旗桿、
  鐘塔、告示牌、野餐組、花園、圍籬、路燈、長椅、營火等。依賴
  `props-nature.ts` 的 `makeStone`、`makeFlower`、`makeTree`，以及
  `props-resources.ts` 的 `makeFishProp`。
- **`props-resources.ts`**(11 個函式，約 720 行)：資源/生產相關類，包含蚵架、
  飼料槽、作物網格、風車、動物、魚類道具/路線、礦石節點等。不依賴其他
  props-*.ts 檔案。

分類時特別把 `makeCaveRockEntrance`、`makeOldVillageStalactiteCaveEntrance`、
`makeMountainCaveEntrance`、`makeSteepStoneStairs`、`makeMountainGateway` 這幾個
「看起來像建築、其實是地形」的函式歸進 `props-nature.ts` 而不是
`props-buildings.ts`，避免 `nature` 跟 `buildings` 兩檔互相 import 形成循環
依賴。最後四個檔案的依賴關係是單向的：

```
props-nature.ts     ← 無跨檔依賴（葉節點）
props-resources.ts  ← 無跨檔依賴（葉節點）
props-buildings.ts  → props-nature.ts
props-decor.ts      → props-nature.ts, props-resources.ts
```

`props.ts` 本身改成純轉出(re-export)的 barrel 檔：

```ts
export * from "./props-nature";
export * from "./props-buildings";
export * from "./props-decor";
export * from "./props-resources";
```

專案裡原本 7 個 `import ... from "./props"` 的檔案(`build-map.ts`、
`farm-visuals.ts`、`game-clock.ts`、`game-loop.ts`、`input-save.ts`、
`inventory-ui.ts`、`npc-runtime.ts`)完全不用改，因為 barrel 底下的名字跟原本
一樣。

## 拆分時踩到的小坑

原始 `props.ts` 除了函式宣告，中間還散落 4 個 top-level 的 `export const`
色票/樣式常數(`AVENUE_SEASON_COLORS`、`ORCHARD_FRUIT_STYLES`、
`FLOWER_COLORS`、`SAND_TONES`)。用「抓 function 宣告」的方式切檔案時，這些
常數會被黏在「檔案順序上下一個函式」的區塊裡一起搬走，不一定會跟到真正用到
它們的函式。`AVENUE_SEASON_COLORS`、`ORCHARD_FRUIT_STYLES` 運氣好剛好跟到對的
檔案(`props-nature.ts`)，但 `FLOWER_COLORS`、`SAND_TONES` 被黏去了
`props-buildings.ts`，而實際使用它們的函式(`makeSand`、澆花類函式)分別在
`props-nature.ts`、`props-decor.ts`，導致 `tsc --noEmit` 直接報
`Cannot find name`。修法是把這兩個常數各自搬到真正用到它們的檔案裡（不影響
`build-map.ts` 之類外部使用者，因為都還是從 `./props` barrel 轉出）。

**教訓**：以後再拆同類型的大檔案，除了抓 function 宣告，也要先抓一輪
top-level 的 `export const`/`let`/`var`，逐一確認它們最終落在哪個新檔案、
是否跟它們的使用點同檔。

## 驗證

- `tsc --noEmit` 乾淨通過。
- 用 `git show HEAD:src/props.ts` 跟拆分後四個檔案比對函式名稱集合：
  80 個函式無重複、無遺漏。
