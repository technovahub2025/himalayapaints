import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";
import { verifyToken } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { TrackingDashboard } from "@/components/tracking/tracking-dashboard";
import User from "@/models/User";

export default async function TrackingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login");

  const auth = await verifyToken(token).catch(() => null);
  if (!auth || (auth.role !== "admin" && auth.role !== "user")) redirect("/login");

  await dbConnect();
  await ensureSeedData();
  const user = await User.findById(auth.userId).lean();

  return (
    <AppShell role={auth.role} email={user?.email}>
      <TrackingDashboard email={user?.email} role={auth.role} />
    </AppShell>
  );
}
