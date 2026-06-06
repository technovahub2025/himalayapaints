import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";
import { verifyToken } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { UserDashboard } from "@/components/user/user-dashboard";
import User from "@/models/User";
import Item from "@/models/Item";
import Table from "@/models/Table";

type PageProps = {
  searchParams?: Promise<{ tableName?: string | string[] }>;
};

function normalizeTableName(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || "";
  return value?.trim() || "";
}

export default async function UserPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) redirect("/login");

  const auth = await verifyToken(token).catch(() => null);
  if (!auth || (auth.role !== "user" && auth.role !== "admin")) redirect("/login");

  await dbConnect();
  await ensureSeedData();
  const resolvedSearchParams = (await searchParams) ?? {};
  const existingTables = (await Table.find().sort({ createdAt: 1 }).lean()).map((table) => table.name);
  const selectedTableName = normalizeTableName(resolvedSearchParams.tableName) || existingTables[0] || "Table 1";

  const [user, items] = await Promise.all([
    User.findById(auth.userId).lean(),
    Item.find({ tableName: selectedTableName }).sort({ createdAt: 1 }).lean()
  ]);

  const tableNames = Array.from(new Set([selectedTableName, ...existingTables])).sort();
  const serializableItems = items.map((item) => ({
    _id: String(item._id),
    tableName: item.tableName ?? selectedTableName,
    name: item.name,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount
  }));

  return (
    <AppShell role={auth.role} email={user?.email}>
      <UserDashboard email={user?.email} initialItems={serializableItems} initialTableName={selectedTableName} tableNames={tableNames} />
    </AppShell>
  );
}
