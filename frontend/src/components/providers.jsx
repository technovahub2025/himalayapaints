"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { apiFetch } from "@/services/api-client";
const AuthSessionContext = createContext(null);
export function Providers({ children }) {
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
    const value = useMemo(() => state, [state]);
    return (<AuthSessionContext.Provider value={value}>
      {children}
      <Toaster richColors position="top-right"/>
    </AuthSessionContext.Provider>);
}
export function useAuthSessionContext() {
    return useContext(AuthSessionContext);
}
