import { gameState } from "./game-state";
import { translateText } from "./i18n";

export function showUiToast(title: string, text: string) {
  gameState.harvestFeedback = {
    kind: "success",
    title: translateText(title),
    text: translateText(text),
    until: gameState.elapsed + 2.6,
  };
}

// 2026-09-04：強制觸發的劇情事件(目前是第二天早上事件，之後第三天事件
// 也會用)原本時間一到就不管玩家在哪、直接黑屏傳送，完全沒有預警，
// Zeppelin 反饋想先跳一段「好像有人來家裡了，回去看看吧」的提示，讓
// 玩家看得到、還能繼續走一下，過一小段時間才真的開始劇情(通常是黑屏
// 傳送)。這裡跟 loading-screen.ts 的 fadeOut/fadeIn 一樣用真實
// setTimeout(毫秒)，不要用 gameState.elapsed——那個是被日夜週期縮放過
// 的遊戲時間，跟這裡想要的「停頓幾秒」對不上。
export function announceHomeVisitorThenRun(run: () => void, delayMs = 1600) {
  showUiToast("有人來訪", "好像有人來家裡了，回去看看吧。");
  setTimeout(run, delayMs);
}
