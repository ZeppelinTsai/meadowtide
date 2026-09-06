// No DOM dependencies; production never enables this switch.
let active = false;
export function isEventDebugSession() { return active; }
export function setEventDebugSession(value: boolean) { active = value; }

let menuOpen = false;
export function isEventDebugMenuOpen() { return menuOpen; }
export function setEventDebugMenuOpen(value: boolean) { menuOpen = value; }
