"use client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BarChart3, Calculator, ClipboardList, Layers3, LogOut, Menu, Package2, ShoppingCart, Settings, ShieldCheck, Users, X } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { useAuthSessionContext } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { apiFetch } from "@/services/api-client";
import { toast } from "sonner";
const navItems = {
    admin: [
        { href: "/admin", section: "workspace", label: "Admin", icon: ShieldCheck, adminEntry: true },
        { href: "/user", label: "User View", icon: Users },
        { href: "/sales", label: "Sales", icon: ShoppingCart },
        { href: "/admin", section: "dashboard", label: "Dashboard", icon: BarChart3 },
        { href: "/tracking", label: "Production History", icon: ClipboardList },
        { href: "/admin", section: "settings", label: "Settings", icon: Settings }
    ],
    user: [
        { href: "/sales", label: "Sales", icon: ShoppingCart },
        { href: "/tracking", label: "Production History", icon: ClipboardList }
    ]
};
export function AppShell({ role, children, email, tableName }) {
    const location = useLocation();
    const navigate = useNavigate();
    const authSession = useAuthSessionContext();
    const [open, setOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    useEffect(() => {
        setOpen(false);
    }, [location.pathname, location.search]);
    async function handleLogout() {
        setLoggingOut(true);
        try {
            await apiFetch("/api/auth/logout", { method: "POST" });
            await authSession?.refreshSession?.();
            navigate("/login", { replace: true });
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Logout failed. Please try again.");
        }
        finally {
            setLoggingOut(false);
        }
    }
    function buildHref(item) {
        const href = item.href;
        if (!tableName) {
            return item.section ? `${href}?section=${encodeURIComponent(item.section)}` : href;
        }
        const params = new URLSearchParams(item.search || "");
        params.set("tableName", tableName);
        if (item.section) {
            params.set("section", item.section);
        }
        return `${href}?${params.toString()}`;
    }
    function openAdminSection(section) {
        const params = new URLSearchParams();
        if (tableName) {
            params.set("tableName", tableName);
        }
        params.set("section", section);
        navigate(`/admin?${params.toString()}`);
    }
    const currentSection = new URLSearchParams(location.search).get("section") || "dashboard";
    return (<div className="flex min-h-screen flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)] text-ink">
      <div className="flex w-full min-w-0 flex-1 flex-col lg:flex-row">
        <div className="sticky top-0 z-20 border-b border-line bg-white/85 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-soft sm:h-11 sm:w-11">
                <BarChart3 className="h-6 w-6"/>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold sm:text-base">Himalaya Paints</p>
                <p className="text-xs text-muted capitalize">{role} Workspace</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setOpen(true)} className="h-10 w-10 shrink-0 px-0 sm:h-11 sm:w-11" aria-label="Open navigation menu" aria-expanded={open}>
              <Menu className="h-5 w-5"/>
            </Button>
          </div>
        </div>

        {open ? (<button type="button" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay"/>) : null}

        <aside className={cx("fixed inset-y-0 left-0 z-40 w-[88vw] max-w-sm border-r border-line bg-white/95 px-4 py-4 shadow-2xl backdrop-blur transition-transform duration-300 sm:px-5 lg:static lg:z-auto lg:min-h-screen lg:w-80 lg:translate-x-0 lg:border-b-0 lg:px-6 lg:py-8 print:hidden", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <div className="mb-8 flex items-center justify-between gap-3 lg:justify-start">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-white shadow-soft sm:h-12 sm:w-12">
                <BarChart3 className="h-6 w-6"/>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold sm:text-lg">Himalaya Paints</p>
                <p className="text-sm text-muted capitalize">{role} Workspace</p>
              </div>
            </div>
            <Button variant="ghost" className="h-10 w-10 px-0 lg:hidden sm:h-11 sm:w-11" onClick={() => setOpen(false)}>
              <X className="h-5 w-5"/>
            </Button>
          </div>

          <nav className="grid gap-2" aria-label="Primary navigation">
            {navItems[role].map((item) => {
            const Icon = item.icon;
            const hasSection = new URLSearchParams(location.search).has("section");
            const active = location.pathname === item.href && (item.adminEntry ? currentSection === "workspace" : (!item.section || currentSection === item.section));
            return (<Link key={`${item.href}-${item.section || "default"}`} to={buildHref(item)} className={cx("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition", active ? "bg-accent text-white shadow-soft" : "bg-transparent text-ink hover:bg-slate-100")}>
                  <Icon className="h-4 w-4"/>
                  {item.label}
                </Link>);
        })}
          </nav>

          <div className="mt-8 rounded-3xl border border-line bg-card p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                <Calculator className="h-5 w-5"/>
              </div>
              <div>
                <p className="text-sm font-semibold">Signed in as</p>
                <p className="text-xs text-muted">{email}</p>
              </div>
            </div>
            <Button variant="secondary" className="mt-4 w-full" onClick={handleLogout} disabled={loggingOut} aria-label="Log out of Himalaya Paints">
              <LogOut className="mr-2 h-4 w-4"/>
              Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>);
}
