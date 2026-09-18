import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Check, ClipboardCheck, Minus, Plus, RefreshCw, Save, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn, previewProductionBatchAllocationFn, saveDailyProductionFn, setHubCapacityFn } from "@/production";
import type { ManagerProductionData, ProductionOrder } from "@/production.server";
import type { ProductionAllocationPreview, ProductionManualAllocation } from "@/inventory.server";
import { num } from "@/lib/erp-data";
import { useAuth } from "@/components/auth/AuthContext";
import { demoProductionData } from "@/lib/production-demo";

export const Route = createFileRoute("/subhub/production")({
  head: () => ({ meta: [{ title: "Production — Hub Manager · SubHub" }] }),
  component: HubManagerProduction,
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function HubManagerProduction() {
  const { user } = useAuth();
  const [data, setData] = useState(emptyData);
  const [selectedDate, setSelectedDate] = useState(today());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [capacityInput, setCapacityInput] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [saved, setSaved] = useState(false);
  const [capacitySaved, setCapacitySaved] = useState(false);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [allocationPreviews, setAllocationPreviews] = useState<Record<string, ProductionAllocationPreview>>({});
  const [allocationQuantities, setAllocationQuantities] = useState<Record<string, number>>({});
  const [allocationLoading, setAllocationLoading] = useState<Record<string, boolean>>({});
  const [manualModes, setManualModes] = useState<Record<string, boolean>>({});
  const [manualRows, setManualRows] = useState<Record<string, ProductionManualAllocation[]>>({});

  async function load() {
    setLoading(true);
    const result = await getManagerProductionDataFn();
    if (result.ok) {
      setDemoMode(result.data.orders.length === 0);
      setData(result.data.orders.length ? result.data : demoProductionData);
      setCapacityInput(result.data.capacityUnits?.toString() ?? "");
      setError("");
    } else {
      setDemoMode(true);
      setData(demoProductionData);
      setError("");
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

  async function saveCapacity() {
    if (!user?.id) return;
    const rawValue = capacityInput.trim();
    const capacityUnits = rawValue ? Number(rawValue) : null;
    if (capacityUnits !== null && (!Number.isInteger(capacityUnits) || capacityUnits < 1)) {
      setError("Capacity must be a whole number greater than zero, or left blank for no limit.");
      return;
    }
    setSavingCapacity(true);
    setCapacitySaved(false);
    setError("");
    const result = await setHubCapacityFn({ data: { subhubUserId: user.id, capacityUnits } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setCapacitySaved(true);
      await load();
    }
    setSavingCapacity(false);
  }

  async function loadAllocation(order: ProductionOrder, quantityOverride?: number, applyEditableState = true) {
    const quantity = quantityOverride ?? quantities[order.id] ?? 0;
    setAllocationLoading((current) => ({ ...current, [order.id]: true }));
    const result = await previewProductionBatchAllocationFn({ data: { orderId: order.id, date: selectedDate, quantity } });
    if (result.ok) {
      setAllocationPreviews((current) => ({ ...current, [order.id]: result.preview }));
      setAllocationQuantities((current) => ({ ...current, [order.id]: quantity }));
      if (applyEditableState) {
        setManualRows((current) => ({ ...current, [order.id]: result.preview.manualAllocations }));
        setManualModes((current) => ({ ...current, [order.id]: result.preview.allocationMode === "hybrid" }));
      }
      setError("");
    } else setError(result.message);
    setAllocationLoading((current) => ({ ...current, [order.id]: false }));
  }

  useEffect(() => {
    if (demoMode || !data.orders.length) return;
    void Promise.all(data.orders.map((order) => loadAllocation(order, Math.max(0, order.remaining), false)));
  }, [data.orders, selectedDate, demoMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    data.orders.forEach((order) => {
      const stored = window.sessionStorage.getItem(allocationStorageKey(order.id, selectedDate));
      if (!stored) return;
      try {
        const value = JSON.parse(stored) as { manual?: boolean; rows?: ProductionManualAllocation[] };
        if (typeof value.manual === "boolean") setManualModes((current) => ({ ...current, [order.id]: value.manual ?? false }));
        if (Array.isArray(value.rows)) setManualRows((current) => ({ ...current, [order.id]: value.rows ?? [] }));
      } catch {
        window.sessionStorage.removeItem(allocationStorageKey(order.id, selectedDate));
      }
    });
  }, [data.orders, selectedDate]);

  const totalTarget = data.orders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = data.orders.reduce((sum, order) => sum + order.produced, 0);
  const todayProduced = data.orders.reduce((sum, order) => sum + (quantities[order.id] ?? 0), 0);
  const completion = totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0;

  function updateQuantity(orderId: string, value: number) {
    setSaved(false);
    setQuantities((current) => ({ ...current, [orderId]: Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0) }));
    const order = data.orders.find((item) => item.id === orderId);
    if (order) void loadAllocation(order, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0));
  }

  async function saveProduction() {
    if (demoMode || !data.orders.length) return;
    const invalid = data.orders.find((order) => manualModes[order.id] && !isManualValid(allocationPreviews[order.id], manualRows[order.id] ?? []));
    if (invalid) {
      setError(`Manual material allocation for ${invalid.variantName} must exactly match every BOM requirement.`);
      return;
    }
    setSaving(true);
    setError("");
    const results = await Promise.all(
      data.orders.map((order) =>
        saveDailyProductionFn({
          data: {
            orderId: order.id, date: selectedDate, quantity: quantities[order.id] ?? 0, notes,
            ...(manualModes[order.id] ? { manualAllocations: manualRows[order.id] ?? [] } : {}),
          },
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
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-primary" />
                <h2 className="font-semibold">Declare hub capacity</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Set the active target units this hub can handle. Admin will use this data for assignment and reassignment decisions.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <label className="text-sm font-medium">
                Capacity units
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={capacityInput}
                  onChange={(event) => { setCapacityInput(event.target.value); setCapacitySaved(false); }}
                  placeholder="No limit"
                  aria-label="Hub capacity units"
                  className="tabular mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary sm:w-44"
                />
              </label>
              <button type="button" disabled={savingCapacity} onClick={() => void saveCapacity()} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <Save className="size-4" /> {savingCapacity ? "Saving…" : "Save capacity"}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">Current load: <strong className="tabular text-foreground">{num(data.openUnits)}</strong> open units</span>
            <span className="text-muted-foreground">Declared: <strong className="tabular text-foreground">{data.capacityUnits === null ? "No limit" : num(data.capacityUnits)}</strong></span>
            {data.availableUnits !== null ? <span className={data.overloaded ? "font-medium text-destructive" : "text-success"}>{data.overloaded ? `${num(Math.abs(data.availableUnits))} units over capacity` : `${num(data.availableUnits)} units available`}</span> : null}
            {data.overloaded ? <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="size-3.5" /> Admin reassignment review needed</span> : null}
            {capacitySaved ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-4" /> Capacity shared with Admin</span> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Assigned target" value={num(totalTarget)} helper={`${data.orders.length} orders`} tone="text-foreground" />
          <Stat label="Produced to date" value={num(totalProduced)} helper="all stored reports" tone="text-primary" />
          <Stat label={`Entered ${selectedDate}`} value={num(todayProduced)} helper="output for this date" tone="text-success" />
          <Stat label="Completion" value={`${completion}%`} helper="against assigned target" tone={completion >= 100 ? "text-success" : "text-warning"} />
        </div>
        {demoMode ? <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"><strong>Demo data:</strong> No live orders are available yet. This sample order is only for testing the screens.</div> : null}

        <div className="flex justify-end">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh assignments</button>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Assigned orders for {selectedDate}</h2>
             <p className="mt-1 text-sm text-muted-foreground">Enter the finished quantity for each target. Material usage is calculated from the BOM recipe and consumed automatically when you save.</p>
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
                    {data.orders.map((order) => (
                      <ProductionRow
                        key={order.id}
                        order={order}
                        quantity={quantities[order.id] ?? 0}
                        selectedDate={selectedDate}
                        onChange={(value) => updateQuantity(order.id, value)}
                      />
                    ))}
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
              <button type="button" disabled={saving || demoMode} onClick={() => void saveProduction()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Save className="size-4" /> {demoMode ? "Demo mode" : saving ? "Saving…" : "Save day report"}</button>
            </div>
          </div>
        ) : null}

        <ReportsHistory reports={data.reports} orders={data.orders} />
      </section>
    </SubHubShell>
  );
}

function ProductionRow({
  order,
  quantity,
  selectedDate,
  onChange,
}: {
  order: ProductionOrder;
  quantity: number;
  selectedDate: string;
  onChange: (value: number) => void;
}) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.productName}</p>
        <a href={`/subhub/production/orders/${encodeURIComponent(order.id)}`} className="mt-1 block font-medium text-primary hover:underline">{order.variantName}</a>
        <p className="tabular text-xs text-muted-foreground">{order.orderNumber} · {order.variantCode}</p>
        <p className="mt-1 text-xs text-muted-foreground">Due {order.dueDate}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`/subhub/production/orders/${encodeURIComponent(order.id)}`} className="inline-flex items-center rounded-md border border-input bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-muted">Order details</a>
          <Link
            to="/subhub/production/allocation/$orderId"
            params={{ orderId: order.id }}
            search={{ date: selectedDate, quantity }}
            className="inline-flex items-center rounded-md border border-input bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Material allocation
          </Link>
        </div>
      </td>
      <td className="tabular px-5 py-4 text-right font-semibold">{num(order.target)}</td>
      <td className="px-5 py-4"><div className="mx-auto flex w-36 items-center justify-center gap-1"><button type="button" aria-label={`Decrease ${order.variantName}`} onClick={() => onChange(quantity - 1)} className="flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted"><Minus className="size-3.5" /></button><input type="number" min="0" step="1" value={quantity} onChange={(event) => onChange(Number(event.target.value))} className="h-8 w-20 rounded-md border border-input text-center text-sm font-semibold" /><button type="button" aria-label={`Increase ${order.variantName}`} onClick={() => onChange(quantity + 1)} className="flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted"><Plus className="size-3.5" /></button></div></td>
      <td className="tabular px-5 py-4 text-right">{num(order.produced)}</td>
      <td className="px-5 py-4 text-right"><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${order.status === "Complete" || order.status === "Over target" ? "bg-success/10 text-success" : order.status === "In progress" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>{order.status}</span></td>
    </tr>
  );
}

function isManualValid(preview: ProductionAllocationPreview | undefined, rows: ProductionManualAllocation[]) {
  if (!preview) return false;
  return preview.requirements.every((requirement) =>
    rows.filter((row) => row.itemCode === requirement.itemCode).reduce((sum, row) => sum + row.quantity, 0) === requirement.requiredQuantity,
  );
}

function allocationStorageKey(orderId: string, date: string) {
  return `subhub:production-allocation:${orderId}:${date}`;
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