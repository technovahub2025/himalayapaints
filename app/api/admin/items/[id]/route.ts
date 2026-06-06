import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { calculateAmount } from "@/lib/calculations";
import { itemUpdateSchema } from "@/lib/validators";
import Item from "@/models/Item";
import Table from "@/models/Table";

function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = itemUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid item" }, { status: 400 });
    }

    await dbConnect();
    const update = parsed.data;
    const payload: Record<string, unknown> = {};
    const current = await Item.findById(id);
    const tableName = typeof body.tableName === "string" ? body.tableName.trim() : current?.tableName ?? "Table 1";

    if (typeof update.name === "string") payload.name = update.name.trim();
    if (typeof update.quantity === "number") payload.quantity = update.quantity;
    if (typeof update.rate === "number") payload.rate = update.rate;
    payload.tableName = tableName;
    await Table.updateOne({ name: tableName }, { $set: { name: tableName } }, { upsert: true });
    if (typeof update.quantity === "number" || typeof update.rate === "number") {
      const quantity = typeof update.quantity === "number" ? update.quantity : current?.quantity ?? 0;
      const rate = typeof update.rate === "number" ? update.rate : current?.rate ?? 0;
      payload.amount = calculateAmount(quantity, rate);
    }

    const updated = await Item.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!updated) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ message: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const { id } = await context.params;
    await dbConnect();
    const deleted = await Item.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ message: "Item not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Failed to delete item" }, { status: 500 });
  }
}
