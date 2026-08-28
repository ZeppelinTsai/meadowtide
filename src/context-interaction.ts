export type InteractionSlot = "primary" | "secondary" | "tertiary";
export type InputDevice = "keyboardMouse" | "gamepad";
export type ControllerLayout = "nintendo" | "xbox";

export type ContextAction = {
  id: string;
  label: string;
  slot: InteractionSlot;
  execute: () => void;
};

export type InteractionCandidate = {
  id: string;
  distance: number;
  facingScore: number;
  pointed: boolean;
  actions: ContextAction[];
};

export const INTERACTION_KEYS: Record<InteractionSlot, string> = {
  primary: "E",
  secondary: "R",
  tertiary: "F",
};

export function isPrimaryInteractionKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized === "e" ||
    normalized === "enter" ||
    key === " " ||
    normalized === "spacebar"
  );
}

export function gamepadPromptFor(
  slot: InteractionSlot,
  layout: ControllerLayout,
) {
  if (layout === "nintendo") {
    return slot === "primary" ? "Y" : slot === "secondary" ? "X" : "A";
  }
  return slot === "primary" ? "X" : slot === "secondary" ? "Y" : "B";
}

export function promptFor(
  slot: InteractionSlot,
  device: InputDevice,
  layout: ControllerLayout,
) {
  return device === "gamepad"
    ? gamepadPromptFor(slot, layout)
    : INTERACTION_KEYS[slot];
}

export function chooseInteractionTarget(
  candidates: InteractionCandidate[],
  previousId: string | null,
  hysteresisDistance = 0.35,
): InteractionCandidate | null {
  const viable = candidates.filter((candidate) => candidate.actions.length > 0);
  if (!viable.length) return null;
  const pointed = viable
    .filter((candidate) => candidate.pointed)
    .sort((a, b) => a.distance - b.distance)[0];
  if (pointed) return pointed;

  const scored = viable
    .filter((candidate) => candidate.facingScore > 0)
    .sort((a, b) => b.facingScore - a.facingScore || a.distance - b.distance);
  const best =
    scored[0] ?? viable.slice().sort((a, b) => a.distance - b.distance)[0];
  const previous = viable.find((candidate) => candidate.id === previousId);
  if (
    previous &&
    previous.distance <= best.distance + hysteresisDistance &&
    previous.facingScore >= best.facingScore - 0.18
  ) {
    return previous;
  }
  return best;
}
