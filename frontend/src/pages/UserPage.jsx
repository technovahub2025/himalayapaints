import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { UserDashboard } from "@/components/user/user-dashboard";
import { getCachedTableData, setCachedTableData } from "@/lib/dashboard-cache";
import { useAuthSession } from "@/hooks/use-auth-session";
import { apiFetch } from "@/services/api-client";
function getTableName(search) {
    const params = new URLSearchParams(search);
    return params.get("tableName")?.trim() || "";
}
export function UserPage() {
    const { user, loading } = useAuthSession();
    const location = useLocation();
    const navigate = useNavigate();
    const [initialItems, setInitialItems] = useState([]);
    const [tableNames, setTableNames] = useState([]);
    const [pageLoading, setPageLoading] = useState(true);
    const selectedTableName = useMemo(() => getTableName(location.search) || "Table 1", [location.search]);
    const cachedData = getCachedTableData(selectedTableName);
    useEffect(() => {
        if (cachedData) {
            setInitialItems(cachedData.items ?? []);
            setTableNames(cachedData.tables ?? []);
            setPageLoading(false);
        }
    }, [cachedData]);
    useEffect(() => {
        if (!loading && (!user || (user.role !== "user" && user.role !== "admin"))) {
            navigate("/login", { replace: true });
        }
    }, [loading, navigate, user]);
    useEffect(() => {
        if (loading || !user || (user.role !== "user" && user.role !== "admin"))
            return;
        let cancelled = false;
        async function loadData() {
            setPageLoading(true);
            try {
                const data = await apiFetch(`/api/items?tableName=${encodeURIComponent(selectedTableName)}`);
                if (cancelled)
                    return;
                const nextItems = (data.items ?? []).map((item) => ({ ...item }));
                const nextTables = Array.isArray(data.tables) ? data.tables.filter(Boolean) : [];
                setInitialItems(nextItems);
                setTableNames(nextTables);
                setCachedTableData(selectedTableName, { items: nextItems, tables: nextTables });
            }
            catch {
                if (!cancelled && !cachedData) {
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
    if (loading || (pageLoading && initialItems.length === 0)) {
        return <LoadingScreen title="Loading user dashboard" subtitle="Fetching your latest production data..."/>;
    }
    if (!user) {
        return <LoadingScreen title="Redirecting" subtitle="Please sign in to continue."/>;
    }
    return (<AppShell role={user.role} email={user.email} tableName={selectedTableName}>
      <UserDashboard email={user.email} initialItems={initialItems} initialTableName={selectedTableName} tableNames={tableNames}/>
    </AppShell>);
}
