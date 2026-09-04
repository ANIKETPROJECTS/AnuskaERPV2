import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowDownCircle, ArrowUpAZ, ArrowUpCircle, Check, Package, Plus, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { TablePagination } from "@/components/erp/TablePagination";
import { adjustSubhubInventoryFn, getSubhubInventoryFn, recordQualityIssuesFn } from "@/inventory";
import type { InventoryItem, InventoryMovement, QualityIssue, SubhubInventoryData } from "@/inventory.server";
import { num } from "@/lib/erp-data";

export type View = "inventory" | "history" | "adjustment" | "quality";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory Management — Float ERP" }] }),
  component: () => <InventoryManagement initialView="inventory" />,
});

const emptyData: SubhubInventoryData = { items: [], movements: [], qualityLogs: [], qualitySummary: { records: 0, rejectedUnits: 0 } };

export function InventoryManagement({ initialView }: { initialView: View }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const view: View = pathname.endsWith("/history") ? "history" : pathname.endsWith("/adjustment") ? "adjustment" : pathname.endsWith("/quality") ? "quality" : initialView;
  const [data, setData] = useState(emptyData);
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

  const totalUnits = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const floatItems = data.items.filter((item) => item.category === "Float").length;
  const rawMaterialItems = data.items.filter((item) => item.category === "Raw Material").length;
  const title = view === "inventory" ? "Inventory" : view === "history" ? "Inventory History" : view === "quality" ? "Quality Management" : "Stock Adjustment";

  return (
    <SubHubShell actions={view === "inventory" ? <div className="flex flex-wrap gap-2"><Link to="/inventory/quality" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><ShieldAlert className="size-4" /> Quality management</Link><Link to="/inventory/adjustment" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><SlidersHorizontal className="size-4" /> Adjust stock</Link></div> : view === "quality" ? <Link to="/inventory" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">← Inventory</Link> : null}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4">
        <div><p className="mb-1 text-xs font-semibold text-muted-foreground">SubHub / Inventory Management</p><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">Workspace-scoped raw material inventory for this SubHub.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {view === "inventory" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Stock units" value={num(totalUnits)} hint="floats and raw materials" /><Kpi label="Float variants" value={String(floatItems)} hint="BOM variants in stock" /><Kpi label="Raw materials" value={String(rawMaterialItems)} hint="required BOM components" /><Kpi label="Quality rejected" value={num(data.qualitySummary.rejectedUnits)} tone={data.qualitySummary.rejectedUnits ? "warn" : "good"} hint={`${data.qualitySummary.records} quality records`} /></div>
            <InventorySections items={data.items} loading={loading} />
          </>
        ) : null}
        {view === "history" ? <HistoryTable movements={data.movements} loading={loading} /> : null}
        {view === "quality" ? <QualityManagement data={data} loading={loading} onSaved={load} /> : null}
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

export function InventoryQualityPage() {
  return <InventoryManagement initialView="quality" />;
}

type QualityDraft = { id: number; code: string; issue: QualityIssue; quantity: string; notes: string };

function formatLoggedDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function QualityManagement({ data, loading, onSaved }: { data: SubhubInventoryData; loading: boolean; onSaved: () => Promise<void> }) {
  const [nextId, setNextId] = useState(2);
  const [rows, setRows] = useState<QualityDraft[]>([{ id: 1, code: "", issue: "Faulty", quantity: "", notes: "" }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const availableItems = data.items.filter((item) => item.quantity > 0);
  const updateRow = (id: number, changes: Partial<QualityDraft>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  const addRow = () => {
    setRows((current) => [...current, { id: nextId, code: "", issue: "Faulty", quantity: "", notes: "" }]);
    setNextId((current) => current + 1);
  };
  const removeRow = (id: number) => setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));

  async function save() {
    setError("");
    setMessage("");
    const invalidRow = rows.find((row) => !row.code || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1);
    if (invalidRow) {
      setError("Select an item and enter a whole-number quantity for every row.");
      return;
    }
    setSaving(true);
    const result = await recordQualityIssuesFn({ data: { issues: rows.map((row) => ({ code: row.code, issue: row.issue, quantity: Number(row.quantity), notes: row.notes })) } });
    if (!result.ok) {
      setError(result.message);
    } else {
      setMessage(`${rows.length} quality adjustment${rows.length === 1 ? "" : "s"} saved and inventory reduced.`);
      setRows([{ id: nextId, code: "", issue: "Faulty", quantity: "", notes: "" }]);
      setNextId((current) => current + 1);
      await onSaved();
    }
    setSaving(false);
  }

  return <div className="space-y-6">
    <Panel title="Record quality issues" description="Add multiple faulty, damaged, rejected, expired, or other non-conforming stock records, then save them together. Each quantity is deducted immediately and logged for Master Admin review.">
      <div className="p-5">
        <div className="space-y-3">{rows.map((row, index) => {
          const selected = data.items.find((item) => item.code === row.code);
          return <div key={row.id} className="rounded-md border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quality record {index + 1}</p>{rows.length > 1 ? <button type="button" onClick={() => removeRow(row.id)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"><Trash2 className="size-3.5" /> Remove</button> : null}</div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium">Inventory item<select value={row.code} onChange={(event) => updateRow(row.id, { code: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select an item</option>{availableItems.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code} · {num(item.quantity)} available</option>)}</select></label>
              <label className="text-sm font-medium">Quality issue<select value={row.issue} onChange={(event) => updateRow(row.id, { issue: event.target.value as QualityIssue })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="Faulty">Faulty</option><option value="Damaged">Damaged</option><option value="Rejected">Rejected</option><option value="Expired">Expired</option><option value="Other">Other</option></select></label>
              <label className="text-sm font-medium">Quantity<input type="number" min="1" step="1" value={row.quantity} onChange={(event) => updateRow(row.id, { quantity: event.target.value })} className="tabular mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" />{selected ? <span className="mt-1 block text-xs text-muted-foreground">Available: {num(selected.quantity)} {selected.unit}</span> : null}</label>
              <label className="text-sm font-medium md:col-span-3">Notes <span className="font-normal text-muted-foreground">(optional)</span><textarea value={row.notes} onChange={(event) => updateRow(row.id, { notes: event.target.value })} rows={2} placeholder="Describe the defect, damage, inspection reference, or disposition…" className="mt-1.5 w-full resize-none rounded-md border border-input px-3 py-2 text-sm outline-none focus:border-primary" /></label>
            </div>
          </div>;
        })}</div>
        <button type="button" onClick={addRow} className="mt-4 inline-flex items-center gap-2 rounded-md border border-dashed border-primary/50 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"><Plus className="size-4" /> Add another quality record</button>
        {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">{message ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> {message}</span> : null}<button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><ShieldAlert className="size-4" /> {saving ? "Saving…" : "Save quality adjustments"}</button></div>
      </div>
    </Panel>
    <Panel title="Quality management history" description="Every quality deduction recorded in this SubHub workspace.">
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality history…</p> : data.qualityLogs.length === 0 ? <div className="p-10 text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No quality issues recorded</p><p className="mt-1 text-sm text-muted-foreground">Saved quality adjustments will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Rejected</th><th className="px-5 py-3 text-right font-medium">Balance</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{log.date.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-3"><p className="font-medium">{log.product}</p><p className="tabular text-xs text-muted-foreground">{log.code} · {log.category}</p></td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold text-destructive">-{num(log.quantity)}</td><td className="tabular px-5 py-3 text-right">{num(log.afterQuantity)}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div>}
    </Panel>
  </div>;
}

function InventoryTable({ items, totalItems, query, setQuery, categoryFilter, setCategoryFilter, stockFilter, setStockFilter, sortKey, setSortKey, sortDirection, setSortDirection, page, pageSize, setPage, setPageSize, loading }: { items: InventoryItem[]; totalItems: number; query: string; setQuery: (value: string) => void; categoryFilter: "all" | InventoryItem["category"]; setCategoryFilter: (value: "all" | InventoryItem["category"]) => void; stockFilter: "all" | "available" | "empty"; setStockFilter: (value: "all" | "available" | "empty") => void; sortKey: "name" | "code" | "category" | "quantity" | "loggedAt"; setSortKey: (value: "name" | "code" | "category" | "quantity" | "loggedAt") => void; sortDirection: "asc" | "desc"; setSortDirection: (value: "asc" | "desc") => void; page: number; pageSize: number; setPage: (value: number) => void; setPageSize: (value: number) => void; loading: boolean }) {
  return <Panel title="Inventory" description="Float variants and the raw materials required by their BOMs are shown here." action={<Link to="/inventory/history" className="text-xs font-medium text-primary hover:underline">View movement history →</Link>}>
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div className="relative min-w-[220px] flex-1 text-xs font-medium text-muted-foreground">Search inventory<label className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, unique code, or type" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label></div>
      <label className="text-xs font-medium text-muted-foreground">Inventory type<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | InventoryItem["category"])} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="all">All inventory</option><option value="Float">Float variants</option><option value="Raw Material">Raw materials</option></select></label>
      <label className="text-xs font-medium text-muted-foreground">Stock status<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as "all" | "available" | "empty")} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="all">All stock</option><option value="available">Available</option><option value="empty">No stock</option></select></label>
      <label className="text-xs font-medium text-muted-foreground">Sort by<select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="name">Item name</option><option value="code">Unique code</option><option value="category">Inventory type</option><option value="quantity">Quantity</option><option value="loggedAt">Logged date</option></select></label>
      <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm" aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}>{sortDirection === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}{sortDirection === "asc" ? "Ascending" : "Descending"}</button>
    </div>
    {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading workspace inventory…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Unique code</th><th className="px-5 py-3 font-medium">Inventory type</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 font-medium">Logged on</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-5 py-3 font-medium">{item.name}</td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{item.code}</td><td className="px-5 py-3 text-muted-foreground">{item.category === "Raw Material" ? "Raw materials" : item.category}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(item.quantity)}</td><td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatLoggedDate(item.loggedAt)}</td><td className="px-5 py-3"><Tag tone={item.quantity > 0 ? "good" : "warn"}>{item.quantity > 0 ? "Available" : "No stock"}</Tag></td></tr>)}</tbody></table>{!items.length ? <p className="p-8 text-center text-sm text-muted-foreground">No inventory matches the current search or filters.</p> : null}</div><TablePagination total={totalItems} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></>}
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