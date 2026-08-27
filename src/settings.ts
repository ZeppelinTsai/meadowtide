export type GameSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  windowResolution: string;
  locale: "zh" | "ja" | "en";
};

const STORAGE_KEY = "meadowtide.settings";
const DEFAULTS: GameSettings = {
  masterVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
  muted: false,
  windowResolution: "1280x720",
  locale: "zh",
};
const listeners = new Set<(settings: GameSettings) => void>();

function clampVolume(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function loadSettings(): GameSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
    return {
      masterVolume: clampVolume(saved.masterVolume, DEFAULTS.masterVolume),
      musicVolume: clampVolume(saved.musicVolume, DEFAULTS.musicVolume),
      sfxVolume: clampVolume(saved.sfxVolume, DEFAULTS.sfxVolume),
      muted: typeof saved.muted === "boolean" ? saved.muted : DEFAULTS.muted,
      windowResolution: typeof saved.windowResolution === "string"
        ? saved.windowResolution
        : DEFAULTS.windowResolution,
      locale: ["zh", "ja", "en"].includes(saved.locale)
        ? saved.locale
        : DEFAULTS.locale,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const gameSettings = loadSettings();

export function updateSettings(patch: Partial<GameSettings>) {
  Object.assign(gameSettings, patch);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameSettings));
  listeners.forEach((listener) => listener(gameSettings));
}

export function onSettingsChanged(listener: (settings: GameSettings) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMasterOutput() {
  return gameSettings.muted ? 0 : gameSettings.masterVolume;
}

export function toggleMasterMuted() {
  updateSettings({ muted: !gameSettings.muted });
  return gameSettings.muted;
}
