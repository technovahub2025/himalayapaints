"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, BarChart3, Clock3, Layers3, LoaderCircle, Package2, Pencil, Plus, RefreshCw, Save, Search, Sparkles, Trash2, TrendingUp, Upload, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/services/api-client";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label, Select, Subtitle, Title } from "@/components/ui";
import { formatProductLabel } from "@/lib/product-label";
import { useAuthSessionContext } from "@/components/providers";

const EMPTY_TABLE_FORM = { name: "", duplicateFrom: "" };
const EMPTY_MATERIAL_FORM = { code: "", name: "", rate: "", quantity: "" };
const NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
});

function normalizeCode(value) {
    return String(value ?? "").trim().toLowerCase();
}

function normalizeDateValue(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatAmount(value) {
    return NUMBER_FORMAT.format(Number(value ?? 0));
}

function withinDateRange(value, start, end) {
    const date = normalizeDateValue(value);
    if (!date) {
        return false;
    }
    if (start && date < start) {
        return false;
    }
    if (end) {
        const inclusiveEnd = new Date(end);
        inclusiveEnd.setHours(23, 59, 59, 999);
        if (date > inclusiveEnd) {
            return false;
        }
    }
    return true;
}

function getPresetDateRange(preset) {
    if (!preset || preset === "all" || preset === "custom") {
        return { start: null, end: null };
    }
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    if (preset === "today") {
        start.setHours(0, 0, 0, 0);
    }
    else if (preset === "week") {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    }
    else if (preset === "month") {
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
    }
    else if (preset === "year") {
        start.setDate(start.getDate() - 364);
        start.setHours(0, 0, 0, 0);
    }
    return { start, end };
}

function getDateKey(value, period = "daily") {
    const date = normalizeDateValue(value);
    if (!date) return "";
    if (period === "monthly") return date.toISOString().slice(0, 7);
    if (period === "weekly") {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return monday.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
}

function formatShortDate(value) {
    const date = normalizeDateValue(value);
    return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "-";
}

function sum(values) {
    return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function buildSeries(records, getKey, getValue, limit = Infinity) {
    const grouped = new Map();
    for (const record of records) {
        const key = getKey(record);
        if (!key) {
            continue;
        }
        grouped.set(key, (grouped.get(key) ?? 0) + Number(getValue(record) ?? 0));
    }
    return Array.from(grouped.entries())
        .map(([label, value]) => ({ label, value: Number(value.toFixed(2)) }))
        .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
        .slice(0, limit);
}

function MetricCard({ icon: Icon, label, value, hint, accent = "from-teal-50 to-white" }) {
    return (
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
            <CardBody className={`bg-gradient-to-br ${accent} p-4 sm:p-5`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                        <p className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
                        <p className="text-xs leading-5 text-slate-500 sm:text-sm">{hint}</p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

function ChartFrame({ title, subtitle, badge, icon: Icon, children, className = "" }) {
    return (
        <Card className={`overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)] ${className}`}>
            <CardHeader className="border-b border-slate-200/80 bg-white/90">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {Icon ? (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                                    <Icon className="h-4 w-4" />
                                </span>
                            ) : null}
                            <p className="text-base font-semibold text-slate-950 sm:text-lg">{title}</p>
                        </div>
                        <p className="text-sm text-slate-500">{subtitle}</p>
                    </div>
                    {badge ? <Badge className="self-start">{badge}</Badge> : null}
                </div>
            </CardHeader>
            <CardBody className="bg-[linear-gradient(180deg,rgba(15,118,110,0.03),rgba(255,255,255,1))] p-4 sm:p-5">
                {children}
            </CardBody>
        </Card>
    );
}

function HorizontalBarChart({ data, emptyLabel, valueLabel }) {
    if (data.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
    }
    const max = Math.max(...data.map((item) => Number(item.value ?? 0)), 1);
    return (
        <div className="space-y-3">
            {data.map((item) => {
                const width = `${Math.max(8, (Number(item.value ?? 0) / max) * 100)}%`;
                return (
                    <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <p className="truncate font-medium text-slate-700">{item.label}</p>
                            <p className="shrink-0 font-semibold text-slate-950">{formatAmount(item.value)} {valueLabel}</p>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100">
                            <div className="h-2.5 rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" style={{ width }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function createPolylinePoints(values, max = 1, width = 100, height = 100) {
    if (!values || values.length === 0) return "";
    const gap = values.length === 1 ? 0 : width / (values.length - 1);
    return values
        .map((value, index) => {
            const y = height - (Number(value ?? 0) / max) * height;
            return `${(index * gap).toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}

function TrendChart({ data, emptyLabel, valueLabel = "", lineColor = "#0d9488" }) {
    if (!data || data.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
    }
    const values = data.map((item) => Number(item.value ?? 0));
    const max = Math.max(...values, 1);
    const width = 100;
    const height = 100;
    const points = createPolylinePoints(values, max, width, height);
    const areaPath = `M 0 ${height} L ${points} L ${width} ${height} Z`;
    return (
        <div className="w-full space-y-3">
            <div className="flex items-end justify-between gap-2 text-xs text-slate-400">
                <p>{formatAmount(values[0])}{valueLabel}</p>
                <p>{formatAmount(values[values.length - 1])}{valueLabel}</p>
            </div>
            <div className="relative w-full" style={{ height: `${height + 30}px` }}>
                <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#trendGradient)" stroke="none" />
                    <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
            </div>
            <div className="flex justify-between gap-1 overflow-x-auto text-[10px] text-slate-400">
                {data.slice(0, 6).map((item) => (
                    <span key={item.label} className="shrink-0">{item.label}</span>
                ))}
                {data.length > 6 ? <span className="shrink-0">+{data.length - 6} more</span> : null}
            </div>
        </div>
    );
}

function PieChart({ data, emptyLabel, valueLabel = "KG" }) {
    if (data.length === 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
    }
    const total = data.reduce((value, entry) => value + Number(entry.value ?? 0), 0);
    if (total <= 0) {
        return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">{emptyLabel}</div>;
    }
    const colors = ["#0f766e", "#0891b2", "#2563eb", "#7c3aed", "#d97706", "#e11d48"];
    let offset = 0;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="grid items-center gap-5 sm:grid-cols-[minmax(150px,190px)_1fr]">
            <div className="mx-auto h-44 w-44">
                <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
                    <circle cx="70" cy="70" r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="24" />
                    {data.map((entry, index) => {
                        const length = (Number(entry.value ?? 0) / total) * circumference;
                        const dash = `${length} ${circumference - length}`;
                        const circle = <circle key={entry.label} cx="70" cy="70" r={radius} fill="transparent" stroke={colors[index % colors.length]} strokeWidth="24" strokeDasharray={dash} strokeDashoffset={-offset} />;
                        offset += length;
                        return circle;
                    })}
                    <circle cx="70" cy="70" r="38" fill="white" />
                </svg>
            </div>
            <div className="space-y-2">
                {data.map((entry, index) => (
                    <div key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                            <span className="truncate text-slate-600">{entry.label}</span>
                        </div>
                        <span className="shrink-0 font-semibold text-slate-950">{formatAmount(entry.value)} {valueLabel}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AdminSettings({ email }) {
    const navigate = useNavigate();
    const authSession = useAuthSessionContext();
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [userEmail, setUserEmail] = useState(email || "");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    async function loadUsers() {
        setLoading(true);
        try {
            const data = await apiFetch("/api/admin/users");
            const nextUsers = Array.isArray(data.users) ? data.users : [];
            setUsers(nextUsers);
            const current = nextUsers.find((user) => user.email === email) ?? nextUsers[0];
            if (current) {
                setSelectedUserId(String(current._id));
                setUserEmail(current.email);
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to load users");
        }
        finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadUsers();
    }, [email]);

    function selectUser(userId) {
        const user = users.find((entry) => String(entry._id) === userId);
        setSelectedUserId(userId);
        setUserEmail(user?.email ?? "");
        setNewPassword("");
        setConfirmPassword("");
    }

    async function saveUser(event) {
        event.preventDefault();
        const target = users.find((user) => String(user._id) === selectedUserId);
        const normalizedEmail = userEmail.trim().toLowerCase();
        if (!target) {
            toast.error("Select a user account first");
            return;
        }
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            toast.error("Enter a valid user ID/email");
            return;
        }
        if (!newPassword && normalizedEmail === target.email) {
            toast.error("Change the user ID/email or enter a new password");
            return;
        }
        if (newPassword.length > 0 && newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setSaving(true);
        try {
            const data = await apiFetch(`/api/admin/users/${encodeURIComponent(selectedUserId)}`, {
                method: "PATCH",
                json: { email: normalizedEmail, newPassword }
            });
            toast.success(`Account updated for ${data.user?.email ?? normalizedEmail}`);
            setNewPassword("");
            setConfirmPassword("");
            if (data.requiresRelogin) {
                await apiFetch("/api/auth/logout", { method: "POST" });
                await authSession?.refreshSession?.();
                navigate("/login", { replace: true });
                return;
            }
            await loadUsers();
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to update account");
        }
        finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,254,255,0.92))] p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:p-7">
                <Badge className="border border-teal-100 bg-white/80 text-teal-700">Admin settings</Badge>
                <Title className="mt-3 text-3xl sm:text-4xl">Admin Control Center</Title>
                <Subtitle className="max-w-2xl">Manage account IDs and passwords securely. Passwords are never displayed or returned to the browser.</Subtitle>
            </section>
            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold text-slate-950">Account access</p>
                            <p className="text-sm text-slate-500">Update your own account or an existing user account.</p>
                        </div>
                        <Badge>{users.length.toLocaleString()} account(s)</Badge>
                    </div>
                </CardHeader>
                <CardBody>
                    {loading ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Loading account list...</div> : users.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No user accounts are available.</div> : (
                        <form className="space-y-5" onSubmit={saveUser}>
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div>
                                    <Label htmlFor="admin-settings-user">Account</Label>
                                    <Select id="admin-settings-user" value={selectedUserId} onChange={(event) => selectUser(event.target.value)} disabled={saving}>
                                        {users.map((user) => <option key={user._id} value={user._id}>{user.email} ({user.role})</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="admin-settings-email">User ID / Email</Label>
                                    <Input id="admin-settings-email" type="email" value={userEmail} onChange={(event) => setUserEmail(event.target.value)} autoComplete="username" disabled={saving} />
                                </div>
                                <div>
                                    <Label htmlFor="admin-settings-password">New Password</Label>
                                    <Input id="admin-settings-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Leave blank to keep current password" disabled={saving} />
                                </div>
                                <div>
                                    <Label htmlFor="admin-settings-confirm-password">Confirm New Password</Label>
                                    <Input id="admin-settings-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repeat new password" disabled={saving} />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs leading-5 text-slate-500">Minimum password length: 6 characters. Changing your own account will require signing in again.</p>
                                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save account changes"}</Button>
                            </div>
                        </form>
                    )}
                </CardBody>
            </Card>
        </div>
    );
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

export function AdminDashboard({ initialItems, initialTableName, tableNames, email, initialSection = "dashboard" }) {
    const navigate = useNavigate();
    const activeSection = ["workspace", "dashboard", "products", "rawMaterials", "production", "settings"].includes(initialSection)
        ? initialSection
        : "dashboard";
    const [selectedTableName, setSelectedTableName] = useState(initialTableName);
    const [tableOptions, setTableOptions] = useState(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
    const [itemRows, setItemRows] = useState(() => initialItems.map(createItemDraft));
    const [rawMaterials, setRawMaterials] = useState([]);
    const [productionBatches, setProductionBatches] = useState([]);
    const [sales, setSales] = useState([]);
    const [salesError, setSalesError] = useState(null);
    const [materialSearch, setMaterialSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingItems, setSavingItems] = useState(false);
    const [savingTable, setSavingTable] = useState(false);
    const [savingMaterial, setSavingMaterial] = useState(false);
    const [rawMaterialImportLoading, setRawMaterialImportLoading] = useState(false);
    const [selectedMaterialCodes, setSelectedMaterialCodes] = useState([]);
    const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
    const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL_FORM);
    const [materialRateDrafts, setMaterialRateDrafts] = useState({});
    const [editingMaterialCode, setEditingMaterialCode] = useState(null);
    const [editDraft, setEditDraft] = useState({ name: "", rate: "", quantity: "" });
    const [analyticsDatePreset, setAnalyticsDatePreset] = useState("all");
    const [analyticsDateFrom, setAnalyticsDateFrom] = useState("");
    const [analyticsDateTo, setAnalyticsDateTo] = useState("");
    const [analyticsProductFilter, setAnalyticsProductFilter] = useState("");
    const [analyticsMaterialFilter, setAnalyticsMaterialFilter] = useState("");
    const [salesDatePreset, setSalesDatePreset] = useState("all");
    const [salesTrendPeriod, setSalesTrendPeriod] = useState("daily");
    const [salesMetric, setSalesMetric] = useState("amount");
    const [salesProductFilter, setSalesProductFilter] = useState("");
    const [salesDateFrom, setSalesDateFrom] = useState("");
    const [salesDateTo, setSalesDateTo] = useState("");
    const rawMaterialImportInputRef = useRef(null);

    const materialMap = useMemo(() => {
        return new Map(rawMaterials.map((material) => [normalizeCode(material.code), material]));
    }, [rawMaterials]);

    const filteredMaterials = useMemo(() => {
        const needle = materialSearch.trim().toLowerCase();
        if (!needle) {
            return rawMaterials;
        }
        return rawMaterials.filter((material) => {
            return [material.code, material.name, String(material.rate ?? ""), String(material.quantity ?? 0)].join(" ").toLowerCase().includes(needle);
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
    const rawMaterialLookup = useMemo(() => {
        const map = new Map();
        rawMaterials.forEach((material) => {
            const codeKey = normalizeCode(material.code);
            const nameKey = normalizeCode(material.name);
            if (codeKey) {
                map.set(codeKey, material);
            }
            if (nameKey && !map.has(nameKey)) {
                map.set(nameKey, material);
            }
        });
        return map;
    }, [rawMaterials]);
    const availableProductionProducts = useMemo(() => Array.from(new Set(productionBatches.map((batch) => String(batch.productName ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [productionBatches]);
    const filteredProductionRows = useMemo(() => {
        const presetRange = getPresetDateRange(analyticsDatePreset);
        const start = analyticsDatePreset === "custom" ? normalizeDateValue(analyticsDateFrom) : presetRange.start;
        const end = analyticsDatePreset === "custom" ? normalizeDateValue(analyticsDateTo) : presetRange.end;
        const productKey = normalizeCode(analyticsProductFilter);
        const materialKey = normalizeCode(analyticsMaterialFilter);
        return productionBatches.map((batch) => {
            const batchDate = normalizeDateValue(batch.createdAt);
            const lines = Array.isArray(batch.lines) ? batch.lines : [];
            const resolvedLines = lines.map((line) => {
                const lineMaterial = rawMaterialLookup.get(normalizeCode(line.materialName)) ?? null;
                const quantity = Number(line.actualQty ?? line.stdQty ?? 0);
                const rate = Number(lineMaterial?.rate ?? 0);
                return {
                    ...line,
                    lineMaterial,
                    quantity,
                    rate,
                    amount: Number((quantity * rate).toFixed(2))
                };
            });
            const matchesDate = withinDateRange(batch.createdAt, start, end);
            const matchesProduct = !productKey || normalizeCode(batch.productName) === productKey;
            const filteredLines = materialKey
                ? resolvedLines.filter((line) => {
                    const keys = [line.lineMaterial?.code, line.lineMaterial?.name, line.materialName].map(normalizeCode);
                    return keys.includes(materialKey);
                })
                : resolvedLines;
            const matchesMaterial = !materialKey || filteredLines.length > 0;
            return {
                ...batch,
                batchDate,
                resolvedLines,
                filteredLines,
                batchKg: Number(batch.actualKg ?? 0),
                batchAmount: Number(filteredLines.reduce((total, line) => total + Number(line.amount ?? 0), 0).toFixed(2)),
                matchesDate,
                matchesProduct,
                matchesMaterial
            };
        }).filter((batch) => batch.matchesDate && batch.matchesProduct && batch.matchesMaterial);
    }, [analyticsDateFrom, analyticsDatePreset, analyticsDateTo, analyticsMaterialFilter, analyticsProductFilter, productionBatches, rawMaterialLookup]);
    const recentBatches = useMemo(() => filteredProductionRows.slice(0, 5), [filteredProductionRows]);
    const productionByProductSeries = useMemo(() => buildSeries(filteredProductionRows, (batch) => formatProductLabel(batch.productName), (batch) => batch.batchKg, 6), [filteredProductionRows]);
    const productionShareSeries = useMemo(() => buildSeries(filteredProductionRows, (batch) => formatProductLabel(batch.productName), (batch) => batch.batchKg, 6), [filteredProductionRows]);
    const productionCostByProductSeries = useMemo(() => buildSeries(filteredProductionRows, (batch) => formatProductLabel(batch.productName), (batch) => batch.batchAmount, 6), [filteredProductionRows]);
    const rawMaterialUsageSeries = useMemo(() => buildSeries(filteredProductionRows.flatMap((batch) => batch.filteredLines.map((line) => ({
        lineMaterial: line.lineMaterial,
        materialName: line.materialName,
        quantity: Number(line.quantity ?? 0)
    }))), (line) => line.lineMaterial?.name || line.materialName, (line) => line.quantity, 6), [filteredProductionRows]);
    const analyticsTotals = useMemo(() => {
        const hasFilters = analyticsDatePreset !== "all" || analyticsProductFilter || analyticsMaterialFilter;
        const filteredProductNames = new Set(filteredProductionRows.map((batch) => normalizeCode(batch.productName)).filter(Boolean));
        const filteredMaterialNames = new Set(filteredProductionRows.flatMap((batch) => batch.filteredLines.map((line) => normalizeCode(line.lineMaterial?.code || line.lineMaterial?.name || line.materialName))).filter(Boolean));
        return {
            products: hasFilters ? filteredProductNames.size : Array.from(new Set(tableOptions.filter(Boolean))).length,
            materials: hasFilters ? filteredMaterialNames.size : rawMaterials.length,
            production: filteredProductionRows.length,
            kg: filteredProductionRows.length > 0 ? sum(filteredProductionRows.map((batch) => batch.batchKg)) : null,
            amount: filteredProductionRows.length > 0 ? sum(filteredProductionRows.map((batch) => batch.batchAmount)) : null
        };
    }, [analyticsDatePreset, analyticsMaterialFilter, analyticsProductFilter, filteredProductionRows, rawMaterials.length, tableOptions]);

    const salesDateRange = useMemo(() => {
        const presetRange = getPresetDateRange(salesDatePreset);
        return {
            start: salesDatePreset === "custom" ? normalizeDateValue(salesDateFrom) : presetRange.start,
            end: salesDatePreset === "custom" ? normalizeDateValue(salesDateTo) : presetRange.end
        };
    }, [salesDatePreset, salesDateFrom, salesDateTo]);

    const filteredSales = useMemo(() => {
        const productKey = normalizeCode(salesProductFilter);
        return sales.filter((sale) => {
            const matchesDate = withinDateRange(sale.createdAt, salesDateRange.start, salesDateRange.end);
            const matchesProduct = !productKey || normalizeCode(sale.productName) === productKey;
            return matchesDate && matchesProduct;
        });
    }, [sales, salesDateRange, salesProductFilter]);

    const salesProducts = useMemo(() => Array.from(new Set(sales.map((sale) => String(sale.productName ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)), [sales]);
    const salesTotalAmount = useMemo(() => sum(filteredSales.map((sale) => sale.amount ?? 0)), [filteredSales]);
    const salesTotalQuantity = useMemo(() => sum(filteredSales.map((sale) => sale.quantity ?? 0)), [filteredSales]);
    const salesCount = filteredSales.length;
    const salesAverageAmount = useMemo(() => salesCount > 0 ? salesTotalAmount / salesCount : 0, [salesTotalAmount, salesCount]);
    const salesMetricValue = (sale) => salesMetric === "quantity" ? (sale.quantity ?? 0) : (sale.amount ?? 0);
    const salesByProductSeries = useMemo(() => buildSeries(filteredSales, (sale) => formatProductLabel(sale.productName), salesMetricValue, 6), [filteredSales, salesMetric]);
    const salesTrendSeries = useMemo(() => {
        if (filteredSales.length === 0) return [];
        const grouped = new Map();
        filteredSales.forEach((sale) => {
            const key = getDateKey(sale.createdAt, salesTrendPeriod === "weekly" ? "weekly" : salesTrendPeriod === "monthly" ? "monthly" : "daily");
            const value = Number(salesMetricValue(sale) ?? 0);
            grouped.set(key, (grouped.get(key) ?? 0) + value);
        });
        return Array.from(grouped.entries())
            .map(([label, value]) => ({ label: formatShortDate(label), value: Number(value.toFixed(2)) }))
            .sort((left, right) => new Date(left.label) - new Date(right.label));
    }, [filteredSales, salesTrendPeriod, salesMetric]);
    const recentSales = useMemo(() => filteredSales.slice(0, 5), [filteredSales]);

    useEffect(() => {
        setSelectedTableName(initialTableName);
        setItemRows(initialItems.map(createItemDraft));
        setTableOptions(Array.from(new Set([initialTableName, ...tableNames.filter(Boolean)])).sort());
    }, [initialItems, initialTableName, tableNames]);

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
            try {
                const salesData = await apiFetch("/api/sales");
                setSales(Array.isArray(salesData.sales) ? salesData.sales : []);
                setSalesError(null);
            } catch (error) {
                setSalesError(error instanceof Error ? error.message : "Failed to load sales data");
                setSales([]);
            }
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

    async function loadAnalyticsData() {
        setLoading(true);
        try {
            const [materialsData, productionData] = await Promise.all([
                apiFetch("/api/admin/raw-materials?limit=100"),
                apiFetch("/api/production")
            ]);
            setRawMaterials(Array.isArray(materialsData.materials) ? materialsData.materials : []);
            setProductionBatches(Array.isArray(productionData.batches) ? productionData.batches : []);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load analytics data");
        }
        try {
            const salesData = await apiFetch("/api/sales");
            setSales(Array.isArray(salesData.sales) ? salesData.sales : []);
            setSalesError(null);
        } catch (error) {
            setSalesError(error instanceof Error ? error.message : "Failed to load sales data");
            setSales([]);
        }
        finally {
            setLoading(false);
        }
    }

    async function refreshSalesData() {
        try {
            const salesData = await apiFetch("/api/sales");
            setSales(Array.isArray(salesData.sales) ? salesData.sales : []);
            setSalesError(null);
        } catch (error) {
            setSalesError(error instanceof Error ? error.message : "Failed to load sales data");
            setSales([]);
        }
    }

    useEffect(() => {
        void loadAnalyticsData();
        // The parent already fetched the initial table/items payload. Fetch only
        // analytics data here; workspace refreshes fetch the complete payload.
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
        try {
            if (!selectedTableName.trim()) {
                throw new Error("Select a table before saving items.");
            }
            if (itemRows.length === 0) {
                throw new Error("Add at least one item before saving.");
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
        const quantity = Number(materialForm.quantity);
        if (!name) {
            toast.error("Enter a raw material name.");
            return;
        }
        if (Number.isNaN(rate) || rate < 0) {
            toast.error("Enter a valid raw material rate.");
            return;
        }
        if (Number.isNaN(quantity) || quantity < 0) {
            toast.error("Enter a valid raw material quantity.");
            return;
        }
        setSavingMaterial(true);
        try {
            const responseData = await apiFetch("/api/admin/raw-materials", {
                method: "POST",
                json: { name, code, rate, quantity }
            });
            if (responseData?.material) {
                setRawMaterials((current) => {
                    const nextMaterial = responseData.material;
                    const nextCode = normalizeCode(nextMaterial.code);
                    const withoutDuplicate = current.filter((material) => normalizeCode(material.code) !== nextCode);
                    return [...withoutDuplicate, nextMaterial];
                });
            }
            toast.success("Raw material created");
            setMaterialForm(EMPTY_MATERIAL_FORM);
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

    function startEditingMaterial(material) {
        setEditingMaterialCode(material.code);
        setEditDraft({
            name: material.name ?? "",
            rate: String(material.rate ?? ""),
            quantity: String(material.quantity ?? 0)
        });
    }

    async function saveMaterialEdit(material) {
        const name = (editDraft.name ?? "").trim();
        const rate = Number(editDraft.rate);
        const quantity = Number(editDraft.quantity);
        if (!name) {
            toast.error("Enter a raw material name.");
            return;
        }
        if (!editDraft.rate || Number.isNaN(rate) || rate < 0) {
            toast.error("Enter a valid rate.");
            return;
        }
        if (Number.isNaN(quantity) || quantity < 0) {
            toast.error("Enter a valid quantity.");
            return;
        }
        setSavingMaterial(true);
        try {
            const responseData = await apiFetch("/api/admin/raw-materials", {
                method: "PATCH",
                json: { code: material.code, name, rate, quantity }
            });
            if (responseData?.material) {
                const updated = responseData.material;
                setRawMaterials((current) => current.map((m) => normalizeCode(m.code) === normalizeCode(updated.code) ? { ...updated, quantity: updated.quantity ?? 0 } : m));
            }
            toast.success("Raw material updated");
            setEditingMaterialCode(null);
            setEditDraft({ name: "", rate: "", quantity: "" });
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update raw material");
        }
        finally {
            setSavingMaterial(false);
        }
    }

    function cancelEditingMaterial() {
        setEditingMaterialCode(null);
        setEditDraft({ name: "", rate: "", quantity: "" });
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
    function openRawMaterialImport() {
        rawMaterialImportInputRef.current?.click();
    }
    async function handleRawMaterialImportFileChange(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) {
            return;
        }
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["xlsx", "xls", "csv"].includes(ext)) {
            toast.error("Please select a valid Excel file (.xlsx, .xls, or .csv).");
            return;
        }
        setRawMaterialImportLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const data = await apiFetch("/api/admin/raw-materials/import", {
                method: "POST",
                body: formData
            });
            const imported = Number(data.imported ?? 0);
            const updated = Number(data.updated ?? 0);
            const failed = Number(data.failed ?? 0);
            const nextMaterials = Array.isArray(data.materials) ? data.materials : [];
            setRawMaterials((current) => {
                const importedCodes = new Set(nextMaterials.map((material) => normalizeCode(material.code)));
                const withoutDuplicates = current.filter((material) => !importedCodes.has(normalizeCode(material.code)));
                return [...withoutDuplicates, ...nextMaterials];
            });
            if (failed > 0) {
                toast.error(`Import completed with errors. ${imported} imported, ${updated} updated, ${failed} failed.`);
            } else {
                toast.success(`Import completed. ${imported} imported, ${updated} updated.`);
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to import raw materials");
        }
        finally {
            setRawMaterialImportLoading(false);
        }
    }

    const kpiCards = [
        {
            label: "Total Products",
            value: formatAmount(analyticsTotals.products),
            hint: "Unique product tables available in the backend",
            icon: Package2,
            accent: "from-cyan-50 to-white"
        },
        {
            label: "Raw Materials",
            value: formatAmount(analyticsTotals.materials),
            hint: "Master raw materials currently stored",
            icon: Layers3,
            accent: "from-emerald-50 to-white"
        },
        {
            label: "Production Batches",
            value: formatAmount(analyticsTotals.production),
            hint: "Production batches matching the active filters",
            icon: Activity,
            accent: "from-sky-50 to-white"
        },
        {
            label: "Total KG",
            value: analyticsTotals.kg === null ? "—" : `${formatAmount(analyticsTotals.kg)} KG`,
            hint: "Filtered production weight from live batches",
            icon: TrendingUp,
            accent: "from-teal-50 to-white"
        },
        {
            label: "Total Cost",
            value: analyticsTotals.amount === null ? "—" : formatAmount(analyticsTotals.amount),
            hint: "Formula-derived production cost from live material rates",
            icon: Sparkles,
            accent: "from-amber-50 to-white"
        }
    ];

    const salesKpiCards = [
        {
            label: "Total Sales",
            value: formatAmount(salesTotalAmount),
            hint: salesCount > 0 ? `From ${salesCount} sale record(s)` : "No sales records in current filters",
            icon: WalletCards,
            accent: "from-violet-50 to-white"
        },
        {
            label: "Total Quantity",
            value: `${formatAmount(salesTotalQuantity)} KG`,
            hint: "Filtered total sale quantity",
            icon: Package2,
            accent: "from-cyan-50 to-white"
        },
        {
            label: "Sales Count",
            value: formatAmount(salesCount),
            hint: "Number of matched sale records",
            icon: Activity,
            accent: "from-sky-50 to-white"
        },
        {
            label: "Average Sale",
            value: formatAmount(salesAverageAmount),
            hint: salesCount > 0 ? "Average per sale transaction" : "No sales records available",
            icon: Sparkles,
            accent: "from-amber-50 to-white"
        }
    ];

    return (
        <div className="space-y-6 sm:space-y-7">
            {activeSection === "settings" ? <AdminSettings email={email} /> : null}
            {activeSection !== "settings" ? <>
            {activeSection === "dashboard" ? <>
            <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.14),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,254,255,0.92))] shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
                <div className="p-5 sm:p-6 lg:p-7">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-4xl space-y-3">
                            <Badge className="w-fit rounded-full border border-teal-100 bg-white/80 px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-teal-700">
                                <Sparkles className="mr-2 h-3.5 w-3.5" />
                                Live analytics
                            </Badge>
                            <Title className="text-3xl sm:text-4xl">Production Intelligence Dashboard</Title>
                            <Subtitle className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                                Real data from the existing API powers production trends, material usage, and cost views across your product tables, raw materials, and batch history.
                            </Subtitle>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <Badge className="rounded-full bg-white px-3 py-1 text-slate-700">{filteredProductionRows.length.toLocaleString()} filtered batch(es)</Badge>
                                {email ? <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1">Signed in as {email}</span> : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
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

                    <div className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <Label>Date Range</Label>
                                <Select value={analyticsDatePreset} onChange={(event) => setAnalyticsDatePreset(event.target.value)}>
                                    <option value="all">All time</option>
                                    <option value="today">Today</option>
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="year">Year</option>
                                    <option value="custom">Custom Date</option>
                                </Select>
                            </div>
                            <div>
                                <Label>Product</Label>
                                <Select value={analyticsProductFilter} onChange={(event) => setAnalyticsProductFilter(event.target.value)}>
                                    <option value="">All products</option>
                                    {availableProductionProducts.map((product) => (
                                        <option key={product} value={product}>
                                            {formatProductLabel(product)}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <Label>Raw Material</Label>
                                <Select value={analyticsMaterialFilter} onChange={(event) => setAnalyticsMaterialFilter(event.target.value)}>
                                    <option value="">All materials</option>
                                    {rawMaterials.map((material) => (
                                        <option key={material.code} value={material.code}>
                                            {material.code} {material.name ? `- ${material.name}` : ""}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            {analyticsDatePreset === "custom" ? <>
                                <div>
                                    <Label>Date From</Label>
                                    <Input type="date" value={analyticsDateFrom} onChange={(event) => setAnalyticsDateFrom(event.target.value)} />
                                </div>
                                <div>
                                    <Label>Date To</Label>
                                    <Input type="date" value={analyticsDateTo} onChange={(event) => setAnalyticsDateTo(event.target.value)} />
                                </div>
                            </> : null}
                        </div>
                        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-950">Filter context</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {analyticsDatePreset !== "all" || analyticsProductFilter || analyticsMaterialFilter
                                            ? "Analytics and KPIs are filtered to the selected slice of live data."
                                            : "Showing all production records from the current API response."}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setAnalyticsDateFrom("");
                                        setAnalyticsDateTo("");
                                        setAnalyticsDatePreset("all");
                                        setAnalyticsProductFilter("");
                                        setAnalyticsMaterialFilter("");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Products</p>
                                    <p className="mt-1 font-semibold text-slate-950">{availableProductionProducts.length.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Materials</p>
                                    <p className="mt-1 font-semibold text-slate-950">{rawMaterials.length.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Batches</p>
                                    <p className="mt-1 font-semibold text-slate-950">{filteredProductionRows.length.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Latest refresh</p>
                                    <p className="mt-1 font-semibold text-slate-950">{loading ? "Loading..." : "Live"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {kpiCards.map((card) => (
                    <MetricCard key={card.label} {...card} />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <ChartFrame title="Production by Product" subtitle="Top products ranked by produced KG." badge="Top 6" icon={Package2}>
                    <HorizontalBarChart data={productionByProductSeries} emptyLabel="No production data is available for the current filters." valueLabel="KG" />
                </ChartFrame>

                <ChartFrame title="Raw Material Usage" subtitle="Share of material usage from production lines." badge="Top 6" icon={Layers3}>
                    <PieChart data={rawMaterialUsageSeries} emptyLabel="No raw material usage is available for the current filters." />
                </ChartFrame>

                <ChartFrame title="Product Production Share" subtitle="Share of total production KG by product." badge="Top 6" icon={Package2}>
                    <PieChart data={productionShareSeries} emptyLabel="No product production data is available for the current filters." />
                </ChartFrame>

                 <ChartFrame title="Production Cost by Product" subtitle="Formula-derived cost by product using current raw-material rates." badge="Top 6" icon={Sparkles}>
                     <HorizontalBarChart data={productionCostByProductSeries} emptyLabel="No production cost data is available for the current filters." valueLabel="amount" />
                 </ChartFrame>
             </div>
             </> : null}

            {activeSection === "products" ? <>
            <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
                <CardHeader className="border-b border-slate-200/80 bg-white/90">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold text-slate-950">Table Workspace</p>
                            <p className="text-sm text-slate-500">Select a table, edit its items, or create a new table from an existing template.</p>
                        </div>
                        <Badge>{selectedTableSummary}</Badge>
                    </div>
                </CardHeader>
                <CardBody className="space-y-5 p-4 sm:p-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr]">
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
                    <div className="flex flex-wrap gap-2 sm:gap-3">
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

            <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
                <CardHeader className="border-b border-slate-200/80 bg-white/90">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-lg font-semibold text-slate-950">Item Formulas</p>
                            <p className="text-sm text-slate-500">Edit item codes and quantities for the active table. The backend will resolve the material names and rates.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge>{currentQuantityTotal.toLocaleString()} total qty</Badge>
                            <Badge>{currentAmountTotal.toLocaleString()} total amount</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="space-y-4 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">{itemRows.length.toLocaleString()} editable row(s)</p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={addItemRow} disabled={savingItems}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Row
                            </Button>
                            <Button variant="primary" onClick={saveItems} disabled={loading || savingItems}>
                                {savingItems ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {savingItems ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                    <div className="grid gap-3 md:hidden">
                        {itemRows.length > 0 ? itemRows.map((row, index) => {
                            const material = materialMap.get(normalizeCode(row.code)) ?? null;
                            const rowRate = Number(material?.rate ?? 0);
                            const rowQuantity = Number(row.quantity || 0);
                            const amount = Number((rowRate * rowQuantity).toFixed(2));
                            return (
                                <div key={row.id || `${selectedTableName}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Item</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-950">{material ? material.name : "Select a code"}</p>
                                            <p className="mt-1 text-xs text-slate-500">{row.code || "No code"}</p>
                                        </div>
                                        <Button variant="ghost" onClick={() => removeItemRow(index)} className="shrink-0">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Remove
                                        </Button>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <Label>Code</Label>
                                            <Select value={row.code} onChange={(event) => handleItemChange(index, "code", event.target.value)}>
                                                <option value="">Select code</option>
                                                {rawMaterials.map((materialOption) => (
                                                    <option key={materialOption.code} value={materialOption.code}>
                                                        {materialOption.code}
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Quantity</Label>
                                            <Input value={row.quantity} onChange={(event) => handleItemChange(index, "quantity", event.target.value)} inputMode="decimal" />
                                        </div>
                                        <div>
                                            <Label>Rate</Label>
                                            <Input value={String(rowRate)} readOnly />
                                        </div>
                                        <div>
                                            <Label>Amount</Label>
                                            <Input value={String(amount)} readOnly />
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                No item rows loaded for this table.
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white hidden md:block">
                        <table className="min-w-[860px] sm:min-w-[980px] w-full border-collapse">
                            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
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
                                        <tr key={row.id || `${selectedTableName}-${index}`} className="border-t border-slate-200">
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
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-950">
                                                {material ? material.name : <span className="text-slate-500">Select a code</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input value={row.quantity} onChange={(event) => handleItemChange(index, "quantity", event.target.value)} inputMode="decimal" />
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-500">{rowRate.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-950">{amount.toLocaleString()}</td>
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
                                        <td className="px-4 py-5 text-sm text-slate-500" colSpan={6}>
                                            No item rows loaded for this table.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardBody>
            </Card>
            </> : null}

            <div className={`grid gap-6 ${activeSection === "rawMaterials" ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
                {activeSection === "rawMaterials" ? <>
                <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
                    <CardHeader className="border-b border-slate-200/80 bg-white/90">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-950">Raw Material Master</p>
                                <p className="text-sm text-slate-500">Create new materials, adjust rates, or delete selected rows.</p>
                            </div>
                            <Badge>{selectedMaterialCodes.length.toLocaleString()} selected</Badge>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4 p-4 sm:p-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <Label>Code</Label>
                                <Input value={materialForm.code} onChange={(event) => setMaterialForm((current) => ({ ...current, code: event.target.value }))} placeholder="Code" />
                            </div>
                            <div>
                                <Label>Material Name</Label>
                                <Input value={materialForm.name} onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))} placeholder="Raw material name" />
                            </div>
                            <div>
                                <Label>Rate</Label>
                                <Input value={materialForm.rate} onChange={(event) => setMaterialForm((current) => ({ ...current, rate: event.target.value }))} placeholder="0" inputMode="decimal" />
                            </div>
                            <div>
                                <Label>Quantity</Label>
                                <Input value={materialForm.quantity} onChange={(event) => setMaterialForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" inputMode="decimal" />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                            <Button variant="secondary" onClick={createRawMaterial} disabled={savingMaterial}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Raw Material
                            </Button>
                            <Button variant="secondary" onClick={openRawMaterialImport} disabled={savingMaterial || rawMaterialImportLoading}>
                                <Upload className="mr-2 h-4 w-4" />
                                {rawMaterialImportLoading ? "Importing..." : "Import Excel"}
                            </Button>
                            <Button variant="danger" onClick={deleteSelectedMaterials} disabled={savingMaterial}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected
                            </Button>
                        </div>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            ref={rawMaterialImportInputRef}
                            onChange={handleRawMaterialImportFileChange}
                        />
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search raw materials" className="pl-11" />
                        </div>
                        <div className="grid gap-3 md:hidden">
                            {filteredMaterials.length > 0 ? filteredMaterials.map((material) => {
                                const isEditing = editingMaterialCode === material.code;
                                return (
                                    <div key={material.code} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Code</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-950">{material.code}</p>
                                                {isEditing ? (
                                                    <>
                                                        <Input
                                                            value={editDraft.name ?? ""}
                                                            onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                                                            placeholder="Material name"
                                                            className="mt-1"
                                                        />
                                                        <div className="mt-2">
                                                            <Label>Rate</Label>
                                                            <Input
                                                                value={editDraft.rate ?? ""}
                                                                onChange={(event) => setEditDraft((current) => ({ ...current, rate: event.target.value }))}
                                                                inputMode="decimal"
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div className="mt-2">
                                                            <Label>Quantity</Label>
                                                            <Input
                                                                value={editDraft.quantity ?? ""}
                                                                onChange={(event) => setEditDraft((current) => ({ ...current, quantity: event.target.value }))}
                                                                inputMode="decimal"
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="mt-1 text-sm text-slate-700">{material.name}</p>
                                                        <p className="mt-1 text-sm text-slate-500">Rate: {formatAmount(material.rate)} | Qty: {Number(material.quantity ?? 0)}</p>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedMaterialCodes.includes(material.code)}
                                                    onChange={() => toggleMaterialSelection(material.code)}
                                                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                                                />
                                                {isEditing ? (
                                                    <>
                                                        <Button variant="ghost" onClick={() => saveMaterialEdit(material)} disabled={savingMaterial} size="sm">
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" onClick={cancelEditingMaterial} disabled={savingMaterial} size="sm">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button variant="ghost" onClick={() => startEditingMaterial(material)} disabled={savingMaterial} size="sm">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                    No raw materials match your search.
                                </div>
                            )}
                        </div>
                        <div className="w-full max-h-[520px] overflow-x-auto overflow-y-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white hidden md:block">
                            <table className="min-w-[700px] w-full border-collapse">
                                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Select</th>
                                        <th className="px-4 py-3 font-semibold">Code</th>
                                        <th className="px-4 py-3 font-semibold">Name</th>
                                        <th className="px-4 py-3 font-semibold">Rate</th>
                                        <th className="px-4 py-3 font-semibold">Quantity</th>
                                        <th className="px-4 py-3 font-semibold text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.length > 0 ? filteredMaterials.map((material) => {
                                        const isEditing = editingMaterialCode === material.code;
                                        return (
                                            <tr key={material.code} className="border-t border-slate-200">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMaterialCodes.includes(material.code)}
                                                        onChange={() => toggleMaterialSelection(material.code)}
                                                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-950">{material.code}</td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft.name ?? ""}
                                                            onChange={(event) => setEditDraft((current) => ({ ...current, name: event.target.value }))}
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-700">{material.name}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft.rate ?? ""}
                                                            onChange={(event) => setEditDraft((current) => ({ ...current, rate: event.target.value }))}
                                                            inputMode="decimal"
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-500">{formatAmount(material.rate)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {isEditing ? (
                                                        <Input
                                                            value={editDraft.quantity ?? ""}
                                                            onChange={(event) => setEditDraft((current) => ({ ...current, quantity: event.target.value }))}
                                                            inputMode="decimal"
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-slate-500">{formatAmount(material.quantity ?? 0)}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {isEditing ? (
                                                        <>
                                                            <Button variant="ghost" onClick={() => saveMaterialEdit(material)} disabled={savingMaterial}>
                                                                <Save className="mr-2 h-4 w-4" />
                                                                Save
                                                            </Button>
                                                            <Button variant="ghost" onClick={cancelEditingMaterial} disabled={savingMaterial}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button variant="ghost" onClick={() => startEditingMaterial(material)} disabled={savingMaterial}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td className="px-4 py-5 text-sm text-slate-500" colSpan={6}>
                                                No raw materials match your search.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>
                </> : null}

                {['dashboard', 'production'].includes(activeSection) ? <>
                <Card className="overflow-hidden border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)] lg:col-span-2">
                    <CardHeader className="border-b border-slate-200/80 bg-white/90">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-950">Production History</p>
                                <p className="text-sm text-slate-500">Latest saved batches across the system.</p>
                            </div>
                            <Badge>{filteredProductionRows.length.toLocaleString()} filtered</Badge>
                        </div>
                    </CardHeader>
                    <CardBody className="space-y-4 p-4 sm:p-6">
                        <div className="grid gap-3 md:hidden">
                            {recentBatches.length > 0 ? recentBatches.map((batch) => (
                                <div key={batch._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Product</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-950">{formatProductLabel(batch.productName)}</p>
                                            <p className="mt-1 text-xs text-slate-500">{batch.batchNo || "-"}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-950">{Number(batch.actualKg ?? 0).toLocaleString()} KG</p>
                                    </div>
                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        <div className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Created By</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900">{batch.createdBy || "-"}</p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3">
                                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Created At</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(batch.createdAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                    No production batches saved yet.
                                </div>
                            )}
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white hidden md:block">
                            <table className="min-w-[700px] sm:min-w-[780px] w-full border-collapse">
                                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
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
                                        <tr key={batch._id} className="border-t border-slate-200">
                                            <td className="px-4 py-3 text-sm font-semibold text-slate-950">{formatProductLabel(batch.productName)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{batch.batchNo || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-slate-700">{Number(batch.actualKg ?? 0).toLocaleString()} KG</td>
                                            <td className="px-4 py-3 text-sm text-slate-500">{batch.createdBy || "-"}</td>
                                            <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(batch.createdAt)}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td className="px-4 py-5 text-sm text-slate-500" colSpan={5}>
                                                No production batches saved yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0.92))] p-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                                    <Clock3 className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-950">Active table snapshot</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {selectedTableName} currently has {itemRows.length.toLocaleString()} item row(s), {currentQuantityTotal.toLocaleString()} total quantity, and {currentAmountTotal.toLocaleString()} total amount.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>
                </> : null}
            </div>

            {activeSection === "dashboard" ? <>
                <section className="rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(15,118,110,0.03),rgba(255,255,255,1))] shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
                    <div className="p-4 sm:p-5 lg:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="space-y-1">
                                <Badge className="w-fit rounded-full border border-teal-100 bg-white/80 px-4 py-1.5 text-[0.65rem] uppercase tracking-[0.18em] text-teal-700">
                                    <WalletCards className="mr-2 h-3.5 w-3.5" />
                                    Sales analytics
                                </Badge>
                                <Title className="text-2xl sm:text-3xl">Sales Overview</Title>
                                <Subtitle className="text-sm text-slate-600 sm:text-base">
                                    Sales data from the existing Sales API. Summary cards, trend and product breakdowns update with the active filters.
                                </Subtitle>
                            </div>
                            <Button variant="secondary" onClick={refreshSalesData} disabled={salesError === null && sales.length > 0 && !loading}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <div>
                                <Label>Date Range</Label>
                                <Select value={salesDatePreset} onChange={(event) => { setSalesDatePreset(event.target.value); }}>
                                    <option value="all">All time</option>
                                    <option value="today">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="year">This Year</option>
                                    <option value="custom">Custom Range</option>
                                </Select>
                            </div>
                            {salesDatePreset === "custom" ? (
                                <>
                                    <div>
                                        <Label>Date From</Label>
                                        <Input type="date" value={salesDateFrom} onChange={(event) => setSalesDateFrom(event.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Date To</Label>
                                        <Input type="date" value={salesDateTo} onChange={(event) => setSalesDateTo(event.target.value)} />
                                    </div>
                                </>
                            ) : null}
                            <div>
                                <Label>Product</Label>
                                <Select value={salesProductFilter} onChange={(event) => setSalesProductFilter(event.target.value)}>
                                    <option value="">All products</option>
                                    {salesProducts.map((product) => (
                                        <option key={product} value={product}>
                                            {formatProductLabel(product)}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div className="flex items-end gap-1">
                                <Label>Metric</Label>
                                <div className="flex gap-1">
                                    <Button
                                        variant={salesMetric === "amount" ? "primary" : "secondary"}
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => setSalesMetric("amount")}
                                    >
                                        Amount
                                    </Button>
                                    <Button
                                        variant={salesMetric === "quantity" ? "primary" : "secondary"}
                                        className="px-3 py-1.5 text-xs"
                                        onClick={() => setSalesMetric("quantity")}
                                    >
                                        Quantity
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {salesKpiCards.map((card) => (
                                <MetricCard key={card.label} {...card} />
                            ))}
                        </div>

                        <div className="mt-5 grid gap-6 lg:grid-cols-2">
                            <ChartFrame title="Sales Trend" subtitle="Sales over time. Switch between daily, weekly and monthly aggregation." icon={TrendingUp}>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <Button
                                            variant={salesTrendPeriod === "daily" ? "primary" : "secondary"}
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => setSalesTrendPeriod("daily")}
                                        >
                                            Daily
                                        </Button>
                                        <Button
                                            variant={salesTrendPeriod === "weekly" ? "primary" : "secondary"}
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => setSalesTrendPeriod("weekly")}
                                        >
                                            Weekly
                                        </Button>
                                        <Button
                                            variant={salesTrendPeriod === "monthly" ? "primary" : "secondary"}
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => setSalesTrendPeriod("monthly")}
                                        >
                                            Monthly
                                        </Button>
                                    </div>
                                    {salesError ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                                            {salesError}
                                        </div>
                                    ) : (
                                        <TrendChart
                                            data={salesTrendSeries}
                                            emptyLabel="No sales data available yet."
                                            valueLabel={salesMetric === "quantity" ? " KG" : ""}
                                        />
                                    )}
                                </div>
                            </ChartFrame>

                            <ChartFrame title="Sales by Product" subtitle="Top products ranked by sales." badge={salesByProductSeries.length > 0 ? "Top 6" : "No data"} icon={WalletCards}>
                                {salesError ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                                        {salesError}
                                    </div>
                                ) : (
                                    <HorizontalBarChart
                                        data={salesByProductSeries}
                                        emptyLabel="No sales records saved yet."
                                        valueLabel={salesMetric === "quantity" ? "KG" : "amount"}
                                    />
                                )}
                            </ChartFrame>

                            <ChartFrame title="Top Selling Products" subtitle="Ranked products by sales performance." icon={BarChart3}>
                                {salesError ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                                        {salesError}
                                    </div>
                                ) : salesByProductSeries.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                                        No sales records saved yet.
                                    </div>
                                ) : (
                                    <ol className="space-y-2.5">
                                        {salesByProductSeries.slice(0, 6).map((item, index) => (
                                            <li key={item.label} className="flex items-center gap-3 text-sm">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-700">{index + 1}</span>
                                                <span className="flex-1 font-medium text-slate-700">{item.label}</span>
                                                <span className="shrink-0 font-semibold text-slate-950">
                                                    {salesMetric === "quantity" ? `${formatAmount(item.value)} KG` : formatAmount(item.value)}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </ChartFrame>
                        </div>

                        <Card className="mt-5 border-slate-200/80 shadow-[0_18px_60px_-38px_rgba(15,23,42,0.45)]">
                            <CardHeader className="border-b border-slate-200/80 bg-white/90">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-lg font-semibold text-slate-950">Sales History</p>
                                        <p className="text-sm text-slate-500">All sales records matching the active filters.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge>{filteredSales.length.toLocaleString()} records</Badge>
                                        <Button variant="ghost" onClick={() => navigate("/sales")}>
                                            <BarChart3 className="mr-2 h-4 w-4" />
                                            View All
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardBody className="p-0">
                                {salesError ? (
                                    <div className="p-6 text-sm text-slate-500">
                                        Unable to load sales data.
                                    </div>
                                ) : filteredSales.length === 0 ? (
                                    <div className="p-6 text-sm text-slate-500">
                                        No sales data available yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse">
                                            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.14em]">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold">Date</th>
                                                    <th className="px-4 py-3 font-semibold">Product</th>
                                                    <th className="px-4 py-3 font-semibold">Quantity KG</th>
                                                    <th className="px-4 py-3 font-semibold">Rate</th>
                                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSales
                                                    .slice()
                                                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                                    .map((sale) => (
                                                        <tr key={sale._id} className="border-t border-slate-200">
                                                            <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(sale.createdAt)}</td>
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-950">{formatProductLabel(sale.productName)}</td>
                                                            <td className="px-4 py-3 text-sm text-slate-700">{Number(sale.quantity ?? 0).toLocaleString()} KG</td>
                                                            <td className="px-4 py-3 text-sm text-slate-500">{formatAmount(sale.rate)}</td>
                                                            <td className="px-4 py-3 text-sm font-semibold text-slate-950">{formatAmount(sale.amount)}</td>
                                                        </tr>
                                                    ))
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                </section>
            </> : null}

            </> : null}

        </div>
    );
}
