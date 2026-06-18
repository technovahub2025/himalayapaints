import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api-client";
export function useAuthSession() {
    const [state, setState] = useState({ user: null, loading: true });
    useEffect(() => {
        let cancelled = false;
        async function loadSession() {
            try {
                const data = await apiFetch("/api/auth/me");
                if (cancelled)
                    return;
                setState({ user: data.user ?? null, loading: false });
            }
            catch {
                if (!cancelled) {
                    setState({ user: null, loading: false });
                }
            }
        }
        loadSession();
        return () => {
            cancelled = true;
        };
    }, []);
    return state;
}
