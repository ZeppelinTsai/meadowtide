import { gameState, inventory } from "./game-state";
import { inventoryItemThumbnail } from "./inventory-ui";
import {
  allInventoryItems,
  inventoryItem,
  itemAmount,
  stowHeldItem,
  takeOutItem,
} from "./inventory-system";

type QuickDirection = "up" | "down" | "left" | "right";

const ITEM_ROWS = [
  ["radishSeeds", "potatoSeeds", "tomatoSeeds", "harvested"],
  ["fish", "oysters", "mushroom"],
  [
    "wood",
    "stone",
    // 2026-09-01：野花五物種原本沒加進這張表，玩家身上只有花、沒有其他
    // 已列表物品時 rows() 全部回傳空陣列，root.hidden 判斷式的 `!item`
    // 直接把整個快捷背包膠囊藏起來——不是花的採集邏輯壞了，是這裡漏列。
    // 比照木材/石頭放進同一列(都是野外採集資源)，不用另開新列。
    "wildDaisy",
    "redPoppy",
    "dandelion",
    "blueDayflower",
    "pinkWoodSorrel",
    "copper",
    "silver",
    "gold",
    "starCrystal",
    "godCrystal",
    "pearl-white",
    "pearl-pink",
    "pearl-purple",
    "pearl-black",
    "pearl-gold",
  ],
] as const;

const SYMBOLS: Record<string, string> = {
  radishSeeds: "蘿",
  potatoSeeds: "薯",
  tomatoSeeds: "番",
  harvested: "穗",
  fish: "魚",
  oysters: "貝",
  mushroom: "菇",
  wood: "木",
  stone: "石",
  wildDaisy: "雛",
  redPoppy: "罌",
  dandelion: "蒲",
  blueDayflower: "露",
  pinkWoodSorrel: "酢",
  copper: "銅",
  silver: "銀",
  gold: "金",
  starCrystal: "星",
  godCrystal: "神",
};

let selectedRow = 0;
let selectedIndex = 0;
let lastSignature = "";

const root = document.createElement("section");
root.id = "quickItemHud";
root.setAttribute("aria-label", "快捷背包物品");
root.innerHTML = `
  <button type="button" class="quick-item-arrow quick-item-up" data-direction="up" aria-label="切換物品列">▲</button>
  <button type="button" class="quick-item-arrow quick-item-left" data-direction="left" aria-label="上一個物品">◀</button>
  <button type="button" class="quick-item-current" aria-label="拿出目前物品">
    <span class="quick-item-symbol" aria-hidden="true"></span>
    <span class="quick-item-count"></span>
  </button>
  <button type="button" class="quick-item-arrow quick-item-right" data-direction="right" aria-label="下一個物品">▶</button>
  <button type="button" class="quick-item-arrow quick-item-down" data-direction="down" aria-label="收回物品">▼</button>
`;
document.body.appendChild(root);

const currentButton = root.querySelector<HTMLButtonElement>(
  ".quick-item-current",
)!;
const symbolElement = root.querySelector<HTMLElement>(".quick-item-symbol")!;
const countElement = root.querySelector<HTMLElement>(".quick-item-count")!;

function rows() {
  const dishes = allInventoryItems()
    .filter((item) => item.id.startsWith("dish-"))
    .map((item) => item.id);
  return ITEM_ROWS.map((row, index) => {
    const ids: string[] = [...row];
    if (index === 1) ids.push(...dishes);
    return ids.filter((id) => itemAmount(id) > 0);
  });
}

function normalizeSelection(availableRows = rows()) {
  if (availableRows[selectedRow]?.length) {
    selectedIndex %= availableRows[selectedRow].length;
    return availableRows;
  }
  const firstNonEmpty = availableRows.findIndex((row) => row.length > 0);
  selectedRow = firstNonEmpty < 0 ? 0 : firstNonEmpty;
  selectedIndex = 0;
  return availableRows;
}

function selectedItemId() {
  const availableRows = normalizeSelection();
  return availableRows[selectedRow]?.[selectedIndex] ?? null;
}

function syncSelectionToHeldItem() {
  const held = inventory.heldItemId;
  if (!held) return;
  const availableRows = rows();
  const rowIndex = availableRows.findIndex((row) => row.includes(held));
  if (rowIndex < 0) return;
  selectedRow = rowIndex;
  selectedIndex = availableRows[rowIndex].indexOf(held);
}

function moveWithinRow(direction: -1 | 1) {
  const availableRows = normalizeSelection();
  const row = availableRows[selectedRow];
  if (!row?.length) return;
  selectedIndex = (selectedIndex + direction + row.length) % row.length;
  const itemId = row[selectedIndex];
  if (itemId) takeOutItem(itemId);
}

function moveToNextRow() {
  const availableRows = normalizeSelection();
  for (let offset = 1; offset <= availableRows.length; offset += 1) {
    const nextRow = (selectedRow + offset) % availableRows.length;
    if (!availableRows[nextRow].length) continue;
    selectedRow = nextRow;
    selectedIndex = 0;
    const itemId = availableRows[nextRow][0];
    if (itemId) takeOutItem(itemId);
    return;
  }
}

function takeOrStowCurrent() {
  const itemId = selectedItemId();
  if (!itemId) return;
  if (inventory.heldItemId === itemId) stowHeldItem();
  else takeOutItem(itemId);
}

function handleDirection(direction: QuickDirection) {
  if (
    !gameState.player ||
    gameState.cutsceneActive ||
    gameState.fishingState !== "idle"
  )
    return;

  if (!inventory.heldItemId) {
    const availableRows = normalizeSelection();
    const row = availableRows[selectedRow];
    if (!row?.length) return;

    if (direction === "left") {
      selectedIndex = (selectedIndex - 1 + row.length) % row.length;
      const target = row[selectedIndex];
      if (target) takeOutItem(target);
      return;
    }
    if (direction === "right") {
      selectedIndex = (selectedIndex + 1) % row.length;
      const target = row[selectedIndex];
      if (target) takeOutItem(target);
      return;
    }
    if (direction === "up") {
      moveToNextRow();
      return;
    }
    if (direction === "down") {
      return;
    }
  }

  syncSelectionToHeldItem();
  if (direction === "left") moveWithinRow(-1);
  else if (direction === "right") moveWithinRow(1);
  else if (direction === "up") moveToNextRow();
  else stowHeldItem();
}

root
  .querySelectorAll<HTMLButtonElement>("[data-direction]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      handleDirection(button.dataset.direction as QuickDirection);
    });
  });
currentButton.addEventListener("click", takeOrStowCurrent);

addEventListener("quick-item-direction", (event) => {
  handleDirection((event as CustomEvent<QuickDirection>).detail);
});

function render() {
  if (inventory.heldItemId) syncSelectionToHeldItem();
  const itemId = selectedItemId();
  const item = itemId ? inventoryItem(itemId) : null;
  const titlePresentation =
    document.body.classList.contains("title-presentation");
  const hudSuppressed =
    document.body.classList.contains("cutscene-presentation") ||
    Boolean(document.querySelector('[data-game-menu="open"], .game-menu.open'));
  const signature = [
    Boolean(gameState.player),
    gameState.cutsceneActive,
    titlePresentation,
    hudSuppressed,
    itemId,
    itemId ? itemAmount(itemId) : 0,
    inventory.heldItemId,
    selectedRow,
  ].join("|");
  if (signature !== lastSignature) {
    lastSignature = signature;
    root.hidden =
      titlePresentation || hudSuppressed || !gameState.player || !item;
    root.classList.toggle("holding", Boolean(inventory.heldItemId));
    symbolElement.replaceChildren();
    const thumbnail = itemId ? inventoryItemThumbnail(itemId) : null;
    if (thumbnail) {
      const image = document.createElement("img");
      image.src = thumbnail;
      image.alt = "";
      symbolElement.appendChild(image);
    } else {
      symbolElement.textContent = itemId?.startsWith("dish-")
        ? "食"
        : itemId?.startsWith("pearl-")
          ? "珠"
          : SYMBOLS[itemId || ""] || "物";
    }
    countElement.textContent = itemId ? String(itemAmount(itemId)) : "";
    currentButton.setAttribute(
      "aria-label",
      inventory.heldItemId === itemId
        ? "收回" + (item?.label ?? "物品")
        : "拿出" + (item?.label ?? "物品"),
    );
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
