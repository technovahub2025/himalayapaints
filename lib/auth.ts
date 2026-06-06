import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

function getSecret() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not set in the environment.");
  }
  return new TextEncoder().encode(jwtSecret);
}

export type AuthRole = "admin" | "user";

export type AuthPayload = {
  userId: string;
  email: string;
  role: AuthRole;
};

export async function signToken(payload: AuthPayload) {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    userId: payload.sub as string,
    email: payload.email as string,
    role: payload.role as AuthRole
  };
}

export function getTokenFromRequest(request: NextRequest) {
  return request.cookies.get("auth_token")?.value ?? "";
}

export async function getAuthFromRequest(request: NextRequest) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}
