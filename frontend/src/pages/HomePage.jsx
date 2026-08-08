import { RootEntry } from "@/components/root-entry";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuthSession } from "@/hooks/use-auth-session";
function roleRedirectPath(role) {
    return "/tracking";
}
export function HomePage() {
    const { user, loading } = useAuthSession();
    if (loading) {
        return <LoadingScreen title="Opening production history" subtitle="We're checking your sign-in status now."/>;
    }
    if (!user) {
        return (<RootEntry destination="/login" heading="Welcome to Himalaya Paints" subtitle="You are not signed in yet. We'll take you to the login page now." ctaLabel="Go to Login"/>);
    }
    return (<RootEntry destination={roleRedirectPath(user.role)} heading="Opening production history" subtitle="We're taking you to the tracking page now. If it does not happen automatically, use the button below." ctaLabel="Continue"/>);
}
