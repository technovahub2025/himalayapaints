"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, FileText, LoaderCircle, Printer, RefreshCw, Save, ChevronDown, Download } from "lucide-react";
import { calculateGrandTotal, safePercent, scaleQuantity } from "@/lib/calculations";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { ProductSelector } from "@/components/user/product-selector";
import { RawMaterialTable } from "@/components/user/raw-material-table";
import { PackSizeTable } from "@/components/user/pack-size-table";
import { formatProductLabel } from "@/lib/product-label";
import { toast } from "sonner";
const EMPTY_BATCH_DETAILS = {
    product: "",
    batchNo: "",
    date: "",
    batchSize: "",
    specificGravity: "",
    viscosity: "",
    actuals: ""
};
const EMPTY_PACK_ROWS = [{ packSize: "", quantity: "" }];
const USER_DRAFT_PREFIX = "himalayapaints:user-dashboard-draft:";
export function UserDashboard({ initialItems, initialTableName, tableNames, email }) {
     const navigate = useNavigate();
     const [tableName, setTableName] = useState(initialTableName);
     const [items, setItems] = useState(initialItems);
     const [availableTables, setAvailableTables] = useState(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
     const [targetKg, setTargetKg] = useState("100");
     const [manualKgValues, setManualKgValues] = useState({});
     const [actuals, setActuals] = useState({});
     const [remarks, setRemarks] = useState({});
     const [signatures, setSignatures] = useState({});
     const [exportOpen, setExportOpen] = useState(false);
     const exportMenuRef = useRef(null);
     const [packRows, setPackRows] = useState(EMPTY_PACK_ROWS);
    const [batchDetails, setBatchDetails] = useState(EMPTY_BATCH_DETAILS);
    const [loading, setLoading] = useState(false);
    const [savingProduction, setSavingProduction] = useState(false);
    const restoringDraftRef = useRef(null);
    useEffect(() => {
        setItems(initialItems);
        setTableName(initialTableName);
        setAvailableTables(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
    }, [initialItems, initialTableName, tableNames]);
    function getDraftStorageKey(name) {
        return `${USER_DRAFT_PREFIX}${name.trim() || "Table 1"}`;
    }
    function loadSavedDraft(name) {
        if (typeof window === "undefined")
            return null;
        const raw = window.localStorage.getItem(getDraftStorageKey(name));
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            return {
                actuals: parsed.actuals ?? {},
                batchDetails: { ...EMPTY_BATCH_DETAILS, ...(parsed.batchDetails ?? {}) },
                manualKgValues: parsed.manualKgValues ?? {},
                packRows: parsed.packRows?.length ? parsed.packRows : EMPTY_PACK_ROWS,
                remarks: parsed.remarks ?? {},
                signatures: parsed.signatures ?? {},
                targetKg: parsed.targetKg ?? "100"
            };
        }
        catch {
            return null;
        }
    }
    function saveCurrentDraft(name) {
        if (typeof window === "undefined")
            return;
        const draft = {
            actuals,
            batchDetails,
            manualKgValues,
            packRows,
            remarks,
            signatures,
            targetKg
        };
        window.localStorage.setItem(getDraftStorageKey(name), JSON.stringify(draft));
    }
    function clearSavedDraft(name) {
        if (typeof window === "undefined")
            return;
        window.localStorage.removeItem(getDraftStorageKey(name));
    }
    function resetDraftState() {
        setTargetKg("100");
        setManualKgValues({});
        setActuals({});
        setRemarks({});
        setSignatures({});
        setPackRows(EMPTY_PACK_ROWS);
        setBatchDetails(EMPTY_BATCH_DETAILS);
    }
    useEffect(() => {
        const savedDraft = loadSavedDraft(tableName);
        restoringDraftRef.current = tableName;
        if (savedDraft) {
            setTargetKg(savedDraft.targetKg);
            setManualKgValues(savedDraft.manualKgValues);
            setActuals(savedDraft.actuals);
            setRemarks(savedDraft.remarks);
            setSignatures(savedDraft.signatures);
            setPackRows(savedDraft.packRows);
            setBatchDetails(savedDraft.batchDetails);
        }
        else {
            resetDraftState();
        }
        const timer = window.setTimeout(() => {
            restoringDraftRef.current = null;
        }, 0);
        return () => window.clearTimeout(timer);
    }, [tableName]);
    useEffect(() => {
        if (typeof window === "undefined")
            return;
        if (restoringDraftRef.current === tableName)
            return;
        saveCurrentDraft(tableName);
    }, [actuals, batchDetails, manualKgValues, packRows, remarks, signatures, tableName, targetKg]);
    function updateBatchDetail(key, value) {
        setBatchDetails((current) => ({
            ...current,
            [key]: value
        }));
    }
    function handleTargetKgChange(value) {
        setTargetKg(value);
        setManualKgValues({});
    }
    function handleManualKgChange(itemId, value) {
        setManualKgValues((current) => ({
            ...current,
            [itemId]: value
        }));
    }
    function handleActualChange(itemId, value) {
        setActuals((current) => ({
            ...current,
            [itemId]: value
        }));
    }
    function handleRemarkChange(itemId, value) {
        setRemarks((current) => ({
            ...current,
            [itemId]: value
        }));
    }
    function handleSignatureChange(itemId, value) {
        setSignatures((current) => ({
            ...current,
            [itemId]: value
        }));
    }
    function handleAddPackRow() {
        setPackRows((current) => [...current, { packSize: "", quantity: "" }]);
    }
    function handleDeletePackRow(index) {
        setPackRows((current) => {
            const next = current.filter((_, rowIndex) => rowIndex !== index);
            return next.length > 0 ? next : [{ packSize: "", quantity: "" }];
        });
    }
    function handlePackSizeChange(index, value) {
        setPackRows((current) => current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, packSize: value } : packRow)));
    }
    function handlePackQuantityChange(index, value) {
        setPackRows((current) => current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, quantity: value } : packRow)));
    }
    function clearCurrentDraft() {
        if (typeof window !== "undefined") {
            const confirmed = window.confirm(`Clear the saved draft for ${formatProductLabel(tableName || "this product")}?`);
            if (!confirmed)
                return;
            clearSavedDraft(tableName);
        }
        restoringDraftRef.current = tableName;
        resetDraftState();
        window.setTimeout(() => {
            restoringDraftRef.current = null;
        }, 0);
    }
    async function loadTable(nextTableName) {
        const trimmed = nextTableName.trim() || "Table 1";
        setLoading(true);
        try {
            navigate(`/user?tableName=${encodeURIComponent(trimmed)}`, { replace: true });
            const response = await fetch(`/api/items?tableName=${encodeURIComponent(trimmed)}`);
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to load items");
            setItems(data.items ?? []);
            setTableName(trimmed);
            setAvailableTables(Array.from(new Set([trimmed, ...(data.tables ?? []).filter(Boolean)])).sort());
            toast.success("Latest admin data loaded");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load items");
        }
        finally {
            setLoading(false);
        }
    }
    async function refreshItems() {
        await loadTable(tableName);
    }
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = calculateGrandTotal(items);
    const targetNumber = Number(targetKg || 0);
    const distributedTotal = items.reduce((sum, item) => {
        const percentage = safePercent(item.quantity, totalQuantity);
        const calculated = scaleQuantity(item.quantity, targetNumber);
        const override = manualKgValues[item._id];
        return sum + Number(override ?? calculated);
    }, 0);
    const packResults = packRows.map((row) => Number(row.packSize || 0) * Number(row.quantity || 0));
    const packGrandTotal = packResults.reduce((sum, value) => sum + value, 0);
    const packExportRows = packRows.map((row, index) => {
        const result = Number(row.packSize || 0) * Number(row.quantity || 0);
        return {
            rowNumber: index + 1,
            packSize: row.packSize,
            quantity: row.quantity,
            result
        };
    });
    const exportPackRows = packRows
        .filter((row) => row.packSize.trim() !== "" || row.quantity.trim() !== "")
        .map((row) => ({
        packSize: row.packSize,
        quantity: row.quantity,
        result: Number(row.packSize || 0) * Number(row.quantity || 0)
    }));
    const hasPackData = exportPackRows.length > 0;
    const exportRows = items.map((item) => {
        const percentage = safePercent(item.quantity, totalQuantity);
        const suggestedKg = scaleQuantity(item.quantity, targetNumber);
        return {
            percentage: `${percentage.toFixed(2)}%`,
            source: item.name,
            editableKgInput: manualKgValues[item._id] ?? String(suggestedKg),
            actuals: actuals[item._id] ?? "",
            suggestedKg
        };
    });
    const exportTableRows = items.map((item) => {
        const percentage = safePercent(item.quantity, totalQuantity);
        const suggestedKg = scaleQuantity(item.quantity, targetNumber);
        return {
            percentage: `${percentage.toFixed(2)}%`,
            source: item.name,
            stdQty: manualKgValues[item._id] ?? String(suggestedKg),
            actualQty: actuals[item._id] ?? "",
            remarks: remarks[item._id] ?? "",
            signature: signatures[item._id] ?? ""
        };
    });
    function formatKgValue(value) {
        const normalized = String(value).trim();
        return normalized ? `${normalized} kg` : "";
    }
    function formatSecondsValue(value) {
        const normalized = String(value).trim();
        return normalized ? `${normalized} sec` : "";
    }
    function getRemarkValue(itemId) {
        return remarks[itemId] ?? "";
    }
    function getSignatureValue(itemId) {
        return signatures[itemId] ?? "";
    }
    async function saveProductionBatch() {
        if (items.length === 0) {
            toast.error("No master materials available to save.");
            return;
        }
        const productName = tableName.trim() || "Table 1";
        const batchNo = batchDetails.batchNo.trim();
        const batchSize = batchDetails.batchSize.trim();
        const specificGravity = batchDetails.specificGravity.trim();
        const viscosity = batchDetails.viscosity.trim();
        const actualsDetails = batchDetails.actuals.trim();
        const lines = items.map((item) => {
            const percentage = safePercent(item.quantity, totalQuantity);
            const suggestedKg = scaleQuantity(item.quantity, targetNumber);
            const stdQty = Number(manualKgValues[item._id] ?? suggestedKg);
            const actualValue = actuals[item._id];
            const actualQty = Number(actualValue || stdQty || 0);
            return {
                itemId: item._id,
                materialName: item.name,
                percentage,
                stdQty,
                actualQty,
                remarks: remarks[item._id] ?? "",
                signature: signatures[item._id] ?? ""
            };
        });
        const invalidLine = lines.find((line) => Number.isNaN(line.stdQty) || Number.isNaN(line.actualQty));
        if (invalidLine) {
            toast.error("Please enter valid numbers for all production quantities.");
            return;
        }
        setSavingProduction(true);
        try {
            const response = await fetch("/api/production", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productName,
                    batchNo,
                    batchSize,
                    specificGravity,
                    viscosity,
                    actuals: actualsDetails,
                    targetKg: targetNumber,
                    actualKg: distributedTotal,
                    createdBy: email ?? "",
                    lines
                })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to save production batch");
            toast.success("Production batch saved");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save production batch");
        }
        finally {
            setSavingProduction(false);
        }
    }
    async function exportExcel() {
        const XLSX = await import("xlsx-js-style");
        const worksheetData = [
            ["PRODUCTION BATCH SHEET"],
            ["PRODUCT:", formatProductLabel(tableName || "Product 1"), "", "BATCH SIZE", "SPECIFIC GRAVITY", "VISCOSITY", "ACTUALS"],
            ["BATCH NO", batchDetails.batchNo || "", "STD:", targetKg ? `${Number(targetKg).toLocaleString()} KG` : "", batchDetails.specificGravity || "", formatSecondsValue(batchDetails.viscosity), batchDetails.actuals || ""],
            ["DATE", batchDetails.date || "", "ACTUAL:", `${distributedTotal.toLocaleString()} KG`, "", "", ""],
            [],
            ["%", "RAW MATERIAL CODE", "STD QTY", "ACTUAL QTY", "REMARKS", "SIGNATURE"],
            ...exportTableRows.map((row) => [row.percentage, row.source, row.stdQty, row.actualQty, row.remarks, row.signature]),
            ["TOTAL", "Dynamic source list", `${distributedTotal.toLocaleString()} KG`, "Manual actuals only", "Remarks", "Signature"]
        ];
        if (hasPackData) {
            worksheetData.push([], ["PACK SIZE", "QTY", "TOTAL"], ...exportPackRows.map((row) => [row.packSize, row.quantity, String(row.result)]), ["BULK", "", "TOTAL"]);
        }
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const border = {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
        };
        const titleFill = { patternType: "solid", fgColor: { rgb: "F3F4F6" } };
        const headerFill = { patternType: "solid", fgColor: { rgb: "E5E7EB" } };
        const center = { horizontal: "center", vertical: "center", wrapText: true };
        const left = { horizontal: "left", vertical: "center", wrapText: true };
        const boldFont = { bold: true, color: { rgb: "000000" } };
        const regularFont = { color: { rgb: "000000" } };
        function ensureCell(row, col) {
            const address = XLSX.utils.encode_cell({ r: row, c: col });
            if (!worksheet[address]) {
                worksheet[address] = { t: "s", v: "" };
            }
            return worksheet[address];
        }
        function styleRange(startRow, endRow, startCol, endCol, style) {
            for (let row = startRow; row <= endRow; row += 1) {
                for (let col = startCol; col <= endCol; col += 1) {
                    const cell = ensureCell(row, col);
                    cell.s = {
                        ...(cell.s ?? {}),
                        ...style
                    };
                }
            }
        }
        const rawDataStart = 6;
        const rawDataEnd = rawDataStart + exportTableRows.length - 1;
        const rawTotalRow = rawDataEnd + 1;
        const packHeaderRow = rawTotalRow + 2;
        const packDataStart = packHeaderRow + 1;
        const packDataEnd = packDataStart + exportPackRows.length - 1;
        const packTotalRow = packDataEnd + 1;
        worksheet["!cols"] = [
            { wch: 16 },
            { wch: 28 },
            { wch: 16 },
            { wch: 16 },
            { wch: 18 },
            { wch: 18 }
        ];
        worksheet["!rows"] = worksheetData.map(() => ({ hpt: 20 }));
        worksheet["!rows"][0] = { hpt: 24 };
        worksheet["!rows"][4] = { hpt: 8 };
        worksheet["!rows"][5] = { hpt: 18 };
        worksheet["!rows"][rawTotalRow] = { hpt: 20 };
        if (hasPackData) {
            worksheet["!rows"][packHeaderRow] = { hpt: 18 };
            worksheet["!rows"][packTotalRow] = { hpt: 20 };
        }
        worksheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
        ];
        // Title
        styleRange(0, 0, 0, 5, {
            font: { ...boldFont, sz: 14 },
            alignment: center,
            fill: titleFill,
            border
        });
        // Batch details rows
        styleRange(1, 4, 0, 5, {
            border,
            alignment: left,
            font: regularFont
        });
        styleRange(1, 1, 0, 5, {
            fill: headerFill,
            font: boldFont
        });
        styleRange(2, 4, 0, 5, {
            fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } }
        });
        styleRange(1, 4, 0, 5, {
            alignment: left
        });
        styleRange(1, 4, 0, 0, {
            font: boldFont
        });
        styleRange(2, 4, 0, 0, {
            font: boldFont
        });
        styleRange(2, 4, 2, 2, {
            font: boldFont
        });
        // Raw material table
        styleRange(5, rawTotalRow, 0, 5, {
            border,
            alignment: left,
            font: regularFont
        });
        styleRange(5, 5, 0, 5, {
            fill: headerFill,
            font: boldFont,
            alignment: center
        });
        styleRange(rawDataStart, rawTotalRow - 1, 0, 5, {
            fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } }
        });
        styleRange(4, 4, 0, 5, {
            fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
            border: {
                top: { style: "none" },
                bottom: { style: "none" },
                left: { style: "none" },
                right: { style: "none" }
            }
        });
        styleRange(rawTotalRow, rawTotalRow, 0, 5, {
            fill: { patternType: "solid", fgColor: { rgb: "F9FAFB" } },
            font: boldFont
        });
        if (hasPackData) {
            // Pack size table
            styleRange(packHeaderRow, packTotalRow, 0, 2, {
                border,
                alignment: center,
                font: regularFont
            });
            styleRange(packHeaderRow, packHeaderRow, 0, 2, {
                fill: headerFill,
                font: boldFont
            });
            styleRange(packTotalRow, packTotalRow, 0, 2, {
                fill: { patternType: "solid", fgColor: { rgb: "F9FAFB" } },
                font: boldFont
            });
        }
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "User Table");
        XLSX.writeFile(workbook, `${tableName || "table"}-production-sheet.xlsx`);
    }
    async function createPdfDocument() {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = 297;
        const marginX = 5;
        const gridWidth = pageWidth - marginX * 2;
        const colWidths = [18, 95, 28, 34, 55, 57];
        const xPositions = [
            marginX,
            marginX + colWidths[0],
            marginX + colWidths[0] + colWidths[1],
            marginX + colWidths[0] + colWidths[1] + colWidths[2],
            marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
            marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]
        ];
        const drawCell = (x, y, w, h, text = "", opts) => {
            const { align = "left", bold = false, fillColor = null, textColor = [0, 0, 0], fontSize = 7.5, paddingX = 2 } = opts ?? {};
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.2);
            if (fillColor) {
                doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                doc.rect(x, y, w, h, "FD");
            }
            else {
                doc.rect(x, y, w, h);
            }
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            const textY = y + h / 2 + fontSize / 3.4;
            const textX = align === "center" ? x + w / 2 : align === "right" ? x + w - paddingX : x + paddingX;
            doc.text(String(text ?? ""), textX, textY, {
                align,
                maxWidth: w - paddingX * 2
            });
        };
        let y = 6;
        drawCell(marginX, y, gridWidth, 7, "PRODUCTION BATCH SHEET", {
            align: "center",
            bold: true,
            fontSize: 9.5
        });
        y += 7;
        drawCell(xPositions[0], y, colWidths[0], 7, "PRODUCT:", { bold: true });
        drawCell(xPositions[1], y, colWidths[1] + colWidths[2], 7, formatProductLabel(tableName || "Product 1"), { bold: false });
        drawCell(xPositions[3], y, colWidths[3], 7, "BATCH SIZE", { bold: true });
        drawCell(xPositions[4], y, colWidths[4], 7, "SPECIFIC GRAVITY", { bold: true });
        drawCell(xPositions[5], y, colWidths[5], 7, "VISCOSITY", { bold: true });
        y += 7;
        drawCell(xPositions[0], y, colWidths[0], 7, "BATCH NO", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, batchDetails.batchNo || "", { bold: false });
        drawCell(xPositions[2], y, colWidths[2], 7, "STD:", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, targetKg ? `${Number(targetKg).toLocaleString()} KG` : "", { bold: false });
        drawCell(xPositions[4], y, colWidths[4], 7, batchDetails.specificGravity || "", { bold: false });
        drawCell(xPositions[5], y, colWidths[5], 7, formatSecondsValue(batchDetails.viscosity), { bold: false });
        y += 7;
        drawCell(xPositions[0], y, colWidths[0], 7, "DATE", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, batchDetails.date || "", { bold: false });
        drawCell(xPositions[2], y, colWidths[2], 7, "ACTUAL:", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, `${distributedTotal.toLocaleString()} KG`, { bold: false });
        drawCell(xPositions[4], y, colWidths[4], 7, "ACTUALS", { bold: true });
        drawCell(xPositions[5], y, colWidths[5], 7, batchDetails.actuals || "", { bold: false });
        // Split the batch details block from the raw material table so the PDF reads
        // like two separate tables, matching the reference layout.
        y += 10;
        drawCell(xPositions[0], y, colWidths[0], 7, "%", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, "RAW MATERIAL CODE", { bold: true });
        drawCell(xPositions[2], y, colWidths[2], 7, "STD QTY", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, "ACTUAL QTY", { bold: true });
        drawCell(xPositions[4], y, colWidths[4], 7, "REMARKS", { bold: true });
        drawCell(xPositions[5], y, colWidths[5], 7, "SIGNATURE", { bold: true });
        const mainRows = items.length;
        const rowHeight = 7;
        y += 7;
        for (let i = 0; i < mainRows; i += 1) {
            const item = items[i];
            const percentage = safePercent(item.quantity, totalQuantity).toFixed(2);
            const suggestedKg = scaleQuantity(item.quantity, targetNumber);
            const kgValue = manualKgValues[item._id] ?? String(suggestedKg);
            const actualValue = actuals[item._id] ?? "";
            const remarkValue = getRemarkValue(item._id);
            const signatureValue = getSignatureValue(item._id);
            drawCell(xPositions[0], y, colWidths[0], rowHeight, `${percentage}%`, { align: "center" });
            drawCell(xPositions[1], y, colWidths[1], rowHeight, item.name, { align: "left" });
            drawCell(xPositions[2], y, colWidths[2], rowHeight, formatKgValue(kgValue), { align: "center" });
            drawCell(xPositions[3], y, colWidths[3], rowHeight, actualValue, { align: "center" });
            drawCell(xPositions[4], y, colWidths[4], rowHeight, remarkValue, { align: "left" });
            drawCell(xPositions[5], y, colWidths[5], rowHeight, signatureValue, { align: "left" });
            y += rowHeight;
        }
        // Leave a visible white band between the two separate tables.
        y += 10;
        const packBodyRows = exportPackRows.length;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.2);
        if (hasPackData) {
            drawCell(xPositions[0], y, colWidths[0], rowHeight, "PACK SIZE", {
                bold: true,
                textColor: [220, 38, 38]
            });
            drawCell(xPositions[1], y, colWidths[1], rowHeight, "QTY", {
                bold: true,
                textColor: [220, 38, 38]
            });
            drawCell(xPositions[2], y, colWidths[2], rowHeight, "TOTAL", {
                bold: true,
                textColor: [220, 38, 38]
            });
            y += rowHeight;
            for (let i = 0; i < packBodyRows; i += 1) {
                const row = exportPackRows[i];
                drawCell(xPositions[0], y, colWidths[0], rowHeight, row?.packSize || "", { align: "center" });
                drawCell(xPositions[1], y, colWidths[1], rowHeight, row?.quantity || "", { align: "center" });
                drawCell(xPositions[2], y, colWidths[2], rowHeight, row ? String(row.result) : "", { align: "center" });
                y += rowHeight;
            }
            drawCell(xPositions[0], y, colWidths[0], rowHeight, "BULK", {
                bold: true,
                textColor: [220, 38, 38]
            });
            drawCell(xPositions[1], y, colWidths[1], rowHeight, "", { align: "center" });
            drawCell(xPositions[2], y, colWidths[2], rowHeight, "TOTAL", {
                bold: true,
                textColor: [220, 38, 38]
            });
        }
        return doc;
    }
    async function exportPdf() {
        const doc = await createPdfDocument();
        doc.save(`${tableName || "table"}-production-sheet.pdf`);
    }
    async function handlePrint() {
        const doc = await createPdfDocument();
        doc.autoPrint();
        const blobUrl = URL.createObjectURL(doc.output("blob"));
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.src = blobUrl;
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            window.setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
                iframe.remove();
            }, 1000);
        };
        document.body.appendChild(iframe);
    }
    return (<div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Title>User Dashboard</Title>
          <Subtitle>Read-only master data from admin with live percentage distribution and production outputs.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="w-full max-w-none rounded-3xl border border-line bg-white/80 p-3 shadow-sm backdrop-blur print:hidden sm:p-4 lg:max-w-4xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <ProductSelector value={tableName} options={availableTables} onSelect={loadTable} disabled={loading}/>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-wrap lg:justify-end">
              <Button variant="secondary" onClick={saveProductionBatch} disabled={savingProduction || loading} className="w-full sm:w-auto">
                {savingProduction ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Production
               </Button>
               <div ref={exportMenuRef} className="relative flex flex-col items-start">
                 <Button variant="secondary" onClick={() => setExportOpen(!exportOpen)} className="w-full sm:w-auto">
                   <Download className="mr-2 h-4 w-4"/>
                   Export
                   <ChevronDown className="ml-2 h-4 w-4"/>
                 </Button>
                 <div className="absolute left-0 top-full mt-1 text-xs text-muted whitespace-nowrap">Excel, PDF, Print</div>
                  {exportOpen ? (<div className="absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-xl">
                     <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={async () => {
                       setExportOpen(false);
                       await exportExcel();
                     }}>
                       <FileSpreadsheet className="mr-2 h-4 w-4"/>
                       Export Excel
                     </button>
                     <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={async () => {
                       setExportOpen(false);
                       await exportPdf();
                     }}>
                       <FileText className="mr-2 h-4 w-4"/>
                       Export PDF
                     </button>
                     <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={() => {
                       setExportOpen(false);
                       handlePrint();
                     }}>
                       <Printer className="mr-2 h-4 w-4"/>
                       Print
                     </button>
                   </div>) : null}
               </div>
              <Button variant="secondary" onClick={clearCurrentDraft} className="w-full sm:w-auto">
                Clear Draft
              </Button>
              <Button variant="secondary" onClick={refreshItems} disabled={loading} className="w-full sm:col-span-2 sm:w-full lg:w-auto">
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                Refresh Admin Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SummaryCards items={[
            { label: "Sources", value: String(items.length), hint: "Admin item names available to the user" },
            { label: "Master Qty", value: `${totalQuantity.toLocaleString()} KG`, hint: "Total quantity from admin data" },
            { label: "Target KG", value: `${Number(targetKg || 0).toLocaleString()} KG`, hint: "Used for the ratio distribution" },
            { label: "Master Amount", value: totalAmount.toLocaleString(), hint: "Stored amount sum from admin data" }
        ]}/>

      <Card className="border-border bg-white shadow-sm rounded-2xl p-6">
        <div className="mb-5 pb-4 border-b border-border">
          <h3 className="text-[18px] font-semibold text-slate-900">Batch Details</h3>
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="batch-no" className="block text-[13px] font-medium text-slate-700 mb-2">Batch No</label>
            <Input
              id="batch-no"
              value={batchDetails.batchNo}
              onChange={(e) => updateBatchDetail("batchNo", e.target.value)}
              placeholder="Enter batch number"
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="batch-date" className="block text-[13px] font-medium text-slate-700 mb-2">Date</label>
            <Input
              id="batch-date"
              type="date"
              value={batchDetails.date}
              onChange={(e) => updateBatchDetail("date", e.target.value)}
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="batch-size" className="block text-[13px] font-medium text-slate-700 mb-2">Batch Size</label>
            <Input
              id="batch-size"
              value={batchDetails.batchSize}
              onChange={(e) => updateBatchDetail("batchSize", e.target.value)}
              placeholder="Enter batch size"
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="specific-gravity" className="block text-[13px] font-medium text-slate-700 mb-2">Specific Gravity</label>
            <Input
              id="specific-gravity"
              value={batchDetails.specificGravity}
              onChange={(e) => updateBatchDetail("specificGravity", e.target.value)}
              placeholder="Enter specific gravity"
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="viscosity" className="block text-[13px] font-medium text-slate-700 mb-2">Viscosity (sec)</label>
            <Input
              id="viscosity"
              value={batchDetails.viscosity}
              onChange={(e) => updateBatchDetail("viscosity", e.target.value)}
              placeholder="Enter seconds"
              className="h-11.5 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          <div className="col-span-12 sm:col-span-6 xl:col-span-4">
            <label htmlFor="actuals" className="block text-[13px] font-medium text-slate-700 mb-2">Actuals</label>
            <Input
              id="actuals"
              value={batchDetails.actuals}
              onChange={(e) => updateBatchDetail("actuals", e.target.value)}
              placeholder="Enter batch notes or actual values"
              className="h-11 rounded-xl border-border bg-white placeholder:text-slate-400 transition-all duration-150 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
        </div>
      </Card>

      <RawMaterialTable actuals={actuals} distributedTotal={distributedTotal} items={items} manualKgValues={manualKgValues} onActualChange={handleActualChange} onManualKgChange={handleManualKgChange} onRemarkChange={handleRemarkChange} onSignatureChange={handleSignatureChange} onTargetKgChange={handleTargetKgChange} remarks={remarks} signatures={signatures} targetKg={targetKg}/>

      <PackSizeTable onAddRow={handleAddPackRow} onDeleteRow={handleDeletePackRow} onPackSizeChange={handlePackSizeChange} onQuantityChange={handlePackQuantityChange} packGrandTotal={packGrandTotal} packRows={packRows}/>
    </div>);
}
