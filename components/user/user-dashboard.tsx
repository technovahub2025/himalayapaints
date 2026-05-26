"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, LoaderCircle, RefreshCw, Plus, Trash2 } from "lucide-react";
import { calculateGrandTotal, safePercent, scaleQuantity } from "@/lib/calculations";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { toast } from "sonner";

type Item = { _id: string; name: string; quantity: number; rate: number; amount: number };

type PackRow = { packSize: string; quantity: string };

type ExportRow = {
  percentage: string;
  source: string;
  editableKgInput: string;
  actuals: string;
  suggestedKg: number;
};

export function UserDashboard({ initialItems, email }: { initialItems: Item[]; email?: string }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [targetKg, setTargetKg] = useState("100");
  const [manualKgValues, setManualKgValues] = useState<Record<string, string>>({});
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [packRows, setPackRows] = useState<PackRow[]>([{ packSize: "", quantity: "" }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setManualKgValues({});
  }, [targetKg]);

  async function refreshItems() {
    setLoading(true);
    try {
      const response = await fetch("/api/items");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load items");
      setItems(data.items);
      toast.success("Latest admin data loaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load items");
    } finally {
      setLoading(false);
    }
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

  function buildCsv() {
    const header = ["Percentage", "Source", "Editable KG Input", "Actuals"];
    const lines = exportRows.map((row) =>
      [row.percentage, row.source, row.editableKgInput, row.actuals]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );
    return [header.join(","), ...lines].join("\n");
  }

  async function exportCsv() {
    const csv = buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "user-table.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const worksheetData = [
      ["Percentage", "Source", "Editable KG Input", "Actuals"],
      ...exportRows.map((row) => [row.percentage, row.source, row.editableKgInput, row.actuals])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "User Table");
    XLSX.writeFile(workbook, "user-table.xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("User Table", 14, 16);
    doc.setFontSize(10);
    doc.text(`Target KG: ${targetNumber.toLocaleString()}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [["Percentage", "Source", "Editable KG Input", "Actuals"]],
      body: exportRows.map((row) => [row.percentage, row.source, row.editableKgInput, row.actuals])
    });

    doc.save("user-table.pdf");
  }

  function buildPackCsv() {
    const header = ["Row", "Pack Size", "Quantity", "Result"];
    const lines = [
      ...packExportRows.map((row) =>
        [row.rowNumber, row.packSize, row.quantity, row.result]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      ),
      ["Grand Total", "", "", packGrandTotal].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
    ];
    return [header.join(","), ...lines].join("\n");
  }

  async function exportPackCsv() {
    const csv = buildPackCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pack-size-calculator.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportPackExcel() {
    const XLSX = await import("xlsx");
    const worksheetData = [
      ["Row", "Pack Size", "Quantity", "Result"],
      ...packExportRows.map((row) => [row.rowNumber, row.packSize, row.quantity, row.result]),
      ["Grand Total", "", "", packGrandTotal]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pack Calculator");
    XLSX.writeFile(workbook, "pack-size-calculator.xlsx");
  }

  async function exportPackPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Pack Size Calculator", 14, 16);

    autoTable(doc, {
      startY: 24,
      head: [["Row", "Pack Size", "Quantity", "Result"]],
      body: [
        ...packExportRows.map((row) => [String(row.rowNumber), row.packSize, row.quantity, row.result.toLocaleString()]),
        ["Grand Total", "", "", packGrandTotal.toLocaleString()]
      ]
    });

    doc.save("pack-size-calculator.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Title>User Dashboard</Title>
          <Subtitle>Read-only master data from admin with live percentage distribution and production outputs.</Subtitle>
          {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={exportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="secondary" onClick={refreshItems} disabled={loading}>
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Admin Data
          </Button>
        </div>
      </div>

      <SummaryCards
        items={[
          { label: "Sources", value: String(items.length), hint: "Admin item names available to the user" },
          { label: "Master Qty", value: `${totalQuantity.toLocaleString()} KG`, hint: "Total quantity from admin table" },
          { label: "Target KG", value: `${Number(targetKg || 0).toLocaleString()} KG`, hint: "Used for the ratio distribution" },
          { label: "Master Amount", value: totalAmount.toLocaleString(), hint: "Stored amount sum from admin table" }
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-lg font-semibold">Production Ratio Table</p>
              <p className="text-sm text-muted">
                Percentage = item quantity divided by total quantity. The editable KG field uses those percentages to allocate the target.
              </p>
            </div>
            <div className="grid w-full gap-3 md:max-w-sm">
              <label className="text-sm font-medium text-ink">Target Production KG</label>
              <Input type="number" min="0" step="0.01" value={targetKg} onChange={(e) => setTargetKg(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse">
              <thead className="bg-slate-50 text-left text-sm text-muted">
                <tr>
                  <th className="px-5 py-4 font-medium">Percentage</th>
                  <th className="px-5 py-4 font-medium">Source</th>
                  <th className="px-5 py-4 font-medium">Editable KG Input</th>
                  <th className="px-5 py-4 font-medium">Actuals</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const percentage = safePercent(item.quantity, totalQuantity);
                  const suggestedKg = scaleQuantity(item.quantity, targetNumber);
                  const kgValue = manualKgValues[item._id] ?? String(suggestedKg);
                  const actualValue = actuals[item._id] ?? "";
                  return (
                    <tr key={item._id} className="border-t border-line">
                      <td className="px-5 py-4 align-top">
                        <div className="inline-flex rounded-2xl bg-accentSoft px-4 py-3 text-sm font-semibold text-accent">
                          {percentage.toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="text-sm font-semibold text-ink">{item.name}</div>
                        <div className="mt-1 text-xs text-muted">Master qty: {item.quantity} KG</div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={kgValue}
                          onChange={(e) =>
                            setManualKgValues((current) => ({
                              ...current,
                              [item._id]: e.target.value
                            }))
                          }
                          placeholder={suggestedKg.toString()}
                        />
                        <p className="mt-2 text-xs text-muted">Suggested based on percentage: {suggestedKg.toLocaleString()} KG</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={actualValue}
                          onChange={(e) =>
                            setActuals((current) => ({
                              ...current,
                              [item._id]: e.target.value
                            }))
                          }
                          placeholder="Enter actuals"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-line bg-slate-50">
                <tr>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">Total</td>
                  <td className="px-5 py-4 text-sm text-muted">Dynamic source list</td>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">{distributedTotal.toLocaleString()} KG</td>
                  <td className="px-5 py-4 text-sm text-muted">Manual actuals only</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-lg font-semibold">Pack Size Calculator</p>
              <p className="text-sm text-muted">Result = Pack Size Ã— Quantity, with add and delete row support.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={exportPackCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="secondary" onClick={exportPackExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              <Button variant="secondary" onClick={exportPackPdf}>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button variant="secondary" onClick={() => setPackRows((current) => [...current, { packSize: "", quantity: "" }])}>
                <Plus className="mr-2 h-4 w-4" />
                Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse">
              <thead className="bg-slate-50 text-left text-sm text-muted">
                <tr>
                  <th className="px-5 py-4 font-medium">Pack Size</th>
                  <th className="px-5 py-4 font-medium">Quantity</th>
                  <th className="px-5 py-4 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {packRows.map((row, index) => {
                  const result = Number(row.packSize || 0) * Number(row.quantity || 0);
                  return (
                    <tr key={`${index}-${row.packSize}`} className="border-t border-line">
                      <td className="px-5 py-4">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.packSize}
                          onChange={(e) =>
                            setPackRows((current) =>
                              current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, packSize: e.target.value } : packRow))
                            )
                          }
                          placeholder="5"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.quantity}
                            onChange={(e) =>
                              setPackRows((current) =>
                                current.map((packRow, rowIndex) => (rowIndex === index ? { ...packRow, quantity: e.target.value } : packRow))
                              )
                            }
                            placeholder="20"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPackRows((current) => {
                                const next = current.filter((_, rowIndex) => rowIndex !== index);
                                return next.length > 0 ? next : [{ packSize: "", quantity: "" }];
                              })
                            }
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete pack row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex h-11 items-center rounded-2xl border border-line bg-slate-50 px-4 text-sm font-semibold text-ink">
                          {result.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-line bg-slate-50">
                <tr>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">Grand Total</td>
                  <td className="px-5 py-4 text-sm text-muted">Auto calculated</td>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">{packGrandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
