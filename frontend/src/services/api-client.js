function buildHeaders(headers, hasJsonBody) {
    const nextHeaders = new Headers(headers);
    if (hasJsonBody && !nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
    }
    return nextHeaders;
}
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export function apiUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    if (apiBaseUrl && path.startsWith("/api/")) {
        return `${apiBaseUrl}${path}`;
    }
    return path;
}
export async function apiRequest(input, options = {}) {
    return fetch(typeof input === "string" ? apiUrl(input) : input, {
        ...options,
        credentials: "include"
    });
}
export async function apiFetch(input, options = {}) {
    const hasJsonBody = options.json !== undefined;
    const response = await fetch(typeof input === "string" ? apiUrl(input) : input, {
        ...options,
        headers: buildHeaders(options.headers, hasJsonBody),
        body: hasJsonBody ? JSON.stringify(options.json) : options.body,
        credentials: "include"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }
    return data;
}
