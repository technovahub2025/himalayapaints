import Item from "../models/Item.js";
import RawMaterial from "../models/RawMaterial.js";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { generateRawMaterialCode, normalizeRawMaterialCode } from "../lib/raw-materials.js";
function forbidden(res) {
    return res.status(403).json({ message: "Forbidden" });
}
function normalizeCode(value) {
    return normalizeRawMaterialCode(value);
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export async function getRawMaterials(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    await dbConnect();
    const limitValue = Number(req.query.limit ?? 20);
    const offsetValue = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 100) : 20;
    const offset = Number.isFinite(offsetValue) ? Math.max(Math.trunc(offsetValue), 0) : 0;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const filter = {};
    if (code) {
        filter.code = new RegExp(`^${escapeRegExp(code)}$`, "i");
    }
    else if (search) {
        const safeSearch = escapeRegExp(search);
        filter.$or = [
            { code: new RegExp(safeSearch, "i") },
            { name: new RegExp(safeSearch, "i") }
        ];
        if (!Number.isNaN(Number(search))) {
            filter.$or.push({ rate: Number(search) });
        }
    }
    const total = await RawMaterial.countDocuments(filter);
    const materials = await RawMaterial.find(filter).sort({ createdAt: 1 }).skip(offset).limit(limit).lean();
    if (search || code) {
        const normalizedSearch = normalizeCode(code || search);
        materials.sort((left, right) => {
            const leftCode = normalizeCode(left.code);
            const rightCode = normalizeCode(right.code);
            const leftName = String(left.name ?? "").trim().toLowerCase();
            const rightName = String(right.name ?? "").trim().toLowerCase();
            const leftExact = leftCode === normalizedSearch ? 0 : leftCode.startsWith(normalizedSearch) ? 1 : leftName.startsWith(normalizedSearch) ? 2 : 3;
            const rightExact = rightCode === normalizedSearch ? 0 : rightCode.startsWith(normalizedSearch) ? 1 : rightName.startsWith(normalizedSearch) ? 2 : 3;
            if (leftExact !== rightExact) {
                return leftExact - rightExact;
            }
            return leftCode.localeCompare(rightCode);
        });
    }
    return res.json({
        materials,
        total,
        hasMore: offset + materials.length < total,
        nextOffset: offset + materials.length
    });
}
export async function createRawMaterial(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const rawCode = typeof req.body.code === "string" ? req.body.code.trim() : "";
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const rate = typeof req.body.rate === "number" ? req.body.rate : Number(req.body.rate);
        const code = rawCode || generateRawMaterialCode(name);
        if (!name) {
            return res.status(400).json({ message: "Raw material name is required" });
        }
        if (!code) {
            return res.status(400).json({ message: "Raw material code is required" });
        }
        if (Number.isNaN(rate) || rate < 0) {
            return res.status(400).json({ message: "Rate must be a valid number" });
        }
        await dbConnect();
        const normalizedCode = normalizeCode(code);
        const duplicate = await RawMaterial.findOne({ code: new RegExp(`^${escapeRegExp(code)}$`, "i") }).lean();
        if (duplicate) {
            return res.status(409).json({ message: "Raw material code already exists" });
        }
        const created = await RawMaterial.create({ code, name, rate });
        return res.status(201).json({ material: created });
    }
    catch {
        return res.status(500).json({ message: "Failed to create raw material" });
    }
}
export async function updateRawMaterial(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
        const rate = typeof req.body.rate === "number" ? req.body.rate : Number(req.body.rate);
        if (!code) {
            return res.status(400).json({ message: "Raw material code is required" });
        }
        if (Number.isNaN(rate) || rate < 0) {
            return res.status(400).json({ message: "Rate must be a valid number" });
        }
        await dbConnect();
        const normalizedCode = normalizeCode(code);
        const material = await RawMaterial.findOne({ code: new RegExp(`^${escapeRegExp(code)}$`, "i") }).lean();
        if (!material) {
            return res.status(404).json({ message: "Raw material not found" });
        }
        await RawMaterial.updateOne({ _id: material._id }, { $set: { rate } });
        const itemMatches = await Item.find().lean();
        for (const item of itemMatches) {
            const itemCode = item.code?.trim() || generateRawMaterialCode(item.name);
            if (normalizeCode(itemCode) !== normalizedCode)
                continue;
            await Item.findByIdAndUpdate(item._id, {
                code: itemCode,
                rate,
                amount: Number((item.quantity * rate).toFixed(2))
            });
        }
        return res.json({ material: { ...material, rate } });
    }
    catch {
        return res.status(500).json({ message: "Failed to update raw material" });
    }
}
export async function importRawMaterials(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const rows = Array.isArray(req.body.materials) ? req.body.materials : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: "No raw materials provided for import" });
        }
        await dbConnect();
        const existingMaterials = await RawMaterial.find().select("code").lean();
        const takenCodes = new Set(existingMaterials.map((material) => normalizeCode(material.code)));
        const createdMaterials = [];
        const skippedRows = [];
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index] || {};
            const name = typeof row.name === "string" ? row.name.trim() : "";
            const rawCode = typeof row.code === "string" ? row.code.trim() : "";
            const code = rawCode || generateRawMaterialCode(name);
            const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
            const rowNumber = index + 1;
            const errors = [];
            if (!name) {
                errors.push("Raw material name is required");
            }
            if (!code) {
                errors.push("Raw material code is required");
            }
            if (Number.isNaN(rate) || rate < 0) {
                errors.push("Rate must be a valid number");
            }
            const normalizedCode = normalizeCode(code);
            if (!errors.length && takenCodes.has(normalizedCode)) {
                errors.push("Raw material code already exists");
            }
            if (errors.length > 0) {
                skippedRows.push({
                    row: rowNumber,
                    code,
                    name,
                    rate: row.rate,
                    errors
                });
                continue;
            }
            const created = await RawMaterial.create({ code, name, rate });
            createdMaterials.push(created);
            takenCodes.add(normalizedCode);
        }
        return res.status(201).json({
            createdCount: createdMaterials.length,
            skippedCount: skippedRows.length,
            materials: createdMaterials,
            skippedRows
        });
    }
    catch {
        return res.status(500).json({ message: "Failed to import raw materials" });
    }
}
export async function deleteRawMaterials(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        const codes = Array.isArray(req.body.codes) ? req.body.codes : [];
        const normalizedCodes = Array.from(new Set(codes
            .filter((code) => typeof code === "string")
            .map((code) => code.trim())
            .filter(Boolean)
            .map((code) => normalizeCode(code))));
        if (normalizedCodes.length === 0) {
            return res.status(400).json({ message: "No raw materials selected for deletion" });
        }
        await dbConnect();
        const materials = await RawMaterial.find().select("_id code").lean();
        const matchedMaterials = materials.filter((material) => normalizedCodes.includes(normalizeCode(material.code)));
        if (matchedMaterials.length === 0) {
            return res.status(404).json({ message: "No matching raw materials found" });
        }
        await RawMaterial.deleteMany({ _id: { $in: matchedMaterials.map((material) => material._id) } });
        return res.json({
            deletedCount: matchedMaterials.length,
            deletedCodes: matchedMaterials.map((material) => material.code)
        });
    }
    catch {
        return res.status(500).json({ message: "Failed to delete raw materials" });
    }
}
