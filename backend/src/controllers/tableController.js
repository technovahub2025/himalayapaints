import Item from "../models/Item.js";
import Table from "../models/Table.js";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { isSameProductLabel } from "../lib/product-label.js";
function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}
const DUPLICATE_PRODUCT_MESSAGE = "A product with this name already exists. Please choose a different product name.";
async function getTableSummaries() {
    const [tables, counts] = await Promise.all([
        Table.find().sort({ createdAt: 1 }).lean(),
        Item.aggregate([{ $group: { _id: "$tableName", count: { $sum: 1 } } }])
    ]);
    const countMap = new Map(counts.map((entry) => [entry._id, entry.count]));
    return tables.map((table) => ({
        name: table.name,
        count: countMap.get(table.name) ?? 0
    }));
}
async function hasProductNameConflict(candidateName, ignoreName) {
    const tables = await Table.find().select("name").lean();
    return tables.some((table) => {
        if (ignoreName && isSameProductLabel(table.name, ignoreName)) {
            return false;
        }
        return isSameProductLabel(table.name, candidateName);
    });
}
export async function getTables(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    await dbConnect();
    return res.json({ tables: await getTableSummaries() });
}
export async function createTable(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const duplicateFrom = typeof req.body.duplicateFrom === "string" ? req.body.duplicateFrom.trim() : "";
        if (!name) {
            return res.status(400).json({ message: "Table name is required" });
        }
        await dbConnect();
        if (await hasProductNameConflict(name)) {
            return res.status(409).json({ message: DUPLICATE_PRODUCT_MESSAGE });
        }
        const created = await Table.create({ name });
        if (duplicateFrom) {
            const sourceItems = await Item.find({ tableName: duplicateFrom }).lean();
            if (sourceItems.length === 0) {
                await Table.findByIdAndDelete(created._id);
                return res.status(404).json({ message: "Source table not found or has no rows" });
            }
            await Item.insertMany(sourceItems.map((item) => ({
                tableName: name,
                code: item.code ?? "",
                name: item.name,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.amount
            })));
        }
        return res.status(201).json({ table: { name: created.name, count: 0 }, tables: await getTableSummaries() });
    }
    catch {
        return res.status(500).json({ message: "Failed to create table" });
    }
}
export async function renameTable(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const fromName = typeof req.body.fromName === "string" ? req.body.fromName.trim() : "";
        const toName = typeof req.body.toName === "string" ? req.body.toName.trim() : "";
        if (!fromName || !toName) {
            return res.status(400).json({ message: "Both old and new table names are required" });
        }
        if (fromName === toName) {
            return res.status(400).json({ message: "Table name is unchanged" });
        }
        await dbConnect();
        const current = await Table.findOne({ name: fromName });
        if (!current)
            return res.status(404).json({ message: "Table not found" });
        if (await hasProductNameConflict(toName, fromName)) {
            return res.status(409).json({ message: DUPLICATE_PRODUCT_MESSAGE });
        }
        await Table.findByIdAndUpdate(current._id, { name: toName }, { new: true, runValidators: true });
        await Item.updateMany({ tableName: fromName }, { $set: { tableName: toName } });
        return res.json({ tables: await getTableSummaries(), renamedTo: toName });
    }
    catch {
        return res.status(500).json({ message: "Failed to rename table" });
    }
}
export async function deleteTable(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!name) {
            return res.status(400).json({ message: "Table name is required" });
        }
        await dbConnect();
        const deleted = await Table.findOneAndDelete({ name });
        if (!deleted) {
            return res.status(404).json({ message: "Table not found" });
        }
        await Item.deleteMany({ tableName: name });
        return res.json({ tables: await getTableSummaries(), deletedName: name });
    }
    catch {
        return res.status(500).json({ message: "Failed to delete table" });
    }
}
