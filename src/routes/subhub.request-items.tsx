import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { createProcurementItemRequestFn, getProcurementDataFn } from "@/procurement";
import type { ProcurementData } from "@/procurement.server";

export const Route = createFileRoute("/subhub/request-items")({
  loader: () => getProcurementDataFn({ data: { panel: "subhub" } }),
  head: () => ({ meta: [{ title: "Request items — SubHub" }] }),
  component: RequestItemsPage,
});

const commonItems = [
  "Pair of scissors",
  "Packing tape",
  "Measuring tape",
  "Utility knife",
  "Permanent marker",
  "Work gloves",
];

function RequestItemsPage() {
  const result = Route.useLoaderData();
  const [data, setData] = useState<ProcurementData>(result.ok ? result.data : {
    vendors: [], orders: [], subhubs: [], vendorPerformance: [], subhubSummary: [], materialNeeds: [], itemRequests: [],
    summary: { vendorCount: 0, openOrders: 0, unitsOnOrder: 0, committedSpend: 0, completedOrders: 0, pendingOrders: 0, onTimeRate: null },
  });
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const response = await createProcurementItemRequestFn({
      data: { itemName, quantity: Number(quantity), notes },
    });
    if (!response.ok) {
      setError(response.message);
      setBusy(false);
      return;
    }
    const refreshed = await getProcurementDataFn({ data: { panel: "subhub" } });
    if (refreshed.ok) setData(refreshed.data);
    setItemName("");
    setQuantity("1");
    setNotes("");
    setNotice("Your request was sent to Procurement Management.");
    setBusy(false);
  }

  return (
    <SubHubShell title="Request items" subtitle="Request small tools, supplies, or materials for this SubHub">
      <section className="space-y-6 p-6">
        {error ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success">{notice}</p> : null}
        <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Send className="size-4" /></span>
            <div><h2 className="font-semibold">New item request</h2><p className="mt-1 text-sm text-muted-foreground">Choose a suggested item or type a different one. Procurement Management will review it.</p></div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="text-sm font-medium">Item
              <input required minLength={2} maxLength={160} list="common-request-items" value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="e.g. pair of scissors or packing tape" className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
              <datalist id="common-request-items">{commonItems.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
            <label className="text-sm font-medium">Quantity
              <input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="mt-4 block text-sm font-medium">Details <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea maxLength={500} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Purpose, preferred size, or when it is needed…" className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Send className="size-4" />{busy ? "Sending…" : "Send request"}</button>
          </div>
        </form>
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <div className="border-b border-border px-5 py-4"><div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h2 className="font-semibold">My item requests</h2></div><p className="mt-1 text-sm text-muted-foreground">Track requests submitted by this SubHub.</p></div>
          {data.itemRequests.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="border-b border-border bg-muted/15 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Requested</th><th className="px-5 py-3 font-medium">Item</th><th className="px-5 py-3 text-right font-medium">Qty</th><th className="px-5 py-3 font-medium">Status / response</th></tr></thead><tbody>{data.itemRequests.map((request) => <tr key={request.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-3 text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleDateString("en-IN")}</td><td className="px-5 py-3"><span className="font-medium">{request.itemName}</span>{request.notes ? <p className="mt-1 text-xs text-muted-foreground">{request.notes}</p> : null}</td><td className="tabular px-5 py-3 text-right">{request.quantity}</td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${request.status === "Approved" ? "bg-success/10 text-success" : request.status === "Declined" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{request.status}</span>{request.response ? <p className="mt-2 text-xs text-muted-foreground">{request.response}</p> : null}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-muted-foreground">No item requests yet.</p>}
        </section>
      </section>
    </SubHubShell>
  );
}