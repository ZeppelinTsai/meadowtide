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
