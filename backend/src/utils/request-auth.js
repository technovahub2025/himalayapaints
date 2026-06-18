import { verifyToken } from "../lib/auth.js";

function getTokenFromAuthorizationHeader(authorizationHeader = "") {
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

export async function getAuthFromRequest(request) {
    const token = request.cookies?.auth_token || getTokenFromAuthorizationHeader(request.headers?.authorization);
    if (!token)
        return null;
    try {
        return await verifyToken(token);
    }
    catch {
        return null;
    }
}
