"use client";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BarChart3, Calculator, ClipboardList, LogOut, Menu, ShieldCheck, X, Users } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { apiFetch } from "@/services/api-client";
const navItems = {
    admin: [
        { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck },
        { href: "/user", label: "User View", icon: Users },
        { href: "/tracking", label: "Tracking", icon: ClipboardList }
    ],
    user: [
        { href: "/user", label: "User Dashboard", icon: Users },
        { href: "/tracking", label: "Tracking", icon: ClipboardList }
    ]
};
export function AppShell({ role, children, email, tableName }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);
    async function handleLogout() {
        await apiFetch("/api/auth/logout", { method: "POST" });
        navigate("/login", { replace: true });
    }
    function buildHref(href) {
        if (!tableName) {
            return href;
        }
        const params = new URLSearchParams();
        params.set("tableName", tableName);
        return `${href}?${params.toString()}`;
    }
    return (<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_28%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)] text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <div className="border-b border-line bg-white/80 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-soft">
                <BarChart3 className="h-6 w-6"/>
              </div>
              <div>
                <p className="text-base font-semibold">Himalaya Paints</p>
                <p className="text-xs text-muted capitalize">{role} Dashboard</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setOpen(true)} className="h-11 w-11 px-0">
              <Menu className="h-5 w-5"/>
            </Button>
          </div>
        </div>

        {open ? (<button type="button" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay"/>) : null}

        <aside className={cx("fixed inset-y-0 left-0 z-40 w-[88vw] max-w-sm border-r border-line bg-white/95 px-5 py-4 shadow-2xl backdrop-blur transition-transform duration-300 lg:static lg:z-auto lg:min-h-screen lg:w-80 lg:translate-x-0 lg:border-b-0 lg:px-6 lg:py-8 print:hidden", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <div className="mb-8 flex items-center justify-between gap-3 lg:justify-start">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-soft">
                <BarChart3 className="h-6 w-6"/>
              </div>
              <div>
                <p className="text-lg font-semibold">Himalaya Paints</p>
                <p className="text-sm text-muted capitalize">{role} Dashboard</p>
              </div>
            </div>
            <Button variant="ghost" className="h-11 w-11 px-0 lg:hidden" onClick={() => setOpen(false)}>
              <X className="h-5 w-5"/>
            </Button>
          </div>

          <nav className="grid gap-2">
            {navItems[role].map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;
            return (<Link key={item.href} to={buildHref(item.href)} className={cx("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition", active ? "bg-accent text-white shadow-soft" : "bg-transparent text-ink hover:bg-slate-100")}>
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
            <Button variant="secondary" className="mt-4 w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4"/>
              Logout
            </Button>
          </div>
        </aside>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>);
}
