import { createFileRoute } from "@tanstack/react-router";
import { Check, ClipboardCheck, Minus, Plus, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn, saveDailyProductionFn } from "@/production";
import type { ManagerProductionData, ProductionOrder } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/subhub/production")({
  head: () => ({ meta: [{ title: "Production — Hub Manager · SubHub" }] }),
  component: HubManagerProduction,
});

const emptyData: ManagerProductionData = { subhubName: "", orders: [], reports: [] };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function HubManagerProduction() {
  const [data, setData] = useState(emptyData);
  const [selectedDate, setSelectedDate] = useState(today());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

  const reportsForDate = useMemo(
    () => data.reports.filter((report) => report.date === selectedDate),
    [data.reports, selectedDate],
  );

  useEffect(() => {
    const nextQuantities: Record<string, number> = {};
    reportsForDate.forEach((report) => {
      nextQuantities[report.orderId] = report.quantity;
    });
    setQuantities(nextQuantities);
    setNotes(reportsForDate.find((report) => report.notes)?.notes ?? "");
    setSaved(false);
  }, [reportsForDate]);

  const totalTarget = data.orders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = data.orders.reduce((sum, order) => sum + order.produced, 0);
  const todayProduced = data.orders.reduce((sum, order) => sum + (quantities[order.id] ?? 0), 0);
  const completion = totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0;

  function updateQuantity(orderId: string, value: number) {
    setSaved(false);
    setQuantities((current) => ({ ...current, [orderId]: Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0) }));
  }

  async function saveProduction() {
    if (!data.orders.length) return;
    setSaving(true);
    setError("");
    const results = await Promise.all(
      data.orders.map((order) =>
        saveDailyProductionFn({
          data: { orderId: order.id, date: selectedDate, quantity: quantities[order.id] ?? 0, notes },
        }),
      ),
    );
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) {
      setError(failed.message);
    } else {
      setSaved(true);
      await load();
    }
    setSaving(false);
  }

  return (
    <SubHubShell>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">SubHub / Hub Manager</p>
            <h1 className="text-xl font-semibold">Daily production</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.subhubName || "Your isolated workspace"} · enter output for assigned orders only</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Production date
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-9 rounded-md border border-input bg-white px-3 text-sm text-foreground" />
        </label>
      </header>

      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Assigned target" value={num(totalTarget)} helper={`${data.orders.length} orders`} tone="text-foreground" />
          <Stat label="Produced to date" value={num(totalProduced)} helper="all stored reports" tone="text-primary" />
          <Stat label={`Entered ${selectedDate}`} value={num(todayProduced)} helper="output for this date" tone="text-success" />
          <Stat label="Completion" value={`${completion}%`} helper="against assigned target" tone={completion >= 100 ? "text-success" : "text-warning"} />
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh assignments</button>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Assigned orders for {selectedDate}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter the finished quantity for each target. Saving again on the same date updates that day’s report.</p>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading assignments…</p>
          ) : data.orders.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No orders assigned to this SubHub</p>
              <p className="mt-1 text-sm text-muted-foreground">The Master Admin will assign production targets here when work is ready.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-medium">Order / product</th><th className="px-5 py-3 text-right font-medium">Target</th><th className="px-5 py-3 text-center font-medium">Produced on date</th><th className="px-5 py-3 text-right font-medium">Total to date</th><th className="px-5 py-3 text-right font-medium">Status</th></tr>
                </thead>
                <tbody>
                  {data.orders.map((order) => <ProductionRow key={order.id} order={order} quantity={quantities[order.id] ?? 0} onChange={(value) => updateQuantity(order.id, value)} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {data.orders.length ? (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <label className="block text-sm font-medium">Day-end notes <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} rows={3} placeholder="Shift notes, downtime, quality observations, or other details…" className="mt-2 w-full resize-none rounded-md border border-input px-3 py-2 text-sm outline-none focus:border-primary" />
            </label>
            <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-4">
              {saved ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> Production saved to {data.subhubName}</span> : null}
              <button type="button" disabled={saving} onClick={() => void saveProduction()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Save className="size-4" /> {saving ? "Saving…" : "Save day report"}</button>
            </div>
          </div>
        ) : null}

        <ReportsHistory reports={data.reports} orders={data.orders} />
      </section>
    </SubHubShell>
  );
}

function ProductionRow({ order, quantity, onChange }: { order: ProductionOrder; quantity: number; onChange: (value: number) => void }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.productName}</p><p className="mt-1 font-medium">{order.variantName}</p><p className="tabular text-xs text-muted-foreground">{order.orderNumber} · {order.variantCode}</p><p className="mt-1 text-xs text-muted-foreground">Due {order.dueDate}</p></td>
      <td className="tabular px-5 py-4 text-right font-semibold">{num(order.target)}</td>
      <td className="px-5 py-4"><div className="mx-auto flex w-36 items-center justify-center gap-1"><button type="button" aria-label={`Decrease ${order.variantName}`} onClick={() => onChange(quantity - 1)} className="flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted"><Minus className="size-3.5" /></button><input type="number" min="0" step="1" value={quantity} onChange={(event) => onChange(Number(event.target.value))} className="h-8 w-20 rounded-md border border-input text-center text-sm font-semibold" /><button type="button" aria-label={`Increase ${order.variantName}`} onClick={() => onChange(quantity + 1)} className="flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted"><Plus className="size-3.5" /></button></div></td>
      <td className="tabular px-5 py-4 text-right">{num(order.produced)}</td>
      <td className="px-5 py-4 text-right"><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${order.status === "Complete" || order.status === "Over target" ? "bg-success/10 text-success" : order.status === "In progress" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{order.status}</span></td>
    </tr>
  );
}

function ReportsHistory({ reports, orders }: { reports: ManagerProductionData["reports"]; orders: ProductionOrder[] }) {
  const orderNames = new Map(orders.map((order) => [order.id, order]));
  return (
    <div className="rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Saved day reports</h2><p className="mt-1 text-sm text-muted-foreground">Reports are stored inside this SubHub workspace.</p></div>
      {reports.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No day reports saved yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Order</th><th className="px-5 py-3 text-right font-medium">Produced</th><th className="px-5 py-3 font-medium">Notes</th><th className="px-5 py-3 text-right font-medium">Updated</th></tr></thead><tbody>{reports.slice(0, 30).map((report) => <tr key={report.id} className="border-b border-border/70 last:border-0"><td className="tabular px-5 py-3">{report.date}</td><td className="px-5 py-3">{orderNames.get(report.orderId)?.variantName ?? "Archived order"}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(report.quantity)}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{report.notes || "—"}</td><td className="tabular px-5 py-3 text-right text-xs text-muted-foreground">{report.updatedAt.slice(0, 10)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}

function Stat({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: string }) {
  return <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>;
}