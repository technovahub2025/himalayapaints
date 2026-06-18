export function formatProductLabel(name) {
    return name.trim().replace(/\btable\b/gi, "Product");
}
export function normalizeProductLabel(name) {
    return formatProductLabel(name).trim().replace(/\s+/g, " ").toLowerCase();
}
export function isSameProductLabel(left, right) {
    return normalizeProductLabel(left) === normalizeProductLabel(right);
}
export function getProductNameVariants(name) {
    const trimmed = name.trim();
    if (!trimmed)
        return [];
    const variants = new Set([
        trimmed,
        formatProductLabel(trimmed),
        trimmed.replace(/\bproduct\b/gi, "Table")
    ]);
    return Array.from(variants).filter(Boolean);
}
