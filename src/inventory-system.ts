import * as THREE from "three";
import { gameState, inventory, RECIPES } from "./game-state";
import {
  BASIC_ITEMS,
  type InventoryItemId,
  type ItemDefinition,
} from "./item-catalog";
import { makeCropMesh, makeFishProp, makeOysterProp, makeSeedPouch } from "./props";
import { showUiToast } from "./ui-toast";
import {
  HELD_ARM_ROTATION,
  HELD_ITEM_POSITION,
  HELD_ITEM_WORLD_SIZE,
} from "./held-item-pose";

let visualOwner: THREE.Object3D | null = null;
let heldVisual: THREE.Object3D | null = null;
let renderedItemId: string | null = null;
function makeHeldFishVisual() {
  const fish = makeFishProp(1.4);
  fish.scale.setScalar(0.45);
  fish.rotation.z = Math.PI / 2;
  return fish;
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

  renderedItemId = null;
  showUiToast(
    "背包",
    `${available[next].label} ×${itemAmount(available[next].id)}`,
  );
  return true;
}

export function stowHeldItem(): boolean {
  if (!inventory.heldItemId) return false;
  inventory.heldItemId = null;
  renderedItemId = null;
  showUiToast("背包", "物品已收回背包。");
  return true;
}

export function makeInventoryItemVisual(itemId: string): THREE.Object3D {
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
    fish.rotation.x = Math.PI / 2;
    return fish;
  }
  if (itemId === "oysters") return makeOysterProp();
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xead4a8, flatShading: true }),
  );
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
  stowHeldItem();
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

  const effectiveId = inventory.heldItemId;
  if (player) player.userData.holdingItem = Boolean(effectiveId || player.userData.carryingAnimal);
  const parts = (player as any)?.parts;
  if (effectiveId && parts?.armL && parts?.armR) {
    parts.armL.rotation.x = HELD_ARM_ROTATION.x;
    parts.armL.rotation.z = HELD_ARM_ROTATION.leftZ;
    parts.armR.rotation.x = HELD_ARM_ROTATION.x;
    parts.armR.rotation.z = HELD_ARM_ROTATION.rightZ;
  }
  if (player === visualOwner && effectiveId === renderedItemId) return;
  if (heldVisual?.parent) heldVisual.parent.remove(heldVisual);
  heldVisual = null;
  visualOwner = player;
  renderedItemId = effectiveId;
  if (!player || !effectiveId) return;
  heldVisual = makeInventoryItemVisual(effectiveId);
  heldVisual.name = "heldInventoryItem";
  const bounds = new THREE.Box3().setFromObject(heldVisual);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = HELD_ITEM_WORLD_SIZE / Math.max(size.x, 0.01);
  heldVisual.scale.multiplyScalar(scale);
  heldVisual.position.set(
    HELD_ITEM_POSITION.x - center.x * scale,
    HELD_ITEM_POSITION.y - center.y * scale,
    HELD_ITEM_POSITION.z - center.z * scale,
  );
  player.add(heldVisual);
}
