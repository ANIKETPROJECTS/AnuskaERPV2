import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Check,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { bomCatalog, type BomCatalogProduct } from "@/lib/bom-catalog";
import { createProductionOrderFn, getAdminProductionDashboardFn, listAssignableSubhubsFn, setHubCapacityFn } from "@/production";
import type { AdminProductionDashboard, AssignableSubhub, ProductionOrder } from "@/production.server";
import { num } from "@/lib/erp-data";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders & Production Targets — Float ERP" },
      { name: "description", content: "Assign real production targets to SubHubs and track completed output by order." },
    ],
  }),
  component: Orders,
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(status: ProductionOrder["status"]): "good" | "warn" | "bad" | "neutral" {
  if (status === "Complete") return "good";
  if (status === "Over target") return "good";
  if (status === "In progress") return "warn";
  return "neutral";
}

function Orders() {
  const [dashboard, setDashboard] = useState<AdminProductionDashboard | null>(null);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [capacityInputs, setCapacityInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [capacityMessage, setCapacityMessage] = useState("");
  const [savingCapacity, setSavingCapacity] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [dashboardResult, subhubResult] = await Promise.all([getAdminProductionDashboardFn(), listAssignableSubhubsFn()]);
    if (dashboardResult.ok) {
      setDashboard(dashboardResult.data);
      setOrders(dashboardResult.data.orders);
      setCapacityInputs(Object.fromEntries(dashboardResult.data.hubs.map((hub) => [hub.userId, hub.capacityUnits?.toString() ?? ""])));
    } else setError(dashboardResult.message);
    if (subhubResult.ok) setSubhubs(subhubResult.subhubs);
    else setError(subhubResult.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalTarget = orders.reduce((sum, order) => sum + order.target, 0);
  const totalProduced = orders.reduce((sum, order) => sum + order.produced, 0);
  const totalRemaining = orders.reduce((sum, order) => sum + order.remaining, 0);
  const completion = totalTarget ? Math.round((totalProduced / totalTarget) * 100) : 0;

  async function saveCapacity(subhubUserId: string) {
    setSavingCapacity(subhubUserId);
    setCapacityMessage("");
    setError("");
    const rawValue = capacityInputs[subhubUserId]?.trim() ?? "";
    const capacityUnits = rawValue ? Number(rawValue) : null;
    const result = await setHubCapacityFn({ data: { subhubUserId, capacityUnits } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setCapacityMessage(
        result.reassignments.length
          ? `${result.reassignments.length} order${result.reassignments.length === 1 ? "" : "s"} reassigned to protect hub capacity.`
          : "Hub capacity saved.",
      );
      await load();
    }
    setSavingCapacity("");
  }

  async function saveOrder(input: { subhubUserId: string; productCode: string; variantCode: string; target: number; dueDate: string; notes: string }) {
    const result = await createProductionOrderFn({ data: input });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOrders((current) => [result.order, ...current]);
    setShowForm(false);
    setError("");
  }

  return (
    <Shell
      title="Orders & Production Targets"
      subtitle="Set hub capacity, assign work, and analyze manager-entered production"
      actions={
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
            <RefreshCw className="size-4" /> Refresh
          </button>
          <button type="button" onClick={() => { setError(""); setShowForm(true); }} className="rule-header inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
            <Plus className="size-4" /> Assign target
          </button>
        </div>
      }
    >
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Assigned target" value={num(totalTarget)} hint={`${orders.length} live orders`} />
          <Kpi label="Produced" value={num(totalProduced)} tone="good" hint="manager-entered output" />
          <Kpi label="Remaining" value={num(totalRemaining)} tone="warn" hint="across assigned orders" />
          <Kpi label="Completion" value={`${completion}%`} tone={completion >= 100 ? "good" : "neutral"} hint="all SubHubs combined" />
        </div>

        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {capacityMessage ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{capacityMessage}</p> : null}

        <Panel title="Hub capacity & workload" description="Admin sets each hub’s active target capacity. Overloaded orders move to another eligible hub with available capacity. Leave blank for no limit.">
          <div className="divide-y divide-border">
            {loading && !dashboard ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading hub capacity…</p>
            ) : dashboard?.hubs.length ? (
              dashboard.hubs.map((hub) => (
                <HubCapacityRow
                  key={hub.userId}
                  hub={hub}
                  value={capacityInputs[hub.userId] ?? ""}
                  saving={savingCapacity === hub.userId}
                  onChange={(value) => setCapacityInputs((current) => ({ ...current, [hub.userId]: value }))}
                  onSave={() => void saveCapacity(hub.userId)}
                />
              ))
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">Create an active SubHub Manager to define capacity.</p>
            )}
          </div>
        </Panel>

        {dashboard ? <ProductionCharts dashboard={dashboard} /> : null}

        {dashboard?.recentReassignments.length ? (
          <Panel title="Recent automatic reassignments" description="Orders moved when their previous hub exceeded its configured active target capacity.">
            <div className="divide-y divide-border">
              {dashboard.recentReassignments.map((reassignment, index) => (
                <div key={`${reassignment.orderNumber}-${reassignment.createdAt}-${index}`} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">{reassignment.orderNumber} · {reassignment.variantName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{reassignment.productName}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Tag tone="warn">{reassignment.fromHub}</Tag>
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Tag tone="good">{reassignment.toHub}</Tag>
                  </div>
                  <time className="text-xs text-muted-foreground">{reassignment.createdAt.slice(0, 10)}</time>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Assigned production orders" description="Each order belongs to one SubHub and can be reported against day by day.">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Loading live orders…</p>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No production targets assigned yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Assign the first order to a SubHub Manager to start collecting daily output.</p>
              <button type="button" onClick={() => setShowForm(true)} className="rule-header mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium">
                <Plus className="size-4" /> Assign target
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order / SubHub</th>
                    <th className="px-5 py-3 font-medium">Product variant</th>
                    <th className="px-5 py-3 text-right font-medium">Target</th>
                    <th className="px-5 py-3 text-right font-medium">Produced</th>
                    <th className="px-5 py-3 text-right font-medium">Due date</th>
                    <th className="px-5 py-3 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-4">
                        <p className="tabular font-semibold">{order.orderNumber}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{order.subhubName}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{order.productName}</p>
                        <p className="mt-1 font-medium">{order.variantName}</p>
                        <p className="tabular text-xs text-muted-foreground">{order.variantCode}</p>
                      </td>
                      <td className="tabular px-5 py-4 text-right font-semibold">{num(order.target)}</td>
                      <td className="tabular px-5 py-4 text-right">{num(order.produced)}</td>
                      <td className="tabular px-5 py-4 text-right text-muted-foreground">{order.dueDate}</td>
                      <td className="px-5 py-4 text-right"><Tag tone={statusTone(order.status)}>{order.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {showForm ? <AssignTargetForm subhubs={subhubs} onClose={() => setShowForm(false)} onSave={saveOrder} /> : null}
    </Shell>
  );
}

function HubCapacityRow({
  hub,
  value,
  saving,
  onChange,
  onSave,
}: {
  hub: AdminProductionDashboard["hubs"][number];
  value: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  const capacityLabel = hub.capacityUnits === null ? "No limit" : num(hub.capacityUnits);
  const loadLabel = hub.capacityUnits === null
    ? `${num(hub.openUnits)} open units`
    : `${num(hub.openUnits)} / ${num(hub.capacityUnits)} units`;
  const status = hub.overloaded ? "Overloaded" : hub.capacityUnits === null ? "Unrestricted" : "Within capacity";
  const statusTone = hub.overloaded ? "bad" : hub.capacityUnits === null ? "neutral" : "good";

  return (
    <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-52 flex-1">
        <p className="font-medium">{hub.subhubName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hub.name} · {hub.orderCount} active order{hub.orderCount === 1 ? "" : "s"}</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current load</p>
          <p className="tabular mt-1 font-semibold">{loadLabel}</p>
        </div>
        <Tag tone={statusTone}>{status}</Tag>
      </div>
      <label className="w-full text-sm lg:w-56">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacity units</span>
        <input
          type="number"
          min="1"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="No limit"
          aria-label={`Capacity units for ${hub.subhubName}`}
          className="tabular mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <Settings2 className="size-4" />
        {saving ? "Saving…" : "Save capacity"}
      </button>
      <span className="sr-only">Configured capacity: {capacityLabel}</span>
    </div>
  );
}

const chartColors = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#db2777", "#65a30d", "#c2410c"];

function ProductionCharts({ dashboard }: { dashboard: AdminProductionDashboard }) {
  const chartStyle = {
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: "var(--color-card)",
    fontSize: 12,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Daily production by hub" description="Finished units reported by each SubHub for every production day.">
        {dashboard.dailyProduction.length === 0 ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No daily production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.dailyProduction} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {dashboard.chartHubs.map((hub, index) => (
                  <Bar
                    key={hub.key}
                    dataKey={hub.key}
                    name={hub.subhubName}
                    stackId="production"
                    fill={chartColors[index % chartColors.length]}
                    {...(index === dashboard.chartHubs.length - 1 ? { radius: [4, 4, 0, 0] as [number, number, number, number] } : {})}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel title="Weekly production trend by hub" description="Compare output trends across all hubs, grouped Monday through Sunday.">
        {dashboard.weeklyProduction.length === 0 ? (
          <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No weekly production reports are available yet.
          </div>
        ) : (
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard.weeklyProduction} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {dashboard.chartHubs.map((hub, index) => (
                  <Line
                    key={hub.key}
                    type="monotone"
                    dataKey={hub.key}
                    name={hub.subhubName}
                    stroke={chartColors[index % chartColors.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}

function AssignTargetForm({
  subhubs,
  onClose,
  onSave,
}: {
  subhubs: AssignableSubhub[];
  onClose: () => void;
  onSave: (input: { subhubUserId: string; productCode: string; variantCode: string; target: number; dueDate: string; notes: string }) => Promise<void>;
}) {
  const [subhubUserId, setSubhubUserId] = useState(subhubs[0]?.id ?? "");
  const [productCode, setProductCode] = useState(bomCatalog[0]?.code ?? "");
  const [variantCode, setVariantCode] = useState(bomCatalog[0]?.variants[0]?.code ?? "");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedProduct = bomCatalog.find((product) => product.code === productCode);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedTarget = Number(target);
    if (!subhubUserId) {
      setError("Create an active SubHub Manager before assigning an order.");
      return;
    }
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1) {
      setError("Enter a whole-number target greater than zero.");
      return;
    }
    const product = bomCatalog.find((item) => item.code === productCode);
    if (!product || !product.variants.some((variant) => variant.code === variantCode)) {
      setError("Select a Float type and variant before assigning the target.");
      return;
    }
    setSaving(true);
    await onSave({ subhubUserId, productCode, variantCode, target: parsedTarget, dueDate, notes });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="assign-target-title">
      <form onSubmit={submit} className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Admin</p>
            <h2 id="assign-target-title" className="mt-2 text-xl font-semibold">Assign production target</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">This target will appear in the selected SubHub Manager’s daily production module. Choose from the complete Float variant catalog below.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="size-5" /></button>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">SubHub / factory
            <select required value={subhubUserId} onChange={(event) => setSubhubUserId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
              <option value="">Select SubHub</option>
              {subhubs.map((subhub) => <option key={subhub.id} value={subhub.id}>{subhub.subhubName} · {subhub.name}</option>)}
            </select>
          </label>
          <FloatTypePicker productCode={productCode} onChange={(nextProductCode) => {
            const nextProduct = bomCatalog.find((product) => product.code === nextProductCode);
            setProductCode(nextProductCode);
            setVariantCode(nextProduct?.variants[0]?.code ?? "");
          }} />
          {selectedProduct ? <FloatVariantPicker product={selectedProduct} variantCode={variantCode} onChange={setVariantCode} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Target quantity
              <input required type="number" min="1" step="1" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="1000" className="tabular mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium">Due date
              <span className="relative mt-1.5 block"><CalendarRange className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="tabular h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></span>
            </label>
          </div>
          <label className="block text-sm font-medium">Instructions <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add shift or delivery instructions…" className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving || !subhubs.length} className="rule-header rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Assigning…" : "Assign target"}</button>
        </div>
      </form>
    </div>
  );
}

function FloatTypePicker({ productCode, onChange }: { productCode: string; onChange: (code: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">1. Float type</span>
        <span className="text-xs text-muted-foreground">{bomCatalog.length} types</span>
      </div>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-4">
        {bomCatalog.map((product) => {
          const selected = product.code === productCode;
          return (
            <button
              key={product.code}
              type="button"
              onClick={() => onChange(product.code)}
              className={`rounded-md border px-3 py-3 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-input hover:border-primary/50 hover:bg-muted/50"}`}
            >
              <span className="block text-sm font-semibold">{product.name}</span>
              <span className="tabular mt-1 block text-xs text-muted-foreground">{product.code} · {product.variants.length} variants</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FloatVariantPicker({ product, variantCode, onChange }: { product: BomCatalogProduct; variantCode: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState("");
  const filteredVariants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return product.variants;
    return product.variants.filter((variant) => `${variant.name} ${variant.company} ${variant.code}`.toLowerCase().includes(normalizedQuery));
  }, [product, query]);
  const selectedVariant = product.variants.find((variant) => variant.code === variantCode);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="float-variant-search" className="block text-sm font-medium">2. Variant for {product.name}</label>
        <span className="text-xs text-muted-foreground">{filteredVariants.length} of {product.variants.length} variants</span>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-lg border border-input bg-background">
        <div className="relative border-b border-border bg-muted/20">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="float-variant-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${product.name} variants, companies, or codes…`}
            className="h-11 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div role="listbox" aria-label="Float variants" className="grid max-h-72 gap-1 overflow-y-auto p-2 sm:grid-cols-2">
          {filteredVariants.map((variant) => {
            const selected = variant.code === variantCode;
            return (
              <button
                key={`${product.code}-${variant.code}`}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(variant.code)}
                className={`flex min-h-16 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors ${selected ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/60"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{variant.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{variant.company} · {variant.code}</span>
                </span>
                {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
          {!filteredVariants.length ? <p className="col-span-full px-3 py-8 text-center text-sm text-muted-foreground">No {product.name} variants match “{query}”.</p> : null}
        </div>
      </div>
      {selectedVariant ? <p className="mt-2 text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{selectedVariant.name}</span> · {selectedVariant.code}</p> : null}
    </div>
  );
}