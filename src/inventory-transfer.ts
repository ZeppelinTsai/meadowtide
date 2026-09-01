export function clampTransferAmount(
  currentAmount: number,
  requestedAmount: number,
): number {
  const safeCurrent = Math.max(0, Math.floor(currentAmount || 0));
  const safeRequested = Math.max(0, Math.floor(requestedAmount || 0));
  return Math.min(safeRequested, safeCurrent);
}

export function applyTransferToBag(
  bagAmount: number,
  storageAmount: number,
  requestedAmount: number,
): { bagAmount: number; storageAmount: number } {
  const transferAmount = clampTransferAmount(storageAmount, requestedAmount);
  if (transferAmount <= 0) return { bagAmount, storageAmount };
  return {
    bagAmount: bagAmount + transferAmount,
    storageAmount: storageAmount - transferAmount,
  };
}

export function applyTransferToStorage(
  bagAmount: number,
  storageAmount: number,
  requestedAmount: number,
): { bagAmount: number; storageAmount: number } {
  const transferAmount = clampTransferAmount(bagAmount, requestedAmount);
  if (transferAmount <= 0) return { bagAmount, storageAmount };
  return {
    bagAmount: bagAmount - transferAmount,
    storageAmount: storageAmount + transferAmount,
  };
}
