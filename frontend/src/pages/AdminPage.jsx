import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { useAuthSession } from "@/hooks/use-auth-session";
import { apiFetch } from "@/services/api-client";
function getTableName(search) {
    const params = new URLSearchParams(search);
    const tableName = params.get("tableName")?.trim() || "";
    return tableName;
}
function getSection(search) {
    const params = new URLSearchParams(search);
    return params.get("section")?.trim() === "rawMaterials" ? "rawMaterials" : "products";
}
export function AdminPage() {
    const { user, loading } = useAuthSession();
    const location = useLocation();
    const navigate = useNavigate();
    const [initialItems, setInitialItems] = useState([]);
    const [tableNames, setTableNames] = useState([]);
    const [pageLoading, setPageLoading] = useState(true);
    const selectedTableName = useMemo(() => getTableName(location.search) || "Table 1", [location.search]);
    const selectedSection = useMemo(() => getSection(location.search), [location.search]);
    useEffect(() => {
        if (!loading && (!user || user.role !== "admin")) {
            navigate("/login", { replace: true });
        }
    }, [loading, navigate, user]);
    useEffect(() => {
        if (loading || !user || user.role !== "admin")
            return;
        let cancelled = false;
        async function loadData() {
            setPageLoading(true);
            try {
                const [itemsData, tablesData] = await Promise.all([
                    apiFetch(`/api/admin/items?tableName=${encodeURIComponent(selectedTableName)}`),
                    apiFetch("/api/admin/tables")
                ]);
                if (cancelled)
                    return;
                setInitialItems((itemsData.items ?? []).map((item) => ({ ...item })));
                setTableNames(Array.isArray(tablesData.tables)
                    ? tablesData.tables.map((table) => table.name).filter(Boolean)
                    : []);
            }
            catch {
                if (!cancelled) {
                    setInitialItems([]);
                    setTableNames([]);
                }
            }
            finally {
                if (!cancelled) {
                    setPageLoading(false);
                }
            }
        }
        loadData();
        return () => {
            cancelled = true;
        };
    }, [loading, selectedTableName, user]);
    if (loading || pageLoading) {
        return null;
    }
    if (!user || user.role !== "admin") {
        return null;
    }
    return (<AppShell role="admin" email={user.email}>
      <AdminDashboard initialItems={initialItems} initialSection={selectedSection} initialTableName={selectedTableName} tableNames={tableNames}/>
    </AppShell>);
}
