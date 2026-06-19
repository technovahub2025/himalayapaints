"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Check, ChevronDown, Copy, Download, Edit2, FileSpreadsheet, FileText, LoaderCircle, Plus, Printer, Save, RefreshCw, Trash2, Upload, X, XCircle } from "lucide-react";
import { calculateAmount, calculateGrandTotal } from "@/lib/calculations";
import { formatProductLabel, isSameProductLabel, normalizeProductLabel } from "@/lib/product-label";
import { generateRawMaterialCode } from "@/lib/raw-materials";
import { Button, Card, CardBody, CardHeader, Input, Title } from "@/components/ui";
import { apiRequest, apiUrl } from "@/services/api-client";
import { toast } from "sonner";
const DUPLICATE_PRODUCT_MESSAGE = "A product with this name already exists. Please choose a different product name.";
let productRowKeyCounter = 0;
function createRowKey() {
    productRowKeyCounter += 1;
    return `row-${productRowKeyCounter}`;
}
function createEmptyRow() {
    return { uiKey: createRowKey(), code: "", name: "", quantity: "", rate: "" };
}
function mapItemToRow(item) {
    return {
        uiKey: createRowKey(),
        id: item._id,
        code: item.code ?? "",
        name: item.name,
        quantity: String(item.quantity),
        rate: String(item.rate)
    };
}
function buildRawMaterialRateMap(materials) {
    return materials.reduce((accumulator, material) => {
        accumulator[material.code] = String(material.rate);
        return accumulator;
    }, {});
}
function normalizeRow(row) {
    return {
        id: row.id,
        code: row.code.trim(),
        name: row.name.trim(),
        quantity: Number(row.quantity),
        rate: Number(row.rate)
    };
}
function normalizeHeader(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}
function getCellText(value) {
    if (value === null || value === undefined)
        return "";
    return String(value).trim();
}
function formatRate(rate) {
    return `${rate}/KG`;
}
function toCsv(rows, totalAmount) {
    const header = ["Item Name", "Quantity", "Rate", "Amount"];
    const lines = rows.map((row) => [row.name, row.quantity, formatRate(row.rate), row.amount].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    lines.push(["Grand Total", "", "", totalAmount].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
    return [header.join(","), ...lines].join("\n");
}
const RAW_MATERIAL_BATCH_SIZE = 20;
const PRODUCT_BATCH_SIZE = 10;
export function AdminDashboard({ initialItems, initialSection = "products", initialTableName, tableNames }) {
    const navigate = useNavigate();
    const [tableName, setTableName] = useState(initialTableName);
    const [rows, setRows] = useState(initialItems.length > 0 ? initialItems.map(mapItemToRow) : [createEmptyRow()]);
    const [loading, setLoading] = useState(false);
    const [rowSaving, setRowSaving] = useState({});
    const [availableTables, setAvailableTables] = useState(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).map((name) => ({ name, count: 0 })));
    const [productVisibleCount, setProductVisibleCount] = useState(PRODUCT_BATCH_SIZE);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeSection, setActiveSection] = useState(initialSection === "rawMaterials" ? "rawMaterials" : "products");
    const [renameTableName, setRenameTableName] = useState(initialTableName);
    const [isRenamingTable, setIsRenamingTable] = useState(false);
    const [isEditorPopupOpen, setIsEditorPopupOpen] = useState(false);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [rawMaterialSearchTerm, setRawMaterialSearchTerm] = useState("");
    const [rawMaterialTotal, setRawMaterialTotal] = useState(0);
    const [rawMaterialHasMore, setRawMaterialHasMore] = useState(true);
    const [rawMaterialLoadingMore, setRawMaterialLoadingMore] = useState(false);
    const [rawMaterialSaving, setRawMaterialSaving] = useState({});
    const [rawMaterialRates, setRawMaterialRates] = useState({});
    const [rawMaterialEditing, setRawMaterialEditing] = useState({});
    const [rowEditing, setRowEditing] = useState({});
    const [productSelectionMode, setProductSelectionMode] = useState(false);
    const [selectedProductRowKeys, setSelectedProductRowKeys] = useState([]);
    const [selectedRawMaterialCodes, setSelectedRawMaterialCodes] = useState([]);
    const [rawMaterialSelectionMode, setRawMaterialSelectionMode] = useState(false);
    const [rawMaterialLookupQuery, setRawMaterialLookupQuery] = useState("");
    const [rawMaterialLookupResults, setRawMaterialLookupResults] = useState([]);
    const [rawMaterialLookupLoading, setRawMaterialLookupLoading] = useState(false);
    const [rawMaterialPickerOpen, setRawMaterialPickerOpen] = useState(false);
    const [rawMaterialPickerQuery, setRawMaterialPickerQuery] = useState("");
    const [rawMaterialPickerResults, setRawMaterialPickerResults] = useState([]);
    const [rawMaterialPickerLoading, setRawMaterialPickerLoading] = useState(false);
    const [rawMaterialPickerHasMore, setRawMaterialPickerHasMore] = useState(false);
    const [rawMaterialPickerOffset, setRawMaterialPickerOffset] = useState(0);
    const [rawMaterialPickerSelectedCodes, setRawMaterialPickerSelectedCodes] = useState([]);
    const [rawMaterialPickerActiveIndex, setRawMaterialPickerActiveIndex] = useState(0);
    const [rawMaterialPickerLastCheckedIndex, setRawMaterialPickerLastCheckedIndex] = useState(null);
    const [newRawMaterialCode, setNewRawMaterialCode] = useState("");
    const [newRawMaterialName, setNewRawMaterialName] = useState("");
    const [newRawMaterialRate, setNewRawMaterialRate] = useState("");
    const [rawMaterialImportOpen, setRawMaterialImportOpen] = useState(false);
    const [rawMaterialImportFileName, setRawMaterialImportFileName] = useState("");
    const [rawMaterialImportRows, setRawMaterialImportRows] = useState([]);
    const [rawMaterialImportLoading, setRawMaterialImportLoading] = useState(false);
    const [rawMaterialImportResult, setRawMaterialImportResult] = useState(null);
    const tableNameInputRef = useRef(null);
    const productLoadMoreRef = useRef(null);
    const productScrollRef = useRef(null);
    const rawMaterialScrollRef = useRef(null);
    const rawMaterialLoadMoreRef = useRef(null);
    const rawMaterialImportInputRef = useRef(null);
    const rawMaterialRateInputRefs = useRef({});
    const rawMaterialLookupDebounceRef = useRef(null);
    const rawMaterialPickerDebounceRef = useRef(null);
    const rawMaterialPickerScrollRef = useRef(null);
    const rawMaterialPickerLoadMoreRef = useRef(null);
    const rawMaterialPickerInputRef = useRef(null);
    const rawMaterialPickerItemRefs = useRef({});
    const productRowInputRefs = useRef({ code: {}, name: {}, quantity: {}, rate: {} });
    const exportMenuRef = useRef(null);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const primaryActionLabel = "New Product";
    useEffect(() => {
        setTableName(initialTableName);
        setRenameTableName(initialTableName);
        setIsRenamingTable(false);
        setActiveSection(initialSection === "rawMaterials" ? "rawMaterials" : "products");
        if (initialItems.length > 0) {
            setRows(initialItems.map(mapItemToRow));
        }
    }, [initialItems, initialSection, initialTableName, tableNames]);
    useEffect(() => {
        async function loadTables() {
            try {
                const response = await apiRequest("/api/admin/tables");
                const data = await response.json();
                if (!response.ok)
                    throw new Error(data.message || "Failed to load tables");
                const tables = (Array.isArray(data.tables) ? data.tables : []);
                setAvailableTables(tables);
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load tables");
            }
        }
        loadTables();
    }, []);
    useEffect(() => {
        if (!isRenamingTable)
            return;
        tableNameInputRef.current?.focus();
        tableNameInputRef.current?.select();
    }, [isRenamingTable]);
    useEffect(() => {
        setProductVisibleCount(PRODUCT_BATCH_SIZE);
    }, [searchTerm]);
    useEffect(() => {
        if (activeSection !== "rawMaterials")
            return;
        setRawMaterials([]);
        setRawMaterialRates({});
        setRawMaterialTotal(0);
        setRawMaterialHasMore(true);
        void loadRawMaterials({ reset: true, search: rawMaterialSearchTerm.trim() });
    }, [rawMaterialSearchTerm, activeSection]);
    useEffect(() => {
        if (activeSection !== "rawMaterials")
            return;
        const target = rawMaterialLoadMoreRef.current;
        const root = rawMaterialScrollRef.current;
        if (!target || !root)
            return;
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting)
                return;
            void loadMoreRawMaterials();
        }, {
            root,
            rootMargin: "120px"
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [activeSection, rawMaterialHasMore, rawMaterialLoadingMore, rawMaterialSearchTerm, rawMaterials.length]);
    const filteredTables = availableTables.filter((table) => {
        const needle = searchTerm.trim().toLowerCase();
        if (!needle)
            return true;
        const displayName = formatProductLabel(table.name).toLowerCase();
        return displayName.includes(needle) || table.name.toLowerCase().includes(needle) || String(table.count).includes(needle);
    });
    const visibleTables = filteredTables.slice(0, productVisibleCount);
    useEffect(() => {
        if (activeSection !== "products")
            return;
        const target = productLoadMoreRef.current;
        const root = productScrollRef.current;
        if (!target || !root)
            return;
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting)
                return;
            setProductVisibleCount((current) => Math.min(filteredTables.length, current + PRODUCT_BATCH_SIZE));
        }, {
            root,
            rootMargin: "120px"
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [activeSection, filteredTables.length]);
    function updateAdminUrl(nextTableName = tableName, nextSection = activeSection) {
        const params = new URLSearchParams();
        if (nextTableName) {
            params.set("tableName", nextTableName);
        }
        if (nextSection === "rawMaterials") {
            params.set("section", "rawMaterials");
        }
        navigate(`/admin?${params.toString()}`, { replace: true });
    }
    async function loadTable(nextTableName, options) {
        const trimmed = nextTableName.trim() || "Product 1";
        setTableName(trimmed);
        setRenameTableName(trimmed);
        setIsRenamingTable(false);
        updateAdminUrl(trimmed, activeSection);
        setLoading(true);
        try {
            const response = await apiRequest(`/api/admin/items?tableName=${encodeURIComponent(trimmed)}`);
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to load table");
            setRows((data.items ?? []).map(mapItemToRow));
            setRowEditing({});
            if ((data.items ?? []).length === 0) {
                setRows([createEmptyRow()]);
            }
            await refreshTableList(trimmed);
            if (options?.openEditorPopup) {
                setIsEditorPopupOpen(true);
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load table");
        }
        finally {
            setLoading(false);
        }
    }
    async function refreshTableList(nextActiveTable = tableName) {
        try {
            const response = await apiRequest("/api/admin/tables");
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to load tables");
            const tables = Array.isArray(data.tables) ? data.tables : [];
            setAvailableTables(tables);
            setProductVisibleCount((current) => Math.min(Math.max(current, PRODUCT_BATCH_SIZE), tables.length || PRODUCT_BATCH_SIZE));
            if (nextActiveTable) {
                setRenameTableName(nextActiveTable);
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load tables");
        }
    }
    async function loadRawMaterials({ reset = false, search = rawMaterialSearchTerm.trim(), code } = {}) {
        const offset = reset ? 0 : rawMaterials.length;
        const params = new URLSearchParams({
            limit: String(RAW_MATERIAL_BATCH_SIZE),
            offset: String(offset)
        });
        if (search) {
            params.set("search", search);
        }
        if (code) {
            params.set("code", code);
        }
        if (reset) {
            setRawMaterialLoadingMore(true);
        }
        try {
            const response = await apiRequest(`/api/admin/raw-materials?${params.toString()}`);
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to load raw materials");
            const materials = Array.isArray(data.materials) ? data.materials : [];
            const nextMaterials = reset ? materials : Array.from(new Map([...rawMaterials, ...materials].map((material) => [material.code, material])).values());
            setRawMaterials(nextMaterials);
            if (reset) {
                setRawMaterialEditing({});
            }
            setRawMaterialRates((current) => ({
                ...current,
                ...buildRawMaterialRateMap(materials)
            }));
            setRawMaterialTotal(Number(data.total ?? nextMaterials.length));
            setRawMaterialHasMore(Boolean(data.hasMore));
            return materials;
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load raw materials");
            return [];
        }
        finally {
            setRawMaterialLoadingMore(false);
        }
    }
    async function loadMoreRawMaterials() {
        if (rawMaterialLoadingMore || !rawMaterialHasMore || activeSection !== "rawMaterials") {
            return;
        }
        setRawMaterialLoadingMore(true);
        await loadRawMaterials({ search: rawMaterialSearchTerm.trim() });
    }
    async function resetRawMaterials() {
        setRawMaterials([]);
        setRawMaterialRates({});
        setRawMaterialEditing({});
        setSelectedRawMaterialCodes([]);
        setRawMaterialSelectionMode(false);
        setRawMaterialTotal(0);
        setRawMaterialHasMore(true);
        await loadRawMaterials({ reset: true, search: rawMaterialSearchTerm.trim() });
    }
    async function findRawMaterialByCode(code) {
        const trimmedCode = code.trim();
        if (!trimmedCode) {
            return null;
        }
        const response = await apiRequest(`/api/admin/raw-materials?${new URLSearchParams({
            limit: "1",
            offset: "0",
            code: trimmedCode
        }).toString()}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Failed to load raw materials");
        }
        const matches = Array.isArray(data.materials) ? data.materials : [];
        return matches[0] ?? null;
    }
    async function searchRawMaterialSuggestions(query) {
        const trimmed = query.trim();
        if (trimmed.length < 1) {
            setRawMaterialLookupResults([]);
            setRawMaterialLookupLoading(false);
            return;
        }
        setRawMaterialLookupLoading(true);
        try {
            const response = await apiRequest(`/api/admin/raw-materials?${new URLSearchParams({
                limit: "10",
                offset: "0",
                search: trimmed
            }).toString()}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to search raw materials");
            }
            setRawMaterialLookupResults(Array.isArray(data.materials) ? data.materials : []);
        }
        catch (error) {
            setRawMaterialLookupResults([]);
            toast.error(error instanceof Error ? error.message : "Failed to search raw materials");
        }
        finally {
            setRawMaterialLookupLoading(false);
        }
    }
    async function searchRawMaterialPicker(query, offset = 0, append = false) {
        const trimmed = query.trim();
        setRawMaterialPickerLoading(true);
        try {
            const requestParams = new URLSearchParams({
                limit: "20",
                offset: String(offset)
            });
            if (trimmed.length >= 1) {
                requestParams.set("search", trimmed);
            }
            const response = await apiRequest(`/api/admin/raw-materials?${requestParams.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to search raw materials");
            }
            const materials = Array.isArray(data.materials) ? data.materials : [];
            setRawMaterialTotal(Number(data.total ?? materials.length));
            setRawMaterialPickerResults((current) => append ? [...current, ...materials] : materials);
            if (!append) {
                setRawMaterialPickerActiveIndex(0);
                const exactMatch = materials.length === 1 && isPickerExactQueryMatch(materials[0], trimmed) ? materials[0] : null;
                if (exactMatch) {
                    setRawMaterialPickerSelectedCodes([exactMatch.code]);
                }
            }
            setRawMaterialPickerHasMore(Boolean(data.hasMore));
            setRawMaterialPickerOffset(Number(data.nextOffset ?? offset + materials.length));
        }
        catch (error) {
            setRawMaterialPickerResults([]);
            setRawMaterialPickerHasMore(false);
            toast.error(error instanceof Error ? error.message : "Failed to search raw materials");
        }
        finally {
            setRawMaterialPickerLoading(false);
        }
    }
    async function loadAllRawMaterialPickerResults(query = rawMaterialPickerQuery) {
        const trimmed = query.trim();
        const materials = [];
        let offset = 0;
        while (true) {
            const requestParams = new URLSearchParams({
                limit: "100",
                offset: String(offset)
            });
            if (trimmed.length >= 1) {
                requestParams.set("search", trimmed);
            }
            const response = await apiRequest(`/api/admin/raw-materials?${requestParams.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to search raw materials");
            }
            const pageMaterials = Array.isArray(data.materials) ? data.materials : [];
            materials.push(...pageMaterials);
            if (!data.hasMore || pageMaterials.length === 0) {
                break;
            }
            offset = Number(data.nextOffset ?? offset + pageMaterials.length);
        }
        setRawMaterialTotal(materials.length);
        return materials;
    }
    async function loadMoreRawMaterialPicker() {
        if (rawMaterialPickerLoading || !rawMaterialPickerHasMore) {
            return;
        }
        await searchRawMaterialPicker(rawMaterialPickerQuery, rawMaterialPickerOffset, true);
    }
    function openRawMaterialPicker() {
        setRawMaterialPickerOpen(true);
        setRawMaterialPickerResults([]);
        setRawMaterialPickerSelectedCodes([]);
        setRawMaterialPickerActiveIndex(0);
        setRawMaterialPickerLastCheckedIndex(null);
        setRawMaterialPickerHasMore(false);
        setRawMaterialPickerOffset(0);
    }
    function closeRawMaterialPicker() {
        setRawMaterialPickerOpen(false);
        setRawMaterialPickerResults([]);
        setRawMaterialPickerSelectedCodes([]);
        setRawMaterialPickerActiveIndex(0);
        setRawMaterialPickerLastCheckedIndex(null);
        setRawMaterialPickerHasMore(false);
        setRawMaterialPickerOffset(0);
        if (rawMaterialPickerDebounceRef.current) {
            clearTimeout(rawMaterialPickerDebounceRef.current);
            rawMaterialPickerDebounceRef.current = null;
        }
    }
    function toggleRawMaterialPickerSelection(code) {
        setRawMaterialPickerSelectedCodes((current) => current.includes(code)
            ? current.filter((itemCode) => itemCode !== code)
            : [...current, code]);
    }
    function selectRawMaterialPickerRange(toIndex) {
        if (rawMaterialPickerLastCheckedIndex === null) {
            const material = rawMaterialPickerResults[toIndex];
            if (material) {
                toggleRawMaterialPickerSelection(material.code);
                setRawMaterialPickerLastCheckedIndex(toIndex);
            }
            return;
        }
        const start = Math.min(rawMaterialPickerLastCheckedIndex, toIndex);
        const end = Math.max(rawMaterialPickerLastCheckedIndex, toIndex);
        const codesInRange = rawMaterialPickerResults
            .slice(start, end + 1)
            .filter((material) => !getExistingProductRawMaterialCodes().has(String(material.code ?? "").trim().toLowerCase()))
            .map((material) => material.code);
        setRawMaterialPickerSelectedCodes((current) => Array.from(new Set([...current, ...codesInRange])));
        setRawMaterialPickerLastCheckedIndex(toIndex);
    }
    async function toggleSelectCurrentPickerPage() {
        const existingCodes = getExistingProductRawMaterialCodes();
        const currentPageCodes = rawMaterialPickerResults
            .filter((material) => !existingCodes.has(String(material.code ?? "").trim().toLowerCase()))
            .map((material) => material.code);
        if (rawMaterialPickerQuery.trim().length === 0) {
            setRawMaterialPickerLoading(true);
            try {
                const allMaterials = await loadAllRawMaterialPickerResults("");
                const allCodes = allMaterials
                    .filter((material) => !existingCodes.has(String(material.code ?? "").trim().toLowerCase()))
                    .map((material) => material.code);
                const allSelected = allCodes.length > 0 &&
                    allCodes.every((code) => rawMaterialPickerSelectedCodes.includes(code));
                setRawMaterialPickerResults(allMaterials);
                setRawMaterialPickerHasMore(false);
                setRawMaterialPickerOffset(allMaterials.length);
                setRawMaterialPickerSelectedCodes((current) => allSelected
                    ? current.filter((code) => !allCodes.includes(code))
                    : Array.from(new Set([...current, ...allCodes])));
                return;
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to load raw materials");
                return;
            }
            finally {
                setRawMaterialPickerLoading(false);
            }
        }
        const allSelected = currentPageCodes.length > 0 &&
            currentPageCodes.every((code) => rawMaterialPickerSelectedCodes.includes(code));
        setRawMaterialPickerSelectedCodes((current) => allSelected
            ? current.filter((code) => !currentPageCodes.includes(code))
            : Array.from(new Set([...current, ...currentPageCodes])));
    }
    function getExistingProductRawMaterialCodes() {
        return new Set(rows.map((row) => String(row.code ?? "").trim().toLowerCase()).filter(Boolean));
    }
    function getPickerExactMatch() {
        const normalizedQuery = rawMaterialPickerQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            return null;
        }
        return rawMaterialPickerResults.find((material) => String(material.code ?? "").trim().toLowerCase() === normalizedQuery ||
            String(material.name ?? "").trim().toLowerCase() === normalizedQuery) ?? null;
    }
    function isPickerExactQueryMatch(material, query) {
        const normalizedQuery = String(query ?? "").trim().toLowerCase();
        if (!normalizedQuery) {
            return false;
        }
        return String(material.code ?? "").trim().toLowerCase() === normalizedQuery ||
            String(material.name ?? "").trim().toLowerCase() === normalizedQuery;
    }
    function addRawMaterialsToRows(materials) {
        const existingCodes = getExistingProductRawMaterialCodes();
        const uniqueMaterials = [];
        const skippedDuplicates = [];
        for (const material of materials) {
            const normalizedCode = String(material.code ?? "").trim().toLowerCase();
            if (!normalizedCode)
                continue;
            if (existingCodes.has(normalizedCode)) {
                skippedDuplicates.push(material.code);
                continue;
            }
            existingCodes.add(normalizedCode);
            uniqueMaterials.push(material);
        }
        if (uniqueMaterials.length === 0) {
            toast.error("All selected raw materials are already in this product.");
            return;
        }
        setRows((current) => [
            ...current,
            ...uniqueMaterials.map((material) => ({
                code: String(material.code ?? ""),
                name: String(material.name ?? ""),
                quantity: "",
                rate: String(material.rate ?? "")
            }))
        ]);
        const duplicateNote = skippedDuplicates.length > 0 ? `, ${skippedDuplicates.length} duplicates skipped` : "";
        toast.success(`Added ${uniqueMaterials.length} raw materials${duplicateNote}`);
    }
    function addSelectedRawMaterialsToRows() {
        const selected = rawMaterialPickerResults.filter((material) => rawMaterialPickerSelectedCodes.includes(material.code));
        if (selected.length === 0) {
            toast.error("Select at least one raw material.");
            return;
        }
        addRawMaterialsToRows(selected);
        setRawMaterialPickerSelectedCodes([]);
        setRawMaterialPickerOpen(false);
        setRawMaterialPickerLastCheckedIndex(null);
    }
    function addExactMatchRawMaterialToRows() {
        const exactMatch = getPickerExactMatch();
        if (!exactMatch) {
            toast.error("No exact match found for that search text.");
            return;
        }
        addRawMaterialsToRows([exactMatch]);
        setRawMaterialPickerSelectedCodes([]);
        setRawMaterialPickerOpen(false);
        setRawMaterialPickerLastCheckedIndex(null);
    }
    function addActiveRawMaterialToRows() {
        const activeMaterial = rawMaterialPickerResults[rawMaterialPickerActiveIndex];
        if (!activeMaterial) {
            return;
        }
        addRawMaterialsToRows([activeMaterial]);
        setRawMaterialPickerSelectedCodes([]);
        setRawMaterialPickerOpen(false);
        setRawMaterialPickerLastCheckedIndex(null);
    }
    async function fillRowFromRawMaterialCode(index) {
        try {
            const row = rows[index];
            const code = row.code.trim();
            if (!code) {
                toast.error("Enter a raw material code first.");
                return;
            }
            const matched = await findRawMaterialByCode(code);
            if (!matched) {
                toast.error(`No raw material found for code "${code}".`);
                return;
            }
            setRawMaterialRates((current) => ({
                ...current,
                [matched.code]: String(matched.rate)
            }));
            setRows((current) => current.map((currentRow, rowIndex) => rowIndex === index
                ? {
                    ...currentRow,
                    code: matched.code,
                    name: matched.name,
                    rate: String(matched.rate)
                }
                : currentRow));
            window.setTimeout(() => {
                focusProductRowField(index, "name");
            }, 0);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load raw material");
        }
    }
    async function addRawMaterial() {
        const name = newRawMaterialName.trim();
        const code = newRawMaterialCode.trim() || generateRawMaterialCode(name);
        const rateValue = Number(newRawMaterialRate);
        if (!name) {
            toast.error("Raw material name is required.");
            return;
        }
        if (!code) {
            toast.error("Raw material code is required.");
            return;
        }
        if (newRawMaterialRate.trim() === "" || Number.isNaN(rateValue)) {
            toast.error("Enter a valid rate.");
            return;
        }
        setLoading(true);
        try {
            const response = await apiRequest("/api/admin/raw-materials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, name, rate: rateValue })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to create raw material");
            setNewRawMaterialCode("");
            setNewRawMaterialName("");
            setNewRawMaterialRate("");
            await resetRawMaterials();
            toast.success("Raw material added");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create raw material");
        }
        finally {
            setLoading(false);
        }
    }
    function clearRawMaterialImportState() {
        setRawMaterialImportOpen(false);
        setRawMaterialImportFileName("");
        setRawMaterialImportRows([]);
        setRawMaterialImportResult(null);
        setRawMaterialImportLoading(false);
        if (rawMaterialImportInputRef.current) {
            rawMaterialImportInputRef.current.value = "";
        }
    }
    function openRawMaterialImportDialog() {
        setRawMaterialImportResult(null);
        rawMaterialImportInputRef.current?.click();
    }
    async function downloadRawMaterialTemplate() {
        const XLSX = await import("xlsx");
        const worksheetData = [
            ["code", "name", "rate"],
            ["RM-001", "Sample Raw Material", 10]
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RawMaterials");
        XLSX.writeFile(workbook, "raw-material-template.xlsx");
    }
    function getImportHeaderIndex(headers, candidates) {
        return headers.findIndex((header) => candidates.includes(normalizeHeader(header)));
    }
    async function fetchAllRawMaterialCodes() {
        const codes = new Set();
        let offset = 0;
        while (true) {
            const response = await apiRequest(`/api/admin/raw-materials?${new URLSearchParams({
                limit: "100",
                offset: String(offset)
            }).toString()}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to load raw materials");
            }
            const materials = Array.isArray(data.materials) ? data.materials : [];
            for (const material of materials) {
                codes.add(String(material.code ?? "").trim().toLowerCase());
            }
            if (!data.hasMore || materials.length === 0) {
                break;
            }
            offset = Number(data.nextOffset ?? offset + materials.length);
        }
        return codes;
    }
    function parseRawMaterialImportRows(aoa, existingCodes = new Set()) {
        const headerIndex = aoa.findIndex((row) => Array.isArray(row) && row.some((cell) => getCellText(cell) !== ""));
        if (headerIndex < 0) {
            return { rows: [], error: "No data found in the file." };
        }
        const headers = aoa[headerIndex] ?? [];
        const codeIndex = getImportHeaderIndex(headers, ["code", "rawmaterialcode"]);
        const nameIndex = getImportHeaderIndex(headers, ["name", "rawmaterialname", "rawmaterial"]);
        const rateIndex = getImportHeaderIndex(headers, ["rate", "price", "cost"]);
        if (nameIndex < 0 || rateIndex < 0) {
            return {
                rows: [],
                error: "The file must include name and rate columns."
            };
        }
        const parsedRows = [];
        const seenCodes = new Set();
        for (let index = headerIndex + 1; index < aoa.length; index += 1) {
            const row = aoa[index] ?? [];
            const code = getCellText(codeIndex >= 0 ? row[codeIndex] : "");
            const name = getCellText(row[nameIndex]);
            const rateValue = row[rateIndex];
            const generatedCode = code || (name ? generateRawMaterialCode(name) : "");
            const rate = Number(rateValue);
            const errors = [];
            if (!name) {
                errors.push("Name is required");
            }
            if (!generatedCode) {
                errors.push("Code is required");
            }
            if (String(rateValue).trim() === "" || Number.isNaN(rate) || rate < 0) {
                errors.push("Rate must be a valid number");
            }
            const normalizedCode = generatedCode ? generatedCode.trim().toLowerCase() : "";
            if (normalizedCode && seenCodes.has(normalizedCode)) {
                errors.push("Duplicate code in file");
            }
            if (normalizedCode && existingCodes.has(normalizedCode)) {
                errors.push("Code already exists in database");
            }
            if (normalizedCode) {
                seenCodes.add(normalizedCode);
            }
            if (!name && !String(code).trim() && String(rateValue).trim() === "") {
                continue;
            }
            parsedRows.push({
                rowNumber: index + 1,
                code: generatedCode,
                name,
                rate: String(rateValue).trim() === "" ? "" : rate,
                isValid: errors.length === 0,
                errors
            });
        }
        if (parsedRows.length === 0) {
            return { rows: [], error: "No data rows found below the header." };
        }
        return { rows: parsedRows, error: "" };
    }
    async function handleRawMaterialFileChange(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        setRawMaterialImportLoading(true);
        setRawMaterialImportResult(null);
        try {
            const XLSX = await import("xlsx");
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                throw new Error("The uploaded file does not contain any sheets.");
            }
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            const existingCodes = await fetchAllRawMaterialCodes();
            const parsed = parseRawMaterialImportRows(rows, existingCodes);
            if (parsed.error) {
                throw new Error(parsed.error);
            }
            setRawMaterialImportFileName(file.name);
            setRawMaterialImportRows(parsed.rows);
            setRawMaterialImportOpen(true);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to read Excel file");
        }
        finally {
            setRawMaterialImportLoading(false);
        }
    }
    async function importRawMaterialsFromFile() {
        const validRows = rawMaterialImportRows.filter((row) => row.isValid).map((row) => ({
            code: row.code,
            name: row.name,
            rate: row.rate
        }));
        if (validRows.length === 0) {
            toast.error("No valid rows to import.");
            return;
        }
        setRawMaterialImportLoading(true);
        try {
            const response = await apiRequest("/api/admin/raw-materials/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ materials: validRows })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to import raw materials");
            }
            await resetRawMaterials();
            const createdCount = Number(data.createdCount ?? 0);
            const skippedCount = Number(data.skippedCount ?? 0);
            if (createdCount > 0) {
                toast.success(`Imported ${createdCount} raw materials`);
            }
            if (skippedCount > 0) {
                toast.error(`${skippedCount} rows were skipped`);
            }
            clearRawMaterialImportState();
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to import raw materials");
        }
        finally {
            setRawMaterialImportLoading(false);
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
    function hasProductNameConflict(candidateName, ignoreName) {
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
            const response = await apiRequest("/api/admin/tables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to create table");
            await refreshTableList(trimmed);
            await loadTable(trimmed);
            toast.success("Product created");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create table");
        }
        finally {
            setLoading(false);
        }
    }
    async function duplicateTable(sourceTableName = tableName) {
        const sourceName = sourceTableName.trim() || tableName;
        const trimmed = getDuplicateTableName(sourceName);
        setLoading(true);
        try {
            const response = await apiRequest("/api/admin/tables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, duplicateFrom: sourceName })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to duplicate table");
            await refreshTableList(trimmed);
            await loadTable(trimmed);
            toast.success("Product duplicated");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to duplicate table");
        }
        finally {
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
            const response = await apiRequest("/api/admin/tables", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fromName, toName })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to rename table");
            updateAdminUrl(toName, activeSection);
            setTableName(toName);
            setRenameTableName(toName);
            setIsRenamingTable(false);
            await loadTable(toName);
            await refreshTableList(toName);
            toast.success("Product renamed");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to rename table");
        }
        finally {
            setLoading(false);
        }
    }
    async function deleteTable(tableToDelete = tableName) {
        const name = tableToDelete.trim();
        if (!name)
            return;
        if (availableTables.length <= 1) {
            toast.error("At least one product must remain.");
            return;
        }
        const confirmed = window.confirm(`Delete ${name} and all its rows?`);
        if (!confirmed)
            return;
        setLoading(true);
        try {
            const response = await apiRequest("/api/admin/tables", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to delete table");
            const fallbackTable = data.tables?.[0]?.name || "Product 1";
            updateAdminUrl(fallbackTable, activeSection);
            setTableName(fallbackTable);
            setRenameTableName(fallbackTable);
            setIsRenamingTable(false);
            await loadTable(fallbackTable);
            await refreshTableList(fallbackTable);
            toast.success("Product deleted");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete table");
        }
        finally {
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
    function updateRow(index, key, value) {
        setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
    }
    function getProductRowKey(row, index) {
        return row?.uiKey ?? row?.id ?? `new-${index}`;
    }
    function toggleProductRowSelection(rowKey) {
        setSelectedProductRowKeys((current) => current.includes(rowKey)
            ? current.filter((key) => key !== rowKey)
            : [...current, rowKey]);
    }
    function toggleAllProductRowsSelected() {
        const selectableRowKeys = rows
            .filter((row) => !isBlankProductRow(row))
            .map((row, index) => getProductRowKey(row, index));
        setSelectedProductRowKeys((current) => current.length === selectableRowKeys.length ? [] : selectableRowKeys);
    }
    function toggleProductSelectionMode() {
        setProductSelectionMode((current) => {
            const next = !current;
            if (!next) {
                setSelectedProductRowKeys([]);
            }
            return next;
        });
    }
    async function addRow() {
        const lastIndex = rows.length - 1;
        const lastRow = rows[lastIndex];
        const hasIncompleteRow = rows.some((row) => !isBlankProductRow(row) &&
            (!row.code.trim() || !row.name.trim() || row.quantity.trim() === "" || row.rate.trim() === ""));
        if (hasIncompleteRow) {
            toast.error("Please save the current row before adding a new one.");
            return;
        }
        if (lastRow && !isBlankProductRow(lastRow)) {
            const saved = await saveRow(lastIndex, { focusNext: false });
            if (!saved) {
                return;
            }
        }
        setRows((current) => [...current, createEmptyRow()]);
        window.setTimeout(() => {
            focusProductRowField(rows.length, "code");
        }, 0);
    }
    async function deleteSelectedProductRows() {
        const selectedRows = rows
            .map((row, index) => ({ row, index, rowKey: getProductRowKey(row, index) }))
            .filter(({ rowKey, row }) => selectedProductRowKeys.includes(rowKey) && !isBlankProductRow(row));
        if (selectedRows.length === 0) {
            toast.error("Select at least one item to delete.");
            return;
        }
        const confirmed = window.confirm(`Delete ${selectedRows.length} selected item${selectedRows.length === 1 ? "" : "s"}?`);
        if (!confirmed) {
            return;
        }
        setLoading(true);
        try {
            const idsToDelete = selectedRows.map(({ row }) => row.id).filter(Boolean);
            if (idsToDelete.length > 0) {
                await Promise.all(idsToDelete.map((id) => apiRequest(`/api/admin/items/${id}`, { method: "DELETE" })));
            }
            const selectedKeySet = new Set(selectedProductRowKeys);
            const nextRows = rows.filter((row, index) => !selectedKeySet.has(getProductRowKey(row, index)));
            setRows(nextRows.length > 0 ? nextRows : [createEmptyRow()]);
            setSelectedProductRowKeys([]);
            setProductSelectionMode(false);
            await refreshTableList(tableName);
            toast.success(`Deleted ${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"}`);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete selected items");
        }
        finally {
            setLoading(false);
        }
    }
    function startEditingRow(index) {
        const row = rows[index];
        if (!row)
            return;
        setRowEditing((current) => ({
            ...current,
            [row.uiKey]: true
        }));
        window.setTimeout(() => {
            focusProductRowField(index, "quantity");
        }, 0);
    }
    function focusProductRowField(index, field) {
        const row = rows[index];
        const rowKey = row?.uiKey ?? row?.id ?? `new-${index}`;
        const input = productRowInputRefs.current[field]?.[rowKey];
        if (input) {
            input.focus();
            input.select?.();
        }
    }
    function focusNextEditableField(index, field) {
        if (field === "code") {
            focusProductRowField(index, "quantity");
            return;
        }
        if (field === "name") {
            focusProductRowField(index, "quantity");
            return;
        }
        if (field === "quantity") {
            focusNextProductRowCode(index);
            return;
        }
        focusNextProductRowCode(index);
    }
    async function fillRowFromRawMaterialName(index) {
        try {
            const row = rows[index];
            const name = row.name.trim();
            if (!name) {
                toast.error("Enter a raw material name first.");
                return;
            }
            const response = await apiRequest(`/api/admin/raw-materials?${new URLSearchParams({
                limit: "10",
                offset: "0",
                search: name
            }).toString()}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to load raw material");
            }
            const normalized = name.toLowerCase();
            const matched = (Array.isArray(data.materials) ? data.materials : []).find((material) => String(material.name ?? "").trim().toLowerCase() === normalized ||
                String(material.code ?? "").trim().toLowerCase() === normalized);
            if (!matched) {
                toast.error(`No raw material found for name "${name}".`);
                return;
            }
            setRawMaterialRates((current) => ({
                ...current,
                [matched.code]: String(matched.rate)
            }));
            setRows((current) => current.map((currentRow, rowIndex) => rowIndex === index
                ? {
                    ...currentRow,
                    code: matched.code,
                    name: matched.name,
                    rate: String(matched.rate)
                }
                : currentRow));
            window.setTimeout(() => {
                focusProductRowField(index, "quantity");
            }, 0);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load raw material");
        }
    }
    function focusNextProductRowCode(index) {
        const nextIndex = index + 1;
        if (nextIndex >= rows.length) {
            setRows((current) => ensureTrailingBlankRow(current));
            window.setTimeout(() => {
                focusProductRowField(nextIndex, "code");
            }, 0);
            return;
        }
        focusProductRowField(nextIndex, "code");
    }
    function ensureTrailingBlankRow(currentRows) {
        if (currentRows.length === 0) {
            return [createEmptyRow()];
        }
        const lastRow = currentRows[currentRows.length - 1];
        const isLastRowBlank = !lastRow?.code.trim() && !lastRow?.name.trim() && !lastRow?.quantity.trim() && !lastRow?.rate.trim();
        return isLastRowBlank ? currentRows : [...currentRows, createEmptyRow()];
    }
    function isBlankProductRow(row) {
        return !row?.code.trim() && !row?.name.trim() && !row?.quantity.trim() && !row?.rate.trim();
    }
    function trimExtraTrailingBlankRows(currentRows) {
        if (currentRows.length <= 1) {
            return currentRows.length === 0 ? [createEmptyRow()] : currentRows;
        }
        let lastNonBlankIndex = -1;
        currentRows.forEach((row, index) => {
            const isBlank = !row.code.trim() && !row.name.trim() && !row.quantity.trim() && !row.rate.trim();
            if (!isBlank) {
                lastNonBlankIndex = index;
            }
        });
        if (lastNonBlankIndex < 0) {
            return [currentRows[0]];
        }
        const keepLength = Math.min(currentRows.length, lastNonBlankIndex + 2);
        return currentRows.slice(0, keepLength);
    }
    async function deleteRow(index) {
        const row = rows[index];
        if (row.id) {
            setLoading(true);
            try {
                const response = await apiRequest(`/api/admin/items/${row.id}`, { method: "DELETE" });
                const data = await response.json();
                if (!response.ok)
                    throw new Error(data.message || "Failed to delete row");
                toast.success("Row deleted");
                await refreshTableList(tableName);
            }
            catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to delete row");
            }
            finally {
                setLoading(false);
            }
        }
        setRowEditing((current) => {
            const next = { ...current };
            delete next[row.uiKey];
            return next;
        });
        setRows((current) => {
            const next = current.filter((_, rowIndex) => rowIndex !== index);
            return next.length > 0 ? next : [createEmptyRow()];
        });
    }
    async function saveRow(index, options = {}) {
        const row = rows[index];
        const rowKey = row?.uiKey ?? row?.id ?? `new-${index}`;
        if (!row.name.trim() || row.quantity.trim() === "" || row.rate.trim() === "") {
            toast.error("Fill item name, quantity, and rate before saving this row.");
            return false;
        }
        if (Number.isNaN(Number(row.quantity)) || Number.isNaN(Number(row.rate))) {
            toast.error("Quantity and rate must be valid numbers.");
            return false;
        }
        setRowSaving((current) => ({ ...current, [rowKey]: true }));
        try {
            const payload = normalizeRow(row);
            const method = row.id ? "PATCH" : "POST";
            const endpoint = row.id ? apiUrl(`/api/admin/items/${row.id}`) : apiUrl("/api/admin/items");
            const response = await apiRequest(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, tableName })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to save row");
            const saved = data.item;
            setRows((current) => current.map((existing, rowIndex) => rowIndex === index
                ? {
                    uiKey: existing.uiKey,
                    id: saved._id,
                    code: saved.code ?? "",
                    name: saved.name,
                    quantity: String(saved.quantity),
                    rate: String(saved.rate)
                }
                : existing));
            setRowEditing((current) => ({
                ...current,
                [rowKey]: false
            }));
            await refreshTableList(tableName);
            toast.success("Row saved");
            if (options.focusNext !== false) {
                window.setTimeout(() => {
                    if (index === rows.length - 1) {
                        setRows((current) => ensureTrailingBlankRow(current));
                        focusProductRowField(index + 1, "code");
                        return;
                    }
                    focusProductRowField(index + 1, "code");
                }, 0);
            }
            return true;
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save row");
            return false;
        }
        finally {
            setRowSaving((current) => ({ ...current, [rowKey]: false }));
        }
    }
    async function saveAll() {
        const rowsToSave = rows.filter((row) => !isBlankProductRow(row));
        const invalidRow = rowsToSave.find((row) => !row.code.trim() ||
            !row.name.trim() ||
            row.quantity.trim() === "" ||
            row.rate.trim() === "" ||
            Number.isNaN(Number(row.quantity)) ||
            Number.isNaN(Number(row.rate)));
        if (invalidRow) {
            toast.error("Please save the current row before closing.");
            return false;
        }
        const payload = rowsToSave.map(normalizeRow);
        setLoading(true);
        try {
            const response = await apiRequest("/api/admin/items", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tableName, items: payload })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to save items");
            setRows(data.items.map(mapItemToRow));
            setRowEditing({});
            await refreshTableList(tableName);
            toast.success("Master data saved");
            return true;
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save items");
            return false;
        }
        finally {
            setLoading(false);
        }
    }
    async function requestCloseEditor() {
        const hasIncompleteRow = rows.some((row) => !isBlankProductRow(row) &&
            (!row.code.trim() || !row.name.trim() || row.quantity.trim() === "" || row.rate.trim() === ""));
        if (hasIncompleteRow) {
            toast.error("Please save the current row before closing.");
            return;
        }
        const saved = await saveAll();
        if (saved) {
            setIsEditorPopupOpen(false);
        }
    }
    async function saveRawMaterialRate(code) {
        const nextRate = rawMaterialRates[code];
        if (nextRate === undefined || nextRate.trim() === "") {
            toast.error("Enter a valid rate before saving.");
            return;
        }
        if (Number.isNaN(Number(nextRate))) {
            toast.error("Rate must be a valid number.");
            return;
        }
        setRawMaterialSaving((current) => ({ ...current, [code]: true }));
        try {
            const response = await apiRequest("/api/admin/raw-materials", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, rate: Number(nextRate) })
            });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.message || "Failed to update raw material");
            const updatedMaterial = data.material ?? null;
            if (updatedMaterial) {
                setRawMaterials((current) => current.map((material) => material.code.trim().toLowerCase() === code.trim().toLowerCase()
                    ? { ...material, rate: updatedMaterial.rate }
                    : material));
                setRawMaterialRates((current) => ({
                    ...current,
                    [code]: String(Number(nextRate))
                }));
                setRawMaterialEditing((current) => ({
                    ...current,
                    [code]: false
                }));
            }
            setRows((current) => current.map((row) => (row.code.trim().toLowerCase() === code.trim().toLowerCase() ||
                row.name.trim().toLowerCase() === code.trim().toLowerCase())
                ? {
                    ...row,
                    rate: String(Number(nextRate))
                }
                : row));
            toast.success("Raw material rate updated");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update raw material");
        }
        finally {
            setRawMaterialSaving((current) => ({ ...current, [code]: false }));
        }
    }
    function focusRawMaterialRateInput(code) {
        const input = rawMaterialRateInputRefs.current[code];
        if (input) {
            input.focus();
            input.select?.();
        }
    }
    function applyRawMaterialToRow(index, material) {
        if (!material)
            return;
        setRows((current) => current.map((currentRow, rowIndex) => rowIndex === index
            ? {
                ...currentRow,
                code: String(material.code ?? ""),
                name: String(material.name ?? ""),
                rate: String(material.rate ?? "")
            }
            : currentRow));
    }
    function startEditingRawMaterialRate(code) {
        setRawMaterialEditing((current) => ({
            ...current,
            [code]: true
        }));
        focusRawMaterialRateInput(code);
    }
    function cancelEditingRawMaterialRate(code) {
        const material = rawMaterials.find((item) => item.code === code);
        if (material) {
            setRawMaterialRates((current) => ({
                ...current,
                [code]: String(material.rate)
            }));
        }
        setRawMaterialEditing((current) => ({
            ...current,
            [code]: false
        }));
    }
    useEffect(() => {
        if (!isEditorPopupOpen) {
            setRawMaterialLookupQuery("");
            setRawMaterialLookupResults([]);
            setRawMaterialLookupLoading(false);
            if (rawMaterialLookupDebounceRef.current) {
                clearTimeout(rawMaterialLookupDebounceRef.current);
                rawMaterialLookupDebounceRef.current = null;
            }
            return;
        }
        if (rawMaterialLookupDebounceRef.current) {
            clearTimeout(rawMaterialLookupDebounceRef.current);
        }
        rawMaterialLookupDebounceRef.current = setTimeout(() => {
            void searchRawMaterialSuggestions(rawMaterialLookupQuery);
        }, 250);
        return () => {
            if (rawMaterialLookupDebounceRef.current) {
                clearTimeout(rawMaterialLookupDebounceRef.current);
            }
        };
    }, [isEditorPopupOpen, rawMaterialLookupQuery]);
    useEffect(() => {
        if (!rawMaterialPickerOpen) {
            if (rawMaterialPickerDebounceRef.current) {
                clearTimeout(rawMaterialPickerDebounceRef.current);
                rawMaterialPickerDebounceRef.current = null;
            }
            return;
        }
        if (rawMaterialPickerDebounceRef.current) {
            clearTimeout(rawMaterialPickerDebounceRef.current);
        }
        rawMaterialPickerDebounceRef.current = setTimeout(() => {
            void searchRawMaterialPicker(rawMaterialPickerQuery);
        }, 250);
        return () => {
            if (rawMaterialPickerDebounceRef.current) {
                clearTimeout(rawMaterialPickerDebounceRef.current);
            }
        };
    }, [rawMaterialPickerOpen, rawMaterialPickerQuery]);
    useEffect(() => {
        if (rawMaterialPickerActiveIndex >= rawMaterialPickerResults.length) {
            setRawMaterialPickerActiveIndex(rawMaterialPickerResults.length > 0 ? rawMaterialPickerResults.length - 1 : 0);
        }
    }, [rawMaterialPickerActiveIndex, rawMaterialPickerResults.length]);
    useEffect(() => {
        const activeMaterial = rawMaterialPickerResults[rawMaterialPickerActiveIndex];
        if (!rawMaterialPickerOpen || !activeMaterial)
            return;
        const activeElement = rawMaterialPickerItemRefs.current[activeMaterial.code];
        activeElement?.scrollIntoView?.({ block: "nearest" });
    }, [rawMaterialPickerActiveIndex, rawMaterialPickerOpen, rawMaterialPickerResults]);
    useEffect(() => {
        if (rawMaterialPickerOpen) {
            rawMaterialPickerInputRef.current?.focus();
            rawMaterialPickerInputRef.current?.select?.();
        }
    }, [rawMaterialPickerOpen]);
    useEffect(() => {
        function handleOutsideClick(event) {
            if (!exportMenuOpen) {
                return;
            }
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setExportMenuOpen(false);
            }
        }
        function handleEscape(event) {
            if (event.key === "Escape") {
                setExportMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [exportMenuOpen]);
    useEffect(() => {
        if (!isEditorPopupOpen)
            return;
        setRows((current) => ensureTrailingBlankRow(current));
    }, [isEditorPopupOpen]);
    useEffect(() => {
        setSelectedProductRowKeys((current) => {
            const validKeys = new Set(rows.map((row, index) => getProductRowKey(row, index)));
            const next = current.filter((key) => validKeys.has(key));
            return next.length === current.length ? current : next;
        });
    }, [rows]);
    useEffect(() => {
        setRows((current) => {
            const trimmed = trimExtraTrailingBlankRows(current);
            return trimmed.length === current.length && trimmed.every((row, index) => row === current[index]) ? current : trimmed;
        });
    }, [rows]);
    useEffect(() => {
        function handleGlobalShortcut(event) {
            if (!isEditorPopupOpen || rawMaterialPickerOpen) {
                return;
            }
            const key = String(event.key ?? "").toLowerCase();
            if ((event.ctrlKey || event.metaKey) && key === "k") {
                event.preventDefault();
                openRawMaterialPicker();
            }
        }
        window.addEventListener("keydown", handleGlobalShortcut);
        return () => window.removeEventListener("keydown", handleGlobalShortcut);
    }, [isEditorPopupOpen, rawMaterialPickerOpen]);
    useEffect(() => {
        if (!rawMaterialPickerOpen)
            return;
        const target = rawMaterialPickerLoadMoreRef.current;
        const root = rawMaterialPickerScrollRef.current;
        if (!target || !root)
            return;
        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries;
            if (!entry?.isIntersecting)
                return;
            void loadMoreRawMaterialPicker();
        }, {
            root,
            rootMargin: "120px"
        });
        observer.observe(target);
        return () => observer.disconnect();
    }, [rawMaterialPickerOpen, rawMaterialPickerHasMore, rawMaterialPickerLoading, rawMaterialPickerQuery, rawMaterialPickerOffset]);
    function toggleRawMaterialSelection(code) {
        setSelectedRawMaterialCodes((current) => current.includes(code)
            ? current.filter((itemCode) => itemCode !== code)
            : [...current, code]);
    }
    function toggleRawMaterialSelectionMode() {
        setRawMaterialSelectionMode((current) => {
            const next = !current;
            if (!next) {
                setSelectedRawMaterialCodes([]);
            }
            return next;
        });
    }
    function toggleAllRawMaterialsSelected() {
        setSelectedRawMaterialCodes((current) => current.length === rawMaterials.length ? [] : rawMaterials.map((material) => material.code));
    }
    async function deleteSelectedRawMaterials() {
        if (selectedRawMaterialCodes.length === 0) {
            toast.error("Select at least one raw material to delete.");
            return;
        }
        const confirmed = window.confirm(`Delete ${selectedRawMaterialCodes.length} selected raw materials?`);
        if (!confirmed) {
            return;
        }
        setLoading(true);
        try {
            const response = await apiRequest("/api/admin/raw-materials", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codes: selectedRawMaterialCodes })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to delete raw materials");
            }
            toast.success(`Deleted ${Number(data.deletedCount ?? 0)} raw materials`);
            setSelectedRawMaterialCodes([]);
            await resetRawMaterials();
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete raw materials");
        }
        finally {
            setLoading(false);
        }
    }
    const calculatedRows = rows.map((row) => ({
        ...row,
        amount: calculateAmount(Number(row.quantity || 0), Number(row.rate || 0))
    }));
    const totalAmount = calculateGrandTotal(rows.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity || 0),
        rate: Number(row.rate || 0)
    })));
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
    return (<div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button variant={activeSection === "products" ? "primary" : "secondary"} onClick={() => {
            setActiveSection("products");
            updateAdminUrl(tableName, "products");
        }}>
          Product
        </Button>
        <Button variant={activeSection === "rawMaterials" ? "primary" : "secondary"} onClick={() => {
            setActiveSection("rawMaterials");
            updateAdminUrl(tableName, "rawMaterials");
        }}>
          Raw Material
        </Button>
      </div>

      <Card className={activeSection === "products" ? "" : "hidden"}>
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
                <Plus className="mr-2 h-4 w-4"/>
                {primaryActionLabel}
              </Button>
              <Button variant="secondary" onClick={() => loadTable(tableName, { openEditorPopup: true })} disabled={loading}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
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
                    Showing {visibleTables.length} of {filteredTables.length}
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="min-w-0 md:w-[280px]" placeholder="Search products, names, or rows" aria-label="Search products"/>
                </div>
              </div>
            </div>

            <div ref={productScrollRef} className="max-h-[70vh] overflow-y-auto">
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
                  {visibleTables.map((table) => {
            const displayName = formatProductLabel(table.name);
            const active = table.name === tableName;
            return (<tr key={table.name} className={active ? "border-t border-line bg-accentSoft/25" : "border-t border-line"}>
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
                              <Copy className="mr-2 h-5 w-5"/>
                              Duplicate
                            </Button>
                            <Button variant="danger" onClick={() => deleteTable(table.name)} disabled={loading}>
                              <Trash2 className="mr-2 h-5 w-5"/>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>);
        })}
                </tbody>
              </table>
              <div ref={productLoadMoreRef} className="h-8" />
              {visibleTables.length < filteredTables.length ? (<div className="border-t border-line px-5 py-4 text-sm text-muted">Loading more products as you scroll...</div>) : null}
              {visibleTables.length === 0 ? (<div className="border-t border-line px-5 py-8 text-sm text-muted">
                  {searchTerm.trim() ? "No products match your search." : "No products found."}
                </div>) : null}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className={activeSection === "rawMaterials" ? "" : "hidden"}>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-lg font-semibold">Raw Materials</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void downloadRawMaterialTemplate()} disabled={rawMaterialImportLoading}>
                <FileSpreadsheet className="mr-2 h-4 w-4"/>
                Download Template
              </Button>
              <Button variant="secondary" onClick={openRawMaterialImportDialog} disabled={rawMaterialImportLoading}>
                <Upload className="mr-2 h-4 w-4"/>
                Import Excel
              </Button>
              <Button variant="secondary" onClick={() => void resetRawMaterials()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}/>
                Reload
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 rounded-3xl border border-line bg-white p-4 md:grid-cols-[1fr_1.4fr_0.8fr_auto]">
            <Input value={newRawMaterialCode} onChange={(e) => setNewRawMaterialCode(e.target.value)} placeholder="Code" aria-label="Raw material code"/>
            <Input value={newRawMaterialName} onChange={(e) => setNewRawMaterialName(e.target.value)} placeholder="Raw material name" aria-label="Raw material name"/>
            <Input type="number" min="0" step="0.01" value={newRawMaterialRate} onChange={(e) => setNewRawMaterialRate(e.target.value)} placeholder="Rate" aria-label="Raw material rate"/>
            <Button variant="primary" onClick={addRawMaterial} disabled={loading}>
              <Plus className="mr-2 h-4 w-4"/>
              Add Raw Material
            </Button>
          </div>
          <input ref={rawMaterialImportInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleRawMaterialFileChange}/>

          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Raw Material List</p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <Input value={rawMaterialSearchTerm} onChange={(e) => setRawMaterialSearchTerm(e.target.value)} className="min-w-0 md:w-[280px]" placeholder="Search raw materials, products, or rates" aria-label="Search raw materials"/>
                    <Button variant="secondary" onClick={toggleRawMaterialSelectionMode} disabled={loading}>
                      {rawMaterialSelectionMode ? "Cancel" : "Select"}
                      {selectedRawMaterialCodes.length > 0 ? (<span className="ml-2 rounded-full bg-accentSoft px-2 py-0.5 text-xs font-semibold text-accent">
                          {selectedRawMaterialCodes.length}
                        </span>) : null}
                    </Button>
                    {rawMaterialSelectionMode ? (<Button variant="danger" onClick={() => void deleteSelectedRawMaterials()} disabled={loading || selectedRawMaterialCodes.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete Selected{selectedRawMaterialCodes.length > 0 ? ` (${selectedRawMaterialCodes.length})` : ""}
                      </Button>) : null}
                </div>
              </div>
            </div>

            <div ref={rawMaterialScrollRef} className="max-h-[70vh] overflow-y-auto">
              <div className="overflow-x-auto">
                <table className={`${rawMaterialSelectionMode ? "min-w-[1040px]" : "min-w-[960px]"} w-full table-fixed border-collapse`}>
                  <thead className="bg-slate-50 text-left text-sm text-muted">
                    <tr>
                      {rawMaterialSelectionMode ? (<th className="w-[52px] px-4 py-4 font-medium">
                          <input type="checkbox" aria-label="Select all raw materials" checked={rawMaterials.length > 0 && selectedRawMaterialCodes.length === rawMaterials.length} onChange={toggleAllRawMaterialsSelected} />
                        </th>) : null}
                      <th className="px-5 py-4 font-medium">Code</th>
                      <th className="px-5 py-4 font-medium">Raw Material</th>
                      <th className="px-5 py-4 font-medium">Rate</th>
                      <th className="w-[190px] px-5 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawMaterials.map((material) => {
                      const activeRate = rawMaterialRates[material.code] ?? String(material.rate);
                      const originalRate = String(material.rate);
                      const isEditing = Boolean(rawMaterialEditing[material.code]);
                      const isDirty = String(activeRate) !== originalRate;
                      return (<tr key={material.code} className="border-t border-line">
                          {rawMaterialSelectionMode ? (<td className="w-[52px] px-4 py-4 align-top">
                              <input type="checkbox" aria-label={`Select raw material ${material.code}`} checked={selectedRawMaterialCodes.includes(material.code)} onChange={() => toggleRawMaterialSelection(material.code)} />
                            </td>) : null}
                          <td className="px-5 py-4 align-top">
                            <div className="font-semibold text-ink">{material.code}</div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="font-semibold text-ink">{material.name}</div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Input ref={(element) => {
                                  if (element) {
                                      rawMaterialRateInputRefs.current[material.code] = element;
                                  }
                                }} type="number" min="0" step="0.01" value={activeRate} readOnly={!isEditing} onChange={(e) => setRawMaterialRates((current) => ({
                      ...current,
                      [material.code]: e.target.value
                  }))} placeholder="0" className={!isEditing ? "bg-slate-50 text-muted cursor-default" : ""}/>
                              </div>
                              <span className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">/KG</span>
                            </div>
                          </td>
                          <td className="w-[190px] px-5 py-4 align-top">
                            <div className="flex min-w-[168px] items-center justify-end gap-2">
                              {isEditing ? (<Button variant="secondary" className="h-11" onClick={() => cancelEditingRawMaterialRate(material.code)} disabled={!!rawMaterialSaving[material.code]}>
                                  Cancel
                                </Button>) : null}
                              <Button variant="secondary" className="h-11" onClick={() => {
                                  if (!isEditing) {
                                      startEditingRawMaterialRate(material.code);
                                      return;
                                  }
                                  if (isDirty) {
                                      void saveRawMaterialRate(material.code);
                                      return;
                                  }
                                  focusRawMaterialRateInput(material.code);
                              }} disabled={!!rawMaterialSaving[material.code]}>
                                {rawMaterialSaving[material.code] ? (<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>) : isEditing && isDirty ? (<Save className="mr-2 h-4 w-4"/>) : (<Edit2 className="mr-2 h-4 w-4"/>)}
                                {isEditing && isDirty ? "Save" : "Edit"}
                              </Button>
                            </div>
                          </td>
                        </tr>);
                    })}
                  </tbody>
                </table>
              </div>
              <div ref={rawMaterialLoadMoreRef} className="h-8" />
              {rawMaterialLoadingMore ? (<div className="border-t border-line px-5 py-4 text-sm text-muted">Loading more raw materials...</div>) : null}
              {!rawMaterialLoadingMore && rawMaterials.length === 0 ? (<div className="border-t border-line px-5 py-8 text-sm text-muted">
                  {rawMaterialSearchTerm.trim() ? "No raw materials match your search." : "No raw materials found."}
                </div>) : null}
              {!rawMaterialHasMore && rawMaterials.length > 0 ? (<div className="border-t border-line px-5 py-4 text-sm text-muted">You've reached the end of the list.</div>) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {rawMaterialImportOpen ? (<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 sm:p-6" onClick={rawMaterialImportLoading ? undefined : clearRawMaterialImportState}>
          <div className="relative mx-auto w-full max-w-6xl pt-10" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" onClick={clearRawMaterialImportState} disabled={rawMaterialImportLoading} className="absolute right-0 top-2 z-10 rounded-full border border-line bg-white px-4 py-2 shadow-sm">
              <X className="mr-2 h-4 w-4"/>
              Close
            </Button>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold">Import Preview</p>
                      <p className="text-sm text-muted">{rawMaterialImportFileName || "Selected file"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-2xl bg-slate-100 px-3 py-2 font-medium text-ink">Rows: {rawMaterialImportRows.length}</span>
                      <span className="rounded-2xl bg-green-100 px-3 py-2 font-medium text-green-700">Valid: {rawMaterialImportRows.filter((row) => row.isValid).length}</span>
                      <span className="rounded-2xl bg-rose-100 px-3 py-2 font-medium text-rose-700">Invalid: {rawMaterialImportRows.filter((row) => !row.isValid).length}</span>
                    </div>
                  </div>
                  {rawMaterialImportResult ? (<div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      Imported {rawMaterialImportResult.createdCount} rows.
                      {rawMaterialImportResult.skippedCount > 0 ? ` Skipped ${rawMaterialImportResult.skippedCount} rows.` : ""}
                    </div>) : null}
                </div>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="max-h-[60vh] overflow-auto rounded-2xl border border-line">
                  <table className="min-w-[900px] w-full border-collapse">
                    <thead className="bg-slate-50 text-left text-sm text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Row</th>
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Rate</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterialImportRows.map((row) => (<tr key={`${row.rowNumber}-${row.code}-${row.name}`} className="border-t border-line">
                          <td className="px-4 py-3 text-sm text-muted">{row.rowNumber}</td>
                          <td className="px-4 py-3 text-sm font-medium text-ink">{row.code || <span className="text-muted">Auto</span>}</td>
                          <td className="px-4 py-3 text-sm text-ink">{row.name || <span className="text-muted">Missing</span>}</td>
                          <td className="px-4 py-3 text-sm text-ink">{row.rate === "" ? <span className="text-muted">Missing</span> : row.rate}</td>
                          <td className="px-4 py-3 text-sm">
                            {row.isValid ? (<span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                                <Check className="mr-1 h-4 w-4"/>
                                Ready
                              </span>) : (<div className="space-y-1 text-rose-700">
                                <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 font-medium">
                                  <AlertCircle className="mr-1 h-4 w-4"/>
                                  Fix row
                                </span>
                                <div className="text-xs">
                                  {row.errors.join(", ")}
                                </div>
                              </div>)}
                          </td>
                        </tr>))}
                    </tbody>
                  </table>
                </div>
                {rawMaterialImportResult?.skippedRows?.length > 0 ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    Some rows were skipped during import. Check the raw material codes and rates in the preview.
                  </div>) : null}
                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="secondary" onClick={clearRawMaterialImportState} disabled={rawMaterialImportLoading}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => void importRawMaterialsFromFile()} disabled={rawMaterialImportLoading || rawMaterialImportRows.every((row) => !row.isValid)}>
                    {rawMaterialImportLoading ? (<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>) : (<Upload className="mr-2 h-4 w-4"/>)}
                    Import &amp; Close
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>) : null}

      {isEditorPopupOpen ? (<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 sm:p-6" onClick={() => void requestCloseEditor()}>
          <div className="relative mx-auto w-full max-w-[92rem] pt-10" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" onClick={() => void requestCloseEditor()} title="Close product editor" className="absolute right-0 top-2 z-10 rounded-full border border-line bg-white px-4 py-2 shadow-sm">
              <X className="mr-2 h-4 w-4"/>
              Close
            </Button>

            <div>
              <Title>Admin Dashboard</Title>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    {isRenamingTable ? (<div className="flex flex-wrap items-center gap-2">
                        <Input ref={tableNameInputRef} value={renameTableName} onChange={(e) => setRenameTableName(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        renameTable();
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRenameTable();
                    }
                }} className="h-11 max-w-[260px]" aria-label="Rename current table"/>
                        <Button variant="secondary" onClick={renameTable} disabled={loading}>
                          <Check className="mr-2 h-4 w-4"/>
                          Save
                        </Button>
                        <Button variant="ghost" onClick={cancelRenameTable} disabled={loading}>
                          Cancel
                        </Button>
                      </div>) : (<button type="button" onDoubleClick={startRenameTable} className="group inline-flex flex-col items-start text-left" title="Double-click to rename product">
                        <span className="text-lg font-semibold transition group-hover:text-accent">
                          {formatProductLabel(tableName || "Product Items")}
                        </span>
                      </button>)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={addRow}>
                      <Plus className="mr-2 h-4 w-4"/>
                      Add Row
                    </Button>
                    <Button variant="secondary" onClick={openRawMaterialPicker}>
                      <Plus className="mr-2 h-4 w-4"/>
                      Add From Raw Materials
                    </Button>
                    <div ref={exportMenuRef} className="relative flex flex-col items-start">
                      <Button variant="secondary" onClick={() => setExportMenuOpen((current) => !current)}>
                        <Download className="mr-2 h-4 w-4"/>
                        Export
                        <ChevronDown className="ml-2 h-4 w-4"/>
                      </Button>
                      <div className="absolute left-0 top-full mt-1 text-xs text-muted whitespace-nowrap">Excel, PDF, Print</div>
                      {exportMenuOpen ? (<div className="absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-xl">
                          <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={async () => {
                        setExportMenuOpen(false);
                        await exportExcel();
                    }}>
                            <FileSpreadsheet className="mr-2 h-4 w-4"/>
                            Export Excel
                          </button>
                          <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={async () => {
                        setExportMenuOpen(false);
                        await exportPdf();
                    }}>
                            <FileText className="mr-2 h-4 w-4"/>
                            Export PDF
                          </button>
                          <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink transition hover:bg-slate-50" onClick={() => {
                        setExportMenuOpen(false);
                        handlePrint();
                    }}>
                            <Printer className="mr-2 h-4 w-4"/>
                            Print
                          </button>
                      </div>) : null}
                    </div>
                    <Button variant={productSelectionMode ? "secondary" : "danger"} onClick={toggleProductSelectionMode} disabled={loading}>
                      <Check className="mr-2 h-5 w-5"/>
                      {productSelectionMode ? "Cancel Select" : "Select"}
                    </Button>
                    {productSelectionMode ? (<Button variant="danger" onClick={() => void deleteSelectedProductRows()} disabled={loading || selectedProductRowKeys.length === 0}>
                        <Trash2 className="mr-2 h-5 w-5"/>
                        Delete Selected{selectedProductRowKeys.length > 0 ? ` (${selectedProductRowKeys.length})` : ""}
                      </Button>) : null}
                    <Button onClick={() => void saveAll()} disabled={loading}>
                      {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                      Save Changes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-[1360px] w-full border-collapse">
                    <thead className="bg-slate-50 text-left text-sm text-muted">
                      <tr>
                        {productSelectionMode ? (<th className="px-4 py-4 font-medium">
                            <input type="checkbox" aria-label="Select all product rows" checked={rows.filter((row) => !isBlankProductRow(row)).length > 0 && selectedProductRowKeys.length === rows.filter((row) => !isBlankProductRow(row)).length} onChange={toggleAllProductRowsSelected}/>
                          </th>) : null}
                        <th className="w-[190px] px-5 py-4 font-medium">Code</th>
                        <th className="w-[300px] px-5 py-4 font-medium">Item Name</th>
                        <th className="w-[180px] px-5 py-4 font-medium">Quantity</th>
                        <th className="w-[180px] px-5 py-4 font-medium">Rate</th>
                        <th className="w-[180px] px-5 py-4 font-medium">Amount</th>
                        <th className="w-[160px] px-5 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => {
                const quantity = Number(row.quantity || 0);
                const rate = Number(row.rate || 0);
                const amount = calculateAmount(quantity, rate);
                const rowKey = getProductRowKey(row, index);
                const isLocked = Boolean(row.id) && !Boolean(rowEditing[rowKey]);
                const isQuantityLocked = Boolean(row.id) && !Boolean(rowEditing[rowKey]);
                const isSelected = selectedProductRowKeys.includes(rowKey);
                return (<tr key={rowKey} className="border-t border-line">
                            {productSelectionMode ? (<td className="px-4 py-4 align-top">
                                <input type="checkbox" aria-label={`Select product row ${row.name || row.code || index + 1}`} checked={selectedProductRowKeys.includes(rowKey)} onChange={() => toggleProductRowSelection(rowKey)}/>
                              </td>) : null}
                            <td className="w-[190px] px-5 py-4 align-top">
                              <Input ref={(element) => {
                        if (!productRowInputRefs.current.code) {
                            productRowInputRefs.current.code = {};
                        }
                        if (element) {
                            productRowInputRefs.current.code[rowKey] = element;
                        }
                        else {
                            delete productRowInputRefs.current.code[rowKey];
                        }
                    }} className="h-10 w-full min-w-[140px]" list="raw-material-lookup-options" autoComplete="off" value={row.code} readOnly={Boolean(row.id)} onChange={(e) => {
                        const nextCode = e.target.value;
                        updateRow(index, "code", nextCode);
                        setRawMaterialLookupQuery(nextCode);
                        const normalized = nextCode.trim().toLowerCase();
                        if (!normalized)
                            return;
                        const matched = rawMaterialLookupResults.find((material) => String(material.code ?? "").trim().toLowerCase() === normalized);
                        if (matched) {
                            applyRawMaterialToRow(index, matched);
                        }
                    }} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void fillRowFromRawMaterialCode(index);
                            return;
                        }
                        if (e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            focusProductRowField(index, "name");
                            return;
                        }
                        if (e.key === "ArrowDown" && index < rows.length - 1) {
                            e.preventDefault();
                            focusProductRowField(index + 1, "code");
                        }
                    }} placeholder="Enter code" onFocus={(e) => {
                        setRawMaterialLookupQuery(e.target.value);
                    }}/>
                            </td>
                            <td className="w-[300px] px-5 py-4 align-top">
                              <Input ref={(element) => {
                        if (!productRowInputRefs.current.name) {
                            productRowInputRefs.current.name = {};
                        }
                        if (element) {
                            productRowInputRefs.current.name[rowKey] = element;
                        }
                        else {
                            delete productRowInputRefs.current.name[rowKey];
                        }
                    }} className="h-10 w-full min-w-[200px]" list="raw-material-name-lookup-options" autoComplete="off" value={row.name} readOnly={Boolean(row.id)} onChange={(e) => {
                        const nextName = e.target.value;
                        updateRow(index, "name", nextName);
                        setRawMaterialLookupQuery(nextName);
                        const normalized = nextName.trim().toLowerCase();
                        if (!normalized)
                            return;
                        const matched = rawMaterialLookupResults.find((material) => String(material.name ?? "").trim().toLowerCase() === normalized ||
                            String(material.code ?? "").trim().toLowerCase() === normalized);
                        if (matched) {
                            applyRawMaterialToRow(index, matched);
                        }
                    }} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void fillRowFromRawMaterialName(index);
                            return;
                        }
                        if (e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            focusNextEditableField(index, "name");
                        }
                    }} placeholder="Enter item name"/>
                            </td>
                            <td className="w-[180px] px-5 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Input ref={(element) => {
                        if (!productRowInputRefs.current.quantity) {
                            productRowInputRefs.current.quantity = {};
                        }
                        if (element) {
                            productRowInputRefs.current.quantity[rowKey] = element;
                        }
                        else {
                            delete productRowInputRefs.current.quantity[rowKey];
                        }
                    }} className="h-10 w-full min-w-[110px]" type="number" min="0" step="0.01" value={row.quantity} readOnly={isQuantityLocked} onChange={(e) => updateRow(index, "quantity", e.target.value)} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void saveRow(index);
                            return;
                        }
                        if (e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            focusNextEditableField(index, "quantity");
                        }
                    }} placeholder="0"/>
                                </div>
                                <span className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">KG</span>
                              </div>
                            </td>
                            <td className="w-[180px] px-5 py-4 align-top">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Input ref={(element) => {
                        if (!productRowInputRefs.current.rate) {
                            productRowInputRefs.current.rate = {};
                        }
                        if (element) {
                            productRowInputRefs.current.rate[rowKey] = element;
                        }
                        else {
                            delete productRowInputRefs.current.rate[rowKey];
                        }
                    }} className="h-10 w-full min-w-[110px]" type="number" min="0" step="0.01" value={row.rate} readOnly onChange={(e) => updateRow(index, "rate", e.target.value)} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            void saveRow(index);
                            return;
                        }
                        if (e.key === "Tab" && !e.shiftKey) {
                            e.preventDefault();
                            focusNextEditableField(index, "rate");
                        }
                    }} placeholder="0"/>
                                </div>
                                <span className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">/KG</span>
                              </div>
                            </td>
                            <td className="w-[180px] px-5 py-4 align-top">
                              <div className="flex h-11 items-center rounded-2xl border border-line bg-slate-50 px-4 text-sm font-semibold text-ink">
                                {amount.toLocaleString()}
                              </div>
                            </td>
                            <td className="w-[160px] px-5 py-4 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="secondary" className="h-11" onClick={() => {
                        if (isLocked) {
                            startEditingRow(index);
                            return;
                        }
                        void saveRow(index);
                    }} disabled={!!rowSaving[rowKey]}>
                                  {rowSaving[rowKey] ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : isLocked ? <Edit2 className="mr-2 h-4 w-4"/> : <Save className="mr-2 h-4 w-4"/>}
                                  {isLocked ? "Edit" : "Save"}
                                </Button>
                                <button type="button" onClick={() => deleteRow(index)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete row">
                                  <Trash2 className="h-4 w-4"/>
                                </button>
                              </div>
                            </td>
                          </tr>);
            })}
                    </tbody>
                    <tfoot className="border-t border-line bg-slate-50">
                      <tr>
                        {productSelectionMode ? <td className="px-4 py-4"/> : null}
                        <td className="px-5 py-4 text-sm font-semibold text-ink">Grand Total</td>
                        <td className="px-5 py-4 text-sm text-muted">Auto calculated</td>
                        <td className="px-5 py-4 text-sm text-muted">Qty x Rate</td>
                        <td className="px-5 py-4 text-sm font-semibold text-ink">{totalAmount.toLocaleString()}</td>
                        <td className="px-5 py-4 text-sm text-muted"/>
                        <td className="px-5 py-4"/>
                      </tr>
                    </tfoot>
                  </table>
                  <datalist id="raw-material-lookup-options">
                    {rawMaterialLookupResults.map((material) => (<option key={material.code} value={material.code}>
                        {material.name}
                      </option>))}
                  </datalist>
                  <datalist id="raw-material-name-lookup-options">
                    {rawMaterialLookupResults.map((material) => (<option key={material.code} value={material.name}>
                        {material.code}
                      </option>))}
                  </datalist>
                </div>
              </CardBody>
            </Card>
          </div>
          {rawMaterialPickerOpen ? (<div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4" onClick={closeRawMaterialPicker}>
              <div className="w-full max-w-4xl rounded-3xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="text-lg font-semibold">Add From Raw Materials</p>
                    <p className="text-sm text-muted">Search the master list and select multiple raw materials to add to this product.</p>
                  </div>
                  <Button variant="ghost" onClick={closeRawMaterialPicker}>
                    <X className="mr-2 h-4 w-4"/>
                    Close
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  <Input ref={rawMaterialPickerInputRef} value={rawMaterialPickerQuery} onChange={(e) => {
                    setRawMaterialPickerQuery(e.target.value);
                  }} onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        closeRawMaterialPicker();
                        return;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
                        e.preventDefault();
                        toggleSelectCurrentPickerPage();
                        return;
                    }
                    if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setRawMaterialPickerActiveIndex((current) => Math.min(current + 1, Math.max(rawMaterialPickerResults.length - 1, 0)));
                    }
                    else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setRawMaterialPickerActiveIndex((current) => Math.max(current - 1, 0));
                    }
                    else if (e.key === "Enter") {
                        e.preventDefault();
                        const exactMatch = getPickerExactMatch();
                        if (exactMatch) {
                            addExactMatchRawMaterialToRows();
                            return;
                        }
                        addActiveRawMaterialToRows();
                    }
                  }} placeholder="Search by code or name" autoComplete="off"/>
                  {rawMaterialPickerQuery.trim().length >= 2 ? (<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-accent/30 bg-accentSoft/40 px-4 py-3 text-sm">
                      <div className="text-muted">
                        {getPickerExactMatch() ? (<span>
                            Exact match ready to add: <span className="font-semibold text-ink">{getPickerExactMatch()?.code}</span>
                          </span>) : (<span>No exact match yet. Keep typing or select a result below.</span>)}
                      </div>
                      <Button variant="secondary" onClick={addExactMatchRawMaterialToRows} disabled={!getPickerExactMatch()}>
                        Quick Add Exact
                      </Button>
                    </div>) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted">
                      Selected: {rawMaterialPickerSelectedCodes.length} of {rawMaterialTotal}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary" onClick={() => void toggleSelectCurrentPickerPage()} disabled={rawMaterialPickerResults.length === 0}>
                        {rawMaterialPickerQuery.trim().length === 0 ? "Select All" : "Select All Visible"}
                      </Button>
                      <Button variant="secondary" onClick={() => setRawMaterialPickerSelectedCodes([])} disabled={rawMaterialPickerSelectedCodes.length === 0}>
                        Clear
                      </Button>
                      <Button onClick={addSelectedRawMaterialsToRows} disabled={rawMaterialPickerSelectedCodes.length === 0}>
                        Add Selected
                      </Button>
                    </div>
                  </div>
                  <div ref={rawMaterialPickerScrollRef} className="max-h-[52vh] overflow-y-auto rounded-2xl border border-line">
                    <div className="divide-y divide-line">
                      {rawMaterialPickerResults.map((material) => {
                    const checked = rawMaterialPickerSelectedCodes.includes(material.code);
                    const active = rawMaterialPickerResults[rawMaterialPickerActiveIndex]?.code === material.code;
                    const existing = getExistingProductRawMaterialCodes().has(String(material.code ?? "").trim().toLowerCase());
                    return (<label key={material.code} ref={(node) => {
                        if (node) {
                            rawMaterialPickerItemRefs.current[material.code] = node;
                        }
                        else {
                            delete rawMaterialPickerItemRefs.current[material.code];
                        }
                    }} onMouseEnter={() => setRawMaterialPickerActiveIndex(rawMaterialPickerResults.findIndex((item) => item.code === material.code))} className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 ${checked ? "bg-accentSoft/50" : ""} ${active ? "ring-2 ring-accent ring-inset" : ""} ${existing ? "opacity-70" : ""}`}>
                            <input type="checkbox" checked={checked} disabled={existing} onChange={(event) => {
                            if (event.shiftKey && rawMaterialPickerActiveIndex !== null) {
                                selectRawMaterialPickerRange(rawMaterialPickerResults.findIndex((item) => item.code === material.code));
                            }
                            else {
                                toggleRawMaterialPickerSelection(material.code);
                                setRawMaterialPickerLastCheckedIndex(rawMaterialPickerResults.findIndex((item) => item.code === material.code));
                            }
                        }}/>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-ink">{material.code}</div>
                                {existing ? (<span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Already added</span>) : null}
                                {checked ? (<span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Selected</span>) : null}
                              </div>
                              <div className="truncate text-sm text-muted">{material.name}</div>
                            </div>
                            <div className="rounded-2xl bg-accentSoft px-3 py-2 text-sm font-semibold text-accent">
                              {formatRate(Number(material.rate ?? 0))}
                            </div>
                          </label>);
                })}
                      {!rawMaterialPickerLoading && rawMaterialPickerResults.length === 0 ? (<div className="px-4 py-10 text-center text-sm text-muted">
                          {rawMaterialPickerQuery.trim().length < 1 ? "Type at least 1 letter to search." : "No raw materials found."}
                        </div>) : null}
                      <div ref={rawMaterialPickerLoadMoreRef} className="px-4 py-3 text-center text-xs text-muted">
                        {rawMaterialPickerLoading ? "Loading raw materials..." : rawMaterialPickerHasMore ? "Scroll to load more" : "No more results"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>) : null}
        </div>) : null}
    </div>);
}
