export type CropType = "radish" | "potato" | "tomato";

export type InventoryItemId =
  | "radishSeeds"
  | "potatoSeeds"
  | "tomatoSeeds"
  | "harvested"
  | "mushroom"
  | "fish"
  | "oysters"
  | "wood"
  | "stone"
  | "wildDaisy"
  | "redPoppy"
  | "dandelion"
  | "blueDayflower"
  | "pinkWoodSorrel"
  | "copper"
  | "silver"
  | "gold"
  | "starCrystal"
  | "godCrystal"
  | "pearl-white"
  | "pearl-pink"
  | "pearl-purple"
  | "pearl-black"
  | "pearl-gold"
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
  { id: "mushroom", label: "香菇", edible: true }, // 2026-09-01：原本只有 prologue 劇情贈送，這次加了野外採集點，改用具體品種名
  { id: "fish", label: "魚", edible: true },
  { id: "oysters", label: "牡蠣", edible: true },
  { id: "wood", label: "木材", edible: false },
  { id: "stone", label: "石材", edible: false },
  // 野花——5 個物種各自獨立 item id，未來顏料/染色系統直接對應這裡，
  // 見 docs/decisions/wildflower-gathering-system.md。
  { id: "wildDaisy", label: "白雛菊", edible: false },
  { id: "redPoppy", label: "紅罌粟花", edible: false },
  { id: "dandelion", label: "蒲公英", edible: false },
  { id: "blueDayflower", label: "藍露草", edible: false },
  { id: "pinkWoodSorrel", label: "粉紅酢漿草", edible: false },
  { id: "copper", label: "銅礦", edible: false },
  { id: "silver", label: "銀礦", edible: false },
  { id: "gold", label: "金礦", edible: false },
  { id: "starCrystal", label: "星晶", edible: false },
  { id: "godCrystal", label: "神晶", edible: false },
  { id: "pearl-white", label: "白珍珠", edible: false },
  { id: "pearl-pink", label: "粉珍珠", edible: false },
  { id: "pearl-purple", label: "紫珍珠", edible: false },
  { id: "pearl-black", label: "黑珍珠", edible: false },
  { id: "pearl-gold", label: "金珍珠", edible: false },
];

export function cropTypeForSeedItem(itemId: string | null | undefined): CropType | null {
  return SEED_ITEMS.find((item) => item.id === itemId)?.cropType ?? null;
}
