import {
  AlertTriangle,
  ClipboardList,
  Database,
  Factory,
  LayoutDashboard,
  Layers,
  ShieldAlert,
  Truck,
  UserCog,
  UserRoundCog,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const modules = [
  { label: "Dashboard", Icon: LayoutDashboard },
  { label: "Bill of Materials", Icon: Layers },
  { label: "Raw Materials", Icon: Database },
  { label: "Orders & Targets", Icon: ClipboardList },
  { label: "Hubs & Stock", Icon: Factory },
  { label: "Shortages", Icon: AlertTriangle, active: true },
  { label: "Procurement", Icon: Truck },
  { label: "Production & Workforce", Icon: Users },
  { label: "User Management", Icon: UserCog },
  { label: "HR & Attendance", Icon: UserRoundCog },
  { label: "Quality Management", Icon: ShieldAlert },
];

export function PreviewShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="shortages-preview flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-[65px] shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Factory className="size-6" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold">Gadsons</p>
            <p className="text-sm text-muted-foreground">Water Purifier Parts ERP</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin modules">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modules
          </p>
          {modules.map(({ label, Icon, active }) => (
            <div
              key={label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-base leading-snug ${
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-primary"
                  : "text-sidebar-foreground"
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {label}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="text-base font-medium">Master Admin</p>
          <p className="text-sm text-muted-foreground">Secure session</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 min-h-[65px] border-b border-border bg-background/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center gap-4 px-6 py-2">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {actions}
          </div>
        </header>
        <main className="min-w-0 flex-1 space-y-5 p-6">{children}</main>
      </div>
    </div>
  );
}
