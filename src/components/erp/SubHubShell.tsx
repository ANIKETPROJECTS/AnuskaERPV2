import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Boxes, ClipboardCheck, ClipboardList, Database, FileBarChart, Layers, LogOut, PackageOpen, PanelLeftClose, PanelLeftOpen, ShoppingCart, UserRoundCog } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { logoutFn } from "@/auth";
import { canAccess, useAuth } from "@/components/auth/AuthContext";
import { NotificationBell } from "./HeaderTools";

const subhubNav = [
  { to: "/inventory", label: "Inventory Management", permission: "inventory", icon: PackageOpen },
  { to: "/subhub/production", label: "Hub Manager", permission: "hub-manager", icon: ClipboardCheck },
  { to: "/subhub/reports", label: "Hub Reports", permission: "hub-reports", icon: FileBarChart },
  { to: "/subhub/request-items", label: "Request items", permission: "item-requests", icon: ClipboardList },
  { to: "/subhub/hr", label: "HR & Attendance", permission: "hr", icon: UserRoundCog },
  { to: "/procurement", label: "Procurement", permission: "procurement", icon: ShoppingCart },
  { to: "/subhub/bom", label: "Bill of Materials", permission: "bom", icon: Layers },
  { to: "/subhub/raw-materials", label: "Raw Materials", permission: "raw-materials", icon: Database },
] as const;

export function SubHubShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const router = useRouter();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SH";
  const visibleNav = subhubNav.filter((item) => canAccess(user, item.permission));

  async function signOut() {
    await logoutFn({ data: { panel: "subhub" } });
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${sidebarCollapsed ? "w-[4.5rem]" : "w-64"}`}>
        <div className={`flex h-[65px] shrink-0 items-center border-b border-sidebar-border ${sidebarCollapsed ? "justify-center px-3" : "justify-between gap-3 px-5"}`}>
          {!sidebarCollapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="rule-header flex size-9 shrink-0 items-center justify-center rounded-md">
                <Boxes className="size-4" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold">SubHub Panel</p>
                <p className="truncate text-xs text-muted-foreground">{user?.subhubName ?? "Float ERP workspace"}</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "Open SubHub sidebar" : "Close SubHub sidebar"}
            title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className={`flex-1 space-y-1 ${sidebarCollapsed ? "p-2" : "p-3"}`} aria-label="SubHub navigation">
          {!sidebarCollapsed ? <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modules</p> : null}
          {visibleNav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                search={item.permission === "procurement" ? { panel: "subhub" } : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-md py-2 text-sm transition-colors ${sidebarCollapsed ? "justify-center px-2" : "px-3"} ${
                  active ? "bg-sidebar-accent font-medium text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="size-4" />
                {!sidebarCollapsed ? item.label : null}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t border-sidebar-border ${sidebarCollapsed ? "p-2" : "p-3"}`}>
          <div className={`rounded-md py-2 ${sidebarCollapsed ? "flex flex-col items-center gap-2 px-1" : "flex items-center gap-3 px-2"}`}>
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold">{initials}</div>
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{user?.role} · Secure session</p>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-3 border-b border-border bg-background/85 px-6 py-3 backdrop-blur">
          <NotificationBell panel="subhub" />
          {actions}
        </header>
        {title ? (
          <div className="border-b border-border px-6 py-5">
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}