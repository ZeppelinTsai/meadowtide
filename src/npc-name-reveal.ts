import { getLocale, type Locale } from "./i18n";

export type NpcNameRevealStage = 0 | 1 | 2;
type LocalizedName = Record<Locale, string>;

export interface NpcIdentityDefinition {
  id: string;
  displayNames: Partial<Record<NpcNameRevealStage, LocalizedName>>;
  maxStage: NpcNameRevealStage;
}

const localized = (zh: string, en: string, ja = zh): LocalizedName => ({ zh, en, ja });

export const NPC_IDENTITIES: Record<string, NpcIdentityDefinition> = {
  mayor: { id: "mayor", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("梅貝爾", "Mabel") } },
  captain: { id: "captain", maxStage: 1, displayNames: { 0: localized("船長", "Captain", "船長"), 1: localized("赫克托", "Hector") } },
  carpenter: { id: "carpenter", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("歐文", "Owen") } },
  marine_biologist: { id: "marine_biologist", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("傑米", "Jamie") } },
  artist: { id: "artist", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("露比", "Ruby") } },
  nurse: { id: "nurse", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("艾瑪", "Emma") } },
  doctor: { id: "doctor", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("維克多", "Victor") } },
  botanist: { id: "botanist", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("克拉拉", "Clara") } },
  chef: { id: "chef", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("蘇菲", "Sophie") } },
  innkeeper: { id: "innkeeper", maxStage: 1, displayNames: { 0: localized("???", "???", "???"), 1: localized("菲力克斯", "Felix") } },
  mountain_god: { id: "mountain_god", maxStage: 2, displayNames: { 0: localized("???", "???", "???"), 1: localized("山神", "Mountain God", "山の神"), 2: localized("伊吹", "Ibuki") } },
  sea_god: { id: "sea_god", maxStage: 2, displayNames: { 0: localized("???", "???", "???"), 1: localized("海神", "Sea God", "海の神"), 2: localized("涅莉娜", "Nerina") } },
};

const stages: Record<string, NpcNameRevealStage> = {};

export function isNpcIdentityId(npcId: string): boolean {
  return Object.prototype.hasOwnProperty.call(NPC_IDENTITIES, npcId);
}

export function getNpcNameStage(npcId: string): NpcNameRevealStage {
  return stages[npcId] ?? 0;
}

export function getNpcDisplayName(npcId: string, locale: Locale = getLocale()): string {
  const definition = NPC_IDENTITIES[npcId];
  if (!definition) return "???";
  const stage = Math.min(getNpcNameStage(npcId), definition.maxStage) as NpcNameRevealStage;
  const names = definition.displayNames[stage] ?? definition.displayNames[0];
  return names?.[locale] ?? names?.zh ?? "???";
}

export function setNpcNameStage(npcId: string, stage: NpcNameRevealStage): boolean {
  const definition = NPC_IDENTITIES[npcId];
  if (!definition || !Number.isFinite(stage)) return false;
  const next = Math.min(Math.max(0, Math.trunc(stage)), definition.maxStage) as NpcNameRevealStage;
  if (next <= getNpcNameStage(npcId)) return false;
  stages[npcId] = next;
  return true;
}

export function resetNpcNameRevealState() {
  Object.keys(stages).forEach((id) => delete stages[id]);
}

export function exportNpcNameRevealState(): Record<string, NpcNameRevealStage> {
  return Object.fromEntries(Object.keys(NPC_IDENTITIES).map((id) => [id, getNpcNameStage(id)]));
}

export function restoreNpcNameRevealState(value: unknown, legacyKnownNpcIds: string[] = []) {
  resetNpcNameRevealState();
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([id, stage]) => {
      if (typeof stage === "number") setNpcNameStage(id, stage as NpcNameRevealStage);
    });
    return;
  }
  legacyKnownNpcIds.forEach((id) => setNpcNameStage(id, 1));
}