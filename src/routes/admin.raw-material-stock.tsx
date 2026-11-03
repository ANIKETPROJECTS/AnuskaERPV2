import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createHubInventoryTransferFn, getHubTransferOptionsFn, getProcurementDataFn } from "@/procurement";
import { Shell } from "@/components/erp/Shell";
import { getMasterRawMaterialStockFn } from "@/inventory";

export const Route = createFileRoute("/admin/raw-material-stock")({
  loader: async () => Promise.all([
    getMasterRawMaterialStockFn(),
    getProcurementDataFn({ data: { panel: "admin" } }),
  ]),
  head: () => ({ meta: [{ title: "Raw Material Stock — Float ERP" }] }),
  component: MasterRawMaterialStock,
});

function MasterRawMaterialStock() {
  const [stock, procurementResult] = Route.useLoaderData();
  const procurement = procurementResult.data;
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [hubFilter, setHubFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [sortBy, setSortBy] = useState<"name" | "code" | "total-desc" | "total-asc">("name");
  const [selectedCode, setSelectedCode] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getHubTransferOptionsFn>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const allHubs = stock.ok ? stock.items[0]?.hubs ?? [] : [];
  const visibleHubs = hubFilter === "all" ? allHubs : allHubs.filter((hub) => hub.hubId === hubFilter);
  const items = useMemo(() => {
    if (!stock.ok) return [];
    const normalizedSearch = search.trim().toLowerCase();
    return stock.items.filter((item) => {
      if (normalizedSearch && !`${item.itemCode} ${item.itemName}`.toLowerCase().includes(normalizedSearch)) return false;
      const filteredQuantity = hubFilter === "all"
        ? item.totalQuantity
        : item.hubs.find((hub) => hub.hubId === hubFilter)?.quantity ?? 0;
      if (stockFilter === "in-stock" && filteredQuantity <= 0) return false;
      if (stockFilter === "out-of-stock" && filteredQuantity > 0) return false;
      return true;
    }).sort((left, right) => {
      if (sortBy === "code") return left.itemCode.localeCompare(right.itemCode, undefined, { numeric: true, sensitivity: "base" });
      if (sortBy === "total-desc") return right.totalQuantity - left.totalQuantity || left.itemName.localeCompare(right.itemName);
      if (sortBy === "total-asc") return left.totalQuantity - right.totalQuantity || left.itemName.localeCompare(right.itemName);
      return left.itemName.localeCompare(right.itemName, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [stock, search, hubFilter, stockFilter, sortBy]);
  const hasFilters = Boolean(search.trim() || hubFilter !== "all" || stockFilter !== "all" || sortBy !== "name");
  const selected = stock.ok ? stock.items.find((item) => item.itemCode === selectedCode) : undefined;
  const shortageForDestination = procurement.materialNeeds.find((need) => need.subhubUserId === destinationId && need.itemCode === selectedCode)?.shortageQuantity ?? 0;
  const sources = options?.ok ? options.sources.filter((hub) => hub.materials.find((material) => material.itemCode === selectedCode)?.transferableQuantity) : [];
  const source = sources.find((hub) => hub.hubId === sourceId);
  const available = source?.materials.find((material) => material.itemCode === selectedCode)?.transferableQuantity ?? 0;

  async function chooseDestination(hubId: string) {
    setDestinationId(hubId); setSourceId(""); setQuantity(""); setOptions(null); setError("");
    if (!selectedCode || !hubId) return;
    const result = await getHubTransferOptionsFn({ data: { panel: "admin", destinationHubId: hubId, itemCodes: [selectedCode] } });
    setOptions(result);
    if (!result.ok) setError(result.message);
  }
  async function submitTransfer() {
    if (!sourceId || !destinationId || !selectedCode || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || !reason.trim()) {
      setError("Choose source and destination factories, quantity, and a reason."); return;
    }
    setBusy(true); setError("");
    const result = await createHubInventoryTransferFn({ data: {
      panel: "admin", sourceHubId: sourceId, destinationHubId: destinationId,
      requestId: crypto.randomUUID(), items: [{ itemCode: selectedCode, quantity: Number(quantity) }], reason: reason.trim(),
    } });
    if (!result.ok) { setError(result.message); setBusy(false); return; }
    setSelectedCode(""); setOptions(null); setBusy(false); setReason(""); setQuantity("");
    await router.invalidate();
  }

  return <Shell title="Raw Material Stock" subtitle="View raw-material balances across active factories and move stock between hubs.">
    {!stock.ok ? <p role="alert" className="p-6 text-destructive">{stock.message}</p> : <>
      <section aria-label="Raw material stock filters" className="space-y-3 border-b border-border p-4">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_auto]">
          <label className="text-sm font-medium text-muted-foreground">Search material or code
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search material or code" aria-label="Search raw materials" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" />
          </label>
          <label className="text-sm font-medium text-muted-foreground">Factory
            <select value={hubFilter} onChange={(event) => setHubFilter(event.target.value)} aria-label="Filter by factory" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-foreground">
              <option value="all">All factories</option>
              {allHubs.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.hubName}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-muted-foreground">Stock filter
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)} aria-label="Filter by stock level" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-foreground">
              <option value="all">All stock levels</option>
              <option value="in-stock">In stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </label>
          <label className="text-sm font-medium text-muted-foreground">Sort by
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort raw materials" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-foreground">
              <option value="name">Material name A–Z</option>
              <option value="code">Code A–Z</option>
              <option value="total-desc">Total stock: high to low</option>
              <option value="total-asc">Total stock: low to high</option>
            </select>
          </label>
          <div className="flex justify-end">
            <div role="group" aria-label="Stock table view" className="inline-flex rounded-md border border-input p-1">
              <button type="button" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={`min-h-9 rounded px-3 text-sm font-medium ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>List</button>
              <button type="button" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={`min-h-9 rounded px-3 text-sm font-medium ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>Grid</button>
            </div>
          </div>
          {hasFilters ? <button type="button" onClick={() => { setSearch(""); setHubFilter("all"); setStockFilter("all"); setSortBy("name"); }} className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Clear filters</button> : null}
        </div>
      </section>
      {viewMode === "list" ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
        <thead className="border-y border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Raw material</th><th className="px-4 py-3">Code</th><th className="px-4 py-3 text-right">Total across factories</th><th className="px-4 py-3">Stock by factory</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.itemCode} className="border-b border-border/70">
          <td className="px-4 py-3 font-medium">{item.itemName}</td><td className="px-4 py-3 text-muted-foreground">{item.itemCode}</td>
          <td className="px-4 py-3 text-right font-semibold">{item.totalQuantity.toLocaleString("en-IN")} pcs</td>
          <td className="px-4 py-3"><button type="button" onClick={() => { setSelectedCode(item.itemCode); setError(""); setOptions(null); }} className="font-medium text-primary underline underline-offset-2">View {item.hubs.length} factories</button></td>
        </tr>)}</tbody>
      </table>{!items.length ? <p className="p-8 text-center text-muted-foreground">No raw materials match these filters.</p> : null}</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="border-y border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr><th scope="col" className="min-w-44 px-3 py-3">Raw material</th><th scope="col" className="min-w-28 px-3 py-3">Code</th><th scope="col" className="min-w-32 px-3 py-3 text-right">Total stock</th>
              {visibleHubs.map((hub) => <th key={hub.hubId} scope="col" className="min-w-36 border-l border-border px-3 py-3 text-right normal-case tracking-normal text-foreground">{hub.hubName}</th>)}
            </tr>
          </thead>
          <tbody>{items.map((item) => <tr key={item.itemCode} className="border-b border-border/70 hover:bg-muted/30">
            <td className="px-3 py-3 font-semibold">{item.itemName}</td><td className="px-3 py-3 text-muted-foreground">{item.itemCode}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{item.totalQuantity.toLocaleString("en-IN")} pcs</td>
            {visibleHubs.map((hub) => <td key={hub.hubId} className="border-l border-border/70 px-3 py-3 text-right tabular-nums">{(item.hubs.find((stockHub) => stockHub.hubId === hub.hubId)?.quantity ?? 0).toLocaleString("en-IN")} pcs</td>)}
          </tr>)}</tbody>
        </table>
        {!items.length ? <p className="p-8 text-center text-muted-foreground">No raw materials match these filters.</p> : null}
      </div>}
    </>}
    {selected ? <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setSelectedCode("")}>
      <section role="dialog" aria-modal="true" aria-label={`${selected.itemName} factory stock`} onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-background p-6 shadow-xl">
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">{selected.itemName}</h2><p className="text-sm text-muted-foreground">{selected.itemCode} · {selected.totalQuantity.toLocaleString("en-IN")} pcs total</p></div><button type="button" onClick={() => setSelectedCode("")} className="rounded border px-3 py-1">Close</button></div>
        <div className="mt-5 divide-y rounded border">{selected.hubs.map((hub) => <div key={hub.hubId} className="flex justify-between px-3 py-3"><span>{hub.hubName}</span><strong>{hub.quantity.toLocaleString("en-IN")} pcs</strong></div>)}</div>
        <h3 className="mt-6 font-semibold">Emergency stock transfer</h3>
        <label className="mt-3 block text-sm">Destination factory<select value={destinationId} onChange={(event) => void chooseDestination(event.target.value)} className="mt-1 h-10 w-full rounded border border-input bg-background px-3"><option value="">Choose a factory</option>{selected.hubs.filter((hub) => hub.hubId !== sourceId).map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.hubName}</option>)}</select></label>
        <label className="mt-3 block text-sm">Source factory<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setQuantity(""); }} className="mt-1 h-10 w-full rounded border border-input bg-background px-3"><option value="">Choose a source with available stock</option>{sources.map((hub) => <option key={hub.hubId} value={hub.hubId}>{hub.hubName} · {hub.materials.find((material) => material.itemCode === selectedCode)?.transferableQuantity} transferable</option>)}</select></label>
        <p className="mt-2 text-xs text-muted-foreground">Destination shortage: {shortageForDestination.toLocaleString("en-IN")} pcs. Transfers are limited to the recorded shortage and batch-tracked stock.</p>
        <label className="mt-3 block text-sm">Quantity<input type="number" min="1" max={Math.min(shortageForDestination, available)} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 h-10 w-full rounded border border-input px-3" /></label>
        <label className="mt-3 block text-sm">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} className="mt-1 h-10 w-full rounded border border-input px-3" placeholder="Why this stock needs to move" /></label>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        <button type="button" disabled={busy || !sourceId || !destinationId || !quantity || Number(quantity) > Math.min(shortageForDestination, available) || !reason.trim()} onClick={() => void submitTransfer()} className="mt-4 h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Transferring…" : "Transfer stock"}</button>
      </section>
    </div> : null}
  </Shell>;
}
