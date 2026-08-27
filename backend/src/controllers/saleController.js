import mongoose from "mongoose";
import Item from "../models/Item.js";
import Table from "../models/Table.js";
import Sale from "../models/Sale.js";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { calculateAmount } from "../lib/calculations.js";
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
export async function getSales(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await dbConnect();
        const productName = readQueryString(req.query.productName);
        const filter = productName ? { productName } : {};
        const sales = await Sale.find(filter).sort({ createdAt: -1 }).lean();
        return res.json({ sales });
    }
    catch {
        return res.status(500).json({ message: "Failed to fetch sales" });
    }
}
export async function getSaleStock(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user"))
        return forbidden(res);
    try {
        await dbConnect();
        const productName = readQueryString(req.query.productName);
        if (!productName) {
            return res.status(400).json({ message: "Product name is required" });
        }
        const table = await Table.findOne({ name: productName }).lean();
        if (!table) {
            return res.status(404).json({ message: "Product not found" });
        }
        const packSizes = Array.isArray(table.packSizes) ? table.packSizes : [];
        return res.json({
            productName: table.name,
            ratePerKg: Number(table.ratePerKg ?? 0),
            packSizes: packSizes.map((entry) => ({
                packSize: entry.packSize,
                availableQuantity: entry.availableQuantity
            }))
        });
    }
    catch {
        return res.status(500).json({ message: "Unable to load inventory. Please try again." });
    }
}
export async function createSale(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user"))
        return forbidden(res);
    try {
        await dbConnect();
        const productName = typeof req.body?.productName === "string" ? req.body.productName.trim() : "";
        const quantity = Number(req.body?.quantity);
        const packSize = req.body?.packSize !== undefined && req.body?.packSize !== null ? Number(req.body?.packSize) : null;
        if (!productName) {
            return res.status(400).json({ message: "Product name is required" });
        }
        if (Number.isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: "Quantity must be a positive number" });
        }
        const items = await Item.find({ tableName: productName }).lean();
        if (items.length === 0) {
            return res.status(400).json({ message: "Invalid product" });
        }
        const table = await Table.findOne({ name: productName }).lean();
        if (!table) {
            return res.status(404).json({ message: "Product not found" });
        }
        const rate = Number(table.ratePerKg ?? 0);
        if (rate <= 0) {
            return res.status(400).json({ message: "Product rate has not been set by admin" });
        }
        const packSizes = Array.isArray(table.packSizes) ? table.packSizes : [];
        let selectedPackSize;
        if (packSize !== null) {
            selectedPackSize = packSizes.find((entry) => entry.packSize === packSize);
        }
        else {
            selectedPackSize = packSizes[0];
        }
        if (!selectedPackSize) {
            return res.status(400).json({ message: "No pack size available for this product" });
        }
        const availableQuantity = Number(selectedPackSize.availableQuantity ?? 0);
        if (quantity > availableQuantity) {
            return res.status(400).json({
                message: `Insufficient available quantity. Only ${availableQuantity} KG is available.`,
                availableQuantity
            });
        }
        const amount = calculateAmount(quantity, rate);
        const sale = await Sale.create({
            productName,
            quantity,
            rate,
            amount,
            packSize: selectedPackSize.packSize,
            dispatchStatus: "pending",
            createdBy: auth.email ?? ""
        });
        return res.status(201).json({ sale });
    }
    catch {
        return res.status(500).json({ message: "Failed to save sale" });
    }
}
export async function dispatchSale(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user"))
        return forbidden(res);
    const session = await mongoose.startSession();
    try {
        await dbConnect();
        const saleId = typeof req.params.id === "string" ? req.params.id.trim() : "";
        if (!saleId || !mongoose.isValidObjectId(saleId)) {
            return res.status(400).json({ message: "Invalid sale ID" });
        }
        let sale;
        let stockError = null;
        await session.withTransaction(async () => {
            sale = await Sale.findById(saleId).session(session);
            if (!sale) {
                stockError = { status: 404, message: "Sale not found" };
                return;
            }
            if (sale.dispatchStatus !== "pending") {
                stockError = { status: 400, message: "Sale is already dispatched" };
                return;
            }
            const result = await Table.updateOne(
                {
                    name: sale.productName,
                    "packSizes.packSize": sale.packSize,
                    "packSizes.availableQuantity": { $gte: sale.quantity }
                },
                {
                    $inc: { "packSizes.$.availableQuantity": -sale.quantity }
                },
                { session }
            );
            if (result.matchedCount === 0 || result.modifiedCount === 0) {
                const currentTable = await Table.findOne({ name: sale.productName, "packSizes.packSize": sale.packSize }).lean();
                const packSizeEntry = currentTable?.packSizes?.find((p) => p.packSize === sale.packSize);
                const available = packSizeEntry?.availableQuantity ?? 0;
                stockError = {
                    status: 400,
                    message: `Insufficient stock to dispatch. Only ${available} KG is available.`,
                    availableQuantity: available
                };
                return;
            }
            await Sale.updateOne(
                { _id: sale._id },
                { $set: { dispatchStatus: "dispatched" } },
                { session }
            );
            sale.dispatchStatus = "dispatched";
        });
        if (stockError) {
            return res.status(stockError.status).json({
                success: false,
                message: stockError.message,
                availableQuantity: stockError.availableQuantity
            });
        }
        return res.json({ sale });
    }
    catch {
        return res.status(500).json({ message: "Failed to dispatch sale" });
    }
    finally {
        await session.endSession();
    }
}
