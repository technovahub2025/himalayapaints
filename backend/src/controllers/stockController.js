import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { getProductNameVariants } from "../lib/product-label.js";
import { stockMovementSchema } from "../lib/validators.js";
import StockMovement from "../models/StockMovement.js";
function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}
function normalizeProductName(value) {
    return value?.trim() || "";
}
function resolveDelta(movementType, quantity, adjustmentDirection) {
    if (movementType === "in")
        return quantity;
    if (movementType === "out")
        return -quantity;
    return adjustmentDirection === "decrease" ? -quantity : quantity;
}
export async function getStock(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth)
        return res.status(401).json({ message: "Unauthorized" });
    await dbConnect();
    const productName = normalizeProductName(req.query.productName ?? req.query.tableName);
    const productNameVariants = getProductNameVariants(productName);
    const filter = productNameVariants.length > 0 ? { productName: { $in: productNameVariants } } : {};
    const movements = await StockMovement.find(filter).sort({ createdAt: 1 }).lean();
    const balances = new Map();
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
    return res.json({
        balances: Array.from(balances.values()).sort((a, b) => {
            const productCompare = a.productName.localeCompare(b.productName);
            if (productCompare !== 0)
                return productCompare;
            return a.materialName.localeCompare(b.materialName);
        }),
        movements: movements.slice(-100)
    });
}
export async function createStockMovement(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const parsed = stockMovementSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid stock movement" });
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
        return res.status(201).json({ movement: created });
    }
    catch {
        return res.status(500).json({ message: "Failed to record stock movement" });
    }
}
