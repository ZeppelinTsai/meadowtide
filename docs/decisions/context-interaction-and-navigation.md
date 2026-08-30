# Context interaction and point navigation

## Input contract

- Keyboard world actions are `E` (primary), `R` (secondary), and `F` (tertiary). `Enter` and `Space` are aliases for the primary action; `E` remains the displayed default. Enter/Space retain UI confirmation when a control is focused and never pass through an open menu or title screen.
- Standard Gamepad physical west/north/east buttons drive those same slots. The
  prompt layer renders them as Nintendo `Y/X/A` or Xbox `X/Y/B`.
- UI confirmation remains the physical south button. World mappings must not be
  reused to confirm UI controls.
- The information menu is `Q` or standard Gamepad `button[8]`, displayed as
  Nintendo Minus or Xbox View. The map is `M` or L3 (`button[10]`).
- `src/input-device.ts` tracks the most recently used device and resolves the
  `auto`, `nintendo`, and `xbox` controller-layout setting.
- While a non-choice dialogue sequence is open, the primary `pointerdown`
  (mouse left button, single-finger touch, or pen) advances the line through the
  same `advanceDialogSequence()` path as `E`. Choice buttons and other
  interactive UI controls keep priority and never pass the pointer action
  through to dialogue advancement.

## Context resolution

`src/context-interaction.ts` owns the three action slots, prompt mapping, target
priority, and target hysteresis. `src/context-interaction-ui.ts` adapts world
objects to that pure resolver and renders at most three clickable prompts in the
lower-left corner. Invalid actions are omitted rather than disabled.

Existing interaction effects remain in their original systems. Generic actions
arrive through the same legacy `E` handler by using a one-shot bypass flag; this
prevents a second implementation of dialogue, crop, pickup, or tool behavior.
Animals use src/animal-interactions.ts. Cows and sheep expose pet, brush, and
milk/shear in the primary/secondary/tertiary slots; brush, milker, and shears
must exist in inventory.tools or the corresponding action is omitted. Chickens
expose pet and carry; carrying reparents the chicken to the player and reuses
the held-item hand pose and position.

Milk requires one successful feeding day after each milking. Wool requires three
successful feeding days after each shearing. A day counts only when animals ate
pasture grass or the feeder successfully consumed a unit; an unfed day never
advances production. Sheep switch between the full wool body and a visibly
smaller, darker sheared body from the same production progress source.

Save format v11 stores pet/brush/harvest stamps, last credited feeding day,
production progress, and the carried animal ID. Missing new tool flags in legacy
saves migrate to owned; a newly started game explicitly sets milker, shears, and
brush to false and resets animal interaction state.

## Point-and-click pipeline

The runtime pipeline is:

`ray target -> resolve action -> reachable interaction tile -> follow path ->
face target -> revalidate -> execute existing action`

`src/navigation.ts` performs a connected-component BFS over existing map tiles
and collision checks. It may choose the nearest reachable tile, but never a
geometrically close tile across an unreachable wall or water barrier.
`src/player-navigation.ts` adds dynamic NPC/animal occupancy, terrain-height
step limits, moving-target replans (maximum three), and operation-lock checks.
The normal game loop consumes its direction, so movement speed, collision, and
animation remain identical to manual movement.

Manual WASD, arrows, or left-stick input cancels navigation immediately. A new
click replaces the old destination. Dialogue, menus, cutscenes, fishing, and
other paused states cancel it. Pointer release is treated as a click only below
the drag threshold, so camera dragging does not trigger movement.

First-person mode does not accept world-click navigation. Its left-button `pointerdown`
immediately runs the same primary interaction path as keyboard `E` (including while a fish
is biting, because pointer lock may consume `pointerup`). Switching back to the standard
camera restores point-and-click movement. Clicking a registered water surface uses the same
reachable-destination search to approach a connected shore, faces the clicked water, then
dispatches the existing E fishing flow.

## Verification

Run:

```bash
npm run test:context-interaction
npm run build
```

The unit tests cover pointer priority, hysteresis, unavailable-action hiding,
Nintendo/Xbox physical-button labels, nearest reachable fallback, wall
connectivity, and stopping within interaction radius.
