import { gameState, hasTool, inventory } from "./game-state";
import { animalGroup, animals } from "./npc-runtime";
import { showUiToast } from "./ui-toast";
import type { ContextAction } from "./context-interaction";
import {
  advanceProductionProgress,
  isProductionReady,
  productionFeedDays,
} from "./animal-production";
import { HELD_ITEM_POSITION } from "./held-item-pose";

export type AnimalInteractionRecord = {
  lastPettedDay: number;
  lastBrushedDay: number;
  lastHarvestDay: number;
  lastProductionFeedDay: number;
  productionProgress: number;
};

const records: Record<string, AnimalInteractionRecord> = {};
let carriedAnimalId: string | null = null;

const animalName = (type: string) =>
  type === "cow" ? "牛" : type === "sheep" ? "羊" : "雞";
const productName = (type: string) => (type === "cow" ? "牛奶" : "羊毛");
const isProductiveType = (type: string) => type === "cow" || type === "sheep";

function animalFor(id: string) {
  return animals.find((animal) => animal.id === id);
}

function recordFor(id: string): AnimalInteractionRecord {
  const animal = animalFor(id);
  const readyProgress = animal && isProductiveType(animal.type)
    ? productionFeedDays(animal.type)
    : 0;
  return (records[id] ??= {
    lastPettedDay: -1,
    lastBrushedDay: -1,
    lastHarvestDay: -1,
    lastProductionFeedDay: -1,
    productionProgress: readyProgress,
  });
}

function requiredTool(type: string) {
  return type === "cow" ? "milker" : "shears";
}

function syncSheepWoolVisual(id: string) {
  const animal = animalFor(id);
  if (!animal || animal.type !== "sheep") return;
  const body = animal.mesh.parts?.woolBody as THREE.Mesh | undefined;
  if (!body) return;
  const ready = isProductionReady("sheep", recordFor(id).productionProgress);
  body.scale.set(ready ? 1.3 : 0.82, ready ? 1 : 0.62, ready ? 1.1 : 0.76);
  const material = body.material as THREE.MeshStandardMaterial;
  const fullColor = body.userData.fullWoolColor as THREE.Color | undefined;
  if (ready && fullColor) material.color.copy(fullColor);
  else if (!ready) material.color.setHex(0x9b9183);
}

export function syncAnimalProductVisuals() {
  animals.forEach((animal) => {
    if (animal.type === "sheep") syncSheepWoolVisual(animal.id);
  });
}

export const isAnimalCarried = (id: string) => carriedAnimalId === id;
export const getCarriedAnimalId = () => carriedAnimalId;
export const canCarryAnimal = (type: string) => type === "chicken";

export function canHarvestAnimal(id: string) {
  const animal = animalFor(id);
  if (!animal || !isProductiveType(animal.type)) return false;
  return (
    hasTool(requiredTool(animal.type)) &&
    isProductionReady(animal.type, recordFor(id).productionProgress)
  );
}

export function petAnimal(id: string) {
  const animal = animalFor(id);
  if (!animal) return;
  const record = recordFor(id);
  if (record.lastPettedDay === gameState.currentDay) {
    showUiToast("撫摸", "今天已經撫摸過" + animalName(animal.type) + "了。");
    return;
  }
  record.lastPettedDay = gameState.currentDay;
  showUiToast("撫摸", animalName(animal.type) + "看起來很開心。");
}

export function brushAnimal(id: string) {
  const animal = animalFor(id);
  if (!animal || animal.type === "chicken" || !hasTool("brush")) return;
  const record = recordFor(id);
  if (record.lastBrushedDay === gameState.currentDay) {
    showUiToast("刷毛", "今天已經替" + animalName(animal.type) + "刷過毛了。");
    return;
  }
  record.lastBrushedDay = gameState.currentDay;
  showUiToast("刷毛", animalName(animal.type) + "的毛變得整潔蓬鬆。");
}

export function harvestAnimal(id: string) {
  const animal = animalFor(id);
  if (!animal || !canHarvestAnimal(id)) return;
  const product = animal.type === "cow" ? "milk" : "wool";
  inventory.animalProducts[product] += 1;
  const record = recordFor(id);
  record.lastHarvestDay = gameState.currentDay;
  record.productionProgress = 0;
  showUiToast(
    animal.type === "cow" ? "擠奶" : "剪毛",
    productName(animal.type) + " +1",
  );
  syncSheepWoolVisual(id);
}

export function recordAnimalFeedingDay(day: number, fed: boolean) {
  animals.forEach((animal) => {
    if (!isProductiveType(animal.type)) return;
    const record = recordFor(animal.id);
    if (record.lastProductionFeedDay === day) return;
    record.lastProductionFeedDay = day;
    record.productionProgress = advanceProductionProgress(
      animal.type,
      record.productionProgress,
      fed,
    );
  });
  syncAnimalProductVisuals();
}

export function carryAnimal(id: string) {
  const animal = animalFor(id);
  if (
    !animal ||
    !canCarryAnimal(animal.type) ||
    carriedAnimalId ||
    !gameState.player
  )
    return;
  inventory.heldItemId = null;
  carriedAnimalId = id;
  animal.wanderState = "carried";
  gameState.player.userData.carryingAnimal = true;
  updateCarriedAnimalPose();
  showUiToast("抱起", "抱起了" + animalName(animal.type) + "。");
}

export function dropCarriedAnimal() {
  if (!carriedAnimalId || !gameState.player) return;
  const animal = animalFor(carriedAnimalId);
  carriedAnimalId = null;
  gameState.player.userData.carryingAnimal = false;
  if (!animal) return;
  animalGroup.add(animal.mesh);
  const fx = -Math.sin(gameState.player.rotation.y);
  const fz = -Math.cos(gameState.player.rotation.y);
  animal.mesh.position.set(
    gameState.player.position.x + fx * 0.9,
    0,
    gameState.player.position.z + fz * 0.9,
  );
  animal.mesh.rotation.y = gameState.player.rotation.y - Math.PI / 2;
  animal.wanderState = "resting";
  animal.restUntil = gameState.elapsed + 1;
  showUiToast("放下", "放下了" + animalName(animal.type) + "。");
}

export function updateCarriedAnimalPose() {
  if (!carriedAnimalId || !gameState.player) return;
  const animal = animalFor(carriedAnimalId);
  if (!animal) {
    carriedAnimalId = null;
    gameState.player.userData.carryingAnimal = false;
    return;
  }
  if (animal.mesh.parent !== gameState.player) gameState.player.add(animal.mesh);
  animal.mesh.position.set(
    HELD_ITEM_POSITION.x,
    HELD_ITEM_POSITION.y,
    HELD_ITEM_POSITION.z,
  );
  // 動物頭朝本地 +X；轉 +90° 後頭朝玩家本地 -Z（畫面前方），
  // 因此雞背對主角，不會再抱成面對面的方向。
  animal.mesh.rotation.set(0, Math.PI / 2, 0);
  gameState.player.userData.carryingAnimal = true;
}

export function actionsForAnimal(id: string): ContextAction[] {
  const animal = animalFor(id);
  if (!animal) return [];
  if (carriedAnimalId === id) {
    return [{
      id: "drop",
      label: "放下",
      slot: "secondary",
      execute: dropCarriedAnimal,
    }];
  }
  if (carriedAnimalId) return [];

  const actions: ContextAction[] = [
    { id: "pet", label: "撫摸", slot: "primary", execute: () => petAnimal(id) },
  ];
  if (animal.type === "chicken") {
    actions.push({
      id: "carry",
      label: "抱起",
      slot: "secondary",
      execute: () => carryAnimal(id),
    });
    return actions;
  }
  if (hasTool("brush")) {
    actions.push({
      id: "brush",
      label: "刷毛",
      slot: "secondary",
      execute: () => brushAnimal(id),
    });
  }
  if (canHarvestAnimal(id)) {
    actions.push({
      id: animal.type === "cow" ? "milk" : "shear",
      label: animal.type === "cow" ? "擠奶" : "剪毛",
      slot: "tertiary",
      execute: () => harvestAnimal(id),
    });
  }
  return actions;
}

export function exportAnimalInteractionState() {
  return {
    records: JSON.parse(JSON.stringify(records)),
    carriedAnimalId,
  };
}

export function resetAnimalInteractionState() {
  restoreAnimalInteractionState(undefined);
}
export function restoreAnimalInteractionState(data: unknown) {
  Object.keys(records).forEach((id) => delete records[id]);
  const saved = data && typeof data === "object" ? (data as any) : {};
  Object.entries(saved.records || {}).forEach(([id, value]) => {
    const item = value as any;
    const animal = animalFor(id);
    const required = animal && isProductiveType(animal.type)
      ? productionFeedDays(animal.type)
      : 0;
    const lastHarvestDay = Number.isFinite(item?.lastHarvestDay)
      ? item.lastHarvestDay
      : -1;
    const migratedProgress = lastHarvestDay < 0
      ? required
      : Math.min(required, Math.max(0, gameState.currentDay - lastHarvestDay));
    records[id] = {
      lastPettedDay: Number.isFinite(item?.lastPettedDay) ? item.lastPettedDay : -1,
      lastBrushedDay: Number.isFinite(item?.lastBrushedDay) ? item.lastBrushedDay : -1,
      lastHarvestDay,
      lastProductionFeedDay: Number.isFinite(item?.lastProductionFeedDay)
        ? item.lastProductionFeedDay
        : -1,
      productionProgress: Number.isFinite(item?.productionProgress)
        ? Math.min(required, Math.max(0, item.productionProgress))
        : migratedProgress,
    };
  });

  carriedAnimalId =
    typeof saved.carriedAnimalId === "string" &&
    animals.some((animal) => animal.id === saved.carriedAnimalId)
      ? saved.carriedAnimalId
      : null;
  if (carriedAnimalId) inventory.heldItemId = null;
  if (gameState.player) {
    gameState.player.userData.carryingAnimal = Boolean(carriedAnimalId);
  }
  syncAnimalProductVisuals();
}
