import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { useAuthSession } from "@/hooks/use-auth-session";
export function SalesPage() {
    const { user, loading } = useAuthSession();
    const navigate = useNavigate();
    useEffect(() => {
        if (!loading && !user) {
            navigate("/login", { replace: true });
        }
    }, [loading, navigate, user]);
    if (loading) {
        return <LoadingScreen title="Loading sales view" subtitle="Fetching your products..."/>;
    }
    if (!user) {
        return <LoadingScreen title="Redirecting" subtitle="Please sign in to continue."/>;
    }
    return (
      <AppShell role={user.role} email={user.email}>
      <SalesDashboard email={user.email} role={user.role}/>
    </AppShell>);
}
