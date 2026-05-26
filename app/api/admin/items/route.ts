import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { calculateAmount } from "@/lib/calculations";
import { itemSchema } from "@/lib/validators";
import Item from "@/models/Item";

function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  await dbConnect();
  const items = await Item.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid item" }, { status: 400 });
    }

    await dbConnect();
    const created = await Item.create({
      ...parsed.data,
      amount: calculateAmount(parsed.data.quantity, parsed.data.rate)
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to create item" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const rawItems: Array<{ id?: unknown; name?: unknown; quantity?: unknown; rate?: unknown } | null | undefined> = Array.isArray(body.items)
      ? body.items
      : [];
    for (const item of rawItems) {
      if (typeof item?.name !== "string" || item.name.trim() === "") {
        return NextResponse.json({ message: "Item name is required" }, { status: 400 });
      }
      if (item?.quantity === "" || item?.quantity === null || item?.quantity === undefined) {
        return NextResponse.json({ message: "Quantity is required" }, { status: 400 });
      }
      if (item?.rate === "" || item?.rate === null || item?.rate === undefined) {
        return NextResponse.json({ message: "Rate is required" }, { status: 400 });
      }
    }

    const normalized = rawItems.map((item) => ({
      id: typeof item?.id === "string" ? item.id : undefined,
      name: String(item?.name).trim(),
      quantity: Number(item?.quantity),
      rate: Number(item?.rate)
    }));

    const validation = normalized.map((item) => itemSchema.safeParse(item));
    const firstInvalid = validation.find((result) => !result.success);
    if (firstInvalid && !firstInvalid.success) {
      return NextResponse.json({ message: firstInvalid.error.issues[0]?.message ?? "Invalid item list" }, { status: 400 });
    }

    await dbConnect();
    const keepIds: string[] = [];
    const items = [];

    for (const item of normalized) {
      const amount = calculateAmount(item.quantity, item.rate);
      if (item.id) {
        const updated = await Item.findByIdAndUpdate(
          item.id,
          { name: item.name, quantity: item.quantity, rate: item.rate, amount },
          { new: true, runValidators: true }
        );
        if (updated) {
          keepIds.push(String(updated._id));
          items.push(updated);
        }
      } else {
        const created = await Item.create({ name: item.name, quantity: item.quantity, rate: item.rate, amount });
        keepIds.push(String(created._id));
        items.push(created);
      }
    }

    await Item.deleteMany({ _id: { $nin: keepIds } });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: "Failed to save items" }, { status: 500 });
  }
}
