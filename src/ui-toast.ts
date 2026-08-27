import { gameState } from "./game-state";

export function showUiToast(title: string, text: string) {
  gameState.harvestFeedback = {
    kind: "success",
    title,
    text,
    until: gameState.elapsed + 2.6,
  };
}
