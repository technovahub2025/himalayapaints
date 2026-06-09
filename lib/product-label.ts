export function formatProductLabel(name: string) {
  return name.trim().replace(/\btable\b/gi, "Product");
}

export function normalizeProductLabel(name: string) {
  return formatProductLabel(name).trim().replace(/\s+/g, " ").toLowerCase();
}

export function isSameProductLabel(left: string, right: string) {
  return normalizeProductLabel(left) === normalizeProductLabel(right);
}

export function getProductNameVariants(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([
    trimmed,
    formatProductLabel(trimmed),
    trimmed.replace(/\bproduct\b/gi, "Table")
  ]);

  return Array.from(variants).filter(Boolean);
}
