import { RootEntry } from "@/components/root-entry";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuthSession } from "@/hooks/use-auth-session";
function roleRedirectPath(role) {
    return role === "admin" ? "/admin" : "/user";
}
export function HomePage() {
    const { user, loading } = useAuthSession();
    if (loading) {
        return <LoadingScreen title="Opening your dashboard" subtitle="We're checking your sign-in status now."/>;
    }
    if (!user) {
        return (<RootEntry destination="/login" heading="Welcome to Himalaya Paints" subtitle="You are not signed in yet. We'll take you to the login page now." ctaLabel="Go to Login"/>);
    }
    return (<RootEntry destination={roleRedirectPath(user.role)} heading="Opening your dashboard" subtitle="We're taking you to the correct dashboard now. If it does not happen automatically, use the button below." ctaLabel="Continue"/>);
}
