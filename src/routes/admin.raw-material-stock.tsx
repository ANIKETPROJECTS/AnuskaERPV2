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
  const [selectedCode, setSelectedCode] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getHubTransferOptionsFn>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => stock.ok
    ? stock.items.filter((item) => `${item.itemCode} ${item.itemName}`.toLowerCase().includes(search.toLowerCase()))
    : [], [stock, search]);
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
      <div className="p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search material or code" aria-label="Search raw materials" className="h-10 w-full max-w-md rounded-md border border-input px-3" /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
        <thead className="border-y border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Raw material</th><th className="px-4 py-3">Code</th><th className="px-4 py-3 text-right">Total across factories</th><th className="px-4 py-3">Stock by factory</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.itemCode} className="border-b border-border/70">
          <td className="px-4 py-3 font-medium">{item.itemName}</td><td className="px-4 py-3 text-muted-foreground">{item.itemCode}</td>
          <td className="px-4 py-3 text-right font-semibold">{item.totalQuantity.toLocaleString("en-IN")} pcs</td>
          <td className="px-4 py-3"><button type="button" onClick={() => { setSelectedCode(item.itemCode); setError(""); setOptions(null); }} className="font-medium text-primary underline underline-offset-2">View {item.hubs.length} factories</button></td>
        </tr>)}</tbody>
      </table>{!items.length ? <p className="p-8 text-center text-muted-foreground">No raw materials match this search.</p> : null}</div>
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
