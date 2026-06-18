import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { UserDashboard } from "@/components/user/user-dashboard";
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
                setInitialItems((data.items ?? []).map((item) => ({ ...item })));
                setTableNames(Array.isArray(data.tables) ? data.tables.filter(Boolean) : []);
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
    if (!user) {
        return null;
    }
    return (<AppShell role={user.role} email={user.email}>
      <UserDashboard email={user.email} initialItems={initialItems} initialTableName={selectedTableName} tableNames={tableNames}/>
    </AppShell>);
}
