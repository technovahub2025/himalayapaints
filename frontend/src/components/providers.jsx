"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { apiFetch } from "@/services/api-client";
const AuthSessionContext = createContext(null);
export function Providers({ children }) {
    const [state, setState] = useState({ user: null, loading: true });
    async function refreshSession() {
        setState((current) => ({ ...current, loading: true }));
        try {
            const data = await apiFetch("/api/auth/me");
            setState({ user: data.user ?? null, loading: false });
        }
        catch {
            setState({ user: null, loading: false });
        }
    }
    useEffect(() => {
        void refreshSession();
    }, []);
    const value = useMemo(() => ({ ...state, refreshSession }), [state]);
    return (<AuthSessionContext.Provider value={value}>
      {children}
      <Toaster richColors position="top-right"/>
    </AuthSessionContext.Provider>);
}
export function useAuthSessionContext() {
    return useContext(AuthSessionContext);
}
