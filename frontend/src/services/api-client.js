function buildHeaders(headers, hasJsonBody) {
    const nextHeaders = new Headers(headers);
    if (hasJsonBody && !nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
    }
    return nextHeaders;
}
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
function resolveApiUrl(input) {
    if (typeof input !== "string") {
        return input;
    }
    if (/^https?:\/\//i.test(input)) {
        return input;
    }
    if (apiBaseUrl && input.startsWith("/api/")) {
        return `${apiBaseUrl}${input}`;
    }
    return input;
}
export async function apiRequest(input, options = {}) {
    return fetch(resolveApiUrl(input), {
        ...options,
        headers: buildHeaders(options.headers, options.json !== undefined),
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        credentials: "include"
    });
}
export async function apiFetch(input, options = {}) {
    const response = await fetch(resolveApiUrl(input), {
        ...options,
        headers: buildHeaders(options.headers, options.json !== undefined),
        body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
        credentials: "include"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }
    return data;
}
