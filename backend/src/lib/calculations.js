export function calculateAmount(quantity, rate) {
    return Number((quantity * rate).toFixed(2));
}
export function calculateGrandTotal(items) {
    return items.reduce((sum, item) => sum + calculateAmount(item.quantity, item.rate), 0);
}
export function safePercent(part, total) {
    if (!total)
        return 0;
    return Number(((part / total) * 100).toFixed(2));
}
export function distributeByPercent(percent, targetKg) {
    return Number(((percent / 100) * targetKg).toFixed(2));
}
export function scaleQuantity(originalQuantity, batchKg, baseProduction = 100) {
    if (!baseProduction)
        return 0;
    return Number(((batchKg / baseProduction) * originalQuantity).toFixed(2));
}
