import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
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
        return null;
    }
    if (!user) {
        return null;
    }
    return (<AppShell role={user.role} email={user.email}>
      <TrackingDashboard email={user.email} role={user.role}/>
    </AppShell>);
}
