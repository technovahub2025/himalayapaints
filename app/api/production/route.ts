import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getAuthFromRequest } from "@/lib/auth";
import { getProductNameVariants } from "@/lib/product-label";
import { productionBatchSchema } from "@/lib/validators";
import ProductionBatch from "@/models/ProductionBatch";
import StockMovement from "@/models/StockMovement";

function forbidden() {
  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

function resolveActualQty(stdQty: number, actualQty?: number) {
  return typeof actualQty === "number" && !Number.isNaN(actualQty) ? actualQty : stdQty;
}

export async function GET(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const productName = searchParams.get("productName")?.trim() || "";
  const productNameVariants = getProductNameVariants(productName);
  const filter = productNameVariants.length > 0 ? { productName: { $in: productNameVariants } } : {};
  const batches = await ProductionBatch.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ batches });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthFromRequest(request);
  if (!auth || (auth.role !== "admin" && auth.role !== "user")) return forbidden();

  try {
    const body = await request.json();
    const parsed = productionBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid production batch" }, { status: 400 });
    }

    await dbConnect();

    const batch = await ProductionBatch.create({
      productName: parsed.data.productName,
      batchNo: parsed.data.batchNo || "",
      batchSize: parsed.data.batchSize || "",
      specificGravity: parsed.data.specificGravity || "",
      viscosity: parsed.data.viscosity || "",
      targetKg: parsed.data.targetKg,
      actualKg: parsed.data.actualKg ?? parsed.data.targetKg,
      createdBy: parsed.data.createdBy || auth.email,
      lines: parsed.data.lines.map((line) => ({
        itemId: line.itemId || "",
        materialName: line.materialName,
        percentage: line.percentage,
        stdQty: line.stdQty,
        actualQty: resolveActualQty(line.stdQty, line.actualQty),
        remarks: line.remarks || "",
        signature: line.signature || ""
      }))
    });

    for (const line of parsed.data.lines) {
      const actualQty = resolveActualQty(line.stdQty, line.actualQty);
      if (actualQty <= 0) {
        continue;
      }

      const previous = await StockMovement.findOne({
        productName: parsed.data.productName,
        materialName: line.materialName
      })
        .sort({ createdAt: -1 })
        .lean();

      const balanceBefore = previous?.balanceAfter ?? 0;
      const quantityDelta = -actualQty;
      const balanceAfter = balanceBefore + quantityDelta;

      await StockMovement.create({
        productName: parsed.data.productName,
        materialName: line.materialName,
        movementType: "out",
        quantity: actualQty,
        quantityDelta,
        unit: "KG",
        balanceBefore,
        balanceAfter,
        referenceType: "production",
        referenceId: String(batch._id),
        batchNo: parsed.data.batchNo || "",
        notes: line.remarks || "",
        createdBy: auth.email
      });
    }

    return NextResponse.json({ batch }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Failed to record production batch" }, { status: 500 });
  }
}
