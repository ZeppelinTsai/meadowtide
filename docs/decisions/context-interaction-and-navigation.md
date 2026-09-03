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

## Carried chicken input priority

While carrying a chicken, its interaction position is the player world position. Keyboard R, the controller secondary-action button, and mouse right-click all drop it; the lower-left capsules show the active inputs. Carried animals and held inventory items are mutually exclusive: taking an item out is blocked until the animal is dropped, and legacy saves containing both states keep the animal while clearing heldItemId.

## Animal pasture schedule

In safe weather, animals are outside from 08:00 to 17:00. Pasture grazing is settled at 10:00. At 17:00 animals start returning to the barn; if grazing did not feed them that day, feeder consumption is settled at the same time. Unsafe weather keeps them indoors all day, and the existing 20:00 force-home fallback remains active.

## Nearby fishing fallback

When the player has a fishing rod and is within the shared fishing-water radius, the context HUD offers the existing primary fishing action if no more specific NPC, crop, animal, or resource target wins selection. It calls the legacy fishing entry point rather than duplicating fishing rules.

## Animal stuck recovery

Animals track continuous walking time without movement. After two seconds, daytime animals move to a validated safe pasture point and choose a new target; animals stuck while returning home complete the barn transition. Random pasture fallback scans for a point that passes both pasture and collision checks instead of returning a possibly blocked fixed corner.

## NPC gifts and edible held items

When the player holds an item near an available NPC, `give-gift` is the highest-priority context target and conversation moves to the secondary slot. Each NPC accepts one normal gift per game day; festival gifts use `setFestivalGiftMultiplier()` and do not consume that daily allowance. Gift preferences use five data tiers (`hated`, `disliked`, `normal`, `liked`, `loved`) mapped to the existing affection rewards and placeholder symbols ×／▽／○／△／♥. Unconfigured NPC-item pairs safely default to `normal`.

If no gift target wins and the held item is edible, the context HUD exposes `eat-held-item`. Both actions consume the same held inventory source; gifting or eating the final copy clears the held state and visual.

## 按住主要互動連續操作

- 按住滑鼠左鍵、鍵盤 E 或映射到主要互動的手把按鍵時，每進入一個新格子重新檢查一次主要互動。
- 目前只允許播種、砍材與採石連續執行；送禮、對話、食用、收成與釣魚仍維持單次觸發。
- 連續操作只執行已在互動半徑內的目標，不會因按住按鍵而自動尋路，也不會站在原地清空周圍目標。

## 牡蠣架蓋過釣魚 fallback

牡蠣架緊貼海邊，「Nearby fishing fallback」原本設計成只在沒有更明確目標時才頂上，但牡蠣架一直沒有被登記成情境互動的候選目標，所以站在牡蠣架旁邊時，釣魚 fallback 會誤判成「沒有更明確目標」而搶著顯示「E 釣魚」——玩家看到的提示跟按 E 實際發生的事（採收牡蠣，走的是舊版 E 鍵判斷鏈，判定順序原本就排在 nearWater() 前面）對不上。修法是替牡蠣架補上 `targetForOyster()`，跟送禮候選一樣直接優先回傳，蓋過釣魚 fallback；真正的採收邏輯不重複實作，一樣轉發回舊版 E 鍵判斷鏈。同時把站位判定往陸地方向多加一格，減少站偏踩不中的情況。

