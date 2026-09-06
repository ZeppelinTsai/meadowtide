const UI_ROOT_SELECTORS = [
  "#titleScreen:not(.titleScreen--hidden)",
  "#pauseMenu.open",
  "#inventoryOverlay.open",
  "#mapOverlay.open",
  "#dialogChoices",
];

export function registerUiFocusRoot(selector: string) {
  if (!UI_ROOT_SELECTORS.includes(selector)) UI_ROOT_SELECTORS.unshift(selector);
}

const FOCUSABLE_SELECTOR = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[role=tab]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isVisible(element: HTMLElement) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    !element.hidden &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function getActiveUiRoot(): HTMLElement | null {
  for (const selector of UI_ROOT_SELECTORS) {
    const candidates = document.querySelectorAll<HTMLElement>(selector);
    for (const candidate of candidates) {
      if (isVisible(candidate)) return candidate;
    }
  }
  return null;
}

export function isUiNavigationActive() {
  return getActiveUiRoot() !== null;
}

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isVisible,
  );
}

export function focusFirstUiElement() {
  const root = getActiveUiRoot();
  if (!root) return false;
  const first = focusableElements(root)[0];
  if (!first) return false;
  first.focus();
  return true;
}

function moveFocus(root: HTMLElement, direction: "up" | "down" | "left" | "right") {
  const candidates = focusableElements(root);
  if (!candidates.length) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !root.contains(current) || !isVisible(current)) {
    candidates[0].focus();
    return;
  }

  const from = current.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  let best: { element: HTMLElement; score: number } | null = null;

  for (const element of candidates) {
    if (element === current) continue;
    const rect = element.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - fromX;
    const dy = rect.top + rect.height / 2 - fromY;
    const primary =
      direction === "left" ? -dx :
      direction === "right" ? dx :
      direction === "up" ? -dy : dy;
    if (primary <= 2) continue;
    const cross = direction === "left" || direction === "right"
      ? Math.abs(dy)
      : Math.abs(dx);
    const score = primary * 10 + cross;
    if (!best || score < best.score) best = { element, score };
  }
  best?.element.focus();
}

export function handleUiFocusKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    const direction =
      event.key === "ArrowUp" ? "up" :
      event.key === "ArrowDown" ? "down" :
      event.key === "ArrowLeft" ? "left" :
      event.key === "ArrowRight" ? "right" : null;
    if (!direction) return;
    const root = getActiveUiRoot();
    if (!root) return;
    const focused = document.activeElement;
    if (
      (direction === "left" || direction === "right") &&
      (focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement)
    ) {
      return;
    }
    event.preventDefault();
    moveFocus(root, direction);
}

export function initUiFocusNavigation() {
  addEventListener("keydown", handleUiFocusKeyDown);
}
