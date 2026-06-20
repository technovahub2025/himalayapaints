"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileSpreadsheet, FileText } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { formatProductLabel } from "@/lib/product-label";
import { toast } from "sonner";
const HISTORY_PAGE_SIZE = 7;
export function TrackingDashboard({ email, role }) {
    const [productionBatches, setProductionBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [quickFilter, setQuickFilter] = useState("all");
    const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
    const historyScrollRef = useRef(null);
    const historyLoadMoreRef = useRef(null);
    const batchDetailsRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        async function loadData() {
            setLoading(true);
            try {
                const productionResponse = await fetch("/api/production");
                const productionData = await productionResponse.json();
                if (cancelled)
                    return;
                if (!productionResponse.ok)
                    throw new Error(productionData.message || "Failed to load production data");
                setProductionBatches(Array.isArray(productionData.batches) ? productionData.batches : []);
                setSelectedBatchId("");
            }
            catch (error) {
                if (!cancelled) {
                    toast.error(error instanceof Error ? error.message : "Failed to load tracking data");
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        loadData();
        return () => {
            cancelled = true;
        };
    }, []);
    const filteredBatches = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle)
            return productionBatches;
        return productionBatches.filter((batch) => {
            const searchable = [
                batch.productName,
                formatProductLabel(batch.productName),
                batch.batchNo,
                batch.batchSize,
                batch.specificGravity,
                batch.viscosity,
                batch.createdBy,
                batch.createdAt,
                String(batch.targetKg),
                String(batch.actualKg),
                batch.lines
                    .map((line) => [line.materialName, line.remarks, line.signature, line.actualQty, line.stdQty].join(" "))
                    .join(" ")
            ]
                .join(" ")
                .toLowerCase();
            return searchable.includes(needle);
        });
    }, [productionBatches, searchTerm]);
    const selectedBatch = productionBatches.find((batch) => batch._id === selectedBatchId) ?? null;
    const selectedPackRows = Array.isArray(selectedBatch?.packRows) ? selectedBatch.packRows : [];
    const visiblePackRows = selectedPackRows.filter((row) => row.packSize.trim() !== "" || row.quantity.trim() !== "");
    const visibleBatches = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diffToMonday = (day + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        const nextFiltered = filteredBatches.filter((batch) => {
            const createdAt = new Date(batch.createdAt);
            if (quickFilter === "today") {
                return createdAt >= startOfToday;
            }
            if (quickFilter === "week") {
                return createdAt >= startOfWeek;
            }
            if (quickFilter === "remarks") {
                return batch.lines.some((line) => Boolean(line.remarks.trim()));
            }
            return true;
        });
        return nextFiltered.slice(0, visibleCount);
    }, [filteredBatches, quickFilter, visibleCount]);
    useEffect(() => {
        setVisibleCount(HISTORY_PAGE_SIZE);
    }, [searchTerm, quickFilter, productionBatches]);
    useEffect(() => {
        const root = historyScrollRef.current;
        const target = historyLoadMoreRef.current;
        if (!root || !target) {
            return;
        }
        if (visibleCount >= filteredBatches.length) {
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting) {
                return;
            }
            setVisibleCount((current) => Math.min(current + HISTORY_PAGE_SIZE, filteredBatches.length));
        }, {
            root,
            rootMargin: "120px"
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [filteredBatches.length, visibleCount]);
    function formatDateTime(value) {
        return value ? new Date(value).toLocaleString() : "-";
    }
    function formatSecondsValue(value) {
        const normalized = String(value ?? "").trim();
        return normalized ? `${normalized} sec` : "";
    }
    async function exportBatchExcel(batch) {
        const XLSX = await import("xlsx-js-style");
        const packRows = Array.isArray(batch.packRows) ? batch.packRows.filter((row) => row.packSize.trim() !== "" || row.quantity.trim() !== "") : [];
        const worksheetData = [
            ["PRODUCTION BATCH SHEET"],
            ["PRODUCT:", formatProductLabel(batch.productName || "Product 1"), "", "BATCH SIZE", "SPECIFIC GRAVITY", "VISCOSITY", ""],
            ["BATCH NO", batch.batchNo || "", "STD:", batch.targetKg ? `${Number(batch.targetKg).toLocaleString()} KG` : "", batch.specificGravity || "", formatSecondsValue(batch.viscosity), ""],
            ["DATE", formatDateTime(batch.createdAt), "ACTUAL:", "", batch.actualKg ? `${Number(batch.actualKg).toLocaleString()} KG` : "", "", ""],
            [],
            ["%", "RAW MATERIAL CODE", "STD QTY", "ACTUAL QTY", "REMARKS", "SIGNATURE"],
            ...batch.lines.map((line) => [
                `${line.percentage.toFixed(2)}%`,
                line.materialName,
                line.stdQty.toLocaleString(),
                line.actualQty.toLocaleString(),
                line.remarks || "",
                line.signature || ""
            ]),
            ["TOTAL", "Materials", batch.actualKg.toLocaleString(), "", "", ""]
        ];
        if (packRows.length > 0) {
            worksheetData.push([], ["PACK SIZE", "QTY", "TOTAL"]);
            let packGrandTotal = 0;
            packRows.forEach((row) => {
                const rowTotal = Number(row.packSize || 0) * Number(row.quantity || 0);
                packGrandTotal += rowTotal;
                worksheetData.push([row.packSize || "", row.quantity || "", String(rowTotal)]);
            });
            worksheetData.push(["BULK", "", String(packGrandTotal)]);
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
        const rawDataEnd = rawDataStart + batch.lines.length - 1;
        const rawTotalRow = rawDataEnd + 1;
        const packHeaderRow = rawTotalRow + 2;
        const packDataStart = packHeaderRow + 1;
        const packDataEnd = packDataStart + packRows.length - 1;
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
        if (packRows.length > 0) {
            worksheet["!rows"][packHeaderRow] = { hpt: 18 };
            worksheet["!rows"][packTotalRow] = { hpt: 20 };
        }
        worksheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
        ];
        styleRange(0, 0, 0, 5, {
            font: { ...boldFont, sz: 14 },
            alignment: center,
            fill: titleFill,
            border
        });
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
        if (packRows.length > 0) {
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
        XLSX.utils.book_append_sheet(workbook, worksheet, `${formatProductLabel(batch.productName || "Product 1")}`);
        XLSX.writeFile(workbook, `${(batch.batchNo || "batch").trim()}-production-history.xlsx`);
        toast.success("Batch exported to Excel");
    }
    async function exportBatchPdf(batch) {
        const { jsPDF } = await import("jspdf");
        const packRows = Array.isArray(batch.packRows) ? batch.packRows.filter((row) => row.packSize.trim() !== "" || row.quantity.trim() !== "") : [];
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
        drawCell(xPositions[1], y, colWidths[1] + colWidths[2], 7, formatProductLabel(batch.productName || "Product 1"), { bold: false });
        drawCell(xPositions[3], y, colWidths[3], 7, "BATCH SIZE", { bold: true });
        drawCell(xPositions[4], y, colWidths[4], 7, "SPECIFIC GRAVITY", { bold: true });
        drawCell(xPositions[5], y, colWidths[5], 7, "VISCOSITY", { bold: true });
        y += 7;
        drawCell(xPositions[0], y, colWidths[0], 7, "BATCH NO", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, batch.batchNo || "", { bold: false });
        drawCell(xPositions[2], y, colWidths[2], 7, "STD:", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, batch.targetKg ? `${Number(batch.targetKg).toLocaleString()} KG` : "", { bold: false });
        drawCell(xPositions[4], y, colWidths[4], 7, batch.specificGravity || "", { bold: false });
        drawCell(xPositions[5], y, colWidths[5], 7, formatSecondsValue(batch.viscosity), { bold: false });
        y += 7;
        drawCell(xPositions[0], y, colWidths[0], 7, "DATE", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, formatDateTime(batch.createdAt), { bold: false });
        drawCell(xPositions[2], y, colWidths[2], 7, "ACTUAL:", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, "", { bold: false });
        drawCell(xPositions[4], y, colWidths[4], 7, batch.actualKg ? `${Number(batch.actualKg).toLocaleString()} KG` : "", { bold: false });
        drawCell(xPositions[5], y, colWidths[5], 7, "", { bold: false });
        y += 10;
        drawCell(xPositions[0], y, colWidths[0], 7, "%", { bold: true });
        drawCell(xPositions[1], y, colWidths[1], 7, "RAW MATERIAL CODE", { bold: true });
        drawCell(xPositions[2], y, colWidths[2], 7, "STD QTY", { bold: true });
        drawCell(xPositions[3], y, colWidths[3], 7, "ACTUAL QTY", { bold: true });
        drawCell(xPositions[4], y, colWidths[4], 7, "REMARKS", { bold: true });
        drawCell(xPositions[5], y, colWidths[5], 7, "SIGNATURE", { bold: true });
        const rowHeight = 7;
        y += 7;
        for (let i = 0; i < batch.lines.length; i += 1) {
            const line = batch.lines[i];
            drawCell(xPositions[0], y, colWidths[0], rowHeight, `${Number(line.percentage || 0).toFixed(2)}%`, { align: "center" });
            drawCell(xPositions[1], y, colWidths[1], rowHeight, line.materialName || "", { align: "left" });
            drawCell(xPositions[2], y, colWidths[2], rowHeight, `${Number(line.stdQty || 0).toLocaleString()} KG`, { align: "center" });
            drawCell(xPositions[3], y, colWidths[3], rowHeight, `${Number(line.actualQty || 0).toLocaleString()} KG`, { align: "center" });
            drawCell(xPositions[4], y, colWidths[4], rowHeight, line.remarks || "", { align: "left" });
            drawCell(xPositions[5], y, colWidths[5], rowHeight, line.signature || "", { align: "left" });
            y += rowHeight;
        }
        y += 10;
        if (packRows.length > 0) {
            const packGrandTotal = packRows.reduce((sum, row) => sum + Number(row.packSize || 0) * Number(row.quantity || 0), 0);
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
            for (let i = 0; i < packRows.length; i += 1) {
                const row = packRows[i];
                drawCell(xPositions[0], y, colWidths[0], rowHeight, row?.packSize || "", { align: "center" });
                drawCell(xPositions[1], y, colWidths[1], rowHeight, row?.quantity || "", { align: "center" });
                drawCell(xPositions[2], y, colWidths[2], rowHeight, row ? String(Number(row.packSize || 0) * Number(row.quantity || 0)) : "", { align: "center" });
                y += rowHeight;
            }
            drawCell(xPositions[0], y, colWidths[0], rowHeight, "BULK", {
                bold: true,
                textColor: [220, 38, 38]
            });
            drawCell(xPositions[1], y, colWidths[1], rowHeight, "", { align: "center" });
            drawCell(xPositions[2], y, colWidths[2], rowHeight, String(packGrandTotal), {
                bold: true,
                textColor: [220, 38, 38]
            });
        }
        doc.save(`${(batch.batchNo || "batch").trim()}-production-history.pdf`);
        toast.success("Batch exported to PDF");
    }
    function handleViewBatch(batchId) {
        setSelectedBatchId(batchId);
        window.requestAnimationFrame(() => {
            batchDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
    return (<div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Title>Tracking</Title>
          <Subtitle>Dedicated page for production history across all products.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="w-full max-w-2xl rounded-3xl border border-line bg-white/80 p-4 shadow-sm backdrop-blur">
          <label className="mb-2 block text-sm font-medium text-ink">Search</label>
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search product, batch no, material, remarks..."/>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={quickFilter === "all" ? "primary" : "secondary"} onClick={() => setQuickFilter("all")} className="h-10">
              All
            </Button>
            <Button variant={quickFilter === "today" ? "primary" : "secondary"} onClick={() => setQuickFilter("today")} className="h-10">
              Today
            </Button>
            <Button variant={quickFilter === "week" ? "primary" : "secondary"} onClick={() => setQuickFilter("week")} className="h-10">
              This Week
            </Button>
            <Button variant={quickFilter === "remarks" ? "primary" : "secondary"} onClick={() => setQuickFilter("remarks")} className="h-10">
              Has Remarks
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold">Production History</p>
            <p className="text-sm text-muted">
              {visibleBatches.length.toLocaleString()} of {productionBatches.length.toLocaleString()} batches
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div ref={historyScrollRef} className="max-h-[620px] overflow-auto">
            <table className="min-w-[1100px] w-full border-collapse">
              <thead className="bg-slate-50 text-left text-sm text-muted">
                <tr>
                  <th className="px-5 py-4 font-medium">Product</th>
                  <th className="px-5 py-4 font-medium">Batch No</th>
                  <th className="px-5 py-4 font-medium">Actual KG</th>
                  <th className="px-5 py-4 font-medium">Materials</th>
                  <th className="px-5 py-4 font-medium">Created At</th>
                  <th className="px-5 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (<tr>
                    <td className="px-5 py-6 text-sm text-muted" colSpan={6}>
                      Loading production history...
                    </td>
                  </tr>) : visibleBatches.length > 0 ? (visibleBatches.map((batch) => (<tr key={batch._id} className="border-t border-line">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink">{formatProductLabel(batch.productName)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-ink">{batch.batchNo || "N/A"}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-ink">{batch.actualKg.toLocaleString()} KG</td>
                      <td className="px-5 py-4 text-sm text-muted">{batch.lines.length} items</td>
                      <td className="px-5 py-4 text-sm text-muted">{formatDateTime(batch.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <Button variant="secondary" onClick={() => handleViewBatch(batch._id)}>
                            <Eye className="mr-2 h-4 w-4"/>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>))) : (<tr>
                    <td className="px-5 py-6 text-sm text-muted" colSpan={6}>
                      {searchTerm.trim() || quickFilter !== "all" ? "No batches match your filters." : "No production batches saved yet."}
                    </td>
                  </tr>)}
              </tbody>
            </table>
            {visibleCount < filteredBatches.length ? (<div ref={historyLoadMoreRef} className="px-5 py-4 text-center text-xs text-muted">
                Loading more batches...
              </div>) : null}
          </div>
        </CardBody>
      </Card>

      <div ref={batchDetailsRef}>
        <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-lg font-semibold tracking-tight">Batch Details</p>
            </div>
            {selectedBatch ? (<div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => exportBatchExcel(selectedBatch)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4"/>
                  Export Excel
                </Button>
                <Button variant="secondary" onClick={() => exportBatchPdf(selectedBatch)}>
                  <FileText className="mr-2 h-4 w-4"/>
                  Export PDF
                </Button>
              </div>) : null}
          </div>
        </CardHeader>
        <CardBody className="p-5 sm:p-6">
          {selectedBatch ? (<div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Product</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{formatProductLabel(selectedBatch.productName)}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Batch No</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.batchNo || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Actual Kg</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.actualKg.toLocaleString()} KG</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Materials</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.lines.length.toLocaleString()} items</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Batch Size</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.batchSize || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Specific Gravity</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.specificGravity || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Viscosity</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.viscosity ? `${selectedBatch.viscosity} sec` : "-"}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Target Kg</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.targetKg.toLocaleString()} KG</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Created At</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{formatDateTime(selectedBatch.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-line/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Created By</p>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{selectedBatch.createdBy || "-"}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-line/80 bg-white">
                <table className="min-w-[900px] w-full border-collapse">
                  <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">%</th>
                      <th className="px-4 py-3 font-semibold">Raw Material</th>
                      <th className="px-4 py-3 font-semibold">Std Qty</th>
                      <th className="px-4 py-3 font-semibold">Actual Qty</th>
                      <th className="px-4 py-3 font-semibold">Remarks</th>
                      <th className="px-4 py-3 font-semibold">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.lines.length > 0 ? (selectedBatch.lines.map((line, index) => (<tr key={`${selectedBatch._id}-${index}`} className="border-t border-line">
                          <td className="px-4 py-3 text-sm text-muted">{line.percentage.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-sm font-semibold text-ink">{line.materialName}</td>
                          <td className="px-4 py-3 text-sm text-muted">{line.stdQty.toLocaleString()} KG</td>
                          <td className="px-4 py-3 text-sm text-muted">{line.actualQty.toLocaleString()} KG</td>
                          <td className="px-4 py-3 text-sm text-muted">{line.remarks || "-"}</td>
                          <td className="px-4 py-3 text-sm text-muted">{line.signature || "-"}</td>
                        </tr>))) : (<tr>
                        <td className="px-4 py-5 text-sm text-muted" colSpan={6}>
                          No material lines saved for this batch.
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-line/80 bg-white">
                <table className="min-w-[600px] w-full border-collapse">
                  <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Pack Size</th>
                      <th className="px-4 py-3 font-semibold">Qty</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePackRows.length > 0 ? (visiblePackRows.map((row, index) => {
                  const total = Number(row.packSize || 0) * Number(row.quantity || 0);
                  return (<tr key={`${selectedBatch._id}-pack-${index}`} className="border-t border-line/70">
                          <td className="px-4 py-3 text-sm text-ink">{row.packSize || "-"}</td>
                          <td className="px-4 py-3 text-sm text-ink">{row.quantity || "-"}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-ink">{total.toLocaleString()}</td>
                        </tr>);
                })) : (<tr>
                        <td className="px-4 py-5 text-sm text-muted" colSpan={3}>
                          No pack size rows saved for this batch.
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>) : (<p className="text-sm text-muted">Click View on any batch to inspect details and export that batch.</p>)}
        </CardBody>
        </Card>
      </div>
    </div>);
}
