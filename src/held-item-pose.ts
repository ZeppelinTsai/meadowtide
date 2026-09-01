// 手持道具寬度統一為 1 格單位(世界座標 1 = 1 格),見
// docs/decisions/item-display-scale.md。
export const HELD_ITEM_WORLD_SIZE = 1;
export const HELD_ITEM_POSITION = Object.freeze({ x: 0, y: 0.62, z: -0.36 });
const HELD_ARM_SPREAD = 0.28 - Math.PI / 12;
const HELD_ARM_LIFT = 1.0 + Math.PI / 12;
export const HELD_ARM_ROTATION = Object.freeze({
  x: HELD_ARM_LIFT,
  leftZ: -HELD_ARM_SPREAD,
  rightZ: HELD_ARM_SPREAD,
});
