import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Boxes, ClipboardCheck, Database, FileBarChart, Layers, LogOut, PackageOpen, UserRoundCog } from "lucide-react";
import type { ReactNode } from "react";
import { logoutFn } from "@/auth";
import { canAccess, useAuth } from "@/components/auth/AuthContext";
import { NotificationBell } from "./HeaderTools";

const subhubNav = [
  { to: "/inventory", label: "Inventory Management", permission: "inventory", icon: PackageOpen },
  { to: "/subhub/production", label: "Hub Manager", permission: "hub-manager", icon: ClipboardCheck },
  { to: "/subhub/reports", label: "Hub Reports", permission: "hub-reports", icon: FileBarChart },
  { to: "/subhub/hr", label: "HR & Attendance", permission: "hr", icon: UserRoundCog },
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
      <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-[65px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="rule-header flex size-9 items-center justify-center rounded-md">
            <Boxes className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SubHub Panel</p>
            <p className="truncate text-xs text-muted-foreground">{user?.subhubName ?? "Float ERP workspace"}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="SubHub navigation">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modules</p>
          <Link
            to="/subhub"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === "/subhub" ? "bg-sidebar-accent font-medium text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <Boxes className="size-4" /> Overview
          </Link>
          {visibleNav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-accent font-medium text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold">{initials}</div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{user?.role} · Secure session</p>
            </div>
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