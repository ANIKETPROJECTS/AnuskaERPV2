import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowDownCircle, ArrowUpCircle, Check, Package, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { adjustSubhubInventoryFn, getSubhubInventoryFn } from "@/inventory";
import type { InventoryItem, InventoryMovement, SubhubInventoryData } from "@/inventory.server";
import { num } from "@/lib/erp-data";

export type View = "inventory" | "history" | "adjustment";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory Management — Float ERP" }] }),
  component: () => <InventoryManagement initialView="inventory" />,
});

const emptyData: SubhubInventoryData = { items: [], movements: [] };

export function InventoryManagement({ initialView }: { initialView: View }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const view: View = pathname.endsWith("/history") ? "history" : pathname.endsWith("/adjustment") ? "adjustment" : initialView;
  const [data, setData] = useState(emptyData);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const result = await getSubhubInventoryFn();
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

  const filteredItems = useMemo(() => data.items.filter((item) => `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [data.items, query]);
  const totalUnits = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const stockValue = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const lowStock = data.items.filter((item) => item.quantity <= 0).length;
  const title = view === "inventory" ? "Inventory" : view === "history" ? "Inventory History" : "Stock Adjustment";

  return (
    <SubHubShell actions={view === "inventory" ? <Link to="/inventory/adjustment" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><SlidersHorizontal className="size-4" /> Adjust stock</Link> : null}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4">
        <div><p className="mb-1 text-xs font-semibold text-muted-foreground">SubHub / Inventory Management</p><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">Workspace-scoped raw material inventory for this SubHub.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {view === "inventory" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Stock units" value={num(totalUnits)} hint="in this workspace" /><Kpi label="Inventory value" value={`₹${stockValue.toLocaleString("en-IN")}`} hint="based on raw-part rates" /><Kpi label="Raw parts tracked" value={String(data.items.length)} hint="Float master parts" /><Kpi label="No stock recorded" value={String(lowStock)} tone={lowStock ? "warn" : "good"} hint="requires an adjustment" /></div>
            <InventoryTable items={filteredItems} query={query} setQuery={setQuery} loading={loading} />
          </>
        ) : null}
        {view === "history" ? <HistoryTable movements={data.movements} loading={loading} /> : null}
        {view === "adjustment" ? <Adjustment onSaved={load} items={data.items} /> : null}
      </section>
    </SubHubShell>
  );
}

export function InventoryHistoryPage() {
  return <InventoryManagement initialView="history" />;
}

export function InventoryAdjustmentPage() {
  return <InventoryManagement initialView="adjustment" />;
}

function InventoryTable({ items, query, setQuery, loading }: { items: InventoryItem[]; query: string; setQuery: (value: string) => void; loading: boolean }) {
  return <Panel title="Inventory" description="Only records belonging to this SubHub workspace are shown." action={<Link to="/inventory/history" className="text-xs font-medium text-primary hover:underline">View movement history →</Link>}>
    <div className="border-b border-border p-4"><label className="relative block max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search raw materials" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm outline-none focus:border-primary" /></label></div>
    {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading workspace inventory…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Raw material</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 text-right font-medium">Batches</th><th className="px-5 py-3 text-right font-medium">Unit value</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-5 py-3 font-medium">{item.name}<span className="tabular ml-2 text-xs text-muted-foreground">{item.code}</span></td><td className="px-5 py-3 text-muted-foreground">{item.category}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(item.quantity)}</td><td className="tabular px-5 py-3 text-right">{item.batches}</td><td className="tabular px-5 py-3 text-right">₹{item.price}</td><td className="px-5 py-3"><Tag tone={item.quantity > 0 ? "good" : "warn"}>{item.quantity > 0 ? "Available" : "No stock"}</Tag></td></tr>)}</tbody></table>{!items.length ? <p className="p-8 text-center text-sm text-muted-foreground">No raw materials match this search.</p> : null}</div>}
  </Panel>;
}

function HistoryTable({ movements, loading }: { movements: InventoryMovement[]; loading: boolean }) {
  return <Panel title="Inventory History" description="Actual stock movements recorded by this SubHub Manager.">{loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading movement history…</p> : movements.length === 0 ? <div className="p-10 text-center"><Package className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No stock movements yet</p><p className="mt-1 text-sm text-muted-foreground">Saved adjustments will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Movement</th><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">Reason</th><th className="px-5 py-3 text-right font-medium">Change</th><th className="px-5 py-3 text-right font-medium">Balance</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{movement.date.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-3">{movement.change > 0 ? <ArrowUpCircle className="mr-2 inline size-4 text-success" /> : <ArrowDownCircle className="mr-2 inline size-4 text-destructive" />}{movement.type}</td><td className="px-5 py-3 font-medium">{movement.product}<span className="tabular ml-2 text-xs text-muted-foreground">{movement.code}</span></td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{movement.reason}</td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.change > 0 ? "text-success" : "text-destructive"}`}>{movement.change > 0 ? "+" : ""}{movement.change}</td><td className="tabular px-5 py-3 text-right">{num(movement.balance)}</td></tr>)}</tbody></table></div>}</Panel>;
}

function Adjustment({ onSaved, items }: { onSaved: () => Promise<void>; items: InventoryItem[] }) {
  const [code, setCode] = useState("");
  const [action, setAction] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Stock received");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const current = items.find((item) => item.code === code);

  async function save() {
    setError("");
    setMessage("");
    const parsedQuantity = Number(quantity);
    if (!code || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Select a raw material and enter a whole-number quantity.");
      return;
    }
    setSaving(true);
    const result = await adjustSubhubInventoryFn({ data: { code, action, quantity: parsedQuantity, reason, notes } });
    if (!result.ok) setError(result.message);
    else {
      setMessage("Stock adjustment saved.");
      setQuantity("");
      setNotes("");
      await onSaved();
    }
    setSaving(false);
  }

  return <Panel title="Stock adjustment" description="Add or remove stock inside this SubHub workspace and keep a traceable movement record."><div className="p-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Raw material<select value={code} onChange={(event) => setCode(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select raw material</option>{items.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label><label className="text-sm font-medium">Action<select value={action} onChange={(event) => setAction(event.target.value as "add" | "remove")} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="add">Add stock</option><option value="remove">Remove stock</option></select></label><label className="text-sm font-medium">Quantity<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" />{action === "remove" && current ? <span className="mt-1 block text-xs text-muted-foreground">Available: {num(current.quantity)}</span> : null}</label><label className="text-sm font-medium">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" /></label><label className="text-sm font-medium md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional receiving or consumption details…" className="mt-1.5 w-full resize-none rounded-md border border-input px-3 py-2 text-sm" /></label></div>{error ? <p role="alert" className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}<div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">{message ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> {message}</span> : null}<button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check className="size-4" /> {saving ? "Saving…" : "Save adjustment"}</button></div></div></Panel>;
}