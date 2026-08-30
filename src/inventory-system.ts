import * as THREE from "three";
import { gameState, inventory, RECIPES } from "./game-state";
import {
  BASIC_ITEMS,
  type InventoryItemId,
  type ItemDefinition,
} from "./item-catalog";
import { makeCropMesh, makeFishProp, makeSeedPouch } from "./props";
import { showUiToast } from "./ui-toast";

let visualOwner: THREE.Object3D | null = null;
let heldVisual: THREE.Object3D | null = null;
let renderedItemId: string | null = null;
const heldHint = document.createElement("div");
heldHint.id = "heldItemHint";
document.body.appendChild(heldHint);
function updateHeldHint() {
  const item = inventory.heldItemId
    ? inventoryItem(inventory.heldItemId)
    : undefined;
  heldHint.hidden = !item;
  if (item)
    heldHint.textContent = `手持：${item.label} ×${itemAmount(item.id)}　[ , ／ . ] 切換　右鍵收回`;
}

export function allInventoryItems(): ItemDefinition[] {
  const dishes = Object.keys(inventory.dishes).map((recipeId) => ({
    id: `dish-${recipeId}` as InventoryItemId,
    label: RECIPES.find((recipe) => recipe.id === recipeId)?.name ?? recipeId,
    edible: true,
  }));
  return [...BASIC_ITEMS, ...dishes];
}

export function inventoryItem(itemId: string) {
  return allInventoryItems().find((item) => item.id === itemId);
}

export function itemAmount(itemId: string): number {
  if (itemId === "radishSeeds") return inventory.seeds;
  if (itemId === "potatoSeeds") return inventory.potatoSeeds;
  if (itemId === "tomatoSeeds") return inventory.tomatoSeeds;
  if (itemId === "harvested") return inventory.harvested;
  if (itemId === "fish") return inventory.fish;
  if (itemId === "oysters") return inventory.oysters;
  if (itemId.startsWith("dish-")) return inventory.dishes[itemId.slice(5)] ?? 0;
  return 0;
}

function changeItemAmount(itemId: string, delta: number) {
  if (itemId === "radishSeeds")
    inventory.seeds = Math.max(0, inventory.seeds + delta);
  else if (itemId === "potatoSeeds")
    inventory.potatoSeeds = Math.max(0, inventory.potatoSeeds + delta);
  else if (itemId === "tomatoSeeds")
    inventory.tomatoSeeds = Math.max(0, inventory.tomatoSeeds + delta);
  else if (itemId === "harvested")
    inventory.harvested = Math.max(0, inventory.harvested + delta);
  else if (itemId === "fish")
    inventory.fish = Math.max(0, inventory.fish + delta);
  else if (itemId === "oysters")
    inventory.oysters = Math.max(0, inventory.oysters + delta);
  else if (itemId.startsWith("dish-")) {
    const recipeId = itemId.slice(5);
    inventory.dishes[recipeId] = Math.max(
      0,
      (inventory.dishes[recipeId] ?? 0) + delta,
    );
  }
}

export function takeOutItem(itemId: string): boolean {
  const item = inventoryItem(itemId);
  if (!item || itemAmount(itemId) <= 0) return false;
  inventory.heldItemId = item.id;
  updateHeldHint();
  renderedItemId = null;
  showUiToast("背包", `拿出了${item.label}。`);
  return true;
}

export function eatItem(itemId: string): boolean {
  const item = inventoryItem(itemId);
  if (!item?.edible || itemAmount(itemId) <= 0) return false;
  changeItemAmount(itemId, -1);
  if (inventory.heldItemId === itemId && itemAmount(itemId) <= 0)
    inventory.heldItemId = null;
  renderedItemId = null;
  showUiToast("背包", `吃下了${item.label}。`);
  return true;
}

export function cycleHeldItem(direction: -1 | 1): boolean {
  if (!inventory.heldItemId) return false;
  const available = allInventoryItems().filter(
    (item) => itemAmount(item.id) > 0,
  );
  if (!available.length) {
    inventory.heldItemId = null;
    return false;
  }
  const current = available.findIndex(
    (item) => item.id === inventory.heldItemId,
  );
  const next =
    (Math.max(0, current) + direction + available.length) % available.length;
  inventory.heldItemId = available[next].id;
  updateHeldHint();
  renderedItemId = null;
  showUiToast(
    "背包",
    `${available[next].label} ×${itemAmount(available[next].id)}`,
  );
  return true;
}

function makeHeldVisual(itemId: string): THREE.Object3D {
  if (itemId.endsWith("Seeds")) {
    const colors: Record<string, number> = {
      radishSeeds: 0xe9d6a5,
      potatoSeeds: 0xc99b5b,
      tomatoSeeds: 0xd96955,
    };
    return makeSeedPouch();
  }
  if (itemId === "harvested") return makeCropMesh(2);
  if (itemId === "fish") {
    const fish = makeFishProp(1.4);
    fish.scale.setScalar(0.45);
    fish.rotation.y = Math.PI / 2;
    return fish;
  }
  const group = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8),
    new THREE.MeshStandardMaterial({
      color: itemId === "oysters" ? 0xd8d1bd : 0xead4a8,
      flatShading: true,
    }),
  );
  bowl.position.y = 0.04;
  group.add(bowl);
  return group;
}

addEventListener("keydown", (event) => {
  if (event.repeat || !inventory.heldItemId) return;
  if (event.key === "[" || event.key === ",") {
    event.preventDefault();
    cycleHeldItem(-1);
  } else if (event.key === "]" || event.key === ".") {
    event.preventDefault();
    cycleHeldItem(1);
  }
});

addEventListener("contextmenu", (event) => {
  if (!inventory.heldItemId) return;
  event.preventDefault();
  inventory.heldItemId = null;
  renderedItemId = null;
  updateHeldHint();
  showUiToast("背包", "物品已收回背包。");
});

addEventListener(
  "wheel",
  (event) => {
    if (
      !inventory.heldItemId ||
      (event.target instanceof Element &&
        event.target.closest(
          "#inventoryOverlay, #mapOverlay, #pauseMenu, #titleScreen",
        ))
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cycleHeldItem(event.deltaY > 0 ? -1 : 1);
  },
  { passive: false },
);

export function syncHeldItemVisual() {
  const player = gameState.player as THREE.Object3D | null;
  const itemId = inventory.heldItemId;
  if (itemId && itemAmount(itemId) <= 0) inventory.heldItemId = null;
  updateHeldHint();
  const effectiveId = inventory.heldItemId;
  if (player) player.userData.holdingItem = Boolean(effectiveId);
  const parts = (player as any)?.parts;
  if (effectiveId && parts?.armL && parts?.armR) {
    parts.armL.rotation.x = -0.72;
    parts.armL.rotation.z = 0.16;
    parts.armR.rotation.x = -0.72;
    parts.armR.rotation.z = -0.16;
  }
  if (player === visualOwner && effectiveId === renderedItemId) return;
  if (heldVisual?.parent) heldVisual.parent.remove(heldVisual);
  heldVisual = null;
  visualOwner = player;
  renderedItemId = effectiveId;
  if (!player || !effectiveId) return;
  heldVisual = makeHeldVisual(effectiveId);
  heldVisual.name = "heldInventoryItem";
  heldVisual.position.set(0, 0.31, -0.42);
  heldVisual.scale.multiplyScalar(0.72);
  player.add(heldVisual);
}
