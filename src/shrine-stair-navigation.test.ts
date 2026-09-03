// 2026-09-04 新增：鎖住「神社(波上宮)南端樓梯必須能被點擊導航走上去」
// 這條規則。Zeppelin 回報從 [oldVillage] (100,36) 點擊 (100,29) 附近
// 沒辦法自動走過去——追下來是 player-navigation.ts 的 canStep() 逐整
// 數格比較 oldVillageGroundY() 高度差、門檻 0.7，這段樓梯(layout-maps.ts
// 的 westStairs 最後一項，x=99~101,fromZ:31,toZ:34,baseElevation:0,
// elevation:3)整層落差(3)攤在只有 3 格 z 距離，每一個整數格剛好落差
// 1.0，永遠超過門檻。WASD 連續走路因為採樣間距遠小於 1 格所以走得上
// 去，只有整格取樣的 A* 會被擋下。修法是 canStep() 只要有一端落在
// isOnOldVillageStair() 範圍內就直接放行，不比較高度——這裡不直接測
// player-navigation.ts(它的 import 鏈會拉到 build-map.ts/npc-runtime.ts
// 一路到 scene-sky.ts 建 WebGLRenderer，沒有 DOM 的 tsx --test 環境測
// 不了)，改測 layout-maps.ts 這兩個純函式本身的行為，用跟 canStep()
// 完全一樣的邏輯在這裡重新組一次，驗證「不放行會被 0.7 門檻擋住、放
// 行後每一步都通過」。
import assert from "node:assert/strict";
import test from "node:test";
import { oldVillageGroundY, isOnOldVillageStair } from "./layout-maps";

const HEIGHT_THRESHOLD = 0.7;

function rawCanStep(fromX: number, fromZ: number, x: number, z: number) {
  return (
    Math.abs(oldVillageGroundY(x, z) - oldVillageGroundY(fromX, fromZ)) <=
    HEIGHT_THRESHOLD
  );
}

function fixedCanStep(fromX: number, fromZ: number, x: number, z: number) {
  if (isOnOldVillageStair(x, z) || isOnOldVillageStair(fromX, fromZ))
    return true;
  return rawCanStep(fromX, fromZ, x, z);
}

test("shrine stair (x=100, z=31..34): each integer-tile step exceeds the raw 0.7 height threshold", () => {
  // 這條斷言故意驗證「沒有樓梯放行時會失敗」，證明這確實是需要修的
  // 案例，不是原本就過得去、多此一舉的修正。
  const steps: [number, number][] = [
    [34, 33],
    [33, 32],
    [32, 31],
  ];
  for (const [fromZ, toZ] of steps) {
    assert.equal(
      rawCanStep(100, fromZ, 100, toZ),
      false,
      `z=${fromZ}->z=${toZ} should exceed the raw threshold without the stair exemption`,
    );
  }
});

test("shrine stair (x=100, z=31..34): fixedCanStep allows walking up every step once the stair exemption applies", () => {
  const steps: [number, number][] = [
    [34, 33],
    [33, 32],
    [32, 31],
  ];
  for (const [fromZ, toZ] of steps) {
    assert.equal(
      fixedCanStep(100, fromZ, 100, toZ),
      true,
      `z=${fromZ}->z=${toZ} should be walkable with the stair exemption applied`,
    );
  }
});

test("shrine stair: a full click-navigation-style walk from (100,36) up to (100,29) is step-by-step valid", () => {
  // 對齊 Zeppelin 實際回報的座標:從沙灘 (100,36) 一路點到神社平台
  // (100,29)。逐格檢查整條路徑上每一步都通過 fixedCanStep()。
  for (let z = 36; z > 29; z--) {
    assert.equal(
      fixedCanStep(100, z, 100, z - 1),
      true,
      `z=${z}->z=${z - 1} should be walkable along the (100,36)->(100,29) route`,
    );
  }
});
