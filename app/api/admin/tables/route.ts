import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import Item from "@/models/Item";
import Table from "@/models/Table";

function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

async function getTableSummaries() {
  const [tables, counts] = await Promise.all([
    Table.find().sort({ createdAt: 1 }).lean(),
    Item.aggregate([{ $group: { _id: "$tableName", count: { $sum: 1 } } }])
  ]);

  const countMap = new Map((counts as Array<{ _id: string; count: number }>).map((entry) => [entry._id, entry.count]));
  return tables.map((table) => ({
    name: table.name,
    count: countMap.get(table.name) ?? 0
  }));
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  await dbConnect();
  return NextResponse.json({ tables: await getTableSummaries() });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const duplicateFrom = typeof body.duplicateFrom === "string" ? body.duplicateFrom.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Table name is required" }, { status: 400 });
    }

    await dbConnect();
    const existing = await Table.findOne({ name }).lean();
    if (existing) {
      return NextResponse.json({ message: "Table already exists" }, { status: 409 });
    }

    const created = await Table.create({ name });

    if (duplicateFrom) {
      const sourceItems = await Item.find({ tableName: duplicateFrom }).lean();
      if (sourceItems.length === 0) {
        await Table.findByIdAndDelete(created._id);
        return NextResponse.json({ message: "Source table not found or has no rows" }, { status: 404 });
      }

      await Item.insertMany(
        sourceItems.map((item) => ({
          tableName: name,
          name: item.name,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount
        }))
      );
    }

    return NextResponse.json({ table: { name: created.name, count: 0 }, tables: await getTableSummaries() }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create table" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const fromName = typeof body.fromName === "string" ? body.fromName.trim() : "";
    const toName = typeof body.toName === "string" ? body.toName.trim() : "";

    if (!fromName || !toName) {
      return NextResponse.json({ message: "Both old and new table names are required" }, { status: 400 });
    }
    if (fromName === toName) {
      return NextResponse.json({ message: "Table name is unchanged" }, { status: 400 });
    }

    await dbConnect();
    const current = await Table.findOne({ name: fromName });
    if (!current) return NextResponse.json({ message: "Table not found" }, { status: 404 });

    const duplicate = await Table.findOne({ name: toName }).lean();
    if (duplicate) {
      return NextResponse.json({ message: "Another table already uses that name" }, { status: 409 });
    }

    await Table.findByIdAndUpdate(current._id, { name: toName }, { new: true, runValidators: true });
    await Item.updateMany({ tableName: fromName }, { $set: { tableName: toName } });

    return NextResponse.json({ tables: await getTableSummaries(), renamedTo: toName });
  } catch {
    return NextResponse.json({ message: "Failed to rename table" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ message: "Table name is required" }, { status: 400 });
    }

    await dbConnect();
    const deleted = await Table.findOneAndDelete({ name });
    if (!deleted) {
      return NextResponse.json({ message: "Table not found" }, { status: 404 });
    }

    await Item.deleteMany({ tableName: name });

    return NextResponse.json({ tables: await getTableSummaries(), deletedName: name });
  } catch {
    return NextResponse.json({ message: "Failed to delete table" }, { status: 500 });
  }
}
