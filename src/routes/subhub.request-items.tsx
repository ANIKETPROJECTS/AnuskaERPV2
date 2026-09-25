import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Check, ClipboardList, Minus, Plus, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { SubHubShell } from "@/components/erp/SubHubShell";
import { createProcurementItemRequestFn, getProcurementDataFn } from "@/procurement";
import type { ProcurementData, ProcurementItemRequest } from "@/procurement.server";
import { num } from "@/lib/erp-data";

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

const emptyData: ProcurementData = {
  vendors: [],
  orders: [],
  subhubs: [],
  vendorPerformance: [],
  subhubSummary: [],
  materialNeeds: [],
  itemRequests: [],
  summary: {
    vendorCount: 0,
    openOrders: 0,
    unitsOnOrder: 0,
    committedSpend: 0,
    completedOrders: 0,
    pendingOrders: 0,
    onTimeRate: null,
  },
};

function RequestItemsPage() {
  const result = Route.useLoaderData();
  const [data, setData] = useState<ProcurementData>(() => (result.ok ? result.data : emptyData));
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(result.ok ? "" : result.message);
  const [notice, setNotice] = useState("");
  const requests = useMemo(
    () =>
      [...data.itemRequests].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [data.itemRequests],
  );
  const pendingCount = requests.filter((request) => request.status === "Pending").length;
  const resolvedCount = requests.length - pendingCount;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await createProcurementItemRequestFn({
        data: { itemName: itemName.trim(), quantity: Number(quantity), notes: notes.trim() },
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setData((current) => ({
        ...current,
        itemRequests: [response.request, ...current.itemRequests],
      }));
      setItemName("");
      setQuantity("1");
      setNotes("");
      setNotice("Your request was sent to Procurement Management.");
    } catch {
      setError("Your request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function adjustQuantity(amount: number) {
    const current = Number(quantity) || 1;
    setQuantity(String(Math.max(1, Math.floor(current) + amount)));
  }

  return (
    <SubHubShell headerTitle="Request items">
      <section className="space-y-4 p-4 pb-28 sm:space-y-5 sm:p-6 sm:pb-28">
        <p className="text-sm text-muted-foreground">
          Request tools, supplies, or materials and track Procurement Management’s response here.
        </p>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="flex items-center gap-2 rounded-md border border-success/25 bg-success/5 px-4 py-3 text-sm text-success"
          >
            <Check className="size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Requests submitted" value={num(requests.length)} helper="from this SubHub" />
          <Stat
            label="Awaiting review"
            value={num(pendingCount)}
            helper="with Procurement Management"
            tone="text-warning"
          />
          <Stat
            label="Resolved"
            value={num(resolvedCount)}
            helper="approved or declined"
            tone="text-success"
          />
        </div>

        <form
          id="subhub-item-request-form"
          onSubmit={(event) => void submit(event)}
          className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">Request an item</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a suggested item or enter another one. Procurement Management will review it.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-medium">
              Item
              <input
                required
                minLength={2}
                maxLength={160}
                list="common-request-items"
                value={itemName}
                disabled={busy}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="e.g. pair of scissors or packing tape"
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              />
              <datalist id="common-request-items">
                {commonItems.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <div>
              <label htmlFor="request-item-quantity" className="block text-sm font-medium">
                Quantity
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={busy || Number(quantity) <= 1}
                  onClick={() => adjustQuantity(-1)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minus className="size-5" />
                </button>
                <input
                  id="request-item-quantity"
                  required
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={quantity}
                  disabled={busy}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="tabular h-11 w-24 rounded-md border border-input bg-background px-2 text-center text-lg font-semibold outline-none focus:border-primary"
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={busy}
                  onClick={() => adjustQuantity(1)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md border border-input bg-white hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium">
            Details <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea
              maxLength={500}
              rows={2}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Purpose, preferred size, or when it is needed…"
              className="mt-1.5 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </form>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {pendingCount
                ? `${num(pendingCount)} request${pendingCount === 1 ? "" : "s"} awaiting review`
                : "Your requests and responses appear below"}
            </p>
            <button
              type="submit"
              form="subhub-item-request-form"
              disabled={busy}
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-5" aria-hidden="true" />
              {busy ? "Sending…" : "Send item request"}
            </button>
          </div>
        </div>

        <section aria-labelledby="my-item-requests-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                <h2 id="my-item-requests-heading" className="text-lg font-semibold">
                  My item requests
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Check each request’s status and any response from Procurement Management.
              </p>
            </div>
            <p className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
              {num(requests.length)} {requests.length === 1 ? "request" : "requests"}
            </p>
          </div>

          {requests.length ? (
            <div className="space-y-3">
              {requests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
              <ClipboardList className="mx-auto size-10 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold">No item requests yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Your submitted requests and their review status will appear here.
              </p>
            </div>
          )}
        </section>
      </section>
    </SubHubShell>
  );
}

function RequestCard({ request }: { request: ProcurementItemRequest }) {
  const statusStyle =
    request.status === "Approved"
      ? "bg-success/10 text-success"
      : request.status === "Declined"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";

  return (
    <article className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{request.itemName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Quantity: <strong className="tabular text-foreground">{num(request.quantity)}</strong>
            <span aria-hidden="true"> · </span>
            Requested {formatRequestDate(request.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${statusStyle}`}>
          {request.status}
        </span>
      </div>

      {request.notes ? (
        <div className="mt-4 rounded-md bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.notes}</p>
        </div>
      ) : null}
      {request.response ? (
        <div className="mt-3 rounded-md border border-primary/15 bg-primary/5 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Procurement response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.response}</p>
        </div>
      ) : request.status === "Pending" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Waiting for Procurement Management to review this request.
        </p>
      ) : null}
    </article>
  );
}

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function Stat({
  label,
  value,
  helper,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
