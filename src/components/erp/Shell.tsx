import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Layers,
  ClipboardList,
  Factory,
  AlertTriangle,
  ChevronDown,
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
  {
    to: "/admin/procurement/orders",
    label: "Procurement",
    icon: Truck,
    permission: "procurement",
    children: [
      {
        to: "/admin/procurement/orders",
        label: "Order Management",
        icon: ClipboardList,
      },
      {
        to: "/admin/procurement/vendors",
        label: "Vendor Management",
        icon: Store,
      },
      {
        to: "/admin/procurement/hub-stock",
        label: "Hub stock & targets",
        icon: PackagePlus,
      },
      {
        to: "/admin/procurement/item-requests",
        label: "Item requests",
        icon: ClipboardList,
      },
    ],
  },
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
  mainClassName = "flex-1 space-y-6 p-6",
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  mainClassName?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const { user } = useAuth();
  const isProcurementPanel = user?.panel === "procurement";
  const [isProcurementSectionOpen, setProcurementSectionOpen] = useState(() =>
    pathname.startsWith("/admin/procurement"),
  );
  useEffect(() => {
    if (pathname.startsWith("/admin/procurement")) {
      setProcurementSectionOpen(true);
    }
  }, [pathname]);
  const visibleNav = isProcurementPanel
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
            if ("children" in item) {
              const active = pathname.startsWith("/admin/procurement");
              return (
                <div key={item.label}>
                  <div className="flex items-center gap-1">
                    <Link
                      to={item.to}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2.5 text-base leading-snug transition-colors ${
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                      }`}
                    >
                      <item.icon className="size-5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`${isProcurementSectionOpen ? "Collapse" : "Expand"} Procurement pages`}
                      aria-expanded={isProcurementSectionOpen}
                      onClick={() => setProcurementSectionOpen((open) => !open)}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    >
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-4 transition-transform ${isProcurementSectionOpen ? "rotate-180" : ""}`}
                    />
                    </button>
                  </div>
                  {isProcurementSectionOpen ? (
                    <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border py-1 pl-3">
                      {item.children.map((child) => {
                        const childActive =
                          pathname === child.to || pathname.startsWith(`${child.to}/`);
                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm leading-snug transition-colors ${
                              childActive
                                ? "bg-sidebar-accent font-medium text-sidebar-primary"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                            }`}
                          >
                            <child.icon className="size-4 shrink-0" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }
            const destination = item.to;
            const active = pathname === destination || pathname.startsWith(`${destination}/`);
            return (
              <Link
                key={item.to}
                to={destination}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-base leading-snug transition-colors ${
                  active
                    ? isProcurementPanel
                      ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                      : "bg-sidebar-accent font-medium text-sidebar-primary"
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
        <header className="sticky top-0 z-20 min-h-[65px] border-b border-border bg-background/85 backdrop-blur">
          <div className="flex min-h-[64px] flex-wrap items-center gap-4 px-6 py-0">
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
            {visibleNav.map((item) => {
              if ("children" in item) {
                const active = pathname.startsWith("/admin/procurement");
                return (
                  <div key={item.label} className="flex shrink-0 items-center gap-1">
                    <Link
                      to={item.to}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                        active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      aria-label={`${isProcurementSectionOpen ? "Collapse" : "Expand"} Procurement pages`}
                      aria-expanded={isProcurementSectionOpen}
                      onClick={() => setProcurementSectionOpen((open) => !open)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={`size-3 transition-transform ${isProcurementSectionOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isProcurementSectionOpen
                      ? item.children.map((child) => (
                          <Link
                            key={child.to}
                            to={child.to}
                            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                            activeProps={{
                              className: "bg-secondary font-medium text-foreground",
                            }}
                          >
                            {child.label}
                          </Link>
                        ))
                      : null}
                  </div>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground"
                  activeProps={{
                    className: isProcurementPanel
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "bg-secondary text-foreground font-medium",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className={mainClassName}>{children}</main>
      </div>
    </div>
  );
}
