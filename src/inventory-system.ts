import * as THREE from "three";
import { gameState, inventory, RECIPES } from "./game-state";
import {
  BASIC_ITEMS,
  type InventoryItemId,
  type ItemDefinition,
} from "./item-catalog";
import {
  makeCropMesh,
  makeFishProp,
  makeOysterProp,
  makePearlProp,
  makeSeedPouch,
  makeStonePile,
  makeWoodPile,
  makeOreNode,
} from "./props";
import {
  makeFlowerSpecimen,
  isFlowerSpeciesId,
} from "./wildflowers";
import { ORE_TIERS } from "./mine";
import { showUiToast } from "./ui-toast";
import {
  HELD_ARM_ROTATION,
  HELD_ITEM_POSITION,
  HELD_ITEM_WORLD_SIZE,
} from "./held-item-pose";
import {
  applyTransferToBag,
  applyTransferToStorage,
  clampTransferAmount,
} from "./inventory-transfer";

let visualOwner: THREE.Object3D | null = null;
let heldVisual: THREE.Object3D | null = null;
let renderedItemId: string | null = null;

const BAG_ITEM_TARGET_LONG_EDGE: Record<string, number> = {
  default: 1.1,
  radishSeeds: 1.9,
  potatoSeeds: 1.9,
  tomatoSeeds: 1.9,
  fish: 1.9,
  harvested: 1.9,
  mushroom: 1.3,
  oysters: 1.8,
  wood: 1.2,
  stone: 1.25,
  wildDaisy: 0.85,
  redPoppy: 0.85,
  dandelion: 0.85,
  blueDayflower: 0.85,
  pinkWoodSorrel: 0.85,
};

const HELD_ITEM_SCALE_MULTIPLIER: Record<string, number> = {
  default: 1,
  fish: 1.2,
  harvested: 1.12,
  mushroom: 1.08,
  oysters: 1.08,
  wood: 1.0,
  stone: 1.0,
  wildDaisy: 0.9,
  redPoppy: 0.9,
  dandelion: 0.9,
  blueDayflower: 0.9,
  pinkWoodSorrel: 0.9,
};

function bagDisplayTargetLongEdge(itemId: string) {
  return BAG_ITEM_TARGET_LONG_EDGE[itemId] ?? BAG_ITEM_TARGET_LONG_EDGE.default;
}

function heldItemScaleMultiplier(itemId: string) {
  return (
    HELD_ITEM_SCALE_MULTIPLIER[itemId] ?? HELD_ITEM_SCALE_MULTIPLIER.default
  );
}

function makeHeldFishVisual() {
  const fish = makeFishProp(1.4);
  fish.scale.setScalar(0.45);
  fish.rotation.z = Math.PI / 2;
  return fish;
}

function normalizeItemDisplayModel(
  model: THREE.Object3D,
  targetLongEdge = 0.9,
): THREE.Object3D {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const longestEdge = Math.max(size.x, size.y, size.z, 0.01);
  const scale = targetLongEdge / longestEdge;
  model.scale.multiplyScalar(scale);
  const offset = bounds.getCenter(new THREE.Vector3());
  model.position.sub(offset.multiplyScalar(scale));
  return model;
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
  if (itemId === "mushroom") return inventory.mushrooms;
  if (itemId === "fish") return inventory.fish;
  if (itemId === "oysters") return inventory.oysters;
  if (itemId === "wood") return inventory.wood;
  if (itemId === "stone") return inventory.stone;
  if (isFlowerSpeciesId(itemId)) return inventory.wildflowers[itemId] ?? 0;
  if (itemId === "copper") return inventory.copper;
  if (itemId === "silver") return inventory.silver;
  if (itemId === "gold") return inventory.gold;
  if (itemId === "starCrystal") return inventory.starCrystal;
  if (itemId === "godCrystal") return inventory.godCrystal;
  if (itemId.startsWith("pearl-"))
    return (
      inventory.pearls[
        itemId.slice(6) as import("./pearl-system").PearlRarity
      ] ?? 0
    );
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
  else if (itemId === "mushroom")
    inventory.mushrooms = Math.max(0, inventory.mushrooms + delta);
  else if (itemId === "fish")
    inventory.fish = Math.max(0, inventory.fish + delta);
  else if (itemId === "oysters")
    inventory.oysters = Math.max(0, inventory.oysters + delta);
  else if (itemId === "wood")
    inventory.wood = Math.max(0, inventory.wood + delta);
  else if (itemId === "stone")
    inventory.stone = Math.max(0, inventory.stone + delta);
  else if (isFlowerSpeciesId(itemId))
    inventory.wildflowers[itemId] = Math.max(
      0,
      (inventory.wildflowers[itemId] ?? 0) + delta,
    );
  else if (itemId === "copper")
    inventory.copper = Math.max(0, inventory.copper + delta);
  else if (itemId === "silver")
    inventory.silver = Math.max(0, inventory.silver + delta);
  else if (itemId === "gold")
    inventory.gold = Math.max(0, inventory.gold + delta);
  else if (itemId === "starCrystal")
    inventory.starCrystal = Math.max(0, inventory.starCrystal + delta);
  else if (itemId === "godCrystal")
    inventory.godCrystal = Math.max(0, inventory.godCrystal + delta);
  else if (itemId.startsWith("pearl-")) {
    const rarity = itemId.slice(6) as import("./pearl-system").PearlRarity;
    inventory.pearls[rarity] = Math.max(
      0,
      (inventory.pearls[rarity] ?? 0) + delta,
    );
  } else if (itemId.startsWith("dish-")) {
    const recipeId = itemId.slice(5);
    inventory.dishes[recipeId] = Math.max(
      0,
      (inventory.dishes[recipeId] ?? 0) + delta,
    );
  }
}

export function storedItemAmount(itemId: string) {
  return Math.max(0, Number(inventory.storage[itemId]) || 0);
}

export function moveItemToStorageAmount(
  itemId: string,
  amount: number,
): boolean {
  const item = inventoryItem(itemId);
  if (!item) return false;
  const transferAmount = clampTransferAmount(itemAmount(itemId), amount);
  if (transferAmount <= 0) return false;
  const next = applyTransferToStorage(
    itemAmount(itemId),
    storedItemAmount(itemId),
    transferAmount,
  );
  const bagAmount = next.bagAmount;
  const storageAmount = next.storageAmount;
  if (itemId === "radishSeeds") inventory.seeds = bagAmount;
  else if (itemId === "potatoSeeds") inventory.potatoSeeds = bagAmount;
  else if (itemId === "tomatoSeeds") inventory.tomatoSeeds = bagAmount;
  else if (itemId === "harvested") inventory.harvested = bagAmount;
  else if (itemId === "mushroom") inventory.mushrooms = bagAmount;
  else if (itemId === "fish") inventory.fish = bagAmount;
  else if (itemId === "oysters") inventory.oysters = bagAmount;
  else if (itemId === "wood") inventory.wood = bagAmount;
  else if (itemId === "stone") inventory.stone = bagAmount;
  else if (isFlowerSpeciesId(itemId)) inventory.wildflowers[itemId] = bagAmount;
  else if (itemId === "copper") inventory.copper = bagAmount;
  else if (itemId === "silver") inventory.silver = bagAmount;
  else if (itemId === "gold") inventory.gold = bagAmount;
  else if (itemId === "starCrystal") inventory.starCrystal = bagAmount;
  else if (itemId === "godCrystal") inventory.godCrystal = bagAmount;
  else if (itemId.startsWith("pearl-")) {
    const rarity = itemId.slice(6) as import("./pearl-system").PearlRarity;
    inventory.pearls[rarity] = bagAmount;
  } else if (itemId.startsWith("dish-")) {
    const recipeId = itemId.slice(5);
    inventory.dishes[recipeId] = bagAmount;
  }
  inventory.storage[itemId] = storageAmount > 0 ? storageAmount : undefined;
  if (storageAmount <= 0) delete inventory.storage[itemId];
  if (inventory.heldItemId === itemId && bagAmount <= 0) {
    inventory.heldItemId = null;
    renderedItemId = null;
  }
  showUiToast("倉庫", `${item.label}已放入倉庫 ×${transferAmount}。`);
  return true;
}

export function moveItemToStorage(itemId: string): boolean {
  return moveItemToStorageAmount(itemId, 1);
}

export function moveItemFromStorageAmount(
  itemId: string,
  amount: number,
): boolean {
  const item = inventoryItem(itemId);
  if (!item) return false;
  const transferAmount = clampTransferAmount(storedItemAmount(itemId), amount);
  if (transferAmount <= 0) return false;
  const next = applyTransferToBag(
    itemAmount(itemId),
    storedItemAmount(itemId),
    transferAmount,
  );
  const bagAmount = next.bagAmount;
  const storageAmount = next.storageAmount;
  if (itemId === "radishSeeds") inventory.seeds = bagAmount;
  else if (itemId === "potatoSeeds") inventory.potatoSeeds = bagAmount;
  else if (itemId === "tomatoSeeds") inventory.tomatoSeeds = bagAmount;
  else if (itemId === "harvested") inventory.harvested = bagAmount;
  else if (itemId === "mushroom") inventory.mushrooms = bagAmount;
  else if (itemId === "fish") inventory.fish = bagAmount;
  else if (itemId === "oysters") inventory.oysters = bagAmount;
  else if (itemId === "wood") inventory.wood = bagAmount;
  else if (itemId === "stone") inventory.stone = bagAmount;
  else if (isFlowerSpeciesId(itemId)) inventory.wildflowers[itemId] = bagAmount;
  else if (itemId === "copper") inventory.copper = bagAmount;
  else if (itemId === "silver") inventory.silver = bagAmount;
  else if (itemId === "gold") inventory.gold = bagAmount;
  else if (itemId === "starCrystal") inventory.starCrystal = bagAmount;
  else if (itemId === "godCrystal") inventory.godCrystal = bagAmount;
  else if (itemId.startsWith("pearl-")) {
    const rarity = itemId.slice(6) as import("./pearl-system").PearlRarity;
    inventory.pearls[rarity] = bagAmount;
  } else if (itemId.startsWith("dish-")) {
    const recipeId = itemId.slice(5);
    inventory.dishes[recipeId] = bagAmount;
  }
  if (storageAmount > 0) inventory.storage[itemId] = storageAmount;
  else delete inventory.storage[itemId];
  showUiToast("倉庫", `${item.label}已放入背包 ×${transferAmount}。`);
  return true;
}

export function moveItemFromStorage(itemId: string): boolean {
  return moveItemFromStorageAmount(itemId, 1);
}

export function consumeInventoryItem(itemId: string, amount = 1): boolean {
  const safeAmount = Math.max(1, Math.floor(amount));
  if (!inventoryItem(itemId) || itemAmount(itemId) < safeAmount) return false;
  changeItemAmount(itemId, -safeAmount);
  if (inventory.heldItemId === itemId && itemAmount(itemId) <= 0) {
    inventory.heldItemId = null;
    renderedItemId = null;
  }
  return true;
}

export function takeOutItem(itemId: string): boolean {
  if (gameState.player?.userData.carryingAnimal) {
    showUiToast("背包", "請先放下抱著的動物。");
    return false;
  }
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
  consumeInventoryItem(itemId, 1);
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
    const cropType = itemId.includes("potato")
      ? "potato"
      : itemId.includes("tomato")
        ? "tomato"
        : "radish";
    return normalizeItemDisplayModel(
      makeSeedPouch(0xe9d6a5, cropType),
      bagDisplayTargetLongEdge(itemId),
    );
  }
  if (itemId === "harvested")
    return normalizeItemDisplayModel(
      makeCropMesh(2),
      bagDisplayTargetLongEdge(itemId),
    );
  if (itemId === "mushroom") {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0xead9b7, flatShading: true }),
    );
    stem.position.y = 0.15;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 5),
      new THREE.MeshStandardMaterial({ color: 0xb66f58, flatShading: true }),
    );
    cap.scale.y = 0.5;
    cap.position.y = 0.34;
    group.add(stem, cap);
    return normalizeItemDisplayModel(group, bagDisplayTargetLongEdge(itemId));
  }
  if (itemId === "fish") {
    const fish = makeFishProp(1.4);
    fish.scale.setScalar(0.45);
    fish.rotation.x = Math.PI / 2;
    return normalizeItemDisplayModel(fish, bagDisplayTargetLongEdge(itemId));
  }
  if (itemId === "oysters")
    return normalizeItemDisplayModel(
      makeOysterProp(),
      bagDisplayTargetLongEdge(itemId),
    );
  if (itemId === "wood")
    return normalizeItemDisplayModel(
      makeWoodPile(0, 0),
      bagDisplayTargetLongEdge(itemId),
    );
  if (itemId === "stone")
    return normalizeItemDisplayModel(
      makeStonePile(0, 0),
      bagDisplayTargetLongEdge(itemId),
    );
  if (isFlowerSpeciesId(itemId))
    return normalizeItemDisplayModel(
      makeFlowerSpecimen(itemId),
      bagDisplayTargetLongEdge(itemId),
    );
  const ore = ORE_TIERS.find((tier) => tier.kind === itemId);
  if (ore)
    return normalizeItemDisplayModel(
      makeOreNode(0, 0, ore.color, ore.accentColor, 0.62),
      bagDisplayTargetLongEdge(itemId),
    );
  if (itemId.startsWith("pearl-"))
    return normalizeItemDisplayModel(
      makePearlProp(itemId.slice(6) as import("./pearl-system").PearlRarity),
      bagDisplayTargetLongEdge(itemId),
    );
  return normalizeItemDisplayModel(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xead4a8, flatShading: true }),
    ),
    bagDisplayTargetLongEdge(itemId),
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
  if (player)
    player.userData.holdingItem = Boolean(
      effectiveId || player.userData.carryingAnimal,
    );
  const parts = (player as any)?.parts;
  if (effectiveId && parts?.armL && parts?.armR) {
    parts.armL.rotation.x = HELD_ARM_ROTATION.x;
    parts.armL.rotation.z = HELD_ARM_ROTATION.leftZ;
    parts.armR.rotation.x = HELD_ARM_ROTATION.x;
    parts.armR.rotation.z = HELD_ARM_ROTATION.rightZ;
  }
  const visualPresenceMatchesState =
    Boolean(heldVisual) === Boolean(effectiveId);
  if (
    player === visualOwner &&
    effectiveId === renderedItemId &&
    visualPresenceMatchesState
  )
    return;
  if (heldVisual?.parent) heldVisual.parent.remove(heldVisual);
  heldVisual = null;
  visualOwner = player;
  renderedItemId = effectiveId;
  if (!player || !effectiveId) return;
  heldVisual = makeInventoryItemVisual(effectiveId);
  heldVisual.name = "heldInventoryItem";
  heldVisual.rotation.y = Math.PI;
  const bounds = new THREE.Box3().setFromObject(heldVisual);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const baseScale = HELD_ITEM_WORLD_SIZE / Math.max(size.x, 0.01);
  const heldScale = baseScale * heldItemScaleMultiplier(effectiveId);
  heldVisual.scale.multiplyScalar(heldScale);
  heldVisual.position.set(
    HELD_ITEM_POSITION.x - center.x * heldScale,
    HELD_ITEM_POSITION.y - center.y * heldScale,
    HELD_ITEM_POSITION.z - center.z * heldScale,
  );
  player.add(heldVisual);
}
