import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ClipboardCheck,
  ClipboardList,
  Database,
  Layers,
  PackageOpen,
  ShoppingCart,
  UserRoundCog,
} from "lucide-react";
import type { ReactNode } from "react";
import { logoutFn } from "@/auth";
import { canAccess, useAuth } from "@/components/auth/AuthContext";
import factoryIcon from "../../../attached_assets/factory_1790353346567.png";
import { SignOutButton } from "./SignOutButton";
import { SidebarDateTime } from "./SidebarDateTime";

const subhubNav = [
  { to: "/inventory", label: "Inventory Management", permission: "inventory", icon: PackageOpen },
  {
    to: "/subhub/production",
    label: "Hub Manager",
    permission: "hub-manager",
    icon: ClipboardCheck,
  },
  {
    to: "/subhub/request-items",
    label: "Request items",
    permission: "item-requests",
    icon: ClipboardList,
  },
  { to: "/subhub/hr", label: "HR & Attendance", permission: "hr", icon: UserRoundCog },
  { to: "/procurement", label: "Procurement", permission: "procurement", icon: ShoppingCart },
  { to: "/subhub/bom", label: "Bill of Materials", permission: "bom", icon: Layers },
  {
    to: "/subhub/raw-materials",
    label: "Raw Materials",
    permission: "raw-materials",
    icon: Database,
  },
] as const;

export function SubHubShell({
  headerTitle,
  title,
  subtitle,
  actions,
  children,
}: {
  headerTitle?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const router = useRouter();
  const { user } = useAuth();
  const initials =
    user?.name
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
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 self-start flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar">
        <div className="flex h-[65px] shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={factoryIcon}
              alt="Gadsons"
              className="size-10 shrink-0 rounded-md bg-white p-1 object-contain"
            />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-semibold">SubHub Panel</p>
              <p className="truncate text-sm text-muted-foreground">
                {user?.subhubName ?? "Float ERP workspace"}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="SubHub navigation">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modules
          </p>
          {visibleNav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                search={item.permission === "procurement" ? { panel: "subhub" } : undefined}
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
            </div>
            <SignOutButton panel="SubHub" onConfirm={signOut} />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[65px] flex-wrap items-center justify-between gap-3 border-b border-border bg-background/85 px-6 py-2.5 backdrop-blur">
          {headerTitle ? (
            <h1 className="min-w-0 text-lg font-semibold leading-tight">{headerTitle}</h1>
          ) : null}
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
