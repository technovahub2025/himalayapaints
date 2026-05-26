export type ItemRecord = {
  _id?: string;
  name: string;
  quantity: number;
  rate: number;
  amount?: number;
};

export function calculateAmount(quantity: number, rate: number) {
  return Number((quantity * rate).toFixed(2));
}

export function calculateGrandTotal(items: ItemRecord[]) {
  return items.reduce((sum, item) => sum + calculateAmount(item.quantity, item.rate), 0);
}

export function safePercent(part: number, total: number) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

export function distributeByPercent(percent: number, targetKg: number) {
  return Number(((percent / 100) * targetKg).toFixed(2));
}

export function scaleQuantity(originalQuantity: number, batchKg: number, baseProduction = 100) {
  if (!baseProduction) return 0;
  return Number(((batchKg / baseProduction) * originalQuantity).toFixed(2));
}
