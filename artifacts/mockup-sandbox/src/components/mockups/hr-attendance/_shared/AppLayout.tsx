import type { ReactNode } from "react";
import { CalendarDays, ClipboardList, Database, Factory, LayoutDashboard, ShieldAlert, Truck, Users, UserRoundCog, Layers, UserCog } from "lucide-react";
import "../_group.css";

const modules = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Bill of Materials", icon: Layers },
  { label: "Raw Materials", icon: Database },
  { label: "Orders & Targets", icon: ClipboardList },
  { label: "Hubs & Stock", icon: Factory },
  { label: "Shortages", icon: ShieldAlert },
  { label: "Procurement", icon: Truck },
  { label: "Production & Workforce", icon: Users },
  { label: "User Management", icon: UserCog },
  { label: "HR & Attendance", icon: UserRoundCog },
  { label: "Quality Management", icon: ShieldAlert },
];

export function AppLayout({
  title,
  subtitle,
  activePage,
  children,
}: {
  title: string;
  subtitle: string;
  activePage: "current" | "attendance" | "reports";
  children: ReactNode;
}) {
  return (
    <div className="hr-attendance-preview flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-[65px] items-center gap-3 border-b border-border px-4">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">G</div>
          <div className="leading-tight">
            <p className="font-semibold">Gadsons</p>
            <p className="text-xs text-muted-foreground">Water Purifier Parts ERP</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Modules</p>
          {modules.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs ${
                label === "HR & Attendance" ? "bg-sidebar-accent font-semibold text-sidebar-primary" : "text-sidebar-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </nav>
        <div className="border-y border-border bg-primary px-3 py-2.5 text-white">
          <p className="text-sm font-semibold">01:04:13 am</p>
          <p className="text-[10px] opacity-80">Sunday, 27 September 2026</p>
        </div>
        <div className="flex items-center gap-2 border-t border-border p-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">AR</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold">Aniket Rane</p>
            <p className="text-[10px] text-muted-foreground">Master Admin · Secure Session</p>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-5 py-3 backdrop-blur">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {activePage !== "current" ? (
            <nav className="mt-3 flex gap-1 border-t border-border pt-2" aria-label="HR & Attendance pages">
              <span className={`rounded-md px-3 py-1.5 text-xs font-medium ${activePage === "attendance" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>Attendance</span>
              <span className={`rounded-md px-3 py-1.5 text-xs font-medium ${activePage === "reports" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>Reports</span>
            </nav>
          ) : null}
        </header>
        <main className="min-w-0 flex-1 p-5">{children}</main>
        <footer className="border-t border-border px-5 py-2 text-[10px] text-muted-foreground">Prototype UI · sample headcount data</footer>
      </div>
    </div>
  );
}