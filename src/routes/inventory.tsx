import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowDownCircle, ArrowUpAZ, ArrowUpCircle, Check, Package, Plus, RefreshCw, Search, ShieldAlert, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Panel, Tag } from "@/components/erp/bits";
import { TablePagination } from "@/components/erp/TablePagination";
import { adjustSubhubInventoryFn, getSubhubInventoryFn, recordQualityIssuesFn } from "@/inventory";
import type { BatchMovement, InventoryBatch, InventoryItem, QualityIssue, SubhubInventoryData } from "@/inventory.server";
import { num } from "@/lib/erp-data";

export type View = "inventory" | "raw-materials" | "final-products" | "history" | "adjustment" | "quality" | "batches";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory Management — Float ERP" }] }),
  component: InventoryRouteLayout,
});

const emptyData: SubhubInventoryData = { items: [], movements: [], qualityLogs: [], qualitySummary: { records: 0, rejectedUnits: 0 }, batches: [], batchMovements: [], consistencyWarnings: [] };

function InventoryRouteLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/inventory" ? <Navigate to="/inventory/raw-materials" replace /> : <Outlet />;
}

export function InventoryManagement({ initialView }: { initialView: View }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const view: View = pathname.endsWith("/raw-materials") ? "raw-materials" : pathname.endsWith("/final-products") ? "final-products" : pathname.endsWith("/history") ? "history" : pathname.endsWith("/adjustment") ? "adjustment" : pathname.endsWith("/quality") ? "quality" : pathname.endsWith("/batches") ? "batches" : initialView;
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

  const title = view === "raw-materials" ? "Raw Materials Inventory" : view === "final-products" ? "Final Product Inventory" : view === "history" ? "Inventory History" : view === "quality" ? "Quality Management" : view === "batches" ? "Batch Register" : "Stock Adjustment";
  const isInventoryPage = view === "raw-materials" || view === "final-products";

  return (
    <SubHubShell actions={<div className="flex flex-wrap gap-2"><Link to="/inventory/raw-materials" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Raw materials</Link><Link to="/inventory/final-products" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Final products</Link><Link to="/inventory/batches" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Batch register</Link><Link to="/inventory/history" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Movement history</Link><Link to="/inventory/quality" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><ShieldAlert className="size-4" /> Quality</Link><Link to="/inventory/adjustment" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><SlidersHorizontal className="size-4" /> Adjust</Link></div>}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4">
        <div><p className="mb-1 text-xs font-semibold text-muted-foreground">SubHub / Inventory Management</p><h1 className="text-xl font-semibold">{title}</h1><p className="text-sm text-muted-foreground">Workspace-scoped inventory for this SubHub.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {view === "raw-materials" ? <InventoryTable inventoryType="Raw Material" items={data.items.filter((item) => item.category === "Raw Material")} loading={loading} /> : null}
        {view === "final-products" ? <InventoryTable inventoryType="Float" items={data.items.filter((item) => item.category === "Float")} loading={loading} /> : null}
         {view === "history" ? <HistoryTable movements={data.batchMovements} loading={loading} /> : null}
        {view === "quality" ? <QualityManagement data={data} loading={loading} onSaved={load} /> : null}
        {view === "adjustment" ? <Adjustment onSaved={load} items={data.items} batches={data.batches} /> : null}
        {view === "batches" ? <BatchRegister batches={data.batches} loading={loading} /> : null}
      </section>
    </SubHubShell>
  );
}

export function InventoryHistoryPage() {
  return <InventoryManagement initialView="history" />;
}

export function InventoryRawMaterialsPage() {
  return <InventoryManagement initialView="raw-materials" />;
}

export function InventoryFinalProductsPage() {
  return <InventoryManagement initialView="final-products" />;
}

export function InventoryAdjustmentPage() {
  return <InventoryManagement initialView="adjustment" />;
}

export function InventoryQualityPage() {
  return <InventoryManagement initialView="quality" />;
}
export function InventoryBatchesPage() { return <InventoryManagement initialView="batches" />; }

function BatchRegister({ batches, loading }: { batches: InventoryBatch[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<"loggedAt" | "batchCode" | "availableQuantity">("loggedAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => batches.filter((batch) => `${batch.batchCode} ${batch.itemName} ${batch.itemCode} ${batch.source}`.toLowerCase().includes(query.toLowerCase())).filter((batch) => category === "all" || batch.category === category).filter((batch) => source === "all" || batch.source === source).filter((batch) => status === "all" || batch.status === status).sort((a, b) => {
    const left = a[sortKey]; const right = b[sortKey]; const comparison = typeof left === "string" ? left.localeCompare(right as string) : (left as number) - (right as number);
    return direction === "asc" ? comparison : -comparison;
  }), [batches, query, category, source, status, sortKey, direction]);
  const visible = rows.slice((page - 1) * 15, page * 15);
  useEffect(() => setPage(1), [query, category, source, status, sortKey, direction]);
  return <Panel title="Batch register" description="Source-reconciled receipt, molding, final-product, manual and legacy batches."><div className="filter-toolbar border-b border-border p-4"><label className="relative min-w-[220px] flex-1 text-xs font-medium text-muted-foreground">Search<label className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search batches" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Batch, item or source" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm" /></label></label><label className="text-xs font-medium text-muted-foreground">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option><option>Raw Material</option><option>Float</option></select></label><label className="text-xs font-medium text-muted-foreground">Source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option>{[...new Set(batches.map((batch) => batch.source))].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option>Available</option><option>Depleted</option></select></label><label className="text-xs font-medium text-muted-foreground">Sort<select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}><option value="loggedAt">Logged date</option><option value="batchCode">Batch code</option><option value="availableQuantity">Available</option></select></label><button type="button" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} className="h-9 rounded-md border border-input bg-white px-3 text-sm">{direction === "asc" ? "Oldest / A–Z" : "Newest / Z–A"}</button></div>{loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading batches…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Batch code</th><th className="px-5 py-3">Item / source</th><th className="px-5 py-3 text-right">Received</th><th className="px-5 py-3 text-right">Produced</th><th className="px-5 py-3 text-right">Consumed</th><th className="px-5 py-3 text-right">Defective</th><th className="px-5 py-3 text-right">Available</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Logged</th></tr></thead><tbody>{visible.map((batch) => <tr key={batch.id} className="border-b border-border/70"><td className="tabular px-5 py-3 text-xs font-medium"><Link to="/inventory/batches/$batchId" params={{ batchId: batch.id }} className="text-primary hover:underline">{batch.batchCode}</Link></td><td className="px-5 py-3"><p className="font-medium">{batch.itemName}</p><p className="text-xs text-muted-foreground">{batch.itemCode} · {batch.source}</p></td><td className="tabular px-5 py-3 text-right">{num(batch.receivedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.producedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.consumedQuantity)}</td><td className="tabular px-5 py-3 text-right">{num(batch.defectiveQuantity)}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(batch.availableQuantity)}</td><td className="px-5 py-3"><Tag tone={batch.availableQuantity ? "good" : "warn"}>{batch.status}</Tag></td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{batch.loggedAt.slice(0, 16).replace("T", " ")}</td></tr>)}</tbody></table></div><TablePagination total={rows.length} page={page} pageSize={15} pageSizeOptions={[15]} onPageChange={setPage} onPageSizeChange={() => undefined} /></>}</Panel>;
}

type QualityDraft = { id: number; code: string; batchId?: string; issue: QualityIssue; quantity: string; notes: string };

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
    const result = await recordQualityIssuesFn({ data: { issues: rows.map((row) => ({ code: row.code, batchId: row.batchId, issue: row.issue, quantity: Number(row.quantity), notes: row.notes })) } });
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
              <label className="text-sm font-medium">Inventory item<select value={row.code} onChange={(event) => { const code = event.target.value; const batchId = data.batches.filter((batch) => batch.itemCode === code && batch.availableQuantity > 0).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))[0]?.id; updateRow(row.id, batchId ? { code, batchId } : { code }); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select an item</option>{availableItems.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code} · {num(item.quantity)} available</option>)}</select></label>
              <label className="text-sm font-medium">Batch <span className="font-normal text-muted-foreground">(FIFO preselected)</span><select value={row.batchId ?? ""} disabled={!row.code} onChange={(event) => updateRow(row.id, event.target.value ? { batchId: event.target.value } : { batchId: "" })} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Automatic FIFO</option>{data.batches.filter((batch) => batch.itemCode === row.code && batch.availableQuantity > 0).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)).map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {num(batch.availableQuantity)} available</option>)}</select></label>
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
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality history…</p> : data.qualityLogs.length === 0 ? <div className="p-10 text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No quality issues recorded</p><p className="mt-1 text-sm text-muted-foreground">Saved quality adjustments will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Item / batch</th><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Rejected</th><th className="px-5 py-3 text-right font-medium">Balance</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{log.date.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-3"><p className="font-medium">{log.product}</p><p className="tabular text-xs text-muted-foreground">{log.code} · {log.batchCode || "FIFO batches"} · {log.category}</p></td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold text-destructive">-{num(log.quantity)}</td><td className="tabular px-5 py-3 text-right">{num(log.afterQuantity)}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div>}
    </Panel>
  </div>;
}

function InventoryTable({ inventoryType, items, loading }: { inventoryType: InventoryItem["category"]; items: InventoryItem[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "available" | "empty">("all");
  const [sortKey, setSortKey] = useState<"name" | "code" | "quantity">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => !normalizedQuery || `${item.name} ${item.code}`.toLowerCase().includes(normalizedQuery))
      .filter((item) => stockFilter === "all" || (stockFilter === "available" ? item.quantity > 0 : item.quantity <= 0))
      .sort((a, b) => {
        const left = sortKey === "name" ? `${a.name} ${a.code}` : a[sortKey];
        const right = sortKey === "name" ? `${b.name} ${b.code}` : b[sortKey];
        const comparison = typeof left === "string" ? left.localeCompare(right as string) : left - (right as number);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [items, query, stockFilter, sortKey, sortDirection]);
  const paginatedItems = useMemo(() => filteredItems.slice((page - 1) * pageSize, page * pageSize), [filteredItems, page, pageSize]);
  const title = inventoryType === "Raw Material" ? "Raw Materials Inventory" : "Final Product Inventory";
  const description = inventoryType === "Raw Material" ? "Raw materials required by the BOM variants assigned to this SubHub." : "Completed Float BOM variants produced by this SubHub.";

  useEffect(() => {
    setPage(1);
  }, [query, stockFilter, sortKey, sortDirection]);

  return <Panel title={title} description={description} action={inventoryType === "Raw Material" ? <Link to="/inventory/history" className="text-xs font-medium text-primary hover:underline">View movement history →</Link> : null}>
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div className="relative min-w-[220px] flex-1 text-xs font-medium text-muted-foreground">Search {inventoryType === "Raw Material" ? "raw materials" : "final products"}<label className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or unique code" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label></div>
      <label className="text-xs font-medium text-muted-foreground">Stock status<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as "all" | "available" | "empty")} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="all">All stock</option><option value="available">Available</option><option value="empty">No stock</option></select></label>
      <label className="text-xs font-medium text-muted-foreground">Sort by<select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="name">Item name</option><option value="code">Unique code</option><option value="quantity">Quantity</option></select></label>
      <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm" aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}>{sortDirection === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}{sortDirection === "asc" ? "Ascending" : "Descending"}</button>
    </div>
    {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading {inventoryType === "Raw Material" ? "raw materials" : "final products"}…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Unique code</th><th className="px-5 py-3 text-right font-medium">Quantity</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{paginatedItems.map((item) => <tr key={item.code} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-5 py-3 font-medium"><Link to="/inventory/items/$itemCode" params={{ itemCode: item.code }} className="text-primary hover:underline">{item.name}</Link></td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground"><Link to="/inventory/items/$itemCode" params={{ itemCode: item.code }} className="hover:text-primary hover:underline">{item.code}</Link></td><td className="tabular px-5 py-3 text-right font-semibold">{num(item.quantity)}</td><td className="px-5 py-3"><Tag tone={item.quantity > 0 ? "good" : "warn"}>{item.quantity > 0 ? "Available" : "No stock"}</Tag></td></tr>)}</tbody></table>{!paginatedItems.length ? <p className="p-8 text-center text-sm text-muted-foreground">No {inventoryType === "Raw Material" ? "raw materials" : "final products"} match the current search or filters.</p> : null}</div><TablePagination total={filteredItems.length} page={page} pageSize={pageSize} pageSizeOptions={[15, 25, 50, 100]} onPageChange={setPage} onPageSizeChange={setPageSize} /></>}
  </Panel>;
}

function HistoryTable({ movements, loading }: { movements: BatchMovement[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const rows = useMemo(() => movements.filter((movement) => `${movement.batchCode} ${movement.itemCode} ${movement.reason} ${movement.reference}`.toLowerCase().includes(query.toLowerCase())).filter((movement) => type === "all" || movement.type === type).filter((movement) => direction === "all" || (direction === "in" ? movement.quantityDelta > 0 : movement.quantityDelta < 0)).sort((a, b) => sort === "asc" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)), [movements, query, type, direction, sort]);
  useEffect(() => setPage(1), [query, type, direction, sort]);
  const visible = rows.slice((page - 1) * 15, page * 15);
  return <Panel title="Inventory History" description="Immutable batch movement ledger for receipts, production, consumption, quality and adjustments."><div className="filter-toolbar border-b border-border p-4"><label className="min-w-[220px] flex-1 text-xs font-medium text-muted-foreground">Search<input aria-label="Search movement history" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Batch, item, reason or reference" className="mt-1 h-9 w-full rounded-md border border-input px-3 text-sm" /></label><label className="text-xs font-medium text-muted-foreground">Movement type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option>{["IN", "OUT", "QUALITY", "ADJUSTMENT", "PRODUCTION"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Direction<select value={direction} onChange={(event) => setDirection(event.target.value)}><option value="all">Both directions</option><option value="in">Inbound</option><option value="out">Outbound</option></select></label><button type="button" onClick={() => setSort(sort === "asc" ? "desc" : "asc")} className="h-9 rounded-md border border-input bg-white px-3 text-sm">{sort === "asc" ? "Oldest first" : "Newest first"}</button></div>{loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading movement history…</p> : rows.length === 0 ? <div className="p-10 text-center"><Package className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No batch movements match</p></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Date / time</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Item</th><th className="px-5 py-3">Movement</th><th className="px-5 py-3">Reason / reference</th><th className="px-5 py-3 text-right">Delta</th><th className="px-5 py-3 text-right">Balance</th></tr></thead><tbody>{visible.map((movement) => <tr key={movement.id} className="border-b border-border/70"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{movement.createdAt.replace("T", " ").slice(0, 19)}</td><td className="px-5 py-3"><Link to="/inventory/batches/$batchId" params={{ batchId: movement.batchId }} className="font-medium text-primary hover:underline">{movement.batchCode}</Link></td><td className="px-5 py-3">{movement.itemCode}</td><td className="px-5 py-3">{movement.quantityDelta > 0 ? <ArrowUpCircle className="mr-2 inline size-4 text-success" /> : <ArrowDownCircle className="mr-2 inline size-4 text-destructive" />}{movement.type}</td><td className="px-5 py-3"><p>{movement.reason}</p><p className="text-xs text-muted-foreground">{movement.reference}</p></td><td className={`tabular px-5 py-3 text-right font-semibold ${movement.quantityDelta > 0 ? "text-success" : "text-destructive"}`}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</td><td className="tabular px-5 py-3 text-right">{num(movement.balance)}</td></tr>)}</tbody></table></div><TablePagination total={rows.length} page={page} pageSize={15} pageSizeOptions={[15]} onPageChange={setPage} onPageSizeChange={() => undefined} /></>}</Panel>;
}

function Adjustment({ onSaved, items, batches }: { onSaved: () => Promise<void>; items: InventoryItem[]; batches: InventoryBatch[] }) {
  const [code, setCode] = useState("");
  const [batchId, setBatchId] = useState("");
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
    const result = await adjustSubhubInventoryFn({ data: { code, action, quantity: parsedQuantity, reason, notes, batchId: batchId || undefined } });
    if (!result.ok) setError(result.message);
    else {
      setMessage("Stock adjustment saved.");
      setQuantity("");
      setNotes("");
      await onSaved();
    }
    setSaving(false);
  }

  return <Panel title="Stock adjustment" description="Additions create a new adjustment batch. Removals use FIFO unless a batch is selected."><div className="p-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Raw material<select value={code} onChange={(event) => { setCode(event.target.value); setBatchId(""); }} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select raw material</option>{items.map((item) => <option key={item.code} value={item.code}>{item.name} · {item.code}</option>)}</select></label><label className="text-sm font-medium">Action<select value={action} onChange={(event) => setAction(event.target.value as "add" | "remove")} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="add">Add stock</option><option value="remove">Remove stock</option></select></label><label className="text-sm font-medium">Quantity<input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="tabular mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" />{action === "remove" && current ? <span className="mt-1 block text-xs text-muted-foreground">Available: {num(current.quantity)}</span> : null}</label><label className="text-sm font-medium">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input px-3 text-sm" /></label><label className="text-sm font-medium md:col-span-2">Batch for removal <span className="font-normal text-muted-foreground">(optional; FIFO by default)</span><select value={batchId} disabled={action === "add" || !code} onChange={(event) => setBatchId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Automatic FIFO</option>{batches.filter((batch) => batch.itemCode === code && batch.availableQuantity > 0).map((batch) => <option key={batch.id} value={batch.id}>{batch.batchCode} · {num(batch.availableQuantity)} available</option>)}</select></label><label className="text-sm font-medium md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional receiving or consumption details…" className="mt-1.5 w-full resize-none rounded-md border border-input px-3 py-2 text-sm" /></label></div>{error ? <p role="alert" className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}<div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">{message ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> {message}</span> : null}<button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Check className="size-4" /> {saving ? "Saving…" : "Save adjustment"}</button></div></div></Panel>;
}