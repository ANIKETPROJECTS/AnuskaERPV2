import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  Factory,
  AlertTriangle,
  Truck,
  Users,
  LogOut,
  Database,
  UserCog,
  UserRoundCog,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { logoutFn } from "@/auth";
import { canAccess, useAuth } from "@/components/auth/AuthContext";
import { NotificationBell } from "./HeaderTools";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { to: "/bom", label: "Bill of Materials", icon: Layers, permission: "bom" },
  { to: "/raw-materials", label: "Raw Materials", icon: Database, permission: "raw-materials" },
  { to: "/orders", label: "Orders & Targets", icon: ClipboardList, permission: "orders" },
  { to: "/hubs", label: "Hubs & Stock", icon: Factory, permission: "hubs" },
  { to: "/shortages", label: "Shortages", icon: AlertTriangle, permission: "shortages" },
  { to: "/procurement", label: "Procurement", icon: Truck, permission: "procurement" },
  { to: "/production", label: "Production & Workforce", icon: Users, permission: "production" },
  { to: "/admin/users", label: "User Management", icon: UserCog, permission: "user-management" },
  { to: "/hr", label: "HR & Attendance", icon: UserRoundCog, permission: "hr" },
  { to: "/quality-management", label: "Quality Management", icon: ShieldAlert, permission: "quality-management" },
] as const;

export function Shell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const visibleNav = nav.filter((item) => canAccess(user, item.permission));
  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "FA";

  async function signOut() {
    await logoutFn({ data: { panel: user?.panel === "procurement" ? "procurement" : "admin" } });
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex ${sidebarCollapsed ? "w-[4.5rem]" : "w-64"}`}>
        <div className={`flex items-center border-b border-sidebar-border py-4 ${sidebarCollapsed ? "justify-center px-3" : "justify-between gap-3 px-5"}`}>
          {!sidebarCollapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <img src="/gadsons-mark.svg" alt="Gadsons" className="size-9 rounded-md" />
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-semibold">Gadsons</p>
                <p className="truncate text-xs text-muted-foreground">Water Purifier Parts ERP</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "Open workspace sidebar" : "Close workspace sidebar"}
            title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto ${sidebarCollapsed ? "p-2" : "p-3"}`}>
          {!sidebarCollapsed ? <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modules</p> : null}
          {visibleNav.map((item) => {
            const destination = user?.panel === "procurement" && item.permission === "procurement" ? "/procurement-management" : item.to;
            const active = destination === "/" ? pathname === "/" : pathname.startsWith(destination);
            return (
              <Link
                key={item.to}
                to={destination}
                search={item.permission === "procurement" ? { panel: user?.panel ?? "admin" } : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-md py-2 text-sm transition-colors ${
                  sidebarCollapsed ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
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
            <div className="flex size-8 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold">
              {initials}
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {user?.role === "master_admin" ? "Master Admin" : user?.role} · Secure session
                </p>
              </div>
            ) : null}
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
              className={`${sidebarCollapsed ? "" : "ml-auto"} rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground`}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 px-6 py-4">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {user?.panel === "admin" ? <NotificationBell panel="admin" /> : null}
            {actions}
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {visibleNav.map((item) => (
              <Link
                key={item.to}
                to={user?.panel === "procurement" && item.permission === "procurement" ? "/procurement-management" : item.to}
                search={item.permission === "procurement" && user?.panel !== "procurement" ? { panel: user?.panel ?? "admin" } : undefined}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground"
                activeProps={{ className: "bg-secondary text-foreground font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="flex-1 space-y-6 p-6">{children}</main>

        <footer className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          Prototype UI · seeded sample data · Stage 1 scope: Float product line
        </footer>
      </div>
    </div>
  );
}
