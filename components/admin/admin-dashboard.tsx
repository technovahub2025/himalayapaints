"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Printer,
  Save,
  X,
  Trash2
} from "lucide-react";
import { calculateAmount, calculateGrandTotal } from "@/lib/calculations";
import { formatProductLabel, isSameProductLabel, normalizeProductLabel } from "@/lib/product-label";
import { Button, Card, CardBody, CardHeader, Input, Select, Subtitle, Title } from "@/components/ui";
import { toast } from "sonner";

const DUPLICATE_PRODUCT_MESSAGE =
  "A product with this name already exists. Please choose a different product name.";

export type AdminRow = {
  id?: string;
  name: string;
  quantity: string;
  rate: string;
};

type StockBalance = {
  productName: string;
  materialName: string;
  unit: string;
  balance: number;
  latestMovementAt: string;
  latestReferenceType: string;
  latestBatchNo: string;
};

type StockMovement = {
  _id: string;
  productName: string;
  materialName: string;
  movementType: "in" | "out" | "adjustment";
  quantity: number;
  quantityDelta: number;
  balanceAfter: number;
  unit: string;
  referenceType: string;
  batchNo: string;
  createdAt: string;
};

type ProductionBatchSummary = {
  _id: string;
  productName: string;
  batchNo: string;
  actualKg: number;
  targetKg: number;
  createdAt: string;
  lines: Array<{
    materialName: string;
    actualQty: number;
  }>;
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
  const [productPage, setProductPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [renameTableName, setRenameTableName] = useState(initialTableName);
  const [isRenamingTable, setIsRenamingTable] = useState(false);
  const [isEditorPopupOpen, setIsEditorPopupOpen] = useState(false);
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
        const tables = (Array.isArray(data.tables) ? data.tables : []) as Array<{ name: string; count: number }>;
        setAvailableTables(tables);
        const activeIndex = tables.findIndex((table: { name: string; count: number }) => table.name === tableName);
        if (activeIndex >= 0) {
          setProductPage(Math.floor(activeIndex / itemsPerPage) + 1);
        }
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

  useEffect(() => {
    const activeIndex = availableTables.findIndex((table) => table.name === tableName);
    if (activeIndex >= 0) {
      setProductPage(Math.floor(activeIndex / itemsPerPage) + 1);
    }
  }, [availableTables, tableName]);

  useEffect(() => {
    setProductPage(1);
  }, [searchTerm, itemsPerPage]);

  const filteredTables = availableTables.filter((table) => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;
    const displayName = formatProductLabel(table.name).toLowerCase();
    return displayName.includes(needle) || table.name.toLowerCase().includes(needle) || String(table.count).includes(needle);
  });

  const totalProductPages = Math.max(1, Math.ceil(filteredTables.length / itemsPerPage));
  const currentProductPage = Math.min(productPage, totalProductPages);
  const paginatedTables = filteredTables.slice((currentProductPage - 1) * itemsPerPage, currentProductPage * itemsPerPage);

  async function loadTable(nextTableName: string, options?: { openEditorPopup?: boolean }) {
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
      if (options?.openEditorPopup) {
        setIsEditorPopupOpen(true);
      }
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
    const names = new Set(availableTables.map((table) => normalizeProductLabel(table.name)).filter(Boolean));
    let nextIndex = 1;
    while (names.has(normalizeProductLabel(`Product ${nextIndex}`))) {
      nextIndex += 1;
    }
    return `Product ${nextIndex}`;
  }

  function getDuplicateTableName(sourceTableName = tableName) {
    const baseName = `${formatProductLabel(sourceTableName)} Copy`;
    const names = new Set(availableTables.map((table) => normalizeProductLabel(table.name)).filter(Boolean));
    if (!names.has(normalizeProductLabel(baseName))) {
      return baseName;
    }

    let nextIndex = 2;
    while (names.has(normalizeProductLabel(`${baseName} ${nextIndex}`))) {
      nextIndex += 1;
    }
    return `${baseName} ${nextIndex}`;
  }

  function hasProductNameConflict(candidateName: string, ignoreName?: string) {
    return availableTables.some((table) => {
      if (ignoreName && isSameProductLabel(table.name, ignoreName)) {
        return false;
      }
      return isSameProductLabel(table.name, candidateName);
    });
  }

  async function createTable() {
    const trimmed = getNextTableName();
    if (hasProductNameConflict(trimmed)) {
      toast.error(DUPLICATE_PRODUCT_MESSAGE);
      return;
    }

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
      setProductPage(1);
      toast.success("Product created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create table");
    } finally {
      setLoading(false);
    }
  }

  async function duplicateTable(sourceTableName = tableName) {
    const sourceName = sourceTableName.trim() || tableName;
    const trimmed = getDuplicateTableName(sourceName);

    setLoading(true);
    try {
      const response = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, duplicateFrom: sourceName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to duplicate table");

      await refreshTableList(trimmed);
      await loadTable(trimmed);
      setProductPage(1);
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
    if (hasProductNameConflict(toName, fromName)) {
      toast.error(DUPLICATE_PRODUCT_MESSAGE);
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
      const activeIndex = availableTables.findIndex((table) => table.name === toName);
      if (activeIndex >= 0) {
        setProductPage(Math.floor(activeIndex / itemsPerPage) + 1);
      }
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
      setProductPage(1);
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
              <p className="text-sm text-muted">
                Browse all products here, jump into any product, duplicate or delete it, and create a new one from the same list.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={createTable} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                {primaryActionLabel}
              </Button>
              <Button variant="secondary" onClick={() => loadTable(tableName, { openEditorPopup: true })} disabled={loading}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load Product
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Product List</p>
                  <p className="text-sm text-muted">
                    Showing {filteredTables.length === 0 ? 0 : (currentProductPage - 1) * itemsPerPage + 1}-
                    {Math.min(currentProductPage * itemsPerPage, filteredTables.length)} of {filteredTables.length}
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="min-w-0 md:w-[280px]"
                    placeholder="Search products, names, or rows"
                    aria-label="Search products"
                  />
                  <Select
                    value={String(itemsPerPage)}
                    onChange={(event) => setItemsPerPage(Number(event.target.value))}
                    className="md:w-[180px]"
                    aria-label="Rows per page"
                  >
                    <option value="4">4 per page</option>
                    <option value="8">8 per page</option>
                    <option value="12">12 per page</option>
                    <option value="16">16 per page</option>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setProductPage((current) => Math.max(1, current - 1))}
                      disabled={currentProductPage <= 1}
                    >
                      Prev
                    </Button>
                    <div className="rounded-2xl bg-accentSoft px-4 py-3 text-sm font-medium text-accent">
                      Page {currentProductPage} / {totalProductPages}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setProductPage((current) => Math.min(totalProductPages, current + 1))}
                      disabled={currentProductPage >= totalProductPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-collapse">
                <thead className="bg-slate-50 text-left text-sm text-muted">
                  <tr>
                    <th className="px-5 py-4 font-medium">Product</th>
                    <th className="px-5 py-4 font-medium">Rows</th>
                    <th className="px-5 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTables.map((table) => {
                    const displayName = formatProductLabel(table.name);
                    const active = table.name === tableName;
                    return (
                      <tr key={table.name} className={active ? "border-t border-line bg-accentSoft/25" : "border-t border-line"}>
                        <td className="px-5 py-4">
                          <button type="button" className="flex flex-col items-start text-left" onClick={() => loadTable(table.name, { openEditorPopup: true })}>
                            <span className="font-semibold text-ink">{displayName}</span>
                            <span className="text-xs text-muted">{active ? "Active product" : "Tap to open"}</span>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted">{table.count.toLocaleString()} rows</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant={active ? "primary" : "secondary"} onClick={() => loadTable(table.name, { openEditorPopup: true })}>
                              Open
                            </Button>
                            <Button variant="secondary" onClick={() => duplicateTable(table.name)} disabled={loading}>
                              <Copy className="mr-2 h-5 w-5" />
                              Duplicate
                            </Button>
                            <Button variant="danger" onClick={() => deleteTable(table.name)} disabled={loading}>
                              <Trash2 className="mr-2 h-5 w-5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTables.length === 0 ? (
              <div className="border-t border-line px-5 py-8 text-sm text-muted">No products match your search.</div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {isEditorPopupOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 sm:p-6"
          onClick={() => setIsEditorPopupOpen(false)}
        >
          <div
            className="relative mx-auto w-full max-w-7xl pt-10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex justify-end">
              <Button variant="ghost" onClick={() => setIsEditorPopupOpen(false)} title="Close product editor">
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>

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
                    <Button variant="secondary" onClick={() => duplicateTable()} disabled={loading}>
                      <Copy className="mr-2 h-5 w-5" />
                      Duplicate Product
                    </Button>
                    <Button variant="danger" onClick={() => deleteTable(tableName)} disabled={loading}>
                      <Trash2 className="mr-2 h-5 w-5" />
                      Delete Product
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
      ) : null}
    </div>
  );
}
