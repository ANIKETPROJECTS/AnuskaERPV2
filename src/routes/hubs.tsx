import { createFileRoute } from "@tanstack/react-router";
import { MapPin, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { getAdminProductionDashboardFn } from "@/production";
import type { AdminProductionDashboard, HubSummary } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/hubs")({
  head: () => ({
    meta: [
      { title: "Hubs & Stock — Float ERP" },
      { name: "description", content: "Live SubHub targets, daily production reports, completion, and status." },
    ],
  }),
  component: Hubs,
});

const emptyDashboard: AdminProductionDashboard = {
  hubs: [],
  orders: [],
  totalTarget: 0,
  totalProduced: 0,
  totalRemaining: 0,
  completion: 0,
  reportsToday: 0,
  latestReportDate: null,
};

function toneFor(status: HubSummary["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "Complete") return "good";
  if (status === "Over target") return "good";
  if (status === "In progress") return "warn";
  if (status === "Awaiting update") return "bad";
  return "neutral";
}

function Hubs() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await getAdminProductionDashboardFn();
    if (result.ok) {
      setDashboard(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Shell
      title="Hubs & Stock"
      subtitle="Live SubHub performance from assigned targets and manager-entered daily production"
      actions={
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
          <RefreshCw className="size-4" /> Refresh live data
        </button>
      }
    >
      <div className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Assigned target" value={num(dashboard.totalTarget)} hint={`${dashboard.orders.length} orders across ${dashboard.hubs.length} SubHubs`} />
          <Kpi label="Produced" value={num(dashboard.totalProduced)} tone="good" hint="from stored daily reports" />
          <Kpi label="Remaining" value={num(dashboard.totalRemaining)} tone="warn" hint="assigned units still open" />
          <Kpi label="Completion" value={`${dashboard.completion}%`} tone={dashboard.completion >= 100 ? "good" : "neutral"} hint={`${dashboard.reportsToday} reports today`} />
        </div>

        <Panel title="Hub performance" description="Every row is a managed SubHub; no shared or seeded hub totals are shown.">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading live hub data…</p>
          ) : dashboard.hubs.length === 0 ? (
            <div className="p-10 text-center">
              <MapPin className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No active SubHub Managers yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a SubHub Manager and assign an order to start seeing hub performance here.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.hubs.map((hub) => (
                <article key={hub.userId} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {hub.subhubName}</p>
                      <h2 className="mt-1 truncate font-semibold">{hub.name}</h2>
                    </div>
                    <Tag tone={toneFor(hub.status)}>{hub.status}</Tag>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                    <Metric label="Target" value={num(hub.target)} />
                    <Metric label="Produced" value={num(hub.produced)} />
                    <Metric label="Reports" value={num(hub.reportCount)} />
                    <Metric label="Stock units" value={num(hub.stockUnits)} />
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{hub.orderCount} assigned {hub.orderCount === 1 ? "order" : "orders"}</span>
                      <span className="tabular font-semibold text-foreground">{hub.completion}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted">
                      <div className={`h-2 rounded-full ${hub.completion >= 100 ? "bg-success" : hub.completion > 0 ? "bg-primary" : "bg-muted-foreground/30"}`} style={{ width: `${Math.min(100, hub.completion)}%` }} />
                    </div>
                  </div>
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    Last report: <span className="font-medium text-foreground">{hub.lastProductionDate ?? "No report submitted"}</span>
                    <span className="mx-1">·</span>
                    Stock value: <span className="font-medium text-foreground">₹{hub.stockValue.toLocaleString("en-IN")}</span>
                  </p>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Assigned output by order" description="Production totals below are calculated from reports stored in each SubHub workspace.">
          {dashboard.orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No assigned orders to report yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">SubHub</th>
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-5 py-3 font-medium">Variant</th>
                    <th className="px-5 py-3 text-right font-medium">Target</th>
                    <th className="px-5 py-3 text-right font-medium">Produced</th>
                    <th className="px-5 py-3 text-right font-medium">Remaining</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.orders.map((order) => (
                    <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">{order.subhubName}</td>
                      <td className="tabular px-5 py-3 font-medium">{order.orderNumber}</td>
                      <td className="px-5 py-3"><span className="font-medium">{order.variantName}</span><span className="tabular ml-2 text-xs text-muted-foreground">{order.variantCode}</span></td>
                      <td className="tabular px-5 py-3 text-right">{num(order.target)}</td>
                      <td className="tabular px-5 py-3 text-right font-semibold">{num(order.produced)}</td>
                      <td className="tabular px-5 py-3 text-right">{num(order.remaining)}</td>
                      <td className="px-5 py-3 text-right"><Tag tone={order.status === "Complete" || order.status === "Over target" ? "good" : order.status === "In progress" ? "warn" : "neutral"}>{order.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Stock source</p>
          <p className="mt-1">Stock units and value on each hub card come from inventory movements saved in that SubHub’s workspace. Order rows show production output; stock is summarized at the hub level.</p>
        </div>
      </div>
    </Shell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground">{label}</p><p className="tabular mt-1 text-sm font-semibold">{value}</p></div>;
}