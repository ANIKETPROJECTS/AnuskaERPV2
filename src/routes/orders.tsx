import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, ClipboardList, Plus, RefreshCw, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/erp/Shell";
import { Kpi, Panel, Tag } from "@/components/erp/bits";
import { createProductionOrderFn, listAssignableSubhubsFn, listProductionOrdersFn } from "@/production";
import type { AssignableSubhub, ProductionOrder } from "@/production.server";
import { num, skus } from "@/lib/erp-data";

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
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [subhubs, setSubhubs] = useState<AssignableSubhub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [orderResult, subhubResult] = await Promise.all([listProductionOrdersFn(), listAssignableSubhubsFn()]);
    if (orderResult.ok) setOrders(orderResult.orders);
    else setError(orderResult.message);
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

  async function saveOrder(input: { subhubUserId: string; skuId: number; target: number; dueDate: string; notes: string }) {
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
      subtitle="Assign work to SubHubs and track completion from manager-entered daily reports"
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
                        <p className="font-medium">{order.variantName}</p>
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

function AssignTargetForm({
  subhubs,
  onClose,
  onSave,
}: {
  subhubs: AssignableSubhub[];
  onClose: () => void;
  onSave: (input: { subhubUserId: string; skuId: number; target: number; dueDate: string; notes: string }) => Promise<void>;
}) {
  const [subhubUserId, setSubhubUserId] = useState(subhubs[0]?.id ?? "");
  const [skuId, setSkuId] = useState(String(skus[0]?.id ?? ""));
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    setSaving(true);
    await onSave({ subhubUserId, skuId: Number(skuId), target: parsedTarget, dueDate, notes });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4" role="dialog" aria-modal="true" aria-labelledby="assign-target-title">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Master Admin</p>
            <h2 id="assign-target-title" className="mt-2 text-xl font-semibold">Assign production target</h2>
            <p className="mt-1 text-sm text-muted-foreground">This target will appear in the selected SubHub Manager’s daily production module.</p>
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
          <label className="block text-sm font-medium">Product variant
            <select required value={skuId} onChange={(event) => setSkuId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary">
              {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.name} · {sku.code}</option>)}
            </select>
          </label>
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