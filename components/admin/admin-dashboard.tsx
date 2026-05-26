"use client";

import { useEffect, useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { calculateAmount, calculateGrandTotal } from "@/lib/calculations";
import { Button, Card, CardBody, CardHeader, Input, Subtitle, Title } from "@/components/ui";
import { toast } from "sonner";

export type AdminRow = {
  id?: string;
  name: string;
  quantity: string;
  rate: string;
};

function normalizeRow(row: AdminRow) {
  return {
    id: row.id,
    name: row.name.trim(),
    quantity: Number(row.quantity),
    rate: Number(row.rate)
  };
}

function formatRate(rate: string | number) {
  return `${rate}/KG`;
}

function toCsv(rows: Array<AdminRow & { amount: number }>, totalAmount: number) {
  const header = ["Item Name", "Quantity", "Rate", "Amount"];
  const lines = rows.map((row) =>
    [row.name, row.quantity, formatRate(row.rate), row.amount].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
  );
  lines.push(["Grand Total", "", "", totalAmount].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...lines].join("\n");
}

export function AdminDashboard({
  initialItems
}: {
  initialItems: Array<{ _id: string; name: string; quantity: number; rate: number }>;
}) {
  const [rows, setRows] = useState<AdminRow[]>(
    initialItems.length > 0
      ? initialItems.map((item) => ({
          id: item._id,
          name: item.name,
          quantity: String(item.quantity),
          rate: String(item.rate)
        }))
      : [{ name: "", quantity: "", rate: "" }]
  );
  const [loading, setLoading] = useState(false);
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (initialItems.length > 0) {
      setRows(
        initialItems.map((item) => ({
          id: item._id,
          name: item.name,
          quantity: String(item.quantity),
          rate: String(item.rate)
        }))
      );
    }
  }, [initialItems]);

  function updateRow(index: number, key: keyof AdminRow, value: string) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { name: "", quantity: "", rate: "" }]);
  }

  async function deleteRow(index: number) {
    const row = rows[index];
    if (row.id) {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/items/${row.id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to delete row");
        toast.success("Row deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete row");
      } finally {
        setLoading(false);
      }
    }

    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [{ name: "", quantity: "", rate: "" }];
    });
  }

  async function saveRow(index: number) {
    const row = rows[index];
    if (!row.name.trim() || row.quantity.trim() === "" || row.rate.trim() === "") {
      toast.error("Fill item name, quantity, and rate before saving this row.");
      return;
    }
    if (Number.isNaN(Number(row.quantity)) || Number.isNaN(Number(row.rate))) {
      toast.error("Quantity and rate must be valid numbers.");
      return;
    }

    setRowSaving((current) => ({ ...current, [index]: true }));
    try {
      const payload = normalizeRow(row);
      const method = row.id ? "PATCH" : "POST";
      const endpoint = row.id ? `/api/admin/items/${row.id}` : "/api/admin/items";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save row");

      const saved = data.item;
      setRows((current) =>
        current.map((existing, rowIndex) =>
          rowIndex === index
            ? {
                id: saved._id,
                name: saved.name,
                quantity: String(saved.quantity),
                rate: String(saved.rate)
              }
            : existing
        )
      );
      toast.success("Row saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save row");
    } finally {
      setRowSaving((current) => ({ ...current, [index]: false }));
    }
  }

  async function saveAll() {
    const invalidRow = rows.find(
      (row) =>
        !row.name.trim() ||
        row.quantity.trim() === "" ||
        row.rate.trim() === "" ||
        Number.isNaN(Number(row.quantity)) ||
        Number.isNaN(Number(row.rate))
    );
    if (invalidRow) {
      toast.error("Please fill Item Name, Quantity, and Rate for every row.");
      return;
    }

    const payload = rows.map(normalizeRow);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to save items");

      setRows(
        data.items.map((item: { _id: string; name: string; quantity: number; rate: number }) => ({
          id: item._id,
          name: item.name,
          quantity: String(item.quantity),
          rate: String(item.rate)
        }))
      );
      toast.success("Master data saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save items");
    } finally {
      setLoading(false);
    }
  }

  const calculatedRows = rows.map((row) => ({
    ...row,
    amount: calculateAmount(Number(row.quantity || 0), Number(row.rate || 0))
  }));
  const totalAmount = calculateGrandTotal(
    rows.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity || 0),
      rate: Number(row.rate || 0)
    }))
  );

  async function exportCsv() {
    const csv = toCsv(calculatedRows, totalAmount);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-items.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const worksheetData = [
      ["Item Name", "Quantity", "Rate", "Amount"],
      ...calculatedRows.map((row) => [row.name, Number(row.quantity || 0), formatRate(row.rate), row.amount]),
      ["Grand Total", "", "", totalAmount]
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Admin Items");
    XLSX.writeFile(workbook, "admin-items.xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Admin Items", 14, 16);
    doc.setFontSize(10);
    doc.text(`Grand Total: ${totalAmount.toLocaleString()}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [["Item Name", "Quantity", "Rate", "Amount"]],
      body: calculatedRows.map((row) => [row.name, row.quantity, formatRate(row.rate), row.amount.toLocaleString()]),
      foot: [["Grand Total", "", "", totalAmount.toLocaleString()]]
    });

    doc.save("admin-items.pdf");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Title>Admin Dashboard</Title>
          <Subtitle>Maintain the item master table. Amount and totals update instantly as you type.</Subtitle>
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
          <Button variant="secondary" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
          <Button onClick={saveAll} disabled={loading}>
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">Master Items</p>
              <p className="text-sm text-muted">Quantity is stored in KG, and each amount is calculated as Quantity x Rate.</p>
            </div>
            <div className="rounded-2xl bg-accentSoft px-4 py-3 text-sm font-medium text-accent">
              Grand Total: {totalAmount.toLocaleString()}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse">
              <thead className="bg-slate-50 text-left text-sm text-muted">
                <tr>
                  <th className="px-5 py-4 font-medium">Item Name</th>
                  <th className="px-5 py-4 font-medium">Quantity</th>
                  <th className="px-5 py-4 font-medium">Rate</th>
                  <th className="px-5 py-4 font-medium">Amount</th>
                  <th className="px-5 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const quantity = Number(row.quantity || 0);
                  const rate = Number(row.rate || 0);
                  const amount = calculateAmount(quantity, rate);
                  return (
                    <tr key={row.id ?? `new-${index}`} className="border-t border-line">
                      <td className="px-5 py-4 align-top">
                        <Input
                          value={row.name}
                          onChange={(e) => updateRow(index, "name", e.target.value)}
                          placeholder="Enter item name"
                        />
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.quantity}
                              onChange={(e) => updateRow(index, "quantity", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <span className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">KG</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => updateRow(index, "rate", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <span className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">/KG</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex h-11 items-center rounded-2xl border border-line bg-slate-50 px-4 text-sm font-semibold text-ink">
                          {amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" className="h-11" onClick={() => saveRow(index)} disabled={!!rowSaving[index]}>
                            {rowSaving[index] ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save
                          </Button>
                          <button
                            type="button"
                            onClick={() => deleteRow(index)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                  <td className="px-5 py-4 text-sm text-muted">Qty x Rate</td>
                  <td className="px-5 py-4 text-sm font-semibold text-ink">{totalAmount.toLocaleString()}</td>
                  <td className="px-5 py-4" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
