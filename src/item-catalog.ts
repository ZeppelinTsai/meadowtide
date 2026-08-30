export type CropType = "radish" | "potato" | "tomato";

export type InventoryItemId =
  | "radishSeeds"
  | "potatoSeeds"
  | "tomatoSeeds"
  | "harvested"
  | "fish"
  | "oysters"
  | `dish-${string}`;

export interface ItemDefinition {
  id: InventoryItemId;
  label: string;
  edible: boolean;
  cropType?: CropType;
}

export const SEED_ITEMS: readonly ItemDefinition[] = [
  { id: "radishSeeds", label: "蘿蔔種子", edible: false, cropType: "radish" },
  { id: "potatoSeeds", label: "馬鈴薯種子", edible: false, cropType: "potato" },
  { id: "tomatoSeeds", label: "番茄種子", edible: false, cropType: "tomato" },
];

export const BASIC_ITEMS: readonly ItemDefinition[] = [
  ...SEED_ITEMS,
  { id: "harvested", label: "農作物", edible: true },
  { id: "fish", label: "魚", edible: true },
  { id: "oysters", label: "牡蠣", edible: true },
];

export function cropTypeForSeedItem(itemId: string | null | undefined): CropType | null {
  return SEED_ITEMS.find((item) => item.id === itemId)?.cropType ?? null;
}
