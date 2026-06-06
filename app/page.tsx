import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { roleRedirectPath } from "@/lib/routes";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login");

  const payload = await verifyToken(token).catch(() => null);
  if (!payload) redirect("/login");

  redirect(roleRedirectPath(payload.role));
}
