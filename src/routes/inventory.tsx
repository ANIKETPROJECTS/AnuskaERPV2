import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowDownAZ, ArrowDownCircle, ArrowUpAZ, ArrowUpCircle, Check, Package, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { Tag } from "@/components/erp/bits";
import { TablePagination } from "@/components/erp/TablePagination";
import { adjustSubhubInventoryBatchFn, getSubhubInventoryFn } from "@/inventory";
import type { BatchMovement, InventoryBatch, InventoryItem, SubhubInventoryData } from "@/inventory.server";
import { num } from "@/lib/erp-data";

export type View = "inventory" | "raw-materials" | "final-products" | "history" | "quality" | "batches";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory Management — Float ERP" }] }),
  component: InventoryRouteLayout,
});

const emptyData: SubhubInventoryData = { items: [], movements: [], qualityLogs: [], qualitySummary: { records: 0, rejectedUnits: 0 }, batches: [], batchMovements: [], consistencyWarnings: [] };
const qualityReasonOptions = [
  { value: "", label: "Select reason" },
  { value: "custom", label: "Custom reason" },
  { value: "quantity-increase", label: "Quantity increase" },
  { value: "quantity-decrease", label: "Quantity decrease" },
  { value: "faulty", label: "Faulty / failed inspection" },
  { value: "damaged", label: "Damaged in handling" },
  { value: "rejected", label: "Rejected during quality check" },
  { value: "expired", label: "Expired or past shelf life" },
  { value: "count-correction", label: "Stock count correction" },
  { value: "supplier-discrepancy", label: "Supplier quantity discrepancy" },
  { value: "rework", label: "Sent for rework" },
  { value: "stock-received", label: "Stock received" },
  { value: "returned-stock", label: "Returned stock" },
  { value: "recovered-stock", label: "Recovered after reinspection" },
  { value: "production-overage", label: "Production overage" },
  { value: "supplier-replacement", label: "Supplier replacement" },
  { value: "found-during-count", label: "Found during stock count" },
] as const;

function InventoryRouteLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname === "/inventory" ? <Navigate to="/inventory/raw-materials" replace /> : <Outlet />;
}

export function InventoryManagement({ initialView }: { initialView: View }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const view: View = pathname.endsWith("/raw-materials") ? "raw-materials" : pathname.endsWith("/final-products") ? "final-products" : pathname.endsWith("/history") ? "history" : pathname.endsWith("/quality") ? "quality" : pathname.endsWith("/batches") ? "batches" : initialView;
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const requestView = view === "raw-materials" || view === "final-products" ? "inventory" : view;
    const result = await getSubhubInventoryFn({ data: { view: requestView } });
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (view === "batches" || view === "history") return;
    void load();
  }, [view]);

  const title = view === "raw-materials" ? "Raw Materials Inventory" : view === "final-products" ? "Final Product Inventory" : view === "history" ? "Inventory History" : view === "quality" ? "Quality Management" : "Batch Register";
  const isInventoryPage = view === "raw-materials" || view === "final-products";

  if (view === "batches" || view === "history") {
    return <Navigate to="/inventory/raw-materials" replace />;
  }

  return (
    <SubHubShell actions={<div className="flex flex-wrap gap-2"><Link to="/inventory/raw-materials" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Raw materials</Link><Link to="/inventory/final-products" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm">Final products</Link><Link to="/inventory/quality" className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><ShieldAlert className="size-4" /> Quality</Link></div>}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm"><RefreshCw className="size-4" /> Refresh</button>
      </header>
      <section className="px-6 pb-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {view === "raw-materials" ? <InventoryTable inventoryType="Raw Material" items={data.items.filter((item) => item.category === "Raw Material")} loading={loading} /> : null}
        {view === "final-products" ? <InventoryTable inventoryType="Float" items={data.items.filter((item) => item.category === "Float")} loading={loading} /> : null}
        {view === "quality" ? <QualityManagement data={data} loading={loading} onSaved={load} /> : null}
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

function QualityManagement({ data, loading, onSaved }: { data: SubhubInventoryData; loading: boolean; onSaved: () => Promise<void> }) {
  const [changes, setChanges] = useState<Record<string, { quantity: string; reason: string; reasonOption: string }>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "Raw Material" | "Float">("all");
  const [sortKey, setSortKey] = useState<"name" | "code" | "quantity">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...data.items]
      .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
      .filter((item) => !normalizedQuery || `${item.name} ${item.code}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftValue = sortKey === "name" ? `${left.name} ${left.code}` : left[sortKey];
        const rightValue = sortKey === "name" ? `${right.name} ${right.code}` : right[sortKey];
        const comparison = typeof leftValue === "string"
          ? leftValue.localeCompare(rightValue as string)
          : leftValue - (rightValue as number);
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [data.items, query, categoryFilter, sortKey, sortDirection]);
  const updateChange = (code: string, field: "quantity" | "reason", value: string) => {
    setChanges((current) => ({ ...current, [code]: { quantity: current[code]?.quantity ?? "", reason: current[code]?.reason ?? "", reasonOption: current[code]?.reasonOption ?? "", [field]: value } }));
    setMessage("");
    setError("");
  };
  const updateQuantity = (code: string, value: string, currentQuantity: number) => {
    setChanges((current) => {
      const existing = current[code];
      const nextCount = value.trim() === "" ? Number.NaN : Number(value);
      const reasonOption = value.trim() === ""
        ? ""
        : Number.isInteger(nextCount) && nextCount !== currentQuantity
          ? nextCount > currentQuantity ? "quantity-increase" : "quantity-decrease"
          : Number.isInteger(nextCount) && nextCount === currentQuantity ? "" : existing?.reasonOption ?? "";
      const selected = qualityReasonOptions.find((option) => option.value === reasonOption);
      return {
        ...current,
        [code]: {
          quantity: value,
          reason: reasonOption === "custom" ? existing?.reason ?? "" : reasonOption ? selected?.label ?? "" : "",
          reasonOption,
        },
      };
    });
    setMessage("");
    setError("");
  };
  const updateReasonOption = (code: string, reasonOption: string) => {
    const selected = qualityReasonOptions.find((option) => option.value === reasonOption);
    setChanges((current) => ({
      ...current,
      [code]: {
        quantity: current[code]?.quantity ?? "",
        reason: reasonOption === "custom" || !reasonOption ? "" : selected?.label ?? "",
        reasonOption,
      },
    }));
    setMessage("");
    setError("");
  };
  const clearChange = (code: string) => {
    setChanges((current) => {
      const next = { ...current };
      delete next[code];
      return next;
    });
  };

  async function save() {
    setError("");
    setMessage("");
    const adjustments = data.items
      .map((item) => ({ item, draft: changes[item.code], targetQuantity: Number(changes[item.code]?.quantity) }))
      .filter(({ item, draft, targetQuantity }) => draft && draft.quantity.trim() !== "" && targetQuantity !== item.quantity);
    if (!adjustments.length) {
      setError("Enter an updated count different from current stock for at least one item.");
      return;
    }
    const invalidQuantity = adjustments.find(({ targetQuantity }) => !Number.isInteger(targetQuantity) || targetQuantity < 0);
    if (invalidQuantity) {
      setError("Every updated count must be a whole number of zero or more.");
      return;
    }
    const invalidReason = adjustments.find(({ draft }) => !draft?.reason.trim() || draft.reason.trim().length < 2);
    if (invalidReason) {
      setError("Enter a reason for every quantity change.");
      return;
    }
    setSaving(true);
    const result = await adjustSubhubInventoryBatchFn({
      data: {
        adjustments: adjustments.map(({ item, draft, targetQuantity }) => ({
          code: item.code,
          targetQuantity,
          reason: draft!.reason.trim(),
          notes: "Quality management adjustment",
        })),
      },
    });
    if (!result.ok) {
      setError(result.message);
    } else {
      setMessage(`${adjustments.length} inventory count update${adjustments.length === 1 ? "" : "s"} saved.`);
      setChanges({});
      await onSaved();
    }
    setSaving(false);
  }

  return <div className="space-y-6">
    <Panel title="Quick quality adjustments" description="Filter raw materials or final products, then enter the updated total count. The reason is selected automatically based on whether stock increases or decreases.">
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/15 bg-primary/5 px-4 py-3 text-sm">
          <p><span className="font-medium">Fast entry:</span> enter the new total count. For example, if current stock is 10, enter 20 to set the total to 20.</p>
          <p className="text-xs text-muted-foreground">{filteredItems.length} of {data.items.length} inventory item{data.items.length === 1 ? "" : "s"} shown</p>
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1 text-xs font-medium text-muted-foreground">
            Search inventory
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or unique code" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm font-normal text-foreground outline-none focus:border-primary" />
            </div>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Show
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="mt-1 h-9 rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary">
              <option value="all">Raw materials & final products</option>
              <option value="Raw Material">Raw materials only</option>
              <option value="Float">Final products only</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Sort by
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="mt-1 h-9 rounded-md border border-input bg-white px-3 text-sm font-normal text-foreground outline-none focus:border-primary">
              <option value="name">Item name</option>
              <option value="code">Unique code</option>
              <option value="quantity">Current stock</option>
            </select>
          </label>
          <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm" aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}>
            {sortDirection === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
            {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading inventory items…</p> : data.items.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No raw materials or final products are available.</p> : filteredItems.length === 0 ? <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No inventory items match the current filter or search.</p> : <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 text-right font-medium">Current stock</th><th className="w-44 px-4 py-3 font-medium">Updated count</th><th className="min-w-[280px] px-4 py-3 font-medium">Reason</th><th className="w-24 px-4 py-3 text-right font-medium">Status</th></tr>
            </thead>
            <tbody>{filteredItems.map((item) => {
              const draft = changes[item.code] ?? { quantity: "", reason: "", reasonOption: "" };
              const quantity = Number(draft.quantity);
              const hasChange = draft.quantity.trim() !== "" && Number.isInteger(quantity) && quantity >= 0 && quantity !== item.quantity;
              return <tr key={item.code} className={`border-t border-border/70 ${hasChange ? "bg-primary/[0.035]" : ""}`}>
                <td className="whitespace-nowrap px-4 py-2.5"><p className="font-medium">{item.name}</p><p className="tabular text-xs text-muted-foreground">{item.code}</p></td>
                <td className="whitespace-nowrap px-4 py-2.5"><Tag tone={item.category === "Float" ? "info" : "neutral"}>{item.category === "Float" ? "Final product" : "Raw material"}</Tag></td>
                <td className="tabular whitespace-nowrap px-4 py-2.5 text-right font-semibold">{num(item.quantity)} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span></td>
                <td className="px-4 py-2.5"><input aria-label={`Updated count for ${item.name}`} type="text" inputMode="numeric" pattern="[0-9]*" value={draft.quantity} onChange={(event) => updateQuantity(item.code, event.target.value.replace(/\D/g, ""), item.quantity)} placeholder="New total" className={`tabular h-9 w-full rounded-md border px-3 text-sm outline-none focus:border-primary ${draft.quantity.trim() !== "" && quantity < item.quantity ? "border-destructive/40" : hasChange && quantity > item.quantity ? "border-success/40" : "border-input"}`} /></td>
                 <td className="px-4 py-2.5">
                   <select aria-label={`Reason type for ${item.name}`} value={draft.reasonOption} onChange={(event) => updateReasonOption(item.code, event.target.value)} className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary">
                     {qualityReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                   </select>
                   {draft.reasonOption === "custom" ? <input aria-label={`Custom reason for ${item.name}`} value={draft.reason} onChange={(event) => updateChange(item.code, "reason", event.target.value)} placeholder={hasChange ? "Type the reason…" : "Enter only when changing"} className="mt-1.5 h-9 w-full rounded-md border border-input px-3 text-sm outline-none focus:border-primary" /> : null}
                 </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">{hasChange ? <button type="button" onClick={() => clearChange(item.code)} className="text-xs font-medium text-primary hover:underline">Clear</button> : <span className="text-xs text-muted-foreground">No change</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {error ? <p role="alert" className="mt-4 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">{message ? <span className="inline-flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> {message}</span> : null}<button type="button" disabled={saving || loading} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><ShieldAlert className="size-4" /> {saving ? "Saving…" : "Save updated counts"}</button></div>
      </div>
    </Panel>
    <Panel title="Quality management history" description="Every quality deduction recorded in this SubHub workspace.">
      {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading quality history…</p> : data.qualityLogs.length === 0 ? <div className="p-10 text-center"><ShieldAlert className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No quality issues recorded</p><p className="mt-1 text-sm text-muted-foreground">Saved quality adjustments will appear here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Issue</th><th className="px-5 py-3 text-right font-medium">Rejected</th><th className="px-5 py-3 text-right font-medium">Balance</th><th className="px-5 py-3 font-medium">Notes</th></tr></thead><tbody>{data.qualityLogs.map((log) => <tr key={log.id} className="border-b border-border/70 last:border-0"><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{log.date.slice(0, 16).replace("T", " ")}</td><td className="px-5 py-3"><p className="font-medium">{log.product}</p><p className="tabular text-xs text-muted-foreground">{log.code} · {log.category}</p></td><td className="px-5 py-3"><Tag tone="bad">{log.issue}</Tag></td><td className="tabular px-5 py-3 text-right font-semibold text-destructive">-{num(log.quantity)}</td><td className="tabular px-5 py-3 text-right">{num(log.afterQuantity)}</td><td className="max-w-xs truncate px-5 py-3 text-muted-foreground">{log.notes || "—"}</td></tr>)}</tbody></table></div>}
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
  useEffect(() => {
    setPage(1);
  }, [query, stockFilter, sortKey, sortDirection]);

  return <div className="w-full">
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div className="relative min-w-[220px] flex-1 text-xs font-medium text-muted-foreground">Search {inventoryType === "Raw Material" ? "raw materials" : "final products"}<label className="relative mt-1 block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or unique code" className="h-9 w-full rounded-md border border-input pl-9 pr-3 text-sm font-normal text-foreground outline-none focus:border-primary" /></label></div>
      <label className="text-xs font-medium text-muted-foreground">Stock status<select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as "all" | "available" | "empty")} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="all">All stock</option><option value="available">Available</option><option value="empty">No stock</option></select></label>
      <label className="text-xs font-medium text-muted-foreground">Sort by<select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} className="mt-1 h-9 rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground"><option value="name">Item name</option><option value="code">Unique code</option><option value="quantity">Quantity</option></select></label>
      <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-sm" aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}>{sortDirection === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}{sortDirection === "asc" ? "Ascending" : "Descending"}</button>
    </div>
    {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading {inventoryType === "Raw Material" ? "raw materials" : "final products"}…</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 font-medium">Unique code</th><th className="px-5 py-3 text-right font-medium">Available quantity</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{paginatedItems.map((item) => <tr key={item.code} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 font-medium">{item.name}</td><td className="tabular whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{item.code}</td><td className="tabular px-5 py-3 text-right font-semibold">{num(item.quantity)} {item.unit}</td><td className="px-5 py-3"><Tag tone={item.quantity > 0 ? "good" : "warn"}>{item.quantity > 0 ? "Available" : "No stock"}</Tag></td></tr>)}</tbody></table>{!paginatedItems.length ? <p className="p-8 text-center text-sm text-muted-foreground">No {inventoryType === "Raw Material" ? "raw materials" : "final products"} match the current search or filters.</p> : null}</div><TablePagination total={filteredItems.length} page={page} pageSize={pageSize} pageSizeOptions={[15, 25, 50, 100]} onPageChange={setPage} onPageSizeChange={setPageSize} /></>}
  </div>;
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
