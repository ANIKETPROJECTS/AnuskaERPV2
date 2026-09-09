import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, Split } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { getManagerProductionDataFn, previewProductionBatchAllocationFn } from "@/production";
import type { ProductionOrder } from "@/production.server";
import type { ProductionAllocationPreview, ProductionManualAllocation } from "@/inventory.server";
import { num } from "@/lib/erp-data";

const allocationSearch = z.object({
  date: z.string().optional(),
  quantity: z.string().optional(),
});

export const Route = createFileRoute("/subhub/production/allocation/$orderId")({
  validateSearch: allocationSearch,
  head: () => ({ meta: [{ title: "Material allocation — Hub Manager · SubHub" }] }),
  component: ProductionAllocationPage,
});

function ProductionAllocationPage() {
  const { orderId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const selectedDate = search.date || new Date().toISOString().slice(0, 10);
  const requestedQuantity = search.quantity === undefined ? undefined : Math.max(0, Math.floor(Number(search.quantity) || 0));
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [quantity, setQuantity] = useState(requestedQuantity ?? 0);
  const [preview, setPreview] = useState<ProductionAllocationPreview | null>(null);
  const [manual, setManual] = useState(false);
  const [rows, setRows] = useState<ProductionManualAllocation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getManagerProductionDataFn().then(async (managerResult) => {
      if (!active) return;
      if (!managerResult.ok) {
        setError(managerResult.message);
        setLoading(false);
        return;
      }
      const found = managerResult.data.orders.find((item) => item.id === orderId);
      if (!found) {
        setError("This order is no longer assigned to this SubHub.");
        setLoading(false);
        return;
      }
      const nextQuantity = requestedQuantity ?? Math.max(0, found.remaining);
      setOrder(found);
      setQuantity(nextQuantity);
      const result = await previewProductionBatchAllocationFn({ data: { orderId, date: selectedDate, quantity: nextQuantity } });
      if (!active) return;
      if (!result.ok) setError(result.message);
      else {
        setPreview(result.preview);
        setManual(result.preview.allocationMode === "hybrid");
        setRows(result.preview.manualAllocations);
        setError("");
      }
      setLoading(false);
    }).catch(() => {
      if (active) {
        setError("The material allocation could not be loaded.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [orderId, requestedQuantity, selectedDate]);

  async function refreshPreview(nextQuantity: number) {
    setQuantity(nextQuantity);
    setLoading(true);
    const result = await previewProductionBatchAllocationFn({ data: { orderId, date: selectedDate, quantity: nextQuantity } });
    if (result.ok) {
      setPreview(result.preview);
      setManual(result.preview.allocationMode === "hybrid");
      setRows(result.preview.manualAllocations);
      setError("");
    } else setError(result.message);
    setLoading(false);
  }

  function returnToProduction() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(allocationStorageKey(orderId, selectedDate), JSON.stringify({ manual, rows }));
    }
    void navigate({ to: "/subhub/production" });
  }

  return (
    <SubHubShell actions={<Link to="/subhub/production" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" /> Back to assigned orders</Link>}>
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {!order ? <p className="text-sm text-muted-foreground">{loading ? "Loading material allocation…" : "Order unavailable."}</p> : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SubHub / Hub Manager / Material allocation</p>
              <h1 className="mt-2 text-2xl font-semibold">{order.variantName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{order.orderNumber} · Production date {selectedDate}</p>
            </div>
            <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="font-semibold">How much will be produced?</p><p className="mt-1 text-sm text-muted-foreground">The system uses the oldest available material first.</p></div>
                <label className="text-sm font-medium">Output units<input type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value) || 0)))} onBlur={() => void refreshPreview(quantity)} className="tabular mt-1 block h-9 w-32 rounded-md border border-input px-3 text-right" /></label>
              </div>
            </section>
            {loading ? <p className="rounded-xl border border-border bg-white p-8 text-center text-sm text-muted-foreground">Building material allocation…</p> : preview ? <AllocationDetails preview={preview} manual={manual} rows={rows} onModeChange={setManual} onRowsChange={setRows} /> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/subhub/production/orders/$orderId" params={{ orderId }} className="inline-flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm font-medium hover:bg-muted"><ArrowLeft className="size-4" /> Order details</Link>
              <button type="button" onClick={returnToProduction} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Check className="size-4" /> Use this allocation</button>
            </div>
          </>
        )}
      </section>
    </SubHubShell>
  );
}

function AllocationDetails({ preview, manual, rows, onModeChange, onRowsChange }: { preview: ProductionAllocationPreview; manual: boolean; rows: ProductionManualAllocation[]; onModeChange: (value: boolean) => void; onRowsChange: (rows: ProductionManualAllocation[]) => void }) {
  const batchesFor = (itemCode: string) => preview.batches.filter((batch) => batch.itemCode === itemCode);
  const updateRow = (itemCode: string, batchId: string, quantity: number) => {
    const next = rows.filter((row) => !(row.itemCode === itemCode && row.batchId === batchId));
    if (quantity > 0) next.push({ itemCode, batchId, quantity });
    onRowsChange(next);
  };
  return <section className="rounded-xl border border-border bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div><div className="flex items-center gap-2"><Split className="size-4 text-primary" /><h2 className="font-semibold">Material allocation</h2></div><p className="mt-1 text-sm text-muted-foreground">Review the material needed for this production entry.</p></div>
      <div className={`rounded-full px-3 py-1 text-xs font-semibold ${preview.sufficient ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{preview.sufficient ? "Enough material available" : "Not enough material available"}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 text-sm"><span className="text-muted-foreground">FIFO allocation is automatic.</span><label className="inline-flex items-center gap-2 font-medium"><input type="checkbox" checked={manual} onChange={(event) => onModeChange(event.target.checked)} /> Use manual batch split</label></div>
    <div className="space-y-3 p-5">
      {preview.requirements.map((requirement) => {
        const itemRows = rows.filter((row) => row.itemCode === requirement.itemCode);
        const available = batchesFor(requirement.itemCode).reduce((sum, batch) => sum + batch.availableQuantity, 0);
        return <div key={requirement.itemCode} className="rounded-md border border-border/70 bg-muted/10 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{requirement.itemName} <span className="tabular text-xs text-muted-foreground">{requirement.itemCode}</span></p><p className={`tabular text-xs font-medium ${available >= requirement.requiredQuantity ? "text-success" : "text-destructive"}`}>{num(available)} available · {num(requirement.requiredQuantity)} needed</p></div>
          {!manual ? <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">{batchesFor(requirement.itemCode).slice(0, 4).map((batch) => <span key={batch.id} className="rounded border border-border bg-white px-2 py-1"><span className="font-medium text-foreground">{batch.batchCode}</span> · {num(batch.availableQuantity)} units</span>)}{available < requirement.requiredQuantity ? <span className="inline-flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="size-3.5" /> Insufficient stock</span> : null}</div> : <div className="mt-3 space-y-2">{batchesFor(requirement.itemCode).map((batch) => <label key={batch.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span><span className="font-medium">{batch.batchCode}</span> <span className="text-xs text-muted-foreground">available {num(batch.availableQuantity)}</span></span><input aria-label={`Allocate ${requirement.itemName} from ${batch.batchCode}`} type="number" min="0" max={batch.availableQuantity} step="1" value={itemRows.find((row) => row.batchId === batch.id)?.quantity ?? ""} onChange={(event) => updateRow(requirement.itemCode, batch.id, Math.max(0, Number(event.target.value) || 0))} className="tabular h-8 w-28 rounded border border-input px-2 text-right" /></label>)}</div>}
        </div>;
      })}
    </div>
  </section>;
}

function allocationStorageKey(orderId: string, date: string) {
  return `subhub:production-allocation:${orderId}:${date}`;
}