import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getProductNameVariants } from "@/lib/product-label";
import { stockMovementSchema } from "@/lib/validators";
import StockMovement from "@/models/StockMovement";

function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

function normalizeProductName(value: string | null) {
  return value?.trim() || "";
}

function resolveDelta(movementType: "in" | "out" | "adjustment", quantity: number, adjustmentDirection?: "increase" | "decrease") {
  if (movementType === "in") return quantity;
  if (movementType === "out") return -quantity;
  return adjustmentDirection === "decrease" ? -quantity : quantity;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const productName = normalizeProductName(searchParams.get("productName") ?? searchParams.get("tableName"));
  const productNameVariants = getProductNameVariants(productName);
  const filter = productNameVariants.length > 0 ? { productName: { $in: productNameVariants } } : {};
  const movements = await StockMovement.find(filter).sort({ createdAt: 1 }).lean();

  const balances = new Map<
    string,
    {
      productName: string;
      materialName: string;
      unit: string;
      balance: number;
      latestMovementAt: string;
      latestReferenceType: string;
      latestBatchNo: string;
    }
  >();

  for (const movement of movements) {
    const key = `${movement.productName}::${movement.materialName}`;
    balances.set(key, {
      productName: movement.productName,
      materialName: movement.materialName,
      unit: movement.unit,
      balance: movement.balanceAfter,
      latestMovementAt: movement.createdAt.toISOString(),
      latestReferenceType: movement.referenceType ?? "",
      latestBatchNo: movement.batchNo ?? ""
    });
  }

  return NextResponse.json({
    balances: Array.from(balances.values()).sort((a, b) => {
      const productCompare = a.productName.localeCompare(b.productName);
      if (productCompare !== 0) return productCompare;
      return a.materialName.localeCompare(b.materialName);
    }),
    movements: movements.slice(-100)
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || auth.role !== "admin") return forbidden();

  try {
    const body = await request.json();
    const parsed = stockMovementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid stock movement" }, { status: 400 });
    }

    await dbConnect();
    const previous = await StockMovement.findOne({
      productName: parsed.data.productName,
      materialName: parsed.data.materialName
    })
      .sort({ createdAt: -1 })
      .lean();

    const balanceBefore = previous?.balanceAfter ?? 0;
    const quantityDelta = resolveDelta(parsed.data.movementType, parsed.data.quantity, parsed.data.adjustmentDirection);
    const balanceAfter = balanceBefore + quantityDelta;

    const created = await StockMovement.create({
      productName: parsed.data.productName,
      materialName: parsed.data.materialName,
      movementType: parsed.data.movementType,
      quantity: parsed.data.quantity,
      quantityDelta,
      unit: parsed.data.unit || "KG",
      balanceBefore,
      balanceAfter,
      referenceType: parsed.data.referenceType || "manual",
      referenceId: parsed.data.referenceId || "",
      batchNo: parsed.data.batchNo || "",
      notes: parsed.data.notes || "",
      createdBy: parsed.data.createdBy || auth.email
    });

    return NextResponse.json({ movement: created }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to record stock movement" }, { status: 500 });
  }
}
