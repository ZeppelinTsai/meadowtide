import * as THREE from "three";
import {
  gameState,
  hasTool,
  inventory,
  RECIPES,
  TOOL_DEFINITIONS,
} from "./game-state";
import { setTimePauseSource } from "./time-pause";
import { getDisplayedStars, getRelationship } from "./affection";
import { getLocale, translateText } from "./i18n";
import {
  eatItem,
  itemAmount,
  inventoryItem,
  makeInventoryItemVisual,
  moveItemFromStorage,
  moveItemFromStorageAmount,
  moveItemToStorage,
  moveItemToStorageAmount,
  storedItemAmount,
  takeOutItem,
} from "./inventory-system";
import { getNpcDisplayName } from "./npc-name-reveal";
import { makeToolModel } from "./tool-models";
import { PEARL_DEFINITIONS } from "./pearl-system";

type InventoryTab = "bag" | "storage" | "tools" | "relationships";
type InventoryEntry = {
  id: string;
  tab: InventoryTab;
  label: string;
  amount: number;
  tone: string;
  symbol: string;
  model?: () => THREE.Object3D;
  description?: string;
};

const INVENTORY_DESCRIPTIONS: Record<string, string> = {
  radishSeeds: "可種出蘿蔔的種子。",
  potatoSeeds: "可種出馬鈴薯的種子。",
  tomatoSeeds: "可種出番茄的種子。",
  harvested: "從農地收成的作物。",
  fish: "從湖泊或海邊釣起的魚。",
  oysters: "從牡蠣架採收的新鮮牡蠣。",
  wood: "建造與加工常用的木材。",
  stone: "建造與加工常用的石材。",
  copper: "洞窟中取得的銅礦。",
  silver: "洞窟中取得的銀礦。",
  gold: "洞窟中取得的金礦。",
  starCrystal: "帶有星光的稀有晶礦。",
  godCrystal: "蘊含特殊力量的珍貴晶礦。",
};

function entryDescription(item: InventoryEntry) {
  if (item.description) return item.description;
  if (item.id.startsWith("dish-")) return "已完成的料理，可作為食物或贈禮。";
  return INVENTORY_DESCRIPTIONS[item.id] || "尚無詳細說明。";
}
const TABS: { id: InventoryTab; label: string }[] = [
  { id: "bag", label: "物品" },
  { id: "storage", label: "倉庫" },
  { id: "tools", label: "工具" },
  { id: "relationships", label: "關係" },
];

const overlay = document.getElementById("inventoryOverlay") as HTMLDivElement;
const grid = document.getElementById("inventoryGrid") as HTMLDivElement;
const closeButton = document.getElementById(
  "inventoryClose",
) as HTMLButtonElement;
const tabList = document.getElementById("inventoryTabs") as HTMLDivElement;
const tabButtons = Array.from(
  tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
);
const panel = document.getElementById("inventoryPanel") as HTMLElement;
const descriptionFooter = document.getElementById(
  "inventoryDescription",
) as HTMLParagraphElement;
const contentMenu = document.createElement("div");
contentMenu.id = "inventoryContentMenu";
contentMenu.className = "inventory-content-menu";
contentMenu.hidden = true;
contentMenu.setAttribute("role", "menu");
panel.appendChild(contentMenu);

let open = false;
let activeTabIndex = 0;
let contextItemId: string | null = null;
let contextReturnCard: HTMLButtonElement | null = null;
const pageByTab: Record<"bag" | "storage", number> = { bag: 0, storage: 0 };
function getItemsPerPage() {
  const minimumCardWidth = innerWidth <= 620 ? 88 : 128;
  const gridWidth = grid.clientWidth || Math.min(900, innerWidth * 0.9) - 48;
  const columns = Math.max(
    1,
    Math.floor((gridWidth + 12) / (minimumCardWidth + 12)),
  );
  const availableGridHeight = innerHeight * 0.84 - 250;
  const rows = Math.max(
    1,
    Math.min(5, Math.floor((availableGridHeight + 12) / 138)),
  );
  return columns * rows;
}
const modelIconCache = new Map<string, string>();
const INVENTORY_THUMBNAIL_LONG_EDGE = 1.05;
let thumbnailRenderer: THREE.WebGLRenderer | null = null;

function getThumbnailRenderer() {
  if (thumbnailRenderer) return thumbnailRenderer;
  thumbnailRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  thumbnailRenderer.setPixelRatio(1);
  thumbnailRenderer.setSize(96, 96, false);
  thumbnailRenderer.setClearColor(0x000000, 0);
  return thumbnailRenderer;
}

function disposeThumbnailModel(model: THREE.Object3D) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    materials.forEach((material) => material.dispose());
  });
}

function showEntryDescription(label?: string, description?: string) {
  descriptionFooter.textContent = label
    ? translateText(label) +
      "｜" +
      translateText(description || "尚無詳細說明。")
    : translateText("選擇項目以查看說明。");
}

function selectInfoCard(
  card: HTMLElement,
  label?: string,
  description?: string,
) {
  grid.querySelectorAll<HTMLElement>(".selected").forEach((item) => {
    item.classList.remove("selected");
    item.removeAttribute("aria-current");
  });
  card.classList.add("selected");
  card.setAttribute("aria-current", "true");
  if (card.dataset.itemId) contextItemId = card.dataset.itemId;
  showEntryDescription(label, description);
}
function inventoryEntries(): InventoryEntry[] {
  const entries: InventoryEntry[] = [
    {
      id: "radishSeeds",
      tab: "bag",
      label: "蘿蔔種子",
      amount: inventory.seeds,
      tone: "green",
      symbol: "蘿",
      model: () => makeInventoryItemVisual("radishSeeds"),
    },
    {
      id: "potatoSeeds",
      tab: "bag",
      label: "馬鈴薯種子",
      amount: inventory.potatoSeeds,
      tone: "gold",
      symbol: "薯",
      model: () => makeInventoryItemVisual("potatoSeeds"),
    },
    {
      id: "tomatoSeeds",
      tab: "bag",
      label: "番茄種子",
      amount: inventory.tomatoSeeds,
      tone: "red",
      symbol: "番",
      model: () => makeInventoryItemVisual("tomatoSeeds"),
    },
    {
      id: "harvested",
      tab: "bag",
      label: "農作物",
      amount: inventory.harvested,
      tone: "gold",
      symbol: "穗",
      model: () => makeInventoryItemVisual("harvested"),
    },
    {
      id: "mushroom",
      tab: "bag",
      label: "蘑菇",
      amount: inventory.mushrooms,
      tone: "red",
      symbol: "菇",
      model: () => makeInventoryItemVisual("mushroom"),
    },
    {
      id: "fish",
      tab: "bag",
      label: "魚",
      amount: inventory.fish,
      tone: "blue",
      symbol: "魚",
      model: () => makeInventoryItemVisual("fish"),
    },
    {
      id: "oysters",
      tab: "bag",
      label: "牡蠣",
      amount: inventory.oysters,
      tone: "pearl",
      symbol: "貝",
      model: () => makeInventoryItemVisual("oysters"),
    },
    {
      id: "wood",
      tab: "bag",
      label: "木材",
      amount: inventory.wood,
      tone: "wood",
      symbol: "木",
      model: () => makeInventoryItemVisual("wood"),
    },
    {
      id: "stone",
      tab: "bag",
      label: "石材",
      amount: inventory.stone,
      tone: "stone",
      symbol: "石",
      model: () => makeInventoryItemVisual("stone"),
    },
    {
      id: "copper",
      tab: "bag",
      label: "銅礦",
      amount: inventory.copper,
      tone: "copper",
      symbol: "銅",
      model: () => makeInventoryItemVisual("copper"),
    },
    {
      id: "silver",
      tab: "bag",
      label: "銀礦",
      amount: inventory.silver,
      tone: "silver",
      symbol: "銀",
      model: () => makeInventoryItemVisual("silver"),
    },
    {
      id: "gold",
      tab: "bag",
      label: "金礦",
      amount: inventory.gold,
      tone: "gold",
      symbol: "金",
      model: () => makeInventoryItemVisual("gold"),
    },
    {
      id: "starCrystal",
      tab: "bag",
      label: "星晶",
      amount: inventory.starCrystal,
      tone: "star",
      symbol: "星",
      model: () => makeInventoryItemVisual("starCrystal"),
    },
    {
      id: "godCrystal",
      tab: "bag",
      label: "神晶",
      amount: inventory.godCrystal,
      tone: "god",
      symbol: "神",
      model: () => makeInventoryItemVisual("godCrystal"),
    },
  ];
  PEARL_DEFINITIONS.forEach((pearl) => {
    entries.push({
      id: "pearl-" + pearl.id,
      tab: "bag",
      label: pearl.label,
      amount: inventory.pearls[pearl.id],
      tone: "pearl",
      symbol: "珠",
      model: () => makeInventoryItemVisual("pearl-" + pearl.id),
      description: pearl.label + "，從牡蠣架採收時低機率取得。",
    });
  });
  const recipeNames = new Map(
    RECIPES.map((recipe) => [recipe.id, recipe.name]),
  );
  const dishIds = new Set([
    ...RECIPES.map((recipe) => recipe.id),
    ...Object.keys(inventory.dishes),
    ...Object.keys(inventory.storage)
      .filter((id) => id.startsWith("dish-"))
      .map((id) => id.slice(5)),
  ]);
  dishIds.forEach((id) => {
    const amount = inventory.dishes[id] ?? 0;
    entries.push({
      id: "dish-" + id,
      tab: "bag",
      label: recipeNames.get(id) || id,
      amount,
      tone: "dish",
      symbol: "食",
    });
  });
  return entries;
}

function renderModelThumbnail(item: InventoryEntry) {
  if (!item.model) return null;
  const cached = modelIconCache.get(item.id);
  if (cached) return cached;

  const renderer = getThumbnailRenderer();

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff3d2, 0x34414a, 1.45));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(-2, 3, 3);
  scene.add(keyLight);

  const model = item.model();
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const longestEdge = Math.max(size.x, size.y, size.z, 0.01);
  const thumbnailScale = INVENTORY_THUMBNAIL_LONG_EDGE / longestEdge;
  model.scale.setScalar(thumbnailScale);
  model.position.sub(center.multiplyScalar(thumbnailScale));
  scene.add(model);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(2.2, 1.8, 3.2);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");
  scene.remove(model);
  disposeThumbnailModel(model);
  modelIconCache.set(item.id, dataUrl);
  return dataUrl;
}

export function inventoryItemThumbnail(itemId: string) {
  const entry = inventoryEntries().find((item) => item.id === itemId);
  return entry ? renderModelThumbnail(entry) : null;
}

function setActiveTab(index: number, focus = false) {
  activeTabIndex = (index + TABS.length) % TABS.length;
  const activeId = TABS[activeTabIndex].id;
  tabButtons.forEach((button, buttonIndex) => {
    const selected = button.dataset.inventoryTab === activeId;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
    if (selected) activeTabIndex = buttonIndex;
  });
  renderInventory();
}

function moveContentFocus(direction: -1 | 1) {
  const cards = Array.from(
    grid.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (!cards.length) return false;
  const currentIndex = cards.indexOf(
    document.activeElement as HTMLButtonElement,
  );
  const nextIndex =
    currentIndex < 0
      ? direction > 0
        ? 0
        : cards.length - 1
      : Math.max(0, Math.min(cards.length - 1, currentIndex + direction));
  cards[nextIndex].focus();
  return true;
}

function closeItemContentMenu(restoreFocus = true) {
  const returnCard = contextReturnCard;
  contextItemId = null;
  contextReturnCard = null;
  contentMenu.hidden = true;
  contentMenu.innerHTML = "";
  if (panel.contains(contentMenu) === false) {
    panel.appendChild(contentMenu);
  }
  if (restoreFocus && open && returnCard?.isConnected) returnCard.focus();
}

function makeActionButton(label: string, action: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = translateText(label);
  button.addEventListener("click", action);
  return button;
}

function openTransferAmountMenu(
  itemId: string,
  itemTab: "bag" | "storage",
  returnCard?: HTMLButtonElement,
) {
  contextReturnCard = returnCard ?? null;
  const item = inventoryItem(itemId);
  const available =
    itemTab === "storage" ? storedItemAmount(itemId) : itemAmount(itemId);
  if (!item || available <= 0) return;

  contextItemId = itemId;
  contentMenu.innerHTML = "";
  if (contentMenu.parentNode !== document.body) {
    document.body.appendChild(contentMenu);
  }
  contentMenu.hidden = false;

  const heading = document.createElement("h3");
  heading.textContent = translateText(item.label);
  contentMenu.appendChild(heading);

  const quantityLabel = document.createElement("div");
  quantityLabel.textContent = itemTab === "storage" ? "轉出數量" : "轉入數量";
  quantityLabel.className = "inventory-quantity-label";
  contentMenu.appendChild(quantityLabel);

  let selectedAmount = Math.max(1, Math.min(available, available));
  let quantityDisplay: HTMLButtonElement | null = null;

  const updateQuantity = (delta: number) => {
    selectedAmount = Math.max(1, Math.min(available, selectedAmount + delta));
    if (quantityDisplay) {
      quantityDisplay.textContent = `${selectedAmount}`;
      quantityDisplay.setAttribute(
        "aria-label",
        `${translateText(item.label)}，${selectedAmount} 個`,
      );
    }
    const confirm = contentMenu.querySelector<HTMLButtonElement>(
      ".inventory-confirm-quantity",
    );
    if (confirm) confirm.textContent = `確認轉移 ${selectedAmount} 個`;
  };

  const quantityPicker = document.createElement("div");
  quantityPicker.className = "inventory-quantity-picker";

  const buildArrow = (
    direction: "up" | "down" | "left" | "right",
    step: number,
    label: string,
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-quantity-arrow inventory-quantity-${direction}`;
    button.textContent = label;
    button.setAttribute(
      "aria-label",
      `${direction === "up" ? "增加" : direction === "down" ? "減少" : direction === "left" ? "減少" : "增加"} ${Math.abs(step)} 個`,
    );
    button.addEventListener("click", () => updateQuantity(step));
    return button;
  };

  quantityDisplay = document.createElement("button");
  quantityDisplay.type = "button";
  quantityDisplay.className = "inventory-quantity-display";
  quantityDisplay.textContent = String(selectedAmount);
  quantityDisplay.setAttribute(
    "aria-label",
    `${translateText(item.label)}，${selectedAmount} 個`,
  );
  quantityDisplay.tabIndex = 0;
  quantityDisplay.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateQuantity(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      updateQuantity(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateQuantity(10);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateQuantity(-10);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      closeItemContentMenu(false);
      transferSelectedItem(itemId, itemTab, selectedAmount);
    }
  });

  quantityPicker.append(
    buildArrow("up", 10, "▲ 10"),
    buildArrow("left", -1, "◀ 1"),
    quantityDisplay,
    buildArrow("right", 1, "1 ▶"),
    buildArrow("down", -10, "▼ 10"),
  );
  contentMenu.appendChild(quantityPicker);

  const confirm = makeActionButton(`確認轉移 ${selectedAmount} 個`, () => {
    closeItemContentMenu(false);
    transferSelectedItem(itemId, itemTab, selectedAmount);
  });
  confirm.classList.add("inventory-confirm-quantity");
  contentMenu.appendChild(confirm);

  contentMenu.appendChild(makeActionButton("取消", closeItemContentMenu));
  confirm.focus();
}

function openItemContentMenu(
  itemId: string,
  itemTab: "bag" | "storage",
  returnCard?: HTMLButtonElement,
) {
  contextReturnCard = returnCard ?? null;
  const item = inventoryItem(itemId);
  const available =
    itemTab === "storage" ? storedItemAmount(itemId) : itemAmount(itemId);
  if (!item || available <= 0) return;

  contextItemId = itemId;
  contentMenu.innerHTML = "";
  if (contentMenu.parentNode !== document.body) {
    document.body.appendChild(contentMenu);
  }
  contentMenu.hidden = false;
  const heading = document.createElement("h3");
  heading.textContent = translateText(item.label);
  contentMenu.appendChild(heading);

  if (itemTab === "bag") {
    const take = makeActionButton("拿出", () => {
      if (takeOutItem(itemId)) setInventoryOpen(false);
    });
    contentMenu.appendChild(take);
    if (item.edible) {
      contentMenu.appendChild(
        makeActionButton("食用", () => {
          eatItem(itemId);
          closeItemContentMenu(false);
          renderInventory(true);
        }),
      );
    }
  }

  const transferLabel = itemTab === "storage" ? "放入背包" : "放入倉庫";
  const transferAction = () => {
    if (available > 1) {
      openTransferAmountMenu(itemId, itemTab, returnCard);
      return;
    }
    closeItemContentMenu(false);
    transferSelectedItem(itemId, itemTab);
  };
  contentMenu.appendChild(makeActionButton(transferLabel, transferAction));
  contentMenu.appendChild(makeActionButton("取消", closeItemContentMenu));
  (contentMenu.querySelector("button") as HTMLButtonElement | null)?.focus();
}

function transferSelectedItem(
  itemId: string,
  activeId: InventoryTab,
  amount = 1,
) {
  const moved =
    activeId === "storage"
      ? moveItemFromStorageAmount(itemId, amount)
      : moveItemToStorageAmount(itemId, amount);
  if (moved) renderInventory(true);
}

function changeItemPage(activeId: "bag" | "storage", direction: -1 | 1) {
  const entries = inventoryEntries().filter((item) =>
    activeId === "storage" ? storedItemAmount(item.id) > 0 : item.amount > 0,
  );
  const itemsPerPage = getItemsPerPage();
  const pageCount = Math.max(1, Math.ceil(entries.length / itemsPerPage));
  pageByTab[activeId] =
    (pageByTab[activeId] + direction + pageCount) % pageCount;
  renderInventory(true);
}

function renderPager(
  activeId: "bag" | "storage",
  page: number,
  pageCount: number,
) {
  const pager = document.createElement("div");
  pager.className = "inventory-pager";
  const transfer = makeActionButton(
    activeId === "storage" ? "X　放入背包" : "X　放入倉庫",
    () => {
      if (!contextItemId) return;
      const amount =
        activeId === "storage"
          ? storedItemAmount(contextItemId)
          : itemAmount(contextItemId);
      if (amount > 1) {
        openTransferAmountMenu(contextItemId, activeId);
        return;
      }
      transferSelectedItem(contextItemId, activeId);
    },
  );
  transfer.classList.add("inventory-transfer-button");
  const previous = makeActionButton("← 上一頁", () =>
    changeItemPage(activeId, -1),
  );
  previous.disabled = pageCount <= 1;
  const indicator = document.createElement("span");
  indicator.textContent = `${page + 1} / ${pageCount}`;
  indicator.setAttribute("aria-live", "polite");
  const next = makeActionButton("下一頁 →", () => changeItemPage(activeId, 1));
  next.disabled = pageCount <= 1;
  pager.append(transfer, previous, indicator, next);
  grid.appendChild(pager);
}

export function renderInventory(focusFirstCard = false) {
  grid.innerHTML = "";
  showEntryDescription();
  const activeId = TABS[activeTabIndex].id;
  grid.classList.toggle(
    "inventory-grid-info",
    activeId === "relationships" || activeId === "tools",
  );
  if (activeId === "tools") {
    renderTools();
    return;
  }
  if (activeId === "relationships") {
    renderRelationships();
    return;
  }

  const itemTab = activeId as "bag" | "storage";
  const visibleEntries = inventoryEntries()
    .map((item) => ({
      ...item,
      amount: itemTab === "storage" ? storedItemAmount(item.id) : item.amount,
    }))
    .filter((item) => item.amount > 0);
  const itemsPerPage = getItemsPerPage();
  const pageCount = Math.max(
    1,
    Math.ceil(visibleEntries.length / itemsPerPage),
  );
  pageByTab[itemTab] = Math.min(pageByTab[itemTab], pageCount - 1);
  const page = pageByTab[itemTab];
  const pageEntries = visibleEntries.slice(
    page * itemsPerPage,
    (page + 1) * itemsPerPage,
  );
  contextItemId = pageEntries[0]?.id ?? null;

  if (!pageEntries.length) {
    const empty = document.createElement("div");
    empty.className = "inventory-empty";
    empty.textContent = translateText(
      itemTab === "storage" ? "倉庫目前是空的" : "目前沒有物品",
    );
    grid.appendChild(empty);
  }

  pageEntries.forEach((item) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inventory-slot inventory-slot-" + item.tone;
    slot.dataset.itemId = item.id;
    slot.setAttribute(
      "aria-label",
      `${translateText(item.label)} ×${item.amount}`,
    );

    const icon = document.createElement("div");
    icon.className = "inventory-icon";
    icon.setAttribute("aria-hidden", "true");
    const modelImage = renderModelThumbnail(item);
    if (modelImage) {
      const image = document.createElement("img");
      image.src = modelImage;
      image.alt = "";
      icon.appendChild(image);
      icon.classList.add("inventory-icon-model");
    } else {
      icon.textContent = item.symbol;
    }

    const count = document.createElement("div");
    count.className = "inventory-item-count";
    count.textContent = String(item.amount);
    const label = document.createElement("div");
    label.className = "inventory-item-label";
    label.textContent = translateText(item.label);
    icon.append(count);
    slot.append(icon, label);
    slot.addEventListener("focus", () =>
      selectInfoCard(slot, item.label, entryDescription(item)),
    );
    slot.addEventListener("click", () => {
      selectInfoCard(slot, item.label, entryDescription(item));
      openItemContentMenu(item.id, itemTab, slot);
    });
    grid.appendChild(slot);
  });

  renderPager(itemTab, page, pageCount);
  if (focusFirstCard)
    grid.querySelector<HTMLButtonElement>(".inventory-slot")?.focus();
}

function renderTools() {
  const ownedTools = TOOL_DEFINITIONS.filter((tool) => hasTool(tool.id));
  if (!ownedTools.length) {
    const empty = document.createElement("div");
    empty.className = "inventory-empty";
    empty.textContent = translateText("目前沒有工具");
    grid.appendChild(empty);
    return;
  }

  ownedTools.forEach((tool) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "inventory-slot inventory-tool-card";
    card.dataset.toolId = tool.id;
    card.setAttribute("aria-label", translateText(tool.label));

    const icon = document.createElement("div");
    icon.className = "inventory-icon inventory-icon-model";
    const modelImage = renderModelThumbnail({
      id: "tool-" + tool.id,
      tab: "tools",
      label: tool.label,
      amount: 1,
      tone: "tool",
      symbol: tool.label.slice(0, 1),
      model: () => makeToolModel(tool.id),
    });
    if (modelImage) {
      const image = document.createElement("img");
      image.src = modelImage;
      image.alt = "";
      icon.appendChild(image);
    }

    const label = document.createElement("div");
    label.className = "inventory-item-label";
    label.textContent = translateText(tool.label);
    card.append(icon, label);
    const select = () => selectInfoCard(card, tool.label, tool.description);
    card.addEventListener("focus", select);
    card.addEventListener("click", select);
    grid.appendChild(card);
  });
}

function renderRelationships() {
  const relationships = [{ id: "mayor" }, { id: "carpenter" }];
  relationships.forEach(({ id }) => {
    const relationship = getRelationship(id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "menu-info-card";
    const heading = document.createElement("h3");
    heading.textContent = getNpcDisplayName(id);
    const value = document.createElement("strong");
    value.textContent = `${getDisplayedStars(id)} ★`;
    const caption = document.createElement("span");
    const pointLabel = translateText("點");
    caption.textContent = relationship.currentLock
      ? getLocale() === "en"
        ? `${relationship.points} ${pointLabel} · ${relationship.currentLock}${translateText("星鎖定")}`
        : `${relationship.points} ${pointLabel}・${relationship.currentLock} ${translateText("星鎖定")}`
      : `${relationship.points} ${pointLabel}`;
    card.append(heading, value, caption);
    const describeRelationship = () =>
      selectInfoCard(
        card,
        getNpcDisplayName(id),
        "目前關係為 " +
          getDisplayedStars(id) +
          " 星，共 " +
          relationship.points +
          " 點。",
      );
    card.addEventListener("focus", describeRelationship);
    card.addEventListener("click", describeRelationship);
    grid.appendChild(card);
  });
}

export function isInventoryOpen() {
  return open;
}

export function setInventoryOpen(nextOpen: boolean) {
  open = nextOpen;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", String(!open));
  overlay.dataset.gameMenu = open ? "open" : "closed";
  setTimePauseSource("inventory", open);
  if (open) {
    closeItemContentMenu(false);
    renderInventory();
    tabButtons[activeTabIndex]?.focus();
  } else {
    closeItemContentMenu(false);
  }
}

export function toggleInventory() {
  const dialog = document.getElementById("dialog");
  const dialogOpen = Boolean(
    dialog && dialog.style.display !== "none" && dialog.style.display !== "",
  );
  if (!open && dialogOpen) return;
  setInventoryOpen(!open);
}

tabButtons.forEach((button, index) => {
  button.addEventListener("click", () => setActiveTab(index, true));
});

addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "q" && !event.repeat) {
    event.preventDefault();
    window.dispatchEvent(new Event("close-map-menu"));
    toggleInventory();
    return;
  }
  if (!open || event.repeat) return;

  if (!contentMenu.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeItemContentMenu();
      return;
    }
    const isDirectional = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(event.key);
    if (isDirectional || event.key === "Tab") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const buttons = Array.from(
        contentMenu.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ),
      );
      if (!buttons.length) return;
      const current = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const backwards =
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        (event.key === "Tab" && event.shiftKey);
      const direction = backwards ? -1 : 1;
      const start = current < 0 ? (backwards ? 0 : -1) : current;
      buttons[(start + direction + buttons.length) % buttons.length].focus();
      return;
    }
    return;
  }

  const activeId = TABS[activeTabIndex].id;
  if (
    contentMenu.hidden &&
    (event.key === "PageUp" || event.key === "PageDown") &&
    (activeId === "bag" || activeId === "storage")
  ) {
    event.preventDefault();
    changeItemPage(activeId, event.key === "PageDown" ? 1 : -1);
    return;
  }
  if (
    key === "x" &&
    contentMenu.hidden &&
    (activeId === "bag" || activeId === "storage")
  ) {
    const focused = document.activeElement;
    const itemId =
      focused instanceof HTMLButtonElement ? focused.dataset.itemId : undefined;
    if (itemId) {
      event.preventDefault();
      const amount =
        activeId === "storage" ? storedItemAmount(itemId) : itemAmount(itemId);
      if (amount > 1) {
        openTransferAmountMenu(itemId, activeId, focused as HTMLButtonElement);
      } else {
        transferSelectedItem(itemId, activeId);
      }
    }
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && tabList.contains(focused)) {
      event.preventDefault();
      setActiveTab(activeTabIndex + direction, true);
    } else if (contentMenu.hidden && moveContentFocus(direction)) {
      event.preventDefault();
    }
  } else if (event.key === "[") {
    event.preventDefault();
    setActiveTab(activeTabIndex - 1, true);
  } else if (event.key === "]") {
    event.preventDefault();
    setActiveTab(activeTabIndex + 1, true);
  }
});

addEventListener("focusin", (event) => {
  if (!open || contentMenu.hidden) return;
  const target = event.target;
  if (target instanceof Node && contentMenu.contains(target)) return;
  (
    contentMenu.querySelector(
      "button:not(:disabled)",
    ) as HTMLButtonElement | null
  )?.focus();
});

closeButton.addEventListener("click", () => setInventoryOpen(false));
document.getElementById("quickInfoMenuBtn")?.addEventListener("click", () => {
  if (!gameState.player || gameState.cutsceneActive) return;
  window.dispatchEvent(new Event("close-map-menu"));
  setInventoryOpen(true);
});
let inventoryResizeTimer = 0;
addEventListener("resize", () => {
  if (!open) return;
  clearTimeout(inventoryResizeTimer);
  inventoryResizeTimer = window.setTimeout(() => renderInventory(true), 80);
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) setInventoryOpen(false);
});
