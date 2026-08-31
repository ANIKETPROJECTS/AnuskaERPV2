import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, TrendingUp } from "lucide-react";
import { SubHubShell } from "@/components/erp/SubHubShell";

export const Route = createFileRoute("/subhub/reports")({
  head: () => ({ meta: [{ title: "Hub Reports — SubHub · Float ERP" }] }),
  component: HubReports,
});

function HubReports() {
  return (
    <SubHubShell>
      <header className="border-b border-border bg-card px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub / Hub Reports</p>
        <h1 className="mt-2 text-xl font-semibold">Hub Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational reporting across production, inventory, and hub performance.</p>
      </header>
      <section className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel p-5">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><TrendingUp className="size-5" /></div>
            <h2 className="mt-4 font-semibold">Production performance</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Compare daily output, targets, and completion by hub.</p>
            <span className="mt-5 inline-flex rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">Report builder coming next</span>
          </div>
          <div className="panel p-5">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><FileBarChart className="size-5" /></div>
            <h2 className="mt-4 font-semibold">Inventory movement</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Review stock coverage, adjustments, and movement trends.</p>
            <span className="mt-5 inline-flex rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">Report builder coming next</span>
          </div>
        </div>
        <div className="panel p-8 text-center">
          <FileBarChart className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">Your hub reports will appear here</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">The reporting foundation is ready. Detailed MongoDB-backed report builders will be added module by module.</p>
        </div>
      </section>
    </SubHubShell>
  );
}