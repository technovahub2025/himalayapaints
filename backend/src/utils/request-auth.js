import { verifyToken } from "../lib/auth.js";
export async function getAuthFromRequest(request) {
    const token = request.cookies?.auth_token;
    if (!token)
        return null;
    try {
        return await verifyToken(token);
    }
    catch {
        return null;
    }
}
