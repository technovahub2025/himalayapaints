"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileSpreadsheet, FileText } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { formatProductLabel } from "@/lib/product-label";
import { apiRequest } from "@/services/api-client";
import { toast } from "sonner";
export function TrackingDashboard({ email, role }) {
    const [productionBatches, setProductionBatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [quickFilter, setQuickFilter] = useState("all");
    const batchDetailsRef = useRef(null);
    useEffect(() => {
        let cancelled = false;
        async function loadData() {
            setLoading(true);
            try {
                const productionResponse = await apiRequest("/api/production");
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
    const visibleBatches = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diffToMonday = (day + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        return filteredBatches.filter((batch) => {
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
    }, [filteredBatches, quickFilter]);
    function formatDateTime(value) {
        return value ? new Date(value).toLocaleString() : "-";
    }
    async function exportBatchExcel(batch) {
        const XLSX = await import("xlsx-js-style");
        const worksheetData = [
            ["PRODUCTION BATCH SHEET"],
            ["PRODUCT:", formatProductLabel(batch.productName), "", "BATCH SIZE", batch.batchSize || "", "VISCOSITY", batch.viscosity || ""],
            ["BATCH NO", batch.batchNo || "", "SPECIFIC GRAVITY", batch.specificGravity || "", "TARGET KG", batch.targetKg.toLocaleString()],
            ["CREATED BY", batch.createdBy || "-", "ACTUAL KG", batch.actualKg.toLocaleString(), "CREATED AT", formatDateTime(batch.createdAt)],
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
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${formatProductLabel(batch.productName)}`);
        XLSX.writeFile(workbook, `${(batch.batchNo || "batch").trim()}-production-history.xlsx`);
        toast.success("Batch exported to Excel");
    }
    async function exportBatchPdf(batch) {
        const { jsPDF } = await import("jspdf");
        const autoTableModule = await import("jspdf-autotable");
        const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(16);
        doc.text("PRODUCTION BATCH SHEET", 14, 16);
        doc.setFontSize(10);
        doc.text(`Product: ${formatProductLabel(batch.productName)}`, 14, 24);
        doc.text(`Batch No: ${batch.batchNo || "-"}`, 14, 30);
        doc.text(`Created At: ${formatDateTime(batch.createdAt)}`, 14, 36);
        doc.text(`Actual KG: ${batch.actualKg.toLocaleString()}`, 14, 42);
        autoTable(doc, {
            startY: 50,
            head: [["%", "Raw Material", "Std Qty", "Actual Qty", "Remarks", "Signature"]],
            body: batch.lines.map((line) => [
                `${line.percentage.toFixed(2)}%`,
                line.materialName,
                line.stdQty.toLocaleString(),
                line.actualQty.toLocaleString(),
                line.remarks || "",
                line.signature || ""
            ])
        });
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
          <div className="overflow-x-auto">
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
          </div>
        </CardBody>
      </Card>

      <div ref={batchDetailsRef}>
        <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">Batch Details</p>
              <p className="text-sm text-muted">View the selected batch here and export it without leaving this page.</p>
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
        <CardBody>
          {selectedBatch ? (<div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">PRODUCT</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{formatProductLabel(selectedBatch.productName)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">BATCH NO</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.batchNo || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">ACTUAL KG</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.actualKg.toLocaleString()} KG</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">MATERIALS</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.lines.length.toLocaleString()} ITEMS</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">BATCH SIZE</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.batchSize || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">SPECIFIC GRAVITY</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.specificGravity || "-"}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">VISCOSITY</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.viscosity ? `${selectedBatch.viscosity} sec` : "-"}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">TARGET KG</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.targetKg.toLocaleString()} KG</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">CREATED AT</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{formatDateTime(selectedBatch.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted">CREATED BY</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{selectedBatch.createdBy || "-"}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-line">
                <table className="min-w-[900px] w-full border-collapse">
                  <thead className="bg-slate-50 text-left text-sm text-muted">
                    <tr>
                      <th className="px-5 py-4 font-medium">%</th>
                      <th className="px-5 py-4 font-medium">Raw Material</th>
                      <th className="px-5 py-4 font-medium">Std Qty</th>
                      <th className="px-5 py-4 font-medium">Actual Qty</th>
                      <th className="px-5 py-4 font-medium">Remarks</th>
                      <th className="px-5 py-4 font-medium">Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBatch.lines.length > 0 ? (selectedBatch.lines.map((line, index) => (<tr key={`${selectedBatch._id}-${index}`} className="border-t border-line">
                          <td className="px-5 py-4 text-sm text-muted">{line.percentage.toFixed(2)}%</td>
                          <td className="px-5 py-4 font-semibold text-ink">{line.materialName}</td>
                          <td className="px-5 py-4 text-sm text-muted">{line.stdQty.toLocaleString()} KG</td>
                          <td className="px-5 py-4 text-sm text-muted">{line.actualQty.toLocaleString()} KG</td>
                          <td className="px-5 py-4 text-sm text-muted">{line.remarks || "-"}</td>
                          <td className="px-5 py-4 text-sm text-muted">{line.signature || "-"}</td>
                        </tr>))) : (<tr>
                        <td className="px-5 py-6 text-sm text-muted" colSpan={6}>
                          No material lines saved for this batch.
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
