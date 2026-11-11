import Item from "../models/Item.js";
import RawMaterial from "../models/RawMaterial.js";
import Table from "../models/Table.js";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { calculateAmount } from "../lib/calculations.js";
import { itemSchema, itemUpdateSchema } from "../lib/validators.js";
import XLSX from "xlsx";
function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}
function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeCode(value) {
    return String(value ?? "").trim().toLowerCase();
}
function readQueryString(value, fallback = "") {
    if (Array.isArray(value)) {
        return String(value[0] ?? fallback).trim();
    }
    if (typeof value === "string") {
        return value.trim();
    }
    return fallback;
}
async function getRawMaterialByCode(code) {
    const trimmed = String(code ?? "").trim();
    if (!trimmed) {
        return null;
    }
    return RawMaterial.findOne({ code: new RegExp(`^${escapeRegExp(trimmed)}$`, "i") }).lean();
}
export async function getPublicItems(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth)
        return res.status(401).json({ message: "Unauthorized" });
    await dbConnect();
    const tableName = readQueryString(req.query.tableName, "Table 1") || "Table 1";
    const items = await Item.find({ tableName, status: { $ne: "ON_HOLD" } }).sort({ createdAt: 1 }).lean();
    const tables = await Table.find().sort({ createdAt: 1 }).lean();
    const tableNames = Array.from(new Set([tableName, ...tables.map((table) => table.name).filter(Boolean)])).sort();
    const productStock = tables.map((table) => ({
        name: table.name,
        packSizes: Array.isArray(table.packSizes) ? table.packSizes.map((entry) => ({
            packSize: entry.packSize,
            availableQuantity: entry.availableQuantity
        })) : []
    }));
    return res.json({ items, tables: tableNames, productStock });
}
export async function getAdminItems(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    await dbConnect();
    const tableName = readQueryString(req.query.tableName, "Table 1") || "Table 1";
    const items = await Item.find({ tableName }).sort({ createdAt: 1 }).lean();
    const tables = await Table.find().sort({ createdAt: 1 }).lean();
    const tableNames = Array.from(new Set([tableName, ...tables.map((table) => table.name).filter(Boolean)])).sort();
    const productStock = tables.map((table) => ({
        name: table.name,
        packSizes: Array.isArray(table.packSizes) ? table.packSizes.map((entry) => ({
            packSize: entry.packSize,
            availableQuantity: entry.availableQuantity
        })) : []
    }));
    return res.json({ items, tables: tableNames, productStock });
}
export async function createAdminItem(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const parsed = itemSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid item" });
        }
        await dbConnect();
        await Table.updateOne({ name: parsed.data.tableName.trim() }, { $set: { name: parsed.data.tableName.trim() } }, { upsert: true });
        const code = typeof parsed.data.code === "string" ? parsed.data.code.trim() : "";
        const material = await getRawMaterialByCode(code);
        if (!material) {
            return res.status(400).json({ message: "Select a valid raw material code" });
        }
        const created = await Item.create({
            tableName: parsed.data.tableName.trim(),
            code: material.code,
            name: material.name,
            quantity: parsed.data.quantity,
            rate: material.rate,
            amount: calculateAmount(parsed.data.quantity, material.rate)
        });
        return res.status(201).json({ item: created });
    }
    catch {
        return res.status(500).json({ message: "Failed to create item" });
    }
}
export async function saveAdminItems(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const tableName = typeof req.body.tableName === "string" ? req.body.tableName.trim() : "";
        if (!tableName) {
            return res.status(400).json({ message: "Table name is required" });
        }
        const rawItems = Array.isArray(req.body.items)
            ? req.body.items
            : [];
        for (const item of rawItems) {
            if (typeof item?.name !== "string" || item.name.trim() === "") {
                return res.status(400).json({ message: "Item name is required" });
            }
            if (item?.quantity === "" || item?.quantity === null || item?.quantity === undefined) {
                return res.status(400).json({ message: "Quantity is required" });
            }
            if (item?.rate === "" || item?.rate === null || item?.rate === undefined) {
                return res.status(400).json({ message: "Rate is required" });
            }
        }
        const normalized = rawItems.map((item) => ({
            id: typeof item?.id === "string" ? item.id : undefined,
            code: typeof item?.code === "string" && item.code.trim() ? item.code.trim() : "",
            name: String(item?.name).trim(),
            quantity: Number(item?.quantity),
            rate: Number(item?.rate)
        }));
        const validation = normalized.map((item) => itemUpdateSchema.safeParse({ ...item, tableName }));
        const firstInvalid = validation.find((result) => !result.success);
        if (firstInvalid && !firstInvalid.success) {
            return res.status(400).json({ message: firstInvalid.error.issues[0]?.message ?? "Invalid item list" });
        }
        await dbConnect();
        const rawMaterials = await RawMaterial.find().select("code name rate").lean();
        const materialMap = new Map(rawMaterials.map((material) => [normalizeCode(material.code), material]));
        await Table.updateOne({ name: tableName }, { $set: { name: tableName } }, { upsert: true });
        const keepIds = [];
        const items = [];
        for (const item of normalized) {
            const material = materialMap.get(normalizeCode(item.code));
            if (!material) {
                return res.status(400).json({ message: `Select a valid raw material code for ${item.name}` });
            }
            const code = material.code;
            const amount = calculateAmount(item.quantity, material.rate);
            if (item.id) {
                const updated = await Item.findByIdAndUpdate(item.id, { tableName, code, name: material.name, quantity: item.quantity, rate: material.rate, amount }, { new: true, runValidators: true });
                if (updated) {
                    keepIds.push(String(updated._id));
                    items.push(updated);
                }
            }
            else {
                const created = await Item.create({ tableName, code, name: material.name, quantity: item.quantity, rate: material.rate, amount });
                keepIds.push(String(created._id));
                items.push(created);
            }
        }
        await Item.deleteMany({ tableName, _id: { $nin: keepIds } });
        return res.json({ items });
    }
    catch {
        return res.status(500).json({ message: "Failed to save items" });
    }
}
export async function updateAdminItem(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const { id } = req.params;
        const parsed = itemUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid item" });
        }
        await dbConnect();
        const update = parsed.data;
        const payload = {};
        const current = await Item.findById(id);
        if (!current) {
            return res.status(404).json({ message: "Item not found" });
        }
        const tableName = typeof req.body.tableName === "string" ? req.body.tableName.trim() : current.tableName ?? "Table 1";
        const currentCode = current.code?.trim();
        const material = await getRawMaterialByCode(currentCode);
        if (!material) {
            return res.status(400).json({ message: "Saved item must have a valid raw material code" });
        }
        if (typeof update.quantity === "number") {
            payload.quantity = update.quantity;
        }
        payload.code = material.code;
        payload.name = material.name;
        payload.rate = material.rate;
        payload.tableName = tableName;
        await Table.updateOne({ name: tableName }, { $set: { name: tableName } }, { upsert: true });
        const quantity = typeof update.quantity === "number" ? update.quantity : current.quantity ?? 0;
        payload.amount = calculateAmount(quantity, material.rate);
        const updated = await Item.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
        return res.json({ item: updated });
    }
    catch {
        return res.status(500).json({ message: "Failed to update item" });
    }
}
export async function updateAdminItemStatus(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);

    try {
        const { id } = req.params;
        const status = req.body?.status;

        if (!["ACTIVE", "ON_HOLD"].includes(status)) {
            return res.status(400).json({ message: "Invalid item status" });
        }

        await dbConnect();

        const updated = await Item.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Item not found" });
        }

        return res.json({ item: updated });
    }
    catch {
        return res.status(500).json({ message: "Failed to update item status" });
    }
}
export async function deleteAdminItem(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const { id } = req.params;
        await dbConnect();
        const deleted = await Item.findByIdAndDelete(id);
        if (!deleted)
            return res.status(404).json({ message: "Item not found" });
        return res.json({ ok: true });
    }
    catch {
        return res.status(500).json({ message: "Failed to delete item" });
    }
}



export async function importAdminItems(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin") {
        return forbidden(res);
    }

    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Please upload an Excel or CSV file (.xlsx, .xls, or .csv)."
            });
        }

        const extension = String(req.file.originalname ?? "")
            .split(".").pop().toLowerCase();

        if (!["xlsx", "xls", "csv"].includes(extension)) {
            return res.status(400).json({
                message: "Unsupported file format. Use .xlsx, .xls, or .csv."
            });
        }

        const tableName = String(req.body?.tableName ?? "").trim();

        if (!tableName) {
            return res.status(400).json({
                message: "Please select a product table before importing."
            });
        }

        await dbConnect();

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
            return res.status(400).json({ message: "The uploaded file is empty." });
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
            raw: false
        });

        if (!rows.length) {
            return res.status(400).json({
                message: "No data rows found in the first worksheet."
            });
        }

        const normalizeHeader = (value) =>
            String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

        const headers = Object.keys(rows[0] ?? {});
        const codeHeader = headers.find((header) =>
            ["code", "rawmaterialcode", "materialcode"].includes(normalizeHeader(header))
        );
        const quantityHeader = headers.find((header) =>
            ["quantity", "qty", "formulaquantity"].includes(normalizeHeader(header))
        );

        if (!codeHeader || !quantityHeader) {
            return res.status(400).json({
                message: 'Excel must contain "Code" and "Quantity" columns.'
            });
        }

        const [materials, existingItems] = await Promise.all([
            RawMaterial.find({}).lean(),
            Item.find({ tableName }).lean()
        ]);

        const materialMap = new Map(
            materials.map((material) => [normalizeCode(material.code), material])
        );

        const existingMap = new Map(
            existingItems.map((item) => [normalizeCode(item.code), item])
        );

        const seenCodes = new Set();
        const errors = [];
        let imported = 0;
        let updated = 0;

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const excelRow = index + 2;
            const code = String(row[codeHeader] ?? "").trim();
            const quantityText = String(row[quantityHeader] ?? "").trim();

            if (!code && !quantityText) {
                continue;
            }

            const normalized = normalizeCode(code);

            if (!normalized) {
                errors.push({ row: excelRow, code, message: "Code is required." });
                continue;
            }

            if (seenCodes.has(normalized)) {
                errors.push({
                    row: excelRow,
                    code,
                    message: "Duplicate code in uploaded file."
                });
                continue;
            }

            seenCodes.add(normalized);

            if (!quantityText) {
                errors.push({
                    row: excelRow,
                    code,
                    message: "Quantity is required."
                });
                continue;
            }

            const quantity = Number(quantityText);

            if (!Number.isFinite(quantity) || quantity < 0) {
                errors.push({
                    row: excelRow,
                    code,
                    message: "Quantity must be a valid non-negative number."
                });
                continue;
            }

            const material = materialMap.get(normalized);

            if (!material) {
                errors.push({
                    row: excelRow,
                    code,
                    message: "Material code not found in Raw Material Master."
                });
                continue;
            }

            try {
                const amount = calculateAmount(quantity, material.rate);
                const existing = existingMap.get(normalized);

                if (existing) {
                    await Item.findByIdAndUpdate(
                        existing._id,
                        {
                            $set: {
                                code: material.code,
                                name: material.name,
                                quantity,
                                rate: material.rate,
                                amount,
                                tableName
                            }
                        },
                        { new: true, runValidators: true }
                    );
                    updated++;
                } else {
                    const created = await Item.create({
                        tableName,
                        code: material.code,
                        name: material.name,
                        quantity,
                        rate: material.rate,
                        amount,
                        status: "ACTIVE"
                    });

                    existingMap.set(normalized, created);
                    imported++;
                }
            } catch (error) {
                errors.push({
                    row: excelRow,
                    code,
                    message: error.message || "Failed to save formula."
                });
            }
        }

        const items = await Item.find({ tableName })
            .sort({ createdAt: 1 })
            .lean();

        return res.json({
            success: true,
            tableName,
            imported,
            updated,
            failed: errors.length,
            errors,
            items
        });
    } catch (error) {
        console.error("Product Excel import failed:", error);
        return res.status(500).json({
            message: error.message || "Failed to import product formulas."
        });
    }
}