import {
  canAffordRecipe,
  cookRecipe,
  type CookingIngredientId,
  type CookingSourcePreference,
  gameState,
  inventory,
  RECIPES,
  type Recipe,
} from "./game-state";
import { itemAmount, storedItemAmount } from "./inventory-system";
import { reportPrologueCookingSuccess } from "./prologue";

const INGREDIENT_LABELS: Record<CookingIngredientId, string> = {
  harvested: "農作物",
  mushroom: "蘑菇",
  fish: "魚",
  oysters: "牡蠣",
};

const overlay = document.createElement("div");
overlay.id = "cookingOverlay";
overlay.setAttribute("aria-hidden", "true");
overlay.dataset.gameMenu = "closed";
overlay.innerHTML = `
  <section id="cookingPanel" role="dialog" aria-modal="true" aria-labelledby="cookingTitle">
    <header class="cooking-header">
      <div><span class="cooking-kicker">廚房</span><h2 id="cookingTitle">今天要做什麼？</h2></div>
      <button id="cookingClose" type="button">Esc / B　關閉</button>
    </header>
    <div id="recipeGrid" class="recipe-grid"></div>
    <p id="cookingHint" class="cooking-hint">選擇已解鎖且材料足夠的食譜。</p>
    <div id="ingredientPicker" class="ingredient-picker" hidden>
      <h3 id="ingredientPickerTitle">選擇材料來源</h3>
      <div id="ingredientRows"></div>
      <div class="ingredient-actions">
        <button id="cookConfirm" type="button">開始料理</button>
        <button id="cookBack" type="button">返回食譜</button>
      </div>
    </div>
  </section>`;
document.body.appendChild(overlay);

const recipeGrid = overlay.querySelector("#recipeGrid") as HTMLElement;
const hint = overlay.querySelector("#cookingHint") as HTMLElement;
const picker = overlay.querySelector("#ingredientPicker") as HTMLElement;
const rows = overlay.querySelector("#ingredientRows") as HTMLElement;
const pickerTitle = overlay.querySelector("#ingredientPickerTitle") as HTMLElement;
let selectedRecipe: Recipe | null = null;
let preferences: CookingSourcePreference = {};

function ingredientAmount(id: CookingIngredientId) {
  return id === "mushroom" ? inventory.mushrooms : itemAmount(id);
}

function closeCookingMenu() {
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.gameMenu = "closed";
  picker.hidden = true;
  selectedRecipe = null;
}

function sourceSummary(id: CookingIngredientId, required: number) {
  const bag = ingredientAmount(id);
  const storage = storedItemAmount(id);
  const preferStorage = preferences[id] === "storage";
  const fromStorage = preferStorage
    ? Math.min(storage, required)
    : Math.max(0, required - bag);
  return `背包 ${required - fromStorage}／倉庫 ${fromStorage}`;
}

function renderPicker(recipe: Recipe) {
  selectedRecipe = recipe;
  preferences = {};
  picker.hidden = false;
  recipeGrid.hidden = true;
  hint.hidden = true;
  pickerTitle.textContent = `${recipe.name}・選擇材料來源`;
  rows.replaceChildren();
  (Object.entries(recipe.cost) as [CookingIngredientId, number][]).forEach(
    ([id, required]) => {
      const row = document.createElement("div");
      row.className = "ingredient-row";
      const label = document.createElement("span");
      label.textContent = `${INGREDIENT_LABELS[id]} ×${required}（背包 ${ingredientAmount(id)}／倉庫 ${storedItemAmount(id)}）`;
      const source = document.createElement("button");
      source.type = "button";
      source.textContent = sourceSummary(id, required);
      source.title = "按下可切換優先使用背包或倉庫";
      source.addEventListener("click", () => {
        preferences[id] = preferences[id] === "storage" ? "bag" : "storage";
        source.textContent = sourceSummary(id, required);
      });
      row.append(label, source);
      rows.appendChild(row);
    },
  );
  (rows.querySelector("button") as HTMLButtonElement | null)?.focus();
}

function renderRecipes() {
  picker.hidden = true;
  recipeGrid.hidden = false;
  hint.hidden = false;
  recipeGrid.replaceChildren();
  const known = RECIPES.filter((recipe) =>
    inventory.learnedRecipes.includes(recipe.id),
  );
  if (!known.length) {
    const empty = document.createElement("p");
    empty.className = "cooking-empty";
    empty.textContent = "目前還不會任何料理。食譜可由居民、書架或事件解鎖。";
    recipeGrid.appendChild(empty);
    return;
  }
  known.forEach((recipe) => {
    const available = canAffordRecipe(recipe);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "recipe-card";
    card.disabled = !available;
    const costs = (
      Object.entries(recipe.cost) as [CookingIngredientId, number][]
    )
      .map(([id, amount]) => `${INGREDIENT_LABELS[id]} ×${amount}`)
      .join("　");
    card.innerHTML = `<strong>${recipe.name}</strong><span>${recipe.tier}</span><small>${costs}</small><em>${available ? "選擇食材" : "材料不足"}</em>`;
    card.addEventListener("click", () => renderPicker(recipe));
    recipeGrid.appendChild(card);
  });
}

export function openCookingMenu() {
  renderRecipes();
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  overlay.dataset.gameMenu = "open";
  (recipeGrid.querySelector("button:not(:disabled)") as HTMLButtonElement | null)?.focus();
}

overlay.querySelector("#cookingClose")?.addEventListener("click", closeCookingMenu);
overlay.querySelector("#cookBack")?.addEventListener("click", () => {
  selectedRecipe = null;
  renderRecipes();
  (recipeGrid.querySelector("button:not(:disabled)") as HTMLButtonElement | null)?.focus();
});
overlay.querySelector("#cookConfirm")?.addEventListener("click", () => {
  if (!selectedRecipe) return;
  const cooked = cookRecipe(selectedRecipe.id, preferences);
  if (!cooked) {
    hint.hidden = false;
    hint.textContent = "材料狀態已改變，請重新選擇食譜。";
    renderRecipes();
    return;
  }
  closeCookingMenu();
  reportPrologueCookingSuccess();
});

addEventListener("keydown", (event) => {
  if (!overlay.classList.contains("open")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (!picker.hidden) {
      selectedRecipe = null;
      renderRecipes();
    } else closeCookingMenu();
  }
});
