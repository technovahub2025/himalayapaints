import { SignJWT, jwtVerify } from "jose";
function getSecret() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET is not set in the environment.");
    }
    return new TextEncoder().encode(jwtSecret);
}
export async function signToken(payload) {
    return new SignJWT({ email: payload.email, role: payload.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.userId)
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(getSecret());
}
export async function verifyToken(token) {
    const { payload } = await jwtVerify(token, getSecret());
    return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role
    };
}
export function getTokenFromCookieHeader(cookieHeader = "") {
    const tokenMatch = cookieHeader
        .split(";")
        .map((pair) => pair.trim())
        .find((pair) => pair.startsWith("auth_token="));
    return tokenMatch ? decodeURIComponent(tokenMatch.slice("auth_token=".length)) : "";
}
export async function getAuthFromCookieHeader(cookieHeader = "") {
    const token = getTokenFromCookieHeader(cookieHeader);
    if (!token)
        return null;
    try {
        return await verifyToken(token);
    }
    catch {
        return null;
    }
}
