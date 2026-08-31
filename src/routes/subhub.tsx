import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, ClipboardCheck, FileBarChart, PackageOpen, UserRoundCog } from "lucide-react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { canAccess, useAuth } from "@/components/auth/AuthContext";

export const Route = createFileRoute("/subhub")({
  head: () => ({
    meta: [
      { title: "SubHub Panel — Gadsons ERP" },
      { name: "description", content: "SubHub workspace for hub operations, inventory, and reports." },
    ],
  }),
  component: SubHub,
});

function SubHub() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/subhub") {
    return <Outlet />;
  }

  return (
    <SubHubShell>
      <header className="border-b border-border bg-card px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub Panel</p>
        <h1 className="mt-2 text-xl font-semibold">Hub Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage stock, hub activity, and operational reporting from one workspace.</p>
      </header>
      <SubHubOverview />
    </SubHubShell>
  );
}

function SubHubOverview() {
  const { user } = useAuth();
  const cards = [
    {
      permission: "inventory",
      to: "/inventory",
      icon: PackageOpen,
      label: "Inventory Management",
      description: "Track current stock, batches, adjustments, and inventory value.",
       detail: "Workspace-scoped stock records",
    },
    {
      permission: "hub-manager",
      to: "/subhub/production",
      icon: ClipboardCheck,
      label: "Hub Manager",
      description: "Record daily production output and manage hub-level targets.",
       detail: "Orders assigned by Admin",
    },
    {
      permission: "hub-reports",
      to: "/subhub/reports",
      icon: FileBarChart,
      label: "Hub Reports",
      description: "Review production performance and inventory movement reports.",
       detail: "Saved daily reports",
    },
    {
      permission: "hr",
      to: "/subhub/hr",
      icon: UserRoundCog,
      label: "HR & Attendance",
      description: "Mark daily attendance, manage shifts, and prepare monthly payroll reports.",
      detail: "Simple daily status entry",
    },
  ];

  const visibleCards = cards.filter((card) => canAccess(user, card.permission));

  return (
    <section className="space-y-6 p-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {visibleCards.map((card) => (
          <Link key={card.to} to={card.to} className="panel group p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
            <div className="flex items-start justify-between">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <card.icon className="size-5" />
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
            </div>
            <h2 className="mt-5 font-semibold">{card.label}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
            <p className="mt-5 border-t border-border pt-3 text-xs font-medium text-primary">{card.detail}</p>
          </Link>
        ))}
      </div>
      {!visibleCards.length ? (
        <div className="panel p-10 text-center">
          <h2 className="font-semibold">No sections assigned</h2>
          <p className="mt-2 text-sm text-muted-foreground">Contact the Master Admin to request SubHub access.</p>
        </div>
      ) : null}
      <div className="panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace boundary</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This SubHub account is connected to its own isolated workspace. Admin master data such as Bills of Materials and Raw Materials is managed separately.
        </p>
      </div>
    </section>
  );
}