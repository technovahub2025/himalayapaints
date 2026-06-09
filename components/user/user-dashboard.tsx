"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, FileText, LoaderCircle, Printer, RefreshCw, Save } from "lucide-react";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx-js-style";
import { calculateGrandTotal, safePercent, scaleQuantity } from "@/lib/calculations";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { ProductSelector } from "@/components/user/product-selector";
import { RawMaterialTable } from "@/components/user/raw-material-table";
import { PackSizeTable, type PackRow } from "@/components/user/pack-size-table";
import { formatProductLabel } from "@/lib/product-label";
import { toast } from "sonner";

type Item = { _id: string; tableName: string; name: string; quantity: number; rate: number; amount: number };

type BatchDetails = {
  product: string;
  batchNo: string;
  date: string;
  batchSize: string;
  specificGravity: string;
  viscosity: string;
};

type ExportRow = {
  percentage: string;
  source: string;
  editableKgInput: string;
  actuals: string;
  suggestedKg: number;
};

type UserDraft = {
  actuals: Record<string, string>;
  batchDetails: BatchDetails;
  manualKgValues: Record<string, string>;
  packRows: PackRow[];
  remarks: Record<string, string>;
  signatures: Record<string, string>;
  targetKg: string;
};

const EMPTY_BATCH_DETAILS: BatchDetails = {
  product: "",
  batchNo: "",
  date: "",
  batchSize: "",
  specificGravity: "",
  viscosity: ""
};

const EMPTY_PACK_ROWS: PackRow[] = [{ packSize: "", quantity: "" }];
const USER_DRAFT_PREFIX = "himalayapaints:user-dashboard-draft:";

export function UserDashboard({
  initialItems,
  initialTableName,
  tableNames,
  email
}: {
  initialItems: Item[];
  initialTableName: string;
  tableNames: string[];
  email?: string;
}) {
  const router = useRouter();
  const [tableName, setTableName] = useState(initialTableName);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [availableTables, setAvailableTables] = useState<string[]>(
    Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort()
  );
  const [targetKg, setTargetKg] = useState("100");
  const [manualKgValues, setManualKgValues] = useState<Record<string, string>>({});
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [packRows, setPackRows] = useState<PackRow[]>(EMPTY_PACK_ROWS);
  const [batchDetails, setBatchDetails] = useState<BatchDetails>(EMPTY_BATCH_DETAILS);
  const [loading, setLoading] = useState(false);
  const [savingProduction, setSavingProduction] = useState(false);
  const restoringDraftRef = useRef<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setTableName(initialTableName);
    setAvailableTables(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
  }, [initialItems, initialTableName, tableNames]);

  function getDraftStorageKey(name: string) {
    return `${USER_DRAFT_PREFIX}${name.trim() || "Table 1"}`;
  }

  function loadSavedDraft(name: string) {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(getDraftStorageKey(name));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<UserDraft>;
      return {
        actuals: parsed.actuals ?? {},
        batchDetails: { ...EMPTY_BATCH_DETAILS, ...(parsed.batchDetails ?? {}) },
        manualKgValues: parsed.manualKgValues ?? {},
        packRows: parsed.packRows?.length ? parsed.packRows : EMPTY_PACK_ROWS,
        remarks: parsed.remarks ?? {},
        signatures: parsed.signatures ?? {},
        targetKg: parsed.targetKg ?? "100"
      } satisfies UserDraft;
    } catch {
      return null;
    }
  }

  function saveCurrentDraft(name: string) {
    if (typeof window === "undefined") return;
    const draft: UserDraft = {
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

  function clearSavedDraft(name: string) {
    if (typeof window === "undefined") return;
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
    } else {
      resetDraftState();
    }

    const timer = window.setTimeout(() => {
      restoringDraftRef.current = null;
    }, 0);

    return () => window.clearTimeout(timer);
  }, [tableName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (restoringDraftRef.current === tableName) return;
    saveCurrentDraft(tableName);
  }, [actuals, batchDetails, manualKgValues, packRows, remarks, signatures, tableName, targetKg]);

  function updateBatchDetail(key: keyof BatchDetails, value: string) {
    setBatchDetails((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleTargetKgChange(value: string) {
    setTargetKg(value);
    setManualKgValues({});
  }

  function handleManualKgChange(itemId: string, value: string) {
    setManualKgValues((current) => ({
      ...current,
      [itemId]: value
    }));
  }

  function handleActualChange(itemId: string, value: string) {
    setActuals((current) => ({
      ...current,
      [itemId]: value
    }));
  }

  function handleRemarkChange(itemId: string, value: string) {
    setRemarks((current) => ({
      ...current,
      [itemId]: value
    }));
  }

  function handleSignatureChange(itemId: string, value: string) {
    setSignatures((current) => ({
      ...current,
      [itemId]: value
    }));
  }

  function handleAddPackRow() {
    setPackRows((current) => [...current, { packSize: "", quantity: "" }]);
  }

  function handleDeletePackRow(index: number) {
    setPackRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ packSize: "", quantity: "" }];
    });
  }

  function handlePackSizeChange(index: number, value: string) {
    setPackRows((current) =>
      current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, packSize: value } : packRow))
    );
  }

  function handlePackQuantityChange(index: number, value: string) {
    setPackRows((current) =>
      current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, quantity: value } : packRow))
    );
  }

  function clearCurrentDraft() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Clear the saved draft for ${formatProductLabel(tableName || "this product")}?`);
      if (!confirmed) return;
      clearSavedDraft(tableName);
    }
    restoringDraftRef.current = tableName;
    resetDraftState();
    window.setTimeout(() => {
      restoringDraftRef.current = null;
    }, 0);
  }

  async function loadTable(nextTableName: string) {
    const trimmed = nextTableName.trim() || "Table 1";
    setLoading(true);
    try {
      router.replace(`/user?tableName=${encodeURIComponent(trimmed)}`);
      const response = await fetch(`/api/items?tableName=${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load items");
      setItems(data.items ?? []);
      setTableName(trimmed);
      setAvailableTables(Array.from(new Set([trimmed, ...((data.tables ?? []) as string[]).filter(Boolean)])).sort());
      toast.success("Latest admin data loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load items");
    } finally {
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

  const exportRows: ExportRow[] = items.map((item) => {
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

  function formatKgValue(value: string | number) {
    const normalized = String(value).trim();
    return normalized ? `${normalized} kg` : "";
  }

  function formatSecondsValue(value: string | number) {
    const normalized = String(value).trim();
    return normalized ? `${normalized} sec` : "";
  }

  function getRemarkValue(itemId: string) {
    return remarks[itemId] ?? "";
  }

  function getSignatureValue(itemId: string) {
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
          targetKg: targetNumber,
          actualKg: distributedTotal,
          createdBy: email ?? "",
          lines
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save production batch");

      toast.success("Production batch saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save production batch");
    } finally {
      setSavingProduction(false);
    }
  }

  async function exportExcel() {
    const worksheetData = [
      ["PRODUCTION BATCH SHEET"],
      ["PRODUCT:", formatProductLabel(tableName || "Product 1"), "", "BATCH SIZE", "SPECIFIC GRAVITY", "VISCOSITY"],
      ["BATCH NO", batchDetails.batchNo || "", "STD:", targetKg ? `${Number(targetKg).toLocaleString()} KG` : "", batchDetails.specificGravity || "", formatSecondsValue(batchDetails.viscosity)],
      ["DATE", batchDetails.date || "", "ACTUAL:", `${distributedTotal.toLocaleString()} KG`, "", ""],
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

    function ensureCell(row: number, col: number) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[address]) {
        worksheet[address] = { t: "s", v: "" };
      }
      return worksheet[address];
    }

    function styleRange(startRow: number, endRow: number, startCol: number, endCol: number, style: Record<string, unknown>) {
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

  function createPdfDocument() {
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

    const drawCell = (
      x: number,
      y: number,
      w: number,
      h: number,
      text = "",
      opts?: {
        align?: "left" | "center" | "right";
        bold?: boolean;
        fillColor?: [number, number, number] | null;
        textColor?: [number, number, number];
        fontSize?: number;
        paddingX?: number;
      }
    ) => {
      const {
        align = "left",
        bold = false,
        fillColor = null,
        textColor = [0, 0, 0],
        fontSize = 7.5,
        paddingX = 2
      } = opts ?? {};
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      if (fillColor) {
        doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
        doc.rect(x, y, w, h, "FD");
      } else {
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
    drawCell(xPositions[4], y, colWidths[4], 7, "", { bold: false });
    drawCell(xPositions[5], y, colWidths[5], 7, "", { bold: false });

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
    const doc = createPdfDocument();
    doc.save(`${tableName || "table"}-production-sheet.pdf`);
  }

  function handlePrint() {
    const doc = createPdfDocument();
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Title>User Dashboard</Title>
          <Subtitle>Read-only master data from admin with live percentage distribution and production outputs.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="w-full max-w-none rounded-3xl border border-line bg-white/80 p-3 shadow-sm backdrop-blur print:hidden sm:p-4 lg:max-w-4xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <ProductSelector
              value={tableName}
              options={availableTables}
              onSelect={loadTable}
              disabled={loading}
            />
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:flex lg:flex-wrap lg:justify-end">
              <Button variant="secondary" onClick={saveProductionBatch} disabled={savingProduction || loading} className="w-full sm:w-auto">
                {savingProduction ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Production
              </Button>
              <Button variant="secondary" onClick={exportExcel} className="w-full sm:w-auto">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              <Button variant="secondary" onClick={exportPdf} className="w-full sm:w-auto">
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button variant="secondary" onClick={handlePrint} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="secondary" onClick={clearCurrentDraft} className="w-full sm:w-auto">
                Clear Draft
              </Button>
              <Button variant="secondary" onClick={refreshItems} disabled={loading} className="w-full sm:col-span-2 sm:w-full lg:w-auto">
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Admin Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SummaryCards
        items={[
          { label: "Sources", value: String(items.length), hint: "Admin item names available to the user" },
          { label: "Master Qty", value: `${totalQuantity.toLocaleString()} KG`, hint: "Total quantity from admin data" },
          { label: "Target KG", value: `${Number(targetKg || 0).toLocaleString()} KG`, hint: "Used for the ratio distribution" },
          { label: "Master Amount", value: totalAmount.toLocaleString(), hint: "Stored amount sum from admin data" }
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold">Batch Details</p>
            <p className="text-sm text-muted">Enter production metadata here before exporting or printing.</p>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="rounded-2xl border border-line bg-slate-50/70 px-4 py-4 xl:col-span-4">
              <label className="text-xs font-semibold tracking-[0.22em] text-muted">BATCH NO</label>
              <Input
                value={batchDetails.batchNo}
                onChange={(e) => updateBatchDetail("batchNo", e.target.value)}
                placeholder="Enter batch number"
                className="mt-3"
              />
            </div>

            <div className="rounded-2xl border border-line bg-slate-50/70 px-4 py-4 xl:col-span-4">
              <label className="text-xs font-semibold tracking-[0.22em] text-muted">DATE</label>
              <Input
                type="date"
                value={batchDetails.date}
                onChange={(e) => updateBatchDetail("date", e.target.value)}
                className="mt-3"
              />
            </div>

            <div className="rounded-2xl border border-line bg-slate-50/70 px-4 py-4 xl:col-span-4">
              <label className="text-xs font-semibold tracking-[0.22em] text-muted">BATCH SIZE</label>
              <Input
                value={batchDetails.batchSize}
                onChange={(e) => updateBatchDetail("batchSize", e.target.value)}
                placeholder="Enter batch size"
                className="mt-3"
              />
            </div>

            <div className="rounded-2xl border border-line bg-slate-50/70 px-4 py-4 xl:col-span-6">
              <label className="text-xs font-semibold tracking-[0.22em] text-muted">SPECIFIC GRAVITY</label>
              <Input
                value={batchDetails.specificGravity}
                onChange={(e) => updateBatchDetail("specificGravity", e.target.value)}
                placeholder="Enter specific gravity"
                className="mt-3"
              />
            </div>

            <div className="rounded-2xl border border-line bg-slate-50/70 px-4 py-4 xl:col-span-6">
              <label className="text-xs font-semibold tracking-[0.22em] text-muted">VISCOSITY (SEC)</label>
              <Input
                value={batchDetails.viscosity}
                onChange={(e) => updateBatchDetail("viscosity", e.target.value)}
                placeholder="Enter seconds"
                className="mt-3"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <RawMaterialTable
        actuals={actuals}
        distributedTotal={distributedTotal}
        items={items}
        manualKgValues={manualKgValues}
        onActualChange={handleActualChange}
        onManualKgChange={handleManualKgChange}
        onRemarkChange={handleRemarkChange}
        onSignatureChange={handleSignatureChange}
        onTargetKgChange={handleTargetKgChange}
        remarks={remarks}
        signatures={signatures}
        targetKg={targetKg}
      />

      <PackSizeTable
        onAddRow={handleAddPackRow}
        onDeleteRow={handleDeletePackRow}
        onPackSizeChange={handlePackSizeChange}
        onQuantityChange={handlePackQuantityChange}
        packGrandTotal={packGrandTotal}
        packRows={packRows}
      />
    </div>
  );
}
