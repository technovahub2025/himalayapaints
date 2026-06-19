function buildHeaders(headers, hasJsonBody) {
    const nextHeaders = new Headers(headers);
    if (hasJsonBody && !nextHeaders.has("Content-Type")) {
        nextHeaders.set("Content-Type", "application/json");
    }
    return nextHeaders;
}
export async function apiFetch(input, options = {}) {
    const hasJsonBody = options.json !== undefined;
    const response = await fetch(input, {
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
