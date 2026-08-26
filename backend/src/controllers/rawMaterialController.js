import XLSX from "xlsx";
import Item from "../models/Item.js";
import RawMaterial from "../models/RawMaterial.js";
import { dbConnect } from "../lib/db.js";
import { getAuthFromRequest } from "../utils/request-auth.js";
import { generateRawMaterialCode, normalizeRawMaterialCode } from "../lib/raw-materials.js";
import { calculateAmount } from "../lib/calculations.js";
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
    const materials = await RawMaterial.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean();
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
        const quantity = req.body.quantity === undefined ? 0 : typeof req.body.quantity === "number" ? req.body.quantity : Number(req.body.quantity);
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
        if (Number.isNaN(quantity) || quantity < 0) {
            return res.status(400).json({ message: "Quantity must be a valid number" });
        }
        await dbConnect();
        const normalizedCode = normalizeCode(code);
        const duplicate = await RawMaterial.findOne({ code: new RegExp(`^${escapeRegExp(code)}$`, "i") }).lean();
        if (duplicate) {
            return res.status(409).json({ message: "Raw material code already exists" });
        }
        const created = await RawMaterial.create({ code, name, rate, quantity });
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
        if (!code) {
            return res.status(400).json({ message: "Raw material code is required" });
        }
        const updates = {};
        if (req.body.name !== undefined) {
            const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
            if (!name) {
                return res.status(400).json({ message: "Raw material name is required" });
            }
            updates.name = name;
        }
        if (req.body.rate !== undefined) {
            const rate = typeof req.body.rate === "number" ? req.body.rate : Number(req.body.rate);
            if (Number.isNaN(rate) || rate < 0) {
                return res.status(400).json({ message: "Rate must be a valid number" });
            }
            updates.rate = rate;
        }
        if (req.body.quantity !== undefined) {
            const quantity = typeof req.body.quantity === "number" ? req.body.quantity : Number(req.body.quantity);
            if (Number.isNaN(quantity) || quantity < 0) {
                return res.status(400).json({ message: "Quantity must be a valid number" });
            }
            updates.quantity = quantity;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }
        await dbConnect();
        const normalizedCode = normalizeCode(code);
        const material = await RawMaterial.findOne({ code: new RegExp(`^${escapeRegExp(code)}$`, "i") }).lean();
        if (!material) {
            return res.status(404).json({ message: "Raw material not found" });
        }
        await RawMaterial.updateOne({ _id: material._id }, { $set: updates });
        if (updates.rate !== undefined) {
            const itemMatches = await Item.find().lean();
            for (const item of itemMatches) {
                const itemCode = item.code?.trim() || generateRawMaterialCode(item.name);
                if (normalizeCode(itemCode) !== normalizedCode)
                    continue;
                await Item.findByIdAndUpdate(item._id, {
                    code: itemCode,
                    rate: updates.rate,
                    amount: Number((item.quantity * updates.rate).toFixed(2))
                });
            }
        }
        return res.json({ material: { ...material, ...updates } });
    }
    catch {
        return res.status(500).json({ message: "Failed to update raw material" });
    }
}
function normalizeHeader(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}
function getCellText(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).trim();
}
function findHeaderKey(row, candidates) {
    if (!row || typeof row !== "object") {
        return null;
    }
    for (const key of Object.keys(row)) {
        if (candidates.includes(normalizeHeader(key))) {
            return key;
        }
    }
    return null;
}
function getRowExtension(value) {
    if (!value)
        return "";
    return String(value).toLowerCase().split(".").pop();
}
export async function importRawMaterials(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || auth.role !== "admin")
        return forbidden(res);
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const ext = getRowExtension(req.file.originalname);
        if (!["xlsx", "xls", "csv"].includes(ext)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file type. Only .xlsx, .xls, and .csv files are allowed."
            });
        }
        const buffer = req.file.buffer;
        if (!buffer || buffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The uploaded file is empty."
            });
        }
        await dbConnect();
        let workbook;
        try {
            workbook = XLSX.read(buffer, { type: "buffer" });
        } catch {
            return res.status(400).json({
                success: false,
                message: "The uploaded file is corrupted or not a valid Excel/CSV file."
            });
        }
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The uploaded file does not contain any sheets."
            });
        }
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        if (!rows || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No data rows found in the file."
            });
        }
        const firstRow = rows[0];
        const codeKey = findHeaderKey(firstRow, ["code", "rawmaterialcode"]);
        const nameKey = findHeaderKey(firstRow, ["name", "materialname", "rawmaterialname", "rawmaterial", "material"]);
        const rateKey = findHeaderKey(firstRow, ["rate", "price", "cost"]);
        const quantityKey = findHeaderKey(firstRow, ["quantity", "qty", "stock", "count"]);
        if (!nameKey || !rateKey) {
            return res.status(400).json({
                success: false,
                message: "The file must include 'Material Name' and 'Rate' columns."
            });
        }
        const existingMaterials = await RawMaterial.find().select("code _id").lean();
        const existingMap = new Map();
        for (const material of existingMaterials) {
            existingMap.set(normalizeCode(material.code), material);
        }
        const validRows = [];
        const errorRows = [];
        const skippedRows = [];
        const seenCodes = new Set();
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index] || {};
            const rowNumber = index + 2;
            const errors = [];
            const rawCode = codeKey ? getCellText(row[codeKey]) : "";
            const name = getCellText(row[nameKey]);
            const rateRaw = rateKey ? row[rateKey] : "";
            const rate = Number(rateRaw);
            const code = rawCode || (name ? generateRawMaterialCode(name) : "");
            const quantityRaw = quantityKey ? getCellText(row[quantityKey]) : "";
            const quantity = quantityRaw === "" ? 0 : Number(quantityRaw);
            if (!rawCode && !name && getCellText(rateRaw) === "") {
                skippedRows.push({ row: rowNumber });
                continue;
            }
            if (!name) {
                errors.push("Material Name is missing");
            }
            if (!code) {
                errors.push("Code is missing");
            }
            if (getCellText(rateRaw) === "" || Number.isNaN(rate) || rate < 0) {
                errors.push("Rate must be a valid number");
            }
            if (quantityRaw !== "" && (Number.isNaN(quantity) || quantity < 0)) {
                errors.push("Quantity must be a valid number");
            }
            const normalizedCode = code ? normalizeCode(code) : "";
            if (normalizedCode && seenCodes.has(normalizedCode)) {
                errors.push("Duplicate code within the file");
            }
            if (normalizedCode) {
                seenCodes.add(normalizedCode);
            }
            if (errors.length > 0) {
                errorRows.push({
                    row: rowNumber,
                    code,
                    name,
                    rate: rateRaw,
                    errors
                });
            } else {
                validRows.push({
                    row: rowNumber,
                    code,
                    name,
                    rate,
                    quantity: quantityKey ? quantity : 0
                });
            }
        }
        if (validRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid rows to import",
                imported: 0,
                updated: 0,
                skipped: skippedRows.length,
                failed: errorRows.length,
                errors: errorRows
            });
        }
        const imported = [];
        const updated = [];
        const writeErrors = [];
        for (const validRow of validRows) {
            const normalizedCode = normalizeCode(validRow.code);
            const existing = existingMap.get(normalizedCode);
            try {
                if (existing) {
                    await RawMaterial.updateOne(
                        { _id: existing._id },
                        { $set: { code: validRow.code, name: validRow.name, rate: validRow.rate, quantity: validRow.quantity } }
                    );
                    updated.push({ code: validRow.code, name: validRow.name, rate: validRow.rate, quantity: validRow.quantity });
                    existingMap.set(normalizedCode, { ...existing, name: validRow.name, rate: validRow.rate, quantity: validRow.quantity });
                } else {
                    const created = await RawMaterial.create({
                        code: validRow.code,
                        name: validRow.name,
                        rate: validRow.rate,
                        quantity: validRow.quantity
                    });
                    imported.push({
                        code: validRow.code,
                        name: validRow.name,
                        rate: validRow.rate,
                        quantity: validRow.quantity
                    });
                    existingMap.set(normalizedCode, created.toObject ? created.toObject() : created);
                }
            } catch (dbError) {
                writeErrors.push({
                    row: validRow.row,
                    code: validRow.code,
                    name: validRow.name,
                    rate: validRow.rate,
                    errors: [dbError.message || "Database error"]
                });
            }
        }
        const allErrors = [...errorRows, ...writeErrors];
        const message = allErrors.length > 0
            ? "Excel import completed with errors"
            : "Excel import completed";
        return res.json({
            success: true,
            message,
            imported: imported.length,
            updated: updated.length,
            skipped: skippedRows.length,
            failed: allErrors.length,
            errors: allErrors,
            materials: [...imported, ...updated]
        });
    } catch {
        return res.status(500).json({ success: false, message: "Excel import failed" });
    }
}
function parseDateValue(value) {
    if (!value && value !== 0 && value !== "") {
        return null;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && Number.isFinite(num) && num > 0) {
        return new Date(Math.round((num - 25569) * 86400 * 1000));
    }
    const str = String(value).trim();
    if (!str) {
        return null;
    }
    const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
        const date = new Date(Date.UTC(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]));
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }
    const dmyMatch = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (dmyMatch) {
        const d = +dmyMatch[1];
        const m = +dmyMatch[2];
        const y = +dmyMatch[3];
        let day = d;
        let month = m;
        if (m > 12 && d <= 12) {
            day = m;
            month = d;
        }
        const date = new Date(Date.UTC(y, month - 1, day));
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
}
async function syncItemRatesForCode(code, name, rate) {
    const normalizedCode = normalizeCode(code);
    const items = await Item.find().lean();
    for (const item of items) {
        const itemCode = item.code?.trim() || generateRawMaterialCode(item.name);
        if (normalizeCode(itemCode) !== normalizedCode) {
            continue;
        }
        await Item.findByIdAndUpdate(item._id, {
            code: itemCode,
            rate,
            amount: calculateAmount(item.quantity, rate)
        });
    }
}
export async function userImportRawMaterials(req, res) {
    const auth = await getAuthFromRequest(req);
    if (!auth || (auth.role !== "admin" && auth.role !== "user")) {
        return forbidden(res);
    }
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const ext = getRowExtension(req.file.originalname);
        if (!["xlsx", "xls", "csv"].includes(ext)) {
            return res.status(400).json({
                success: false,
                message: "Invalid file type. Only .xlsx, .xls, and .csv files are allowed."
            });
        }
        const buffer = req.file.buffer;
        if (!buffer || buffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The uploaded file is empty."
            });
        }
        await dbConnect();
        let workbook;
        try {
            workbook = XLSX.read(buffer, { type: "buffer" });
        } catch {
            return res.status(400).json({
                success: false,
                message: "The uploaded file is corrupted or not a valid Excel/CSV file."
            });
        }
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The uploaded file does not contain any sheets."
            });
        }
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        if (!rows || rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No data rows found in the file."
            });
        }
        const firstRow = rows[0] || {};
        const nameKey = findHeaderKey(firstRow, ["name", "materialname", "rawmaterialname", "rawmaterial", "material"]);
        const codeKey = findHeaderKey(firstRow, ["code", "rawmaterialcode"]);
        const dateKey = findHeaderKey(firstRow, ["date"]);
        const quantityKey = findHeaderKey(firstRow, ["quantity", "qty", "stock", "count"]);
        const rateKey = findHeaderKey(firstRow, ["rate", "price", "cost"]);
        if (!nameKey || !codeKey) {
            return res.status(400).json({
                success: false,
                message: "The file must include 'Name' and 'Code' columns."
            });
        }
        const existingMaterials = await RawMaterial.find().select("code name rate quantity _id").lean();
        const existingMap = new Map();
        for (const material of existingMaterials) {
            existingMap.set(normalizeCode(material.code), material);
        }
        const validRows = [];
        const errorRows = [];
        const skippedRows = [];
        const seenCodes = new Map();
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index] || {};
            const rowNumber = index + 2;
            const errors = [];
            const name = getCellText(nameKey ? row[nameKey] : "");
            const code = getCellText(codeKey ? row[codeKey] : "");
            const dateRaw = dateKey ? getCellText(row[dateKey]) : "";
            const quantityRaw = quantityKey ? getCellText(row[quantityKey]) : "";
            const rateRaw = rateKey ? getCellText(row[rateKey]) : "";
            if (!name && !code && !dateRaw && !quantityRaw && !rateRaw) {
                skippedRows.push({ row: rowNumber });
                continue;
            }
            if (!name) {
                errors.push("Missing Name");
            }
            if (!code) {
                errors.push("Missing Code");
            }
            if (!dateRaw) {
                errors.push("Missing Date");
            }
            if (!quantityRaw) {
                errors.push("Missing Quantity");
            }
            let parsedDate = null;
            if (dateRaw) {
                parsedDate = parseDateValue(dateRaw);
                if (!parsedDate) {
                    errors.push(`Invalid Date "${dateRaw}"`);
                }
            }
            let quantity = null;
            if (quantityRaw) {
                const quantityNum = Number(quantityRaw);
                if (Number.isNaN(quantityNum) || !Number.isFinite(quantityNum) || quantityNum < 0) {
                    errors.push(`Invalid Quantity "${quantityRaw}"`);
                } else {
                    quantity = quantityNum;
                }
            }
            let rate = null;
            if (rateRaw && rateKey) {
                const rateNum = Number(rateRaw);
                if (Number.isNaN(rateNum) || !Number.isFinite(rateNum) || rateNum < 0) {
                    errors.push(`Invalid Rate "${rateRaw}"`);
                } else {
                    rate = rateNum;
                }
            }
            const normalizedCode = code ? normalizeCode(code) : "";
            if (normalizedCode) {
                if (seenCodes.has(normalizedCode)) {
                    errors.push(`Duplicate Code "${code}" (already used in row ${seenCodes.get(normalizedCode)})`);
                } else {
                    seenCodes.set(normalizedCode, rowNumber);
                }
            }
            if (errors.length > 0) {
                errorRows.push({
                    row: rowNumber,
                    code,
                    name,
                    errors
                });
            } else {
                validRows.push({
                    row: rowNumber,
                    code,
                    name,
                    quantity,
                    date: parsedDate,
                    rate
                });
            }
        }
        if (validRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid rows to import",
                imported: 0,
                updated: 0,
                skipped: skippedRows.length + errorRows.length,
                failed: errorRows.length,
                errors: errorRows
            });
        }
        const imported = [];
        const updated = [];
        const writeErrors = [];
        for (const validRow of validRows) {
            const normalizedCode = normalizeCode(validRow.code);
            const existing = existingMap.get(normalizedCode);
            try {
                if (existing) {
                    const updateData = {
                        name: validRow.name,
                        quantity: validRow.quantity,
                        date: validRow.date
                    };
                    if (validRow.rate !== null) {
                        updateData.rate = validRow.rate;
                    }
                    await RawMaterial.updateOne(
                        { _id: existing._id },
                        { $set: updateData }
                    );
                    existingMap.set(normalizedCode, {
                        ...existing,
                        ...updateData,
                        _id: existing._id
                    });
                    if (validRow.rate !== null && validRow.rate !== existing.rate) {
                        await syncItemRatesForCode(validRow.code, validRow.name, validRow.rate);
                    }
                    updated.push({
                        code: validRow.code,
                        name: validRow.name,
                        quantity: validRow.quantity,
                        date: validRow.date,
                        rate: validRow.rate !== null ? validRow.rate : existing.rate
                    });
                } else {
                    const createData = {
                        code: validRow.code,
                        name: validRow.name,
                        quantity: validRow.quantity,
                        date: validRow.date,
                        rate: validRow.rate !== null ? validRow.rate : 0
                    };
                    const created = await RawMaterial.create(createData);
                    imported.push({
                        code: validRow.code,
                        name: validRow.name,
                        quantity: validRow.quantity,
                        date: validRow.date,
                        rate: createData.rate
                    });
                    existingMap.set(normalizedCode, created.toObject ? created.toObject() : created);
                }
            } catch (dbError) {
                writeErrors.push({
                    row: validRow.row,
                    code: validRow.code,
                    name: validRow.name,
                    errors: [dbError.message || "Database error"]
                });
            }
        }
        const allErrors = [...errorRows, ...writeErrors];
        const skipped = skippedRows.length + errorRows.length;
        const message = allErrors.length > 0
            ? "Excel import completed with errors"
            : "Excel import completed";
        return res.json({
            success: true,
            message,
            imported: imported.length,
            updated: updated.length,
            skipped,
            failed: allErrors.length,
            errors: allErrors,
            materials: [...imported, ...updated]
        });
    } catch {
        return res.status(500).json({ success: false, message: "Excel import failed" });
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
