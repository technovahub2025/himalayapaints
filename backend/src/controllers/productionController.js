import mongoose from "mongoose";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { getProductNameVariants } from "../lib/product-label.js";
import { productionBatchSchema } from "../lib/validators.js";
import ProductionBatch from "../models/ProductionBatch.js";
import StockMovement from "../models/StockMovement.js";
function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}
function readQueryString(value) {
    if (Array.isArray(value)) {
        return String(value[0] ?? "").trim();
    }
    if (typeof value === "string") {
        return value.trim();
    }
    return "";
}
function resolveActualQty(stdQty, actualQty) {
    return typeof actualQty === "number" && !Number.isNaN(actualQty) ? actualQty : stdQty;
}
export async function getProductionBatches(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth)
        return res.status(401).json({ message: "Unauthorized" });
    await dbConnect();
    const productName = readQueryString(req.query.productName);
    const productNameVariants = getProductNameVariants(productName);
    const filter = productNameVariants.length > 0 ? { productName: { $in: productNameVariants } } : {};
    const batches = await ProductionBatch.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ batches });
}
export async function createProductionBatch(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user"))
        return forbidden(res);
    const session = await mongoose.startSession();
    try {
        const parsed = productionBatchSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid production batch" });
        }
        await dbConnect();
        let createdBatch = null;
        await session.withTransaction(async () => {
            const [batch] = await ProductionBatch.create([{
                productName: parsed.data.productName,
                batchNo: parsed.data.batchNo || "",
                batchSize: parsed.data.batchSize || "",
                specificGravity: parsed.data.specificGravity || "",
                viscosity: parsed.data.viscosity || "",
                targetKg: parsed.data.targetKg,
                actualKg: parsed.data.actualKg ?? parsed.data.targetKg,
                createdBy: parsed.data.createdBy || auth.email,
                packRows: Array.isArray(parsed.data.packRows)
                    ? parsed.data.packRows.map((row) => ({
                        packSize: row.packSize || "",
                        quantity: row.quantity || ""
                    }))
                    : [],
                lines: parsed.data.lines.map((line) => ({
                    itemId: line.itemId || "",
                    materialName: line.materialName,
                    percentage: line.percentage,
                    stdQty: line.stdQty,
                    actualQty: resolveActualQty(line.stdQty, line.actualQty),
                    remarks: line.remarks || "",
                    signature: line.signature || ""
                }))
            }], { session });
            createdBatch = batch;
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
                    .session(session)
                    .lean();
                const balanceBefore = previous?.balanceAfter ?? 0;
                const quantityDelta = -actualQty;
                const balanceAfter = balanceBefore + quantityDelta;
                await StockMovement.create([{
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
                    }], { session });
            }
        });
        return res.status(201).json({ batch: createdBatch });
    }
    catch {
        return res.status(500).json({ message: "Failed to record production batch" });
    }
    finally {
        await session.endSession();
    }
}
