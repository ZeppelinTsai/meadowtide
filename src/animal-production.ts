export type ProductiveAnimalType = "cow" | "sheep";

export const ANIMAL_PRODUCT_FEED_DAYS: Record<ProductiveAnimalType, number> = {
  cow: 1,
  sheep: 3,
};

export function productionFeedDays(type: string): number {
  return type === "sheep"
    ? ANIMAL_PRODUCT_FEED_DAYS.sheep
    : ANIMAL_PRODUCT_FEED_DAYS.cow;
}

export function advanceProductionProgress(
  type: string,
  progress: number,
  fed: boolean,
): number {
  const required = productionFeedDays(type);
  const current = Math.min(required, Math.max(0, progress));
  return fed ? Math.min(required, current + 1) : current;
}

export function isProductionReady(type: string, progress: number): boolean {
  return progress >= productionFeedDays(type);
}
