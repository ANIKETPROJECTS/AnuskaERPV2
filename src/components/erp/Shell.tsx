import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  Factory,
  AlertTriangle,
  Truck,
  Users,
  Database,
  PackagePlus,
  Store,
  UserCog,
  UserRoundCog,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { logoutFn } from "@/auth";
import { canAccess, useAuth } from "@/components/auth/AuthContext";
import factoryIcon from "../../../attached_assets/factory_1790353346567.png";
import { NotificationBell } from "./HeaderTools";
import { SignOutButton } from "./SignOutButton";
import { SidebarDateTime } from "./SidebarDateTime";

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
  {
    to: "/quality-management",
    label: "Quality Management",
    icon: ShieldAlert,
    permission: "quality-management",
  },
] as const;

const procurementPanelNav = [
  {
    to: "/procurement-management/orders",
    label: "Order Management",
    icon: ClipboardList,
  },
  {
    to: "/procurement-management/vendors",
    label: "Vendor Management",
    icon: Store,
  },
  {
    to: "/procurement-management/hub-stock",
    label: "Hub stock & targets",
    icon: PackagePlus,
  },
  {
    to: "/procurement-management/item-requests",
    label: "Item requests",
    icon: ClipboardList,
  },
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
  const isProcurementPanel = user?.panel === "procurement";
  const visibleNav =
    isProcurementPanel
      ? procurementPanelNav
      : nav.filter((item) => canAccess(user, item.permission));
  const initials =
    user?.name
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
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-[65px] shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={factoryIcon}
              alt="Gadsons"
              className="size-10 shrink-0 rounded-md bg-white p-1 object-contain"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-semibold">
                {isProcurementPanel ? "Procurement" : "Gadsons"}
              </p>
              {!isProcurementPanel ? (
                <p className="truncate text-sm text-muted-foreground">Water Purifier Parts ERP</p>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modules
          </p>
          {visibleNav.map((item) => {
            const destination = item.to;
            const active = pathname === destination || pathname.startsWith(`${destination}/`);
            return (
              <Link
                key={item.to}
                to={destination}
                search={
                  "permission" in item && item.permission === "procurement"
                    ? { panel: user?.panel ?? "admin" }
                    : undefined
                }
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-base leading-snug transition-colors ${
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <SidebarDateTime />
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-base font-medium">{user?.name}</p>
              {!isProcurementPanel ? (
                <p className="text-sm capitalize text-muted-foreground">
                  {user?.role === "master_admin" ? "Master Admin" : user?.role} · Secure session
                </p>
              ) : null}
            </div>
            <SignOutButton
              panel={user?.panel === "procurement" ? "Procurement" : "Admin"}
              onConfirm={signOut}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex min-h-[65px] flex-wrap items-center gap-4 px-6 py-0">
            <div className="min-w-0 flex-1">
              <h1
                className={`truncate font-semibold ${
                  isProcurementPanel ? "text-lg leading-tight" : "text-xl"
                }`}
              >
                {title}
              </h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {user?.panel === "admin" ? <NotificationBell panel="admin" /> : null}
            {actions}
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {visibleNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={
                  "permission" in item &&
                  item.permission === "procurement" &&
                  user?.panel !== "procurement"
                    ? { panel: user?.panel ?? "admin" }
                    : undefined
                }
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground"
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
