export type PearlRarity = "white" | "pink" | "purple" | "black" | "gold";

export const PEARL_DEFINITIONS: readonly {
  id: PearlRarity;
  label: string;
  color: number;
  baseChance: number;
}[] = [
  { id: "white", label: "白珍珠", color: 0xf4f1df, baseChance: 20 },
  { id: "pink", label: "粉珍珠", color: 0xf2a9ba, baseChance: 10 },
  { id: "purple", label: "紫珍珠", color: 0x9267b2, baseChance: 5 },
  { id: "black", label: "黑珍珠", color: 0x24242c, baseChance: 2 },
  { id: "gold", label: "金珍珠", color: 0xe5bd48, baseChance: 1 },
];

export const VILLAGER_IDS = [
  "mayor",
  "captain",
  "carpenter",
  "marine_biologist",
  "artist",
  "nurse",
  "doctor",
  "botanist",
  "chef",
  "innkeeper",
] as const;

export const OYSTER_RACK_MIN_SLOTS = 1;
export const OYSTER_RACK_MAX_SLOTS = 3;
export const PEARL_CHANCE_PER_EXTRA_RACK = 5;

export function normalizeOysterRackSlots(value: unknown) {
  const slots = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 1;
  return Math.max(OYSTER_RACK_MIN_SLOTS, Math.min(OYSTER_RACK_MAX_SLOTS, slots));
}

export function pearlChance(rarity: PearlRarity, rackSlots: number) {
  const definition = PEARL_DEFINITIONS.find((entry) => entry.id === rarity);
  if (!definition) return 0;
  return Math.min(
    100,
    definition.baseChance +
      (normalizeOysterRackSlots(rackSlots) - 1) * PEARL_CHANCE_PER_EXTRA_RACK,
  );
}

export function allVillagersAtSixStars(points: Record<string, number>) {
  return VILLAGER_IDS.every((npcId) => (points[npcId] || 0) >= 600);
}

export function rollPearl(
  rackSlots: number,
  unlocks: { black: boolean; gold: boolean },
  random: () => number = Math.random,
): PearlRarity | null {
  const unlocked = PEARL_DEFINITIONS.filter(
    (entry) =>
      (entry.id !== "black" || unlocks.black) &&
      (entry.id !== "gold" || unlocks.gold),
  ).reverse();
  let roll = random() * 100;
  for (const pearl of unlocked) {
    const chance = pearlChance(pearl.id, rackSlots);
    if (roll < chance) return pearl.id;
    roll -= chance;
  }
  return null;
}
