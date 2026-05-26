import type { AuthRole } from "@/lib/auth";

export function roleRedirectPath(role: AuthRole) {
  return role === "admin" ? "/admin" : "/user";
}
