import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import Item from "@/models/Item";
import Table from "@/models/Table";

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const tableName = searchParams.get("tableName")?.trim() || "Table 1";
  const items = await Item.find({ tableName }).sort({ createdAt: 1 }).lean();
  const tables = await Table.find().sort({ createdAt: 1 }).lean();
  const tableNames = Array.from(new Set([tableName, ...tables.map((table) => table.name).filter(Boolean)])).sort();
  return NextResponse.json({ items, tables: tableNames });
}
