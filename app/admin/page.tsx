import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";
import { verifyToken } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import User from "@/models/User";
import Item from "@/models/Item";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login");

  const auth = await verifyToken(token).catch(() => null);
  if (!auth || auth.role !== "admin") redirect("/login");

  await dbConnect();
  await ensureSeedData();

  const [user, items] = await Promise.all([
    User.findById(auth.userId).lean(),
    Item.find().sort({ createdAt: 1 }).lean()
  ]);

  const serializableItems = items.map((item) => ({
    _id: String(item._id),
    name: item.name,
    quantity: item.quantity,
    rate: item.rate
  }));

  return (
    <AppShell role="admin" email={user?.email}>
      <AdminDashboard initialItems={serializableItems} />
    </AppShell>
  );
}
