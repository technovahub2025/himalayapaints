"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock3, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/services/api-client";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label, Select, Subtitle, Title } from "@/components/ui";
import { SummaryCards } from "@/components/summary-cards";
import { formatProductLabel } from "@/lib/product-label";

const EMPTY_TABLE_FORM = { name: "", duplicateFrom: "" };
const EMPTY_MATERIAL_FORM = { code: "", name: "", rate: "" };

function normalizeCode(value) {
    return String(value ?? "").trim().toLowerCase();
}

function createItemDraft(item) {
    return {
        id: String(item?._id ?? item?.id ?? ""),
        code: String(item?.code ?? ""),
        quantity: String(item?.quantity ?? "")
    };
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : "-";
}

export function AdminDashboard({ initialItems, initialTableName, tableNames, email }) {
    const [selectedTableName, setSelectedTableName] = useState(initialTableName);
    const [tableOptions, setTableOptions] = useState(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
    const [itemRows, setItemRows] = useState(() => initialItems.map(createItemDraft));
    const [rawMaterials, setRawMaterials] = useState([]);
    const [productionBatches, setProductionBatches] = useState([]);
    const [materialSearch, setMaterialSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingItems, setSavingItems] = useState(false);
    const [savingTable, setSavingTable] = useState(false);
    const [savingMaterial, setSavingMaterial] = useState(false);
    const [selectedMaterialCodes, setSelectedMaterialCodes] = useState([]);
    const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
    const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL_FORM);
    const [materialRateDrafts, setMaterialRateDrafts] = useState({});

    const materialMap = useMemo(() => {
        return new Map(rawMaterials.map((material) => [normalizeCode(material.code), material]));
    }, [rawMaterials]);

    const filteredMaterials = useMemo(() => {
        const needle = materialSearch.trim().toLowerCase();
        if (!needle) {
            return rawMaterials;
        }
        return rawMaterials.filter((material) => {
            return [material.code, material.name, String(material.rate ?? "")].join(" ").toLowerCase().includes(needle);
        });
    }, [materialSearch, rawMaterials]);

    const selectedTableItems = useMemo(() => {
        return itemRows.map((row) => {
            const material = materialMap.get(normalizeCode(row.code)) ?? null;
            const quantity = Number(row.quantity || 0);
            const rate = Number(material?.rate ?? 0);
            return {
                ...row,
                material,
                quantity,
                rate,
                amount: Number((quantity * rate).toFixed(2))
            };
        });
    }, [itemRows, materialMap]);

    const currentQuantityTotal = useMemo(() => selectedTableItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [selectedTableItems]);
    const currentAmountTotal = useMemo(() => selectedTableItems.reduce((sum, item) => sum + Number(item.amount || 0), 0), [selectedTableItems]);
    const selectedTableSummary = useMemo(() => tableOptions.find((table) => table === selectedTableName) ?? selectedTableName, [selectedTableName, tableOptions]);
    const recentBatches = useMemo(() => productionBatches.slice(0, 5), [productionBatches]);
    const recentProductionTotal = useMemo(() => productionBatches.slice(0, 10).reduce((sum, batch) => sum + Number(batch.actualKg ?? 0), 0), [productionBatches]);

    useEffect(() => {
        setSelectedTableName(initialTableName);
        setItemRows(initialItems.map(createItemDraft));
        setTableOptions(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
    }, [initialItems, initialTableName, tableNames]);

    useEffect(() => {
        setTableForm((current) => ({
            ...current,
            duplicateFrom: selectedTableName
        }));
    }, [selectedTableName]);

    useEffect(() => {
        setMaterialRateDrafts(
            Object.fromEntries(
                rawMaterials.map((material) => [
                    material.code,
                    String(material.rate ?? "")
                ])
            )
        );
        setSelectedMaterialCodes((current) => current.filter((code) => rawMaterials.some((material) => material.code === code)));
    }, [rawMaterials]);

    async function loadDashboardData(nextTableName = selectedTableName) {
        setLoading(true);
        try {
            const [itemsData, tablesData, materialsData, productionData] = await Promise.all([
                apiFetch(`/api/admin/items?tableName=${encodeURIComponent(nextTableName)}`),
                apiFetch("/api/admin/tables"),
                apiFetch("/api/admin/raw-materials?limit=100"),
                apiFetch("/api/production")
            ]);
            const nextItems = Array.isArray(itemsData.items) ? itemsData.items.map(createItemDraft) : [];
            const nextTables = Array.isArray(tablesData.tables) ? tablesData.tables.map((table) => table.name).filter(Boolean) : [];
            setSelectedTableName(nextTableName);
            setItemRows(nextItems);
            setTableOptions(Array.from(new Set([nextTableName, ...nextTables])).sort());
            setRawMaterials(Array.isArray(materialsData.materials) ? materialsData.materials : []);
            setProductionBatches(Array.isArray(productionData.batches) ? productionData.batches : []);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard");
            setItemRows(initialItems.map(createItemDraft));
            setTableOptions(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
        }
        finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadDashboardData(initialTableName);
        // The admin dashboard keeps its own copy so it can react to in-page edits.
        // The parent page still handles auth and initial loading.
    }, []);

    function handleItemChange(index, field, value) {
        setItemRows((current) => current.map((row, rowIndex) => {
            if (rowIndex !== index) {
                return row;
            }
            return {
                ...row,
                [field]: value
            };
        }));
    }

    function addItemRow() {
        const firstMaterial = rawMaterials[0];
        setItemRows((current) => [
            ...current,
            {
                id: "",
                code: firstMaterial?.code ?? "",
                quantity: "0"
            }
        ]);
    }

    function removeItemRow(index) {
        setItemRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    }

    async function saveItems() {
        if (!selectedTableName.trim()) {
            toast.error("Select a table before saving items.");
            return;
        }
        if (itemRows.length === 0) {
            toast.error("Add at least one item before saving.");
            return;
        }
        const payloadItems = itemRows.map((row, index) => {
            const material = materialMap.get(normalizeCode(row.code));
            if (!material) {
                throw new Error(`Choose a valid raw material code for row ${index + 1}`);
            }
            const quantity = Number(row.quantity);
            if (Number.isNaN(quantity) || quantity < 0) {
                throw new Error(`Enter a valid quantity for row ${index + 1}`);
            }
            return {
                id: row.id || undefined,
                code: material.code,
                name: material.name,
                quantity,
                rate: Number(material.rate)
            };
        });
        setSavingItems(true);
        try {
            const data = await apiFetch("/api/admin/items", {
                method: "PUT",
                json: {
                    tableName: selectedTableName,
                    items: payloadItems
                }
            });
            setItemRows(Array.isArray(data.items) ? data.items.map(createItemDraft) : itemRows);
            toast.success("Table items saved");
            await loadDashboardData(selectedTableName);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save items");
        }
        finally {
            setSavingItems(false);
        }
    }

    async function refreshTable() {
        await loadDashboardData(selectedTableName);
    }

    async function createTable() {
        const name = tableForm.name.trim();
        if (!name) {
            toast.error("Enter a new table name.");
            return;
        }
        setSavingTable(true);
        try {
            await apiFetch("/api/admin/tables", {
                method: "POST",
                json: {
                    name,
                    duplicateFrom: tableForm.duplicateFrom.trim()
                }
            });
            toast.success("Table created");
            setTableForm(EMPTY_TABLE_FORM);
            await loadDashboardData(name);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create table");
        }
        finally {
            setSavingTable(false);
        }
    }

    async function renameTable() {
        const nextName = tableForm.name.trim();
        if (!selectedTableName.trim()) {
            toast.error("Select a table to rename.");
            return;
        }
        if (!nextName) {
            toast.error("Enter a new table name.");
            return;
        }
        setSavingTable(true);
        try {
            await apiFetch("/api/admin/tables", {
                method: "PATCH",
                json: {
                    fromName: selectedTableName,
                    toName: nextName
                }
            });
            toast.success("Table renamed");
            setTableForm(EMPTY_TABLE_FORM);
            await loadDashboardData(nextName);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to rename table");
        }
        finally {
            setSavingTable(false);
        }
    }

    async function deleteTable() {
        if (!selectedTableName.trim()) {
            toast.error("Select a table to delete.");
            return;
        }
        const confirmed = window.confirm(`Delete ${selectedTableName}? This will remove its items.`);
        if (!confirmed) {
            return;
        }
        setSavingTable(true);
        try {
            await apiFetch("/api/admin/tables", {
                method: "DELETE",
                json: { name: selectedTableName }
            });
            toast.success("Table deleted");
            const nextTable = tableOptions.find((table) => table !== selectedTableName) ?? "Table 1";
            await loadDashboardData(nextTable);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete table");
        }
        finally {
            setSavingTable(false);
        }
    }

    async function createRawMaterial() {
        const name = materialForm.name.trim();
        const code = materialForm.code.trim();
        const rate = Number(materialForm.rate);
        if (!name) {
            toast.error("Enter a raw material name.");
            return;
        }
        if (Number.isNaN(rate) || rate < 0) {
            toast.error("Enter a valid raw material rate.");
            return;
        }
        setSavingMaterial(true);
        try {
            await apiFetch("/api/admin/raw-materials", {
                method: "POST",
                json: { name, code, rate }
            });
            toast.success("Raw material created");
            setMaterialForm(EMPTY_MATERIAL_FORM);
            await loadDashboardData(selectedTableName);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create raw material");
        }
        finally {
            setSavingMaterial(false);
        }
    }

    async function saveRawMaterialRate(code) {
        const nextRate = Number(materialRateDrafts[code]);
        if (Number.isNaN(nextRate) || nextRate < 0) {
            toast.error("Enter a valid rate before saving.");
            return;
        }
        setSavingMaterial(true);
        try {
            await apiFetch("/api/admin/raw-materials", {
                method: "PATCH",
                json: { code, rate: nextRate }
            });
            toast.success("Raw material updated");
            await loadDashboardData(selectedTableName);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update raw material");
        }
        finally {
            setSavingMaterial(false);
        }
    }

    async function deleteSelectedMaterials() {
        if (selectedMaterialCodes.length === 0) {
            toast.error("Select raw materials to delete.");
            return;
        }
        const confirmed = window.confirm(`Delete ${selectedMaterialCodes.length} raw material(s)?`);
        if (!confirmed) {
            return;
        }
        setSavingMaterial(true);
        try {
            await apiFetch("/api/admin/raw-materials", {
                method: "DELETE",
                json: { codes: selectedMaterialCodes }
            });
            toast.success("Raw materials deleted");
            setSelectedMaterialCodes([]);
            await loadDashboardData(selectedTableName);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete raw materials");
        }
        finally {
            setSavingMaterial(false);
        }
    }

    function toggleMaterialSelection(code) {
        setSelectedMaterialCodes((current) => {
            if (current.includes(code)) {
                return current.filter((entry) => entry !== code);
            }
            return [...current, code];
        });
    }

    const overviewCards = [
        {
            label: "Tables",
            value: String(tableOptions.length),
            hint: "Available product tables"
        },
        {
            label: "Current Items",
            value: String(itemRows.length),
            hint: `Selected table: ${selectedTableSummary}`
        },
        {
            label: "Raw Materials",
            value: String(rawMaterials.length),
            hint: "Master data available for item formulas"
        },
        {
            label: "Recent Output",
            value: `${recentProductionTotal.toLocaleString()} KG`,
            hint: "Last 10 production batches"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                    <Title>Admin Control Center</Title>
                    <Subtitle>Manage product tables, item formulas, raw materials, and production history from one workspace.</Subtitle>
                    {email ? <p className="mt-2 text-sm text-muted">Signed in as {email}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={refreshTable} disabled={loading || savingItems || savingTable || savingMaterial}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="primary" onClick={saveItems} disabled={loading || savingItems}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Items
                    </Button>
                </div>
            </div>

            <SummaryCards items={overviewCards} />

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold text-ink">Table Workspace</p>
                            <p className="text-sm text-muted">Select a table, edit its items, or create a new table from an existing template.</p>
                        </div>
                        <Badge>{selectedTableSummary}</Badge>
                    </div>
                </CardHeader>
                <CardBody className="space-y-5">
                    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr]">
                        <div>
                            <Label>Active table</Label>
                            <Select value={selectedTableName} onChange={(event) => {
                                const nextTable = event.target.value;
                                setSelectedTableName(nextTable);
                                void loadDashboardData(nextTable);
                            }}>
                                {tableOptions.map((table) => (
                                    <option key={table} value={table}>
                                        {formatProductLabel(table)}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <Label>New or renamed table</Label>
                            <Input value={tableForm.name} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} placeholder="Enter table name" />
                        </div>
                        <div>
                            <Label>Duplicate from</Label>
                            <Select value={tableForm.duplicateFrom} onChange={(event) => setTableForm((current) => ({ ...current, duplicateFrom: event.target.value }))}>
                                <option value="">Select source table</option>
                                {tableOptions.map((table) => (
                                    <option key={table} value={table}>
                                        {formatProductLabel(table)}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={createTable} disabled={savingTable}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Table
                        </Button>
                        <Button variant="secondary" onClick={renameTable} disabled={savingTable}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Rename Selected
                        </Button>
                        <Button variant="danger" onClick={deleteTable} disabled={savingTable}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold text-ink">Item Formulas</p>
                            <p className="text-sm text-muted">Edit item codes and quantities for the active table. The backend will resolve the material names and rates.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge>{currentQuantityTotal.toLocaleString()} total qty</Badge>
                            <Badge>{currentAmountTotal.toLocaleString()} total amount</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted">{itemRows.length.toLocaleString()} editable row(s)</p>
                        <Button variant="secondary" onClick={addItemRow}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Row
                        </Button>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                        <table className="min-w-[980px] w-full border-collapse">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-muted">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Code</th>
                                    <th className="px-4 py-3 font-semibold">Material</th>
                                    <th className="px-4 py-3 font-semibold">Quantity</th>
                                    <th className="px-4 py-3 font-semibold">Rate</th>
                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {itemRows.length > 0 ? itemRows.map((row, index) => {
                                const material = materialMap.get(normalizeCode(row.code)) ?? null;
                                const rowRate = Number(material?.rate ?? 0);
                                const rowQuantity = Number(row.quantity || 0);
                                const amount = Number((rowRate * rowQuantity).toFixed(2));
                                return (
                                    <tr key={row.id || `${selectedTableName}-${index}`} className="border-t border-line">
                                        <td className="px-4 py-3">
                                            <Select value={row.code} onChange={(event) => handleItemChange(index, "code", event.target.value)}>
                                                <option value="">Select code</option>
                                                {rawMaterials.map((materialOption) => (
                                                    <option key={materialOption.code} value={materialOption.code}>
                                                        {materialOption.code}
                                                    </option>
                                                ))}
                                            </Select>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-ink">
                                            {material ? material.name : <span className="text-muted">Select a code</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input value={row.quantity} onChange={(event) => handleItemChange(index, "quantity", event.target.value)} inputMode="decimal" />
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted">{rowRate.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-ink">{amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button variant="ghost" onClick={() => removeItemRow(index)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Remove
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td className="px-4 py-5 text-sm text-muted" colSpan={6}>
                                        No item rows loaded for this table.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-ink">Raw Material Master</p>
                                <p className="text-sm text-muted">Create new materials, adjust rates, or delete selected rows.</p>
                            </div>
                            <Badge>{selectedMaterialCodes.length.toLocaleString()} selected</Badge>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <Label>Name</Label>
                                <Input value={materialForm.name} onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))} placeholder="Raw material name" />
                            </div>
                            <div>
                                <Label>Code</Label>
                                <Input value={materialForm.code} onChange={(event) => setMaterialForm((current) => ({ ...current, code: event.target.value }))} placeholder="Optional custom code" />
                            </div>
                            <div>
                                <Label>Rate</Label>
                                <Input value={materialForm.rate} onChange={(event) => setMaterialForm((current) => ({ ...current, rate: event.target.value }))} placeholder="0" inputMode="decimal" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={createRawMaterial} disabled={savingMaterial}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Material
                            </Button>
                            <Button variant="danger" onClick={deleteSelectedMaterials} disabled={savingMaterial}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected
                            </Button>
                        </div>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                            <Input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search raw materials" className="pl-11" />
                        </div>
                        <div className="max-h-[520px] overflow-auto rounded-2xl border border-line bg-white">
                            <table className="min-w-[700px] w-full border-collapse">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-muted">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Select</th>
                                        <th className="px-4 py-3 font-semibold">Code</th>
                                        <th className="px-4 py-3 font-semibold">Name</th>
                                        <th className="px-4 py-3 font-semibold">Rate</th>
                                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.length > 0 ? filteredMaterials.map((material) => (
                                        <tr key={material.code} className="border-t border-line">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMaterialCodes.includes(material.code)}
                                                    onChange={() => toggleMaterialSelection(material.code)}
                                                    className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-ink">{material.code}</td>
                                            <td className="px-4 py-3 text-sm text-ink">{material.name}</td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    value={materialRateDrafts[material.code] ?? ""}
                                                    onChange={(event) => setMaterialRateDrafts((current) => ({ ...current, [material.code]: event.target.value }))}
                                                    inputMode="decimal"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button variant="ghost" onClick={() => saveRawMaterialRate(material.code)} disabled={savingMaterial}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Save
                                                </Button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td className="px-4 py-5 text-sm text-muted" colSpan={5}>
                                                No raw materials match your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-ink">Production History</p>
                                <p className="text-sm text-muted">Latest saved batches across the system.</p>
                            </div>
                            <Badge>{productionBatches.length.toLocaleString()} total</Badge>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                            <table className="min-w-[780px] w-full border-collapse">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-muted">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Product</th>
                                        <th className="px-4 py-3 font-semibold">Batch No</th>
                                        <th className="px-4 py-3 font-semibold">Actual KG</th>
                                        <th className="px-4 py-3 font-semibold">Created By</th>
                                        <th className="px-4 py-3 font-semibold">Created At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentBatches.length > 0 ? recentBatches.map((batch) => (
                                        <tr key={batch._id} className="border-t border-line">
                                            <td className="px-4 py-3 text-sm font-semibold text-ink">{formatProductLabel(batch.productName)}</td>
                                            <td className="px-4 py-3 text-sm text-ink">{batch.batchNo || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-ink">{Number(batch.actualKg ?? 0).toLocaleString()} KG</td>
                                            <td className="px-4 py-3 text-sm text-muted">{batch.createdBy || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-muted">{formatDateTime(batch.createdAt)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td className="px-4 py-5 text-sm text-muted" colSpan={5}>
                                                No production batches saved yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="rounded-3xl border border-line bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0.92))] p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                                    <Clock3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-ink">Active table snapshot</p>
                                    <p className="mt-1 text-sm text-muted">
                                        {selectedTableName} currently has {itemRows.length.toLocaleString()} item row(s), {currentQuantityTotal.toLocaleString()} total quantity, and {currentAmountTotal.toLocaleString()} total amount.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
