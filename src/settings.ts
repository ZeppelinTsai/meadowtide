export type SpeedLevel = "slow" | "normal" | "fast";

export type GameSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  windowResolution: string;
  locale: "zh" | "ja" | "en";
  controllerLayout: "auto" | "nintendo" | "xbox";
  // 2026-09-05 Zeppelin 要求：對話自動播放的「讀完停留多久才自動推進下
  // 一句」快慢(見 dialogue.ts 的 autoPlayReadDelayMs)，跟主角走路速度
  // (見 game-loop.ts 的 WALK_SPEED_BY_LEVEL)，各自獨立設定、互不影響。
  // "fast" 對 textSpeed 來說是使用者說的「直接顯示」──不停留、讀完立刻
  // 自動推進，不是加快打字機效果(這遊戲本來就沒有打字機逐字動畫)。
  textSpeed: SpeedLevel;
  walkSpeed: SpeedLevel;
};

const STORAGE_KEY = "meadowtide.settings";
const DEFAULTS: GameSettings = {
  masterVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
  muted: false,
  windowResolution: "1280x720",
  locale: "zh",
  controllerLayout: "auto",
  textSpeed: "normal",
  walkSpeed: "normal",
};
const SPEED_LEVELS: SpeedLevel[] = ["slow", "normal", "fast"];
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
      controllerLayout: ["auto", "nintendo", "xbox"].includes(saved.controllerLayout)
        ? saved.controllerLayout
        : DEFAULTS.controllerLayout,
      textSpeed: SPEED_LEVELS.includes(saved.textSpeed)
        ? saved.textSpeed
        : DEFAULTS.textSpeed,
      walkSpeed: SPEED_LEVELS.includes(saved.walkSpeed)
        ? saved.walkSpeed
        : DEFAULTS.walkSpeed,
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
