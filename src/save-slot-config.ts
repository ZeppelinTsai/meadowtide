export const SAVE_SLOT_COUNT = 10;

/** Number-row shortcuts: 1..9 map directly; 0 is the tenth save slot. */
export function saveSlotForDigitCode(code: string): number | null {
  const match = /^Digit([0-9])$/.exec(code);
  if (!match) return null;
  return match[1] === "0" ? 10 : Number(match[1]);
}
