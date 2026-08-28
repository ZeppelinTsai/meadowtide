import { gameSettings } from "./settings";
import type { ControllerLayout, InputDevice } from "./context-interaction";

let lastInputDevice: InputDevice = "keyboardMouse";
let detectedLayout: ControllerLayout = "xbox";
const listeners = new Set<() => void>();

export function resolveControllerLayout(pad?: Gamepad | null): ControllerLayout {
  if (gameSettings.controllerLayout !== "auto")
    return gameSettings.controllerLayout;
  return /nintendo|switch|joy-?con|pro controller/i.test(pad?.id || "")
    ? "nintendo"
    : "xbox";
}

export function markGamepadInput(pad?: Gamepad | null) {
  const nextLayout = resolveControllerLayout(pad);
  const changed = lastInputDevice !== "gamepad" || detectedLayout !== nextLayout;
  lastInputDevice = "gamepad";
  detectedLayout = nextLayout;
  if (changed) listeners.forEach((listener) => listener());
}

export function markKeyboardMouseInput(event?: Event) {
  if (event && "isTrusted" in event && !(event as Event).isTrusted) return;
  if (lastInputDevice === "keyboardMouse") return;
  lastInputDevice = "keyboardMouse";
  listeners.forEach((listener) => listener());
}

export function getLastInputDevice() {
  return lastInputDevice;
}

export function getEffectiveControllerLayout(): ControllerLayout {
  return gameSettings.controllerLayout === "auto"
    ? detectedLayout
    : gameSettings.controllerLayout;
}

export function onInputPresentationChanged(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
