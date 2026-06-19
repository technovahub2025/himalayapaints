import { useAuthSessionContext } from "@/components/providers";
import { apiFetch } from "@/services/api-client";
import { useEffect, useState } from "react";
export function useAuthSession() {
    const context = useAuthSessionContext();
    const [fallbackState, setFallbackState] = useState({ user: null, loading: true });
    useEffect(() => {
        if (context) {
            return;
        }
        let cancelled = false;
        async function loadSession() {
            try {
                const data = await apiFetch("/api/auth/me");
                if (cancelled)
                    return;
                setFallbackState({ user: data.user ?? null, loading: false });
            }
            catch {
                if (!cancelled) {
                    setFallbackState({ user: null, loading: false });
                }
            }
        }
        loadSession();
        return () => {
            cancelled = true;
        };
    }, [context]);
    return context ?? fallbackState;
}
