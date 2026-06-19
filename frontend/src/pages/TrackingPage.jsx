import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { TrackingDashboard } from "@/components/tracking/tracking-dashboard";
import { useAuthSession } from "@/hooks/use-auth-session";
export function TrackingPage() {
    const { user, loading } = useAuthSession();
    const navigate = useNavigate();
    useEffect(() => {
        if (!loading && !user) {
            navigate("/login", { replace: true });
        }
    }, [loading, navigate, user]);
    if (loading) {
        return <LoadingScreen title="Loading tracking view" subtitle="Fetching production history..."/>;
    }
    if (!user) {
        return <LoadingScreen title="Redirecting" subtitle="Please sign in to view tracking."/>;
    }
    return (<AppShell role={user.role} email={user.email}>
      <TrackingDashboard email={user.email} role={user.role}/>
    </AppShell>);
}
