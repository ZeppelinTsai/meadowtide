export const HELD_ITEM_WORLD_SIZE = 1.05;
export const HELD_ITEM_POSITION = Object.freeze({ x: 0, y: 0.62, z: -0.36 });
const HELD_ARM_SPREAD = 0.28 - Math.PI / 12;
const HELD_ARM_LIFT = 1.0 + Math.PI / 12;
export const HELD_ARM_ROTATION = Object.freeze({
  x: HELD_ARM_LIFT,
  leftZ: -HELD_ARM_SPREAD,
  rightZ: HELD_ARM_SPREAD,
});
