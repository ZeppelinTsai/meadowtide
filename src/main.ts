import { animate } from "./game-loop";
import { initTitleScreen } from "./title-screen";
import { initPauseMenu } from "./pause-menu";
import "./inventory-ui";
import "./quick-item-ui";
import "./view-controls-ui";
import "./map-menu";
import { initUiFocusNavigation } from "./ui-focus-navigation";
import { setLocale, translateDocument, onLocaleChanged } from "./i18n";
import { gameSettings } from "./settings";
import { initContextInteraction } from "./context-interaction-ui";
import { installPerfHarness } from "./debug-perf";

// 開局改成先進標題畫面(title-screen.ts)：按任意鍵→主選單，玩家自己選
// 「開始新遊戲」(序幕)或「繼續遊戲」(讀檔進生活區)，不再是開局自動
// 偵測存檔決定走哪條路。buildMap/loadMap/startPrologueScene 這些原本
// 在這裡的開局分支邏輯，都搬進了 title-screen.ts 對應的按鈕事件裡。
setLocale(gameSettings.locale);
translateDocument();
onLocaleChanged(() => translateDocument());
initTitleScreen();
initUiFocusNavigation();
initContextInteraction();
// 遊戲中 Esc 暫停選單(pause-menu.ts)——跟標題畫面各自獨立初始化，靠
// gameState.player 存不存在互斥(標題畫面階段還沒有 player，Esc 監聽會
// 直接跳過)，不用互相知道對方的狀態。
initPauseMenu();
// 效能測試 harness(debug-perf.ts)——2026-09-03 加，只掛 window.__perf、
// 不主動做任何事，不影響正常遊戲流程。
installPerfHarness();
requestAnimationFrame(animate);
