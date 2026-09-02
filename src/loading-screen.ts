const TRANSITION_MS = 200;
const BLACK_HOLD_MS = { short: 140, long: 420 } as const;

export type BlackTransitionLength = keyof typeof BLACK_HOLD_MS;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getLoadingScreen() {
  const element = document.getElementById("loadingScreen");
  if (!element) throw new Error("[loading-screen] Missing #loadingScreen");
  return element;
}

/** 顯示黑色載入遮罩，並等待瀏覽器至少畫出一幀後才交還控制。 */
export function showLoadingScreen(): Promise<void> {
  const element = getLoadingScreen();
  element.hidden = false;
  element.classList.remove("loadingScreen--hidden");
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** 淡出遮罩；啟動時 HTML 預設已顯示，所以第一個場景只需呼叫這個函式。 */
export function hideLoadingScreen(): Promise<void> {
  const element = getLoadingScreen();
  element.classList.add("loadingScreen--hidden");
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      element.hidden = true;
      resolve();
    };
    element.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, TRANSITION_MS + 50);
  });
}
/**
 * 共用事件黑幕：CG 用 short，跨地圖／重定位用 long。
 * action 會在畫面全黑後執行，避免玩家看到場景或 CG 切換中的一幀。
 */
export async function runBlackTransition(
  length: BlackTransitionLength,
  action: () => void | Promise<void>,
): Promise<void> {
  await showLoadingScreen();
  await action();
  await wait(BLACK_HOLD_MS[length]);
  await hideLoadingScreen();
}
