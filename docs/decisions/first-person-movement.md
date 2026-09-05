# First-person movement

`src/first-person-camera.ts` owns first-person yaw, pitch, pointer-lock mouse
look, right-stick look, and the perspective camera. `src/game-loop.ts` still
owns player movement, collision, height traversal, animation state, and action
locks. First-person mode must not implement a second movement pipeline.

## Controls

- `W/S` or left-stick up/down moves forward/backward relative to camera yaw.
- `A/D` or left-stick left/right strafes relative to camera yaw.
- Dragging with mouse, pen, or one finger and the right stick turn left/right
  and look up/down. The cursor remains available instead of being pointer-locked.
- A short first-person click/tap uses the normal point-and-click navigation and
  interaction pipeline. Holding for 600 ms without dragging takes a photo.
- The mouse wheel, LT/RT, and the holdable on-screen −/+ controls change the
  first-person camera field of view continuously.
- The on-screen camera controls follow the last input device: keyboard/mouse
  shows Tab, wheel, and hold-screen hints; gamepad shows LB/RB/LT/RT (or
  Nintendo L/R/ZL/ZR).
- `Tab`/R3 keeps the existing first-person toggle behavior.

`src/first-person-movement.ts` is the pure coordinate transform from local FPS
input to world X/Z. The game loop normalizes its result and then uses the same
speed, `collidesAt()`, terrain-height checks, pause rules, fishing locks, and
manual-navigation cancellation as the standard camera.

While first-person mode is active, the hidden player model follows camera yaw
instead of turning toward the strafe direction. This keeps interaction facing
and the direction restored on leaving first-person mode consistent with what
the player was looking at.

## Verification

Run:

```bash
npm run test:first-person
npm run build
```

The unit test verifies forward, strafe, rotated camera-relative movement, and
diagonal vector length before the game loop's existing normalization.
