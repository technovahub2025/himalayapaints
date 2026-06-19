function buildHeaders(headers, hasJsonBody) {
    const nextHeaders = new Headers(headers);
    if (hasJsonBody && !nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
    }
    return nextHeaders;
}
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const isProductionBuild = import.meta.env.PROD;
const rawFetch = globalThis.fetch?.bind(globalThis);
function resolveApiUrl(input) {
    if (typeof input !== "string") {
        return input;
    }
    if (/^https?:\/\//i.test(input)) {
        return input;
    }
    if (!isProductionBuild && apiBaseUrl && input.startsWith("/api/")) {
        return `${apiBaseUrl}${input}`;
    }
    return input;
}
function withApiDefaults(input, options = {}) {
    if (typeof input === "string" && input.startsWith("/api/")) {
        return {
            input: resolveApiUrl(input),
            options: {
                ...options,
                headers: buildHeaders(options.headers, options.json !== undefined),
                body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
                credentials: "include"
            }
        };
    }
    return { input, options };
}
export function installApiFetchProxy() {
    if (typeof window === "undefined" || typeof rawFetch !== "function") {
        return;
    }
    window.fetch = (input, options) => {
        const request = withApiDefaults(input, options);
        return rawFetch(request.input, request.options);
    };
}
export async function apiRequest(input, options = {}) {
    if (typeof rawFetch !== "function") {
        throw new Error("Fetch is not available in this environment");
    }
    const request = withApiDefaults(input, options);
    return rawFetch(request.input, request.options);
}
export async function apiFetch(input, options = {}) {
    const response = await apiRequest(input, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }
    return data;
}
