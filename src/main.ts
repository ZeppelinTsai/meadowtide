import { buildMap, loadMap, fadeIn } from "./build-map";
import { animate } from "./game-loop";
import { shouldPlayPrologueOnBoot, startPrologueScene } from "./prologue";
import "./inventory-ui";

// 開局分支：偵測不到存檔就當作全新開局，播序幕(主角乘船抵達港口)，
// 由 startPrologueScene() 自己接手淡入(它需要在淡入前，趁畫面還黑著
// 把船/跳板/主角先擺到「外海」狀態，見 prologue.ts)；有存檔就維持原本
// 直接進生活區的開局(讀檔本身目前還是走 F9 手動，這條分支不變)。
if (shouldPlayPrologueOnBoot()) {
  buildMap("port");
  loadMap("port", undefined);
  startPrologueScene();
} else {
  buildMap("livingArea");
  loadMap("livingArea", undefined);
  fadeIn();
}
requestAnimationFrame(animate);
