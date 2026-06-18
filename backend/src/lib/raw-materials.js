export function normalizeRawMaterialCode(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}
export function generateRawMaterialCode(value) {
    return value
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-")
        .toUpperCase();
}
export function groupRawMaterials(items) {
    const grouped = new Map();
    for (const item of items) {
        const code = (item.code?.trim() || generateRawMaterialCode(item.name)).trim();
        if (!code)
            continue;
        const key = normalizeRawMaterialCode(code);
        const current = grouped.get(key) ?? {
            code,
            name: item.name.trim(),
            rate: item.rate,
        };
        if (!current.rate && Number.isFinite(item.rate)) {
            current.rate = item.rate;
        }
        if (!current.name) {
            current.name = item.name.trim();
        }
        if (!current.code) {
            current.code = code;
        }
        grouped.set(key, current);
    }
    return Array.from(grouped.values())
        .map((entry) => ({
        code: entry.code,
        name: entry.name,
        rate: Number(entry.rate.toFixed(2))
    }))
        .sort((left, right) => left.code.localeCompare(right.code));
}
