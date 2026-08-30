import * as THREE from "three";
import { gameState, hasTool, inventory, RECIPES, TOOL_DEFINITIONS } from "./game-state";
import { ORE_TIERS } from "./mine";
import {
  makeOreNode,
  makeStonePile,
  makeWoodPile,
} from "./props";
import { setTimePauseSource } from "./time-pause";
import { getDisplayedStars, getRelationship } from "./affection";
import { getLocale, translateText } from "./i18n";
import {
  eatItem,
  itemAmount,
  inventoryItem,
  makeInventoryItemVisual,
  takeOutItem,
} from "./inventory-system";
import { getNpcDisplayName } from "./npc-name-reveal";
import { makeToolModel } from "./tool-models";

type InventoryTab = "bag" | "materials" | "cooking" | "tools" | "relationships";
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
  { id: "materials", label: "素材" },
  { id: "cooking", label: "料理" },
  { id: "tools", label: "工具" },
  { id: "relationships", label: "關係" },
];

const overlay = document.getElementById("inventoryOverlay") as HTMLDivElement;
const grid = document.getElementById("inventoryGrid") as HTMLDivElement;
const closeButton = document.getElementById("inventoryClose") as HTMLButtonElement;
const tabList = document.getElementById("inventoryTabs") as HTMLDivElement;
const tabButtons = Array.from(
  tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
);
const panel = document.getElementById("inventoryPanel") as HTMLElement;
const descriptionFooter = document.getElementById("inventoryDescription") as HTMLParagraphElement;
const contentMenu = document.createElement("div");
contentMenu.id = "inventoryContentMenu";
contentMenu.className = "inventory-content-menu";
contentMenu.hidden = true;
contentMenu.setAttribute("role", "menu");
panel.appendChild(contentMenu);

let open = false;
let activeTabIndex = 0;
let contextItemId: string | null = null;
const modelIconCache = new Map<string, string>();

function showEntryDescription(label?: string, description?: string) {
  descriptionFooter.textContent = label
    ? translateText(label) + "｜" + translateText(description || "尚無詳細說明。")
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
  showEntryDescription(label, description);
}
function oreModel(kind: string) {
  const ore = ORE_TIERS.find((tier) => tier.kind === kind);
  return ore
    ? () => makeOreNode(0, 0, ore.color, ore.accentColor, 0.62)
    : undefined;
}

function inventoryEntries(): InventoryEntry[] {
  const entries: InventoryEntry[] = [
    { id: "radishSeeds", tab: "bag", label: "蘿蔔種子", amount: inventory.seeds, tone: "green", symbol: "蘿", model: () => makeInventoryItemVisual("radishSeeds") },
    { id: "potatoSeeds", tab: "bag", label: "馬鈴薯種子", amount: inventory.potatoSeeds, tone: "gold", symbol: "薯", model: () => makeInventoryItemVisual("potatoSeeds") },
    { id: "tomatoSeeds", tab: "bag", label: "番茄種子", amount: inventory.tomatoSeeds, tone: "red", symbol: "番", model: () => makeInventoryItemVisual("tomatoSeeds") },
    { id: "harvested", tab: "bag", label: "農作物", amount: inventory.harvested, tone: "gold", symbol: "穗", model: () => makeInventoryItemVisual("harvested") },
    { id: "fish", tab: "bag", label: "魚", amount: inventory.fish, tone: "blue", symbol: "魚", model: () => makeInventoryItemVisual("fish") },
    { id: "oysters", tab: "bag", label: "牡蠣", amount: inventory.oysters, tone: "pearl", symbol: "貝", model: () => makeInventoryItemVisual("oysters") },
    { id: "wood", tab: "materials", label: "木材", amount: inventory.wood, tone: "wood", symbol: "木", model: () => makeWoodPile(0, 0) },
    { id: "stone", tab: "materials", label: "石材", amount: inventory.stone, tone: "stone", symbol: "石", model: () => makeStonePile(0, 0) },
    { id: "copper", tab: "materials", label: "銅礦", amount: inventory.copper, tone: "copper", symbol: "銅", model: oreModel("copper") },
    { id: "silver", tab: "materials", label: "銀礦", amount: inventory.silver, tone: "silver", symbol: "銀", model: oreModel("silver") },
    { id: "gold", tab: "materials", label: "金礦", amount: inventory.gold, tone: "gold", symbol: "金", model: oreModel("gold") },
    { id: "starCrystal", tab: "materials", label: "星晶", amount: inventory.starCrystal, tone: "star", symbol: "星", model: oreModel("starCrystal") },
    { id: "godCrystal", tab: "materials", label: "神晶", amount: inventory.godCrystal, tone: "god", symbol: "神", model: oreModel("godCrystal") },
  ];
  const recipeNames = new Map(RECIPES.map((recipe) => [recipe.id, recipe.name]));
  Object.entries(inventory.dishes).forEach(([id, amount]) => {
    entries.push({
      id: "dish-" + id,
      tab: "cooking",
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

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(96, 96, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff3d2, 0x34414a, 1.45));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(-2, 3, 3);
  scene.add(keyLight);

  const model = item.model();
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z, 0.01);
  model.scale.setScalar(1.45 / largest);
  model.position.sub(center.multiplyScalar(1.45 / largest));
  scene.add(model);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(2.2, 1.8, 3.2);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL("image/png");
  renderer.dispose();
  modelIconCache.set(item.id, dataUrl);
  return dataUrl;
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

function closeItemContentMenu() {
  contextItemId = null;
  contentMenu.hidden = true;
  contentMenu.innerHTML = "";
}

function makeActionButton(label: string, action: () => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = translateText(label);
  button.addEventListener("click", action);
  return button;
}

function openItemContentMenu(itemId: string) {
  const item = inventoryItem(itemId);
  if (!item || itemAmount(itemId) <= 0) return;
  contextItemId = itemId;
  contentMenu.innerHTML = "";
  contentMenu.hidden = false;
  const heading = document.createElement("h3");
  heading.textContent = translateText(item.label);
  contentMenu.appendChild(heading);
  const take = makeActionButton("拿出", () => { if (takeOutItem(itemId)) setInventoryOpen(false); });
  contentMenu.appendChild(take);
  if (item.edible) contentMenu.appendChild(makeActionButton("食用", () => { eatItem(itemId); closeItemContentMenu(); renderInventory(); }));
  contentMenu.appendChild(makeActionButton("取消", closeItemContentMenu));
  (contentMenu.querySelector("button") as HTMLButtonElement | null)?.focus();
}

export function renderInventory() {
  grid.innerHTML = "";
  showEntryDescription();
  const activeId = TABS[activeTabIndex].id;
  grid.classList.toggle("inventory-grid-info", activeId === "relationships" || activeId === "tools");
  if (activeId === "tools") {
    renderTools();
    return;
  }
  if (activeId === "relationships") {
    renderRelationships();
    return;
  }
  const visibleEntries = inventoryEntries().filter((item) => item.tab === activeId);
  if (!visibleEntries.length) {
    const empty = document.createElement("div");
    empty.className = "inventory-empty";
    empty.textContent = translateText("目前沒有物品");
    grid.appendChild(empty);
    return;
  }

  visibleEntries.forEach((item) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inventory-slot inventory-slot-" + item.tone;
    slot.dataset.itemId = item.id;
    slot.setAttribute("aria-label", `${translateText(item.label)} ×${item.amount}`);

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
    count.textContent = "×" + item.amount;

    const label = document.createElement("div");
    label.className = "inventory-item-label";
    label.textContent = translateText(item.label);

    slot.append(icon, count, label);
    slot.addEventListener("focus", () => selectInfoCard(slot, item.label, entryDescription(item)));
    slot.addEventListener("click", () => {
      selectInfoCard(slot, item.label, entryDescription(item));
      openItemContentMenu(item.id);
    });
    grid.appendChild(slot);
  });
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
        "目前關係為 " + getDisplayedStars(id) + " 星，共 " + relationship.points + " 點。",
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
    renderInventory();
    tabButtons[activeTabIndex]?.focus();
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
  if (event.key === "[") {
    event.preventDefault();
    setActiveTab(activeTabIndex - 1, true);
  } else if (event.key === "]") {
    event.preventDefault();
    setActiveTab(activeTabIndex + 1, true);
  }
});

closeButton.addEventListener("click", () => setInventoryOpen(false));
document.getElementById("quickInfoMenuBtn")?.addEventListener("click", () => {
  if (!gameState.player || gameState.cutsceneActive) return;
  window.dispatchEvent(new Event("close-map-menu"));
  setInventoryOpen(true);
});
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) setInventoryOpen(false);
});
