import Item from "../models/Item.js";
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
export async function createSale(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user"))
        return forbidden(res);
    try {
        await dbConnect();
        const productName = typeof req.body?.productName === "string" ? req.body.productName.trim() : "";
        const quantity = Number(req.body?.quantity);
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
        const rate = Number(items.reduce((sum, item) => sum + (item.amount ?? 0), 0).toFixed(2));
        if (!Number.isFinite(rate) || rate <= 0) {
            return res.status(400).json({ message: `Product "${productName}" has no valid rate` });
        }
        const amount = calculateAmount(quantity, rate);
        const sale = await Sale.create({
            productName,
            quantity,
            rate,
            amount,
            createdBy: auth.email ?? ""
        });
        return res.status(201).json({ sale });
    }
    catch {
        return res.status(500).json({ message: "Failed to save sale" });
    }
}
