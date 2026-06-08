"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Printer,
  Save,
  Trash2
} from "lucide-react";
import { calculateAmount, calculateGrandTotal } from "@/lib/calculations";
import { Button, Card, CardBody, CardHeader, Input, Select, Subtitle, Title } from "@/components/ui";
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

function formatProductLabel(name: string) {
  return name.trim().replace(/\btable\b/gi, "Product");
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
  initialItems,
  initialTableName,
  tableNames
}: {
  initialItems: Array<{ _id: string; tableName: string; name: string; quantity: number; rate: number }>;
  initialTableName: string;
  tableNames: string[];
}) {
  const router = useRouter();
  const [tableName, setTableName] = useState(initialTableName);
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
  const [availableTables, setAvailableTables] = useState<Array<{ name: string; count: number }>>(
    Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).map((name) => ({ name, count: 0 }))
  );
  const [renameTableName, setRenameTableName] = useState(initialTableName);
  const [isRenamingTable, setIsRenamingTable] = useState(false);
  const tableNameInputRef = useRef<HTMLInputElement | null>(null);
  const primaryActionLabel = "New Product";

  useEffect(() => {
    setTableName(initialTableName);
    setRenameTableName(initialTableName);
    setIsRenamingTable(false);
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
  }, [initialItems, initialTableName, tableNames]);

  useEffect(() => {
    async function loadTables() {
      try {
        const response = await fetch("/api/admin/tables");
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load tables");
        setAvailableTables(Array.isArray(data.tables) ? data.tables : []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load tables");
      }
    }

    loadTables();
  }, []);

  useEffect(() => {
    if (!isRenamingTable) return;
    tableNameInputRef.current?.focus();
    tableNameInputRef.current?.select();
  }, [isRenamingTable]);

  async function loadTable(nextTableName: string) {
    const trimmed = nextTableName.trim() || "Product 1";
    setTableName(trimmed);
    setRenameTableName(trimmed);
    setIsRenamingTable(false);
    router.replace(`/admin?tableName=${encodeURIComponent(trimmed)}`);
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/items?tableName=${encodeURIComponent(trimmed)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load table");

      setRows(
        (data.items ?? []).map((item: { _id: string; name: string; quantity: number; rate: number }) => ({
          id: item._id,
          name: item.name,
          quantity: String(item.quantity),
          rate: String(item.rate)
        }))
      );
      if ((data.items ?? []).length === 0) {
        setRows([{ name: "", quantity: "", rate: "" }]);
      }
      await refreshTableList(trimmed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTableList(nextActiveTable = tableName) {
    try {
      const response = await fetch("/api/admin/tables");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to load tables");
      const tables = Array.isArray(data.tables) ? data.tables : [];
      setAvailableTables(tables);
      if (nextActiveTable) {
        setRenameTableName(nextActiveTable);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load tables");
    }
  }

  function getNextTableName() {
    const names = availableTables.map((table) => table.name.trim()).filter(Boolean);
    let nextIndex = 1;
    while (names.includes(`Product ${nextIndex}`)) {
      nextIndex += 1;
    }
    return `Product ${nextIndex}`;
  }

  function getDuplicateTableName() {
    const baseName = `${formatProductLabel(tableName)} Copy`;
    const names = availableTables.map((table) => table.name.trim()).filter(Boolean);
    if (!names.includes(baseName)) {
      return baseName;
    }

    let nextIndex = 2;
    while (names.includes(`${baseName} ${nextIndex}`)) {
      nextIndex += 1;
    }
    return `${baseName} ${nextIndex}`;
  }

  async function createTable() {
    const trimmed = getNextTableName();

    setLoading(true);
    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create table");

      await refreshTableList(trimmed);
      await loadTable(trimmed);
      toast.success("Product created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create table");
    } finally {
      setLoading(false);
    }
  }

  async function duplicateTable() {
    const trimmed = getDuplicateTableName();

    setLoading(true);
    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, duplicateFrom: tableName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to duplicate table");

      await refreshTableList(trimmed);
      await loadTable(trimmed);
      toast.success("Product duplicated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate table");
    } finally {
      setLoading(false);
    }
  }

  async function renameTable() {
    const fromName = tableName.trim();
    const toName = renameTableName.trim();
    if (!fromName || !toName) {
      toast.error("Product name is required.");
      return;
    }
    if (fromName === toName) {
      toast.error("Choose a different product name.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromName, toName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to rename table");

      router.replace(`/admin?tableName=${encodeURIComponent(toName)}`);
      setTableName(toName);
      setRenameTableName(toName);
      setIsRenamingTable(false);
      await loadTable(toName);
      await refreshTableList(toName);
      toast.success("Product renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename table");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTable(tableToDelete = tableName) {
    const name = tableToDelete.trim();
    if (!name) return;
    if (availableTables.length <= 1) {
      toast.error("At least one product must remain.");
      return;
    }
    const confirmed = window.confirm(`Delete ${name} and all its rows?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/tables", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to delete table");

      const fallbackTable = (data.tables?.[0]?.name as string) || "Product 1";
      router.replace(`/admin?tableName=${encodeURIComponent(fallbackTable)}`);
      setTableName(fallbackTable);
      setRenameTableName(fallbackTable);
      setIsRenamingTable(false);
      await loadTable(fallbackTable);
      await refreshTableList(fallbackTable);
      toast.success("Product deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete table");
    } finally {
      setLoading(false);
    }
  }

  function startRenameTable() {
    setRenameTableName(tableName);
    setIsRenamingTable(true);
  }

  function cancelRenameTable() {
    setRenameTableName(tableName);
    setIsRenamingTable(false);
  }

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
        await refreshTableList(tableName);
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
        body: JSON.stringify({ ...payload, tableName })
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
      await refreshTableList(tableName);
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
        body: JSON.stringify({ tableName, items: payload })
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
      await refreshTableList(tableName);
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
    link.download = `${tableName || "table"}-items.csv`;
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
    XLSX.utils.book_append_sheet(workbook, worksheet, tableName || "Admin Items");
    XLSX.writeFile(workbook, `${tableName || "table"}-items.xlsx`);
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default ?? autoTableModule.autoTable;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(tableName || "Admin Items", 14, 16);
    doc.setFontSize(10);
    doc.text(`Grand Total: ${totalAmount.toLocaleString()}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [["Item Name", "Quantity", "Rate", "Amount"]],
      body: calculatedRows.map((row) => [row.name, row.quantity, formatRate(row.rate), row.amount.toLocaleString()]),
      foot: [["Grand Total", "", "", totalAmount.toLocaleString()]]
    });

    doc.save(`${tableName || "table"}-items.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-lg font-semibold">Products</p>
              <p className="text-sm text-muted">Switch product datasets quickly, create new ones, and manage the active product from one place.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={createTable} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {primaryActionLabel}
              </Button>
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
              <Button variant="secondary" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button variant="secondary" onClick={() => loadTable(tableName)} disabled={loading}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink">Select Product</label>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <Select
                    value={tableName}
                    onChange={(e) => loadTable(e.target.value)}
                    disabled={loading || availableTables.length === 0}
                    className="lg:flex-1"
                  >
                    {availableTables.map((table) => {
                      const displayName = formatProductLabel(table.name);
                      return (
                        <option key={table.name} value={table.name} label={`${displayName} (${table.count} rows)`}>
                          {displayName} ({table.count} rows)
                        </option>
                      );
                    })}
                  </Select>
                  <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={duplicateTable}
                    disabled={loading}
                    className="h-10 w-10 px-0"
                    aria-label="Duplicate product"
                    title="Duplicate product"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteTable(tableName)}
                    disabled={loading}
                    className="h-10 w-10 px-0"
                    aria-label="Delete product"
                    title="Delete product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <div>
          <Title>Admin Dashboard</Title>
          <Subtitle>Maintain the item master product. Amount and totals update instantly as you type.</Subtitle>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {isRenamingTable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={tableNameInputRef}
                      value={renameTableName}
                      onChange={(e) => setRenameTableName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          renameTable();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRenameTable();
                        }
                      }}
                      className="h-11 max-w-[260px]"
                      aria-label="Rename current table"
                    />
                    <Button variant="secondary" onClick={renameTable} disabled={loading}>
                      <Check className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button variant="ghost" onClick={cancelRenameTable} disabled={loading}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onDoubleClick={startRenameTable}
                    className="group inline-flex flex-col items-start text-left"
                    title="Double-click to rename product"
                  >
                    <span className="text-lg font-semibold transition group-hover:text-accent">
                      {formatProductLabel(tableName || "Product Items")}
                    </span>
                    <span className="text-sm text-muted">
                      Items in {formatProductLabel(tableName || "this product")} are stored in KG, and each amount is calculated as Quantity x Rate.
                    </span>
                    <span className="mt-1 text-xs text-muted">Double-click the product name to rename it.</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={addRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
                <Button onClick={saveAll} disabled={loading}>
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
                <div className="rounded-2xl bg-accentSoft px-4 py-3 text-sm font-medium text-accent">
                  Grand Total: {totalAmount.toLocaleString()}
                </div>
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
    </div>
  );
}
