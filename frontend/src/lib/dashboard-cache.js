const dashboardCache = new Map();
export function getCachedTableData(tableName) {
    return dashboardCache.get(String(tableName || "").trim().toLowerCase()) ?? null;
}
export function setCachedTableData(tableName, data) {
    const key = String(tableName || "").trim().toLowerCase();
    if (!key)
        return;
    dashboardCache.set(key, data);
}
