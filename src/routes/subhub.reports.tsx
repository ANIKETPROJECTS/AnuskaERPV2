import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn } from "@/production";
import type { ManagerProductionData } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/subhub/reports")({
  head: () => ({ meta: [{ title: "Hub Reports — SubHub · Float ERP" }] }),
  component: HubReports,
});

const emptyData: ManagerProductionData = {
  subhubName: "",
  orders: [],
  reports: [],
  capacityUnits: null,
  openUnits: 0,
  availableUnits: null,
  overloaded: false,
};

function HubReports() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await getManagerProductionDataFn();
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const target = data.orders.reduce((sum, order) => sum + order.target, 0);
  const produced = data.orders.reduce((sum, order) => sum + order.produced, 0);
  const completion = target ? Math.round((produced / target) * 100) : 0;

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SubHub / Hub Reports</p><h1 className="mt-2 text-xl font-semibold">Hub Reports</h1><p className="mt-1 text-sm text-muted-foreground">{data.subhubName || "Your workspace"} · reports from your own production and inventory activity.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-3"><Stat icon={<TrendingUp className="size-5" />} label="Assigned target" value={num(target)} helper={`${data.orders.length} orders`} /><Stat icon={<FileBarChart className="size-5" />} label="Produced" value={num(produced)} helper="from saved day reports" /><Stat icon={<TrendingUp className="size-5" />} label="Completion" value={`${completion}%`} helper="against your target" /></div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="panel"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Order performance</h2><p className="mt-1 text-sm text-muted-foreground">Only orders assigned to {data.subhubName || "this SubHub"}.</p></div>{loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading reports…</p> : data.orders.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No assigned orders yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Variant</th><th className="px-5 py-3 text-right font-medium">Target</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 text-right font-medium">Status</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-3"><p className="font-medium">{order.variantName}</p><p className="tabular text-xs text-muted-foreground">{order.orderNumber}</p></td><td className="tabular px-5 py-3 text-right">{num(order.target)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(order.produced)}</td><td className="px-5 py-3 text-right text-xs">{order.status}</td></tr>)}</tbody></table></div>}</div>
          <div className="panel"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Daily report history</h2><p className="mt-1 text-sm text-muted-foreground">Saved in this SubHub’s isolated MongoDB workspace.</p></div>{data.reports.length === 0 ? <div className="p-8 text-center"><FileBarChart className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No reports submitted yet</p><p className="mt-1 text-sm text-muted-foreground">Use Daily production to submit the day-end output.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 text-right font-medium">Units</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{data.reports.slice(0, 30).map((report) => <tr key={report.id} className="border-b border-border/70 last:border-0"><td className="tabular px-5 py-3">{report.date}</td><td className="px-5 py-3">{data.orders.find((order) => order.id === report.orderId)?.orderNumber ?? "Archived"}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(report.quantity)}</td><td className="max-w-[180px] truncate px-5 py-3 text-muted-foreground">{report.notes || "—"}</td></tr>)}</tbody></table></div>}</div>
        </div>
      </section>
    </SubHubShell>
  );
}

function Stat({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div><p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}